const express = require('express');
const { body } = require('express-validator');
const { login, logout, me, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Rules for the login form fields (checked BEFORE the controller runs)
const loginRules = [
  body('username').trim().notEmpty().withMessage('Student ID / Username is required.').isLength({ max: 50 }).withMessage('Username is too long.'),
  body('password').notEmpty().withMessage('Password is required.').isLength({ max: 100 }).withMessage('Password is too long.'),
  body('rememberMe').optional().isBoolean().withMessage('rememberMe must be true or false.').toBoolean(),
];

router.post('/login', loginLimiter, loginRules, handleValidation, login);
router.post('/logout', protect, logout);
router.get('/me', protect, me);
router.put('/password', protect, [
  body('current_password').notEmpty().withMessage('Current password is required.'),
  body('new_password').notEmpty().withMessage('New password is required.'),
], handleValidation, changePassword);

module.exports = router;
