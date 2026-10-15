// Lesson plans: students read their semester's plans; faculty write plans for THEIR subjects.
const { makeCrud } = require('../utils/crud');
const AppError = require('../utils/AppError');
const { oneOf, toDate, todayISO } = require('../utils/validators');
const { assertSubjectAccess } = require('../services/identity');

module.exports = makeCrud({
  table: 'lesson_plans', label: 'Lesson plan',
  fields: ['subject_id', 'unit_no', 'topic', 'teaching_method', 'planned_date', 'completed_date', 'status', 'remarks'],
  required: ['subject_id', 'unit_no', 'topic', 'planned_date'],
  select: `t.*, sub.code AS subject_code, sub.name AS subject_name, sem.semester_no, f.full_name AS faculty_name`,
  from: `lesson_plans t JOIN subjects sub ON sub.id = t.subject_id JOIN semesters sem ON sem.id = sub.semester_id
         LEFT JOIN faculty f ON f.id = t.faculty_id`,
  searchFields: ['t.topic', 'sub.name', 'sub.code'],
  filters: { subject_id: 't.subject_id', status: 't.status', unit_no: 't.unit_no', semester_id: 'sub.semester_id' },
  orderBy: 'sub.code, t.unit_no, t.planned_date', maxLimit: 200,
  extraFilter: (req, where, params) => {
    if (req.user.role === 'student') {
      where.push('sub.semester_id = (SELECT current_semester_id FROM students WHERE user_id = ?)');
      params.push(req.user.id);
    } else if (req.user.role === 'faculty' && req.query.mine !== 'false') {
      where.push('t.faculty_id = (SELECT id FROM faculty WHERE user_id = ?)');
      params.push(req.user.id);
    }
  },
  beforeSave: async (data, req, existing) => {
    const subject = await assertSubjectAccess(req, data.subject_id || existing.subject_id); // faculty: own subjects only
    data.faculty_id = subject.faculty_id;
    if (data.teaching_method) oneOf(data.teaching_method, ['lecture', 'tutorial', 'lab_session', 'seminar', 'case_study', 'group_discussion'], 'teaching_method');
    if (data.status) oneOf(data.status, ['planned', 'in_progress', 'completed', 'postponed'], 'status');
    if (data.planned_date) toDate(data.planned_date, 'planned_date');
    if (data.completed_date) toDate(data.completed_date, 'completed_date');
    if (data.status === 'completed' && !data.completed_date && !(existing && existing.completed_date)) data.completed_date = todayISO();
    if (data.status && data.status !== 'completed' && data.completed_date === undefined && existing && existing.completed_date) data.completed_date = null;
    if (data.completed_date && data.status && data.status !== 'completed') throw new AppError('Only completed topics can have a completed_date.', 400);
  },
  beforeDelete: async (req, existing) => { await assertSubjectAccess(req, existing.subject_id); },
});
