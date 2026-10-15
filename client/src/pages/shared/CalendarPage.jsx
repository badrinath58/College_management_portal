// Academic Calendar. Everyone can read it; faculty and admin can add, edit and delete events.
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Calendar from '../../components/Calendar';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Select from '../../components/Select';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import ErrorState from '../../components/ErrorState';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { http } from '../../services/api';
import { EVENT_TYPES, monthKey } from '../../utils/calendar';
import { formatDate, humanize } from '../../utils/format';

const EMPTY = { title: '', event_type: 'event', start_date: '', end_date: '', description: '' };
const TYPE_TONE = { holiday: 'danger', exam: 'warning', assignment: 'info', semester_start: 'success', semester_end: 'success', event: 'neutral' };

export default function CalendarPage() {
  const toast = useToast();
  const { role } = useAuth();
  const canEdit = role === 'admin' || role === 'faculty';
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const key = monthKey(view.year, view.month);
  const { data, loading, error, reload } = useFetch(() => http.get('/calendar', { month: key, limit: 500 }), [key]);
  const events = data?.items || [];

  const [selected, setSelected] = useState(null);       // event shown in the details popup
  const [form, setForm] = useState(null);               // null = closed, else { id?, ...fields }
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const move = (delta) => setView(({ year, month }) => { const d = new Date(year, month + delta, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const change = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function openForm(event) {
    setFormError('');
    setSelected(null);
    setForm(event ? { id: event.id, title: event.title, event_type: event.event_type, start_date: event.start_date, end_date: event.end_date, description: event.description || '' } : { ...EMPTY });
  }

  async function save(e) {
    e.preventDefault();
    if (!form.title.trim()) return setFormError('Please enter a title.');
    if (!form.start_date) return setFormError('Please choose a start date.');
    if (form.end_date && form.end_date < form.start_date) return setFormError('The end date cannot be before the start date.');
    setSaving(true);
    setFormError('');
    const body = { title: form.title.trim(), event_type: form.event_type, start_date: form.start_date, end_date: form.end_date || form.start_date, description: form.description };
    try {
      const res = form.id ? await http.put(`/calendar/${form.id}`, body) : await http.post('/calendar', body);
      toast.success(res.message);
      setForm(null);
      reload();
    } catch (err) { setFormError(err.message); } finally { setSaving(false); }
  }

  async function remove() {
    try { const res = await http.delete(`/calendar/${deleteTarget.id}`); toast.success(res.message); reload(); }
    catch (err) { toast.error(err.message); } finally { setDeleteTarget(null); }
  }

  return (
    <>
      <PageHeader title="Academic Calendar" subtitle="Holidays, exams, assignments and semester dates."
        actions={canEdit && <Button icon={<Plus size={17} />} onClick={() => openForm(null)}>Add event</Button>} />
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="stack">
          <div className="card" style={{ opacity: loading ? 0.7 : 1 }}>
            <Calendar year={view.year} month={view.month} events={events} onPrev={() => move(-1)} onNext={() => move(1)}
              onToday={() => setView({ year: now.getFullYear(), month: now.getMonth() })} onEventClick={setSelected} />
            <div className="legend">
              {EVENT_TYPES.map((t) => <Badge key={t.value} tone={TYPE_TONE[t.value]}>{t.label}</Badge>)}
            </div>
          </div>
          <section className="card">
            <div className="card-header">Events this month</div>
            {events.length === 0 ? <p className="card-body muted">No events this month.</p> : (
              <ul className="list-plain">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <span><strong>{ev.title}</strong><br /><small className="muted">{formatDate(ev.start_date)}{ev.end_date !== ev.start_date ? ` to ${formatDate(ev.end_date)}` : ''}</small></span>
                    <Badge tone={TYPE_TONE[ev.event_type]}>{humanize(ev.event_type)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <Modal open={Boolean(selected)} title={selected?.title || ''} onClose={() => setSelected(null)}
        footer={<>
          {canEdit && selected && <><Button variant="danger" icon={<Trash2 size={16} />} onClick={() => { setDeleteTarget(selected); setSelected(null); }}>Delete</Button>
            <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => openForm(selected)}>Edit</Button></>}
          <Button onClick={() => setSelected(null)}>Close</Button></>}>
        {selected && (
          <dl className="kv">
            <dt>Type</dt><dd><Badge tone={TYPE_TONE[selected.event_type]}>{humanize(selected.event_type)}</Badge></dd>
            <dt>From</dt><dd>{formatDate(selected.start_date)}</dd>
            <dt>To</dt><dd>{formatDate(selected.end_date)}</dd>
            <dt>Details</dt><dd style={{ fontWeight: 400 }}>{selected.description || 'No more details.'}</dd>
          </dl>
        )}
      </Modal>

      <Modal open={Boolean(form)} title={form?.id ? 'Edit event' : 'Add event'} onClose={() => !saving && setForm(null)}
        footer={<><Button variant="secondary" onClick={() => setForm(null)} disabled={saving}>Cancel</Button><Button type="submit" form="event-form" loading={saving}>Save event</Button></>}>
        {form && (
          <form id="event-form" className="form-grid" onSubmit={save} noValidate>
            {formError && <div className="full"><Alert type="error">{formError}</Alert></div>}
            <div className="full"><Input label="Title" value={form.title} onChange={change('title')} required maxLength={150} /></div>
            <Select label="Type" value={form.event_type} onChange={change('event_type')} options={EVENT_TYPES} />
            <span />
            <Input label="Start date" type="date" value={form.start_date} onChange={change('start_date')} required />
            <Input label="End date" type="date" value={form.end_date} onChange={change('end_date')} hint="Leave empty for a one-day event" />
            <div className="full"><Input label="Description" as="textarea" rows={3} value={form.description} onChange={change('description')} /></div>
          </form>
        )}
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} danger title="Delete this event?" confirmText="Delete" onConfirm={remove} onCancel={() => setDeleteTarget(null)}
        message={deleteTarget ? `"${deleteTarget.title}" will be removed from the calendar for everyone.` : ''} />
    </>
  );
}
