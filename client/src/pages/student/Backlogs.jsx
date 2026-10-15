// Backlogs (subjects failed). Students see their own history; admin sees everyone.
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import Select from '../../components/Select';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import Badge from '../../components/Badge';
import useList from '../../hooks/useList';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/format';

export default function Backlogs() {
  const { role } = useAuth();
  const list = useList('/backlogs', { limit: 10 });
  const columns = [
    ...(role !== 'student' ? [{ key: 'student_name', header: 'Student', render: (b) => `${b.student_name} (${b.student_code})` }] : []),
    { key: 'subject_name', header: 'Subject' },
    { key: 'subject_code', header: 'Code' },
    { key: 'semester_no', header: 'Semester', numeric: true },
    { key: 'attempt_no', header: 'Exam attempt', numeric: true },
    { key: 'result', header: 'Result', render: (b) => <Badge status={b.result} /> },
    { key: 'status', header: 'Status', render: (b) => <Badge status={b.status} /> },
    { key: 'reexam_date', header: 'Re-examination date', render: (b) => (b.status === 'cleared' ? `Cleared ${formatDate(b.cleared_on)}` : formatDate(b.reexam_date)) },
  ];
  return (
    <>
      <PageHeader title="Backlogs" subtitle="Subjects you have not cleared yet, and your earlier backlog history." />
      <div className="card">
        <div className="toolbar">
          <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search subject or code" />
          <Select label="Status" placeholder="All" value={list.filters.status || ''} onChange={(e) => list.setFilter('status', e.target.value)}
            options={[{ value: 'active', label: 'Active' }, { value: 'cleared', label: 'Cleared' }]} />
        </div>
        <DataTable columns={columns} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload}
          emptyTitle="No backlogs" emptyMessage="Great news - there are no backlog records." />
        <Pagination pagination={list.pagination} onPageChange={list.setPage} />
      </div>
    </>
  );
}
