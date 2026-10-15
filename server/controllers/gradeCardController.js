// Grade cards: SGPA and CGPA per semester with every subject's grade.
const { pool } = require('../config/db');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { requireFields, toInt } = require('../utils/validators');
const { resolveStudentId } = require('../services/identity');
const { LATEST_MARKS_SQL, recalculateGradeCard } = require('../services/gradeService');
const { notify } = require('../services/notificationService');

// Everything for a grade card. A student only gets PUBLISHED semesters; staff get all of them.
async function loadGradeCard(user, studentId, semesterId) {
  const where = ['gc.student_id = ?'];
  const params = [studentId];
  if (user.role === 'student') where.push('gc.is_published = 1');   // unpublished results stay hidden
  if (semesterId) { where.push('gc.semester_id = ?'); params.push(semesterId); }

  const [cards] = await pool.query(
    `SELECT gc.id, gc.semester_id, sem.semester_no, sem.academic_year, gc.sgpa, gc.cgpa, gc.total_credits,
            gc.earned_credits, gc.result_status, gc.is_published, gc.published_on
       FROM grade_cards gc JOIN semesters sem ON sem.id = gc.semester_id
      WHERE ${where.join(' AND ')} ORDER BY sem.semester_no`, params);

  let subjects = [];
  if (cards.length) {
    [subjects] = await pool.query(
      `${LATEST_MARKS_SQL} AND m.student_id = ? AND sub.semester_id IN (?) ORDER BY sub.code`, [studentId, cards.map((c) => c.semester_id)]);
  }
  const [stu] = await pool.query(
    `SELECT s.student_code, s.full_name, s.section, s.admission_year, c.name AS course, d.name AS department
       FROM students s JOIN courses c ON c.id = s.course_id JOIN departments d ON d.id = c.department_id WHERE s.id = ?`, [studentId]);
  if (!stu[0]) throw new AppError('Student not found.', 404);

  return {
    college_name: config.collegeName, student: stu[0],
    cgpa: cards.length ? cards[cards.length - 1].cgpa : null,
    cards: cards.map((card) => ({
      ...card,
      subjects: subjects.filter((s) => s.semester_id === card.semester_id).map((s) => ({
        subject_code: s.subject_code, subject_name: s.subject_name, credits: s.credits,
        internal_marks: s.internal_marks, mid_marks: s.mid_marks, assignment_marks: s.assignment_marks,
        practical_marks: s.practical_marks, external_marks: s.external_marks, total_marks: s.total_marks,
        grade: s.grade, grade_points: s.grade_points, result: s.result, attempt_no: s.attempt_no })),
    })),
  };
}

// GET /api/grade-card?semester_id=     (student: own PUBLISHED cards | staff: ?student_id=)
const getGradeCard = asyncHandler(async (req, res) => {
  const studentId = await resolveStudentId(req);
  sendSuccess(res, await loadGradeCard(req.user, studentId, req.query.semester_id));
});

// POST /api/grade-card/recalculate   (admin)  body: { student_id, semester_id }
const recalculate = asyncHandler(async (req, res) => {
  requireFields(req.body, ['student_id', 'semester_id']);
  const card = await recalculateGradeCard(pool, toInt(req.body.student_id, 'student_id'), toInt(req.body.semester_id, 'semester_id'));
  if (!card) throw new AppError('Some subjects do not have a final result yet.', 409);
  sendSuccess(res, card, 'Grade card recalculated');
});

// PUT /api/grade-card/:id/publish   (admin)  body: { is_published: true|false }
const publish = asyncHandler(async (req, res) => {
  const publishNow = req.body.is_published !== false;
  const [rows] = await pool.query(
    `SELECT gc.id, gc.semester_id, sem.semester_no, s.user_id FROM grade_cards gc
       JOIN students s ON s.id = gc.student_id JOIN semesters sem ON sem.id = gc.semester_id WHERE gc.id = ?`, [req.params.id]);
  if (!rows[0]) throw new AppError('Grade card not found.', 404);
  await pool.query('UPDATE grade_cards SET is_published = ?, published_on = ? WHERE id = ?',
    [publishNow ? 1 : 0, publishNow ? new Date().toISOString().slice(0, 10) : null, req.params.id]);
  if (publishNow) await notify(rows[0].user_id, 'Grade card published', `Your Semester ${rows[0].semester_no} grade card is now available.`, 'marks');
  sendSuccess(res, null, publishNow ? 'Grade card published' : 'Grade card hidden');
});

module.exports = { getGradeCard, recalculate, publish, loadGradeCard };
