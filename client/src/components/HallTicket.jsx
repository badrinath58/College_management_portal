// Printable hall ticket: photo, student details, exam centre and the paper schedule.
import AuthImage from './AuthImage';
import Logo from './Logo';
import { formatDate, formatTime, humanize } from '../utils/format';

export default function HallTicket({ ticket: t }) {
  return (
    <div className="doc">
      <div className="doc-head">
        <Logo size={64} />
        <div className="title"><h2>{t.college_name}</h2><p>Hall Ticket - {t.exam_name}</p></div>
        <div className="photo"><AuthImage src={t.photo_url} alt={`Photo of ${t.full_name}`} fallback="Affix photo" /></div>
      </div>
      <dl>
        <dt>Hall ticket no.</dt><dd>{t.ticket_number}</dd>
        <dt>Student name</dt><dd>{t.full_name}</dd>
        <dt>Student ID</dt><dd>{t.student_code}</dd>
        <dt>Course</dt><dd>{t.course}</dd>
        <dt>Department</dt><dd>{t.department}</dd>
        <dt>Semester</dt><dd>{t.semester_no} ({t.academic_year}) | Section {t.section}</dd>
        <dt>Examination</dt><dd>{t.exam_name} ({humanize(t.exam_type)})</dd>
        <dt>Exam center</dt><dd>{t.exam_center || '-'}</dd>
        <dt>Exam dates</dt><dd>{formatDate(t.start_date)} to {formatDate(t.end_date)}</dd>
      </dl>
      <table>
        <thead><tr><th>Subject</th><th>Code</th><th>Date</th><th>Time</th><th>Room</th></tr></thead>
        <tbody>
          {t.subjects.map((s) => (
            <tr key={s.subject_code}><td>{s.subject_name}</td><td>{s.subject_code}</td><td>{formatDate(s.exam_date)}</td>
              <td>{formatTime(s.start_time)} - {formatTime(s.end_time)}</td><td>{s.room_number || '-'}</td></tr>
          ))}
        </tbody>
      </table>
      {t.instructions && <p><strong>Instructions:</strong> {t.instructions}</p>}
      <div className="signatures"><div>Student signature</div><div>Controller of Examinations</div></div>
    </div>
  );
}
