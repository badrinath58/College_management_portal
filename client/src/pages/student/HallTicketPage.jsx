// Hall Ticket: choose an exam, see the ticket, print it / save it as PDF. A blocked ticket shows the reason instead.
import { useEffect, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import HallTicket from '../../components/HallTicket';
import Select from '../../components/Select';
import Button from '../../components/Button';
import PdfButton from '../../components/PdfButton';
import Alert from '../../components/Alert';
import Badge from '../../components/Badge';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import useFetch from '../../hooks/useFetch';
import { http } from '../../services/api';
import { printElement } from '../../utils/print';

export default function HallTicketPage() {
  const paper = useRef(null);
  const tickets = useFetch(() => http.get('/hall-ticket'), []);
  const [examId, setExamId] = useState('');

  // pre-select the newest exam once the list arrives
  useEffect(() => { if (tickets.data && tickets.data.length && !examId) setExamId(String(tickets.data[0].exam_id)); }, [tickets.data, examId]);

  const detail = useFetch(() => (examId ? http.get(`/hall-ticket/${examId}`) : Promise.resolve({ data: null })), [examId]);

  if (tickets.loading) return <LoadingSpinner fullPage label="Loading hall tickets..." />;
  if (tickets.error) return <ErrorState message={tickets.error} onRetry={tickets.reload} />;
  if (tickets.data.length === 0) {
    return (<><PageHeader title="Hall Ticket" /><div className="card"><EmptyState title="No hall tickets yet" message="Your hall ticket appears here when the examination cell generates it." /></div></>);
  }

  const t = detail.data;
  return (
    <>
      <PageHeader title="Hall Ticket" subtitle="Carry a printed copy and your college ID card to the exam hall."
        actions={t && t.status === 'generated' && <>
          <PdfButton url={`/hall-ticket/${examId}/pdf`} filename="hall-ticket.pdf">Download Hall Ticket PDF</PdfButton>
          <Button variant="secondary" icon={<Printer size={17} />} onClick={() => printElement(paper.current, `Hall Ticket ${t.ticket_number}`)}>Print</Button></>} />
      <div className="stack">
        <div className="card card-body">
          <Select label="Examination" value={examId} onChange={(e) => setExamId(e.target.value)}
            options={tickets.data.map((x) => ({ value: String(x.exam_id), label: `${x.exam_name} ${x.status === 'blocked' ? '(blocked)' : ''}` }))} />
        </div>
        {detail.loading && <LoadingSpinner label="Loading hall ticket..." />}
        {detail.error && <ErrorState message={detail.error} onRetry={detail.reload} />}
        {t && t.status === 'blocked' && (
          <Alert type="error" title="Hall ticket blocked."><Badge status="blocked" /> {t.blocked_reason}</Alert>
        )}
        {t && t.status === 'generated' && <div ref={paper}><HallTicket ticket={t} /></div>}
      </div>
    </>
  );
}
