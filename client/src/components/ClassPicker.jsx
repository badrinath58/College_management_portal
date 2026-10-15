// "Which class?" = a subject + a section. Used by the attendance and marks pages.
// Faculty only see their own subjects; admin sees all of them.
import { useEffect } from 'react';
import Select from './Select';
import useFetch from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { http } from '../services/api';

const SECTIONS = ['A', 'B', 'C', 'D'].map((s) => ({ value: s, label: `Section ${s}` }));

export default function ClassPicker({ value, onChange }) {
  const { role } = useAuth();
  const { data } = useFetch(() => http.get('/subjects', { limit: 100, ...(role === 'faculty' ? { mine: 'true' } : {}) }), [role]);
  const subjects = data?.items || [];

  // pick the first subject automatically
  useEffect(() => { if (subjects.length && !value.subjectId) onChange({ ...value, subjectId: String(subjects[0].id) }); }, [subjects.length]); // eslint-disable-line

  return (
    <div className="toolbar" style={{ border: 0, padding: 0 }}>
      <Select label="Subject" value={value.subjectId} onChange={(e) => onChange({ ...value, subjectId: e.target.value })}
        options={subjects.map((s) => ({ value: String(s.id), label: `${s.code} - ${s.name} (Sem ${s.semester_no})` }))} placeholder="Choose a subject" />
      <Select label="Section" value={value.section} onChange={(e) => onChange({ ...value, section: e.target.value })} options={SECTIONS} />
    </div>
  );
}
