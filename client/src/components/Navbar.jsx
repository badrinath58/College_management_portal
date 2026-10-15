// Top bar: menu button, page title, dark mode switch, notifications and the user menu.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Menu, Moon, PanelLeft, Sun, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Avatar from './Avatar';
import NotificationBell from './NotificationBell';

export default function Navbar({ title, onToggleCollapse, onOpenMobile, onLogout }) {
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const name = profile?.full_name || user?.username;

  useEffect(() => {
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <header className="topbar">
      <button type="button" className="icon-btn menu-toggle-desktop" onClick={onToggleCollapse} aria-label="Collapse or expand the menu"><PanelLeft size={20} /></button>
      <button type="button" className="icon-btn menu-toggle-mobile" onClick={onOpenMobile} aria-label="Open the menu"><Menu size={22} /></button>
      <h2 className="topbar-title">{title}</h2>
      <div className="topbar-actions">
        <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <NotificationBell />
        <div className="dropdown" ref={box}>
          <button type="button" className="user-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="User menu">
            <Avatar name={name} src={profile?.photo_url} size={36} />
            <span className="who"><strong>{name}</strong><small>{user?.role}</small></span>
          </button>
          {open && (
            <div className="dropdown-panel">
              <Link to="/profile" className="dropdown-item" onClick={() => setOpen(false)}><User size={17} /> My profile</Link>
              <button type="button" className="dropdown-item" onClick={onLogout}><LogOut size={17} /> Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
