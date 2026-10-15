// Student profile (for the student) + student management (for admin; faculty can view).
const { pool, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { getPagination, paged } = require('../utils/pagination');
const { whereSql } = require('../utils/scope');
const { requireFields, toInt, oneOf, toDate } = require('../utils/validators');
const userService = require('../services/userService');
const { verifySignature, deleteUploaded } = require('../middleware/upload');

// Student + course + department + semester in one query (reused by several endpoints)
const STUDENT_SELECT = `
  SELECT s.id, s.user_id, s.student_code, s.full_name, u.username, u.email, s.mobile, s.date_of_birth,
         s.gender, s.address, s.course_id, c.name AS course, d.id AS department_id, d.name AS department,
         s.current_semester_id, sem.semester_no AS semester, sem.academic_year, s.section,
         s.admission_year, s.current_year, s.photo_path, s.selected_timetable_id, u.is_active
    FROM students s
    JOIN users u ON u.id = s.user_id
    JOIN courses c ON c.id = s.course_id
    JOIN departments d ON d.id = c.department_id
    LEFT JOIN semesters sem ON sem.id = s.current_semester_id`;

async function findStudent(id) {
  const [rows] = await pool.query(`${STUDENT_SELECT} WHERE s.id = ?`, [id]);
  if (!rows[0]) throw new AppError('Student not found.', 404);
  return rows[0];
}

// ---------- the student's own profile ----------
// GET /api/students/profile
const getProfile = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`${STUDENT_SELECT} WHERE s.user_id = ?`, [req.user.id]);
  if (!rows[0]) throw new AppError('Student profile not found.', 404);
  sendSuccess(res, rows[0]);
});

// PUT /api/students/profile   -> students may change ONLY mobile and address
const updateProfile = asyncHandler(async (req, res) => {
  const data = {};
  if (req.body.mobile !== undefined) {
    if (!/^\d{10}$/.test(String(req.body.mobile))) throw new AppError('Mobile must be a 10 digit number.', 400);
    data.mobile = req.body.mobile;
  }
  if (req.body.address !== undefined) data.address = String(req.body.address).slice(0, 255);
  if (!Object.keys(data).length) throw new AppError('Nothing to update.', 400);
  await pool.query('UPDATE students SET ? WHERE user_id = ?', [data, req.user.id]);
  const [rows] = await pool.query(`${STUDENT_SELECT} WHERE s.user_id = ?`, [req.user.id]);
  sendSuccess(res, rows[0], 'Profile updated successfully');
});

// POST /api/students/profile/photo   (multipart field "photo")
const uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Please choose a photo (.jpg or .png).', 400);
  verifySignature(req.file);
  const [rows] = await pool.query('SELECT photo_path FROM students WHERE user_id = ?', [req.user.id]);
  const newPath = `uploads/profile-photos/${req.file.filename}`;
  await pool.query('UPDATE students SET photo_path = ? WHERE user_id = ?', [newPath, req.user.id]);
  if (rows[0]) deleteUploaded(rows[0].photo_path); // remove the old photo file
  sendSuccess(res, { photo_path: newPath }, 'Photo updated successfully');
});

// ---------- admin / faculty ----------
// GET /api/students?q=&course_id=&department_id=&section=&current_year=&page=&limit=
const list = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query);
  const where = [];
  const params = [];
  const q = String(req.query.q || '').trim();
  if (q) {
    where.push('(s.full_name LIKE ? OR s.student_code LIKE ? OR u.email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const filters = { course_id: 's.course_id', department_id: 'd.id', section: 's.section',
                    current_year: 's.current_year', semester_id: 's.current_semester_id', is_active: 'u.is_active' };
  for (const [key, col] of Object.entries(filters)) {
    if (req.query[key] !== undefined && req.query[key] !== '') { where.push(`${col} = ?`); params.push(req.query[key]); }
  }
  const w = whereSql(where);
  const fromSql = `FROM students s JOIN users u ON u.id = s.user_id JOIN courses c ON c.id = s.course_id
                   JOIN departments d ON d.id = c.department_id LEFT JOIN semesters sem ON sem.id = s.current_semester_id`;
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${fromSql} ${w}`, params);
  const [rows] = await pool.query(
    `SELECT s.id, s.student_code, s.full_name, u.email, s.mobile, s.gender, c.name AS course, d.name AS department,
            sem.semester_no AS semester, s.section, s.current_year, u.is_active
       ${fromSql} ${w} ORDER BY s.student_code LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
  sendSuccess(res, paged(rows, total, pg));
});

// GET /api/students/:id
const getOne = asyncHandler(async (req, res) => sendSuccess(res, await findStudent(req.params.id)));

// POST /api/students   (admin) creates the login AND the student profile together
const create = asyncHandler(async (req, res) => {
  const b = req.body;
  requireFields(b, ['username', 'email', 'password', 'student_code', 'full_name', 'course_id', 'section', 'admission_year', 'current_year']);
  if (b.gender) oneOf(b.gender, ['male', 'female', 'other'], 'gender');
  if (b.date_of_birth) toDate(b.date_of_birth, 'date_of_birth');
  const id = await withTransaction(async (conn) => {
    const userId = await userService.createLogin(conn, { username: b.username, email: b.email, password: b.password, role: 'student' });
    const [r] = await conn.query(
      `INSERT INTO students (user_id, student_code, full_name, mobile, date_of_birth, gender, address, course_id,
                             current_semester_id, section, admission_year, current_year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, b.student_code, b.full_name, b.mobile || null, b.date_of_birth || null, b.gender || null, b.address || null,
       toInt(b.course_id, 'course_id'), b.current_semester_id || null, String(b.section).slice(0, 1).toUpperCase(),
       b.admission_year, b.current_year]);
    return r.insertId;
  });
  sendSuccess(res, await findStudent(id), 'Student created successfully', 201);
});

// PUT /api/students/:id   (admin)
const update = asyncHandler(async (req, res) => {
  const student = await findStudent(req.params.id);
  const allowed = ['full_name', 'mobile', 'date_of_birth', 'gender', 'address', 'course_id', 'current_semester_id',
                   'section', 'admission_year', 'current_year'];
  const data = {};
  for (const f of allowed) if (req.body[f] !== undefined) data[f] = req.body[f] === '' ? null : req.body[f];
  if (data.gender) oneOf(data.gender, ['male', 'female', 'other'], 'gender');
  await withTransaction(async (conn) => {
    if (Object.keys(data).length) await conn.query('UPDATE students SET ? WHERE id = ?', [data, student.id]);
    if (req.body.email) {
      if (!/^\S+@\S+\.\S+$/.test(req.body.email)) throw new AppError('Enter a valid email address.', 400);
      await conn.query('UPDATE users SET email = ? WHERE id = ?', [req.body.email, student.user_id]);
    }
  });
  sendSuccess(res, await findStudent(student.id), 'Student updated successfully');
});

// PUT /api/students/:id/reset-password   (admin)  -> this is how "Forgot password" is handled
const resetPassword = asyncHandler(async (req, res) => {
  const student = await findStudent(req.params.id);
  await userService.setPassword(student.user_id, req.body.new_password);
  sendSuccess(res, null, 'Password reset successfully');
});

// DELETE /api/students/:id   (admin)  -> the login is DISABLED, data is kept
const deactivate = asyncHandler(async (req, res) => {
  const student = await findStudent(req.params.id);
  await userService.setActive(student.user_id, false);
  sendSuccess(res, null, 'Student account disabled');
});

module.exports = { getProfile, updateProfile, uploadPhoto, list, getOne, create, update, resetPassword, deactivate };
