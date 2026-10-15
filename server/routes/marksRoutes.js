const express = require('express');
const c = require('../controllers/marksController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validId } = require('../middleware/validate');

const router = express.Router();
const staff = authorizeRoles('faculty', 'admin');
router.use(protect);
router.get('/', c.listMarks);
router.get('/roster', staff, c.roster);
router.post('/', staff, c.createMarks);
router.put('/:id', staff, validId, c.updateMarks);
router.delete('/:id', authorizeRoles('admin'), validId, c.deleteMarks);
module.exports = router;
