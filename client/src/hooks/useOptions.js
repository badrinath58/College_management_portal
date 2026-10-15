// Loads the choices for <select> fields that come from the API (departments, courses, subjects...).
//   field = { name: 'department_id', optionsUrl: '/departments', optionsParams: { limit: 100 }, optionLabel: (row) => row.name }
// Returns { department_id: [{ value, label }, ...] }
import { useEffect, useState } from 'react';
import { http } from '../services/api';

export default function useOptions(fields, enabled = true) {
  const [options, setOptions] = useState({});
  const key = fields.filter((f) => f.optionsUrl).map((f) => `${f.name}:${f.optionsUrl}:${JSON.stringify(f.optionsParams || {})}`).join('|');

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    fields.filter((f) => f.optionsUrl).forEach((f) => {
      http.get(f.optionsUrl, f.optionsParams).then((body) => {
        if (cancelled) return;
        const rows = Array.isArray(body.data) ? body.data : body.data.items || [];
        const label = f.optionLabel || ((r) => r.name);
        setOptions((o) => ({ ...o, [f.name]: rows.map((r) => ({ value: String(r.id), label: label(r) })) }));
      }).catch(() => { /* the field just stays empty; the page still works */ });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return options;
}
