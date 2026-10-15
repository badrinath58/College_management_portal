// Each user reads and manages only their OWN notifications.
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { getPagination, paged } = require('../utils/pagination');
const { getStudentByUser } = require('../services/identity');
const { refreshStudentAlerts } = require('../services/notificationService');
const { refreshOverdue } = require('../services/feeService');

// GET /api/notifications?unread=true&type=&page=
const listNotifications = asyncHandler(async (req, res) => {
  if (req.user.role === 'student') {            // create fee / exam alerts if they are due (see notificationService)
    try {
      await refreshOverdue();
      const s = await getStudentByUser(req.user.id);
      if (s) await refreshStudentAlerts(s);
    } catch (e) { console.error('Alert refresh failed:', e.message); }
  }
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const where = ['user_id = ?'];
  const params = [req.user.id];
  if (req.query.unread === 'true') where.push('is_read = 0');
  if (req.query.type) { where.push('type = ?'); params.push(req.query.type); }
  const w = `WHERE ${where.join(' AND ')}`;
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM notifications ${w}`, params);
  const [[{ unread }]] = await pool.query('SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
  const [rows] = await pool.query(
    `SELECT id, title, message, type, is_read, created_at FROM notifications ${w} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]);
  sendSuccess(res, { ...paged(rows, total, pg), unread });
});

const unreadCount = asyncHandler(async (req, res) => {
  const [[{ unread }]] = await pool.query('SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
  sendSuccess(res, { unread });
});

const markRead = asyncHandler(async (req, res) => {
  const [r] = await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!r.affectedRows) throw new AppError('Notification not found.', 404);
  sendSuccess(res, null, 'Marked as read');
});

const markAllRead = asyncHandler(async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
  sendSuccess(res, null, 'All notifications marked as read');
});

const remove = asyncHandler(async (req, res) => {
  const [r] = await pool.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!r.affectedRows) throw new AppError('Notification not found.', 404);
  sendSuccess(res, null, 'Notification deleted');
});

module.exports = { listNotifications, unreadCount, markRead, markAllRead, remove };
