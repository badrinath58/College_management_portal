// "uploads/answer-sheets/abc.pdf" -> "/api/files/answer-sheets/abc.pdf"
// Files are never served as public static files. They are always fetched through an
// authenticated route (controllers/fileController.js).
const path = require('path');

function fileUrl(relativePath) {
  if (!relativePath) return null;
  const folder = path.basename(path.dirname(relativePath));
  return `/api/files/${folder}/${path.basename(relativePath)}`;
}
module.exports = { fileUrl };
