// Change password (every role). The server checks the current password again.
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { useToast } from '../../hooks/useToast';
import { authService } from '../../services/authService';

export function passwordProblem(password) {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return 'Use an upper-case letter, a lower-case letter and a number.';
  return '';
}

export default function ChangePasswordForm() {
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const change = (field) => (e) => { setForm((f) => ({ ...f, [field]: e.target.value })); setErrors((er) => ({ ...er, [field]: undefined })); setServerError(''); };

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (!form.current) found.current = 'Enter your current password.';
    const problem = passwordProblem(form.next);
    if (problem) found.next = problem;
    if (form.confirm !== form.next) found.confirm = 'The two passwords do not match.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const body = await authService.changePassword(form.current, form.next);
      toast.success(body.message);
      setForm({ current: '', next: '', confirm: '' });
    } catch (err) { setServerError(err.message); } finally { setSaving(false); }
  }

  return (
    <section className="card">
      <div className="card-header">Change password</div>
      <form className="card-body form-grid" onSubmit={submit} noValidate>
        {serverError && <div className="full"><Alert type="error">{serverError}</Alert></div>}
        <Input label="Current password" type="password" value={form.current} onChange={change('current')} error={errors.current} autoComplete="current-password" required />
        <span />
        <Input label="New password" type="password" value={form.next} onChange={change('next')} error={errors.next} autoComplete="new-password" required hint="8+ characters with upper-case, lower-case and a number" />
        <Input label="Confirm new password" type="password" value={form.confirm} onChange={change('confirm')} error={errors.confirm} autoComplete="new-password" required />
        <div className="full"><Button type="submit" loading={saving} icon={<KeyRound size={17} />}>Update password</Button></div>
      </form>
    </section>
  );
}
