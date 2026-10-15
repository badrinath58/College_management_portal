// Attendance. Students view their own; faculty mark / update / report for THEIR subjects.
const { pool, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { getPagination, paged } = require('../utils/pagination');
const { requireFields, toInt, toDate, oneOf, todayISO } = require('../utils/validators');
const { resolveStudentId, getStudentById, assertSubjectAccess } = require('../services/identity');
const attendanceService = require('../services/attendanceService');

const STATUSES = ['present', 'absent', 'late'];

// Validate [{student_id, status}, ...] and remove duplicates
function cleanRecords(records) {
  if (!Array.isArray(records) || !records.length) throw new AppError('records must be a non-empty list.', 400);
  const map = new Map();
  for (const r of records) {
    map.set(toInt(r.student_id, 'student_id'), oneOf(r.status, STATUSES, 'status'));
  }
  return [...map.entries()].map(([student_id, status]) => ({ student_id, status }));
}

// Every student in the list must really belong to this subject's semester and section
async function checkRoster(studentIds, subject, section) {
  const [rows] = await pool.query(
    'SELECT id FROM students WHERE id IN (?) AND current_semester_id = ? AND section = ?',
    [studentIds, subject.semester_id, section]);
  if (rows.length !== studentIds.length) throw new AppError('Some students do not belong to this class.', 400);
}

// GET /api/attendance   (student: own | faculty/admin: ?student_id=)
const getAttendance = asyncHandler(async (req, res) => {
  const studentId = await resolveStudentId(req);
  const student = await getStudentById(studentId);
  if (!student) throw new AppError('Student not found.', 404);
  const semesterId = req.query.semester_id ? toInt(req.query.semester_id, 'semester_id') : student.current_semester_id;
  const subjects = await attendanceService.summary(studentId, semesterId);
  sendSuccess(res, {
    student: { id: student.id, student_code: student.student_code, full_name: student.full_name },
    semester_id: semesterId, minimum_percent: attendanceService.MIN_PERCENT,
    subjects, overall: attendanceService.overall(subjects),
  });
});

// GET /api/attendance/roster?subject_id=&section=   -> the class list used to mark attendance
const getRoster = asyncHandler(async (req, res) => {
  requireFields(req.query, ['subject_id', 'section']);
  const subject = await assertSubjectAccess(req, toInt(req.query.subject_id, 'subject_id'));
  const [rows] = await pool.query(
    'SELECT id, student_code, full_name FROM students WHERE current_semester_id = ? AND section = ? ORDER BY student_code',
    [subject.semester_id, req.query.section]);
  sendSuccess(res, { subject, section: req.query.section, students: rows });
});

// GET /api/attendance/sessions?subject_id=&section=&from=&to=
const listSessions = asyncHandler(async (req, res) => {
  requireFields(req.query, ['subject_id']);
  const subject = await assertSubjectAccess(req, toInt(req.query.subject_id, 'subject_id'));
  const pg = getPagination(req.query);
  const where = ['a.subject_id = ?'];
  const params = [subject.id];
  if (req.query.section) { where.push('a.section = ?'); params.push(req.query.section); }
  if (req.query.from) { where.push('a.class_date >= ?'); params.push(toDate(req.query.from, 'from')); }
  if (req.query.to) { where.push('a.class_date <= ?'); params.push(toDate(req.query.to, 'to')); }
  const w = `WHERE ${where.join(' AND ')}`;
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM attendance a ${w}`, params);
  const [rows] = await pool.query(
    `SELECT a.id, a.section, a.class_date, a.period_no, a.topic,
            SUM(ar.status IN ('present','late')) AS present_count, SUM(ar.status = 'absent') AS absent_count
       FROM attendance a LEFT JOIN attendance_records ar ON ar.attendance_id = a.id
       ${w} GROUP BY a.id, a.section, a.class_date, a.period_no, a.topic
       ORDER BY a.class_date DESC, a.period_no DESC LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
  sendSuccess(res, paged(rows, total, pg));
});

// GET /api/attendance/sessions/:id   -> one class with every student's status (for editing)
const getSession = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM attendance WHERE id = ?', [req.params.id]);
  if (!rows[0]) throw new AppError('Attendance session not found.', 404);
  await assertSubjectAccess(req, rows[0].subject_id);
  const [records] = await pool.query(
    `SELECT s.id AS student_id, s.student_code, s.full_name, ar.status
       FROM attendance_records ar JOIN students s ON s.id = ar.student_id
      WHERE ar.attendance_id = ? ORDER BY s.student_code`, [req.params.id]);
  sendSuccess(res, { session: rows[0], records });
});

