// Attendance maths in one place. Percentage = (present + late) / total classes.
const { pool } = require('../config/db');
const { notify, sentRecently } = require('./notificationService');

const MIN_PERCENT = 75;
const statusOf = (pct) => (pct >= MIN_PERCENT ? 'Good' : pct >= 65 ? 'Low' : 'Critical');
const round1 = (n) => Math.round(n * 10) / 10;

// One row per subject for a student (optionally only one semester)
async function summary(studentId, semesterId = null) {
  const params = [studentId];
  let semSql = '';
  if (semesterId) { semSql = 'AND sub.semester_id = ?'; params.push(semesterId); }
  const [rows] = await pool.query(
    `SELECT sub.id AS subject_id, sub.code AS subject_code, sub.name AS subject_name,
            f.full_name AS faculty_name,
            COUNT(ar.id) AS total_classes,
            SUM(ar.status IN ('present','late')) AS classes_attended,
            SUM(ar.status = 'absent') AS classes_absent
       FROM attendance_records ar
       JOIN attendance a ON a.id = ar.attendance_id
       JOIN subjects sub ON sub.id = a.subject_id
       LEFT JOIN faculty f ON f.id = sub.faculty_id
      WHERE ar.student_id = ? ${semSql}
      GROUP BY sub.id, sub.code, sub.name, f.full_name
      ORDER BY sub.code`, params);
  return rows.map((r) => {
    const total = Number(r.total_classes);
    const attended = Number(r.classes_attended);
    const percentage = total ? round1((100 * attended) / total) : 0;
    return { ...r, total_classes: total, classes_attended: attended, classes_absent: Number(r.classes_absent),
             percentage, status: statusOf(percentage), is_low: percentage < MIN_PERCENT };
  });
}

function overall(rows) {
  const total = rows.reduce((s, r) => s + r.total_classes, 0);
  const attended = rows.reduce((s, r) => s + r.classes_attended, 0);
  const percentage = total ? round1((100 * attended) / total) : 0;
  return { total_classes: total, classes_attended: attended, percentage, status: statusOf(percentage) };
}

// After faculty marks attendance: warn students who dropped below 75% in that subject
async function notifyIfLow(studentIds, subject) {
  if (!studentIds.length) return;
  const [rows] = await pool.query(
    `SELECT ar.student_id, s.user_id,
            100 * SUM(ar.status IN ('present','late')) / COUNT(*) AS pct
       FROM attendance_records ar
       JOIN attendance a ON a.id = ar.attendance_id
       JOIN students s ON s.id = ar.student_id
      WHERE a.subject_id = ? AND ar.student_id IN (?)
      GROUP BY ar.student_id, s.user_id`, [subject.id, studentIds]);
  for (const r of rows) {
    const pct = round1(Number(r.pct));
    const title = `Low attendance in ${subject.code}`;
    if (pct < MIN_PERCENT && !(await sentRecently(r.user_id, title, 1))) {
      await notify(r.user_id, title, `Your attendance in ${subject.name} is ${pct}%. Minimum required is ${MIN_PERCENT}%.`, 'attendance');
    }
  }
}

module.exports = { MIN_PERCENT, summary, overall, notifyIfLow };
