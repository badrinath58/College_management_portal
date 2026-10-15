// Builds the Express app (middleware + routes). server.js starts it.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/env');
const { pool } = require('./config/db');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const asyncHandler = require('./utils/asyncHandler');
const { sendSuccess } = require('./utils/response');

const app = express();

app.use(helmet());                                   // secure HTTP headers
app.use(cors({ origin: config.clientUrl, exposedHeaders: ['Content-Disposition'] }));   // only our React app may call the API; it may read the PDF file name
app.use(express.json({ limit: '1mb' }));             // read JSON request bodies (size-limited)
app.use('/api', apiLimiter);                         // request budget per IP

// Health check: proves the server AND the database are working
app.get('/api/health', asyncHandler(async (req, res) => {
  await pool.query('SELECT 1');
  sendSuccess(res, { server: 'ok', database: 'ok' }, 'API is running');
}));

app.use('/api', require('./routes'));   // every module is registered in routes/index.js

app.use(notFound);      // unknown URL -> 404 in our JSON format
app.use(errorHandler);  // every error ends up here

module.exports = app;
