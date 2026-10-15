// Attendance for faculty / admin:  Mark (new class)  |  Sessions (edit an earlier class)  |  Report (percentages)
import { useEffect, useState } from 'react';
import { CheckCheck, Pencil, Save } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import ClassPicker from '../../components/ClassPicker';
import SegmentedControl from '../../components/SegmentedControl';
import Tabs from '../../components/Tabs';
import Input from '../../components/Input';
import Select from '../../components/Select';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import ProgressBar from '../../components/ProgressBar';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import useFetch from '../../hooks/useFetch';
import useList from '../../hooks/useList';
import { useToast } from '../../hooks/useToast';
import { http } from '../../services/api';
import { formatDate, todayISO } from '../../utils/format';

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8].map((p) => ({ value: String(p), label: `Period ${p}` }));

// P / A / L list for a class. Used both for new classes and when editing an old one.
export function AttendanceSheet({ students, status, setStatus }) {
  const counts = { present: 0, absent: 0, late: 0 };
  students.forEach((s) => { counts[status[s.id]] = (counts[status[s.id]] || 0) + 1; });
  const setAll = (value) => setStatus(Object.fromEntries(students.map((s) => [s.id, value])));
  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <Button size="sm" variant="secondary" icon={<CheckCheck size={15} />} onClick={() => setAll('present')}>All present</Button>
        <Button size="sm" variant="secondary" onClick={() => setAll('absent')}>All absent</Button>
        <span className="spacer" />
        <Badge tone="success">{counts.present} present</Badge><Badge tone="danger">{counts.absent} absent</Badge><Badge tone="warning">{counts.late} late</Badge>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Student ID</th><th>Name</th><th>Attendance</th></tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}><td>{s.student_code}</td><td>{s.full_name}</td>
                <td><SegmentedControl name={s.full_name} value={status[s.id]} onChange={(v) => setStatus((prev) => ({ ...prev, [s.id]: v }))} /></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MarkTab({ subjectId, section }) {
  const toast = useToast();
  const roster = useFetch(() => (subjectId ? http.get('/attendance/roster', { subject_id: subjectId, section }) : Promise.resolve({ data: null })), [subjectId, section]);
  const [date, setDate] = useState(todayISO());
  const [period, setPeriod] = useState('1');
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const students = roster.data?.students || [];

  useEffect(() => { setStatus(Object.fromEntries(students.map((s) => [s.id, 'present']))); }, [roster.data]); // eslint-disable-line

  async function save() {
    setSaving(true); setError('');
    try {
      const body = await http.post('/attendance', { subject_id: Number(subjectId), section, class_date: date, period_no: Number(period), topic: topic || undefined,
        records: students.map((s) => ({ student_id: s.id, status: status[s.id] })) });
      toast.success(body.message);
      setTopic('');
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  if (roster.loading && !roster.data) return <LoadingSpinner label="Loading class list..." />;
  if (roster.error) return <ErrorState message={roster.error} onRetry={roster.reload} />;
  if (students.length === 0) return <EmptyState title="No students in this class" message="Check the section, or ask the administrator to enrol students." />;
  return (
    <div className="stack">
      {error && <Alert type="error">{error} If this class was already marked, use the Sessions tab to change it.</Alert>}
      <div className="form-grid">
        <Input label="Class date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
        <Select label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} options={PERIODS} />
        <Input label="Topic taught (optional)" value={topic} maxLength={150} onChange={(e) => setTopic(e.target.value)} />
      </div>
      <AttendanceSheet students={students} status={status} setStatus={setStatus} />
      <div><Button icon={<Save size={17} />} loading={saving} onClick={save} disabled={!date}>Save attendance</Button></div>
    </div>
  );
}

function SessionEditor({ sessionId, onClose, onSaved }) {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => http.get(`/attendance/sessions/${sessionId}`), [sessionId]);
  const [status, setStatus] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const students = (data?.records || []).map((r) => ({ id: r.student_id, student_code: r.student_code, full_name: r.full_name }));
  useEffect(() => { if (data) setStatus(Object.fromEntries(data.records.map((r) => [r.student_id, r.status]))); }, [data]);

  async function save() {
    setSaving(true); setSaveError('');
    try {
      const body = await http.put(`/attendance/${sessionId}`, { records: students.map((s) => ({ student_id: s.id, status: status[s.id] })) });
      toast.success(body.message); onSaved();
    } catch (err) { setSaveError(err.message); } finally { setSaving(false); }
  }
  return (
    <Modal open title={data ? `Edit attendance - ${formatDate(data.session.class_date)}, period ${data.session.period_no}` : 'Edit attendance'} size="lg" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={saving} disabled={!data} onClick={save}>Save changes</Button></>}>
      {loading && !data && <LoadingSpinner label="Loading..." />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {saveError && <Alert type="error">{saveError}</Alert>}
      {data && <AttendanceSheet students={students} status={status} setStatus={setStatus} />}
    </Modal>
  );
}

