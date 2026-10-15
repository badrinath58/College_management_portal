const express = require('express');
const c = require('../controllers/hostelController');
const crudRouter = require('./crudRouter');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validId } = require('../middleware/validate');

const router = express.Router();
router.use(protect, authorizeRoles('student', 'admin'));   // the whole hostel module is for students and admin
router.get('/occupancy', authorizeRoles('admin'), c.occupancy);
router.get('/bookings', c.listBookings);
router.post('/bookings', authorizeRoles('student'), c.createBooking);
router.put('/bookings/:id/cancel', authorizeRoles('student', 'admin'), validId, c.cancelBooking);
router.put('/bookings/:id/review', authorizeRoles('admin'), validId, c.reviewBooking);
router.use('/hostels', crudRouter(c.hostels, ['admin']));   // /api/hostel/hostels
router.use('/rooms', crudRouter(c.rooms, ['admin']));       // /api/hostel/rooms
module.exports = router;
