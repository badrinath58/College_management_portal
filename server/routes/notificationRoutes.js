const express = require('express');
const c = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { validId } = require('../middleware/validate');

const router = express.Router();
router.use(protect);
router.get('/', c.listNotifications);
router.get('/unread-count', c.unreadCount);
router.put('/read-all', c.markAllRead);            // before "/:id/read"
router.put('/:id/read', validId, c.markRead);
router.delete('/:id', validId, c.remove);
module.exports = router;
