// Small helpers to show data nicely. They never throw: bad input becomes "-".
export function formatDate(value) {
  if (!value) return '-';
  const d = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// "09:30:00" -> "09:30"
export const formatTime = (value) => (value ? String(value).slice(0, 5) : '-');

export function formatCurrency(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-';
}

export const formatPercent = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '-' : `${Number(v).toFixed(1)}%`);

// "net_banking" -> "Net banking"
export function humanize(text) {
  if (!text) return '-';
  const s = String(text).replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

// status word -> colour of the Badge
const GOOD = ['paid', 'present', 'approved', 'success', 'pass', 'evaluated', 'completed', 'generated', 'cleared', 'good', 'returned', 'issued', 'active'];
const WARN = ['pending', 'partial', 'scheduled', 'upcoming', 'planned', 'in_progress', 'low', 'ongoing', 'initiated', 'late'];
const BAD = ['overdue', 'failed', 'rejected', 'blocked', 'fail', 'critical', 'absent', 'lost', 'revaluation_requested'];
export function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (GOOD.includes(s)) return 'success';
  if (WARN.includes(s)) return 'warning';
  if (BAD.includes(s)) return 'danger';
  return 'neutral';
}

// attendance colour: 75%+ good, 65-74 warning, below 65 danger
export const attendanceTone = (pct) => (pct >= 75 ? 'success' : pct >= 65 ? 'warning' : 'danger');

// "uploads/profile-photos/abc.jpg" -> "/api/files/profile-photos/abc.jpg"  (the protected file route; use <AuthImage>)
export function fileUrl(relativePath) {
  if (!relativePath) return null;
  const parts = String(relativePath).split('/');
  return `/api/files/${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

// today as YYYY-MM-DD in the user's own time zone (what a <input type="date"> expects)
export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
