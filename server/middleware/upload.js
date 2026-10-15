// File upload protection (multer). Files are saved under server/uploads/<folder>/.
//  - only .pdf .jpg .jpeg .png are accepted (so no .exe, .js, .php ...)
//  - the file's real content ("magic bytes") must match its extension
//  - size limit per file
//  - the saved name is random, so the user-supplied name can never overwrite files or climb folders
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const AppError = require('../utils/AppError');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const MIME_BY_EXT = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const DANGEROUS = /\.(exe|bat|cmd|sh|js|mjs|php|html?|jar|msi|com|scr|dll|vbs|ps1)(\.|$)/i;

function makeUpload(folder, { allowed = ['.pdf', '.jpg', '.jpeg', '.png'], maxMb = 5 } = {}) {
  const dir = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      filename: (req, file, cb) =>
        cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase()),
    }),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      const name = file.originalname || '';
      const ext = path.extname(name).toLowerCase();
      if (!/^[\w\-. ()]{1,150}$/.test(name) || DANGEROUS.test(name)) {
        return cb(new AppError('Invalid file name.', 400));
      }
      if (!allowed.includes(ext) || MIME_BY_EXT[ext] !== file.mimetype) {
        return cb(new AppError(`Only ${allowed.join(', ')} files are allowed.`, 400));
      }
      cb(null, true);
    },
  });
}

// Second check AFTER saving: read the first bytes and make sure it really is a PDF/JPEG/PNG.
function verifySignature(file) {
  const ext = path.extname(file.filename).toLowerCase();
  const head = Buffer.alloc(8);
  const fd = fs.openSync(file.path, 'r');
  fs.readSync(fd, head, 0, 8, 0);
  fs.closeSync(fd);
  const ok =
    (ext === '.pdf' && head.slice(0, 4).toString() === '%PDF') ||
    ((ext === '.jpg' || ext === '.jpeg') && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) ||
    (ext === '.png' && head.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])));
  if (!ok) {
    fs.unlink(file.path, () => {});
    throw new AppError('The file content does not match its type.', 400);
  }
  return MIME_BY_EXT[ext];
}

function deleteUploaded(relativePath) {
  if (!relativePath) return;
  const full = path.join(__dirname, '..', relativePath);
  if (full.startsWith(UPLOAD_ROOT)) fs.unlink(full, () => {}); // never delete outside uploads/
}

module.exports = { makeUpload, verifySignature, deleteUploaded, UPLOAD_ROOT };
