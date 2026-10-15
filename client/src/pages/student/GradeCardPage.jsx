// Grade Card: SGPA / CGPA per semester, printable.
import { useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import GradeCard from '../../components/GradeCard';
import Select from '../../components/Select';
import Button from '../../components/Button';
import PdfButton from '../../components/PdfButton';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import DashboardCard from '../../components/DashboardCard';
import { GraduationCap } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { http } from '../../services/api';
import { printElement } from '../../utils/print';

export default function GradeCardPage() {
  const paper = useRef(null);
  const { data, loading, error, reload } = useFetch(() => http.get('/grade-card'), []);
  const [semester, setSemester] = useState('');
  if (loading) return <LoadingSpinner fullPage label="Loading grade card..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const cards = semester ? data.cards.filter((c) => String(c.semester_id) === semester) : data.cards;
  return (
    <>
      <PageHeader title="Grade Card" subtitle="Published results of your completed semesters."
        actions={data.cards.length > 0 && <>
          <PdfButton url="/grade-card/pdf" params={{ semester_id: semester || undefined }} filename="grade-card.pdf">Download PDF</PdfButton>
          <Button variant="secondary" icon={<Printer size={17} />} onClick={() => printElement(paper.current, 'Grade Card')}>Print</Button></>} />
      {data.cards.length === 0 ? <div className="card"><EmptyState title="No grade card published yet" message="Your results will appear here once the college publishes them." /></div> : (
        <div className="stack">
          <div className="grid cols-3">
            <DashboardCard title="Current CGPA" value={data.cgpa?.toFixed(2)} icon={GraduationCap} tone="info" />
            <div className="card card-body">
              <Select label="Show semester" placeholder="All semesters" value={semester} onChange={(e) => setSemester(e.target.value)}
                options={data.cards.map((c) => ({ value: String(c.semester_id), label: `Semester ${c.semester_no} (${c.academic_year})` }))} />
            </div>
          </div>
          <div ref={paper}><GradeCard data={data} cards={cards} /></div>
        </div>
      )}
    </>
  );
}
