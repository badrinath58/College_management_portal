import { Link } from 'react-router-dom';
import { BedDouble, Building2, ClipboardCheck, FileText, GraduationCap, Library, UserCog, Users, Wallet, BookOpen } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DashboardCard from '../components/DashboardCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Badge from '../components/Badge';
import ProgressBar from '../components/ProgressBar';
import { BarChartBox, ChartCard, COLORS, PieChartBox } from '../components/charts';
import useFetch from '../hooks/useFetch';
import { http } from '../services/api';
import { attendanceTone, formatCurrency, formatPercent } from '../utils/format';

const STATUS_COLOR = { paid: COLORS.success, partial: COLORS.info, pending: COLORS.warning, overdue: COLORS.danger };

const QUICK = [
  { to: '/admin/students', label: 'Students', icon: Users },
  { to: '/admin/faculty', label: 'Faculty', icon: UserCog },
  { to: '/fees', label: 'Fees', icon: Wallet },
  { to: '/exams', label: 'Exams', icon: FileText },
  { to: '/hostel', label: 'Hostel', icon: BedDouble },
  { to: '/admin/library', label: 'Library', icon: Library },
];

export default function AdminDashboard() {
  const { data, loading, error, reload } = useFetch(() => http.get('/dashboard/admin'), []);
  if (loading) return <LoadingSpinner fullPage label="Loading the admin dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { totals, hostel, payments, attendance, charts } = data;
  return (
    <>
      <PageHeader title="Admin Dashboard" subtitle="Overview of the whole college." />
      <div className="stack">
        <div className="grid cols-4">
          <DashboardCard title="Total students" value={totals.students} icon={Users} to="/admin/students" />
          <DashboardCard title="Total faculty" value={totals.faculty} icon={UserCog} tone="info" to="/admin/faculty" />
          <DashboardCard title="Total courses" value={totals.courses} icon={GraduationCap} tone="success" to="/admin/academics" />
          <DashboardCard title="Departments" value={totals.departments} icon={Building2} tone="info" to="/admin/academics" />
          <DashboardCard title="Books in library" value={totals.books} icon={BookOpen} to="/books" />
          <DashboardCard title="Upcoming exams" value={totals.upcoming_exams} icon={FileText} tone="warning" to="/exams" />
          <DashboardCard title="Hostel occupancy" value={formatPercent(hostel.occupancy_percent)} icon={BedDouble}
            hint={`${hostel.occupied} of ${hostel.capacity} beds | ${hostel.pending_requests} request(s) waiting`} to="/hostel" />
          <DashboardCard title="Pending payments" value={formatCurrency(payments.pending)} icon={Wallet} tone={payments.pending > 0 ? 'danger' : 'success'}
            hint={`${payments.students_with_dues} student(s) with dues`} to="/fees" />
        </div>

        <div className="grid cols-2">
          <ChartCard title="Attendance by department (%)" empty={!attendance.by_department.length && 'No attendance recorded yet'}>
            <BarChartBox data={attendance.by_department} xKey="department" bars={[{ key: 'percentage', name: 'Attendance %' }]} domain={[0, 100]} colorBy={(r) => COLORS[attendanceTone(r.percentage)]} />
          </ChartCard>
          <ChartCard title="Fee items by status" empty={!charts.fee_status.length && 'No fees have been added yet'}>
            <PieChartBox data={charts.fee_status.map((s) => ({ name: s.status, value: s.count, color: STATUS_COLOR[s.status] || COLORS.primary }))} />
          </ChartCard>
        </div>

        <div className="grid cols-2">
          <section className="card">
            <div className="card-header">Attendance statistics <Link to="/attendance">Details</Link></div>
            <div className="card-body stack">
              <div className="row">
                <span>College average</span><strong>{formatPercent(attendance.average_percent)}</strong>
                <span className="spacer" />
                <Badge tone={attendance.students_below_75 > 0 ? 'danger' : 'success'}>{attendance.students_below_75} student(s) below 75%</Badge>
              </div>
              {attendance.by_department.length === 0 ? <EmptyState title="No attendance recorded yet" /> : attendance.by_department.map((d) => (
                <div key={d.department}>
                  <div className="row" style={{ justifyContent: 'space-between' }}><span>{d.department}</span><strong>{formatPercent(d.percentage)}</strong></div>
                  <ProgressBar value={d.percentage} label={`${d.department} attendance`} />
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-header">Fee collection <Link to="/fees">Details</Link></div>
            <div className="card-body stack">
              <div className="row"><span>Billed</span><strong>{formatCurrency(payments.total_billed)}</strong><span className="spacer" /><span>Collected</span><strong>{formatCurrency(payments.collected)}</strong></div>
              <ProgressBar tone="success" value={payments.total_billed ? (100 * payments.collected) / payments.total_billed : 0} label="Fees collected" />
              <ul className="list-plain">
                {charts.fee_status.map((s) => <li key={s.status}><Badge status={s.status} /><span>{s.count} fee item(s) | {formatCurrency(s.pending_amount)} pending</span></li>)}
              </ul>
            </div>
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
