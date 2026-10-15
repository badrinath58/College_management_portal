// Exam schedules. Everyone can read; admin and faculty manage.
const { pool, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { getPagination, paged } = require('../utils/pagination');
const { whereSql } = require('../utils/scope');
const { requireFields, toInt, oneOf, toDate, toTime } = require('../utils/validators');
const { getStudentByUser } = require('../services/identity');
const { notifySemester } = require('../services/notificationService');

const EXAM_TYPES = ['mid', 'internal', 'semester', 'supplementary', 'practical'];
const EXAM_STATUS = ['scheduled', 'ongoing', 'completed', 'cancelled'];
// "upcoming" or "completed" for the two tabs on the Exam Details page
const PHASE_SQL = `(CASE WHEN e.status = 'cancelled' THEN 'cancelled'
                         WHEN e.status = 'completed' OR e.end_date < CURDATE() THEN 'completed' ELSE 'upcoming' END)`;

// attach the paper list (subject, date, time, room) to each exam
async function withSubjects(exams) {
  if (!exams.length) return exams;
  const [rows] = await pool.query(
    `SELECT es.id, es.exam_id, es.subject_id, sub.code AS subject_code, sub.name AS subject_name,
            es.exam_date, es.start_time, es.end_time, es.room_number, es.max_marks, es.instructions
       FROM exam_subjects es JOIN subjects sub ON sub.id = es.subject_id
      WHERE es.exam_id IN (?) ORDER BY es.exam_date, es.start_time`, [exams.map((e) => e.id)]);
  return exams.map((e) => ({ ...e, subjects: rows.filter((r) => r.exam_id === e.id) }));
}

// GET /api/exams?phase=upcoming|completed&semester_id=&q=&page=
const listExams = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query);
  const where = [];
  const params = [];
  if (req.user.role === 'student') {
    const s = await getStudentByUser(req.user.id);
    // my semester's exams + supplementary exams for my active backlogs
    where.push(`(e.semester_id = ? OR e.id IN (SELECT es.exam_id FROM exam_subjects es
                  JOIN backlogs b ON b.subject_id = es.subject_id AND b.student_id = ? AND b.status = 'active'))`);
    params.push(s.current_semester_id, s.id);
  } else if (req.query.semester_id) {
    where.push('e.semester_id = ?'); params.push(req.query.semester_id);
  }
  if (req.query.phase) { where.push(`${PHASE_SQL} = ?`); params.push(req.query.phase); }
  if (req.query.status) { where.push('e.status = ?'); params.push(req.query.status); }
  const q = String(req.query.q || '').trim();
  if (q) { where.push('e.name LIKE ?'); params.push(`%${q}%`); }
  const w = whereSql(where);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM exams e ${w}`, params);
  const [rows] = await pool.query(
    `SELECT e.id, e.name, e.exam_type, e.semester_id, sem.semester_no, e.start_date, e.end_date, e.exam_center,
            e.instructions, e.status, ${PHASE_SQL} AS phase
       FROM exams e JOIN semesters sem ON sem.id = e.semester_id ${w}
      ORDER BY e.start_date DESC LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
  sendSuccess(res, paged(await withSubjects(rows), total, pg));
});

// One exam with its papers
async function loadExam(id) {
  const [rows] = await pool.query(
    `SELECT e.*, sem.semester_no, ${PHASE_SQL} AS phase FROM exams e JOIN semesters sem ON sem.id = e.semester_id WHERE e.id = ?`, [id]);
  if (!rows[0]) throw new AppError('Exam not found.', 404);
  return (await withSubjects(rows))[0];
}

const getExam = asyncHandler(async (req, res) => sendSuccess(res, await loadExam(req.params.id)));

