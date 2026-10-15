// Answer sheets. Faculty/admin upload (PDF/JPG/PNG) and release them; students see released ones.
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { getPagination, paged } = require('../utils/pagination');
const { studentScope, whereSql } = require('../utils/scope');
const { requireFields, toInt, oneOf } = require('../utils/validators');
const { assertSubjectAccess, getFacultyIdByUser, getStudentByUser } = require('../services/identity');
const { notify } = require('../services/notificationService');
const { verifySignature, deleteUploaded } = require('../middleware/upload');
const { fileUrl } = require('../utils/files');

const SELECT = `
  SELECT a.id, a.student_id, s.student_code, s.full_name AS student_name, ex.id AS exam_id, ex.name AS exam_name,
         es.id AS exam_subject_id, sub.code AS subject_code, sub.name AS subject_name, es.exam_date, es.max_marks,
         a.marks_obtained, a.evaluation_status, a.is_released, a.download_allowed, a.released_at,
         a.original_name, a.mime_type, a.file_size, a.file_path
    FROM answer_sheets a
    JOIN students s ON s.id = a.student_id
    JOIN exam_subjects es ON es.id = a.exam_subject_id
    JOIN exams ex ON ex.id = es.exam_id
    JOIN subjects sub ON sub.id = es.subject_id`;

// never expose the server path; give the browser the protected URL instead
const present = ({ file_path, ...row }) => ({ ...row, file_url: fileUrl(file_path), can_download: !!row.download_allowed });
const toBool = (v) => v === true || v === 'true' || v === '1' || v === 1;

// GET /api/answer-sheets?exam_id=&subject_id=&student_id=&evaluation_status=&is_released=&page=
const listSheets = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query);
  const where = [];
  const params = [];
  if (req.user.role === 'student') {
    studentScope(req, where, params, 'a.student_id');
    where.push('a.is_released = 1');                           // students only see RELEASED sheets
  } else {
    if (req.user.role === 'faculty') { where.push('sub.faculty_id = ?'); params.push(await getFacultyIdByUser(req.user.id)); }
    if (req.query.student_id) { where.push('a.student_id = ?'); params.push(req.query.student_id); }
    if (req.query.is_released) { where.push('a.is_released = ?'); params.push(toBool(req.query.is_released) ? 1 : 0); }
  }
  const filters = { exam_id: 'ex.id', subject_id: 'sub.id', evaluation_status: 'a.evaluation_status' };
  for (const [key, col] of Object.entries(filters)) if (req.query[key]) { where.push(`${col} = ?`); params.push(req.query[key]); }
  const w = whereSql(where);
  const from = SELECT.slice(SELECT.indexOf('FROM answer_sheets'));
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${from} ${w}`, params);
  const [rows] = await pool.query(`${SELECT} ${w} ORDER BY es.exam_date DESC, a.id DESC LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
  sendSuccess(res, paged(rows.map(present), total, pg));
});

