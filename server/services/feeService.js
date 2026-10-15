const { pool } = require('../config/db');
const { todayISO } = require('../utils/validators');

// paid -> partial -> overdue (past due date, nothing paid) -> pending (not due yet)
function deriveStatus(amount, paid, dueDate) {
  if (paid >= amount) return 'paid';
  if (paid > 0) return 'partial';
  return dueDate < todayISO() ? 'overdue' : 'pending';
}

// Flip 'pending' fees to 'overdue' once their due date has passed
async function refreshOverdue() {
  await pool.query("UPDATE fees SET status = 'overdue' WHERE status = 'pending' AND due_date < CURDATE()");
}

module.exports = { deriveStatus, refreshOverdue };
