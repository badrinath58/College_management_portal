// Transaction history and receipts (read-only).
const { pool } = require('../config/db');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { getPagination, paged } = require('../utils/pagination');
const { studentScope, whereSql } = require('../utils/scope');
const { getStudentByUser } = require('../services/identity');

// GET /api/transactions?from=&to=&status=&payment_method=&q=&student_id=&page=
const listTransactions = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query);
  const where = [];
  const params = [];
  studentScope(req, where, params, 't.student_id');
  if (req.user.role !== 'student' && req.query.student_id) { where.push('t.student_id = ?'); params.push(req.query.student_id); }
  if (req.query.status) { where.push('t.status = ?'); params.push(req.query.status); }
  if (req.query.payment_method) { where.push('t.payment_method = ?'); params.push(req.query.payment_method); }
  if (req.query.from) { where.push('DATE(t.transaction_date) >= ?'); params.push(req.query.from); }
  if (req.query.to) { where.push('DATE(t.transaction_date) <= ?'); params.push(req.query.to); }
  const q = String(req.query.q || '').trim();
  if (q) { where.push('(t.transaction_ref LIKE ? OR t.description LIKE ? OR s.student_code LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const w = whereSql(where);
  const from = 'FROM transactions t JOIN students s ON s.id = t.student_id LEFT JOIN receipts r ON r.transaction_id = t.id';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${from} ${w}`, params);
  const [rows] = await pool.query(
    `SELECT t.id, t.transaction_ref, t.transaction_date, t.description, t.amount, t.payment_method, t.status,
            t.failure_reason, s.student_code, s.full_name AS student_name, r.id AS receipt_id, r.receipt_number
       ${from} ${w} ORDER BY t.transaction_date DESC, t.id DESC LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
  sendSuccess(res, paged(rows, total, pg));
});

// GET /api/receipts?from=&to=&q=&page=
const listReceipts = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query);
  const where = [];
  const params = [];
  studentScope(req, where, params, 'r.student_id');
  if (req.user.role !== 'student' && req.query.student_id) { where.push('r.student_id = ?'); params.push(req.query.student_id); }
  if (req.query.from) { where.push('r.payment_date >= ?'); params.push(req.query.from); }
  if (req.query.to) { where.push('r.payment_date <= ?'); params.push(req.query.to); }
  const q = String(req.query.q || '').trim();
  if (q) { where.push('(r.receipt_number LIKE ? OR t.transaction_ref LIKE ? OR s.student_code LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const w = whereSql(where);
  const from = 'FROM receipts r JOIN transactions t ON t.id = r.transaction_id JOIN students s ON s.id = r.student_id';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${from} ${w}`, params);
  const [rows] = await pool.query(
    `SELECT r.id, r.receipt_number, r.payment_date, r.amount, r.description, t.transaction_ref, t.payment_method,
            s.student_code, s.full_name AS student_name
       ${from} ${w} ORDER BY r.payment_date DESC, r.id DESC LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
  sendSuccess(res, paged(rows, total, pg));
});

// Receipt + its fee lines. Students may load only their own (used by the JSON endpoint AND the PDF endpoint).
async function loadReceipt(user, id) {
  const [rows] = await pool.query(
    `SELECT r.id, r.receipt_number, r.payment_date, r.amount, r.description, r.student_id,
            t.id AS transaction_id, t.transaction_ref, t.payment_method, t.gateway_reference, t.transaction_date,
            s.student_code, s.full_name AS student_name, s.section, c.name AS course, d.name AS department
       FROM receipts r JOIN transactions t ON t.id = r.transaction_id JOIN students s ON s.id = r.student_id
       JOIN courses c ON c.id = s.course_id JOIN departments d ON d.id = c.department_id
      WHERE r.id = ?`, [id]);
  const receipt = rows[0];
  if (!receipt) throw new AppError('Receipt not found.', 404);
  await assertOwner(user, receipt.student_id, 'receipts');
  const [items] = await pool.query(
    `SELECT f.fee_type, f.description, fp.amount FROM fee_payments fp JOIN fees f ON f.id = fp.fee_id
      WHERE fp.transaction_id = ?`, [receipt.transaction_id]);
  return { ...receipt, items, college_name: config.collegeName };
}

// One payment (transaction) with the fees it paid. Used for the payment-receipt PDF.
async function loadTransaction(user, id) {
  const [rows] = await pool.query(
    `SELECT t.id, t.transaction_ref, t.transaction_date, t.amount, t.payment_method, t.status, t.description,
            t.gateway_reference, t.failure_reason, t.student_id, s.student_code, s.full_name AS student_name,
            c.name AS course, d.name AS department, r.receipt_number
       FROM transactions t JOIN students s ON s.id = t.student_id JOIN courses c ON c.id = s.course_id
       JOIN departments d ON d.id = c.department_id LEFT JOIN receipts r ON r.transaction_id = t.id
      WHERE t.id = ?`, [id]);
  const txn = rows[0];
  if (!txn) throw new AppError('Transaction not found.', 404);
  await assertOwner(user, txn.student_id, 'transactions');
  const [items] = await pool.query(
    `SELECT f.fee_type, f.description, fp.amount FROM fee_payments fp JOIN fees f ON f.id = fp.fee_id
      WHERE fp.transaction_id = ?`, [txn.id]);
  return { ...txn, items, college_name: config.collegeName };
}

async function assertOwner(user, studentId, what) {
  if (user.role !== 'student') return;
  const me = await getStudentByUser(user.id);
  if (!me || me.id !== studentId) throw new AppError(`You can only view your own ${what}.`, 403);
}

// GET /api/receipts/:id   -> everything needed to show / print one receipt
const getReceipt = asyncHandler(async (req, res) => sendSuccess(res, await loadReceipt(req.user, req.params.id)));

module.exports = { listTransactions, listReceipts, getReceipt, loadReceipt, loadTransaction };
