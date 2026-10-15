// A small "CRUD factory". Many tables (departments, subjects, books, calendar...) need the same
// five operations: list, get one, create, update, delete. Instead of copying the same code ten
// times, we describe each table in a few lines and get ready-made controller functions.
//
// SAFETY: table names, column names and ORDER BY come from OUR code (never from the user).
// Only VALUES from the user are used, and they always go through "?" placeholders,
// which is what protects us from SQL injection. Only columns listed in `fields` can be written.
const { pool } = require('../config/db');
const AppError = require('./AppError');
const asyncHandler = require('./asyncHandler');
const { sendSuccess } = require('./response');
const { getPagination, paged } = require('./pagination');
const { whereSql } = require('./scope');

function makeCrud(options) {
  const {
    table,                 // main table (aliased as t)
    label = 'Record',      // used in messages: "Department not found."
    fields,                // columns the API is allowed to write
    required = [],         // columns that must be present when creating
    select = 't.*',        // what to read (can include JOINed columns)
    from,                  // FROM clause with JOINs; default is just the table
    searchFields = [],     // columns searched by ?q=
    filters = {},          // { queryName: 'sql column' } exact-match filters
    orderBy = 't.id DESC',
    maxLimit = 100,
    extraFilter,           // (req, where, params) => void   adds custom conditions
    autoFields,            // (req) => object   values set by the server (e.g. created_by)
    beforeSave,            // async (data, req, existingRow|null) => void   validation / tweaks
    beforeDelete,          // async (req, existingRow) => void
  } = options;
  const fromSql = from || `${table} t`;

  const getById = async (id) => {
    const [rows] = await pool.query(`SELECT ${select} FROM ${fromSql} WHERE t.id = ?`, [id]);
    return rows[0] || null;
  };

  // keep only whitelisted columns that were sent
  const pick = (body) => {
    const data = {};
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f] === '' ? null : body[f];
    }
    return data;
  };

  const list = asyncHandler(async (req, res) => {
    const pg = getPagination(req.query, { maxLimit });
    const where = [];
    const params = [];

    const q = String(req.query.q || '').trim();
    if (q && searchFields.length) {
      where.push('(' + searchFields.map((f) => `${f} LIKE ?`).join(' OR ') + ')');
      searchFields.forEach(() => params.push(`%${q}%`));
    }
    for (const [key, column] of Object.entries(filters)) {
      if (req.query[key] !== undefined && req.query[key] !== '') {
        where.push(`${column} = ?`);
        params.push(req.query[key]);
      }
    }
    if (extraFilter) extraFilter(req, where, params);

    const w = whereSql(where);
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${fromSql} ${w}`, params);
    const [rows] = await pool.query(
      `SELECT ${select} FROM ${fromSql} ${w} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, pg.limit, pg.offset]
    );
    sendSuccess(res, paged(rows, total, pg));
  });

  const getOne = asyncHandler(async (req, res) => {
    const row = await getById(req.params.id);
    if (!row) throw new AppError(`${label} not found.`, 404);
    sendSuccess(res, row);
  });

  const create = asyncHandler(async (req, res) => {
    const data = { ...pick(req.body), ...(autoFields ? autoFields(req) : {}) };
    const missing = required.filter((f) => data[f] === undefined || data[f] === null);
    if (missing.length) throw new AppError(`${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} required.`, 400);
    if (beforeSave) await beforeSave(data, req, null);
    const [result] = await pool.query(`INSERT INTO ${table} SET ?`, [data]);
    sendSuccess(res, await getById(result.insertId), `${label} created successfully`, 201);
  });

  const update = asyncHandler(async (req, res) => {
    const existing = await getById(req.params.id);
    if (!existing) throw new AppError(`${label} not found.`, 404);
    const data = pick(req.body);
    if (beforeSave) await beforeSave(data, req, existing);
    if (Object.keys(data).length === 0) throw new AppError('Nothing to update.', 400);
    await pool.query(`UPDATE ${table} SET ? WHERE id = ?`, [data, req.params.id]);
    sendSuccess(res, await getById(req.params.id), `${label} updated successfully`);
  });

  const remove = asyncHandler(async (req, res) => {
    const existing = await getById(req.params.id);
    if (!existing) throw new AppError(`${label} not found.`, 404);
    if (beforeDelete) await beforeDelete(req, existing);
    await pool.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
    sendSuccess(res, null, `${label} deleted successfully`);
  });

  return { list, getOne, create, update, remove, getById };
}

module.exports = { makeCrud };
