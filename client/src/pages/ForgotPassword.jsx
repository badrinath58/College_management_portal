// Passwords are reset by the administrator (the portal has no email service), so this page explains how.
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import Logo from '../components/Logo';
import Alert from '../components/Alert';
import { COLLEGE_NAME } from '../utils/config';

export default function ForgotPassword() {
  return (
    <div className="auth-card">
      <div className="auth-brand">
        <Logo size={64} />
        <h1>Forgot your password?</h1>
        <p>{COLLEGE_NAME}</p>
      </div>
      <div className="auth-form">
        <Alert type="info" title="How to get a new password">
          For security, passwords are reset by the college administrator.
        </Alert>
        <ol>
          <li>Visit or contact the college office / examination cell.</li>
          <li>Tell them your <strong>Student ID</strong> (or employee ID) and show your college ID card.</li>
          <li>The administrator will set a temporary password for you.</li>
          <li>Log in with it, then open <strong>Profile</strong> and change it to your own password.</li>
        </ol>
        <Link to="/login" className="btn btn-secondary"><ArrowLeft size={17} /> Back to login</Link>
        <p className="auth-footer"><KeyRound size={13} /> Never share your password with anyone, including staff.</p>
      </div>
    </div>
  );
}
