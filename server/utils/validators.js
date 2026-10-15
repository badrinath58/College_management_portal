// Small input checks used by controllers. Each one throws a friendly 400 error on bad input.
const AppError = require('./AppError');

function requireFields(obj, names) {
  const missing = names.filter((n) => obj[n] === undefined || obj[n] === null || String(obj[n]).trim() === '');
  if (missing.length) throw new AppError(`${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} required.`, 400);
}

function toInt(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new AppError(`${name} must be a positive whole number.`, 400);
  return n;
}

function oneOf(value, list, name) {
  if (!list.includes(value)) throw new AppError(`${name} must be one of: ${list.join(', ')}.`, 400);
  return value;
}

function toDate(value, name) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || Number.isNaN(Date.parse(value))) {
    throw new AppError(`${name} must be a date in YYYY-MM-DD format.`, 400);
  }
  return value;
}

// 8+ characters with an upper-case letter, a lower-case letter and a digit
function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 100 ||
      !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    throw new AppError('Password must be 8+ characters with an upper-case letter, a lower-case letter and a number.', 400);
  }
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

module.exports = { requireFields, toInt, oneOf, toDate, checkPassword, todayISO };

// "9:30" / "09:30" / "09:30:00" -> "09:30:00"  (MySQL TIME format)
function toTime(value, name) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(String(value));
  if (!m) throw new AppError(`${name} must be a time like 09:30.`, 400);
  return `${m[1].padStart(2, '0')}:${m[2]}:${m[3] || '00'}`;
}
module.exports.toTime = toTime;
