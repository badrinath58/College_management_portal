import { Link } from 'react-router-dom';
import { BarChart3, BookOpen, ClipboardCheck, FileCheck, Table } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DashboardCard from '../components/DashboardCard';
import DataTable from '../components/DataTable';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Badge from '../components/Badge';
import useFetch from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { http } from '../services/api';
import { formatDate, formatTime } from '../utils/format';

const QUICK = [
  { to: '/attendance', label: 'Mark attendance', icon: ClipboardCheck },
  { to: '/marks', label: 'Enter marks', icon: BarChart3 },
  { to: '/lesson-plans', label: 'Lesson plans', icon: BookOpen },
  { to: '/answer-sheets', label: 'Answer sheets', icon: FileCheck },
  { to: '/timetable', label: 'My timetable', icon: Table },
];
const SUBJECT_COLUMNS = [
  { key: 'code', header: 'Code' },
  { key: 'name', header: 'Subject' },
  { key: 'semester_no', header: 'Semester', numeric: true },
  { key: 'student_count', header: 'Students', numeric: true },
];

export default function FacultyDashboard() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useFetch(() => http.get('/dashboard/faculty'), []);
  if (loading) return <LoadingSpinner fullPage label="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title={`Welcome, ${profile?.full_name || 'Faculty'}`} subtitle="Your classes and tasks at a glance." />
      <div className="stack">
        <div className="grid cols-4">
          <DashboardCard title="Assigned subjects" value={data.subjects.length} icon={BookOpen} />
          <DashboardCard title="Classes today" value={data.today_classes.length} icon={Table} tone="info" to="/timetable" />
          <DashboardCard title="Attendance sessions (7 days)" value={data.attendance_sessions_last_7_days} icon={ClipboardCheck} tone="success" to="/attendance" />
          <DashboardCard title="Unreleased answer sheets" value={data.unreleased_answer_sheets} icon={FileCheck}
            tone={data.unreleased_answer_sheets > 0 ? 'warning' : 'success'} to="/answer-sheets" />
        </div>

        <div className="grid cols-2">
          <section className="card">
            <div className="card-header">Today's classes</div>
            {data.today_classes.length === 0 ? <EmptyState title="No classes today" /> : (
              <ul className="list-plain">
                {data.today_classes.map((c, i) => (
                  <li key={i}><span><strong>{c.subject_code}</strong> {c.subject_name}<br /><small className="muted">Section {c.section} | {c.room_number}</small></span>
                    <Badge tone="info">{formatTime(c.start_time)} - {formatTime(c.end_time)}</Badge></li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <div className="card-header">Lesson plan progress <Link to="/lesson-plans">Manage</Link></div>
            {data.lesson_plan_status.length === 0 ? <EmptyState title="No lesson plans yet" /> : (
              <ul className="list-plain">
                {data.lesson_plan_status.map((s) => <li key={s.status}><Badge status={s.status} /><strong>{s.count}</strong></li>)}
              </ul>
            )}
          </section>
        </div>

        <section className="card">
          <div className="card-header">My subjects</div>
          <DataTable columns={SUBJECT_COLUMNS} rows={data.subjects} emptyTitle="No subjects assigned" emptyMessage="Ask the administrator to assign subjects to you." />
        </section>

        <section className="card">
          <div className="card-header">Upcoming exams</div>
          {data.upcoming_exams.length === 0 ? <EmptyState title="No upcoming exams" /> : (
            <ul className="list-plain">{data.upcoming_exams.map((e) => <li key={e.id}><strong>{e.name}</strong><span className="muted">{formatDate(e.start_date)} to {formatDate(e.end_date)}</span></li>)}</ul>
          )}
        </section>

        <section className="card">
          <div className="card-header">Quick actions</div>
          <div className="card-body quick-actions">
            {QUICK.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className="quick-action"><Icon size={22} />{label}</Link>)}
          </div>
        </section>
      </div>
    </>
  );
}
