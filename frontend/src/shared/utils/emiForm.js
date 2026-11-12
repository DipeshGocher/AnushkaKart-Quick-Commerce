/**
 * Customer-side checks for the finance quotation form. The server repeats every check;
 * this only gives the customer an instant, clear message.
 * Returns an error message, or "" when the form is fine.
 */
export function validateEmiForm({ name, phone, pan, aadhaar, imei1, imei2 }, { hasResult = true } = {}) {
  if (!hasResult) return "Enter your down payment and choose the EMI duration first.";
  if (String(name || "").trim().length < 2) return "Enter your full name.";
  if (!/^[6-9]\d{9}$/.test(String(phone || "").trim())) return "Enter a valid 10 digit mobile number.";
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(pan).trim().toUpperCase())) return "PAN looks wrong (example: ABCDE1234F).";
  if (aadhaar && !/^\d{12}$/.test(String(aadhaar).trim())) return "Aadhaar must be 12 digits.";
  if (imei1 && !/^\d{15}$/.test(String(imei1).trim())) return "IMEI 1 must be 15 digits.";
  if (imei2 && !/^\d{15}$/.test(String(imei2).trim())) return "IMEI 2 must be 15 digits.";
  if (imei1 && imei2 && String(imei1).trim() === String(imei2).trim()) return "IMEI 1 and IMEI 2 must be different.";
  return "";
}
