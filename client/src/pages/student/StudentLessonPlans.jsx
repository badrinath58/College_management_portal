// Lesson Plan (read-only for students): topics, planned and completed dates for your subjects.
import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import Select from '../../components/Select';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import Badge from '../../components/Badge';
import useList from '../../hooks/useList';
import { http } from '../../services/api';
import { formatDate, humanize } from '../../utils/format';

const COLUMNS = [
  { key: 'subject_name', header: 'Subject', render: (p) => `${p.subject_name} (${p.subject_code})` },
  { key: 'faculty_name', header: 'Faculty' },
  { key: 'unit_no', header: 'Unit', numeric: true },
  { key: 'topic', header: 'Topic', render: (p) => <span>{p.topic}{p.remarks && <><br /><small className="muted">{p.remarks}</small></>}</span> },
  { key: 'teaching_method', header: 'Teaching method', render: (p) => humanize(p.teaching_method) },
  { key: 'planned_date', header: 'Planned date', render: (p) => formatDate(p.planned_date) },
  { key: 'completed_date', header: 'Completed date', render: (p) => formatDate(p.completed_date) },
  { key: 'status', header: 'Status', render: (p) => <Badge status={p.status} /> },
];

export default function StudentLessonPlans() {
  const list = useList('/lesson-plans', { limit: 15 });
  const [subjects, setSubjects] = useState([]);
  useEffect(() => { http.get('/subjects', { mine: 'true', limit: 100 }).then((b) => setSubjects(b.data.items)).catch(() => {}); }, []);
  return (
    <>
      <PageHeader title="Lesson Plan" subtitle="What your faculty plans to teach, and what is already covered." />
      <div className="card">
        <div className="toolbar">
          <Select label="Subject" placeholder="All subjects" value={list.filters.subject_id || ''} onChange={(e) => list.setFilter('subject_id', e.target.value)}
            options={subjects.map((s) => ({ value: s.id, label: `${s.code} - ${s.name}` }))} />
          <Select label="Status" placeholder="All" value={list.filters.status || ''} onChange={(e) => list.setFilter('status', e.target.value)}
            options={['planned', 'in_progress', 'completed', 'postponed'].map((s) => ({ value: s, label: humanize(s) }))} />
        </div>
        <DataTable columns={COLUMNS} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyTitle="No lesson plans yet" />
        <Pagination pagination={list.pagination} onPageChange={list.setPage} />
      </div>
    </>
  );
}
