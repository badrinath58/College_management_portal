// One subject's attendance: percentage, progress bar, counts. Low attendance (< 75%) is highlighted in red.
import { AlertTriangle } from 'lucide-react';
import Badge from './Badge';
import ProgressBar from './ProgressBar';
import { attendanceTone } from '../utils/format';

export default function AttendanceCard({ subject, minimum = 75 }) {
  const s = subject;
  return (
    <article className={`subject-card ${s.is_low ? 'low' : ''}`}>
      <div className="row">
        <div>
          <h3>{s.subject_name}</h3>
          <small className="muted">{s.subject_code} | {s.faculty_name || 'Faculty not assigned'}</small>
        </div>
        <span className="spacer" />
        <Badge status={s.status} />
      </div>
      <div className="row">
        <span className="percent" style={{ color: `var(--${attendanceTone(s.percentage)})` }}>{s.percentage}%</span>
        {s.is_low && <small className="field-error"><AlertTriangle size={14} /> Below the {minimum}% minimum</small>}
      </div>
      <ProgressBar value={s.percentage} label={`${s.subject_name} attendance`} />
      <div className="counts"><span>Total classes: <strong>{s.total_classes}</strong></span><span>Attended: <strong>{s.classes_attended}</strong></span><span>Absent: <strong>{s.classes_absent}</strong></span></div>
    </article>
  );
}