// POST /api/attendance   body: { subject_id, section, class_date, period_no, topic?, records:[{student_id,status}] }
const markAttendance = asyncHandler(async (req, res) => {
  const b = req.body;
  requireFields(b, ['subject_id', 'section', 'class_date', 'period_no']);
  const subject = await assertSubjectAccess(req, toInt(b.subject_id, 'subject_id'));
  toDate(b.class_date, 'class_date');
  if (b.class_date > todayISO()) throw new AppError('You cannot mark attendance for a future date.', 400);
  const records = cleanRecords(b.records);
  await checkRoster(records.map((r) => r.student_id), subject, b.section);

  const sessionId = await withTransaction(async (conn) => {
    let result;
    try {
      [result] = await conn.query(
        'INSERT INTO attendance (subject_id, faculty_id, section, class_date, period_no, topic) VALUES (?, ?, ?, ?, ?, ?)',
        [subject.id, subject.faculty_id, b.section, b.class_date, toInt(b.period_no, 'period_no'), b.topic || null]);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new AppError('Attendance for this class is already marked. Please update it instead.', 409);
      throw err;
    }
    await conn.query('INSERT INTO attendance_records (attendance_id, student_id, status) VALUES ?',
      [records.map((r) => [result.insertId, r.student_id, r.status])]);
    return result.insertId;
  });
  await attendanceService.notifyIfLow(records.map((r) => r.student_id), subject);
  sendSuccess(res, { id: sessionId }, 'Attendance marked successfully', 201);
});

// PUT /api/attendance/:id   body: { topic?, records:[{student_id,status}] }
const updateAttendance = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM attendance WHERE id = ?', [req.params.id]);
  const session = rows[0];
  if (!session) throw new AppError('Attendance session not found.', 404);
  const subject = await assertSubjectAccess(req, session.subject_id);
  const records = cleanRecords(req.body.records);
  await checkRoster(records.map((r) => r.student_id), subject, session.section);

  await withTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO attendance_records (attendance_id, student_id, status) VALUES ?
       ON DUPLICATE KEY UPDATE status = VALUES(status)`,
      [records.map((r) => [session.id, r.student_id, r.status])]);
    if (req.body.topic !== undefined) await conn.query('UPDATE attendance SET topic = ? WHERE id = ?', [req.body.topic, session.id]);
  });
  await attendanceService.notifyIfLow(records.map((r) => r.student_id), subject);
  sendSuccess(res, null, 'Attendance updated successfully');
});

// GET /api/attendance/report?subject_id=&section=   -> every student's percentage in one subject
const report = asyncHandler(async (req, res) => {
  requireFields(req.query, ['subject_id', 'section']);
  const subject = await assertSubjectAccess(req, toInt(req.query.subject_id, 'subject_id'));
  const [rows] = await pool.query(
    `SELECT s.id AS student_id, s.student_code, s.full_name, COUNT(ar.id) AS total_classes,
            COALESCE(SUM(ar.status IN ('present','late')), 0) AS classes_attended,
            COALESCE(SUM(ar.status = 'absent'), 0) AS classes_absent
       FROM students s
       LEFT JOIN attendance a ON a.subject_id = ? AND a.section = s.section
       LEFT JOIN attendance_records ar ON ar.attendance_id = a.id AND ar.student_id = s.id
      WHERE s.current_semester_id = ? AND s.section = ?
      GROUP BY s.id, s.student_code, s.full_name ORDER BY s.student_code`,
    [subject.id, subject.semester_id, req.query.section]);
  const students = rows.map((r) => {
    const total = Number(r.total_classes);
    const attended = Number(r.classes_attended);
    const percentage = total ? Math.round((1000 * attended) / total) / 10 : 0;
    return { ...r, total_classes: total, classes_attended: attended, classes_absent: Number(r.classes_absent),
             percentage, is_low: percentage < attendanceService.MIN_PERCENT };
  });
  sendSuccess(res, { subject, section: req.query.section, students });
});

module.exports = { getAttendance, getRoster, listSessions, getSession, markAttendance, updateAttendance, report };
