// Manage exams (faculty + admin): create / edit an exam with its papers. Admin can also delete exams and generate hall tickets.
import { useState } from 'react';
import { Pencil, Plus, Ticket, Trash2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Tabs from '../../components/Tabs';
import ExamCard from '../../components/ExamCard';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Select from '../../components/Select';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import useList from '../../hooks/useList';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { http } from '../../services/api';

const EXAM_FIELDS = [
  { name: 'name', label: 'Exam name', required: true, full: true, maxLength: 150 },
  { name: 'exam_type', label: 'Type', type: 'select', required: true, options: ['mid', 'internal', 'semester', 'supplementary', 'practical'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
  { name: 'semester_id', label: 'Semester', type: 'select', required: true, disabledOnEdit: true, optionsUrl: '/semesters', optionsParams: { limit: 100 },
    optionLabel: (s) => `${s.course_name} - Semester ${s.semester_no} (${s.academic_year})` },
  { name: 'start_date', label: 'Start date', type: 'date', required: true },
  { name: 'end_date', label: 'End date', type: 'date', required: true },
  { name: 'exam_center', label: 'Exam centre' },
  { name: 'status', label: 'Status', type: 'select', editOnly: true, options: ['scheduled', 'ongoing', 'completed', 'cancelled'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
  { name: 'instructions', label: 'Instructions for students', type: 'textarea', full: true },
];
const EMPTY_PAPER = { subject_id: '', exam_date: '', start_time: '10:00', end_time: '13:00', room_number: '', max_marks: '60' };

// the list of papers (subject, date, time, room, marks) inside the exam form
export function PapersEditor({ semesterId, papers, setPapers }) {
  const { data } = useFetch(() => (semesterId ? http.get('/subjects', { semester_id: semesterId, limit: 100 }) : Promise.resolve({ data: null })), [semesterId]);
  const subjects = data?.items || [];
  const change = (i, field, value) => setPapers((list) => list.map((p, n) => (n === i ? { ...p, [field]: value } : p)));
  if (!semesterId) return <p className="muted">Choose a semester to add papers.</p>;
  return (
    <div>
      <strong>Papers (subject schedule)</strong>
      {papers.map((p, i) => (
        <div className="editor-row" key={i}>
          <Select label="Subject" value={p.subject_id} onChange={(e) => change(i, 'subject_id', e.target.value)} placeholder="Choose" options={subjects.map((s) => ({ value: String(s.id), label: `${s.code} - ${s.name}` }))} />
          <Input label="Date" type="date" value={p.exam_date} onChange={(e) => change(i, 'exam_date', e.target.value)} />
          <Input label="Start" type="time" value={p.start_time} onChange={(e) => change(i, 'start_time', e.target.value)} />
          <Input label="End" type="time" value={p.end_time} onChange={(e) => change(i, 'end_time', e.target.value)} />
          <Input label="Room" value={p.room_number} onChange={(e) => change(i, 'room_number', e.target.value)} />
          <Input label="Max marks" type="number" min="1" value={p.max_marks} onChange={(e) => change(i, 'max_marks', e.target.value)} />
          <Button size="sm" variant="danger" onClick={() => setPapers((list) => list.filter((_, n) => n !== i))}>Remove</Button>
        </div>
      ))}
      <div style={{ marginTop: 8 }}><Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={() => setPapers((list) => [...list, { ...EMPTY_PAPER }])}>Add paper</Button></div>
    </div>
  );
}

// rows typed by the user -> what the API wants (throws a friendly error if a row is incomplete)
export function papersPayload(papers) {
  return papers.map((p) => {
    if (!p.subject_id || !p.exam_date || !p.start_time || !p.end_time || !p.max_marks) throw new Error('Complete every paper row (subject, date, times, max marks) or remove it.');
    if (p.end_time <= p.start_time) throw new Error('A paper must end after it starts.');
    return { subject_id: Number(p.subject_id), exam_date: p.exam_date, start_time: p.start_time, end_time: p.end_time, room_number: p.room_number || null, max_marks: Number(p.max_marks) };
  });
}

export default function ExamsManage() {
  const toast = useToast();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const list = useList('/exams', { limit: 5, initialFilters: { phase: '' } });
  const [form, setForm] = useState(null);          // { mode, exam }
  const [papers, setPapers] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [ticketTarget, setTicketTarget] = useState(null);

  function open(mode, exam) {
    setPapers((exam?.subjects || []).map((s) => ({ subject_id: String(s.subject_id), exam_date: s.exam_date, start_time: String(s.start_time).slice(0, 5), end_time: String(s.end_time).slice(0, 5), room_number: s.room_number || '', max_marks: String(s.max_marks) })));
    setForm({ mode, exam: exam || {} });
  }

  async function save(values) {
    const subjects = papersPayload(papers);
    let res;
    if (form.mode === 'edit') {
      res = await http.put(`/exams/${form.exam.id}`, values);
      await http.put(`/exams/${form.exam.id}/subjects`, { subjects });
    } else {
      res = await http.post('/exams', { ...values, subjects });
    }
    toast.success(res.message);
    setForm(null);
    list.reload();
  }
  async function remove() {
    try { const res = await http.delete(`/exams/${deleteTarget.id}`); toast.success(res.message); list.reload(); }
    catch (err) { toast.error(err.message); } finally { setDeleteTarget(null); }
  }
  async function generate() {
    try { const res = await http.post('/hall-ticket/generate', { exam_id: ticketTarget.id }); toast.success(`${res.data.created} hall ticket(s) created, ${res.data.blocked} blocked.`); }
    catch (err) { toast.error(err.message); } finally { setTicketTarget(null); }
  }

  return (
    <>
      <PageHeader title={isAdmin ? 'Exams & Hall Tickets' : 'Manage Exams'} subtitle="Create exams, set the paper schedule, and release hall tickets."
        actions={<Button icon={<Plus size={17} />} onClick={() => open('create')}>New exam</Button>} />
      <Tabs tabs={[{ id: '', label: 'All' }, { id: 'upcoming', label: 'Upcoming' }, { id: 'completed', label: 'Completed' }]} active={list.filters.phase || ''} onChange={(id) => list.setFilter('phase', id)} />
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} />
        : list.loading && !list.items.length ? <LoadingSpinner label="Loading exams..." />
        : list.items.length === 0 ? <div className="card"><EmptyState title="No exams found" message="Use New exam to create one." /></div>
        : (
          <div className="stack">
            {list.items.map((e) => (
              <div key={e.id}>
                <ExamCard exam={e} />
                <div className="row" style={{ marginTop: 8 }}>
                  <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => open('edit', e)}>Edit exam and papers</Button>
                  {isAdmin && <Button size="sm" variant="secondary" icon={<Ticket size={14} />} onClick={() => setTicketTarget(e)}>Generate hall tickets</Button>}
                  {isAdmin && <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setDeleteTarget(e)}>Delete</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      <div className="card" style={{ marginTop: 16, display: list.pagination && list.pagination.total > 0 ? 'block' : 'none' }}><Pagination pagination={list.pagination} onPageChange={list.setPage} /></div>

      <FormModal open={Boolean(form)} mode={form?.mode} size="lg" title={form?.mode === 'edit' ? 'Edit exam' : 'New exam'} fields={EXAM_FIELDS} initial={form?.exam || {}} onSubmit={save} onClose={() => setForm(null)}>
        {(values) => <PapersEditor semesterId={values.semester_id} papers={papers} setPapers={setPapers} />}
      </FormModal>
      <ConfirmDialog open={Boolean(deleteTarget)} danger title="Delete this exam?" confirmText="Delete" onConfirm={remove} onCancel={() => setDeleteTarget(null)}
        message={deleteTarget ? `"${deleteTarget.name}", its papers and its hall tickets will be removed.` : ''} />
      <ConfirmDialog open={Boolean(ticketTarget)} title="Generate hall tickets?" confirmText="Generate" onConfirm={generate} onCancel={() => setTicketTarget(null)}
        message={ticketTarget ? `Tickets for "${ticketTarget.name}" are created for every eligible student. Students below 65% attendance or with overdue fees are blocked. Existing tickets are not changed.` : ''} />
    </>
  );
}
