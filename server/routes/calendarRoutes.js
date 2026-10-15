const crudRouter = require('./crudRouter');
module.exports = crudRouter(require('../controllers/calendarController'), ['admin', 'faculty']);
