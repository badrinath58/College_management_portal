// Every successful API answer has the SAME shape: { success, message, data }
function sendSuccess(res, data = null, message = 'Request successful', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}
module.exports = { sendSuccess };
