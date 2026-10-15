// Exports two routers: /api/transactions and /api/receipts
const express = require('express');
const c = require('../controllers/transactionController');
const pdf = require('../controllers/pdfController');
const { authorizeRoles } = require('../middleware/role');
const { protect } = require('../middleware/auth');
const { validId } = require('../middleware/validate');

const transactionRoutes = express.Router();
const own = authorizeRoles('student', 'admin');     // staff other than admin never see payment data
transactionRoutes.get('/', protect, own, c.listTransactions);
transactionRoutes.get('/:id/pdf', protect, own, validId, pdf.paymentReceiptPdf);

const receiptRoutes = express.Router();
receiptRoutes.use(protect, own);
receiptRoutes.get('/', c.listReceipts);
receiptRoutes.get('/:id/pdf', validId, pdf.receiptPdf);
receiptRoutes.get('/:id', validId, c.getReceipt);

module.exports = { transactionRoutes, receiptRoutes };
