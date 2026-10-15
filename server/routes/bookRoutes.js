const express = require('express');
const books = require('../controllers/bookController');
const crudRouter = require('./crudRouter');
const { protect } = require('../middleware/auth');

// GET /api/books and GET /api/books/search do the same job (search + filters + pagination)
const router = express.Router();
router.get('/search', protect, books.list);
router.get('/categories', protect, books.categories);
router.use('/', crudRouter(books, ['admin']));
module.exports = router;
