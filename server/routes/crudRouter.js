// Builds the 5 standard routes for a CRUD controller made by utils/crud.js.
//   GET /  GET /:id  -> any logged-in user      POST / PUT /:id DELETE /:id -> writeRoles only
const express = require('express');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validId } = require('../middleware/validate');

// readRoles (optional): who may read. Default = any logged-in user.
function crudRouter(crud, writeRoles = ['admin'], readRoles = null) {
  const read = readRoles ? [authorizeRoles(...readRoles)] : [];
  const router = express.Router();
  router.use(protect);
  router.get('/', ...read, crud.list);
  router.post('/', authorizeRoles(...writeRoles), crud.create);
  router.get('/:id', ...read, validId, crud.getOne);
  router.put('/:id', authorizeRoles(...writeRoles), validId, crud.update);
  router.delete('/:id', authorizeRoles(...writeRoles), validId, crud.remove);
  return router;
}

module.exports = crudRouter;
