const express = require('express');
const c = require('../controllers/libraryController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validId } = require('../middleware/validate');

const router = express.Router();
router.use(protect);
router.get('/issues', authorizeRoles('student', 'admin'), c.listIssues);                                                  // student: own, admin/faculty: all
router.post('/issues', authorizeRoles('admin'), c.issueBook);
router.put('/issues/:id/renew', authorizeRoles('student', 'admin'), validId, c.renewBook);
router.put('/issues/:id/return', authorizeRoles('admin'), validId, c.returnBook);
router.put('/issues/:id/fine-paid', authorizeRoles('admin'), validId, c.markFinePaid);
module.exports = router;
