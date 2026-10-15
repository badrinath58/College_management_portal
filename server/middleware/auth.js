// "protect" = the security guard. Any route that uses it needs a valid login token.
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  // The browser sends:  Authorization: Bearer <token>
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError('Please log in to continue.', 401);

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret); // checks the signature AND the expiry time
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Your session has expired. Please log in again.', 401);
    }
    throw new AppError('Invalid login token. Please log in again.', 401);
  }

  // Look the user up again so a disabled or deleted account stops working immediately,
  // and so the role always comes from the database, not only from the token.
  const [rows] = await pool.query(
    'SELECT id, username, email, role, is_active FROM users WHERE id = ?',
    [payload.id]
  );
  const user = rows[0];
  if (!user || !user.is_active) throw new AppError('This account is no longer available.', 401);

  req.user = user; // controllers further down can now use req.user
  next();
});

module.exports = { protect };
