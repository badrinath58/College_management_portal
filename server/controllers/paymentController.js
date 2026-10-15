// Online payment (MOCK gateway). The whole payment is ONE database transaction:
//   lock fees -> create transaction -> save fee_payments -> update fees -> create receipt
// If any step fails, everything is rolled back, so money is never "half recorded".
const crypto = require('crypto');
const { pool, withTransaction } = require('../config/db');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { getPagination, paged } = require('../utils/pagination');
const { studentScope, whereSql } = require('../utils/scope');
const { toInt, oneOf } = require('../utils/validators');
const { getStudentByUser, getStudentById } = require('../services/identity');
const { deriveStatus, refreshOverdue } = require('../services/feeService');
const { notify } = require('../services/notificationService');
const mockGateway = require('../services/mockGateway');

const round2 = (n) => Math.round(n * 100) / 100;
const STUDENT_METHODS = ['card', 'upi', 'net_banking', 'mock_gateway'];
const ADMIN_METHODS = [...STUDENT_METHODS, 'cash'];
// We NEVER accept or store these. If the browser sends them, we refuse the request.
const SENSITIVE_KEYS = ['card_number', 'cardNumber', 'cvv', 'cvc', 'expiry', 'pin', 'upi_pin', 'upiPin', 'password'];

// Who is paying? A student pays for themselves; admin records a payment for a student.
async function resolvePayer(req) {
  if (req.user.role === 'student') return getStudentByUser(req.user.id);
  const student = await getStudentById(toInt(req.body.student_id || req.query.student_id, 'student_id'));
  if (!student) throw new AppError('Student not found.', 404);
  return student;
}

// Turns { fee_ids: [1,2] } or { items: [{fee_id, amount}] } into one list. amount null = pay in full.
function readItems(body) {
  let items;
  if (Array.isArray(body.items)) items = body.items.map((i) => ({ fee_id: toInt(i.fee_id, 'fee_id'), amount: i.amount ?? null }));
  else if (Array.isArray(body.fee_ids)) items = body.fee_ids.map((id) => ({ fee_id: toInt(id, 'fee_id'), amount: null }));
  else throw new AppError('Send fee_ids (a list of fee ids) to pay.', 400);
  const unique = [...new Map(items.map((i) => [i.fee_id, i])).values()];
  if (!unique.length || unique.length > 20) throw new AppError('Select between 1 and 20 fees.', 400);
  return unique;
}

// GET /api/payments/summary?fee_ids=1,2   -> the "payment summary" screen (changes nothing)
const summary = asyncHandler(async (req, res) => {
  await refreshOverdue();
  const ids = String(req.query.fee_ids || '').split(',').map((x) => toInt(x, 'fee_ids'));
  const student = await resolvePayer(req);
  const [fees] = await pool.query(
    `SELECT id, fee_type, description, amount, paid_amount, pending_amount, due_date, status
       FROM fees WHERE id IN (?) AND student_id = ? AND paid_amount < amount`, [ids, student.id]);
  if (!fees.length) throw new AppError('No payable fees found.', 404);
  sendSuccess(res, { student_code: student.student_code, fees, total_payable: round2(fees.reduce((s, f) => s + f.pending_amount, 0)) });
});

