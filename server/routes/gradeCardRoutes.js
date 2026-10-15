const express = require('express');
const c = require('../controllers/gradeCardController');
const pdf = require('../controllers/pdfController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validId } = require('../middleware/validate');

const router = express.Router();
router.use(protect);
const own = authorizeRoles('student', 'admin');
router.get('/', own, c.getGradeCard);
router.get('/pdf', own, pdf.gradeCardPdf);
router.post('/recalculate', authorizeRoles('admin'), c.recalculate);
router.put('/:id/publish', authorizeRoles('admin'), validId, c.publish);
module.exports = router;
