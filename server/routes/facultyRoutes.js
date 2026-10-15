const express = require('express');
const c = require('../controllers/facultyController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validId } = require('../middleware/validate');

const router = express.Router();
router.use(protect);
router.get('/me', authorizeRoles('faculty'), c.me);          // before "/:id"
router.get('/', authorizeRoles('admin'), c.list);
router.post('/', authorizeRoles('admin'), c.create);
router.get('/:id', authorizeRoles('admin'), validId, c.getOne);
router.put('/:id', authorizeRoles('admin'), validId, c.update);
router.put('/:id/reset-password', authorizeRoles('admin'), validId, c.resetPassword);
router.delete('/:id', authorizeRoles('admin'), validId, c.deactivate);

module.exports = router;
