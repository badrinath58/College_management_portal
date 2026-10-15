// Departments, courses, semesters and subjects. Everybody can read; only admin can change.
const { makeCrud } = require('../utils/crud');

const departments = makeCrud({
  table: 'departments', label: 'Department',
  fields: ['code', 'name', 'hod_name'], required: ['code', 'name'],
  searchFields: ['t.code', 't.name'], orderBy: 't.name',
});

const courses = makeCrud({
  table: 'courses', label: 'Course',
  fields: ['department_id', 'code', 'name', 'duration_years', 'total_semesters'],
  required: ['department_id', 'code', 'name', 'duration_years', 'total_semesters'],
  select: 't.*, d.name AS department_name',
  from: 'courses t JOIN departments d ON d.id = t.department_id',
  searchFields: ['t.code', 't.name'], filters: { department_id: 't.department_id' }, orderBy: 't.name',
});

const semesters = makeCrud({
  table: 'semesters', label: 'Semester',
  fields: ['course_id', 'semester_no', 'academic_year', 'start_date', 'end_date', 'is_current'],
  required: ['course_id', 'semester_no', 'academic_year', 'start_date', 'end_date'],
  select: 't.*, c.name AS course_name',
  from: 'semesters t JOIN courses c ON c.id = t.course_id',
  filters: { course_id: 't.course_id', academic_year: 't.academic_year', is_current: 't.is_current' },
  orderBy: 't.course_id, t.start_date DESC',
});

const subjects = makeCrud({
  table: 'subjects', label: 'Subject',
  fields: ['semester_id', 'code', 'name', 'credits', 'subject_type', 'faculty_id'],
  required: ['semester_id', 'code', 'name', 'credits'],
  select: `t.*, f.full_name AS faculty_name, sem.semester_no, sem.academic_year, sem.course_id, c.name AS course_name`,
  from: `subjects t JOIN semesters sem ON sem.id = t.semester_id JOIN courses c ON c.id = sem.course_id
         LEFT JOIN faculty f ON f.id = t.faculty_id`,
  searchFields: ['t.code', 't.name'],
  filters: { semester_id: 't.semester_id', faculty_id: 't.faculty_id', course_id: 'sem.course_id' },
  orderBy: 'sem.semester_no, t.code',
  // ?mine=true -> faculty: subjects assigned to me;  student: subjects of my current semester
  extraFilter: (req, where, params) => {
    if (req.query.mine !== 'true') return;
    if (req.user.role === 'faculty') {
      where.push('t.faculty_id = (SELECT id FROM faculty WHERE user_id = ?)');
      params.push(req.user.id);
    } else if (req.user.role === 'student') {
      where.push('t.semester_id = (SELECT current_semester_id FROM students WHERE user_id = ?)');
      params.push(req.user.id);
    }
  },
});

module.exports = { departments, courses, semesters, subjects };
