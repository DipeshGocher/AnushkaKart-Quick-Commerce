/**
 * Helpers for the admin "Payment Modes" and "Return Modes" pages and for the customer screens that
 * obey them. Pure functions, no React, so they are easy to test.
 */

export const MAX_RETURN_WINDOW_DAYS = 90;

const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);

/** The settings from the server -> plain, always-complete form values. */
export function paymentFormFromSettings(settings) {
  const pm = settings?.paymentModes || {};
  return {
    local: {
      cod: bool(pm.local?.cod, true),
      online: bool(pm.local?.online, true),
      upiQr: bool(pm.local?.upiQr, true),
    },
    shiprocket: {
      cod: bool(pm.shiprocket?.cod, true),
      online: bool(pm.shiprocket?.online, true),
      upiQr: bool(pm.shiprocket?.upiQr, true),
    },
  };
}

/** A message when the form cannot be saved (nothing is on for a delivery type), else "". */
export function paymentProblem(form) {
  const l = form?.local || {};
  const s = form?.shiprocket || {};
  if (!l.cod && !l.online && !l.upiQr) {
    return "Local delivery: keep at least one payment mode on, or customers cannot order.";
  }
  if (!s.cod && !s.online && !s.upiQr) {
    return "Shiprocket: keep at least one payment mode on, or customers cannot order courier items.";
  }
  return "";
}

/** What the server sends back when saving. */
export function paymentPayload(form) {
  return {
    local: { cod: !!form.local.cod, online: !!form.local.online, upiQr: !!form.local.upiQr },
    shiprocket: { cod: !!form.shiprocket.cod, online: !!form.shiprocket.online, upiQr: !!form.shiprocket.upiQr },
  };
}

/**
 * Payment modes allowed for THIS checkout. The server's answer for the exact cart wins
 * (`allowedPaymentModes` from the checkout preview). Without it, the admin's settings for the
 * delivery type are used. A mode that cannot be worked out stays visible, so a slow or failed
 * preview never hides every payment option; the server refuses a wrong choice when ordering.
 * Returns { cod, online, upiQr }.
 */
export function visiblePaymentModes({ preview, settings, fulfillmentType }) {
  const fromServer = preview?.allowedPaymentModes || preview?.breakdown?.allowedPaymentModes;
  if (fromServer && typeof fromServer === "object") {
    return { cod: !!fromServer.COD, online: !!fromServer.ONLINE, upiQr: !!fromServer.UPI_QR };
  }
  const form = paymentFormFromSettings(settings);
  const side = fulfillmentType === "SHIPROCKET" ? form.shiprocket : form.local;
  return { cod: side.cod, online: side.online, upiQr: side.upiQr };
}

/** The accordion that opens first: online, then QR, then cash, whichever is available. */
export function firstOpenMode(modes) {
  if (modes.online) return "online";
  if (modes.upiQr) return "upi_qr";
  if (modes.cod) return "cod";
  return null;
}

/* ───────────────────────────── return windows ───────────────────────────── */

export function returnFormFromSettings(settings) {
  const rw = settings?.returnWindows || {};
  const side = (s, fallbackValue, fallbackUnit) => ({
    value: String(s?.value ?? fallbackValue),
    unit: s?.unit === "days" || s?.unit === "hours" ? s.unit : fallbackUnit,
  });
  return { local: side(rw.local, 4, "hours"), shiprocket: side(rw.shiprocket, 7, "days") };
}

export function windowMinutes(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return n * (unit === "days" ? 1440 : 60);
}

/** One side of the form -> a message when it is not valid, else "". */
export function windowProblem(side) {
  const raw = String(side?.value ?? "").trim();
  if (raw === "") return "Type a number.";
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return "Type a whole number of 1 or more.";
  if (windowMinutes(n, side.unit) > MAX_RETURN_WINDOW_DAYS * 1440) {
    return `It cannot be longer than ${MAX_RETURN_WINDOW_DAYS} days.`;
  }
  return "";
}

export function returnProblem(form) {
  const l = windowProblem(form.local);
  if (l) return `Local delivery: ${l}`;
  const s = windowProblem(form.shiprocket);
  if (s) return `Shiprocket: ${s}`;
  return "";
}

export function returnPayload(form) {
  return {
    local: { value: Number(form.local.value), unit: form.local.unit },
    shiprocket: { value: Number(form.shiprocket.value), unit: form.shiprocket.unit },
  };
}

/** "4 hours", "1 day", "7 days": the words shown to the admin and the customer. */
export function windowLabel(value, unit) {
  const n = Number(value);
  const one = n === 1;
  if (unit === "days") return `${n} ${one ? "day" : "days"}`;
  return `${n} ${one ? "hour" : "hours"}`;
}

/** Minutes -> "90 minutes" / "4 hours" / "7 days" (whole units only, otherwise the smaller unit). */
export function labelFromMinutes(minutes) {
  const m = Math.round(Number(minutes) || 0);
  if (m >= 1440 && m % 1440 === 0) return windowLabel(m / 1440, "days");
  if (m >= 60 && m % 60 === 0) return windowLabel(m / 60, "hours");
  return `${m} minutes`;
}

/** The window (minutes) a customer's order gets, from the public settings; 4 hours / 7 days if unknown. */
export function customerReturnMinutes(settings, isShiprocket) {
  const rw = settings?.returnWindows || {};
  const side = isShiprocket ? rw.shiprocket : rw.local;
  if (side && Number.isFinite(Number(side.value)) && (side.unit === "hours" || side.unit === "days")) {
    return Number(side.value) * (side.unit === "days" ? 1440 : 60);
  }
  return isShiprocket ? 7 * 1440 : 4 * 60;
}

/**
 * Label for a customer's order, e.g. "4 hours" / "7 days". An order that already has its window
 * stored (set when it was delivered) shows THAT length, so a later change of the setting does not
 * rewrite what this customer was promised.
 */
export function customerReturnLabel(settings, isShiprocket, order = null) {
  const delivered = order?.deliveredAt ? new Date(order.deliveredAt).getTime() : NaN;
  const expires = order?.returnWindowExpiresAt ? new Date(order.returnWindowExpiresAt).getTime() : NaN;
  if (Number.isFinite(delivered) && Number.isFinite(expires) && expires > delivered) {
    return labelFromMinutes((expires - delivered) / 60000);
  }
  return labelFromMinutes(customerReturnMinutes(settings, isShiprocket));
}
