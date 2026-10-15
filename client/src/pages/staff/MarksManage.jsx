// Enter marks for one class. Each row can be SAVED (draft, result stays pending) or FINALIZED
// (the server then works out grade, result, backlog and the semester grade card).
import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import ClassPicker from '../../components/ClassPicker';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../hooks/useToast';
import { http } from '../../services/api';

const PARTS = [['internal', 'Internal'], ['mid', 'Mid exam'], ['assignment', 'Assignment'], ['practical', 'Practical'], ['external', 'External exam']];
const asText = (v) => (v === null || v === undefined ? '' : String(Number(v)));

export function MarksRoster({ roster }) {
  const toast = useToast();
  const max = roster.max_marks;
  const active = PARTS.filter(([key]) => max[key] > 0);   // theory subjects have no practical marks, labs have no mid exam
  const [rows, setRows] = useState(() => Object.fromEntries(roster.students.map((s) => [s.student_id, {
    values: Object.fromEntries(active.map(([key]) => [key, s.marks_id ? asText(s[`${key}_marks`]) : ''])),
    absent: s.result === 'absent', busy: false,
    saved: s.marks_id ? { result: s.result, grade: s.grade, total: Number(s.total_marks) } : null,
  }])));

  const patch = (id, change) => setRows((r) => ({ ...r, [id]: { ...r[id], ...change } }));
  const problem = (row, key) => { const v = row.values[key]; if (v === '') return ''; const n = Number(v); return !Number.isFinite(n) || n < 0 || n > max[key] ? `0-${max[key]}` : ''; };
  const hasProblem = (row) => active.some(([key]) => problem(row, key));
  const total = (row) => active.reduce((sum, [key]) => sum + (Number(row.values[key]) || 0), 0);

  async function save(student, finalize) {
    const row = rows[student.student_id];
    patch(student.student_id, { busy: true });
    try {
      const body = { student_id: student.student_id, subject_id: roster.subject.id, finalize, absent: row.absent };
      active.forEach(([key]) => { body[`${key}_marks`] = Number(row.values[key]) || 0; });
      const res = await http.post('/marks', body);
      patch(student.student_id, { busy: false, saved: { result: res.data.result, grade: res.data.grade, total: Number(res.data.total_marks) } });
      toast.success(`${student.full_name}: ${finalize ? `result ${res.data.result}${res.data.grade ? `, grade ${res.data.grade}` : ''}` : 'draft saved'}`);
    } catch (err) { patch(student.student_id, { busy: false }); toast.error(err.message); }
  }

  if (roster.students.length === 0) return <EmptyState title="No students in this class" message="Check the section." />;
  return (
    <div className="stack">
      <Alert type="info">Maximum marks: {active.map(([key, label]) => `${label} ${max[key]}`).join(' | ')}. <strong>Save</strong> keeps a draft; <strong>Finalize</strong> publishes the grade and result.</Alert>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Student</th>{active.map(([key, label]) => <th key={key} className="num">{label} (/{max[key]})</th>)}<th className="num">Total</th><th>Absent</th><th>Status</th><th /></tr></thead>
          <tbody>
            {roster.students.map((s) => {
              const row = rows[s.student_id];
              return (
                <tr key={s.student_id}>
                  <td><strong>{s.full_name}</strong><br /><small className="muted">{s.student_code}</small></td>
                  {active.map(([key, label]) => (
                    <td key={key} className="num">
                      <input type="number" min="0" max={max[key]} step="0.5" className={`control num-input ${problem(row, key) ? 'invalid' : ''}`} value={row.values[key]} disabled={row.absent}
                        aria-label={`${label} marks for ${s.full_name}`} onChange={(e) => patch(s.student_id, { values: { ...row.values, [key]: e.target.value } })} />
                    </td>
                  ))}
                  <td className="num"><strong>{total(row)}</strong></td>
                  <td><input type="checkbox" checked={row.absent} aria-label={`${s.full_name} was absent`} onChange={(e) => patch(s.student_id, { absent: e.target.checked })} /></td>
                  <td>{row.saved ? <span className="row"><Badge status={row.saved.result} />{row.saved.grade && <strong>{row.saved.grade}</strong>}</span> : <span className="muted">No marks</span>}</td>
                  <td><span className="actions-cell">
                    <Button size="sm" variant="secondary" disabled={hasProblem(row) || row.busy} onClick={() => save(s, false)}>Save</Button>
                    <Button size="sm" loading={row.busy} disabled={hasProblem(row)} onClick={() => save(s, true)}>Finalize</Button>
                  </span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MarksManage() {
  const [cls, setCls] = useState({ subjectId: '', section: 'A' });
  const roster = useFetch(() => (cls.subjectId ? http.get('/marks/roster', { subject_id: cls.subjectId, section: cls.section }) : Promise.resolve({ data: null })), [cls.subjectId, cls.section]);
  return (
    <>
      <PageHeader title="Marks" subtitle="Enter internal, mid, assignment, practical and external marks for your subjects." />
      <div className="card">
        <div className="card-body"><ClassPicker value={cls} onChange={setCls} /></div>
        <div className="card-body" style={{ paddingTop: 0 }}>
          {!cls.subjectId ? <EmptyState title="Choose a subject" />
            : roster.loading && !roster.data ? <LoadingSpinner label="Loading class list..." />
            : roster.error ? <ErrorState message={roster.error} onRetry={roster.reload} />
            : roster.data && <MarksRoster key={`${cls.subjectId}-${cls.section}`} roster={roster.data} />}
        </div>
      </div>
    </>
  );
}
