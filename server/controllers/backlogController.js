// Backlogs: a student sees only their own; admin manages all.
const { makeCrud } = require('../utils/crud');
const { studentScope } = require('../utils/scope');

module.exports = makeCrud({
  table: 'backlogs', label: 'Backlog',
  fields: ['student_id', 'subject_id', 'attempt_no', 'result', 'status', 'reexam_date', 'cleared_on', 'remarks'],
  required: ['student_id', 'subject_id', 'result'],
  select: `t.*, sub.code AS subject_code, sub.name AS subject_name, sem.semester_no,
           s.student_code, s.full_name AS student_name`,
  from: `backlogs t JOIN subjects sub ON sub.id = t.subject_id JOIN semesters sem ON sem.id = sub.semester_id
         JOIN students s ON s.id = t.student_id`,
  searchFields: ['sub.code', 'sub.name', 's.student_code', 's.full_name'],
  filters: { student_id: 't.student_id', status: 't.status', semester_no: 'sem.semester_no', subject_id: 't.subject_id' },
  orderBy: 't.status ASC, sem.semester_no, sub.code',
  extraFilter: (req, where, params) => studentScope(req, where, params),
});
