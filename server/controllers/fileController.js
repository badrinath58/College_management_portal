// Uploaded files are NOT public. Every file request passes through this check:
//   profile photo  -> the student themself, or faculty/admin
//   answer sheet   -> the owner student (only after release), the subject's faculty, or admin
//                     "?download=true" additionally needs download_allowed for students
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getFacultyIdByUser } = require('../services/identity');
const { UPLOAD_ROOT } = require('../middleware/upload');

const serve = asyncHandler(async (req, res) => {
  const { folder, filename } = req.params;
  if (!['answer-sheets', 'profile-photos'].includes(folder) || !/^[\w.-]+\.(pdf|jpe?g|png)$/i.test(filename)) {
    throw new AppError('File not found.', 404);
  }
  const relative = `uploads/${folder}/${filename}`;
  const wantsDownload = req.query.download === 'true';
  let downloadAllowed = true;

  if (folder === 'profile-photos') {
    const [rows] = await pool.query('SELECT user_id FROM students WHERE photo_path = ?', [relative]);
    if (!rows[0]) throw new AppError('File not found.', 404);
    if (req.user.role === 'student' && rows[0].user_id !== req.user.id) throw new AppError('You cannot view this file.', 403);
  } else {
    const [rows] = await pool.query(
      `SELECT a.is_released, a.download_allowed, s.user_id, sub.faculty_id
         FROM answer_sheets a JOIN students s ON s.id = a.student_id JOIN exam_subjects es ON es.id = a.exam_subject_id
         JOIN subjects sub ON sub.id = es.subject_id WHERE a.file_path = ?`, [relative]);
    const sheet = rows[0];
    if (!sheet) throw new AppError('File not found.', 404);
    if (req.user.role === 'student') {
      if (sheet.user_id !== req.user.id || !sheet.is_released) throw new AppError('You cannot view this file.', 403);
      downloadAllowed = !!sheet.download_allowed;
    } else if (req.user.role === 'faculty') {
      if (sheet.faculty_id !== (await getFacultyIdByUser(req.user.id))) throw new AppError('You cannot view this file.', 403);
    }
  }
  if (wantsDownload && !downloadAllowed) throw new AppError('Download is not permitted for this answer sheet.', 403);

  const fullPath = path.join(UPLOAD_ROOT, folder, filename);
  if (!fs.existsSync(fullPath)) throw new AppError('File not found on the server.', 404);
  res.setHeader('Content-Disposition', `${wantsDownload ? 'attachment' : 'inline'}; filename="${filename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(fullPath);
});

module.exports = { serve };
