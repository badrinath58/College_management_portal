// Wrapper for the pages that do not need a login (login, forgot password)
import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <main className="auth-page">
      <Outlet />
    </main>
  );
}
