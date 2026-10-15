// Faculty management (admin) and "my profile + my subjects" (faculty).
const { pool, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { getPagination, paged } = require('../utils/pagination');
const { whereSql } = require('../utils/scope');
const { requireFields, toInt } = require('../utils/validators');
const userService = require('../services/userService');
const { getFacultyIdByUser } = require('../services/identity');

const FACULTY_SELECT = `
  SELECT f.id, f.user_id, f.employee_id, f.full_name, u.username, u.email, f.phone, f.designation,
         f.joining_date, f.department_id, d.name AS department, u.is_active
    FROM faculty f JOIN users u ON u.id = f.user_id JOIN departments d ON d.id = f.department_id`;

async function findFaculty(id) {
  const [rows] = await pool.query(`${FACULTY_SELECT} WHERE f.id = ?`, [id]);
  if (!rows[0]) throw new AppError('Faculty member not found.', 404);
  return rows[0];
}

// GET /api/faculty/me  -> my profile and the subjects assigned to me
const me = asyncHandler(async (req, res) => {
  const facultyId = await getFacultyIdByUser(req.user.id);
  if (!facultyId) throw new AppError('Faculty profile not found.', 404);
  const [subjects] = await pool.query(
    `SELECT sub.id, sub.code, sub.name, sub.credits, sub.subject_type, sem.semester_no, sem.academic_year,
            c.name AS course,
            (SELECT COUNT(*) FROM students s WHERE s.current_semester_id = sub.semester_id) AS student_count
       FROM subjects sub JOIN semesters sem ON sem.id = sub.semester_id JOIN courses c ON c.id = sem.course_id
      WHERE sub.faculty_id = ? ORDER BY sem.semester_no DESC, sub.code`, [facultyId]);
  sendSuccess(res, { profile: await findFaculty(facultyId), subjects });
});

// GET /api/faculty?q=&department_id=&page=&limit=   (admin)
const list = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query);
  const where = [];
  const params = [];
  const q = String(req.query.q || '').trim();
  if (q) { where.push('(f.full_name LIKE ? OR f.employee_id LIKE ? OR u.email LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (req.query.department_id) { where.push('f.department_id = ?'); params.push(req.query.department_id); }
  const w = whereSql(where);
  const from = 'FROM faculty f JOIN users u ON u.id = f.user_id JOIN departments d ON d.id = f.department_id';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${from} ${w}`, params);
  const [rows] = await pool.query(
    `SELECT f.id, f.employee_id, f.full_name, u.email, f.phone, f.designation, d.name AS department, u.is_active
       ${from} ${w} ORDER BY f.employee_id LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
  sendSuccess(res, paged(rows, total, pg));
});

const getOne = asyncHandler(async (req, res) => sendSuccess(res, await findFaculty(req.params.id)));

// POST /api/faculty   (admin) creates login + faculty profile together
const create = asyncHandler(async (req, res) => {
  const b = req.body;
  requireFields(b, ['username', 'email', 'password', 'employee_id', 'full_name', 'department_id']);
  const id = await withTransaction(async (conn) => {
    const userId = await userService.createLogin(conn, { username: b.username, email: b.email, password: b.password, role: 'faculty' });
    const [r] = await conn.query(
      `INSERT INTO faculty (user_id, employee_id, full_name, department_id, designation, phone, joining_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, b.employee_id, b.full_name, toInt(b.department_id, 'department_id'), b.designation || null, b.phone || null, b.joining_date || null]);
    return r.insertId;
  });
  sendSuccess(res, await findFaculty(id), 'Faculty member created successfully', 201);
});

const update = asyncHandler(async (req, res) => {
  const faculty = await findFaculty(req.params.id);
  const data = {};
  for (const f of ['full_name', 'department_id', 'designation', 'phone', 'joining_date']) {
    if (req.body[f] !== undefined) data[f] = req.body[f] === '' ? null : req.body[f];
  }
  await withTransaction(async (conn) => {
    if (Object.keys(data).length) await conn.query('UPDATE faculty SET ? WHERE id = ?', [data, faculty.id]);
    if (req.body.email) {
      if (!/^\S+@\S+\.\S+$/.test(req.body.email)) throw new AppError('Enter a valid email address.', 400);
      await conn.query('UPDATE users SET email = ? WHERE id = ?', [req.body.email, faculty.user_id]);
    }
  });
  sendSuccess(res, await findFaculty(faculty.id), 'Faculty member updated successfully');
});

const resetPassword = asyncHandler(async (req, res) => {
  const faculty = await findFaculty(req.params.id);
  await userService.setPassword(faculty.user_id, req.body.new_password);
  sendSuccess(res, null, 'Password reset successfully');
});

const deactivate = asyncHandler(async (req, res) => {
  const faculty = await findFaculty(req.params.id);
  await userService.setActive(faculty.user_id, false);
  sendSuccess(res, null, 'Faculty account disabled');
});

module.exports = { me, list, getOne, create, update, resetPassword, deactivate };
