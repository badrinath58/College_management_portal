// Printable grade card: one table per semester with SGPA and CGPA.
// "Internal" = internal + mid + assignment + practical marks; "External" = the end-semester exam.
import Logo from './Logo';

const num = (v) => Number(v || 0);

export default function GradeCard({ data, cards }) {
  const s = data.student;
  return (
    <div className="doc">
      <div className="doc-head">
        <Logo size={64} />
        <div className="title"><h2>{data.college_name}</h2><p>Grade Card</p></div>
      </div>
      <dl>
        <dt>Student name</dt><dd>{s.full_name}</dd>
        <dt>Student ID</dt><dd>{s.student_code}</dd>
        <dt>Course</dt><dd>{s.course} ({s.department})</dd>
        <dt>Admission year</dt><dd>{s.admission_year}</dd>
      </dl>
      {cards.map((card) => (
        <section key={card.id}>
          <h3 style={{ marginTop: 18 }}>Semester {card.semester_no} ({card.academic_year})</h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Semester</th><th>Subject</th><th>Code</th><th className="num">Credits</th><th className="num">Internal marks</th><th className="num">External marks</th>
                  <th className="num">Total marks</th><th>Grade</th><th className="num">Grade points</th><th>Result</th></tr>
              </thead>
              <tbody>
                {card.subjects.map((sub) => (
                  <tr key={sub.subject_code}>
                    <td>{card.semester_no}</td><td>{sub.subject_name}</td><td>{sub.subject_code}</td><td className="num">{sub.credits}</td>
                    <td className="num">{num(sub.internal_marks) + num(sub.mid_marks) + num(sub.assignment_marks) + num(sub.practical_marks)}</td>
                    <td className="num">{num(sub.external_marks)}</td><td className="num">{num(sub.total_marks)}</td>
                    <td>{sub.grade || '-'}</td><td className="num">{sub.grade_points ?? '-'}</td>
                    <td className={`passfail-${sub.result === 'pass' ? 'pass' : 'fail'}`}>{String(sub.result).toUpperCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="gc-summary">
            <span>SGPA: {card.sgpa.toFixed(2)}</span><span>CGPA: {card.cgpa.toFixed(2)}</span>
            <span>Credits earned: {card.earned_credits}/{card.total_credits}</span>
            <span className={`passfail-${card.result_status}`}>Result: {card.result_status.toUpperCase()}</span>
          </div>
        </section>
      ))}
    </div>
  );
}
