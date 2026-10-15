// Hall tickets. A ticket is BLOCKED when attendance is below 65% or a fee is overdue.
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { toInt, requireFields, oneOf, todayISO } = require('../utils/validators');
const { resolveStudentId } = require('../services/identity');
const { notifyMany } = require('../services/notificationService');
const { fileUrl } = require('../utils/files');
const config = require('../config/env');

const MIN_ATTENDANCE_FOR_TICKET = 65;

// GET /api/hall-ticket   -> list of my tickets (one per exam)
const listTickets = asyncHandler(async (req, res) => {
  const studentId = await resolveStudentId(req);
  const [rows] = await pool.query(
    `SELECT h.id, h.exam_id, h.ticket_number, h.status, h.blocked_reason, h.issued_on, ex.name AS exam_name,
            ex.start_date, ex.end_date, ex.status AS exam_status
       FROM hall_tickets h JOIN exams ex ON ex.id = h.exam_id
      WHERE h.student_id = ? ORDER BY ex.start_date DESC`, [studentId]);
  sendSuccess(res, rows);
});

// One hall ticket with everything printed on it. A blocked ticket has the reason but NO exam schedule.
async function loadTicket(studentId, examId) {
  const [rows] = await pool.query(
    `SELECT h.id, h.ticket_number, h.exam_center, h.status, h.blocked_reason, h.issued_on,
            ex.id AS exam_id, ex.name AS exam_name, ex.exam_type, ex.start_date, ex.end_date, ex.instructions,
            s.id AS student_id, s.student_code, s.full_name, s.section, s.photo_path,
            c.name AS course, d.name AS department, sem.semester_no, sem.academic_year
       FROM hall_tickets h JOIN exams ex ON ex.id = h.exam_id JOIN students s ON s.id = h.student_id
       JOIN courses c ON c.id = s.course_id JOIN departments d ON d.id = c.department_id
       JOIN semesters sem ON sem.id = ex.semester_id
      WHERE h.student_id = ? AND h.exam_id = ?`, [studentId, examId]);
  const t = rows[0];
  if (!t) throw new AppError('Hall ticket not found for this exam.', 404);
  const { photo_path, ...ticket } = t;
  ticket.photo_path = photo_path;                 // the PDF reads the file from disk; the JSON answer swaps it for photo_url
  ticket.photo_url = fileUrl(photo_path);
  ticket.college_name = config.collegeName;
  let subjects = [];
  if (t.status === 'generated') {
    [subjects] = await pool.query(
      `SELECT sub.code AS subject_code, sub.name AS subject_name, es.exam_date, es.start_time, es.end_time, es.room_number
         FROM exam_subjects es JOIN subjects sub ON sub.id = es.subject_id
        WHERE es.exam_id = ? ORDER BY es.exam_date, es.start_time`, [t.exam_id]);
  }
  return { ...ticket, subjects };
}

// GET /api/hall-ticket/:exam_id   -> everything needed to print one hall ticket
const getTicket = asyncHandler(async (req, res) => {
  const studentId = await resolveStudentId(req);
  const { photo_path, ...ticket } = await loadTicket(studentId, req.params.exam_id);   // never expose the server path
  sendSuccess(res, ticket);
});

// POST /api/hall-ticket/generate   (admin)  body: { exam_id }
// Creates tickets for every eligible student. Existing tickets are left untouched.
const generateTickets = asyncHandler(async (req, res) => {
  requireFields(req.body, ['exam_id']);
  const examId = toInt(req.body.exam_id, 'exam_id');
  const [exams] = await pool.query('SELECT id, name, semester_id, exam_type, start_date, exam_center FROM exams WHERE id = ?', [examId]);
  const exam = exams[0];
  if (!exam) throw new AppError('Exam not found.', 404);

  // supplementary exams -> only students with an active backlog in the exam's subjects; others -> whole semester
  const [students] = exam.exam_type === 'supplementary'
    ? await pool.query(
        `SELECT DISTINCT s.id, s.user_id, s.student_code FROM students s
           JOIN backlogs b ON b.student_id = s.id AND b.status = 'active'
           JOIN exam_subjects es ON es.subject_id = b.subject_id AND es.exam_id = ?`, [examId])
    : await pool.query('SELECT id, user_id, student_code FROM students WHERE current_semester_id = ?', [exam.semester_id]);
  if (!students.length) return sendSuccess(res, { created: 0, blocked: 0 }, 'No eligible students found');

  const ids = students.map((s) => s.id);
  const [att] = await pool.query(
    `SELECT student_id, 100 * SUM(status IN ('present','late')) / COUNT(*) AS pct
       FROM attendance_records WHERE student_id IN (?) GROUP BY student_id`, [ids]);
  const pct = new Map(att.map((a) => [a.student_id, Number(a.pct)]));
  const [dues] = await pool.query(
    'SELECT DISTINCT student_id FROM fees WHERE student_id IN (?) AND due_date < CURDATE() AND paid_amount < amount', [ids]);
  const hasDues = new Set(dues.map((d) => d.student_id));

  const year = new Date().getFullYear();
  const today = todayISO();
  const rows = students.map((s) => {
    const reasons = [];
    if (pct.has(s.id) && pct.get(s.id) < MIN_ATTENDANCE_FOR_TICKET) reasons.push(`attendance below ${MIN_ATTENDANCE_FOR_TICKET}% (${Math.round(pct.get(s.id) * 10) / 10}%)`);
    if (hasDues.has(s.id)) reasons.push('fee dues pending');
    return [s.id, examId, `HT-${year}-E${examId}-${s.student_code}`, exam.exam_center, reasons.length ? 'blocked' : 'generated',
            reasons.length ? `Blocked: ${reasons.join(' and ')}. Contact the examination cell.` : null, today];
  });
  // INSERT IGNORE: a ticket that already exists (maybe unblocked by admin) is not overwritten
  const [r] = await pool.query(
    'INSERT IGNORE INTO hall_tickets (student_id, exam_id, ticket_number, exam_center, status, blocked_reason, issued_on) VALUES ?', [rows]);
  const okUsers = students.filter((s, i) => rows[i][4] === 'generated').map((s) => s.user_id);
  await notifyMany(okUsers, 'Hall ticket available', `Your hall ticket for ${exam.name} is ready to download.`, 'exam');
  sendSuccess(res, { created: r.affectedRows, blocked: rows.filter((x) => x[4] === 'blocked').length }, 'Hall tickets generated');
});

// PUT /api/hall-ticket/:id/status   (admin)  body: { status: 'generated'|'blocked', blocked_reason? }
const setStatus = asyncHandler(async (req, res) => {
  const status = oneOf(req.body.status, ['generated', 'blocked'], 'status');
  const reason = status === 'blocked' ? (req.body.blocked_reason || 'Blocked by the examination cell.') : null;
  const [r] = await pool.query('UPDATE hall_tickets SET status = ?, blocked_reason = ? WHERE id = ?', [status, reason, req.params.id]);
  if (!r.affectedRows) throw new AppError('Hall ticket not found.', 404);
  sendSuccess(res, null, 'Hall ticket updated');
});

module.exports = { listTickets, getTicket, generateTickets, setStatus, loadTicket };
