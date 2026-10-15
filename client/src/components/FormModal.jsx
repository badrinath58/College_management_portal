// A popup form built from field settings. It validates, shows server errors, and calls onSubmit(values).
// onSubmit must throw on failure (the message is shown in the popup) and close the popup itself on success.
//   <FormModal open title="Add book" fields={FIELDS} onSubmit={async (values) => {...; onClose(); }} onClose={...} />
import { useEffect, useId, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Alert from './Alert';
import FormFields, { buildInitial, cleanValues, validateForm } from './FormFields';
import useOptions from '../hooks/useOptions';

export default function FormModal({ open, title, fields, initial = {}, mode = 'create', submitLabel = 'Save', onSubmit, onClose, size, note, children }) {
  const formId = useId();
  const options = useOptions(fields, open);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {          // every time the popup opens, start from fresh values
    if (open) { setForm(buildInitial(fields, initial, mode)); setErrors({}); setServerError(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    const found = validateForm(fields, form, mode);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setServerError('');
    try { await onSubmit(cleanValues(fields, form, mode), form); } catch (err) { setServerError(err.message); } finally { setSaving(false); }
  }

  return (
    <Modal open={open} title={title} size={size} onClose={() => { if (!saving) onClose(); }}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form={formId} loading={saving}>{submitLabel}</Button></>}>
      <form id={formId} className="form-grid" onSubmit={submit} noValidate>
        {serverError && <div className="full"><Alert type="error">{serverError}</Alert></div>}
        {note && <div className="full"><Alert type="info">{note}</Alert></div>}
        <FormFields fields={fields} form={form} setForm={setForm} errors={errors} options={options} mode={mode} />
        {children && <div className="full">{typeof children === 'function' ? children(form, setForm) : children}</div>}
      </form>
    </Modal>
  );
}
