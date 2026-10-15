const express = require('express');
const c = require('../controllers/feeController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validId } = require('../middleware/validate');

const router = express.Router();
router.use(protect);
router.get('/', authorizeRoles('student', 'admin'), c.listFees);
router.post('/', authorizeRoles('admin'), c.createFee);
router.post('/assign', authorizeRoles('admin'), c.assignFee);
router.put('/:id', authorizeRoles('admin'), validId, c.updateFee);
router.delete('/:id', authorizeRoles('admin'), validId, c.deleteFee);
module.exports = router;
