// Issued books: list, issue (admin), renew (student/admin), return (admin).
const { pool, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { getPagination, paged } = require('../utils/pagination');
const { studentScope, whereSql } = require('../utils/scope');
const { requireFields, toInt } = require('../utils/validators');
const { getStudentByUser } = require('../services/identity');
const { notify } = require('../services/notificationService');

// Library rules (change here to change the whole app)
const FINE_PER_DAY = 2;     // Rs. per late day
const LOAN_DAYS = 14;
const MAX_RENEWALS = 2;
const MAX_BOOKS = 3;        // books a student can hold at once

// Status and fine are CALCULATED from dates, so they are always up to date
const STATUS_SQL = `(CASE WHEN i.return_date IS NOT NULL THEN 'returned' WHEN i.status = 'lost' THEN 'lost'
                         WHEN i.due_date < CURDATE() THEN 'overdue' ELSE 'issued' END)`;
const FINE_SQL = `(CASE WHEN i.return_date IS NULL AND i.status <> 'lost'
                        THEN GREATEST(DATEDIFF(CURDATE(), i.due_date), 0) * ${FINE_PER_DAY} ELSE i.fine_amount END)`;

// GET /api/library/issues?status=&q=&student_id=&page=
const listIssues = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query);
  const where = [];
  const params = [];
  studentScope(req, where, params, 'i.student_id');
  if (req.user.role !== 'student' && req.query.student_id) { where.push('i.student_id = ?'); params.push(req.query.student_id); }
  if (req.query.status) { where.push(`${STATUS_SQL} = ?`); params.push(req.query.status); }
  const q = String(req.query.q || '').trim();
  if (q) { where.push('(b.title LIKE ? OR s.student_code LIKE ? OR s.full_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const w = whereSql(where);
  const from = 'FROM book_issues i JOIN books b ON b.id = i.book_id JOIN students s ON s.id = i.student_id';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${from} ${w}`, params);
  const [rows] = await pool.query(
    `SELECT i.id, i.book_id, b.title, b.author, b.isbn, i.student_id, s.student_code, s.full_name AS student_name,
            i.issue_date, i.due_date, i.return_date, i.renew_count, i.fine_paid,
            ${STATUS_SQL} AS status, ${FINE_SQL} AS fine_amount,
            (i.return_date IS NULL AND i.status <> 'lost' AND i.renew_count < ${MAX_RENEWALS} AND i.due_date >= CURDATE()) AS can_renew
       ${from} ${w} ORDER BY i.issue_date DESC, i.id DESC LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
  sendSuccess(res, { ...paged(rows, total, pg), rules: { fine_per_day: FINE_PER_DAY, max_renewals: MAX_RENEWALS, loan_days: LOAN_DAYS } });
});

// POST /api/library/issues   (admin)  body: { student_id, book_id, days? }
const issueBook = asyncHandler(async (req, res) => {
  requireFields(req.body, ['student_id', 'book_id']);
  const studentId = toInt(req.body.student_id, 'student_id');
  const bookId = toInt(req.body.book_id, 'book_id');
  const days = Math.min(30, Math.max(1, parseInt(req.body.days, 10) || LOAN_DAYS));

  const result = await withTransaction(async (conn) => {
    // lock the book row so two librarians cannot issue the last copy at the same moment
    const [books] = await conn.query('SELECT id, title, available_copies FROM books WHERE id = ? FOR UPDATE', [bookId]);
    if (!books[0]) throw new AppError('Book not found.', 404);
    if (books[0].available_copies < 1) throw new AppError('No copies of this book are available.', 409);

    const [students] = await conn.query(
      `SELECT s.id, s.user_id FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND u.is_active = 1`, [studentId]);
    if (!students[0]) throw new AppError('Student not found or account disabled.', 404);

    const [[held]] = await conn.query(
      `SELECT COUNT(*) AS n, COALESCE(SUM(due_date < CURDATE()), 0) AS overdue
         FROM book_issues WHERE student_id = ? AND return_date IS NULL AND status <> 'lost'`, [studentId]);
    if (held.n >= MAX_BOOKS) throw new AppError(`A student can hold at most ${MAX_BOOKS} books.`, 409);
    if (Number(held.overdue) > 0) throw new AppError('This student has overdue books. Please return them first.', 409);

    const [ins] = await conn.query(
      `INSERT INTO book_issues (book_id, student_id, issue_date, due_date, status)
       VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY), 'issued')`, [bookId, studentId, days]);
    await conn.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?', [bookId]);
    return { id: ins.insertId, userId: students[0].user_id, title: books[0].title };
  });
  await notify(result.userId, 'Book issued', `"${result.title}" has been issued to you. Return it within ${days} days.`, 'library');
  sendSuccess(res, { id: result.id }, 'Book issued successfully', 201);
});

