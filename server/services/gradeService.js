// Recalculates SGPA / CGPA and keeps the backlog list in step with the marks.
//   SGPA = sum(grade_points x credits) / sum(credits)   for one semester
//   CGPA = same formula over all semesters up to this one
// Only the LATEST attempt of each subject counts (a cleared backlog replaces the old fail).
const AppError = require('../utils/AppError');

// Base query: latest attempt of every subject for a student. Add "WHERE m.student_id = ?" yourself.
const LATEST_MARKS_SQL = `
  SELECT m.id, m.student_id, m.subject_id, m.attempt_no, m.internal_marks, m.mid_marks, m.assignment_marks,
         m.practical_marks, m.external_marks, m.total_marks, m.grade, m.grade_points, m.result, m.updated_at,
         sub.code AS subject_code, sub.name AS subject_name, sub.credits, sub.subject_type,
         sub.semester_id, sem.semester_no, sem.academic_year
    FROM marks m
    JOIN subjects sub ON sub.id = m.subject_id
    JOIN semesters sem ON sem.id = sub.semester_id
   WHERE m.attempt_no = (SELECT MAX(m2.attempt_no) FROM marks m2
                          WHERE m2.student_id = m.student_id AND m2.subject_id = m.subject_id)`;

const round2 = (n) => Math.round(n * 100) / 100;

function gpa(rows) {
  const credits = rows.reduce((s, r) => s + r.credits, 0);
  const points = rows.reduce((s, r) => s + Number(r.grade_points || 0) * r.credits, 0);
  return credits ? round2(points / credits) : 0;
}

// db = a pool or a transaction connection
async function recalculateGradeCard(db, studentId, semesterId) {
  const [rows] = await db.query(`${LATEST_MARKS_SQL} AND m.student_id = ?`, [studentId]);
  const thisSem = rows.filter((r) => r.semester_id === semesterId);
  if (!thisSem.length) throw new AppError('No marks found for this semester.', 404);
  // A grade card is created only when every subject of the semester has a final result
  if (thisSem.some((r) => r.result === 'pending')) return null;

  const semNo = thisSem[0].semester_no;
  const upToNow = rows.filter((r) => r.semester_no <= semNo && r.result !== 'pending');
  const card = {
    sgpa: gpa(thisSem),
    cgpa: gpa(upToNow),
    total_credits: thisSem.reduce((s, r) => s + r.credits, 0),
    earned_credits: thisSem.filter((r) => r.result === 'pass').reduce((s, r) => s + r.credits, 0),
    result_status: thisSem.every((r) => r.result === 'pass') ? 'pass' : 'fail',
  };
  await db.query(
    `INSERT INTO grade_cards (student_id, semester_id, sgpa, cgpa, total_credits, earned_credits, result_status)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE sgpa = VALUES(sgpa), cgpa = VALUES(cgpa), total_credits = VALUES(total_credits),
       earned_credits = VALUES(earned_credits), result_status = VALUES(result_status)`,
    [studentId, semesterId, card.sgpa, card.cgpa, card.total_credits, card.earned_credits, card.result_status]);
  return card;
}

// Fail -> make sure a backlog exists.   Pass -> mark an existing backlog as cleared.
async function syncBacklog(db, studentId, subjectId, attemptNo, result) {
  if (result === 'fail' || result === 'absent') {
    await db.query(
      `INSERT INTO backlogs (student_id, subject_id, attempt_no, result, status)
       VALUES (?, ?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE attempt_no = VALUES(attempt_no), result = VALUES(result),
         status = 'active', cleared_on = NULL`,
      [studentId, subjectId, attemptNo, result]);
  } else if (result === 'pass') {
    await db.query(
      `UPDATE backlogs SET status = 'cleared', result = 'pass', attempt_no = ?, cleared_on = CURDATE()
        WHERE student_id = ? AND subject_id = ?`, [attemptNo, studentId, subjectId]);
  }
}

module.exports = { LATEST_MARKS_SQL, recalculateGradeCard, syncBacklog };
