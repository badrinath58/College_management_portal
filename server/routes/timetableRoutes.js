const express = require('express');
const c = require('../controllers/timetableController');
const pdf = require('../controllers/pdfController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validId } = require('../middleware/validate');

const router = express.Router();
router.use(protect);
router.get('/', c.getTimetable);
router.get('/versions', c.listVersions);
router.get('/pdf', pdf.timetablePdf);
router.post('/select', authorizeRoles('student'), c.selectTimetable);
router.post('/', authorizeRoles('admin'), c.createVersion);
router.put('/:id', authorizeRoles('admin'), validId, c.updateVersion);
router.put('/:id/slots', authorizeRoles('admin'), validId, c.replaceSlots);
router.delete('/:id', authorizeRoles('admin'), validId, c.deleteVersion);
module.exports = router;
