// Data scoping: a STUDENT may only see their own rows. Faculty/admin see everything (or filter).
// Adds a condition to a WHERE list. We use a sub-query so no extra database call is needed.
function studentScope(req, where, params, column = 't.student_id') {
  if (req.user.role === 'student') {
    where.push(`${column} = (SELECT id FROM students WHERE user_id = ?)`);
    params.push(req.user.id);
  }
}

// Turns a list of conditions into "WHERE a AND b" (or an empty string)
function whereSql(where) {
  return where.length ? `WHERE ${where.join(' AND ')}` : '';
}

module.exports = { studentScope, whereSql };
