import { ORDER_SETTLEMENT_STATUS } from "../../constants/finance.js";

/**
 * Roll the per-party settlement flags up into `settlementStatus.overall`.
 * Shared by delivery settlement and payout processing so the overall status
 * moves to COMPLETED once the last party is paid.
 */
export function computeOverallSettlement(order) {
  const settlement = order.settlementStatus || {};
  const sellerDone = settlement.sellerPayout === "COMPLETED";
  const riderDone =
    settlement.riderPayout === "COMPLETED" ||
    settlement.riderPayout === "NOT_APPLICABLE";
  const adminDone = Boolean(settlement.adminEarningCredited);

  if (sellerDone && riderDone && adminDone) {
    settlement.overall = ORDER_SETTLEMENT_STATUS.COMPLETED;
    if (!settlement.reconciledAt) settlement.reconciledAt = new Date();
  } else if (sellerDone || riderDone || adminDone) {
    settlement.overall = ORDER_SETTLEMENT_STATUS.PARTIAL;
  } else {
    settlement.overall = ORDER_SETTLEMENT_STATUS.PENDING;
  }
  return settlement;
}
