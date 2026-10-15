// Attendance: one card per subject with a progress bar. Subjects below 75% are highlighted.
import PageHeader from '../../components/PageHeader';
import AttendanceCard from '../../components/AttendanceCard';
import DashboardCard from '../../components/DashboardCard';
import Alert from '../../components/Alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import useFetch from '../../hooks/useFetch';
import { http } from '../../services/api';
import { ClipboardCheck, CheckCircle2, XCircle } from 'lucide-react';
import { attendanceTone } from '../../utils/format';

export default function StudentAttendance() {
  const { data, loading, error, reload } = useFetch(() => http.get('/attendance'), []);
  if (loading) return <LoadingSpinner fullPage label="Loading attendance..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const low = data.subjects.filter((s) => s.is_low);
  const o = data.overall;
  return (
    <>
      <PageHeader title="Attendance" subtitle="Your attendance in each subject this semester." />
      <div className="stack">
        {low.length > 0 && (
          <Alert type="error" title="Low attendance!">
            {low.map((s) => `${s.subject_name} (${s.percentage}%)`).join(', ')} {low.length === 1 ? 'is' : 'are'} below the {data.minimum_percent}% minimum. You may not be allowed to sit the exam.
          </Alert>
        )}
        <div className="grid cols-3">
          <DashboardCard title="Overall attendance" value={`${o.percentage}%`} icon={ClipboardCheck} tone={attendanceTone(o.percentage)} hint={o.status} />
          <DashboardCard title="Classes attended" value={o.classes_attended} icon={CheckCircle2} tone="success" hint={`out of ${o.total_classes} classes`} />
          <DashboardCard title="Classes missed" value={o.total_classes - o.classes_attended} icon={XCircle} tone="danger" />
        </div>
        {data.subjects.length === 0
          ? <div className="card"><EmptyState title="No attendance recorded yet" message="Your faculty will mark attendance once classes begin." /></div>
          : <div className="grid cols-3">{data.subjects.map((s) => <AttendanceCard key={s.subject_id} subject={s} minimum={data.minimum_percent} />)}</div>}
      </div>
    </>
  );
}
