// Faculty: a read-only list of students (search by name / ID, filter by section and year).
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import Select from '../../components/Select';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import useList from '../../hooks/useList';

const COLUMNS = [
  { key: 'student_code', header: 'Student ID' }, { key: 'full_name', header: 'Name', render: (s) => <strong>{s.full_name}</strong> },
  { key: 'course', header: 'Course' }, { key: 'semester', header: 'Semester', numeric: true }, { key: 'section', header: 'Section' },
  { key: 'current_year', header: 'Year', numeric: true }, { key: 'email', header: 'Email' }, { key: 'mobile', header: 'Mobile' },
];

export default function StudentsList() {
  const list = useList('/students', { limit: 10 });
  return (
    <>
      <PageHeader title="Students" subtitle="Students of the college. Contact the administrator to change a record." />
      <div className="card">
        <div className="toolbar">
          <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search name, Student ID or email" />
          <Select label="Section" placeholder="All" value={list.filters.section || ''} onChange={(e) => list.setFilter('section', e.target.value)} options={['A', 'B', 'C', 'D'].map((s) => ({ value: s, label: s }))} />
          <Select label="Year" placeholder="All" value={list.filters.current_year || ''} onChange={(e) => list.setFilter('current_year', e.target.value)} options={[1, 2, 3, 4].map((y) => ({ value: String(y), label: `Year ${y}` }))} />
        </div>
        <DataTable columns={COLUMNS} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyTitle="No students found" />
        <Pagination pagination={list.pagination} onPageChange={list.setPage} />
      </div>
    </>
  );
}
