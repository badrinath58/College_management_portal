import { Inbox } from 'lucide-react';

// shown when a list has no rows
export default function EmptyState({ title = 'Nothing here yet', message, action }) {
  return (
    <div className="center-box">
      <div className="state-icon"><Inbox size={26} /></div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
