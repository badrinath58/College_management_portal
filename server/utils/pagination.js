// Server-side pagination: the database sends only ONE page of rows, not the whole table.
// Query string example:  /api/books?page=2&limit=10
function getPagination(query, { defaultLimit = 10, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

// Standard shape for every list answer:  { items: [...], pagination: { page, limit, total, totalPages } }
function paged(items, total, { page, limit }) {
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

module.exports = { getPagination, paged };
