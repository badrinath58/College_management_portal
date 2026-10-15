// A number with an icon:  <DashboardCard title="Attendance" value="87%" icon={ClipboardCheck} tone="success" hint="Above 75%" to="/attendance" />
import { Link } from 'react-router-dom';

export default function DashboardCard({ title, value, icon: Icon, tone = '', hint, to, loading }) {
  const body = (
    <>
      {Icon && <div className={`stat-icon ${tone}`}><Icon size={24} aria-hidden="true" /></div>}
      <div>
        <div className="stat-label">{title}</div>
        <div className="stat-value">{loading ? '...' : value ?? '-'}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </>
  );
  return to ? <Link to={to} className="stat-card">{body}</Link> : <div className="stat-card">{body}</div>;
}
