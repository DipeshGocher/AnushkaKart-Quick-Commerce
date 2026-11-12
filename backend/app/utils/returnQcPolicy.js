/**
 * Single source of truth for the return QC (quality check) time rules.
 *
 *   returned ──24h──► reminder to seller
 *            ──40h──► 2nd reminder to seller
 *            ──48h──► escalated to admin   (QC "due")
 *            ──72h──► auto QC-pass + customer refund
 *   qc_failed ──48h──► dispute window closes, seller payout released
 *
 * Every number is env-overridable. Pure functions only (no DB access).
 */

const HOUR_MS = 60 * 60 * 1000;

function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getQcPolicy() {
  const dueHours = positiveNumber(process.env.RETURN_QC_DUE_HOURS, 48);
  let autoPassHours = positiveNumber(process.env.RETURN_QC_AUTO_PASS_HOURS, 72);
  // Auto-pass must always come AFTER the escalation, otherwise admin never gets a chance.
  if (autoPassHours <= dueHours) autoPassHours = dueHours + 24;
  return {
    dueHours,
    autoPassHours,
    // 24h and 40h with the defaults (50% and ~83% of the due time).
    reminderHours: [dueHours * 0.5, Math.round(dueHours * (5 / 6) * 100) / 100],
    disputeWindowHours: positiveNumber(process.env.RETURN_QC_DISPUTE_WINDOW_HOURS, 48),
  };
}

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** When the parcel reached the seller (the QC clock starts here). */
export function getQcBaseAt(order, now = new Date()) {
  return (
    toDate(order?.returnDeliveredBackAt) ||
    toDate(order?.returnDropVerifiedAt) ||
    toDate(order?.updatedAt) ||
    now
  );
}

export function getQcDeadlines(order, now = new Date()) {
  const policy = getQcPolicy();
  const baseAt = getQcBaseAt(order, now);
  const at = (hours) => new Date(baseAt.getTime() + hours * HOUR_MS);
  return {
    baseAt,
    reminderAt: policy.reminderHours.map(at),
    dueAt: at(policy.dueHours),
    autoPassAt: at(policy.autoPassHours),
  };
}

/** Which SLA stage an order has reached (see Order.returnQcReminderStage). */
export function getQcTargetStage(order, now = new Date()) {
  const { reminderAt, dueAt } = getQcDeadlines(order, now);
  if (now >= dueAt) return 3;
  if (now >= reminderAt[1]) return 2;
  if (now >= reminderAt[0]) return 1;
  return 0;
}

export function shouldAutoPass(order, now = new Date()) {
  return now >= getQcDeadlines(order, now).autoPassAt;
}

/** When the customer can no longer dispute a failed QC. */
export function getDisputeWindowEndsAt(order) {
  const qcAt = toDate(order?.returnQcAt);
  if (!qcAt) return null;
  return new Date(qcAt.getTime() + getQcPolicy().disputeWindowHours * HOUR_MS);
}

export function isDisputeOpenable(order, now = new Date()) {
  if (order?.returnStatus !== "qc_failed") return false;
  const status = order?.returnDispute?.status;
  if (status && status !== "none") return false;
  const endsAt = getDisputeWindowEndsAt(order);
  return Boolean(endsAt && now <= endsAt);
}

export const QC_NOTE_MIN_LENGTH = 10;
export const DISPUTE_REASON_MIN_LENGTH = 10;
export const MAX_EVIDENCE_IMAGES = 5;

/** Everything the UIs need to show QC / dispute state for one return. */
export function buildQcView(order, now = new Date()) {
  const policy = getQcPolicy();
  const view = {
    policy: {
      dueHours: policy.dueHours,
      autoPassHours: policy.autoPassHours,
      disputeWindowHours: policy.disputeWindowHours,
    },
  };
  if (order?.returnStatus === "returned") {
    const { dueAt, autoPassAt } = getQcDeadlines(order, now);
    view.qcDueAt = dueAt;
    view.qcAutoPassAt = autoPassAt;
    view.qcOverdue = now >= dueAt;
  }
  if (order?.returnStatus === "qc_failed") {
    view.disputeWindowEndsAt = getDisputeWindowEndsAt(order);
    view.canDispute = isDisputeOpenable(order, now);
  }
  return view;
}
