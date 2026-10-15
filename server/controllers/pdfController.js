// PDF downloads. Each endpoint loads the SAME data as its JSON twin (so access rules are identical:
// a student can only ever download their own documents) and hands it to services/pdf/documents.js.
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const documents = require('../services/pdf/documents');
const { resolveStudentId, getStudentByUser } = require('../services/identity');
const { UPLOAD_ROOT } = require('../middleware/upload');
const { loadReceipt, loadTransaction } = require('./transactionController');
const { loadGradeCard } = require('./gradeCardController');
const { loadTicket } = require('./hallTicketController');
const { loadTimetableFor } = require('./timetableController');

// Sends the PDF as a download. ?inline=true shows it in the browser tab instead.
function sendPdf(req, res, buffer, filename) {
  const safeName = String(filename).replace(/[^\w.-]+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Content-Disposition', `${req.query.inline === 'true' ? 'inline' : 'attachment'}; filename="${safeName}"`);
  res.setHeader('Cache-Control', 'private, no-store');            // personal documents must not be cached by proxies
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(buffer);
}

// GET /api/receipts/:id/pdf   -> fee receipt
const receiptPdf = asyncHandler(async (req, res) => {
  const receipt = await loadReceipt(req.user, req.params.id);
  sendPdf(req, res, await documents.feeReceipt(receipt), `receipt-${receipt.receipt_number}.pdf`);
});

// GET /api/transactions/:id/pdf   -> payment receipt (only for payments that succeeded)
const paymentReceiptPdf = asyncHandler(async (req, res) => {
  const txn = await loadTransaction(req.user, req.params.id);
  if (txn.status !== 'success') throw new AppError('A payment receipt is available only for successful payments.', 409);
  sendPdf(req, res, await documents.paymentReceipt(txn), `payment-${txn.transaction_ref}.pdf`);
});

// GET /api/grade-card/pdf?semester_id=   (student: own published | admin: ?student_id=)
const gradeCardPdf = asyncHandler(async (req, res) => {
  const studentId = await resolveStudentId(req);
  const data = await loadGradeCard(req.user, studentId, req.query.semester_id);
  if (!data.cards.length) throw new AppError('There is no published grade card to download.', 404);
  sendPdf(req, res, await documents.gradeCard(data), `grade-card-${data.student.student_code}.pdf`);
});

// profile photo from disk (jpg/png). Returns null when there is none, so the ticket prints an empty photo box.
function readPhoto(photoPath) {
  if (!photoPath) return null;
  const full = path.resolve(__dirname, '..', photoPath);
  if (!full.startsWith(UPLOAD_ROOT + path.sep)) return null;      // never read outside the uploads folder
  try { return fs.readFileSync(full); } catch (e) { return null; }
}

// GET /api/hall-ticket/:exam_id/pdf   (student: own | admin: ?student_id=)
const hallTicketPdf = asyncHandler(async (req, res) => {
  const studentId = await resolveStudentId(req);
  const ticket = await loadTicket(studentId, req.params.exam_id);
  if (ticket.status === 'blocked') throw new AppError(`This hall ticket is blocked. ${ticket.blocked_reason || ''}`.trim(), 403);
  sendPdf(req, res, await documents.hallTicket(ticket, readPhoto(ticket.photo_path)), `hall-ticket-${ticket.ticket_number}.pdf`);
});

// GET /api/timetable/pdf?timetable_id=   (student: their timetable | faculty: their teaching slots | admin: timetable_id)
const timetablePdf = asyncHandler(async (req, res) => {
  const { timetable, slots } = await loadTimetableFor(req.user, req.query.timetable_id);
  if (!slots.length) throw new AppError('There is no timetable to download yet.', 404);

  let title = 'Teaching timetable';
  let subtitle = '';
  if (timetable) {
    title = `${timetable.course} - Semester ${timetable.semester_no}, Section ${timetable.section}`;
    subtitle = `${timetable.version_label} | ${timetable.academic_year}`;
  }
  if (req.user.role === 'student') {
    const me = await getStudentByUser(req.user.id);
    subtitle += `${subtitle ? ' | ' : ''}${me.full_name} (${me.student_code})`;
  } else if (req.user.role === 'faculty') {
    const [f] = await pool.query('SELECT full_name FROM faculty WHERE user_id = ?', [req.user.id]);
    subtitle = f[0] ? f[0].full_name : '';
  }
  sendPdf(req, res, await documents.timetable({ college: config.collegeName, title, subtitle, slots }), 'timetable.pdf');
});

module.exports = { receiptPdf, paymentReceiptPdf, gradeCardPdf, hallTicketPdf, timetablePdf };
