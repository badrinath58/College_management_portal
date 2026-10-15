// Student dashboard: one API call (/dashboard/student) fills the whole page.
// The charts use the data in `data.charts`.
import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, CreditCard, FileText, GraduationCap, Library, Table, Ticket, Wallet, BarChart3, BedDouble } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DashboardCard from '../components/DashboardCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import { BarChartBox, ChartCard, COLORS, LineChartBox, PieChartBox } from '../components/charts';
import useFetch from '../hooks/useFetch';
import { http } from '../services/api';
import { attendanceTone, formatCurrency, formatDate, formatDateTime, formatTime } from '../utils/format';

const QUICK = [
  { to: '/payment', label: 'Pay fees', icon: CreditCard },
  { to: '/hall-ticket', label: 'Hall ticket', icon: Ticket },
  { to: '/timetable', label: 'Time table', icon: Table },
  { to: '/marks', label: 'Marks', icon: BarChart3 },
  { to: '/library', label: 'Library books', icon: Library },
  { to: '/hostel', label: 'Hostel booking', icon: BedDouble },
];

export default function StudentDashboard() {
  const { data, loading, error, reload } = useFetch(() => http.get('/dashboard/student'), []);
  if (loading) return <LoadingSpinner fullPage label="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { profile, attendance, cgpa, pending_fees: pending, upcoming_exams: exams, recent_marks: marks, notifications } = data;
  const pct = attendance.overall.percentage;
  const charts = data.charts;
  const semesterData = charts.semester_marks.map((s) => ({ label: `Sem ${s.semester_no}`, sgpa: s.sgpa, cgpa: s.cgpa }));
  const feeData = [{ name: 'Paid', value: charts.fee_status.paid, color: COLORS.success }, { name: 'Pending', value: charts.fee_status.pending, color: COLORS.warning }].filter((d) => d.value > 0);

  return (
    <>
      <PageHeader title={`Welcome, ${profile.full_name.split(' ')[0]}`} subtitle="Here is a summary of your academic status." />
      <div className="stack">
        <div className="card card-body profile-head">
          <Avatar name={profile.full_name} src={profile.photo_url} size={84} />
          <div>
            <h2>{profile.full_name}</h2>
            <dl className="kv" style={{ marginTop: 8 }}>
              <dt>Student ID</dt><dd>{profile.student_code}</dd>
              <dt>Department</dt><dd>{profile.department}</dd>
              <dt>Course</dt><dd>{profile.course}</dd>
              <dt>Year / Semester</dt><dd>Year {profile.current_year} / Semester {profile.semester ?? '-'} ({profile.academic_year ?? '-'})</dd>
            </dl>
          </div>
        </div>

        <div className="grid cols-4">
          <DashboardCard title="Attendance" value={`${pct}%`} icon={ClipboardCheck} tone={attendanceTone(pct)}
            hint={pct >= 75 ? 'Above the 75% minimum' : 'Below the 75% minimum'} to="/attendance" />
          <DashboardCard title="Current CGPA" value={cgpa ?? '-'} icon={GraduationCap} tone="info" hint="From published grade cards" to="/grade-card" />
          <DashboardCard title="Pending fees" value={formatCurrency(pending)} icon={Wallet} tone={pending > 0 ? 'warning' : 'success'}
            hint={pending > 0 ? 'Pay online' : 'All fees paid'} to="/fees" />
          <DashboardCard title="Current semester" value={profile.semester ?? '-'} icon={CalendarDays} hint={profile.academic_year} to="/calendar" />
        </div>

        <div className="grid cols-2">
          <ChartCard title="Attendance by subject (%)" empty={!charts.attendance.length && 'No attendance recorded yet'}>
            <BarChartBox data={charts.attendance} xKey="subject" bars={[{ key: 'percentage', name: 'Attendance %' }]} domain={[0, 100]} colorBy={(r) => COLORS[attendanceTone(r.percentage)]} />
          </ChartCard>
          <ChartCard title="SGPA and CGPA by semester" empty={!semesterData.length && 'No published grade cards yet'}>
            <LineChartBox data={semesterData} xKey="label" domain={[0, 10]} lines={[{ key: 'sgpa', name: 'SGPA' }, { key: 'cgpa', name: 'CGPA', color: COLORS.success }]} />
          </ChartCard>
          <ChartCard title="Fee payment status" empty={!feeData.length && 'No fees have been added yet'}>
            <PieChartBox data={feeData} />
          </ChartCard>
          <ChartCard title="Subject performance (current semester)" empty={!charts.subject_performance.length && 'No marks entered yet'}>
            <BarChartBox data={charts.subject_performance} xKey="subject_code" bars={[{ key: 'total_marks', name: 'Total marks' }]} />
          </ChartCard>
        </div>

        <div className="grid cols-2">
          <section className="card">
            <div className="card-header">Upcoming exams <Link to="/exams">View all</Link></div>
            {exams.length === 0 ? <EmptyState title="No upcoming exams" /> : (
              <ul className="list-plain">
                {exams.map((e, i) => (
                  <li key={i}>
                    <span><strong>{e.subject_code}</strong> {e.subject_name}<br /><small className="muted">{e.exam_name} | {formatTime(e.start_time)} | {e.room_number || 'Room to be announced'}</small></span>
                    <Badge tone="info">{formatDate(e.exam_date)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card-header">Recent marks <Link to="/marks">View all</Link></div>
            {marks.length === 0 ? <EmptyState title="No marks yet" /> : (
              <ul className="list-plain">
                {marks.map((m, i) => (
                  <li key={i}>
                    <span><strong>{m.subject_code}</strong> {m.subject_name}</span>
                    <span className="row">{m.total_marks}<Badge status={m.result} /></span>
                  </li>
                ))}
              </ul>
            )}
          </section>


          <section className="card">
            <div className="card-header">Notifications {notifications.unread > 0 && <Badge tone="danger">{notifications.unread} new</Badge>}</div>
            {notifications.latest.length === 0 ? <EmptyState title="No notifications" /> : (
              <ul className="list-plain">
                {notifications.latest.map((n) => (
                  <li key={n.id}>
                    <span><strong>{n.title}</strong><br /><small className="muted">{n.message}</small></span>
                    <small className="muted">{formatDateTime(n.created_at)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

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
