/**
 * Display helpers for the return QC clock and customer disputes.
 * The server computes every deadline (`return.qc`); this file only turns them into words.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

export const QC_NOTE_MIN_LENGTH = 10;
export const DISPUTE_REASON_MIN_LENGTH = 10;

/** "5h 20m", "45m", "2d 3h" for a duration in ms (always >= 1m). */
export function formatDuration(ms) {
  const total = Math.max(MIN, Math.round(ms / MIN) * MIN);
  const days = Math.floor(total / (24 * HOUR));
  const hours = Math.floor((total % (24 * HOUR)) / HOUR);
  const minutes = Math.floor((total % HOUR) / MIN);
  if (days > 0) return hours ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

function toTime(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * What the seller / admin should see for a return that is waiting for QC.
 * Returns null when QC is not pending.
 */
export function getQcCountdown(ret, now = Date.now()) {
  if (ret?.returnStatus !== "returned" || !ret?.qc) return null;
  const due = toTime(ret.qc.qcDueAt);
  const autoPass = toTime(ret.qc.qcAutoPassAt);
  if (!due || !autoPass) return null;

  if (now >= autoPass) {
    return { tone: "danger", label: "Auto-approving now", detail: "QC time is over. The customer is being refunded." };
  }
  if (now >= due) {
    return {
      tone: "danger",
      label: `Overdue - auto-refund in ${formatDuration(autoPass - now)}`,
      detail: "Complete the QC now, otherwise the customer is refunded automatically.",
    };
  }
  const left = due - now;
  return {
    tone: left <= 8 * HOUR ? "warning" : "info",
    label: `QC due in ${formatDuration(left)}`,
    detail: `Customer is refunded automatically if QC is not done within ${ret.qc.policy?.autoPassHours ?? 72} hours.`,
  };
}

/** Dispute state of a failed-QC return, for any panel. */
export function getDisputeInfo(ret, now = Date.now()) {
  if (ret?.returnStatus !== "qc_failed" && ret?.returnDispute?.status !== "overturned") return null;
  const status = ret?.returnDispute?.status || "none";
  const endsAt = toTime(ret?.qc?.disputeWindowEndsAt);

  if (status === "open") return { status, label: "Dispute open - admin reviewing", tone: "warning" };
  if (status === "upheld") return { status, label: "Dispute rejected - QC result stands", tone: "neutral" };
  if (status === "overturned") return { status, label: "Dispute accepted - refunded", tone: "success" };
  if (ret?.qc?.canDispute && endsAt && endsAt > now) {
    return { status: "window", label: `Customer can dispute for ${formatDuration(endsAt - now)}`, tone: "info" };
  }
  return { status: "closed", label: "Dispute window closed", tone: "neutral" };
}

/** Plain words for who made the QC call. */
export function getQcDeciderLabel(ret) {
  if (ret?.returnQcAutoPassed || ret?.returnQcByRole === "system") return "Auto-approved (QC time ran out)";
  if (ret?.returnQcByRole === "admin") return "Checked by admin";
  if (ret?.returnQcByRole === "seller") return "Checked by seller";
  return "";
}
