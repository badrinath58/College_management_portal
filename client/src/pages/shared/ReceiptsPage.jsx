// Receipts: view, print, or save as PDF. (The print dialog has a "Save as PDF" choice.)
import { useState } from 'react';
import { Eye } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import Input from '../../components/Input';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import ReceiptModal from '../../components/ReceiptModal';
import PdfButton from '../../components/PdfButton';
import useList from '../../hooks/useList';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, humanize } from '../../utils/format';

export default function ReceiptsPage() {
  const { role } = useAuth();
  const list = useList('/receipts', { limit: 10 });
  const [receiptId, setReceiptId] = useState(null);
  const f = list.filters;
  const columns = [
    { key: 'receipt_number', header: 'Receipt no.', render: (r) => <strong>{r.receipt_number}</strong> },
    ...(role !== 'student' ? [{ key: 'student_name', header: 'Student', render: (r) => `${r.student_name} (${r.student_code})` }] : []),
    { key: 'payment_date', header: 'Payment date', render: (r) => formatDate(r.payment_date) },
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Amount', numeric: true, render: (r) => formatCurrency(r.amount) },
    { key: 'payment_method', header: 'Method', render: (r) => humanize(r.payment_method) },
    { key: 'transaction_ref', header: 'Transaction ID', render: (r) => <code>{r.transaction_ref}</code> },
    { key: 'id', header: '', render: (r) => (
      <span className="actions-cell">
        <Button size="sm" variant="secondary" icon={<Eye size={15} />} onClick={() => setReceiptId(r.id)}>View / Print</Button>
        <PdfButton size="sm" variant="ghost" url={`/receipts/${r.id}/pdf`} filename="receipt.pdf">PDF</PdfButton>
      </span>) },
  ];
  return (
    <>
      <PageHeader title="Receipts" subtitle="Receipts for every successful payment. Download a PDF or print one." />
      <div className="card">
        <div className="toolbar">
          <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search receipt or transaction no." />
          <Input label="From" type="date" value={f.from || ''} onChange={(e) => list.setFilter('from', e.target.value)} />
          <Input label="To" type="date" value={f.to || ''} onChange={(e) => list.setFilter('to', e.target.value)} />
        </div>
        <DataTable columns={columns} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyTitle="No receipts yet" emptyMessage="A receipt is created after each successful payment." />
        <Pagination pagination={list.pagination} onPageChange={list.setPage} />
      </div>
      <ReceiptModal receiptId={receiptId} onClose={() => setReceiptId(null)} />
    </>
  );
}
