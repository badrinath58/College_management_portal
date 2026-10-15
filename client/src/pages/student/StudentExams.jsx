// Exam Details: upcoming and completed examinations with every paper's date, time and room.
import PageHeader from '../../components/PageHeader';
import Tabs from '../../components/Tabs';
import ExamCard from '../../components/ExamCard';
import Pagination from '../../components/Pagination';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import useList from '../../hooks/useList';

export default function StudentExams() {
  const list = useList('/exams', { limit: 5, initialFilters: { phase: 'upcoming' } });
  const phase = list.filters.phase;
  return (
    <>
      <PageHeader title="Exam Details" subtitle="Dates, times and rooms for your examinations." />
      <Tabs tabs={[{ id: 'upcoming', label: 'Upcoming' }, { id: 'completed', label: 'Completed' }]} active={phase} onChange={(id) => list.setFilter('phase', id)} />
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} />
        : list.loading && !list.items.length ? <LoadingSpinner label="Loading exams..." />
        : list.items.length === 0 ? <div className="card"><EmptyState title={`No ${phase} exams`} message="Check again later." /></div>
        : <div className="stack">{list.items.map((e) => <ExamCard key={e.id} exam={e} />)}</div>}
      <div className="card" style={{ marginTop: 16, display: list.pagination && list.pagination.total > 0 ? 'block' : 'none' }}>
        <Pagination pagination={list.pagination} onPageChange={list.setPage} />
      </div>
    </>
  );
}
