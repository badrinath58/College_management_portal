import { Compass } from 'lucide-react';
import Button from '../components/Button';

export default function NotFound() {
  return (
    <div className="center-box full">
      <div className="state-icon"><Compass size={28} /></div>
      <h2>Page not found</h2>
      <p>The page you are looking for does not exist.</p>
      <Button to="/">Back to home</Button>
    </div>
  );
}
