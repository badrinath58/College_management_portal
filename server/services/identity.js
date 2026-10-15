// "Who is this user in the college?"  Maps a login (users.id) to a student / faculty row.
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');

const STUDENT_COLS = 'id, user_id, student_code, full_name, course_id, current_semester_id, section, gender';

async function getStudentByUser(userId) {
  const [rows] = await pool.query(`SELECT ${STUDENT_COLS} FROM students WHERE user_id = ?`, [userId]);
  return rows[0] || null;
}

async function getStudentById(studentId) {
  const [rows] = await pool.query(`SELECT ${STUDENT_COLS} FROM students WHERE id = ?`, [studentId]);
  return rows[0] || null;
}

async function getFacultyIdByUser(userId) {
  const [rows] = await pool.query('SELECT id FROM faculty WHERE user_id = ?', [userId]);
  return rows[0] ? rows[0].id : null;
}

// Student -> always their own id.   Faculty/admin -> must say which student (?student_id=)
async function resolveStudentId(req) {
  if (req.user.role === 'student') {
    const student = await getStudentByUser(req.user.id);
    if (!student) throw new AppError('Student profile not found.', 404);
    return student.id;
  }
  const id = Number((req.query && req.query.student_id) || (req.body && req.body.student_id));
  if (!Number.isInteger(id) || id < 1) throw new AppError('student_id is required.', 400);
  return id;
}

// Faculty may only work on THEIR subjects. Admin may work on any subject.
async function assertSubjectAccess(req, subjectId) {
  const [rows] = await pool.query(
    `SELECT sub.id, sub.code, sub.name, sub.semester_id, sub.faculty_id, sub.subject_type, sub.credits
       FROM subjects sub WHERE sub.id = ?`, [subjectId]);
  const subject = rows[0];
  if (!subject) throw new AppError('Subject not found.', 404);
  if (req.user.role === 'faculty') {
    const facultyId = await getFacultyIdByUser(req.user.id);
    if (!facultyId || subject.faculty_id !== facultyId) {
      throw new AppError('You can only manage subjects assigned to you.', 403);
    }
  }
  return subject;
}

module.exports = { getStudentByUser, getStudentById, getFacultyIdByUser, resolveStudentId, assertSubjectAccess };
