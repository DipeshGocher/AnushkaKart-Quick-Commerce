/** Smallest whole-rupee down payment the admin's minimum % allows for this price. */
export function minDownPaymentAmount(price, minPercent) {
  const p = Number(price) || 0;
  const pct = Number(minPercent) || 0;
  // The tiny subtraction keeps 35% of 18000 = 6300.0000000001 from becoming 6301.
  return Math.max(0, Math.ceil((p * pct) / 100 - 1e-9));
}

/**
 * Live check of what the customer typed as down payment. Returns
 * { ok, error, minAmount, percent } - `error` is shown straight away under the field.
 */
export function checkDownPayment(price, minPercent, value) {
  const p = Number(price) || 0;
  const minAmount = minDownPaymentAmount(p, minPercent);
  const raw = String(value ?? "").trim();
  if (raw === "") return { ok: false, error: "Enter your down payment.", minAmount, percent: 0 };
  const down = Number(raw);
  const percent = p > 0 ? (down / p) * 100 : 0;
  if (!Number.isFinite(down) || down < 0) return { ok: false, error: "Enter a valid down payment.", minAmount, percent };
  if (down < minAmount) {
    return { ok: false, error: `Minimum down payment is ₹${minAmount.toLocaleString("en-IN")} (${Number(minPercent)}%). Please enter at least this amount.`, minAmount, percent };
  }
  if (down >= p) return { ok: false, error: "Down payment must be less than the product price.", minAmount, percent };
  return { ok: true, error: "", minAmount, percent };
}

/**
 * Customer-side checks for the finance quotation form. The server repeats every check;
 * this only gives the customer an instant, clear message.
 * Returns an error message, or "" when the form is fine.
 */
export function validateEmiForm({ name, phone, pan, aadhaar }, { hasResult = true } = {}) {
  if (!hasResult) return "Enter your down payment and choose the EMI duration first.";
  if (String(name || "").trim().length < 2) return "Enter your full name.";
  if (!/^[6-9]\d{9}$/.test(String(phone || "").trim())) return "Enter a valid 10 digit mobile number.";
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(pan).trim().toUpperCase())) return "PAN looks wrong (example: ABCDE1234F).";
  if (aadhaar && !/^\d{12}$/.test(String(aadhaar).trim())) return "Aadhaar must be 12 digits.";
  return "";
}
