// Small wrappers around Recharts (free, open source) so every chart looks the same.
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import EmptyState from './EmptyState';

export const COLORS = { primary: '#4a69e8', success: '#16a34a', warning: '#d97706', danger: '#dc2626', info: '#0ea5e9' };

// Card with a title around a chart. Shows an empty message when there is no data.
export function ChartCard({ title, empty, children }) {
  return (
    <section className="card chart-card">
      <div className="card-header">{title}</div>
      <div className="card-body">{empty ? <EmptyState title={empty} /> : <div className="chart-box">{children}</div>}</div>
    </section>
  );
}

// bars = [{ key: 'percentage', name: 'Attendance %', color }]; colorBy(row) can colour each bar separately
export function BarChartBox({ data, xKey, bars, domain, colorBy }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} />
        <YAxis domain={domain} allowDecimals={false} tickLine={false} />
        <Tooltip />
        {bars.length > 1 && <Legend />}
        {bars.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color || COLORS.primary} radius={[4, 4, 0, 0]}>
            {colorBy && data.map((row, i) => <Cell key={i} fill={colorBy(row)} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineChartBox({ data, xKey, lines, domain }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} />
        <YAxis domain={domain} tickLine={false} />
        <Tooltip />
        <Legend />
        {lines.map((l) => <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color || COLORS.primary} strokeWidth={2.5} dot={{ r: 4 }} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

// data = [{ name: 'Paid', value: 4500, color: '#16a34a' }]
export function PieChartBox({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
          {data.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
