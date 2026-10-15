// Controllers read the request, call a service, and send the answer. Nothing more.
const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, result, 'Login successful');
});

// POST /api/auth/logout
// A JWT is stateless: the server keeps no session, so "logging out" means the browser deletes
// its token. This endpoint exists so the frontend has one place to call (and we can add a
// token blacklist later if needed).
const logout = (req, res) => {
  sendSuccess(res, null, 'Logged out successfully');
};

// GET /api/auth/me  -> who is logged in right now?
const me = asyncHandler(async (req, res) => {
  const profile = await authService.getProfile(req.user);
  const { id, username, email, role } = req.user;
  sendSuccess(res, { user: { id, username, email, role }, profile });
});

// PUT /api/auth/password   (any logged-in user)
const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body.current_password, req.body.new_password);
  sendSuccess(res, null, 'Password changed successfully');
});

module.exports = { login, logout, me, changePassword };
