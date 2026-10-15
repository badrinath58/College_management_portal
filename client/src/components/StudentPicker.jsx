// Search for a student by name or ID and pick one. value = the chosen student object (or null).
import { useState } from 'react';
import { X } from 'lucide-react';
import useDebounce from '../hooks/useDebounce';
import useFetch from '../hooks/useFetch';
import { http } from '../services/api';

export default function StudentPicker({ label = 'Student', value, onChange, error, required }) {
  const [text, setText] = useState('');
  const query = useDebounce(text.trim());
  const { data, loading } = useFetch(() => (query.length >= 2 ? http.get('/students', { q: query, limit: 6 }) : Promise.resolve({ data: null })), [query]);
  const results = data?.items || [];

  if (value) {
    return (
      <div className="field">
        <span className="field-label">{label}{required && <span className="req">*</span>}</span>
        <span className="chip">{value.full_name} ({value.student_code})
          <button type="button" onClick={() => onChange(null)} aria-label="Choose a different student"><X size={14} /></button></span>
      </div>
    );
  }
  return (
    <div className="field picker">
      <label>{label}{required && <span className="req" aria-hidden="true">*</span>}
        <input className={`control ${error ? 'invalid' : ''}`} style={{ marginTop: 6 }} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Type a name or Student ID (2+ letters)" autoComplete="off" aria-invalid={error ? true : undefined} />
      </label>
      {query.length >= 2 && (
        <div className="picker-results" role="listbox">
          {loading && <p className="center-box">Searching...</p>}
          {!loading && results.length === 0 && <p className="center-box">No student found.</p>}
          {results.map((s) => (
            <button type="button" key={s.id} role="option" onClick={() => { onChange(s); setText(''); }}>
              <strong>{s.full_name}</strong> <small className="muted">{s.student_code} | {s.course}, Section {s.section}</small>
            </button>
          ))}
        </div>
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
