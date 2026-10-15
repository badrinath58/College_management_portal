// <Select label="Category" value={v} onChange={(e) => ...} options={[{ value: 'a', label: 'A' }]} placeholder="All" />
import { useId } from 'react';

export default function Select({ label, options = [], placeholder, error, hint, required, className = '', ...rest }) {
  const id = useId();
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}{required && <span className="req" aria-hidden="true">*</span>}</label>}
      <select id={id} className={`control ${error ? 'invalid' : ''} ${className}`} aria-invalid={error ? true : undefined} required={required} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}
