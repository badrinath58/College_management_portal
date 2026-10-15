const express = require('express');
const c = require('../controllers/hallTicketController');
const pdf = require('../controllers/pdfController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validId } = require('../middleware/validate');
const { param } = require('express-validator');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();
router.use(protect);
const own = authorizeRoles('student', 'admin');
router.get('/', own, c.listTickets);                                                  // student: own | staff: ?student_id=
router.post('/generate', authorizeRoles('admin'), c.generateTickets);
router.put('/:id/status', authorizeRoles('admin'), validId, c.setStatus);
const examId = [param('exam_id').isInt({ min: 1 }).withMessage('Invalid exam id.'), handleValidation];
router.get('/:exam_id/pdf', own, examId, pdf.hallTicketPdf);
router.get('/:exam_id', own, examId, c.getTicket);
module.exports = router;
