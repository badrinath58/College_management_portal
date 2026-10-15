const express = require('express');
const c = require('../controllers/studentController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validId } = require('../middleware/validate');
const { makeUpload } = require('../middleware/upload');

const router = express.Router();
const photoUpload = makeUpload('profile-photos', { allowed: ['.jpg', '.jpeg', '.png'], maxMb: 2 });

router.use(protect);
// the student's own profile (these must come BEFORE "/:id")
router.get('/profile', authorizeRoles('student'), c.getProfile);
router.put('/profile', authorizeRoles('student'), c.updateProfile);
router.post('/profile/photo', authorizeRoles('student'), photoUpload.single('photo'), c.uploadPhoto);
// admin / faculty
router.get('/', authorizeRoles('admin', 'faculty'), c.list);
router.post('/', authorizeRoles('admin'), c.create);
router.get('/:id', authorizeRoles('admin', 'faculty'), validId, c.getOne);
router.put('/:id', authorizeRoles('admin'), validId, c.update);
router.put('/:id/reset-password', authorizeRoles('admin'), validId, c.resetPassword);
router.delete('/:id', authorizeRoles('admin'), validId, c.deactivate);

module.exports = router;
