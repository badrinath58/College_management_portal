// Admin timetable builder: create versions, edit their weekly classes, activate / deactivate, delete.
import { useEffect, useState } from 'react';
import { Eye, Grid3x3, Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Button from '../../components/Button';
import PdfButton from '../../components/PdfButton';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Select from '../../components/Select';
import Alert from '../../components/Alert';
import Timetable from '../../components/Timetable';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../hooks/useToast';
import { http } from '../../services/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => ({ value: d, label: d }));
const NEW_FIELDS = [
  { name: 'semester_id', label: 'Semester', type: 'select', required: true, optionsUrl: '/semesters', optionsParams: { limit: 100 }, optionLabel: (s) => `${s.course_name} - Semester ${s.semester_no} (${s.academic_year})` },
  { name: 'section', label: 'Section', required: true, maxLength: 1, hint: 'A, B, C...' },
  { name: 'version_label', label: 'Version name', required: true, maxLength: 60, hint: 'For example: Regular, Revised - lab on Friday' },
  { name: 'is_active', label: 'Available to students', type: 'checkbox' },
];
const EMPTY_SLOT = { day_of_week: 'Monday', start_time: '09:00', end_time: '09:50', subject_id: '', room_number: '' };

// check the rows and turn them into what the API wants
export function slotsPayload(slots) {
  const seen = new Set();
  return slots.map((s) => {
    if (!s.subject_id || !s.room_number.trim()) throw new Error('Every class needs a subject and a room.');
    if (s.end_time <= s.start_time) throw new Error(`On ${s.day_of_week}, a class must end after it starts.`);
    const key = `${s.day_of_week}-${s.start_time}`;
    if (seen.has(key)) throw new Error(`Two classes start at ${s.start_time} on ${s.day_of_week}.`);
    seen.add(key);
    return { day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, subject_id: Number(s.subject_id), room_number: s.room_number.trim() };
  });
}

function SlotEditor({ version, onClose, onSaved }) {
  const toast = useToast();
  const tt = useFetch(() => http.get('/timetable', { timetable_id: version.id }), [version.id]);
  const subjects = useFetch(() => http.get('/subjects', { semester_id: version.semester_id, limit: 100 }), [version.semester_id]);
  const [slots, setSlots] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (tt.data) setSlots(tt.data.slots.map((s) => ({ day_of_week: s.day_of_week, start_time: String(s.start_time).slice(0, 5), end_time: String(s.end_time).slice(0, 5), subject_id: String(s.subject_id), room_number: s.room_number })));
  }, [tt.data]);
  const change = (i, field, value) => setSlots((list) => list.map((s, n) => (n === i ? { ...s, [field]: value } : s)));

  async function save() {
    setError('');
    let payload;
    try { payload = slotsPayload(slots); } catch (err) { return setError(err.message); }
    setSaving(true);
    try { const res = await http.put(`/timetable/${version.id}/slots`, { slots: payload }); toast.success(`${res.message}. Students were notified.`); onSaved(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <Modal open size="lg" title={`Classes - ${version.version_label} (Section ${version.section})`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={saving} disabled={!slots} onClick={save}>Save timetable</Button></>}>
      {(tt.loading || subjects.loading) && !slots && <LoadingSpinner label="Loading..." />}
      {tt.error && <ErrorState message={tt.error} onRetry={tt.reload} />}
      {error && <Alert type="error">{error}</Alert>}
      {slots && (
        <>
          {slots.length === 0 && <p className="muted">No classes yet. Add the first one.</p>}
          {slots.map((s, i) => (
            <div className="editor-row" key={i}>
              <Select label="Day" value={s.day_of_week} options={DAYS} onChange={(e) => change(i, 'day_of_week', e.target.value)} />
              <Input label="Start" type="time" value={s.start_time} onChange={(e) => change(i, 'start_time', e.target.value)} />
              <Input label="End" type="time" value={s.end_time} onChange={(e) => change(i, 'end_time', e.target.value)} />
              <Select label="Subject" value={s.subject_id} placeholder="Choose" onChange={(e) => change(i, 'subject_id', e.target.value)} options={(subjects.data?.items || []).map((x) => ({ value: String(x.id), label: `${x.code} - ${x.name}` }))} />
              <Input label="Room" value={s.room_number} onChange={(e) => change(i, 'room_number', e.target.value)} />
              <Button size="sm" variant="danger" onClick={() => setSlots((list) => list.filter((_, n) => n !== i))}>Remove</Button>
            </div>
          ))}
          <div style={{ marginTop: 10 }}><Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={() => setSlots((list) => [...list, { ...EMPTY_SLOT }])}>Add class</Button></div>
        </>
      )}
    </Modal>
  );
}

function Preview({ version, onClose }) {
  const { data, loading, error, reload } = useFetch(() => http.get('/timetable', { timetable_id: version.id }), [version.id]);
  return (
    <Modal open size="lg" title={`${version.version_label} - Section ${version.section}`} onClose={onClose}
      footer={<><PdfButton variant="secondary" url="/timetable/pdf" params={{ timetable_id: version.id }} filename="timetable.pdf" disabled={!data || !data.slots.length}>Download PDF</PdfButton><Button onClick={onClose}>Close</Button></>}>
      {loading && !data && <LoadingSpinner label="Loading..." />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.slots.length ? <Timetable slots={data.slots} /> : <EmptyState title="No classes added yet" />)}
    </Modal>
  );
}

