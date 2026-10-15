// Choose Timetable: pick academic year / semester / section / branch, preview a version, then choose it.
import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import Select from '../../components/Select';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import Timetable from '../../components/Timetable';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../hooks/useToast';
import { http } from '../../services/api';

function Preview({ version, onClose, onChoose, busy }) {
  const { data, loading, error, reload } = useFetch(() => http.get('/timetable', { timetable_id: version.id }), [version.id]);
  return (
    <Modal open title={`${version.version_label} - Section ${version.section}`} size="lg" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button>
        {!version.is_selected && <Button loading={busy} onClick={() => onChoose(version)}>Choose this timetable</Button>}</>}>
      {loading && <LoadingSpinner label="Loading timetable..." />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.slots.length ? <Timetable slots={data.slots} /> : <EmptyState title="No classes added yet" />)}
    </Modal>
  );
}

export default function ChooseTimetable() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => http.get('/timetable/versions'), []);
  const [filters, setFilters] = useState({ academic_year: '', semester_no: '', section: '', course: '' });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <LoadingSpinner fullPage label="Loading timetables..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const versions = data;
  const options = (key) => [...new Set(versions.map((v) => String(v[key])))].sort().map((x) => ({ value: x, label: x }));
  const shown = versions.filter((v) => (!filters.academic_year || v.academic_year === filters.academic_year)
    && (!filters.semester_no || String(v.semester_no) === filters.semester_no)
    && (!filters.section || v.section === filters.section) && (!filters.course || v.course === filters.course));
  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  async function choose(version) {
    setBusy(true);
    try {
      const body = await http.post('/timetable/select', { timetable_id: version.id });
      toast.success(body.message);
      setPreview(null);
      await reload();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Choose Timetable" subtitle="Select the timetable version you want to follow. It is saved to your profile." />
      <div className="card">
        <div className="toolbar">
          <Select label="Academic year" placeholder="All" value={filters.academic_year} onChange={set('academic_year')} options={options('academic_year')} />
          <Select label="Semester" placeholder="All" value={filters.semester_no} onChange={set('semester_no')} options={options('semester_no')} />
          <Select label="Section" placeholder="All" value={filters.section} onChange={set('section')} options={options('section')} />
          <Select label="Branch" placeholder="All" value={filters.course} onChange={set('course')} options={options('course')} />
        </div>
        {shown.length === 0 ? <EmptyState title="No timetable versions found" message="Change the filters or ask the administrator to publish one." /> : (
          <div className="room-grid">
            {shown.map((v) => (
              <article key={v.id} className="room-card">
                <div className="row"><h3>{v.version_label}</h3><span className="spacer" />{v.is_selected ? <Badge tone="success">Selected</Badge> : null}</div>
                <small className="muted">{v.course}</small>
                <div>Semester {v.semester_no} | Section {v.section} | {v.academic_year}</div>
                <small className="muted">{v.slot_count} classes per week</small>
                <div className="row">
                  <Button size="sm" variant="secondary" onClick={() => setPreview(v)}>Preview</Button>
                  {!v.is_selected && <Button size="sm" loading={busy} onClick={() => choose(v)}>Choose</Button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      {preview && <Preview version={preview} onClose={() => setPreview(null)} onChoose={choose} busy={busy} />}
    </>
  );
}