// POST /api/payments
// body: { fee_ids:[..] | items:[{fee_id, amount}], payment_method, student_id (admin only) }
const createPayment = asyncHandler(async (req, res) => {
  if (SENSITIVE_KEYS.some((k) => k in req.body)) {
    throw new AppError('Never send card numbers, CVV, PINs or passwords to this server.', 400);
  }
  const student = await resolvePayer(req);
  const method = oneOf(req.body.payment_method, req.user.role === 'admin' ? ADMIN_METHODS : STUDENT_METHODS, 'payment_method');
  const items = readItems(req.body);
  const wanted = new Map(items.map((i) => [i.fee_id, i.amount]));
  const simulateFailure = !config.isProd && req.body.simulate_failure === true; // lets you test the failed screen

  const outcome = await withTransaction(async (conn) => {
    // 1. lock the fee rows so two payments cannot pay the same fee twice
    const [fees] = await conn.query(
      'SELECT id, fee_type, description, amount, paid_amount, due_date FROM fees WHERE id IN (?) AND student_id = ? FOR UPDATE',
      [items.map((i) => i.fee_id), student.id]);
    if (fees.length !== items.length) throw new AppError('Some of the selected fees were not found.', 404);

    // 2. work out how much goes to each fee
    const lines = fees.map((f) => {
      const pending = round2(f.amount - f.paid_amount);
      if (pending <= 0) throw new AppError(`${f.description || f.fee_type} is already paid.`, 409);
      const asked = wanted.get(f.id);
      const amount = asked === null ? pending : round2(Number(asked));
      if (!(amount > 0) || amount > pending) throw new AppError(`Amount for ${f.description || f.fee_type} must be between 0.01 and ${pending}.`, 400);
      return { fee: f, amount };
    });
    const total = round2(lines.reduce((s, l) => s + l.amount, 0));
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ref = `TXN${day}${crypto.randomInt(100000, 999999)}`;
    const description = `Semester fees - ${lines.map((l) => l.fee.fee_type).join(', ')}`;

    // 3. "call the bank"
    const gateway = mockGateway.charge({ simulateFailure });
    if (!gateway.success) {
      await conn.query(
        `INSERT INTO transactions (transaction_ref, student_id, amount, payment_method, status, description, failure_reason)
         VALUES (?, ?, ?, ?, 'failed', ?, ?)`, [ref, student.id, total, method, description, gateway.reason]);
      return { failed: true, ref, reason: gateway.reason };   // the failed attempt is still saved for history
    }

    // 4. success: save the transaction, spread it over the fees, create the receipt
    const [tx] = await conn.query(
      `INSERT INTO transactions (transaction_ref, student_id, amount, payment_method, status, description, gateway_reference)
       VALUES (?, ?, ?, ?, 'success', ?, ?)`, [ref, student.id, total, method, description, gateway.gatewayReference]);
    for (const l of lines) {
      await conn.query('INSERT INTO fee_payments (fee_id, transaction_id, amount) VALUES (?, ?, ?)', [l.fee.id, tx.insertId, l.amount]);
      const newPaid = round2(l.fee.paid_amount + l.amount);
      await conn.query('UPDATE fees SET paid_amount = ?, status = ? WHERE id = ?',
        [newPaid, deriveStatus(l.fee.amount, newPaid, l.fee.due_date), l.fee.id]);
    }
    const receiptNumber = `RCPT-${new Date().getFullYear()}-${String(tx.insertId).padStart(5, '0')}`;
    const [rc] = await conn.query(
      'INSERT INTO receipts (receipt_number, transaction_id, student_id, amount, description, payment_date) VALUES (?, ?, ?, ?, ?, CURDATE())',
      [receiptNumber, tx.insertId, student.id, total, description]);
    return { failed: false, transaction_id: tx.insertId, ref, total, method, receiptId: rc.insertId, receiptNumber };
  });

  if (outcome.failed) throw new AppError(`${outcome.reason} (Reference: ${outcome.ref}). You were not charged.`, 402);
  await notify(student.user_id, 'Payment received',
    `Payment of Rs. ${outcome.total} received. Receipt ${outcome.receiptNumber} is ready under Receipts.`, 'payment');
  sendSuccess(res, {
    transaction: { id: outcome.transaction_id, transaction_ref: outcome.ref, amount: outcome.total, payment_method: outcome.method, status: 'success' },
    receipt: { id: outcome.receiptId, receipt_number: outcome.receiptNumber },
  }, 'Payment successful', 201);
});

// GET /api/payments   -> each fee that was paid (one row per fee per transaction)
const listPayments = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query);
  const where = [];
  const params = [];
  studentScope(req, where, params, 't.student_id');
  if (req.user.role !== 'student' && req.query.student_id) { where.push('t.student_id = ?'); params.push(req.query.student_id); }
  if (req.query.fee_type) { where.push('f.fee_type = ?'); params.push(req.query.fee_type); }
  if (req.query.from) { where.push('DATE(t.transaction_date) >= ?'); params.push(req.query.from); }
  if (req.query.to) { where.push('DATE(t.transaction_date) <= ?'); params.push(req.query.to); }
  const w = whereSql(where);
  const from = `FROM fee_payments fp JOIN transactions t ON t.id = fp.transaction_id JOIN fees f ON f.id = fp.fee_id
                JOIN students s ON s.id = t.student_id`;
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${from} ${w}`, params);
  const [rows] = await pool.query(
    `SELECT fp.id, fp.amount, t.transaction_date AS paid_on, t.transaction_ref, t.payment_method, t.status,
            f.fee_type, f.description, s.student_code, s.full_name AS student_name
       ${from} ${w} ORDER BY t.transaction_date DESC, fp.id DESC LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
  sendSuccess(res, paged(rows, total, pg));
});

module.exports = { summary, createPayment, listPayments };
