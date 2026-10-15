// Marks. Students view; faculty enter marks for THEIR subjects; admin manages everything.
const { pool, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { getPagination, paged } = require('../utils/pagination');
const { studentScope, whereSql } = require('../utils/scope');
const { requireFields, toInt } = require('../utils/validators');
const { MAX_MARKS, gradeFor } = require('../utils/grades');
const { assertSubjectAccess, getFacultyIdByUser } = require('../services/identity');
const { LATEST_MARKS_SQL, recalculateGradeCard, syncBacklog } = require('../services/gradeService');
const { notify, sentRecently } = require('../services/notificationService');

const PARTS = ['internal', 'mid', 'assignment', 'practical', 'external'];

// GET /api/marks?semester_id=&subject_id=&student_id=&section=&q=&page=
// student -> own latest marks   |   faculty -> only their subjects   |   admin -> all
const listMarks = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const where = [];
  const params = [];
  studentScope(req, where, params, 'lm.student_id');
  if (req.user.role === 'faculty') {
    where.push('lm.subject_id IN (SELECT id FROM subjects WHERE faculty_id = ?)');
    params.push(await getFacultyIdByUser(req.user.id));
  }
  const filters = { semester_id: 'lm.semester_id', subject_id: 'lm.subject_id', semester_no: 'lm.semester_no' };
  if (req.user.role !== 'student') { filters.student_id = 'lm.student_id'; filters.section = 's.section'; }
  for (const [key, col] of Object.entries(filters)) {
    if (req.query[key]) { where.push(`${col} = ?`); params.push(req.query[key]); }
  }
  const q = String(req.query.q || '').trim();
  if (q) { where.push('(s.full_name LIKE ? OR s.student_code LIKE ? OR lm.subject_code LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const w = whereSql(where);
  const from = `FROM (${LATEST_MARKS_SQL}) lm JOIN students s ON s.id = lm.student_id`;
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${from} ${w}`, params);
  const [rows] = await pool.query(
    `SELECT lm.*, s.student_code, s.full_name AS student_name, s.section ${from} ${w}
      ORDER BY lm.semester_no DESC, lm.subject_code, s.student_code LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
  sendSuccess(res, paged(rows, total, pg));
});

// GET /api/marks/roster?subject_id=&section=   -> class list with existing marks (the "enter marks" table)
const roster = asyncHandler(async (req, res) => {
  requireFields(req.query, ['subject_id', 'section']);
  const subject = await assertSubjectAccess(req, toInt(req.query.subject_id, 'subject_id'));
  const [rows] = await pool.query(
    `SELECT s.id AS student_id, s.student_code, s.full_name, m.id AS marks_id, m.attempt_no, m.internal_marks, m.mid_marks,
            m.assignment_marks, m.practical_marks, m.external_marks, m.total_marks, m.grade, m.result
       FROM students s
       LEFT JOIN marks m ON m.student_id = s.id AND m.subject_id = ?
            AND m.attempt_no = (SELECT MAX(attempt_no) FROM marks WHERE student_id = s.id AND subject_id = ?)
      WHERE s.current_semester_id = ? AND s.section = ? ORDER BY s.student_code`,
    [subject.id, subject.id, subject.semester_id, req.query.section]);
  sendSuccess(res, { subject, max_marks: MAX_MARKS[subject.subject_type], students: rows });
});

// The one function behind both POST and PUT.
async function saveMarks(req, { studentId, subjectId, attemptNo, body }) {
  const subject = await assertSubjectAccess(req, subjectId);
  const [owner] = await pool.query(
    `SELECT s.user_id FROM students s JOIN semesters sem ON sem.course_id = s.course_id
      WHERE s.id = ? AND sem.id = ?`, [studentId, subject.semester_id]);
  if (!owner[0]) throw new AppError('This student does not belong to the subject\'s course.', 400);
  const max = MAX_MARKS[subject.subject_type];

  const saved = await withTransaction(async (conn) => {
    const [found] = await conn.query(
      'SELECT * FROM marks WHERE student_id = ? AND subject_id = ? AND attempt_no = ? FOR UPDATE', [studentId, subjectId, attemptNo]);
    const existing = found[0] || null;

    // take each mark from the request, or keep the old value; never above the maximum
    const parts = {};
    for (const p of PARTS) {
      const sent = body[`${p}_marks`];
      if (sent !== undefined) {
        const n = Number(sent);
        if (!Number.isFinite(n) || n < 0 || n > max[p]) throw new AppError(`${p}_marks must be between 0 and ${max[p]}.`, 400);
        parts[p] = n;
      } else parts[p] = existing ? Number(existing[`${p}_marks`]) : 0;
    }

    const absent = body.absent === true;
    const finalize = absent || body.finalize === true || (existing && existing.result !== 'pending');
    const total = PARTS.reduce((s, p) => s + parts[p], 0);
    let grade = null, points = null, result = 'pending';
    if (absent) { grade = 'F'; points = 0; result = 'absent'; }
    else if (finalize) { const g = gradeFor(total); grade = g.grade; points = g.points; result = g.result; }

    const values = [parts.internal, parts.mid, parts.assignment, parts.practical, parts.external, grade, points, result, subject.faculty_id];
    let marksId;
    if (existing) {
      await conn.query(
        `UPDATE marks SET internal_marks = ?, mid_marks = ?, assignment_marks = ?, practical_marks = ?, external_marks = ?,
                grade = ?, grade_points = ?, result = ?, entered_by = ? WHERE id = ?`, [...values, existing.id]);
      marksId = existing.id;
    } else {
      const [r] = await conn.query(
        `INSERT INTO marks (student_id, subject_id, attempt_no, internal_marks, mid_marks, assignment_marks, practical_marks,
                            external_marks, grade, grade_points, result, entered_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [studentId, subjectId, attemptNo, ...values]);
      marksId = r.insertId;
    }
    // a final result also updates the backlog list and the semester grade card
    if (result !== 'pending') {
      await syncBacklog(conn, studentId, subjectId, attemptNo, result);
      await recalculateGradeCard(conn, studentId, subject.semester_id);
    }
    const [row] = await conn.query('SELECT * FROM marks WHERE id = ?', [marksId]);
    return row[0];
  });

  const title = `New marks: ${subject.code}`;
  if (!(await sentRecently(owner[0].user_id, title, 1))) {
    await notify(owner[0].user_id, title, `Marks for ${subject.name} were updated${saved.result !== 'pending' ? ` (result: ${saved.result}, grade ${saved.grade})` : ''}.`, 'marks');
  }
  return saved;
}

// POST /api/marks
// body: { student_id, subject_id, attempt_no?, internal_marks?, mid_marks?, assignment_marks?, practical_marks?,
//         external_marks?, finalize?: true, absent?: true }   (creates the row, or updates the same attempt)
const createMarks = asyncHandler(async (req, res) => {
  requireFields(req.body, ['student_id', 'subject_id']);
  const saved = await saveMarks(req, {
    studentId: toInt(req.body.student_id, 'student_id'), subjectId: toInt(req.body.subject_id, 'subject_id'),
    attemptNo: req.body.attempt_no ? toInt(req.body.attempt_no, 'attempt_no') : 1, body: req.body });
  sendSuccess(res, saved, 'Marks saved successfully', 201);
});

// PUT /api/marks/:id   (same body, without student_id / subject_id)
const updateMarks = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT student_id, subject_id, attempt_no FROM marks WHERE id = ?', [req.params.id]);
  if (!rows[0]) throw new AppError('Marks record not found.', 404);
  const saved = await saveMarks(req, { studentId: rows[0].student_id, subjectId: rows[0].subject_id, attemptNo: rows[0].attempt_no, body: req.body });
  sendSuccess(res, saved, 'Marks updated successfully');
});

// DELETE /api/marks/:id   (admin)
const deleteMarks = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT m.student_id, sub.semester_id FROM marks m JOIN subjects sub ON sub.id = m.subject_id WHERE m.id = ?', [req.params.id]);
  if (!rows[0]) throw new AppError('Marks record not found.', 404);
  await pool.query('DELETE FROM marks WHERE id = ?', [req.params.id]);
  try { await recalculateGradeCard(pool, rows[0].student_id, rows[0].semester_id); } catch (e) { /* no marks left: nothing to recalculate */ }
  sendSuccess(res, null, 'Marks deleted successfully');
});

module.exports = { listMarks, roster, createMarks, updateMarks, deleteMarks };
