// Upload answer sheets (PDF / JPG / PNG, max 5 MB) and control who can see them:
//   Released = the student can view it     Download allowed = the student can also save a copy
import { useMemo, useState } from 'react';
import { Download, Eye, EyeOff, Pencil, Trash2, Upload } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Select from '../../components/Select';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import FileViewer from '../../components/FileViewer';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import useList from '../../hooks/useList';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { http } from '../../services/api';
import { formatDate, humanize } from '../../utils/format';

const STATUS_OPTIONS = ['pending', 'evaluated', 'revaluation_requested'].map((v) => ({ value: v, label: humanize(v) }));
const MAX_BYTES = 5 * 1024 * 1024;

// returns an error message, or '' when the file is fine (the server checks again, this just saves a round trip)
export function fileProblem(file) {
  if (!file) return 'Please choose the answer sheet file.';
  if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) return 'Only PDF, JPG or PNG files are allowed.';
  if (file.size > MAX_BYTES) return 'The file must be smaller than 5 MB.';
  return '';
}

export default function AnswerSheetsManage() {
  const toast = useToast();
  const { role } = useAuth();
  const list = useList('/answer-sheets', { limit: 10 });
  const exams = useFetch(() => http.get('/exams', { limit: 50 }), []);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // every paper of every exam as one list of choices
  const paperOptions = useMemo(() => (exams.data?.items || []).flatMap((e) => e.subjects.map((s) => ({ value: String(s.id), label: `${e.name} - ${s.subject_code} ${s.subject_name}` }))), [exams.data]);
  const uploadFields = useMemo(() => [
    { name: 'student_id', label: 'Student', type: 'student', required: true, full: true },
    { name: 'exam_subject_id', label: 'Exam paper', type: 'select', required: true, full: true, options: paperOptions },
    { name: 'marks_obtained', label: 'Marks obtained', type: 'number', min: 0, step: 0.5 },
    { name: 'evaluation_status', label: 'Evaluation', type: 'select', options: STATUS_OPTIONS },
    { name: 'release', label: 'Release to the student now', type: 'checkbox' },
    { name: 'download_allowed', label: 'Allow the student to download', type: 'checkbox' },
  ], [paperOptions]);
  const editFields = [
    { name: 'marks_obtained', label: 'Marks obtained', type: 'number', min: 0, step: 0.5 },
    { name: 'evaluation_status', label: 'Evaluation', type: 'select', options: STATUS_OPTIONS },
  ];

  async function upload(values) {
    const problem = fileProblem(file);
    if (problem) throw new Error(problem);
    const data = new FormData();
    Object.entries(values).forEach(([k, v]) => data.append(k, v));
    data.append('file', file);
    const res = await http.post('/answer-sheets', data);
    toast.success(res.message); setUploading(false); setFile(null); list.reload();
  }
  async function patch(sheet, body) {
    try { const res = await http.put(`/answer-sheets/${sheet.id}`, body); toast.success(res.message); list.reload(); } catch (err) { toast.error(err.message); }
  }
  async function remove() {
    try { const res = await http.delete(`/answer-sheets/${deleteTarget.id}`); toast.success(res.message); list.reload(); }
    catch (err) { toast.error(err.message); } finally { setDeleteTarget(null); }
  }

  const columns = [
    { key: 'student_name', header: 'Student', render: (a) => `${a.student_name} (${a.student_code})` },
    { key: 'subject_name', header: 'Paper', render: (a) => <span><strong>{a.subject_code}</strong> {a.subject_name}<br /><small className="muted">{a.exam_name} | {formatDate(a.exam_date)}</small></span> },
    { key: 'marks_obtained', header: 'Marks', numeric: true, render: (a) => (a.marks_obtained === null ? '-' : `${a.marks_obtained} / ${a.max_marks}`) },
    { key: 'evaluation_status', header: 'Evaluation', render: (a) => <Badge status={a.evaluation_status}>{humanize(a.evaluation_status)}</Badge> },
    { key: 'is_released', header: 'Released', render: (a) => <Badge tone={a.is_released ? 'success' : 'neutral'}>{a.is_released ? 'Yes' : 'No'}</Badge> },
    { key: 'download_allowed', header: 'Download', render: (a) => <Badge tone={a.download_allowed ? 'success' : 'neutral'}>{a.download_allowed ? 'Allowed' : 'View only'}</Badge> },
    { key: 'id', header: '', render: (a) => (
      <span className="actions-cell">
        <Button size="sm" variant="secondary" icon={<Eye size={14} />} onClick={() => setViewing({ ...a, can_download: true })}>Open</Button>
        <Button size="sm" variant={a.is_released ? 'secondary' : 'primary'} icon={a.is_released ? <EyeOff size={14} /> : <Eye size={14} />} onClick={() => patch(a, { is_released: !a.is_released })}>{a.is_released ? 'Hide' : 'Release'}</Button>
        <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => patch(a, { download_allowed: !a.download_allowed })}>{a.download_allowed ? 'Stop download' : 'Allow download'}</Button>
        <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => setEditing(a)}>Marks</Button>
        {role === 'admin' && <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setDeleteTarget(a)}>Delete</Button>}
      </span>) },
  ];

  return (
    <>
      <PageHeader title="Answer Sheets" subtitle="Upload scanned answer sheets, record marks, and release them to students."
        actions={<Button icon={<Upload size={17} />} onClick={() => { setFile(null); setUploading(true); }}>Upload answer sheet</Button>} />
      <div className="card">
        <div className="toolbar">
          <Select label="Released" placeholder="All" value={list.filters.is_released || ''} onChange={(e) => list.setFilter('is_released', e.target.value)} options={[{ value: 'true', label: 'Released' }, { value: 'false', label: 'Not released' }]} />
          <Select label="Evaluation" placeholder="All" value={list.filters.evaluation_status || ''} onChange={(e) => list.setFilter('evaluation_status', e.target.value)} options={STATUS_OPTIONS} />
        </div>
        <DataTable columns={columns} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyTitle="No answer sheets uploaded" emptyMessage="Use Upload answer sheet to add the first one." />
        <Pagination pagination={list.pagination} onPageChange={list.setPage} />
      </div>

      <FormModal open={uploading} title="Upload answer sheet" size="lg" fields={uploadFields} initial={{ evaluation_status: 'pending' }} submitLabel="Upload" onSubmit={upload} onClose={() => setUploading(false)}>
        <div className="field">
          <label htmlFor="sheet-file">Answer sheet file <span className="req">*</span></label>
          <input id="sheet-file" type="file" className="control" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files[0] || null)} />
          <span className="field-hint">PDF, JPG or PNG, up to 5 MB. Uploading again for the same student and paper replaces the old file.</span>
        </div>
      </FormModal>
      <FormModal open={Boolean(editing)} mode="edit" title="Marks and evaluation" fields={editFields} initial={editing || {}}
        onSubmit={async (values) => { const body = {}; if (values.marks_obtained !== '') body.marks_obtained = values.marks_obtained; if (values.evaluation_status) body.evaluation_status = values.evaluation_status;
          const res = await http.put(`/answer-sheets/${editing.id}`, body); toast.success(res.message); setEditing(null); list.reload(); }} onClose={() => setEditing(null)} />
      <FileViewer sheet={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog open={Boolean(deleteTarget)} danger title="Delete this answer sheet?" confirmText="Delete" onConfirm={remove} onCancel={() => setDeleteTarget(null)}
        message={deleteTarget ? `The file for ${deleteTarget.student_name} (${deleteTarget.subject_code}) is deleted from the server.` : ''} />
    </>
  );
}
