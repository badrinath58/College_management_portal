// Fee details. Students see their own; admin assigns and manages fees.
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { getPagination, paged } = require('../utils/pagination');
const { studentScope, whereSql } = require('../utils/scope');
const { requireFields, toInt, oneOf, toDate } = require('../utils/validators');
const { deriveStatus, refreshOverdue } = require('../services/feeService');
const { notifySemester } = require('../services/notificationService');

const FEE_TYPES = ['tuition', 'examination', 'hostel', 'library', 'transport', 'other'];

// GET /api/fees?status=&fee_type=&semester_id=&q=&student_id=&page=
const listFees = asyncHandler(async (req, res) => {
  await refreshOverdue();
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const where = [];
  const params = [];
  studentScope(req, where, params, 'f.student_id');
  const filters = { status: 'f.status', fee_type: 'f.fee_type', semester_id: 'f.semester_id' };
  if (req.user.role !== 'student') filters.student_id = 'f.student_id';
  for (const [key, col] of Object.entries(filters)) {
    if (req.query[key]) { where.push(`${col} = ?`); params.push(req.query[key]); }
  }
  const q = String(req.query.q || '').trim();
  if (q) { where.push('(s.full_name LIKE ? OR s.student_code LIKE ? OR f.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const w = whereSql(where);
  const from = 'FROM fees f JOIN students s ON s.id = f.student_id JOIN semesters sem ON sem.id = f.semester_id';
  const [[totals]] = await pool.query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(f.amount), 0) AS total_amount, COALESCE(SUM(f.paid_amount), 0) AS paid_amount,
            COALESCE(SUM(f.amount - f.paid_amount), 0) AS pending_amount ${from} ${w}`, params);
  const [rows] = await pool.query(
    `SELECT f.id, f.student_id, s.student_code, s.full_name AS student_name, f.semester_id, sem.semester_no,
            f.fee_type, f.description, f.amount, f.paid_amount, f.pending_amount, f.due_date, f.status
       ${from} ${w} ORDER BY f.due_date, f.id LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
  sendSuccess(res, { ...paged(rows, totals.total, pg),
    summary: { total_amount: totals.total_amount, paid_amount: totals.paid_amount, pending_amount: totals.pending_amount } });
});

// POST /api/fees   (admin)  body: { student_id, semester_id, fee_type, amount, due_date, description? }
const createFee = asyncHandler(async (req, res) => {
  const b = req.body;
  requireFields(b, ['student_id', 'semester_id', 'fee_type', 'amount', 'due_date']);
  oneOf(b.fee_type, FEE_TYPES, 'fee_type');
  toDate(b.due_date, 'due_date');
  if (!(Number(b.amount) > 0)) throw new AppError('amount must be greater than 0.', 400);
  const [r] = await pool.query(
    'INSERT INTO fees (student_id, semester_id, fee_type, description, amount, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [toInt(b.student_id, 'student_id'), toInt(b.semester_id, 'semester_id'), b.fee_type, b.description || null,
     b.amount, b.due_date, deriveStatus(Number(b.amount), 0, b.due_date)]);
  sendSuccess(res, { id: r.insertId }, 'Fee created successfully', 201);
});

// POST /api/fees/assign   (admin) -> the same fee for a whole semester (optionally one section)
// body: { semester_id, section?, fee_type, amount, due_date, description? }
const assignFee = asyncHandler(async (req, res) => {
  const b = req.body;
  requireFields(b, ['semester_id', 'fee_type', 'amount', 'due_date']);
  oneOf(b.fee_type, FEE_TYPES, 'fee_type');
  toDate(b.due_date, 'due_date');
  if (!(Number(b.amount) > 0)) throw new AppError('amount must be greater than 0.', 400);
  const semesterId = toInt(b.semester_id, 'semester_id');
  const params = [semesterId, b.fee_type, b.description || null, b.amount, b.due_date, semesterId];
  let sectionSql = '';
  if (b.section) { sectionSql = 'AND s.section = ?'; params.push(b.section); }
  // INSERT IGNORE skips students who already have this fee type for the semester (unique key)
  const [r] = await pool.query(
    `INSERT IGNORE INTO fees (student_id, semester_id, fee_type, description, amount, due_date, status)
     SELECT s.id, ?, ?, ?, ?, ?, 'pending' FROM students s WHERE s.current_semester_id = ? ${sectionSql}`, params);
  await notifySemester(semesterId, b.section || null, 'New fee added',
    `${b.description || b.fee_type} of Rs. ${b.amount} is due on ${b.due_date}.`, 'fee');
  sendSuccess(res, { students_charged: r.affectedRows }, 'Fee assigned successfully', 201);
});

// PUT /api/fees/:id   (admin)
const updateFee = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM fees WHERE id = ?', [req.params.id]);
  const fee = rows[0];
  if (!fee) throw new AppError('Fee not found.', 404);
  const data = {};
  for (const f of ['fee_type', 'description', 'amount', 'due_date']) if (req.body[f] !== undefined) data[f] = req.body[f];
  if (data.fee_type) oneOf(data.fee_type, FEE_TYPES, 'fee_type');
  if (data.due_date) toDate(data.due_date, 'due_date');
  const amount = data.amount !== undefined ? Number(data.amount) : fee.amount;
  if (!(amount > 0) || amount < fee.paid_amount) throw new AppError('amount must be positive and not less than the amount already paid.', 400);
  data.status = deriveStatus(amount, fee.paid_amount, data.due_date || fee.due_date);
  await pool.query('UPDATE fees SET ? WHERE id = ?', [data, fee.id]);
  sendSuccess(res, null, 'Fee updated successfully');
});

// DELETE /api/fees/:id   (admin) only if nothing was paid yet
const deleteFee = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT paid_amount FROM fees WHERE id = ?', [req.params.id]);
  if (!rows[0]) throw new AppError('Fee not found.', 404);
  if (rows[0].paid_amount > 0) throw new AppError('A fee with payments cannot be deleted.', 409);
  await pool.query('DELETE FROM fees WHERE id = ?', [req.params.id]);
  sendSuccess(res, null, 'Fee deleted successfully');
});

module.exports = { listFees, createFee, assignFee, updateFee, deleteFee };
