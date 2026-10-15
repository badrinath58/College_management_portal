// Bell icon with the unread count. Click it to see the latest notifications.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { http } from '../services/api';
import { formatDateTime } from '../utils/format';

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const box = useRef(null);

  // check the unread count now and then every minute (only while the tab is visible)
  useEffect(() => {
    const check = () => {
      if (document.hidden) return;
      http.get('/notifications/unread-count').then((b) => setUnread(b.data.unread)).catch(() => {});
    };
    check();
    const timer = setInterval(check, 60000);
    return () => clearInterval(timer);
  }, []);

  // click outside closes the panel
  useEffect(() => {
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setLoading(true); setError('');
    try {
      const body = await http.get('/notifications', { limit: 6 });
      setItems(body.data.items);
      setUnread(body.data.unread);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [open]);

  async function markRead(n) {
    if (n.is_read) return;
    try {
      await http.put(`/notifications/${n.id}/read`);
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)));
      setUnread((u) => Math.max(0, u - 1));
    } catch (e) { /* not important enough to interrupt the user */ }
  }

  async function markAll() {
    try {
      await http.put('/notifications/read-all');
      setItems((list) => list.map((x) => ({ ...x, is_read: 1 })));
      setUnread(0);
    } catch (e) { /* ignore */ }
  }

  return (
    <div className="dropdown" ref={box}>
      <button type="button" className="icon-btn" onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
        <Bell size={20} />
        {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="dropdown-panel wide">
          <div className="dropdown-head">
            <span>Notifications</span>
            {unread > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={markAll}>Mark all read</button>}
          </div>
          <div className="notif-list">
            {loading && <p className="center-box">Loading...</p>}
            {error && <p className="center-box">{error}</p>}
            {!loading && !error && items.length === 0 && <p className="center-box">You have no notifications.</p>}
            {items.map((n) => (
              <button type="button" key={n.id} className={`notif-item ${n.is_read ? '' : 'unread'}`} onClick={() => markRead(n)}>
                <strong>{n.title}</strong>
                <span>{n.message}</span>
                <span>{formatDateTime(n.created_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
