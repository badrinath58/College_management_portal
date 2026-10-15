// Grading rules in ONE place (the faculty marks page and the grade card both use this).
const PASS_MARK = 40; // total out of 100

const GRADE_SCALE = [
  { min: 90, grade: 'O', points: 10 },
  { min: 80, grade: 'A+', points: 9 },
  { min: 70, grade: 'A', points: 8 },
  { min: 60, grade: 'B+', points: 7 },
  { min: 50, grade: 'B', points: 6 },
  { min: 40, grade: 'C', points: 5 },
  { min: 0, grade: 'F', points: 0 },
];

// Maximum marks for each part. Theory = 100 in total, practical = 100 in total.
const MAX_MARKS = {
  theory: { internal: 10, mid: 20, assignment: 10, practical: 0, external: 60 },
  practical: { internal: 25, mid: 0, assignment: 0, practical: 25, external: 50 },
};

function gradeFor(total) {
  const row = GRADE_SCALE.find((g) => total >= g.min);
  return { grade: row.grade, points: row.points, result: total >= PASS_MARK ? 'pass' : 'fail' };
}

module.exports = { PASS_MARK, GRADE_SCALE, MAX_MARKS, gradeFor };
