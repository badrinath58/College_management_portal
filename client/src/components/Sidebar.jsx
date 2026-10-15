// Left menu. Collapsible on desktop (icons only), slides in over the page on phones.
import { NavLink } from 'react-router-dom';
import Logo from './Logo';
import { ICONS } from '../utils/icons';
import { COLLEGE_NAME } from '../utils/config';

export default function Sidebar({ items, collapsed, mobileOpen, onClose, onLogout }) {
  return (
    <>
      <div className={`sidebar-overlay ${mobileOpen ? 'show' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Main menu">
        <div className="sidebar-brand">
          <Logo />
          <span>{COLLEGE_NAME}</span>
        </div>
        <nav className="sidebar-nav">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const content = (<>{Icon && <Icon size={19} aria-hidden="true" />}<span className="nav-label">{item.label}</span></>);
            if (item.action === 'logout') {
              return <button key={item.label} type="button" className="nav-item" onClick={onLogout} title={item.label}>{content}</button>;
            }
            return (
              <NavLink key={item.path} to={item.path} title={item.label} onClick={onClose}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                {content}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
