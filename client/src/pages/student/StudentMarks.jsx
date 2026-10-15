// Marks: every component of your marks, subject by subject, one semester at a time.
import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import Select from '../../components/Select';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import useFetch from '../../hooks/useFetch';
import { http } from '../../services/api';

const COLUMNS = [
  { key: 'subject_name', header: 'Subject', render: (m) => <span><strong>{m.subject_name}</strong><br /><small className="muted">{m.subject_code}</small></span> },
  { key: 'internal_marks', header: 'Internal assessment', numeric: true },
  { key: 'mid_marks', header: 'Mid exam', numeric: true },
  { key: 'assignment_marks', header: 'Assignment', numeric: true },
  { key: 'practical_marks', header: 'Practical', numeric: true },
  { key: 'external_marks', header: 'External exam', numeric: true },
  { key: 'total_marks', header: 'Total', numeric: true, render: (m) => <strong>{m.total_marks}</strong> },
  { key: 'grade', header: 'Grade', render: (m) => m.grade || '-' },
  { key: 'result', header: 'Result', render: (m) => <Badge status={m.result} /> },
];

export default function StudentMarks() {
  const { data, loading, error, reload } = useFetch(() => http.get('/marks', { limit: 100 }), []);
  const [semester, setSemester] = useState('');
  if (loading) return <LoadingSpinner fullPage label="Loading marks..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const semesters = [...new Set(data.items.map((m) => m.semester_no))].sort((a, b) => b - a);
  const current = semester || String(semesters[0] ?? '');
  const rows = data.items.filter((m) => String(m.semester_no) === current);
  return (
    <>
      <PageHeader title="Marks" subtitle="Marks entered by your faculty. Results stay 'pending' until the semester exam is graded." />
      <div className="card">
        <div className="toolbar">
          <Select label="Semester" value={current} onChange={(e) => setSemester(e.target.value)} options={semesters.map((s) => ({ value: String(s), label: `Semester ${s}` }))} />
        </div>
        <DataTable columns={COLUMNS} rows={rows} rowKey="subject_id" emptyTitle="No marks yet" emptyMessage="Marks appear here after your faculty enters them." />
      </div>
    </>
  );
}
