// Library Books: books you have borrowed, due dates, fines, and a Renew button.
import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import Select from '../../components/Select';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import ConfirmDialog from '../../components/ConfirmDialog';
import useList from '../../hooks/useList';
import { useToast } from '../../hooks/useToast';
import { http } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';

export default function LibraryBooks() {
  const toast = useToast();
  const list = useList('/library/issues', { limit: 10 });
  const [renewTarget, setRenewTarget] = useState(null);
  const rules = list.extra?.rules;
  const overdue = list.items.filter((b) => b.status === 'overdue');

  async function renew() {
    try {
      const body = await http.put(`/library/issues/${renewTarget.id}/renew`);
      toast.success(`${body.message}. New due date: ${formatDate(body.data.due_date)}`);
      list.reload();
    } catch (err) { toast.error(err.message); } finally { setRenewTarget(null); }
  }

  const columns = [
    { key: 'title', header: 'Book', render: (b) => <span><strong>{b.title}</strong><br /><small className="muted">{b.author}</small></span> },
    { key: 'issue_date', header: 'Issue date', render: (b) => formatDate(b.issue_date) },
    { key: 'due_date', header: 'Due date', render: (b) => formatDate(b.due_date) },
    { key: 'return_date', header: 'Return date', render: (b) => (b.return_date ? formatDate(b.return_date) : 'Not returned') },
    { key: 'fine_amount', header: 'Fine', numeric: true, render: (b) => (b.fine_amount > 0 ? <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{formatCurrency(b.fine_amount)}</span> : '-') },
    { key: 'status', header: 'Status', render: (b) => <Badge status={b.status} /> },
    { key: 'id', header: '', render: (b) => b.can_renew ? <Button size="sm" variant="secondary" onClick={() => setRenewTarget(b)}>Renew</Button> : (b.renew_count > 0 ? <small className="muted">Renewed {b.renew_count}x</small> : null) },
  ];

  return (
    <>
      <PageHeader title="Library Books" subtitle="Books you have borrowed from the library." />
      <div className="stack">
        {overdue.length > 0 && <Alert type="error" title="Overdue books!">Please return {overdue.map((b) => `"${b.title}"`).join(', ')} to the library. The fine grows every day.</Alert>}
        <div className="card">
          <div className="toolbar">
            <Select label="Status" placeholder="All" value={list.filters.status || ''} onChange={(e) => list.setFilter('status', e.target.value)}
              options={[{ value: 'issued', label: 'Issued' }, { value: 'overdue', label: 'Overdue' }, { value: 'returned', label: 'Returned' }]} />
            {rules && <small className="muted" style={{ paddingBottom: 12 }}>Fine: {formatCurrency(rules.fine_per_day)} per late day | Renewals allowed: {rules.max_renewals} | Loan period: {rules.loan_days} days</small>}
          </div>
          <DataTable columns={columns} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyTitle="No library records" emptyMessage="Books you borrow will be listed here." />
          <Pagination pagination={list.pagination} onPageChange={list.setPage} />
        </div>
      </div>
      <ConfirmDialog open={Boolean(renewTarget)} title="Renew this book?" confirmText="Renew" onConfirm={renew} onCancel={() => setRenewTarget(null)}
        message={renewTarget ? `"${renewTarget.title}" will be renewed for ${rules?.loan_days || 14} more days.` : ''} />
    </>
  );
}
