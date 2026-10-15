// Hostel: rooms, booking requests and occupancy. Overbooking is blocked in the database
// (CHECK occupied_beds <= capacity) AND here, by locking the room row inside a transaction.
const { pool, withTransaction } = require('../config/db');
const { makeCrud } = require('../utils/crud');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { getPagination, paged } = require('../utils/pagination');
const { studentScope, whereSql } = require('../utils/scope');
const { toInt, oneOf, requireFields } = require('../utils/validators');
const { getStudentByUser } = require('../services/identity');
const { notify, notifyAdmins } = require('../services/notificationService');

const hostels = makeCrud({
  table: 'hostels', label: 'Hostel',
  fields: ['name', 'block', 'hostel_type', 'warden_name', 'warden_phone', 'total_floors'],
  required: ['name', 'block', 'hostel_type'],
  searchFields: ['t.name', 't.block'], filters: { hostel_type: 't.hostel_type' }, orderBy: 't.name',
});

const rooms = makeCrud({
  table: 'hostel_rooms', label: 'Room',
  fields: ['hostel_id', 'room_number', 'floor_no', 'room_type', 'capacity', 'occupied_beds', 'annual_fee'],
  required: ['hostel_id', 'room_number', 'floor_no', 'room_type', 'capacity', 'annual_fee'],
  select: 't.*, h.name AS hostel_name, h.block, h.hostel_type, (t.capacity - t.occupied_beds) AS available_beds',
  from: 'hostel_rooms t JOIN hostels h ON h.id = t.hostel_id',
  searchFields: ['t.room_number', 'h.name'],
  filters: { hostel_id: 't.hostel_id', room_type: 't.room_type', floor_no: 't.floor_no' },
  orderBy: 'h.name, t.room_number', maxLimit: 200,
  extraFilter: (req, where, params) => {
    if (req.query.available === 'true') where.push('t.occupied_beds < t.capacity');
    if (req.user.role === 'student') {          // boys see boys' hostels, girls see girls' hostels
      where.push(`h.hostel_type = (SELECT CASE gender WHEN 'male' THEN 'boys' WHEN 'female' THEN 'girls' END FROM students WHERE user_id = ?)`);
      params.push(req.user.id);
    }
  },
});

// POST /api/hostel/bookings   (student)  body: { room_id }
const createBooking = asyncHandler(async (req, res) => {
  requireFields(req.body, ['room_id']);
  const roomId = toInt(req.body.room_id, 'room_id');
  const student = await getStudentByUser(req.user.id);
  const expectedType = student.gender === 'male' ? 'boys' : student.gender === 'female' ? 'girls' : null;

  let booking;
  try {
    booking = await withTransaction(async (conn) => {
      const [found] = await conn.query(
        `SELECT r.id, r.room_number, r.capacity, r.occupied_beds, h.hostel_type, h.name AS hostel_name
           FROM hostel_rooms r JOIN hostels h ON h.id = r.hostel_id WHERE r.id = ? FOR UPDATE`, [roomId]);
      const room = found[0];
      if (!room) throw new AppError('Room not found.', 404);
      if (room.hostel_type !== expectedType) throw new AppError('This hostel is not available for you.', 403);
      if (room.occupied_beds >= room.capacity) throw new AppError('This room is full. Please choose another room.', 409);
      const [r] = await conn.query('INSERT INTO hostel_bookings (student_id, room_id) VALUES (?, ?)', [student.id, roomId]);
      return { id: r.insertId, room };
    });
  } catch (err) {
    // the unique key allows only one pending/approved request per student
    if (err.code === 'ER_DUP_ENTRY') throw new AppError('You already have an active hostel request. Cancel it before requesting another room.', 409);
    throw err;
  }
  await notifyAdmins('New hostel request', `${student.full_name} requested room ${booking.room.room_number} (${booking.room.hostel_name}).`, 'hostel');
  sendSuccess(res, { id: booking.id, status: 'pending' }, 'Room requested. Waiting for approval.', 201);
});

