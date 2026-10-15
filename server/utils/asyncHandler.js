// Express 4 does not catch errors thrown inside async functions.
// This wrapper forwards them to our error handler, so we do not need try/catch everywhere.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
