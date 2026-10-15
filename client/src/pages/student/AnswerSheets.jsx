// View Answer Sheet: only sheets released by faculty are listed. View in a popup, download if permitted.
import { useState } from 'react';
import { Download, Eye } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import FileViewer from '../../components/FileViewer';
import ConfirmDialog from '../../components/ConfirmDialog';
import useList from '../../hooks/useList';
import { useToast } from '../../hooks/useToast';
import { http } from '../../services/api';
import { fetchFileBlob, saveBlob } from '../../utils/download';
import { formatDate, humanize } from '../../utils/format';

export default function AnswerSheets() {
  const toast = useToast();
  const list = useList('/answer-sheets', { limit: 10 });
  const [viewing, setViewing] = useState(null);
  const [revalTarget, setRevalTarget] = useState(null);

  async function download(sheet) {
    try { saveBlob(await fetchFileBlob(sheet.file_url, true), sheet.original_name); } catch (err) { toast.error(err.message); }
  }
  async function requestReval() {
    try { const body = await http.post(`/answer-sheets/${revalTarget.id}/revaluation`); toast.success(body.message); list.reload(); }
    catch (err) { toast.error(err.message); } finally { setRevalTarget(null); }
  }

  const columns = [
    { key: 'exam_name', header: 'Exam' },
    { key: 'subject_name', header: 'Subject', render: (a) => `${a.subject_name} (${a.subject_code})` },
    { key: 'exam_date', header: 'Exam date', render: (a) => formatDate(a.exam_date) },
    { key: 'marks_obtained', header: 'Marks', numeric: true, render: (a) => (a.marks_obtained === null ? '-' : `${a.marks_obtained} / ${a.max_marks}`) },
    { key: 'evaluation_status', header: 'Evaluation', render: (a) => <Badge status={a.evaluation_status}>{humanize(a.evaluation_status)}</Badge> },
    { key: 'id', header: 'Answer sheet', render: (a) => (
      <span className="row">
        <Button size="sm" variant="secondary" icon={<Eye size={15} />} onClick={() => setViewing(a)}>View</Button>
        {a.can_download && <Button size="sm" variant="ghost" icon={<Download size={15} />} onClick={() => download(a)}>Download</Button>}
        {a.evaluation_status === 'evaluated' && <Button size="sm" variant="ghost" onClick={() => setRevalTarget(a)}>Request revaluation</Button>}
      </span>) },
  ];
  return (
    <>
      <PageHeader title="View Answer Sheet" subtitle="Answer sheets released by your faculty." />
      <div className="card">
        <DataTable columns={columns} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload}
          emptyTitle="No answer sheets released" emptyMessage="Your faculty releases answer sheets after evaluation." />
        <Pagination pagination={list.pagination} onPageChange={list.setPage} />
      </div>
      <FileViewer sheet={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog open={Boolean(revalTarget)} title="Request revaluation?" confirmText="Request" onConfirm={requestReval} onCancel={() => setRevalTarget(null)}
        message={revalTarget ? `Ask the faculty to re-check your ${revalTarget.subject_code} answer sheet. You can request this once.` : ''} />
    </>
  );
}
