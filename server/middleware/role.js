// Role-based authorization. Always used AFTER protect.
// Example:  router.post('/marks', protect, authorizeRoles('faculty', 'admin'), addMarks);
const AppError = require('../utils/AppError');

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Please log in to continue.', 401));
    if (!allowedRoles.includes(req.user.role)) {
      // 403 = "we know who you are, but you are not allowed to do this"
      return next(new AppError('You do not have permission to do this.', 403));
    }
    next();
  };
}

module.exports = { authorizeRoles };
