/**
 * Time rules for UPI QR orders that are waiting for payment verification.
 *
 *   order placed (stock reserved)
 *      ├─ no UTR within NO_UTR hours (24h)          -> auto-cancel, stock released
 *      └─ UTR submitted -> admin must verify within APPROVAL hours (48h)
 *             └─ not verified in time               -> auto-cancel, stock released (NO refund: payment was never verified)
 *   admin rejects the payment -> customer gets NO_UTR hours to send a correct UTR
 *
 * The deadline is STORED on the order (`upiApprovalExpiresAt`), so orders that existed
 * before this feature have no deadline and are never auto-cancelled.
 * Pure functions, env-overridable.
 */

const HOUR_MS = 60 * 60 * 1000;

function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getUpiApprovalPolicy() {
  return {
    approvalHours: positiveNumber(process.env.UPI_QR_APPROVAL_HOURS, 48),
    noUtrHours: positiveNumber(process.env.UPI_QR_NO_UTR_HOURS, 24),
  };
}

/** Deadline for an order that has a UTR waiting for admin verification. */
export function expiryAfterUtrSubmitted(now = new Date()) {
  return new Date(now.getTime() + getUpiApprovalPolicy().approvalHours * HOUR_MS);
}

/** Deadline for an order that is waiting for the customer to pay / send a (new) UTR. */
export function expiryWaitingForUtr(now = new Date()) {
  return new Date(now.getTime() + getUpiApprovalPolicy().noUtrHours * HOUR_MS);
}
