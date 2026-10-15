// Mounts four tiny routers:  /api/departments  /api/courses  /api/semesters  /api/subjects
const crudRouter = require('./crudRouter');
const { departments, courses, semesters, subjects } = require('../controllers/catalogController');

module.exports = {
  departmentRoutes: crudRouter(departments),
  courseRoutes: crudRouter(courses),
  semesterRoutes: crudRouter(semesters),
  subjectRoutes: crudRouter(subjects),
};
