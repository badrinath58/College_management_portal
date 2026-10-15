// Online Transactions: payment history with filters (date, payment type, status). Student: own | admin: everyone.
import { useState } from 'react';
import { Receipt as ReceiptIcon } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import Select from '../../components/Select';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import ReceiptModal from '../../components/ReceiptModal';
import PdfButton from '../../components/PdfButton';
import useList from '../../hooks/useList';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime, humanize } from '../../utils/format';

export default function TransactionsPage() {
  const { role } = useAuth();
  const list = useList('/transactions', { limit: 10 });
  const [receiptId, setReceiptId] = useState(null);
  const f = list.filters;
  const columns = [
    { key: 'transaction_ref', header: 'Transaction ID', render: (t) => <code>{t.transaction_ref}</code> },
    ...(role !== 'student' ? [{ key: 'student_name', header: 'Student', render: (t) => `${t.student_name} (${t.student_code})` }] : []),
    { key: 'transaction_date', header: 'Date', render: (t) => formatDateTime(t.transaction_date) },
    { key: 'description', header: 'Description', render: (t) => <span>{t.description}{t.failure_reason && <><br /><small className="field-error">{t.failure_reason}</small></>}</span> },
    { key: 'amount', header: 'Amount', numeric: true, render: (t) => <strong>{formatCurrency(t.amount)}</strong> },
    { key: 'payment_method', header: 'Payment method', render: (t) => humanize(t.payment_method) },
    { key: 'status', header: 'Status', render: (t) => <Badge status={t.status} /> },
    { key: 'receipt_id', header: 'Receipt', render: (t) => (t.receipt_id ? (
      <span className="actions-cell">
        <Button size="sm" variant="ghost" icon={<ReceiptIcon size={15} />} onClick={() => setReceiptId(t.receipt_id)}>{t.receipt_number}</Button>
        <PdfButton size="sm" variant="ghost" url={`/transactions/${t.id}/pdf`} filename="payment-receipt.pdf">Payment PDF</PdfButton>
      </span>) : '-') },
  ];
  return (
    <>
      <PageHeader title="Online Transactions" subtitle="Every payment attempt, successful or not." />
      <div className="card">
        <div className="toolbar">
          <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search transaction ID or description" />
          <Input label="From" type="date" value={f.from || ''} onChange={(e) => list.setFilter('from', e.target.value)} />
          <Input label="To" type="date" value={f.to || ''} onChange={(e) => list.setFilter('to', e.target.value)} />
          <Select label="Payment type" placeholder="All" value={f.payment_method || ''} onChange={(e) => list.setFilter('payment_method', e.target.value)}
            options={['upi', 'card', 'net_banking', 'cash', 'mock_gateway'].map((m) => ({ value: m, label: humanize(m) }))} />
          <Select label="Status" placeholder="All" value={f.status || ''} onChange={(e) => list.setFilter('status', e.target.value)}
            options={['success', 'failed', 'initiated', 'refunded'].map((m) => ({ value: m, label: humanize(m) }))} />
          {(list.search || f.from || f.to || f.payment_method || f.status) && <Button variant="ghost" onClick={list.resetFilters}>Clear filters</Button>}
        </div>
        <DataTable columns={columns} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyTitle="No transactions found" emptyMessage="Payments you make will be listed here." />
        <Pagination pagination={list.pagination} onPageChange={list.setPage} />
      </div>
      <ReceiptModal receiptId={receiptId} onClose={() => setReceiptId(null)} />
    </>
  );
}
