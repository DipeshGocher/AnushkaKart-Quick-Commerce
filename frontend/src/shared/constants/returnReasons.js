/**
 * Fallback copy of the return reasons (the app normally loads them from the server, which is the
 * source of truth: backend/app/constants/returnReasons.js). A test keeps the two lists identical.
 * `fault` is only used by the server (who pays the pickup fee); customers just see the labels.
 */
export const FALLBACK_RETURN_REASONS = [
  { code: "WRONG_ITEM", label: "Wrong item received", fault: "seller" },
  { code: "DAMAGED_DEFECTIVE", label: "Item is damaged or defective", fault: "seller" },
  { code: "NOT_AS_DESCRIBED", label: "Not as described / not as shown", fault: "seller" },
  { code: "MISSING_PARTS", label: "Parts or accessories missing", fault: "seller" },
  { code: "EXPIRED_SPOILT", label: "Expired or spoilt item", fault: "seller" },
  { code: "CHANGED_MIND", label: "Changed my mind", fault: "customer" },
  { code: "ORDERED_BY_MISTAKE", label: "Ordered by mistake", fault: "customer" },
  { code: "FOUND_CHEAPER", label: "Found it cheaper elsewhere", fault: "customer" },
  { code: "OTHER", label: "Other reason", fault: "customer" },
];
