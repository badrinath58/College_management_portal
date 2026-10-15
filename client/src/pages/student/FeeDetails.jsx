// Fee Details: every fee with total, paid and pending amounts. Admin sees all students.
import { useState } from 'react';
import { CreditCard, Pencil, Plus, Receipt, Trash2, Users } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import Select from '../../components/Select';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import useList from '../../hooks/useList';
import { useAuth } from '../../context/AuthContext';
import FeeAdmin from '../staff/FeeAdmin';
import { formatCurrency, formatDate, humanize } from '../../utils/format';

export default function FeeDetails() {
  const { role } = useAuth();
  const list = useList('/fees', { limit: 10 });
  const summary = list.extra?.summary;
  const [modal, setModal] = useState(null);     // admin popups: add / assign / edit / delete
  const columns = [
    ...(role !== 'student' ? [{ key: 'student_name', header: 'Student', render: (f) => `${f.student_name} (${f.student_code})` }] : []),
    { key: 'fee_type', header: 'Fee', render: (f) => <span><strong>{humanize(f.fee_type)}</strong><br /><small className="muted">{f.description}</small></span> },
    { key: 'amount', header: 'Amount', numeric: true, render: (f) => formatCurrency(f.amount) },
    { key: 'paid_amount', header: 'Paid', numeric: true, render: (f) => formatCurrency(f.paid_amount) },
    { key: 'pending_amount', header: 'Pending', numeric: true, render: (f) => <strong>{formatCurrency(f.pending_amount)}</strong> },
    { key: 'due_date', header: 'Due date', render: (f) => formatDate(f.due_date) },
    { key: 'status', header: 'Status', render: (f) => <Badge status={f.status} /> },
    ...(role === 'admin' ? [{ key: 'id', header: '', render: (f) => (
      <span className="actions-cell">
        <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => setModal({ type: 'edit', fee: f })}>Edit</Button>
        <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setModal({ type: 'delete', fee: f })}>Delete</Button>
      </span>) }] : []),
  ];
  return (
    <>
      <PageHeader title="Fee Details" subtitle="Your fees for this semester."
        actions={role === 'admin' ? <><Button variant="secondary" icon={<Users size={17} />} onClick={() => setModal({ type: 'assign' })}>Charge a semester</Button><Button icon={<Plus size={17} />} onClick={() => setModal({ type: 'add' })}>Add fee</Button></> : role === 'student' && <><Button to="/receipts" variant="secondary" icon={<Receipt size={17} />}>Receipts</Button><Button to="/payment" icon={<CreditCard size={17} />}>Pay fees</Button></>} />
      <div className="card">
        {summary && (
          <div className="summary-bar">
            <div><span>Total amount</span><strong>{formatCurrency(summary.total_amount)}</strong></div>
            <div><span>Paid amount</span><strong style={{ color: 'var(--success)' }}>{formatCurrency(summary.paid_amount)}</strong></div>
            <div><span>Pending amount</span><strong style={{ color: summary.pending_amount > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(summary.pending_amount)}</strong></div>
          </div>
        )}
        <div className="toolbar">
          {role !== 'student' && <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search student or fee" />}
          <Select label="Status" placeholder="All" value={list.filters.status || ''} onChange={(e) => list.setFilter('status', e.target.value)}
            options={['pending', 'partial', 'paid', 'overdue'].map((s) => ({ value: s, label: humanize(s) }))} />
          <Select label="Fee type" placeholder="All" value={list.filters.fee_type || ''} onChange={(e) => list.setFilter('fee_type', e.target.value)}
            options={['tuition', 'examination', 'hostel', 'library', 'transport', 'other'].map((s) => ({ value: s, label: humanize(s) }))} />
        </div>
        <DataTable columns={columns} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyTitle="No fees found" />
        <Pagination pagination={list.pagination} onPageChange={list.setPage} />
      </div>
      {role === 'admin' && <FeeAdmin modal={modal} onClose={() => setModal(null)} onDone={list.reload} />}
    </>
  );
}
