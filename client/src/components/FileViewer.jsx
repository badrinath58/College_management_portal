// Shows an answer sheet (PDF or image) in a popup. The file is fetched with the login token.
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import ErrorState from './ErrorState';
import { useToast } from '../hooks/useToast';
import { fetchFileBlob, saveBlob } from '../utils/download';

export default function FileViewer({ sheet, onClose }) {
  const toast = useToast();
  const [state, setState] = useState({ url: null, loading: true, error: '' });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!sheet) return undefined;
    let objectUrl = null;
    let cancelled = false;
    setState({ url: null, loading: true, error: '' });
    fetchFileBlob(sheet.file_url)
      .then((blob) => { if (!cancelled) { objectUrl = URL.createObjectURL(blob); setState({ url: objectUrl, loading: false, error: '' }); } })
      .catch((err) => { if (!cancelled) setState({ url: null, loading: false, error: err.message }); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [sheet]);

  async function download() {
    setDownloading(true);
    try { saveBlob(await fetchFileBlob(sheet.file_url, true), sheet.original_name); }
    catch (err) { toast.error(err.message); }
    finally { setDownloading(false); }
  }

  if (!sheet) return null;
  return (
    <Modal open title={`${sheet.subject_code} - ${sheet.exam_name}`} size="lg" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button>
        {sheet.can_download && <Button icon={<Download size={17} />} loading={downloading} onClick={download}>Download</Button>}</>}>
      {state.loading && <LoadingSpinner label="Loading answer sheet..." />}
      {state.error && <ErrorState message={state.error} />}
      {state.url && (sheet.mime_type === 'application/pdf'
        ? <iframe className="file-frame" src={state.url} title={`Answer sheet ${sheet.subject_code}`} />
        : <img className="file-image" src={state.url} alt={`Answer sheet ${sheet.subject_code}`} />)}
      {!sheet.can_download && <p className="muted" style={{ marginTop: 10 }}>Downloading is not permitted for this answer sheet.</p>}
    </Modal>
  );
}
