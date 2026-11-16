/**
 * Why a customer returns something, and whose fault that is. The fault decides who pays the
 * return-pickup fee (see services/order/returnMoney.js):
 *   "seller"   -> the seller's mistake (wrong / damaged / not as described ...): the seller pays the pickup fee
 *   "customer" -> the customer's own choice (changed mind, ordered by mistake ...): the platform pays it
 *   "unknown"  -> old orders / clients that sent no reason code: the platform pays it
 */
export const RETURN_FAULT = Object.freeze({ SELLER: "seller", CUSTOMER: "customer", UNKNOWN: "unknown" });

export const RETURN_REASONS = Object.freeze([
  { code: "WRONG_ITEM", label: "Wrong item received", fault: RETURN_FAULT.SELLER },
  { code: "DAMAGED_DEFECTIVE", label: "Item is damaged or defective", fault: RETURN_FAULT.SELLER },
  { code: "NOT_AS_DESCRIBED", label: "Not as described / not as shown", fault: RETURN_FAULT.SELLER },
  { code: "MISSING_PARTS", label: "Parts or accessories missing", fault: RETURN_FAULT.SELLER },
  { code: "EXPIRED_SPOILT", label: "Expired or spoilt item", fault: RETURN_FAULT.SELLER },
  { code: "CHANGED_MIND", label: "Changed my mind", fault: RETURN_FAULT.CUSTOMER },
  { code: "ORDERED_BY_MISTAKE", label: "Ordered by mistake", fault: RETURN_FAULT.CUSTOMER },
  { code: "FOUND_CHEAPER", label: "Found it cheaper elsewhere", fault: RETURN_FAULT.CUSTOMER },
  { code: "OTHER", label: "Other reason", fault: RETURN_FAULT.CUSTOMER },
]);

/** The reason for a code, or null when the code is not one of ours. */
export function findReturnReason(code) {
  const key = String(code || "").trim().toUpperCase();
  return RETURN_REASONS.find((r) => r.code === key) || null;
}

/** Fault for a stored code (`unknown` when there is none). */
export function faultForReasonCode(code) {
  return findReturnReason(code)?.fault || RETURN_FAULT.UNKNOWN;
}
