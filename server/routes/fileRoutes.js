const express = require('express');
const { serve } = require('../controllers/fileController');
const { protect } = require('../middleware/auth');

const router = express.Router();
// The browser must send the Authorization header, so the React app fetches the file as a blob
router.get('/:folder/:filename', protect, serve);
module.exports = router;
