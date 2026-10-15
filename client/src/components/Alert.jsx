import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

const ICON = { error: AlertCircle, success: CheckCircle2, warning: TriangleAlert, info: Info };

// <Alert type="error">Invalid username or password.</Alert>
export default function Alert({ type = 'info', title, children, onClose }) {
  const Icon = ICON[type] || Info;
  return (
    <div className={`alert ${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <div className="alert-body">{title && <strong>{title}</strong>}{title && ' '}{children}</div>
      {onClose && <button type="button" onClick={onClose} aria-label="Dismiss"><X size={16} /></button>}
    </div>
  );
}
