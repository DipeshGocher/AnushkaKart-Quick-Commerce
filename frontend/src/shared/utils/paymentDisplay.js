/**
 * Plain-language payment info for an order: HOW the customer pays (UPI QR /
 * Cash on Delivery / Online) and a short status ("Paid", "Pay on delivery", ...).
 * Pure function - the UI decides icons and colours from `kind` and `tone`.
 */

const PAID_STATUSES = new Set(["PAID", "CASH_COLLECTED", "COD_RECONCILED"]);

export function getPaymentKind(order) {
  const mode = String(order?.paymentMode || "").toUpperCase();
  if (mode === "UPI_QR" || mode === "UPI") return "upi";
  if (mode === "COD") return "cod";
  if (mode === "ONLINE") return "online";
  // Legacy orders without paymentMode
  const method = String(order?.payment?.method || "").toLowerCase();
  if (method === "upi_qr") return "upi";
  if (method === "cash" || method === "cod") return "cod";
  return "online";
}

const METHOD_LABELS = {
  upi: "UPI QR",
  cod: "Cash on Delivery",
  online: "Online Payment",
};

export function getPaymentDisplay(order) {
  const kind = getPaymentKind(order);
  const status = String(order?.paymentStatus || "").toUpperCase();
  const legacyDone = String(order?.payment?.status || "").toLowerCase() === "completed";

  let statusLabel;
  let tone;
  if (PAID_STATUSES.has(status) || (!status && legacyDone)) {
    statusLabel = "Paid";
    tone = "success";
  } else if (status === "REFUNDED") {
    statusLabel = "Refunded";
    tone = "info";
  } else if (status === "REJECTED" || status === "FAILED") {
    statusLabel = "Failed";
    tone = "danger";
  } else if (status === "PENDING_CASH_COLLECTION" || (kind === "cod" && !status)) {
    statusLabel = "Pay on delivery";
    tone = "warning";
  } else if (status === "PARTIALLY_REMITTED") {
    statusLabel = "Partly paid";
    tone = "warning";
  } else if (status === "AWAITING_VERIFICATION") {
    statusLabel = "Verifying";
    tone = "warning";
  } else {
    statusLabel = "Payment pending";
    tone = "warning";
  }

  return {
    kind,
    methodLabel: METHOD_LABELS[kind],
    statusLabel,
    tone,
    // The UTR is only interesting for UPI QR payments
    showUtr: kind === "upi",
  };
}
