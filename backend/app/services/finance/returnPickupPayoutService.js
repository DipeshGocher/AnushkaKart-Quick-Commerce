/**
 * The delivery partner's commission for picking up a LOCAL return, paid the same way as a delivery commission:
 * a payout record (ledger rows, one only per order) that the payout job moves into the partner's wallet.
 * Before, the amount was credited straight to the wallet in the background, with no ledger and no protection
 * against being paid twice.
 *
 * It is owed as soon as the pickup is done (the rider did the work), whatever the quality check decides later.
 * Who bears the cost (the seller when the return is the seller's fault, else the platform) is settled at the
 * refund (see returnMoney.js).
 */
import Order from "../../models/order.js";
import Transaction from "../../models/transaction.js";
import { PAYOUT_TYPE } from "../../constants/finance.js";
import { roundCurrency } from "../../utils/money.js";
import { createPendingPayoutForOrder } from "./payoutService.js";

export async function createReturnPickupRiderPayout(order, { session } = {}) {
  const riderId = order?.returnDeliveryBoy;
  const commission = roundCurrency(order?.returnDeliveryCommission || 0);
  if (!riderId || commission <= 0) return null;

  const payout = await createPendingPayoutForOrder(
    {
      order,
      payoutType: PAYOUT_TYPE.DELIVERY_PARTNER,
      beneficiaryId: riderId,
      amount: commission,
      flow: "return_pickup",
      remarks: "Commission for a return pickup.",
      metadata: { flow: "return_pickup" },
    },
    { session },
  );

  // What the rider's earnings screen lists (one row per order).
  await Transaction.findOneAndUpdate(
    { reference: `RET-PICK-${order.orderId}` },
    {
      $setOnInsert: {
        user: riderId,
        userModel: "Delivery",
        order: order._id,
        type: "Delivery Earning",
        amount: commission,
        status: "Settled",
        reference: `RET-PICK-${order.orderId}`,
        meta: { flow: "return_pickup_commission" },
      },
    },
    { upsert: true, ...(session ? { session } : {}) },
  );

  await Order.updateOne({ _id: order._id }, { $set: { "financeFlags.returnPickupCommissionPaid": true } }, session ? { session } : {});
  return payout;
}
