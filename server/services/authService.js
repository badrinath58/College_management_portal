// All the login logic lives here, so the controller stays tiny and easy to read.
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');

// Any valid bcrypt hash. Used only so that "unknown username" takes as long as "wrong password"
// (otherwise an attacker could guess which usernames exist by measuring the response time).
const DUMMY_HASH = '$2b$10$2cwx23qUBxWc9lpcb/E.3.xWWm6fVxEhnhVtW2LEccXmCL66AN/9W';

// Student ID (e.g. 24CS001) OR username (e.g. student01) both work
async function login({ username, password, rememberMe }) {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.email, u.password_hash, u.role, u.is_active
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
      WHERE u.username = ? OR s.student_code = ?
      LIMIT 1`,
    [username, username]
  );
  const user = rows[0];

  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  // One message for both cases, so we never reveal which part was wrong
  if (!user || !passwordOk) throw new AppError('Invalid username or password.', 401);
  if (!user.is_active) throw new AppError('Your account is disabled. Please contact the administrator.', 403);

  // The token only carries the id and role. The secret key signs it so nobody can change it.
  const expiresIn = rememberMe ? config.jwt.rememberExpiresIn : config.jwt.expiresIn;
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwt.secret, { expiresIn });

  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  const safeUser = { id: user.id, username: user.username, email: user.email, role: user.role };
  return { token, expiresIn, user: safeUser, profile: await getProfile(safeUser) };
}

// Loads the role-specific details (name, department, ...) for the dashboard header
async function getProfile(user) {
  let sql;
  if (user.role === 'student') {
    sql = `SELECT s.id, s.student_code, s.full_name, s.mobile, s.section, s.current_year, s.photo_path,
                  c.name AS course, d.name AS department,
                  sem.semester_no AS semester, sem.academic_year
             FROM students s
             JOIN courses c ON c.id = s.course_id
             JOIN departments d ON d.id = c.department_id
             LEFT JOIN semesters sem ON sem.id = s.current_semester_id
            WHERE s.user_id = ?`;
  } else if (user.role === 'faculty') {
    sql = `SELECT f.id, f.employee_id, f.full_name, f.designation, d.name AS department
             FROM faculty f
             JOIN departments d ON d.id = f.department_id
            WHERE f.user_id = ?`;
  } else {
    sql = 'SELECT id, full_name, designation FROM admins WHERE user_id = ?';
  }
  const [rows] = await pool.query(sql, [user.id]);
  return rows[0] || null;
}

// Change own password: the current password must be correct first
async function changePassword(userId, currentPassword, newPassword) {
  const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
  if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    throw new AppError('Current password is incorrect.', 400);
  }
  if (currentPassword === newPassword) throw new AppError('New password must be different from the current one.', 400);
  await require('./userService').setPassword(userId, newPassword); // also checks password strength
}

module.exports = { login, getProfile, changePassword };
