// MySQL connection pool. A pool keeps a few connections open and reuses them,
// which is much faster than opening a new connection for every request.
const mysql = require('mysql2/promise');
const config = require('./env');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,     // return DATE/TIMESTAMP as plain text, avoids time-zone surprises
  decimalNumbers: true,  // return DECIMAL columns (money, marks) as numbers instead of strings
});

// Called once when the server starts, to prove the database is reachable
async function testConnection() {
  const connection = await pool.getConnection();
  await connection.ping();
  connection.release();
}

// Helper for jobs that must be "all or nothing" (payments, hostel booking, ...).
// Usage:  await withTransaction(async (conn) => { await conn.query(...); await conn.query(...); });
// If anything throws, every change made inside is rolled back.
async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release(); // always give the connection back to the pool
  }
}

module.exports = { pool, testConnection, withTransaction };
