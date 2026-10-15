import { CloudOff } from 'lucide-react';
import Button from './Button';

// shown when loading failed (network down, server error...)
export default function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="center-box" role="alert">
      <div className="state-icon error"><CloudOff size={26} /></div>
      <h3>Could not load data</h3>
      <p>{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
