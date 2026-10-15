const express = require('express');
const c = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');

const router = express.Router();
router.use(protect);
router.get('/', authorizeRoles('student', 'admin'), c.listPayments);
router.get('/summary', authorizeRoles('student', 'admin'), c.summary);
router.post('/', authorizeRoles('student', 'admin'), c.createPayment);   // admin = record a counter/cash payment
module.exports = router;
