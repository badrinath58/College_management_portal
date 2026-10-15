// Weekly timetables. Students view and CHOOSE a version; admin creates versions and slots.
const { pool, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { whereSql } = require('../utils/scope');
const { requireFields, toInt, oneOf, toTime } = require('../utils/validators');
const { getStudentByUser, getFacultyIdByUser } = require('../services/identity');
const { notifySemester } = require('../services/notificationService');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SLOT_SELECT = `
  SELECT ts.id, ts.day_of_week, ts.start_time, ts.end_time, ts.room_number, ts.subject_id,
         sub.code AS subject_code, sub.name AS subject_name, f.full_name AS faculty_name
    FROM timetable_slots ts
    JOIN subjects sub ON sub.id = ts.subject_id
    LEFT JOIN faculty f ON f.id = ts.faculty_id`;
const SLOT_ORDER = "ORDER BY FIELD(ts.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'), ts.start_time";

const INFO_SELECT = `
  SELECT t.id, t.semester_id, t.section, t.version_label, t.is_active, sem.semester_no, sem.academic_year,
         c.name AS course, d.name AS department
    FROM timetable t JOIN semesters sem ON sem.id = t.semester_id
    JOIN courses c ON c.id = sem.course_id JOIN departments d ON d.id = c.department_id`;

async function loadTimetable(id) {
  const [info] = await pool.query(`${INFO_SELECT} WHERE t.id = ?`, [id]);
  if (!info[0]) throw new AppError('Timetable not found.', 404);
  const [slots] = await pool.query(`${SLOT_SELECT} WHERE ts.timetable_id = ? ${SLOT_ORDER}`, [id]);
  return { timetable: info[0], slots };
}

// The timetable a user sees on the Time Table page (also used for the PDF).
//  student -> the version they chose (or the default active one for their section)
//  faculty -> all their teaching slots   |   admin -> ?timetable_id= required
async function loadTimetableFor(user, queryTimetableId) {
  if (user.role === 'faculty' && !queryTimetableId) {
    const facultyId = await getFacultyIdByUser(user.id);
    const [slots] = await pool.query(
      `SELECT ts.id, ts.day_of_week, ts.start_time, ts.end_time, ts.room_number, ts.subject_id,
              sub.code AS subject_code, sub.name AS subject_name, t.section, t.version_label, sem.semester_no
         FROM timetable_slots ts JOIN subjects sub ON sub.id = ts.subject_id
         JOIN timetable t ON t.id = ts.timetable_id AND t.is_active = 1
         JOIN semesters sem ON sem.id = t.semester_id
        WHERE ts.faculty_id = ? ${SLOT_ORDER}`, [facultyId]);
    return { timetable: null, slots };
  }

  let timetableId = queryTimetableId ? toInt(queryTimetableId, 'timetable_id') : null;
  if (!timetableId && user.role === 'student') {
    const student = await getStudentByUser(user.id);
    const [sel] = await pool.query('SELECT selected_timetable_id FROM students WHERE id = ?', [student.id]);
    timetableId = sel[0].selected_timetable_id;
    if (!timetableId) {
      const [def] = await pool.query(
        'SELECT id FROM timetable WHERE semester_id = ? AND section = ? AND is_active = 1 ORDER BY id LIMIT 1',
        [student.current_semester_id, student.section]);
      timetableId = def[0] ? def[0].id : null;
    }
    if (!timetableId) return { timetable: null, slots: [] };
  }
  if (!timetableId) throw new AppError('timetable_id is required.', 400);
  return loadTimetable(timetableId);
}

// GET /api/timetable
const getTimetable = asyncHandler(async (req, res) => sendSuccess(res, await loadTimetableFor(req.user, req.query.timetable_id)));

// GET /api/timetable/versions?academic_year=&semester_no=&section=&course_id=&department_id=
const listVersions = asyncHandler(async (req, res) => {
  const where = [];
  const params = [req.user.id];
  const showAll = req.user.role !== 'student' && req.query.include_inactive === 'true';
  if (!showAll) where.push('t.is_active = 1');
  const filters = { academic_year: 'sem.academic_year', semester_no: 'sem.semester_no', section: 't.section',
                    course_id: 'sem.course_id', department_id: 'c.department_id' };
  for (const [key, col] of Object.entries(filters)) {
    if (req.query[key]) { where.push(`${col} = ?`); params.push(req.query[key]); }
  }
  if (req.user.role === 'student' && !req.query.course_id) {          // students see only their own branch
    where.push('sem.course_id = (SELECT course_id FROM students WHERE user_id = ?)');
    params.push(req.user.id);
  }
  const [rows] = await pool.query(
    `SELECT t.id, t.semester_id, t.section, t.version_label, t.is_active, sem.semester_no, sem.academic_year,
            c.name AS course, d.name AS department,
            (SELECT COUNT(*) FROM timetable_slots WHERE timetable_id = t.id) AS slot_count,
            COALESCE(t.id = (SELECT selected_timetable_id FROM students WHERE user_id = ?), 0) AS is_selected
       FROM timetable t JOIN semesters sem ON sem.id = t.semester_id
       JOIN courses c ON c.id = sem.course_id JOIN departments d ON d.id = c.department_id
       ${whereSql(where)} ORDER BY sem.academic_year DESC, sem.semester_no DESC, t.section, t.id`, params);
  sendSuccess(res, rows);
});

// POST /api/timetable/select   body: { timetable_id }   (student)
const selectTimetable = asyncHandler(async (req, res) => {
  const timetableId = toInt(req.body.timetable_id, 'timetable_id');
  const student = await getStudentByUser(req.user.id);
  const [rows] = await pool.query(
    `SELECT t.id, sem.course_id FROM timetable t JOIN semesters sem ON sem.id = t.semester_id
      WHERE t.id = ? AND t.is_active = 1`, [timetableId]);
  if (!rows[0]) throw new AppError('This timetable is not available.', 404);
  if (rows[0].course_id !== student.course_id) throw new AppError('This timetable belongs to a different branch.', 403);
  await pool.query('UPDATE students SET selected_timetable_id = ? WHERE id = ?', [timetableId, student.id]);
  sendSuccess(res, await loadTimetable(timetableId), 'Timetable selected successfully');
});

// ---------- admin ----------
// Checks the slot list and returns rows ready for INSERT
async function prepareSlots(timetableId, semesterId, slots) {
  if (!Array.isArray(slots)) throw new AppError('slots must be a list.', 400);
  const [subjects] = await pool.query('SELECT id, faculty_id FROM subjects WHERE semester_id = ?', [semesterId]);
  const facultyOf = new Map(subjects.map((s) => [s.id, s.faculty_id]));
  const seen = new Set();
  return slots.map((s) => {
    requireFields(s, ['day_of_week', 'start_time', 'end_time', 'subject_id', 'room_number']);
    oneOf(s.day_of_week, DAYS, 'day_of_week');
    const start = toTime(s.start_time, 'start_time');
    const end = toTime(s.end_time, 'end_time');
    if (end <= start) throw new AppError('end_time must be after start_time.', 400);
    const subjectId = toInt(s.subject_id, 'subject_id');
    if (!facultyOf.has(subjectId)) throw new AppError(`Subject ${subjectId} does not belong to this semester.`, 400);
    const key = `${s.day_of_week}-${start}`;
    if (seen.has(key)) throw new AppError(`Two classes start at ${s.start_time} on ${s.day_of_week}.`, 400);
    seen.add(key);
    return [timetableId, s.day_of_week, start, end, subjectId, s.faculty_id || facultyOf.get(subjectId) || null, String(s.room_number).slice(0, 20)];
  });
}

const insertSlots = (conn, rows) => rows.length
  ? conn.query('INSERT INTO timetable_slots (timetable_id, day_of_week, start_time, end_time, subject_id, faculty_id, room_number) VALUES ?', [rows])
  : null;

// POST /api/timetable   body: { semester_id, section, version_label, is_active?, slots?: [...] }
const createVersion = asyncHandler(async (req, res) => {
  requireFields(req.body, ['semester_id', 'section', 'version_label']);
  const semesterId = toInt(req.body.semester_id, 'semester_id');
  const id = await withTransaction(async (conn) => {
    const [r] = await conn.query(
      'INSERT INTO timetable (semester_id, section, version_label, is_active, created_by) VALUES (?, ?, ?, ?, ?)',
      [semesterId, String(req.body.section).slice(0, 1).toUpperCase(), req.body.version_label, req.body.is_active === false ? 0 : 1, req.user.id]);
    if (req.body.slots) await insertSlots(conn, await prepareSlots(r.insertId, semesterId, req.body.slots));
    return r.insertId;
  });
  sendSuccess(res, await loadTimetable(id), 'Timetable created successfully', 201);
});

// PUT /api/timetable/:id   body: { version_label?, section?, is_active? }
const updateVersion = asyncHandler(async (req, res) => {
  const data = {};
  for (const f of ['version_label', 'section', 'is_active']) if (req.body[f] !== undefined) data[f] = req.body[f];
  if (!Object.keys(data).length) throw new AppError('Nothing to update.', 400);
  const [r] = await pool.query('UPDATE timetable SET ? WHERE id = ?', [data, req.params.id]);
  if (!r.affectedRows) throw new AppError('Timetable not found.', 404);
  sendSuccess(res, await loadTimetable(req.params.id), 'Timetable updated successfully');
});

// PUT /api/timetable/:id/slots   body: { slots: [...] }   -> replaces ALL slots (delete + insert, all-or-nothing)
const replaceSlots = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT semester_id, section FROM timetable WHERE id = ?', [req.params.id]);
  if (!rows[0]) throw new AppError('Timetable not found.', 404);
  const prepared = await prepareSlots(Number(req.params.id), rows[0].semester_id, req.body.slots);
  await withTransaction(async (conn) => {
    await conn.query('DELETE FROM timetable_slots WHERE timetable_id = ?', [req.params.id]);
    await insertSlots(conn, prepared);
  });
  await notifySemester(rows[0].semester_id, rows[0].section, 'Timetable updated',
    `The timetable for Section ${rows[0].section} has changed. Please check the new version.`, 'timetable');
  sendSuccess(res, await loadTimetable(req.params.id), 'Timetable slots saved successfully');
});

const deleteVersion = asyncHandler(async (req, res) => {
  const [r] = await pool.query('DELETE FROM timetable WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) throw new AppError('Timetable not found.', 404);
  sendSuccess(res, null, 'Timetable deleted successfully');
});

module.exports = { loadTimetableFor, getTimetable, listVersions, selectTimetable, createVersion, updateVersion, replaceSlots, deleteVersion };
