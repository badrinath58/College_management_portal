// Opens a receipt in a popup. Used by Receipts, Transactions and the payment confirmation.
//   <ReceiptModal receiptId={5} onClose={() => setId(null)} />
import { useRef } from 'react';
import { Printer } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Receipt from './Receipt';
import PdfButton from './PdfButton';
import LoadingSpinner from './LoadingSpinner';
import ErrorState from './ErrorState';
import useFetch from '../hooks/useFetch';
import { http } from '../services/api';
import { printElement } from '../utils/print';

export default function ReceiptModal({ receiptId, onClose }) {
  const paper = useRef(null);
  const { data, loading, error, reload } = useFetch(() => (receiptId ? http.get(`/receipts/${receiptId}`) : Promise.resolve({ data: null })), [receiptId]);
  return (
    <Modal open={Boolean(receiptId)} title="Receipt" size="lg" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button>
        <PdfButton url={`/receipts/${receiptId}/pdf`} filename="receipt.pdf" disabled={!data}>Download PDF</PdfButton>
        <Button variant="secondary" icon={<Printer size={17} />} disabled={!data} onClick={() => printElement(paper.current, `Receipt ${data.receipt_number}`)}>Print</Button></>}>
      {loading && <LoadingSpinner label="Loading receipt..." />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && <div ref={paper}><Receipt receipt={data} /></div>}
    </Modal>
  );
}
