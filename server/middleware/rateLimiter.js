// Rate limiting = a request budget per IP address. It slows down password guessing and abuse.
const rateLimit = require('express-rate-limit');

// Same JSON shape as every other error: { success:false, message }
const makeLimiter = (windowMinutes, limit, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });

// The limits can be changed in .env (API_RATE_LIMIT, LOGIN_RATE_LIMIT). Keep the defaults for real use;
// raise them only while running "npm run verify", which logs in many times from one computer.
// Whole API: 300 requests per 15 minutes per IP
const apiLimiter = makeLimiter(15, Number(process.env.API_RATE_LIMIT) || 300, 'Too many requests. Please try again later.');
// Login only: 10 attempts per 15 minutes per IP
const loginLimiter = makeLimiter(15, Number(process.env.LOGIN_RATE_LIMIT) || 10, 'Too many login attempts. Please try again after 15 minutes.');

module.exports = { apiLimiter, loginLimiter };