// GET /api/hostel/bookings?status=&q=&student_id=&page=
const listBookings = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query);
  const where = [];
  const params = [];
  studentScope(req, where, params, 'b.student_id');
  if (req.user.role !== 'student' && req.query.student_id) { where.push('b.student_id = ?'); params.push(req.query.student_id); }
  if (req.query.status) { where.push('b.status = ?'); params.push(req.query.status); }
  const q = String(req.query.q || '').trim();
  if (q) { where.push('(s.full_name LIKE ? OR s.student_code LIKE ? OR r.room_number LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const w = whereSql(where);
  const from = `FROM hostel_bookings b JOIN students s ON s.id = b.student_id JOIN hostel_rooms r ON r.id = b.room_id
                JOIN hostels h ON h.id = r.hostel_id`;
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${from} ${w}`, params);
  const [rows] = await pool.query(
    `SELECT b.id, b.status, b.requested_on, b.reviewed_at, b.remarks, b.room_id, r.room_number, r.room_type, r.floor_no,
            h.name AS hostel_name, h.block, r.annual_fee, s.student_code, s.full_name AS student_name
       ${from} ${w} ORDER BY b.requested_on DESC LIMIT ? OFFSET ?`, [...params, pg.limit, pg.offset]);
  sendSuccess(res, paged(rows, total, pg));
});

// PUT /api/hostel/bookings/:id/cancel   (the student, or admin)
const cancelBooking = asyncHandler(async (req, res) => {
  await withTransaction(async (conn) => {
    const [found] = await conn.query('SELECT * FROM hostel_bookings WHERE id = ? FOR UPDATE', [req.params.id]);
    const booking = found[0];
    if (!booking) throw new AppError('Booking not found.', 404);
    if (req.user.role === 'student') {
      const me = await getStudentByUser(req.user.id);
      if (!me || me.id !== booking.student_id) throw new AppError('You can only cancel your own request.', 403);
    }
    if (!['pending', 'approved'].includes(booking.status)) throw new AppError('This request can no longer be cancelled.', 400);
    if (booking.status === 'approved') {      // give the bed back
      await conn.query('SELECT id FROM hostel_rooms WHERE id = ? FOR UPDATE', [booking.room_id]);
      await conn.query('UPDATE hostel_rooms SET occupied_beds = GREATEST(occupied_beds - 1, 0) WHERE id = ?', [booking.room_id]);
    }
    await conn.query("UPDATE hostel_bookings SET status = 'cancelled', remarks = ? WHERE id = ?",
      [req.user.role === 'student' ? 'Cancelled by student' : 'Cancelled by admin', booking.id]);
  });
  sendSuccess(res, null, 'Request cancelled');
});

// PUT /api/hostel/bookings/:id/review   (admin)  body: { action: 'approve'|'reject', remarks? }
const reviewBooking = asyncHandler(async (req, res) => {
  const action = oneOf(req.body.action, ['approve', 'reject'], 'action');
  const info = await withTransaction(async (conn) => {
    const [found] = await conn.query(
      `SELECT b.*, s.user_id, r.room_number FROM hostel_bookings b JOIN students s ON s.id = b.student_id
         JOIN hostel_rooms r ON r.id = b.room_id WHERE b.id = ? FOR UPDATE`, [req.params.id]);
    const booking = found[0];
    if (!booking) throw new AppError('Booking not found.', 404);
    if (booking.status !== 'pending') throw new AppError('Only pending requests can be reviewed.', 400);

    if (action === 'approve') {
      const [room] = await conn.query('SELECT capacity, occupied_beds FROM hostel_rooms WHERE id = ? FOR UPDATE', [booking.room_id]);
      if (room[0].occupied_beds >= room[0].capacity) throw new AppError('The room is already full. Reject this request or free a bed first.', 409);
      await conn.query('UPDATE hostel_rooms SET occupied_beds = occupied_beds + 1 WHERE id = ?', [booking.room_id]);
    }
    await conn.query('UPDATE hostel_bookings SET status = ?, reviewed_by = ?, reviewed_at = NOW(), remarks = ? WHERE id = ?',
      [action === 'approve' ? 'approved' : 'rejected', req.user.id, req.body.remarks || null, booking.id]);
    return booking;
  });
  await notify(info.user_id, `Hostel request ${action === 'approve' ? 'approved' : 'rejected'}`,
    `Your request for room ${info.room_number} was ${action === 'approve' ? 'approved' : 'rejected'}.${req.body.remarks ? ' ' + req.body.remarks : ''}`, 'hostel');
  sendSuccess(res, null, `Request ${action === 'approve' ? 'approved' : 'rejected'}`);
});

// GET /api/hostel/occupancy   (admin)
const occupancy = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT h.id, h.name, h.block, h.hostel_type, COUNT(r.id) AS rooms, COALESCE(SUM(r.capacity), 0) AS capacity,
            COALESCE(SUM(r.occupied_beds), 0) AS occupied
       FROM hostels h LEFT JOIN hostel_rooms r ON r.hostel_id = h.id GROUP BY h.id, h.name, h.block, h.hostel_type ORDER BY h.name`);
  const hostelsOut = rows.map((r) => ({ ...r, available: r.capacity - r.occupied,
    occupancy_percent: r.capacity ? Math.round((1000 * r.occupied) / r.capacity) / 10 : 0 }));
  const capacity = hostelsOut.reduce((s, h) => s + Number(h.capacity), 0);
  const occupied = hostelsOut.reduce((s, h) => s + Number(h.occupied), 0);
  sendSuccess(res, { hostels: hostelsOut, total: { capacity, occupied, occupancy_percent: capacity ? Math.round((1000 * occupied) / capacity) / 10 : 0 } });
});

module.exports = { hostels, rooms, createBooking, listBookings, cancelBooking, reviewBooking, occupancy };