// PUT /api/library/issues/:id/renew   (the student who borrowed it, or admin)
const renewBook = asyncHandler(async (req, res) => {
  await withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM book_issues WHERE id = ? FOR UPDATE', [req.params.id]);
    const issue = rows[0];
    if (!issue) throw new AppError('Issue record not found.', 404);
    if (req.user.role === 'student') {
      const me = await getStudentByUser(req.user.id);
      if (!me || me.id !== issue.student_id) throw new AppError('You can only renew your own books.', 403);
    }
    if (issue.return_date) throw new AppError('This book is already returned.', 400);
    if (issue.renew_count >= MAX_RENEWALS) throw new AppError(`A book can be renewed only ${MAX_RENEWALS} times.`, 400);
    const [[{ late }]] = await conn.query('SELECT (? < CURDATE()) AS late', [issue.due_date]);
    if (late) throw new AppError('Overdue books cannot be renewed. Please return the book and pay the fine.', 400);
    await conn.query(
      'UPDATE book_issues SET due_date = DATE_ADD(due_date, INTERVAL ? DAY), renew_count = renew_count + 1 WHERE id = ?',
      [LOAN_DAYS, issue.id]);
  });
  const [rows] = await pool.query('SELECT id, due_date, renew_count FROM book_issues WHERE id = ?', [req.params.id]);
  sendSuccess(res, rows[0], 'Book renewed successfully');
});

// PUT /api/library/issues/:id/return   (admin)
const returnBook = asyncHandler(async (req, res) => {
  const info = await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT i.*, b.title, s.user_id FROM book_issues i JOIN books b ON b.id = i.book_id
         JOIN students s ON s.id = i.student_id WHERE i.id = ? FOR UPDATE`, [req.params.id]);
    const issue = rows[0];
    if (!issue) throw new AppError('Issue record not found.', 404);
    if (issue.return_date) throw new AppError('This book is already returned.', 400);
    const [[{ days_late }]] = await conn.query('SELECT GREATEST(DATEDIFF(CURDATE(), ?), 0) AS days_late', [issue.due_date]);
    const fine = days_late * FINE_PER_DAY;
    await conn.query(
      "UPDATE book_issues SET return_date = CURDATE(), fine_amount = ?, status = 'returned', fine_paid = ? WHERE id = ?",
      [fine, fine === 0 ? 1 : 0, issue.id]);
    await conn.query('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?', [issue.book_id]);
    return { fine, userId: issue.user_id, title: issue.title };
  });
  if (info.fine > 0) {
    await notify(info.userId, 'Library fine', `"${info.title}" was returned late. Fine: Rs. ${info.fine}.`, 'library');
  }
  sendSuccess(res, { fine_amount: info.fine }, 'Book returned successfully');
});

// PUT /api/library/issues/:id/fine-paid   (admin)
const markFinePaid = asyncHandler(async (req, res) => {
  const [r] = await pool.query('UPDATE book_issues SET fine_paid = 1 WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) throw new AppError('Issue record not found.', 404);
  sendSuccess(res, null, 'Fine marked as paid');
});

module.exports = { listIssues, issueBook, renewBook, returnBook, markFinePaid };
