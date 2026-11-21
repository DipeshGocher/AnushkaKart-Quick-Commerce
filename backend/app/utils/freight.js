/**
 * Shiprocket answers carry the courier's charge under different names depending on the call, so look for the
 * usual ones. Returns a number (>= 0) or null when the answer has no charge.
 */
const KEYS = ["freight_charges", "freight_charge", "freight", "total_charges", "total_charge", "courier_charge", "charges", "rate"];

function pick(obj) {
  if (!obj || typeof obj !== "object") return null;
  for (const key of KEYS) {
    const value = obj[key];
    if (value === null || value === undefined || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return Math.round(n * 100) / 100;
  }
  return null;
}

export function extractFreight(payload) {
  return pick(payload) ?? pick(payload?.data) ?? pick(payload?.response) ?? pick(payload?.response?.data) ?? null;
}
