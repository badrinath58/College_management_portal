import { ShieldAlert } from 'lucide-react';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { dashboardPath } from '../utils/menu';

export default function Unauthorized() {
  const { role } = useAuth();
  return (
    <div className="center-box full">
      <div className="state-icon error"><ShieldAlert size={28} /></div>
      <h2>Access denied</h2>
      <p>You do not have permission to open this page.</p>
      <Button to={role ? dashboardPath(role) : '/login'}>Go to my dashboard</Button>
    </div>
  );
}
