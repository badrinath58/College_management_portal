// Creating notifications. Each one is a row in the notifications table addressed to a login.
const { pool } = require('../config/db');

async function notify(userId, title, message, type = 'general', db = pool) {
  await db.query('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
    [userId, title.slice(0, 150), message.slice(0, 500), type]);
}

async function notifyMany(userIds, title, message, type = 'general', db = pool) {
  if (!userIds.length) return;
  const rows = userIds.map((id) => [id, title.slice(0, 150), message.slice(0, 500), type]);
  await db.query('INSERT INTO notifications (user_id, title, message, type) VALUES ?', [rows]);
}

// All students of a semester (optionally one section)
async function notifySemester(semesterId, section, title, message, type) {
  const params = [semesterId];
  let sql = 'SELECT user_id FROM students WHERE current_semester_id = ?';
  if (section) { sql += ' AND section = ?'; params.push(section); }
  const [rows] = await pool.query(sql, params);
  await notifyMany(rows.map((r) => r.user_id), title, message, type);
}

async function notifyAdmins(title, message, type) {
  const [rows] = await pool.query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1");
  await notifyMany(rows.map((r) => r.id), title, message, type);
}

// Do not send the same alert again and again: skip if the same title was sent recently
async function sentRecently(userId, title, days = 3) {
  const [rows] = await pool.query(
    'SELECT 1 FROM notifications WHERE user_id = ? AND title = ? AND created_at > NOW() - INTERVAL ? DAY LIMIT 1',
    [userId, title, days]);
  return rows.length > 0;
}

// Automatic student alerts (fee due dates, upcoming exams). Called when the student opens
// the dashboard or notification list, so no background job is needed.
async function refreshStudentAlerts(student) {
  // 1) fees that are overdue or due within 7 days
  const [fees] = await pool.query(
    `SELECT COUNT(*) AS n, COALESCE(SUM(amount - paid_amount), 0) AS due_amount,
            SUM(due_date < CURDATE()) AS overdue
       FROM fees WHERE student_id = ? AND paid_amount < amount AND due_date <= CURDATE() + INTERVAL 7 DAY`,
    [student.id]);
  if (fees[0].n > 0) {
    const title = Number(fees[0].overdue) > 0 ? 'Fee payment overdue' : 'Fee due soon';
    if (!(await sentRecently(student.user_id, title))) {
      await notify(student.user_id, title,
        `${fees[0].n} fee item(s) need payment. Amount pending: Rs. ${fees[0].due_amount}.`, 'fee');
    }
  }
  // 2) exams starting within 7 days
  const [exams] = await pool.query(
    `SELECT name, start_date FROM exams
      WHERE semester_id = ? AND status = 'scheduled' AND start_date BETWEEN CURDATE() AND CURDATE() + INTERVAL 7 DAY`,
    [student.current_semester_id]);
  for (const e of exams) {
    const title = `Upcoming exam: ${e.name}`;
    if (!(await sentRecently(student.user_id, title, 7))) {
      await notify(student.user_id, title, `${e.name} starts on ${e.start_date}. Download your hall ticket.`, 'exam');
    }
  }
}

module.exports = { notify, notifyMany, notifySemester, notifyAdmins, sentRecently, refreshStudentAlerts };
