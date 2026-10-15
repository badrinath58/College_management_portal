// Admin: look up a student's grade cards, recalculate a semester, publish or hide it.
import { useState } from 'react';
import { Calculator, Eye, EyeOff } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StudentPicker from '../../components/StudentPicker';
import GradeCard from '../../components/GradeCard';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import PdfButton from '../../components/PdfButton';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../hooks/useToast';
import { http } from '../../services/api';
import { formatDate } from '../../utils/format';

export default function GradeCardsAdmin() {
  const toast = useToast();
  const [student, setStudent] = useState(null);
  const [busy, setBusy] = useState(null);
  const { data, loading, error, reload } = useFetch(() => (student ? http.get('/grade-card', { student_id: student.id }) : Promise.resolve({ data: null })), [student?.id]);

  async function run(key, request, okMessage) {
    setBusy(key);
    try { const res = await request(); toast.success(okMessage || res.message); await reload(); } catch (err) { toast.error(err.message); } finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader title="Grade Cards" subtitle="Check results, recalculate SGPA / CGPA, and publish them to the student."
        actions={student && data && data.cards.length > 0 && <PdfButton url="/grade-card/pdf" params={{ student_id: student.id }} filename="grade-card.pdf">Download PDF</PdfButton>} />
      <div className="stack">
        <div className="card card-body"><StudentPicker label="Find a student" value={student} onChange={setStudent} /></div>
        {!student && <div className="card"><EmptyState title="Choose a student" message="Search by name or Student ID." /></div>}
        {student && loading && !data && <LoadingSpinner label="Loading grade cards..." />}
        {student && error && <ErrorState message={error} onRetry={reload} />}
        {data && (data.cards.length === 0
          ? <div className="card"><EmptyState title="No grade cards yet" message="A card is created when every subject of a semester has a final result." /></div>
          : (
            <>
              <section className="card">
                <div className="card-header">Publishing</div>
                <ul className="list-plain">
                  {data.cards.map((c) => (
                    <li key={c.id}>
                      <span><strong>Semester {c.semester_no}</strong> ({c.academic_year}) | SGPA {c.sgpa.toFixed(2)} | CGPA {c.cgpa.toFixed(2)}{' '}
                        <Badge tone={c.is_published ? 'success' : 'warning'}>{c.is_published ? `Published ${formatDate(c.published_on)}` : 'Not published'}</Badge></span>
                      <span className="actions-cell">
                        <Button size="sm" variant="secondary" icon={<Calculator size={14} />} loading={busy === `r${c.id}`}
                          onClick={() => run(`r${c.id}`, () => http.post('/grade-card/recalculate', { student_id: student.id, semester_id: c.semester_id }))}>Recalculate</Button>
                        <Button size="sm" variant={c.is_published ? 'secondary' : 'primary'} icon={c.is_published ? <EyeOff size={14} /> : <Eye size={14} />} loading={busy === `p${c.id}`}
                          onClick={() => run(`p${c.id}`, () => http.put(`/grade-card/${c.id}/publish`, { is_published: !c.is_published }))}>{c.is_published ? 'Hide' : 'Publish'}</Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <GradeCard data={data} cards={data.cards} />
            </>
          ))}
      </div>
    </>
  );
}
