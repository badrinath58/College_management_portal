// One examination with its papers (subject, code, date, time, room, marks).
import Badge from './Badge';
import { formatDate, formatTime, humanize } from '../utils/format';

export default function ExamCard({ exam }) {
  return (
    <section className="card exam-card">
      <div className="card-header">
        <span>{exam.name}<br /><small>{formatDate(exam.start_date)} to {formatDate(exam.end_date)}{exam.exam_center ? ` | ${exam.exam_center}` : ''}</small></span>
        <span className="row"><Badge tone="info">{humanize(exam.exam_type)}</Badge><Badge status={exam.phase} /></span>
      </div>
      {exam.subjects.length === 0 ? <p className="card-body muted">The paper schedule will be announced soon.</p> : (
        <div className="table-wrap">
          <table className="table stack-mobile">
            <thead><tr><th>Subject</th><th>Code</th><th>Date</th><th>Time</th><th>Room</th><th className="num">Max marks</th></tr></thead>
            <tbody>
              {exam.subjects.map((s) => (
                <tr key={s.id}>
                  <td data-label="Subject">{s.subject_name}</td><td data-label="Code">{s.subject_code}</td>
                  <td data-label="Date">{formatDate(s.exam_date)}</td><td data-label="Time">{formatTime(s.start_time)} - {formatTime(s.end_time)}</td>
                  <td data-label="Room">{s.room_number || '-'}</td><td data-label="Max marks" className="num">{s.max_marks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {exam.instructions && <p className="card-body muted"><strong>Instructions:</strong> {exam.instructions}</p>}
    </section>
  );
}
