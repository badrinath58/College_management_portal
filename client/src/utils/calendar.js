// Month grid maths for the academic calendar (pure functions, easy to test).
const pad = (n) => String(n).padStart(2, '0');
export const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;   // m = 0..11

// Weeks of the month. Each cell is { day, date: 'YYYY-MM-DD' } or null (empty cell before/after the month). Week starts on Sunday.
export function buildMonthGrid(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: toISO(year, month, d) });
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// events that cover a given day (multi-day events appear on every day they cover)
export const eventsOnDay = (events, date) => events.filter((e) => e.start_date <= date && e.end_date >= date);

export const monthLabel = (year, month) => new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
export const monthKey = (year, month) => `${year}-${pad(month + 1)}`;

export const EVENT_TYPES = [
  { value: 'event', label: 'Event' }, { value: 'holiday', label: 'Holiday' }, { value: 'exam', label: 'Examination' },
  { value: 'assignment', label: 'Assignment' }, { value: 'semester_start', label: 'Semester start' }, { value: 'semester_end', label: 'Semester end' },
];
