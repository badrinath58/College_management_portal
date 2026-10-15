// The little messages at the bottom-right corner. Use useToast() to show them (see ToastContext).
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

const ICON = { success: CheckCircle2, error: AlertCircle, warning: TriangleAlert, info: Info };

export default function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICON[t.type] || Info;
        return (
          <div key={t.id} className={`toast ${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <Icon size={19} aria-hidden="true" />
            <p>{t.message}</p>
            <button type="button" onClick={() => onDismiss(t.id)} aria-label="Dismiss"><X size={16} /></button>
          </div>
        );
      })}
    </div>
  );
}
