// One endpoint per role. Each returns everything its dashboard page and charts need.
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { getStudentByUser, getFacultyIdByUser } = require('../services/identity');
const attendanceService = require('../services/attendanceService');
const { LATEST_MARKS_SQL } = require('../services/gradeService');
const { refreshStudentAlerts } = require('../services/notificationService');
const { refreshOverdue } = require('../services/feeService');
const { fileUrl } = require('../utils/files');

// GET /api/dashboard/student
const student = asyncHandler(async (req, res) => {
  const me = await getStudentByUser(req.user.id);
  if (!me) throw new AppError('Student profile not found.', 404);
  await refreshOverdue();
  try { await refreshStudentAlerts(me); } catch (e) { console.error('Alert refresh failed:', e.message); }

  const [[profile]] = await pool.query(
    `SELECT s.student_code, s.full_name, s.section, s.current_year, s.photo_path, c.name AS course, d.name AS department,
            sem.semester_no AS semester, sem.academic_year
       FROM students s JOIN courses c ON c.id = s.course_id JOIN departments d ON d.id = c.department_id
       LEFT JOIN semesters sem ON sem.id = s.current_semester_id WHERE s.id = ?`, [me.id]);
  const attendance = await attendanceService.summary(me.id, me.current_semester_id);
  const [grades] = await pool.query(
    `SELECT sem.semester_no, gc.sgpa, gc.cgpa FROM grade_cards gc JOIN semesters sem ON sem.id = gc.semester_id
      WHERE gc.student_id = ? AND gc.is_published = 1 ORDER BY sem.semester_no`, [me.id]);
  const [[fees]] = await pool.query(
    `SELECT COALESCE(SUM(amount - paid_amount), 0) AS pending, COALESCE(SUM(paid_amount), 0) AS paid, COALESCE(SUM(amount), 0) AS total
       FROM fees WHERE student_id = ?`, [me.id]);
  const [feeStatus] = await pool.query('SELECT status, COUNT(*) AS count, SUM(amount) AS amount FROM fees WHERE student_id = ? GROUP BY status', [me.id]);
  const [exams] = await pool.query(
    `SELECT ex.name AS exam_name, sub.code AS subject_code, sub.name AS subject_name, es.exam_date, es.start_time, es.room_number
       FROM exam_subjects es JOIN exams ex ON ex.id = es.exam_id JOIN subjects sub ON sub.id = es.subject_id
      WHERE ex.semester_id = ? AND ex.status <> 'cancelled' AND es.exam_date >= CURDATE()
      ORDER BY es.exam_date, es.start_time LIMIT 5`, [me.current_semester_id]);
  const [recentMarks] = await pool.query(
    `${LATEST_MARKS_SQL} AND m.student_id = ? ORDER BY m.updated_at DESC LIMIT 5`, [me.id]);
  const [performance] = await pool.query(
    `SELECT subject_code, subject_name, total_marks, result FROM (${LATEST_MARKS_SQL}) lm
      WHERE lm.student_id = ? AND lm.semester_id = ? ORDER BY subject_code`, [me.id, me.current_semester_id]);
  const [[{ unread }]] = await pool.query('SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
  const [notifications] = await pool.query(
    'SELECT id, title, message, type, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 5', [req.user.id]);

  const { photo_path, ...rest } = profile;
  sendSuccess(res, {
    profile: { ...rest, photo_url: fileUrl(photo_path) },
    attendance: { overall: attendanceService.overall(attendance), subjects: attendance },
    cgpa: grades.length ? grades[grades.length - 1].cgpa : null,
    pending_fees: fees.pending,
    upcoming_exams: exams,
    recent_marks: recentMarks.map((m) => ({ subject_code: m.subject_code, subject_name: m.subject_name, total_marks: m.total_marks, grade: m.grade, result: m.result })),
    notifications: { unread, latest: notifications },
    charts: {
      attendance: attendance.map((a) => ({ subject: a.subject_code, percentage: a.percentage })),
      semester_marks: grades,                                   // SGPA / CGPA per semester
      fee_status: { paid: fees.paid, pending: fees.pending, by_status: feeStatus },
      subject_performance: performance,
    },
  });
});

// GET /api/dashboard/faculty
const faculty = asyncHandler(async (req, res) => {
  const facultyId = await getFacultyIdByUser(req.user.id);
  if (!facultyId) throw new AppError('Faculty profile not found.', 404);
  const [subjects] = await pool.query(
    `SELECT sub.id, sub.code, sub.name, sem.semester_no,
            (SELECT COUNT(*) FROM students s WHERE s.current_semester_id = sub.semester_id) AS student_count
       FROM subjects sub JOIN semesters sem ON sem.id = sub.semester_id WHERE sub.faculty_id = ? ORDER BY sem.semester_no DESC, sub.code`, [facultyId]);
  const [today] = await pool.query(
    `SELECT ts.start_time, ts.end_time, ts.room_number, sub.code AS subject_code, sub.name AS subject_name, t.section
       FROM timetable_slots ts JOIN timetable t ON t.id = ts.timetable_id AND t.is_active = 1
       JOIN subjects sub ON sub.id = ts.subject_id
      WHERE ts.faculty_id = ? AND ts.day_of_week = DAYNAME(CURDATE()) ORDER BY ts.start_time`, [facultyId]);
  const [lessons] = await pool.query(
    'SELECT status, COUNT(*) AS count FROM lesson_plans WHERE faculty_id = ? GROUP BY status', [facultyId]);
  const [[week]] = await pool.query(
    'SELECT COUNT(*) AS sessions FROM attendance WHERE faculty_id = ? AND class_date >= CURDATE() - INTERVAL 7 DAY', [facultyId]);
  const [exams] = await pool.query(
    `SELECT DISTINCT ex.id, ex.name, ex.start_date, ex.end_date FROM exams ex JOIN exam_subjects es ON es.exam_id = ex.id
       JOIN subjects sub ON sub.id = es.subject_id
      WHERE sub.faculty_id = ? AND ex.status = 'scheduled' AND ex.end_date >= CURDATE() ORDER BY ex.start_date LIMIT 5`, [facultyId]);
  const [[pendingSheets]] = await pool.query(
    `SELECT COUNT(*) AS n FROM answer_sheets a JOIN exam_subjects es ON es.id = a.exam_subject_id JOIN subjects sub ON sub.id = es.subject_id
      WHERE sub.faculty_id = ? AND a.is_released = 0`, [facultyId]);
  const [[{ unread }]] = await pool.query('SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
  sendSuccess(res, {
    subjects, today_classes: today, lesson_plan_status: lessons, attendance_sessions_last_7_days: week.sessions,
    upcoming_exams: exams, unreleased_answer_sheets: pendingSheets.n, unread_notifications: unread,
  });
});

// GET /api/dashboard/admin
const admin = asyncHandler(async (req, res) => {
  await refreshOverdue();
  const count = async (sql) => (await pool.query(sql))[0][0].n;
  const [[hostel]] = await pool.query('SELECT COALESCE(SUM(capacity), 0) AS capacity, COALESCE(SUM(occupied_beds), 0) AS occupied FROM hostel_rooms');
  const [[money]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total, COALESCE(SUM(paid_amount), 0) AS collected,
            COALESCE(SUM(amount - paid_amount), 0) AS pending, COUNT(DISTINCT CASE WHEN paid_amount < amount THEN student_id END) AS students_with_dues
       FROM fees`);
  const [[att]] = await pool.query(
    `SELECT ROUND(100 * SUM(status IN ('present','late')) / NULLIF(COUNT(*), 0), 1) AS average_percent FROM attendance_records`);
  const [[low]] = await pool.query(
    `SELECT COUNT(*) AS n FROM (SELECT student_id FROM attendance_records GROUP BY student_id
       HAVING 100 * SUM(status IN ('present','late')) / COUNT(*) < 75) x`);
  const [byDepartment] = await pool.query(
    `SELECT d.name AS department, ROUND(100 * SUM(ar.status IN ('present','late')) / COUNT(*), 1) AS percentage
       FROM attendance_records ar JOIN students s ON s.id = ar.student_id JOIN courses c ON c.id = s.course_id
       JOIN departments d ON d.id = c.department_id GROUP BY d.id, d.name ORDER BY d.name`);
  const [feeStatus] = await pool.query('SELECT status, COUNT(*) AS count, SUM(amount - paid_amount) AS pending_amount FROM fees GROUP BY status');
  const [hostelRequests] = await pool.query("SELECT COUNT(*) AS n FROM hostel_bookings WHERE status = 'pending'");
  sendSuccess(res, {
    totals: {
      students: await count("SELECT COUNT(*) AS n FROM students s JOIN users u ON u.id = s.user_id WHERE u.is_active = 1"),
      faculty: await count("SELECT COUNT(*) AS n FROM faculty f JOIN users u ON u.id = f.user_id WHERE u.is_active = 1"),
      courses: await count('SELECT COUNT(*) AS n FROM courses'),
      departments: await count('SELECT COUNT(*) AS n FROM departments'),
      books: await count('SELECT COALESCE(SUM(total_copies), 0) AS n FROM books'),
      upcoming_exams: await count("SELECT COUNT(*) AS n FROM exams WHERE status = 'scheduled' AND end_date >= CURDATE()"),
    },
    hostel: { capacity: hostel.capacity, occupied: hostel.occupied, occupancy_percent: hostel.capacity ? Math.round((1000 * hostel.occupied) / hostel.capacity) / 10 : 0, pending_requests: hostelRequests[0].n },
    payments: { total_billed: money.total, collected: money.collected, pending: money.pending, students_with_dues: money.students_with_dues },
    attendance: { average_percent: att.average_percent, students_below_75: low.n, by_department: byDepartment },
    charts: { fee_status: feeStatus },
  });
});

module.exports = { student, faculty, admin };
