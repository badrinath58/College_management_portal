// All URLs of the app.
//   /login, /forgot-password                  public
//   everything else                           needs a login (ProtectedRoute)
//   /student/..  /faculty/..  /admin/..       only for that role (RoleBasedRoute)
import { Navigate, Route, Routes } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import RoleBasedRoute from './components/RoleBasedRoute';
import { useAuth } from './context/AuthContext';
import { dashboardPath } from './utils/menu';
import { moduleRoutes } from './routes';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Unauthorized from './pages/Unauthorized';
import NotFound from './pages/NotFound';
import StudentDashboard from './pages/StudentDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import AdminDashboard from './pages/AdminDashboard';

// "/" sends each user to their own dashboard
function HomeRedirect() {
  const { role } = useAuth();
  return <Navigate to={dashboardPath(role)} replace />;
}

// Pages that share the same allowed roles are placed under one RoleBasedRoute
function groupByRoles(routes) {
  const groups = new Map();
  routes.forEach((r) => {
    const key = r.roles.join(',');
    if (!groups.has(key)) groups.set(key, { roles: r.roles, routes: [] });
    groups.get(key).routes.push(r);
  });
  return [...groups.values()];
}

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route element={<RoleBasedRoute roles={['student']} />}><Route path="/student/dashboard" element={<StudentDashboard />} /></Route>
          <Route element={<RoleBasedRoute roles={['faculty']} />}><Route path="/faculty/dashboard" element={<FacultyDashboard />} /></Route>
          <Route element={<RoleBasedRoute roles={['admin']} />}><Route path="/admin/dashboard" element={<AdminDashboard />} /></Route>

          {groupByRoles(moduleRoutes).map((g) => (
            <Route key={g.roles.join(',')} element={<RoleBasedRoute roles={g.roles} />}>
              {g.routes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
            </Route>
          ))}
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
