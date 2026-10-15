// Login page: logo, college name, Student ID / Username, password (show/hide), remember me, forgot password.
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import Logo from '../components/Logo';
import Input from '../components/Input';
import Button from '../components/Button';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';
import { COLLEGE_NAME } from '../utils/config';
import { dashboardPath } from '../utils/menu';   // used by safeRedirect below

// After login go back to the page the user wanted, unless it belongs to another role's area
function safeRedirect(from, role) {
  const home = dashboardPath(role);
  if (!from || from === '/' || from.startsWith('/login')) return home;
  const area = ['student', 'faculty', 'admin'].find((r) => from.startsWith(`/${r}/`));
  return area && area !== role ? home : from;
}

export default function Login() {
  const { login, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '', rememberMe: false });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // "Your session has expired" message left by api.js / AuthContext
  useEffect(() => {
    const saved = sessionStorage.getItem('cmp_notice');
    if (saved) { setNotice(saved); sessionStorage.removeItem('cmp_notice'); }
  }, []);

  if (isAuthenticated) return <Navigate to={safeRedirect(location.state?.from, role)} replace />;

  const change = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setServerError('');
  };

  function validate() {
    const found = {};
    if (!form.username.trim()) found.username = 'Please enter your Student ID or username.';
    if (!form.password) found.password = 'Please enter your password.';
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError('');
    try {
      const user = await login({ username: form.username.trim(), password: form.password, rememberMe: form.rememberMe });
      navigate(safeRedirect(location.state?.from, user.role), { replace: true });
    } catch (err) {
      setServerError(err.message);      // "Invalid username or password.", network error, rate limit...
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <Logo size={76} />
        <h1>{COLLEGE_NAME}</h1>
        <p>Student Management Portal</p>
      </div>
      <form className="auth-form" onSubmit={submit} noValidate>
        {notice && <Alert type="warning" onClose={() => setNotice('')}>{notice}</Alert>}
        {serverError && <Alert type="error">{serverError}</Alert>}
        <Input label="Student ID / Username" value={form.username} onChange={change('username')} error={errors.username}
          autoComplete="username" autoFocus required maxLength={50} />
        <Input label="Password" type="password" value={form.password} onChange={change('password')} error={errors.password}
          autoComplete="current-password" required maxLength={100} />
        <div className="auth-links">
          <label className="check">
            <input type="checkbox" checked={form.rememberMe} onChange={change('rememberMe')} /> Remember me
          </label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <Button type="submit" block loading={submitting} icon={<LogIn size={18} />}>Login</Button>
      </form>
      <p className="auth-footer">Authorised users only. Contact the college office if you need an account.</p>
    </div>
  );
}
