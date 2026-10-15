// Toast notifications:  const toast = useToast();  toast.success('Saved!');  toast.error('Failed');
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import ToastContainer from '../components/Toast';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback((type, message, duration = 4500) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-3), { id, type, message }]); // keep at most 4 on screen
    if (duration) setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m) => show('success', m),
    error: (m) => show('error', m, 7000),
    info: (m) => show('info', m),
    warning: (m) => show('warning', m, 6000),
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
