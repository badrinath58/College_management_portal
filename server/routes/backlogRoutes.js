const crudRouter = require('./crudRouter');
module.exports = crudRouter(require('../controllers/backlogController'), ['admin'], ['student', 'admin']);
