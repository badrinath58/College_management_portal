// The frame around every logged-in page: sidebar + top bar + page + footer.
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { MENUS } from '../utils/menu';

export default function DashboardLayout() {
  const { role, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('cmp_sidebar') === '1'); // remembered
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = MENUS[role] || [];
  const current = items.find((i) => i.path && location.pathname.startsWith(i.path));
  const title = current ? current.label : 'College Portal';

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);   // close the phone menu after choosing a page
  useEffect(() => { document.title = `${title} | College Portal`; }, [title]);

  const toggleCollapse = () => setCollapsed((c) => { localStorage.setItem('cmp_sidebar', c ? '0' : '1'); return !c; });

  async function handleLogout() {
    await logout();
    toast.info('You have been logged out.');
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <Sidebar items={items} collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onLogout={handleLogout} />
      <div className={`app-main ${collapsed ? 'collapsed' : ''}`}>
        <Navbar title={title} onToggleCollapse={toggleCollapse} onOpenMobile={() => setMobileOpen(true)} onLogout={handleLogout} />
        <main className="page" id="main">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
