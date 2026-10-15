// <Route element={<RoleBasedRoute roles={['admin']} />}> ... only admins can open these pages.
// The backend ALSO checks the role on every request, so this only keeps the screens tidy.
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleBasedRoute({ roles }) {
  const { role } = useAuth();
  return roles.includes(role) ? <Outlet /> : <Navigate to="/unauthorized" replace />;
}