function SessionsTab({ subjectId, section }) {
  const list = useList('/attendance/sessions', { limit: 8, enabled: Boolean(subjectId), params: { subject_id: subjectId, section } });
  const [editing, setEditing] = useState(null);
  const columns = [
    { key: 'class_date', header: 'Date', render: (s) => formatDate(s.class_date) },
    { key: 'period_no', header: 'Period', numeric: true },
    { key: 'section', header: 'Section' },
    { key: 'topic', header: 'Topic' },
    { key: 'present_count', header: 'Present', numeric: true },
    { key: 'absent_count', header: 'Absent', numeric: true },
    { key: 'id', header: '', render: (s) => <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => setEditing(s.id)}>Edit</Button> },
  ];
  return (
    <>
      <DataTable columns={columns} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyTitle="No classes marked yet" emptyMessage="Use the Mark attendance tab for your first class." />
      <Pagination pagination={list.pagination} onPageChange={list.setPage} />
      {editing && <SessionEditor sessionId={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
    </>
  );
}

function ReportTab({ subjectId, section }) {
  const { data, loading, error, reload } = useFetch(() => (subjectId ? http.get('/attendance/report', { subject_id: subjectId, section }) : Promise.resolve({ data: null })), [subjectId, section]);
  if (loading && !data) return <LoadingSpinner label="Loading report..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const columns = [
    { key: 'student_code', header: 'Student ID' }, { key: 'full_name', header: 'Name' },
    { key: 'total_classes', header: 'Classes', numeric: true }, { key: 'classes_attended', header: 'Attended', numeric: true }, { key: 'classes_absent', header: 'Absent', numeric: true },
    { key: 'percentage', header: 'Percentage', render: (s) => <div style={{ minWidth: 140 }}><strong>{s.percentage}%</strong><ProgressBar value={s.percentage} label={`${s.full_name} attendance`} /></div> },
    { key: 'is_low', header: 'Status', render: (s) => <Badge tone={s.is_low ? 'danger' : 'success'}>{s.is_low ? 'Low' : 'OK'}</Badge> },
  ];
  return <DataTable columns={columns} rows={data?.students || []} rowKey="student_id" emptyTitle="No students in this class" />;
}

export default function AttendanceManage() {
  const [cls, setCls] = useState({ subjectId: '', section: 'A' });
  const [tab, setTab] = useState('mark');
  return (
    <>
      <PageHeader title="Attendance" subtitle="Mark attendance for a class, correct an earlier class, or see the percentage report." />
      <div className="card">
        <div className="card-body"><ClassPicker value={cls} onChange={setCls} /></div>
        <div className="card-body" style={{ paddingTop: 0 }}>
          <Tabs tabs={[{ id: 'mark', label: 'Mark attendance' }, { id: 'sessions', label: 'Earlier classes' }, { id: 'report', label: 'Percentage report' }]} active={tab} onChange={setTab} />
          {!cls.subjectId ? <EmptyState title="Choose a subject" message="You only see the subjects assigned to you." /> : (
            <>
              {tab === 'mark' && <MarkTab subjectId={cls.subjectId} section={cls.section} />}
              {tab === 'sessions' && <SessionsTab subjectId={cls.subjectId} section={cls.section} />}
              {tab === 'report' && <ReportTab subjectId={cls.subjectId} section={cls.section} />}
            </>
          )}
        </div>
      </div>
    </>
  );
}
