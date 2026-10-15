const express = require('express');
const c = require('../controllers/attendanceController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validId } = require('../middleware/validate');

const router = express.Router();
const staff = authorizeRoles('faculty', 'admin');
router.use(protect);
router.get('/', c.getAttendance);                         // student (own) / staff (?student_id=)
router.get('/roster', staff, c.getRoster);
router.get('/sessions', staff, c.listSessions);
router.get('/sessions/:id', staff, validId, c.getSession);
router.get('/report', staff, c.report);
router.post('/', staff, c.markAttendance);
router.put('/:id', staff, validId, c.updateAttendance);

module.exports = router;