// POST /api/answer-sheets   (multipart/form-data)
// fields: student_id, exam_subject_id, marks_obtained?, evaluation_status?, release?, download_allowed?   file: "file"
const uploadSheet = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Please attach the answer sheet file (field name: file).', 400);
  try {
    const mime = verifySignature(req.file);
    requireFields(req.body, ['student_id', 'exam_subject_id']);
    const studentId = toInt(req.body.student_id, 'student_id');
    const [es] = await pool.query('SELECT id, subject_id, max_marks FROM exam_subjects WHERE id = ?', [toInt(req.body.exam_subject_id, 'exam_subject_id')]);
    if (!es[0]) throw new AppError('Exam paper not found.', 404);
    await assertSubjectAccess(req, es[0].subject_id);
    const [stu] = await pool.query('SELECT user_id FROM students WHERE id = ?', [studentId]);
    if (!stu[0]) throw new AppError('Student not found.', 404);

    let marks = null;
    if (req.body.marks_obtained !== undefined && req.body.marks_obtained !== '') {
      marks = Number(req.body.marks_obtained);
      if (!Number.isFinite(marks) || marks < 0 || marks > es[0].max_marks) throw new AppError(`marks_obtained must be between 0 and ${es[0].max_marks}.`, 400);
    }
    const status = req.body.evaluation_status ? oneOf(req.body.evaluation_status, ['pending', 'evaluated', 'revaluation_requested'], 'evaluation_status') : (marks === null ? 'pending' : 'evaluated');
    const release = toBool(req.body.release);
    const savedName = req.file.originalname.replace(/[^\w.\- ()]/g, '_').slice(0, 200);
    const relPath = `uploads/answer-sheets/${req.file.filename}`;

    const [old] = await pool.query('SELECT id, file_path, is_released FROM answer_sheets WHERE student_id = ? AND exam_subject_id = ?', [studentId, es[0].id]);
    if (old[0]) {                                              // replace the earlier upload
      await pool.query(
        `UPDATE answer_sheets SET file_path = ?, original_name = ?, mime_type = ?, file_size = ?, marks_obtained = ?, evaluation_status = ?,
                is_released = ?, download_allowed = ?, released_at = ?, uploaded_by = ? WHERE id = ?`,
        [relPath, savedName, mime, req.file.size, marks, status, release ? 1 : 0, toBool(req.body.download_allowed) ? 1 : 0,
         release ? new Date() : null, req.user.id, old[0].id]);
      deleteUploaded(old[0].file_path);
    } else {
      await pool.query(
        `INSERT INTO answer_sheets (student_id, exam_subject_id, file_path, original_name, mime_type, file_size, marks_obtained,
                evaluation_status, is_released, download_allowed, released_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [studentId, es[0].id, relPath, savedName, mime, req.file.size, marks, status, release ? 1 : 0,
         toBool(req.body.download_allowed) ? 1 : 0, release ? new Date() : null, req.user.id]);
    }
    if (release) await notify(stu[0].user_id, 'Answer sheet released', 'A new answer sheet is available under View Answer Sheet.', 'answer_sheet');
    sendSuccess(res, null, 'Answer sheet uploaded successfully', 201);
  } catch (err) {
    deleteUploaded(`uploads/answer-sheets/${req.file.filename}`);   // do not keep a file whose upload failed
    throw err;
  }
});

// PUT /api/answer-sheets/:id   body: { marks_obtained?, evaluation_status?, is_released?, download_allowed? }
const updateSheet = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.*, es.subject_id, es.max_marks, s.user_id FROM answer_sheets a JOIN exam_subjects es ON es.id = a.exam_subject_id
       JOIN students s ON s.id = a.student_id WHERE a.id = ?`, [req.params.id]);
  const sheet = rows[0];
  if (!sheet) throw new AppError('Answer sheet not found.', 404);
  await assertSubjectAccess(req, sheet.subject_id);
  const data = {};
  if (req.body.marks_obtained !== undefined) {
    const m = Number(req.body.marks_obtained);
    if (!Number.isFinite(m) || m < 0 || m > sheet.max_marks) throw new AppError(`marks_obtained must be between 0 and ${sheet.max_marks}.`, 400);
    data.marks_obtained = m;
  }
  if (req.body.evaluation_status) data.evaluation_status = oneOf(req.body.evaluation_status, ['pending', 'evaluated', 'revaluation_requested'], 'evaluation_status');
  if (req.body.download_allowed !== undefined) data.download_allowed = toBool(req.body.download_allowed) ? 1 : 0;
  if (req.body.is_released !== undefined) {
    data.is_released = toBool(req.body.is_released) ? 1 : 0;
    data.released_at = data.is_released ? (sheet.released_at || new Date()) : null;
  }
  if (!Object.keys(data).length) throw new AppError('Nothing to update.', 400);
  await pool.query('UPDATE answer_sheets SET ? WHERE id = ?', [data, sheet.id]);
  if (data.is_released === 1 && !sheet.is_released) {
    await notify(sheet.user_id, 'Answer sheet released', 'A new answer sheet is available under View Answer Sheet.', 'answer_sheet');
  }
  sendSuccess(res, null, 'Answer sheet updated successfully');
});

// POST /api/answer-sheets/:id/revaluation   (student) -> asks for re-evaluation of a released sheet
const requestRevaluation = asyncHandler(async (req, res) => {
  const me = await getStudentByUser(req.user.id);
  const [r] = await pool.query(
    `UPDATE answer_sheets SET evaluation_status = 'revaluation_requested'
      WHERE id = ? AND student_id = ? AND is_released = 1 AND evaluation_status = 'evaluated'`, [req.params.id, me.id]);
  if (!r.affectedRows) throw new AppError('Revaluation can only be requested for a released, evaluated answer sheet.', 400);
  sendSuccess(res, null, 'Revaluation requested');
});

// DELETE /api/answer-sheets/:id   (admin)
const deleteSheet = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT file_path FROM answer_sheets WHERE id = ?', [req.params.id]);
  if (!rows[0]) throw new AppError('Answer sheet not found.', 404);
  await pool.query('DELETE FROM answer_sheets WHERE id = ?', [req.params.id]);
  deleteUploaded(rows[0].file_path);
  sendSuccess(res, null, 'Answer sheet deleted successfully');
});

module.exports = { listSheets, uploadSheet, updateSheet, requestRevaluation, deleteSheet };
