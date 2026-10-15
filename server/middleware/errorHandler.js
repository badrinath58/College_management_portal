// The last stop for every error. Guarantees the answer is always { success:false, message }.
const config = require('../config/env');
const AppError = require('../utils/AppError');

// Runs when no route matched the URL
function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

// Express recognises an error handler by its 4 parameters
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message;

  // Translate common database errors into friendly answers
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'This record already exists.';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message = 'A related record does not exist.';
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    statusCode = 409;
    message = 'This record is in use and cannot be deleted.';
  } else if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    statusCode = 400;
    message = 'The data breaks a database rule (for example, a room is already full).';
  } else if (['WARN_DATA_TRUNCATED', 'ER_TRUNCATED_WRONG_VALUE', 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD',
              'ER_BAD_NULL_ERROR', 'ER_DATA_TOO_LONG', 'ER_WARN_DATA_OUT_OF_RANGE', 'ER_NO_DEFAULT_FOR_FIELD'].includes(err.code)) {
    statusCode = 400;
    message = 'One of the values is missing, too long, or not allowed.';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'The file is too large.' : 'File upload failed.';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON in the request body.';
  }

  // Unexpected bugs: log the details for the developer, but never show them to the user
  if (!err.isOperational && statusCode === 500) {
    console.error('Unexpected error:', err);
    message = config.isProd ? 'Something went wrong on the server.' : err.message;
  }

  res.status(statusCode).json({ success: false, message });
}

module.exports = { notFound, errorHandler };
