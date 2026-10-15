// MOCK payment gateway for development. It pretends to talk to a bank.
// To go live you would replace charge() with a real gateway SDK (Razorpay, Stripe, ...).
// In a real gateway the student types card/UPI details on the GATEWAY's page, never on ours,
// so this server never sees or stores card numbers, CVV or UPI PINs.
const crypto = require('crypto');

function charge({ simulateFailure = false }) {
  if (simulateFailure) {
    return { success: false, gatewayReference: null, reason: 'Payment declined by the bank (simulated).' };
  }
  return { success: true, gatewayReference: `MOCK-${crypto.randomInt(1000000000, 9999999999)}` };
}

module.exports = { charge };
