// Admin library desk: issue and return books, mark fines paid, and manage the book catalogue.
import { useState } from 'react';
import { BookPlus, Undo2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Tabs from '../../components/Tabs';
import SearchBar from '../../components/SearchBar';
import Select from '../../components/Select';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import CrudManager from '../../components/CrudManager';
import useList from '../../hooks/useList';
import { useToast } from '../../hooks/useToast';
import { http } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';

const ISSUE_FIELDS = [
  { name: 'student_id', label: 'Student', type: 'student', required: true, full: true },
  { name: 'book_id', label: 'Book', type: 'select', required: true, full: true, optionsUrl: '/books', optionsParams: { available: 'true', limit: 100 }, optionLabel: (b) => `${b.title} - ${b.author} (${b.available_copies} left)` },
  { name: 'days', label: 'Loan period (days)', type: 'number', min: 1, max: 30 },
];
const BOOK_FIELDS = [
  { name: 'isbn', label: 'ISBN', required: true, maxLength: 20 }, { name: 'title', label: 'Title', required: true, maxLength: 200 }, { name: 'author', label: 'Author', required: true, maxLength: 150 },
  { name: 'category', label: 'Category', required: true, maxLength: 60 }, { name: 'publisher', label: 'Publisher', maxLength: 120 },
  { name: 'total_copies', label: 'Total copies', type: 'number', required: true, min: 1 }, { name: 'shelf_number', label: 'Shelf number', maxLength: 20 },
];

function IssuesTab() {
  const toast = useToast();
  const list = useList('/library/issues', { limit: 10 });
  const [issuing, setIssuing] = useState(false);
  const [returning, setReturning] = useState(null);

  async function issue(values) { const res = await http.post('/library/issues', values); toast.success(res.message); setIssuing(false); list.reload(); }
  async function giveBack() {
    try { const res = await http.put(`/library/issues/${returning.id}/return`); toast.success(res.data.fine_amount > 0 ? `Returned. Fine to collect: ${formatCurrency(res.data.fine_amount)}` : res.message); list.reload(); }
    catch (err) { toast.error(err.message); } finally { setReturning(null); }
  }
  async function finePaid(row) { try { const res = await http.put(`/library/issues/${row.id}/fine-paid`); toast.success(res.message); list.reload(); } catch (err) { toast.error(err.message); } }

  const columns = [
    { key: 'student_name', header: 'Student', render: (i) => `${i.student_name} (${i.student_code})` },
    { key: 'title', header: 'Book', render: (i) => <span><strong>{i.title}</strong><br /><small className="muted">{i.author}</small></span> },
    { key: 'issue_date', header: 'Issued', render: (i) => formatDate(i.issue_date) },
    { key: 'due_date', header: 'Due', render: (i) => formatDate(i.due_date) },
    { key: 'return_date', header: 'Returned', render: (i) => (i.return_date ? formatDate(i.return_date) : '-') },
    { key: 'fine_amount', header: 'Fine', numeric: true, render: (i) => (i.fine_amount > 0 ? <span><strong style={{ color: 'var(--danger)' }}>{formatCurrency(i.fine_amount)}</strong> {i.fine_paid ? <Badge tone="success">Paid</Badge> : null}</span> : '-') },
    { key: 'status', header: 'Status', render: (i) => <Badge status={i.status} /> },
    { key: 'id', header: '', render: (i) => (
      <span className="actions-cell">
        {!i.return_date && <Button size="sm" icon={<Undo2 size={14} />} onClick={() => setReturning(i)}>Return</Button>}
        {i.fine_amount > 0 && !i.fine_paid && i.return_date && <Button size="sm" variant="secondary" onClick={() => finePaid(i)}>Fine paid</Button>}
      </span>) },
  ];
  return (
    <div className="card">
      <div className="toolbar">
        <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search student or book title" />
        <Select label="Status" placeholder="All" value={list.filters.status || ''} onChange={(e) => list.setFilter('status', e.target.value)} options={[{ value: 'issued', label: 'Issued' }, { value: 'overdue', label: 'Overdue' }, { value: 'returned', label: 'Returned' }]} />
        <span className="spacer" /><Button icon={<BookPlus size={17} />} onClick={() => setIssuing(true)}>Issue a book</Button>
      </div>
      <DataTable columns={columns} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyTitle="No library records" />
      <Pagination pagination={list.pagination} onPageChange={list.setPage} />
      <FormModal open={issuing} title="Issue a book" fields={ISSUE_FIELDS} initial={{ days: 14 }} submitLabel="Issue" onSubmit={issue} onClose={() => setIssuing(false)}
        note="A student can hold up to 3 books and cannot borrow while a book is overdue." />
      <ConfirmDialog open={Boolean(returning)} title="Mark as returned?" confirmText="Return book" onConfirm={giveBack} onCancel={() => setReturning(null)}
        message={returning ? `"${returning.title}" from ${returning.student_name}. A fine is calculated if it is late (${formatCurrency(returning.fine_amount)} so far).` : ''} />
    </div>
  );
}

export default function LibraryAdmin() {
  const [tab, setTab] = useState('issues');
  return (
    <>
      <PageHeader title="Library Management" subtitle="Issue and return books, collect fines, and keep the catalogue up to date." />
      <Tabs tabs={[{ id: 'issues', label: 'Issued books' }, { id: 'books', label: 'Book catalogue' }]} active={tab} onChange={setTab} />
      {tab === 'issues' && <IssuesTab />}
      {tab === 'books' && (
        <CrudManager embedded entity="book" url="/books" fields={BOOK_FIELDS} searchPlaceholder="Search title, author, ISBN or category"
          columns={[{ key: 'title', header: 'Title', render: (b) => <strong>{b.title}</strong> }, { key: 'author', header: 'Author' }, { key: 'isbn', header: 'ISBN' }, { key: 'category', header: 'Category' },
            { key: 'available_copies', header: 'Available', numeric: true, render: (b) => <Badge tone={b.available_copies > 0 ? 'success' : 'danger'}>{b.available_copies} of {b.total_copies}</Badge> }, { key: 'shelf_number', header: 'Shelf' }]} />
      )}
    </>
  );
}
