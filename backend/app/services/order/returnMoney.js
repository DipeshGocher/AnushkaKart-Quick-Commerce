/**
 * Who gets / gives how much when a return is accepted (QC passed). Pure: no database.
 *
 * Rules:
 *  - The CUSTOMER is refunded the price of the returned items (delivery / platform fees are not refunded).
 *  - The ADMIN gives back the commission it earned on the returned items (online orders; on COD the
 *    commission was never booked, so there is nothing to take back).
 *  - The SELLER gives back what they had earned on the returned items (price minus that commission),
 *    NOT the full price. For a partial return only the returned items count.
 *  - The return PICKUP FEE (the rider's commission) is paid by the seller when the return is the
 *    seller's fault (wrong / damaged / not as described ...), otherwise by the platform.
 *
 * Per-item numbers come from paymentBreakdown.lineItems (stored when the order was placed). Old orders
 * without them are split by price, so they still work.
 */
import { RETURN_FAULT } from "../../constants/returnReasons.js";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const idOf = (v) => String((v && v._id) || v || "");

/** The stored line for an order item: same position first, then the same product. */
function findLine(lines, index, item) {
  if (!Array.isArray(lines) || !lines.length) return null;
  const pid = idOf(item?.product);
  const atIndex = lines[index];
  if (atIndex && (!pid || !atIndex.productId || idOf(atIndex.productId) === pid)) return atIndex;
  return lines.find((l) => idOf(l?.productId) === pid) || null;
}

export function computeReturnMoney(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const lines = order?.paymentBreakdown?.lineItems;
  const returned = Array.isArray(order?.returnItems) ? order.returnItems : [];

  const productSubtotal =
    num(order?.paymentBreakdown?.productSubtotal) ||
    items.reduce((a, i) => a + num(i.price) * num(i.quantity), 0);
  const sellerPayoutTotal = num(order?.paymentBreakdown?.sellerPayoutTotal);
  const adminCommissionTotal = num(order?.paymentBreakdown?.adminProductCommissionTotal);

  let refundAmount = 0;
  let sellerShare = 0;
  let adminCommission = 0;

  for (const r of returned) {
    const index = Number.isInteger(r?.itemIndex)
      ? r.itemIndex
      : items.findIndex((i) => idOf(i.product) === idOf(r?.product));
    const original = items[index];
    const orderedQty = Math.max(1, num(original?.quantity) || num(r?.quantity) || 1);
    const qty = Math.min(num(r?.quantity) || orderedQty, orderedQty);
    const unitPrice = num(r?.price ?? original?.price);
    const value = round2(unitPrice * qty);
    refundAmount += value;

    const line = findLine(lines, index, original);
    if (line && num(line.itemSubtotal) > 0) {
      const fraction = qty / Math.max(1, num(line.quantity) || orderedQty);
      sellerShare += round2(num(line.sellerPayout) * fraction);
      adminCommission += round2(num(line.adminProductCommission) * fraction);
    } else if (productSubtotal > 0) {
      // Old order without per-item numbers: split by price.
      const share = value / productSubtotal;
      const sellerPart = sellerPayoutTotal > 0 ? sellerPayoutTotal * share : value;
      sellerShare += round2(sellerPart);
      adminCommission += round2(
        adminCommissionTotal > 0 ? adminCommissionTotal * share : Math.max(0, value - sellerPart),
      );
    } else {
      sellerShare += value;
    }
  }

  refundAmount = round2(refundAmount);
  sellerShare = round2(Math.min(sellerShare, refundAmount));
  adminCommission = round2(adminCommission);

  // The commission is only booked as admin earning for online orders, and only if it was booked.
  const adminCredited = order?.paymentMode !== "COD" && Boolean(order?.financeFlags?.adminEarningCredited);
  const platformEarning = num(order?.paymentBreakdown?.platformTotalEarning);
  const adminCommissionReversed = adminCredited ? round2(Math.min(adminCommission, platformEarning || adminCommission)) : 0;

  const pickupFee = round2(num(order?.returnDeliveryCommission));
  const fault = order?.returnFault || RETURN_FAULT.UNKNOWN;
  const pickupFeePayer = fault === RETURN_FAULT.SELLER ? "seller" : "platform";
  const sellerCharged = round2(sellerShare + (pickupFeePayer === "seller" ? pickupFee : 0));

  return {
    refundAmount,
    sellerShare,
    adminCommission,
    adminCommissionReversed,
    pickupFee,
    pickupFeePayer,
    sellerCharged,
    fault,
  };
}

/**
 * What a Returns page shows: the money split that applies if the return is accepted, or what really
 * happened once the refund is done. Admin sees everything; a seller sees only their own side.
 */
export function buildReturnMoneyView(order, { role = "admin" } = {}) {
  if (!order || !order.returnStatus || order.returnStatus === "none") return null;
  const applied = order.returnFinance && order.returnFinance.appliedAt ? order.returnFinance : null;
  const planned = computeReturnMoney(order);
  const m = applied || planned;
  const view = {
    status: applied ? "applied" : ["qc_failed", "return_rejected"].includes(order.returnStatus) ? "not_refunded" : "if_qc_passes",
    refundAmount: round2(m.refundAmount),
    sellerShare: round2(m.sellerShare),
    pickupFee: round2(m.pickupFee),
    pickupFeePayer: m.pickupFeePayer,
    sellerCharged: round2(m.sellerCharged),
    adminCommission: round2(m.adminCommission),
    adminCommissionReversed: round2(m.adminCommissionReversed),
    fromPendingPayout: round2((applied && applied.fromPendingPayout) || 0),
    fromWallet: round2((applied && applied.fromWallet) || 0),
    owedBySeller: round2((applied && applied.owedBySeller) || 0),
    payoutAction: (applied && applied.payoutAction) || null,
    fault: planned.fault,
  };
  if (role === "seller") {
    delete view.adminCommission;
    delete view.adminCommissionReversed;
  }
  if (role === "customer") {
    return { status: view.status, refundAmount: view.refundAmount };
  }
  return view;
}
