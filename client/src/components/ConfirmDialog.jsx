// "Are you sure?" popup for risky actions (delete, cancel, pay).
//   <ConfirmDialog open={!!target} title="Delete book?" message="..." danger onConfirm={async () => {...}} onCancel={() => setTarget(null)} />
import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

export default function ConfirmDialog({ open, title = 'Are you sure?', message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }   // the caller closes the dialog and shows errors
  }

  return (
    <Modal open={open} title={title} size="sm" onClose={busy ? () => {} : onCancel}
      footer={<>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>{cancelText}</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={confirm} loading={busy}>{confirmText}</Button>
      </>}>
      <p>{message}</p>
    </Modal>
  );
}
