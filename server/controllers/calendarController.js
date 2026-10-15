// Academic calendar: everyone reads, admin and faculty add/edit/delete.
const { makeCrud } = require('../utils/crud');
const AppError = require('../utils/AppError');
const { toDate } = require('../utils/validators');

module.exports = makeCrud({
  table: 'academic_calendar', label: 'Event',
  fields: ['title', 'description', 'event_type', 'start_date', 'end_date'],
  required: ['title', 'event_type', 'start_date'],
  searchFields: ['t.title', 't.description'],
  filters: { event_type: 't.event_type' },
  orderBy: 't.start_date ASC', maxLimit: 500,
  autoFields: (req) => ({ created_by: req.user.id }),
  beforeSave: async (data, req, existing) => {
    if (data.start_date) toDate(data.start_date, 'start_date');
    if (data.end_date) toDate(data.end_date, 'end_date');
    if (!existing && !data.end_date) data.end_date = data.start_date;   // one-day event
    const start = data.start_date || (existing && existing.start_date);
    const end = data.end_date || (existing && existing.end_date);
    if (start && end && end < start) throw new AppError('end_date cannot be before start_date.', 400);
  },
  // ?month=2026-10  or  ?from=2026-10-01&to=2026-10-31  -> events that overlap that period
  extraFilter: (req, where, params) => {
    let { from, to } = req.query;
    if (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)) {
      const [y, m] = req.query.month.split('-').map(Number);
      from = `${req.query.month}-01`;
      to = `${req.query.month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    }
    if (from && to) { where.push('t.start_date <= ? AND t.end_date >= ?'); params.push(to, from); }
  },
});
