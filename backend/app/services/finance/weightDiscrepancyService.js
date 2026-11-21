/**
 * Shiprocket sometimes charges extra for parcel weight AFTER the parcel is delivered. The seller entered the
 * weight, so the seller pays: the extra charge is taken off their payout.
 *
 *   - Not delivered / paid out yet: nothing to do here, the payout is created already reduced.
 *   - Payout created but not paid (on hold / pending): the payout is made smaller.
 *   - Payout already paid: the amount is taken from the seller's wallet, and whatever the wallet cannot
 *     cover is remembered (wallet.recoverableDue) and taken from their next payouts.
 *
 * `order.shiprocket.weightDiscrepancyApplied` remembers how much was already taken, so repeating the same
 * amount does nothing, a larger amount takes only the difference, and a smaller amount (or 0 = waived by
 * the admin) gives the difference back.
 */
import mongoose from "mongoose";
import Order from "../../models/order.js";
import Payout from "../../models/payout.js";
import { LEDGER_TRANSACTION_TYPE, OWNER_TYPE, PAYOUT_STATUS, PAYOUT_TYPE } from "../../constants/finance.js";
import { roundCurrency } from "../../utils/money.js";
import { creditWallet, debitWalletUpTo, payBackFromAdmin } from "./walletService.js";
import { reducePendingPayoutForOrder } from "./payoutService.js";
import { emitNotificationEvent } from "../../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../../modules/notifications/notification.constants.js";

export async function applyWeightDiscrepancyToSeller(orderId) {
  let result = { delta: 0, skipped: false };
  let notify = null;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(
      async () => {
        result = { delta: 0, skipped: false };
        notify = null;
        const order = await Order.findById(orderId).session(session);
        if (!order) return;
        const amount = roundCurrency(order.shiprocket?.weightDiscrepancyAmount || 0);
        const applied = roundCurrency(order.shiprocket?.weightDiscrepancyApplied || 0);
        const delta = roundCurrency(amount - applied);
        if (delta === 0) return;
        // Before delivery settlement the payout does not exist yet; it is created already reduced.
        if (!order.financeFlags?.deliveredSettlementApplied || !order.seller) {
          result = { delta, skipped: true };
          return;
        }
        const key = `WGT-${order._id}-${applied}-${amount}`;
        const meta = { orderId: order.orderId, reason: order.shiprocket?.weightDiscrepancyReason || "" };

        if (delta > 0) {
          let remaining = delta;
          let fromPayout = 0;
          const reduced = await reducePendingPayoutForOrder(order._id, PAYOUT_TYPE.SELLER, remaining, {
            remarks: `Courier weight charge (₹${delta}) taken off this payout.`,
            session,
          });
          if (reduced.mode) {
            fromPayout = reduced.reducedBy;
            remaining = roundCurrency(Math.max(0, remaining - fromPayout));
            if (reduced.mode === "cancelled") {
              await Order.updateOne({ _id: order._id }, { $set: { "settlementStatus.sellerPayout": "CANCELLED" } }, { session });
            }
          }
          let fromWallet = 0;
          let owed = 0;
          if (remaining > 0) {
            const taken = await debitWalletUpTo({
              ownerType: OWNER_TYPE.SELLER,
              ownerId: order.seller,
              amount: remaining,
              session,
              ledgerType: LEDGER_TRANSACTION_TYPE.SELLER_WEIGHT_PENALTY,
              ledgerReference: `WGT-${order.orderId}`,
              ledgerDescription: "Courier weight charge taken from the seller",
              orderId: order._id,
              idempotencyKey: key,
              metadata: meta,
              creditAdmin: true,
            });
            fromWallet = taken.debited;
            owed = taken.shortfall;
          }
          result = { delta, skipped: false, fromPayout, fromWallet, owed };
          notify = { amount: delta, reason: meta.reason };
        } else {
          const back = roundCurrency(-delta);
          // If the seller's payout is still waiting to be paid, the money goes back INTO that payout (so it
          // is still released only when the return window closes); otherwise it goes to their wallet.
          const waiting = await Payout.findOne({
            relatedOrderIds: order._id,
            payoutType: PAYOUT_TYPE.SELLER,
            status: { $in: [PAYOUT_STATUS.PENDING, PAYOUT_STATUS.PROCESSING] },
          }).session(session);
          if (waiting) {
            waiting.amount = roundCurrency(waiting.amount + back);
            await waiting.save({ session });
          }
          const give = waiting ? creditWallet : payBackFromAdmin;
          await give({
            ownerType: OWNER_TYPE.SELLER,
            ownerId: order.seller,
            amount: back,
            bucket: waiting ? "pending" : "available",
            session,
            ledgerType: LEDGER_TRANSACTION_TYPE.SELLER_WEIGHT_PENALTY_REVERSED,
            ledgerReference: `WGT-${order.orderId}`,
            ledgerDescription: "Courier weight charge given back to the seller",
            orderId: order._id,
            idempotencyKey: key,
            metadata: meta,
          });
          result = { delta, skipped: false, returned: back };
        }
        await Order.updateOne({ _id: order._id }, { $set: { "shiprocket.weightDiscrepancyApplied": amount } }, { session });
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } finally {
    session.endSession();
  }
  if (notify) {
    const order = await Order.findById(orderId).select("orderId seller").lean();
    emitNotificationEvent(NOTIFICATION_EVENTS.WEIGHT_DISCREPANCY_APPLIED, {
      orderId: order?.orderId,
      sellerId: order?.seller,
      data: notify,
    });
  }
  return result;
}
