const express = require('express');
const c = require('../controllers/answerSheetController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validId } = require('../middleware/validate');
const { makeUpload } = require('../middleware/upload');

const router = express.Router();
const staff = authorizeRoles('faculty', 'admin');
const upload = makeUpload('answer-sheets', { maxMb: 5 });

router.use(protect);
router.get('/', c.listSheets);
router.post('/', staff, upload.single('file'), c.uploadSheet);
router.put('/:id', staff, validId, c.updateSheet);
router.post('/:id/revaluation', authorizeRoles('student'), validId, c.requestRevaluation);
router.delete('/:id', authorizeRoles('admin'), validId, c.deleteSheet);
module.exports = router;
