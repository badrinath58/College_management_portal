// Draws the inputs of a form from a list of field settings (so we never repeat form code).
//   field = { name, label, type: 'text|number|date|time|email|password|select|textarea|checkbox|student', required, options, hint, full, ... }
import Input from './Input';
import Select from './Select';
import StudentPicker from './StudentPicker';

export const isVisible = (field, mode) => (mode === 'create' ? !field.editOnly : !field.createOnly);

export default function FormFields({ fields, form, setForm, errors = {}, options = {}, mode = 'create' }) {
  return fields.filter((f) => isVisible(f, mode)).map((f) => {
    const value = form[f.name];
    const set = (v) => setForm((prev) => ({ ...prev, [f.name]: v }));
    const common = { label: f.label, required: f.required, hint: f.hint, error: errors[f.name] };
    const disabled = mode === 'edit' && f.disabledOnEdit;
    let control;
    if (f.type === 'select') {
      control = <Select {...common} value={value ?? ''} disabled={disabled} placeholder={f.required ? 'Select...' : 'None'} options={f.options || options[f.name] || []} onChange={(e) => set(e.target.value)} />;
    } else if (f.type === 'textarea') {
      control = <Input {...common} as="textarea" rows={3} value={value ?? ''} maxLength={f.maxLength} onChange={(e) => set(e.target.value)} />;
    } else if (f.type === 'checkbox') {
      control = <label className="check"><input type="checkbox" checked={Boolean(value)} onChange={(e) => set(e.target.checked)} /> {f.label}</label>;
    } else if (f.type === 'student') {
      control = <StudentPicker label={f.label} required={f.required} value={value} onChange={set} error={errors[f.name]} />;
    } else {
      control = <Input {...common} type={f.type || 'text'} value={value ?? ''} disabled={disabled} min={f.min} max={f.max} step={f.step}
        maxLength={f.maxLength} placeholder={f.placeholder} autoComplete={f.type === 'password' ? 'new-password' : undefined} onChange={(e) => set(e.target.value)} />;
    }
    return <div key={f.name} className={f.full ? 'full' : ''}>{control}</div>;
  });
}

// ---- helpers used by FormModal ----
export function buildInitial(fields, initial, mode) {
  const form = {};
  fields.filter((f) => isVisible(f, mode)).forEach((f) => {
    const v = initial[f.name];
    if (f.type === 'checkbox') form[f.name] = Boolean(v);
    else if (f.type === 'student') form[f.name] = v || null;
    else if (f.type === 'time') form[f.name] = v ? String(v).slice(0, 5) : '';
    else form[f.name] = v === null || v === undefined ? '' : String(v);
  });
  return form;
}

export function validateForm(fields, form, mode) {
  const errors = {};
  fields.filter((f) => isVisible(f, mode)).forEach((f) => {
    const v = form[f.name];
    const empty = v === '' || v === null || v === undefined;
    if (f.required && f.type !== 'checkbox' && empty) { errors[f.name] = `${f.label} is required.`; return; }
    if (empty) return;
    if (f.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) errors[f.name] = 'Enter a number.';
      else if (f.min !== undefined && n < f.min) errors[f.name] = `Must be at least ${f.min}.`;
      else if (f.max !== undefined && n > f.max) errors[f.name] = `Must be at most ${f.max}.`;
    }
    if (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(v)) errors[f.name] = 'Enter a valid email address.';
    if (f.type === 'password' && (v.length < 8 || !/[A-Z]/.test(v) || !/[a-z]/.test(v) || !/\d/.test(v))) errors[f.name] = 'Use 8+ characters with upper-case, lower-case and a number.';
  });
  return errors;
}

// What is sent to the API: numbers as numbers, checkboxes as 1/0, a picked student as its id; empty optional fields are left out on create.
export function cleanValues(fields, form, mode) {
  const out = {};
  fields.filter((f) => isVisible(f, mode)).forEach((f) => {
    const v = form[f.name];
    if (f.type === 'student') { if (v) out[f.name] = v.id; return; }
    if (f.type === 'checkbox') { out[f.name] = v ? 1 : 0; return; }
    const empty = v === '' || v === null || v === undefined;
    if (empty) { if (mode === 'edit') out[f.name] = ''; return; }
    out[f.name] = f.type === 'number' ? Number(v) : (typeof v === 'string' ? v.trim() : v);
  });
  return out;
}
