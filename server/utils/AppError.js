// An error we throw ON PURPOSE (wrong password, not found, no permission...).
// It carries the HTTP status code so the error handler knows what to send back.
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // marks it as an expected error, not a bug
  }
}
module.exports = AppError;