// Validates the paper list and returns rows ready for INSERT
async function prepareSubjects(examId, semesterId, subjects) {
  if (!Array.isArray(subjects)) throw new AppError('subjects must be a list.', 400);
  const [valid] = await pool.query('SELECT id FROM subjects WHERE semester_id = ?', [semesterId]);
  const validIds = new Set(valid.map((v) => v.id));
  const seen = new Set();
  return subjects.map((s) => {
    requireFields(s, ['subject_id', 'exam_date', 'start_time', 'end_time', 'max_marks']);
    const subjectId = toInt(s.subject_id, 'subject_id');
    if (!validIds.has(subjectId)) throw new AppError(`Subject ${subjectId} does not belong to this semester.`, 400);
    if (seen.has(subjectId)) throw new AppError(`Subject ${subjectId} is listed twice.`, 400);
    seen.add(subjectId);
    const start = toTime(s.start_time, 'start_time');
    const end = toTime(s.end_time, 'end_time');
    if (end <= start) throw new AppError('end_time must be after start_time.', 400);
    return [examId, subjectId, toDate(s.exam_date, 'exam_date'), start, end, s.room_number || null, toInt(s.max_marks, 'max_marks'), s.instructions || null];
  });
}
const insertSubjects = (conn, rows) => rows.length
  ? conn.query('INSERT INTO exam_subjects (exam_id, subject_id, exam_date, start_time, end_time, room_number, max_marks, instructions) VALUES ?', [rows])
  : null;

// POST /api/exams   body: { name, exam_type, semester_id, start_date, end_date, exam_center?, instructions?, subjects?: [...] }
const createExam = asyncHandler(async (req, res) => {
  const b = req.body;
  requireFields(b, ['name', 'exam_type', 'semester_id', 'start_date', 'end_date']);
  oneOf(b.exam_type, EXAM_TYPES, 'exam_type');
  toDate(b.start_date, 'start_date'); toDate(b.end_date, 'end_date');
  if (b.end_date < b.start_date) throw new AppError('end_date cannot be before start_date.', 400);
  const semesterId = toInt(b.semester_id, 'semester_id');
  const id = await withTransaction(async (conn) => {
    const [r] = await conn.query(
      `INSERT INTO exams (name, exam_type, semester_id, start_date, end_date, exam_center, instructions, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
      [b.name, b.exam_type, semesterId, b.start_date, b.end_date, b.exam_center || null, b.instructions || null, req.user.id]);
    if (b.subjects) await insertSubjects(conn, await prepareSubjects(r.insertId, semesterId, b.subjects));
    return r.insertId;
  });
  await notifySemester(semesterId, null, 'New exam scheduled', `${b.name} runs from ${b.start_date} to ${b.end_date}.`, 'exam');
  sendSuccess(res, await loadExam(id), 'Exam created successfully', 201);
});

// PUT /api/exams/:id
const updateExam = asyncHandler(async (req, res) => {
  const data = {};
  for (const f of ['name', 'exam_type', 'start_date', 'end_date', 'exam_center', 'instructions', 'status']) {
    if (req.body[f] !== undefined) data[f] = req.body[f] === '' ? null : req.body[f];
  }
  if (data.exam_type) oneOf(data.exam_type, EXAM_TYPES, 'exam_type');
  if (data.status) oneOf(data.status, EXAM_STATUS, 'status');
  if (data.start_date) toDate(data.start_date, 'start_date');
  if (data.end_date) toDate(data.end_date, 'end_date');
  if (!Object.keys(data).length) throw new AppError('Nothing to update.', 400);
  const [r] = await pool.query('UPDATE exams SET ? WHERE id = ?', [data, req.params.id]);
  if (!r.affectedRows) throw new AppError('Exam not found.', 404);
  sendSuccess(res, await loadExam(req.params.id), 'Exam updated successfully');
});

// PUT /api/exams/:id/subjects   body: { subjects: [...] }  -> replaces the whole paper list
const replaceSubjects = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT semester_id FROM exams WHERE id = ?', [req.params.id]);
  if (!rows[0]) throw new AppError('Exam not found.', 404);
  const prepared = await prepareSubjects(Number(req.params.id), rows[0].semester_id, req.body.subjects);
  await withTransaction(async (conn) => {
    await conn.query('DELETE FROM exam_subjects WHERE exam_id = ?', [req.params.id]);
    await insertSubjects(conn, prepared);
  });
  sendSuccess(res, await loadExam(req.params.id), 'Exam papers saved successfully');
});

const deleteExam = asyncHandler(async (req, res) => {
  const [r] = await pool.query('DELETE FROM exams WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) throw new AppError('Exam not found.', 404);
  sendSuccess(res, null, 'Exam deleted successfully');
});

module.exports = { listExams, getExam, createExam, updateExam, replaceSubjects, deleteExam };
