const express = require('express');
const c = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');

const router = express.Router();
router.use(protect);
router.get('/student', authorizeRoles('student'), c.student);
router.get('/faculty', authorizeRoles('faculty'), c.faculty);
router.get('/admin', authorizeRoles('admin'), c.admin);
module.exports = router;
