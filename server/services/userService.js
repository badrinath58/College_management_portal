// Creating / disabling logins. Used when admin adds students and faculty.
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');
const { checkPassword, requireFields } = require('../utils/validators');

// Creates a row in `users` and returns its id. Pass a transaction connection as `db`.
async function createLogin(db, { username, email, password, role }) {
  requireFields({ username, email, password }, ['username', 'email', 'password']);
  if (!/^[A-Za-z0-9_.-]{3,50}$/.test(username)) throw new AppError('Username must be 3-50 letters, numbers, . _ or -', 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new AppError('Enter a valid email address.', 400);
  checkPassword(password);
  const hash = await bcrypt.hash(password, 10);
  const [result] = await db.query(
    'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)', [username, email, hash, role]);
  return result.insertId;
}

async function setPassword(userId, newPassword) {
  checkPassword(newPassword);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 10), userId]);
}

// We DISABLE accounts instead of deleting them, so marks, fees and receipts are never lost.
async function setActive(userId, isActive) {
  await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, userId]);
}

module.exports = { createLogin, setPassword, setActive };
