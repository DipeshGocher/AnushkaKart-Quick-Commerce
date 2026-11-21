/**
 * The customer's Wallet page: checks done on the phone before anything is sent (the server checks again).
 * The wallet holds refund money only; it can be sent to the customer's bank account or UPI id.
 */

export const MIN_WITHDRAWAL = 1;

const NAME_RE = /^[A-Za-z][A-Za-z .'-]{1,79}$/;
const ACCOUNT_RE = /^\d{9,18}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_RE = /^[a-z0-9._-]{2,64}@[a-z][a-z0-9.-]{1,63}$/;

/** Rupees as shown to people: ₹1,234.50 (no paise when whole). */
export function formatRupees(value) {
  const n = Number(value) || 0;
  const whole = Math.abs(n * 100 - Math.round(n * 100)) < 1e-9 && Math.round(n * 100) % 100 === 0;
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** The empty form, or one filled from a saved account (the account number is never sent back to the phone). */
export function emptyAccountForm(method = "bank") {
  return { method, holderName: "", bankName: "", accountNumber: "", ifsc: "", upiId: "" };
}

/** A message for the first thing wrong with the account form, else "". */
export function accountProblem(form) {
  if (form.method === "upi") {
    if (!UPI_RE.test(String(form.upiId || "").trim().toLowerCase())) return "Enter a valid UPI ID, like name@bank.";
    return "";
  }
  if (!NAME_RE.test(String(form.holderName || "").trim())) return "Enter the account holder name as it is in the bank.";
  const bank = String(form.bankName || "").trim();
  if (bank.length < 2 || bank.length > 80) return "Enter your bank name.";
  if (!ACCOUNT_RE.test(String(form.accountNumber || "").replace(/\s+/g, ""))) return "Enter a valid bank account number (9 to 18 digits).";
  if (!IFSC_RE.test(String(form.ifsc || "").trim().toUpperCase())) return "Enter a valid IFSC code (like SBIN0001234).";
  return "";
}

/** The account as the server wants it. */
export function accountPayload(form) {
  if (form.method === "upi") return { method: "upi", upiId: form.upiId.trim().toLowerCase(), holderName: (form.holderName || "").trim() };
  return {
    method: "bank",
    holderName: form.holderName.trim(),
    bankName: form.bankName.trim(),
    accountNumber: form.accountNumber.replace(/\s+/g, ""),
    ifsc: form.ifsc.trim().toUpperCase(),
  };
}

/** A message when the typed amount cannot be withdrawn, else "". */
export function amountProblem(text, balance) {
  const raw = String(text ?? "").trim();
  if (raw === "") return "Enter the amount you want to withdraw.";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "Enter the amount you want to withdraw.";
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return "The amount can have at most 2 decimal places.";
  if (n < MIN_WITHDRAWAL) return `The smallest amount you can withdraw is ${formatRupees(MIN_WITHDRAWAL)}.`;
  if (Math.round(n * 100) > Math.round((Number(balance) || 0) * 100)) return `You only have ${formatRupees(balance)} in your wallet.`;
  return "";
}

/** Only digits and one dot, at most 2 decimals, while the customer types. */
export function cleanAmountInput(text) {
  const cleaned = String(text ?? "").replace(/[^0-9.]/g, "");
  const [int, ...rest] = cleaned.split(".");
  if (!rest.length) return int;
  return `${int}.${rest.join("").slice(0, 2)}`;
}

/** What each history row says about its state. */
export function historyBadge(item) {
  if (item.kind !== "withdrawal") return null;
  if (item.status === "paid") return { text: "Paid", tone: "green" };
  if (item.status === "rejected") return { text: "Not paid, money is back", tone: "red" };
  return { text: "Waiting for payment", tone: "amber" };
}

/** "Bank •••• 9012" / "UPI rahul@oksbi" for the saved account line. */
export function accountSummary(account) {
  if (!account) return "";
  if (account.method === "upi") return `UPI ${account.upiId}`;
  return `${account.bankName || "Bank"} ${account.accountMasked ? `(${account.accountMasked.replace(/^X+/, "••••")})` : ""}`.trim();
}
