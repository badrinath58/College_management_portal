// Book Search: a COMPLETE page, and the pattern every list page follows:
//   useList (server-side search + filters + pagination)  ->  SearchBar / Select  ->  DataTable  ->  Pagination
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import SearchBar from '../components/SearchBar';
import Select from '../components/Select';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import Badge from '../components/Badge';
import Button from '../components/Button';
import useList from '../hooks/useList';
import { http } from '../services/api';

const COLUMNS = [
  { key: 'title', header: 'Title', render: (b) => <strong>{b.title}</strong> },
  { key: 'author', header: 'Author' },
  { key: 'isbn', header: 'ISBN' },
  { key: 'category', header: 'Category' },
  { key: 'publisher', header: 'Publisher' },
  { key: 'available_copies', header: 'Available copies', numeric: true,
    render: (b) => <Badge tone={b.available_copies > 0 ? 'success' : 'danger'}>{b.available_copies} of {b.total_copies}</Badge> },
  { key: 'shelf_number', header: 'Shelf' },
];

export default function BookSearch() {
  const list = useList('/books', { limit: 10 });
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    http.get('/books/categories').then((b) => setCategories(b.data)).catch(() => {});
  }, []);

  const filtersActive = list.search || list.filters.category || list.filters.available;

  return (
    <>
      <PageHeader title="Book Search" subtitle="Search the library by book name, author, ISBN or category." />
      <div className="card">
        <div className="toolbar">
          <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search title, author, ISBN or category" />
          <Select label="Category" placeholder="All categories" value={list.filters.category || ''}
            onChange={(e) => list.setFilter('category', e.target.value)}
            options={categories.map((c) => ({ value: c, label: c }))} />
          <Select label="Availability" placeholder="All books" value={list.filters.available || ''}
            onChange={(e) => list.setFilter('available', e.target.value)}
            options={[{ value: 'true', label: 'Available now' }]} />
          {filtersActive && <Button variant="ghost" onClick={list.resetFilters}>Clear filters</Button>}
        </div>
        <DataTable columns={COLUMNS} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload}
          emptyTitle="No books found" emptyMessage="Try a different word or remove a filter." />
        <Pagination pagination={list.pagination} onPageChange={list.setPage} />
      </div>
    </>
  );
}
