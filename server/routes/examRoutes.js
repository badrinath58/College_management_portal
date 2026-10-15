const express = require('express');
const c = require('../controllers/examController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validId } = require('../middleware/validate');

const router = express.Router();
const manage = authorizeRoles('admin', 'faculty');
router.use(protect);
router.get('/', c.listExams);
router.get('/:id', validId, c.getExam);
router.post('/', manage, c.createExam);
router.put('/:id', manage, validId, c.updateExam);
router.put('/:id/subjects', manage, validId, c.replaceSubjects);
router.delete('/:id', authorizeRoles('admin'), validId, c.deleteExam);
module.exports = router;
