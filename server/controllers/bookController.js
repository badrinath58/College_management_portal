// Library catalogue: everyone can search; admin manages books.
const { makeCrud } = require('../utils/crud');
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

const books = makeCrud({
  table: 'books', label: 'Book',
  // available_copies is NOT writable: it is calculated from total_copies and the books currently issued
  fields: ['isbn', 'title', 'author', 'category', 'publisher', 'total_copies', 'shelf_number'],
  required: ['isbn', 'title', 'author', 'category'],
  searchFields: ['t.title', 't.author', 't.isbn', 't.category'],
  filters: { category: 't.category' },
  orderBy: 't.title',
  // ?title= ?author= ?isbn= (partial match)  ?available=true (only books with copies on the shelf)
  extraFilter: (req, where, params) => {
    for (const col of ['title', 'author', 'isbn']) {
      if (req.query[col]) { where.push(`t.${col} LIKE ?`); params.push(`%${req.query[col]}%`); }
    }
    if (req.query.available === 'true') where.push('t.available_copies > 0');
  },
  beforeSave: async (data, req, existing) => {
    const issuedOut = existing ? existing.total_copies - existing.available_copies : 0;
    if (!existing && data.total_copies === undefined) data.total_copies = 1;
    if (data.total_copies !== undefined) {
      const total = Number(data.total_copies);
      if (!Number.isInteger(total) || total < 1) throw new AppError('total_copies must be 1 or more.', 400);
      if (total < issuedOut) throw new AppError(`${issuedOut} copies are currently issued, so total cannot be lower.`, 400);
      data.available_copies = total - issuedOut;
    }
  },
});

// GET /api/books/categories  -> for the category dropdown
const categories = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT DISTINCT category FROM books ORDER BY category');
  sendSuccess(res, rows.map((r) => r.category));
});

module.exports = { ...books, categories };
