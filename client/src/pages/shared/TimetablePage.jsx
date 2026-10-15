// Time Table: students see the version they chose; faculty see every class they teach. Printable.
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Timetable from '../../components/Timetable';
import Button from '../../components/Button';
import PdfButton from '../../components/PdfButton';
import Badge from '../../components/Badge';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { http } from '../../services/api';
import { printElement } from '../../utils/print';
import { COLLEGE_NAME } from '../../utils/config';

export default function TimetablePage() {
  const { role, profile } = useAuth();
  const paper = useRef(null);
  const { data, loading, error, reload } = useFetch(() => http.get('/timetable'), []);
  if (loading) return <LoadingSpinner fullPage label="Loading timetable..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const t = data.timetable;
  const title = t ? `${t.course} - Semester ${t.semester_no}, Section ${t.section}` : 'My teaching timetable';
  return (
    <>
      <PageHeader title="Time Table" subtitle={t ? `${t.version_label} | ${t.academic_year}` : 'All classes assigned to you this week.'}
        actions={<>
          {role === 'student' && <Button to="/choose-timetable" variant="secondary">Choose another version</Button>}
          {data.slots.length > 0 && <>
            <PdfButton url="/timetable/pdf" filename="timetable.pdf">Download PDF</PdfButton>
            <Button variant="secondary" icon={<Printer size={17} />} onClick={() => printElement(paper.current, 'Time Table')}>Print</Button></>}
        </>} />
      {data.slots.length === 0 ? (
        <div className="card"><EmptyState title="No timetable available yet"
          message={role === 'student' ? 'Ask the administrator to publish one, or pick a version in Choose Timetable.' : 'No classes are assigned to you yet.'}
          action={role === 'student' ? <Link to="/choose-timetable">Choose Timetable</Link> : null} /></div>
      ) : (
        <div className="card card-body" ref={paper}>
          <div className="print-only" style={{ textAlign: 'center', marginBottom: 12 }}>
            <h2>{COLLEGE_NAME}</h2><p>{title}{profile?.full_name ? ` | ${profile.full_name}` : ''}</p>
          </div>
          {t && <div className="row" style={{ marginBottom: 12 }}><strong>{title}</strong><Badge tone="info">{t.version_label}</Badge></div>}
          <Timetable slots={data.slots} />
        </div>
      )}
    </>
  );
}
