// Collects the results of express-validator rules and stops the request if any rule failed.
const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Show the first problem; the frontend shows it under the form
    return next(new AppError(errors.array()[0].msg, 400));
  }
  next();
}

module.exports = { handleValidation };

// Reusable check for URLs like /api/books/:id  (id must be a positive whole number)
const { param } = require('express-validator');
const validId = [param('id').isInt({ min: 1 }).withMessage('Invalid id.'), handleValidation];
module.exports.validId = validId;
