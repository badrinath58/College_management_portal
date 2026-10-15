const crudRouter = require('./crudRouter');
module.exports = crudRouter(require('../controllers/lessonPlanController'), ['faculty', 'admin']);
