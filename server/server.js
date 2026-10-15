// Entry point:  npm run dev
const config = require('./config/env'); // must be first: loads .env and checks the settings
const app = require('./app');
const { testConnection } = require('./config/db');

async function start() {
  try {
    await testConnection();
    console.log(`MySQL connected (database: ${config.db.name})`);
  } catch (error) {
    console.error('Could not connect to MySQL:', error.message);
    console.error('Check DB_* values in .env and that MySQL is running.');
    process.exit(1);
  }
  app.listen(config.port, () => console.log(`API running on http://localhost:${config.port}`));
}

start();
