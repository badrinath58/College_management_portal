// Reads the .env file ONCE and exports clean settings for the rest of the app.
// Nothing secret is hard-coded anywhere: passwords and the JWT secret come from .env only.
const path = require('path');
// .env lives in the project root (two folders above server/config)
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Stop immediately if an important setting is missing (better than failing later in a strange way)
const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env (project root) and fill it in.');
  process.exit(1);
}

// A short or default secret would make tokens easy to forge, so we refuse to start with it
if (process.env.JWT_SECRET.length < 16 || process.env.JWT_SECRET === 'your_secret') {
  console.error('JWT_SECRET is too weak. Use a random string of at least 16 characters (32+ recommended).');
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT) || 5000,
  isProd: process.env.NODE_ENV === 'production',
  collegeName: process.env.COLLEGE_NAME || 'Greenfield Institute of Technology',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    rememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '7d',
  },
};