export default function TimetableAdmin() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => http.get('/timetable/versions', { include_inactive: 'true' }), []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function create(values) {
    const res = await http.post('/timetable', { ...values, is_active: Boolean(values.is_active) });
    toast.success(res.message); setCreating(false); await reload(); setEditing(res.data.timetable);
  }
  async function toggle(v) {
    try { const res = await http.put(`/timetable/${v.id}`, { is_active: v.is_active ? 0 : 1 }); toast.success(res.message); reload(); } catch (err) { toast.error(err.message); }
  }
  async function remove() {
    try { const res = await http.delete(`/timetable/${deleteTarget.id}`); toast.success(res.message); reload(); }
    catch (err) { toast.error(err.message); } finally { setDeleteTarget(null); }
  }

  const columns = [
    { key: 'course', header: 'Course', render: (v) => <span><strong>{v.course}</strong><br /><small className="muted">Semester {v.semester_no} | {v.academic_year}</small></span> },
    { key: 'section', header: 'Section' },
    { key: 'version_label', header: 'Version' },
    { key: 'slot_count', header: 'Classes / week', numeric: true },
    { key: 'is_active', header: 'Students can choose it', render: (v) => <Badge tone={v.is_active ? 'success' : 'neutral'}>{v.is_active ? 'Yes' : 'Hidden'}</Badge> },
    { key: 'id', header: '', render: (v) => (
      <span className="actions-cell">
        <Button size="sm" icon={<Grid3x3 size={14} />} onClick={() => setEditing(v)}>Edit classes</Button>
        <Button size="sm" variant="secondary" icon={<Eye size={14} />} onClick={() => setPreview(v)}>Preview</Button>
        <Button size="sm" variant="secondary" onClick={() => toggle(v)}>{v.is_active ? 'Hide' : 'Show'}</Button>
        <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setDeleteTarget(v)}>Delete</Button>
      </span>) },
  ];
  return (
    <>
      <PageHeader title="Timetables" subtitle="Build weekly timetables. Students choose between the versions you show."
        actions={<Button icon={<Plus size={17} />} onClick={() => setCreating(true)}>New timetable</Button>} />
      <div className="card"><DataTable columns={columns} rows={data || []} loading={loading} error={error} onRetry={reload} emptyTitle="No timetables yet" emptyMessage="Create the first version for a semester and section." /></div>
      <FormModal open={creating} title="New timetable version" fields={NEW_FIELDS} initial={{ is_active: true }} submitLabel="Create and add classes" onSubmit={create} onClose={() => setCreating(false)} />
      {editing && <SlotEditor version={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {preview && <Preview version={preview} onClose={() => setPreview(null)} />}
      <ConfirmDialog open={Boolean(deleteTarget)} danger title="Delete this timetable?" confirmText="Delete" onConfirm={remove} onCancel={() => setDeleteTarget(null)}
        message={deleteTarget ? `"${deleteTarget.version_label}" (Section ${deleteTarget.section}) and all its classes will be deleted. Students who chose it will have no selection.` : ''} />
    </>
  );
}
