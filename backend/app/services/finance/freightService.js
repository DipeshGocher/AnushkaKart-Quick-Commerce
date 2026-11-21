/**
 * The courier's REAL freight (Shiprocket's charge, or a figure the admin types in) for a courier order:
 *
 *   forward  - the parcel going to the customer. A platform cost; it replaces the estimate (the delivery fee
 *              the customer was charged) in the platform's earning for that order.
 *   reverse  - the return parcel coming back. A platform cost, except when the return was the seller's fault:
 *              then the seller pays it (taken from their payout or wallet; whatever the wallet cannot cover is
 *              remembered and taken from their next payouts).
 *
 * The freight can become known after the refund, so what was already taken from the seller is remembered
 * (order.returnFreightApplied) and only the difference is taken or given back.
 */
import mongoose from "mongoose";
import Order from "../../models/order.js";
import { LEDGER_TRANSACTION_TYPE, OWNER_TYPE, PAYOUT_TYPE } from "../../constants/finance.js";
import { roundCurrency } from "../../utils/money.js";
import { computePlatformEarning } from "../../utils/platformEarning.js";
import { debitWalletUpTo, payBackFromAdmin } from "./walletService.js";
import { reducePendingPayoutForOrder } from "./payoutService.js";

function err(message, statusCode = 400) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}

/** Re-works the order's stored platform earning (after freight, a return, ...). Never throws. */
export async function refreshPlatformEarning(orderId, { session } = {}) {
  try {
    const order = await Order.findById(orderId).session(session || null).lean();
    if (!order || !["delivered", "returned"].includes(order.status)) return null;
    const earning = computePlatformEarning(order);
    await Order.updateOne(
      { _id: order._id },
      { $set: { "platformEarning.net": earning.net, "platformEarning.parts": earning.parts, "platformEarning.updatedAt": new Date() } },
      session ? { session } : {},
    );
    return earning;
  } catch {
    return null;
  }
}

/** Takes (or gives back) the difference between the real return freight and what was already taken from the seller. */
export async function applyReturnFreightToSeller(orderId) {
  let result = { delta: 0, skipped: true };
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(
      async () => {
        result = { delta: 0, skipped: true };
        const order = await Order.findById(orderId).session(session);
        if (!order || order.fulfillmentType !== "SHIPROCKET") return;
        if (order.returnStatus !== "refund_completed" || order.returnFault !== "seller" || !order.seller) return;
        const freight = order.returnFreightCharge;
        if (freight === null || freight === undefined) return;

        const target = roundCurrency(freight);
        const applied = roundCurrency(order.returnFreightApplied || 0);
        const delta = roundCurrency(target - applied);
        if (delta === 0) return;
        const key = `RFR-${order._id}-${applied}-${target}`;
        const meta = { orderId: order.orderId };

        if (delta > 0) {
          let remaining = delta;
          let fromPayout = 0;
          const reduced = await reducePendingPayoutForOrder(order._id, PAYOUT_TYPE.SELLER, remaining, {
            remarks: `Return courier freight (₹${delta}) taken off this payout.`,
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
              ledgerType: LEDGER_TRANSACTION_TYPE.SELLER_RETURN_FREIGHT,
              ledgerReference: `RFR-${order.orderId}`,
              ledgerDescription: "Courier freight of a return that was the seller's fault",
              orderId: order._id,
              idempotencyKey: key,
              metadata: meta,
              creditAdmin: true,
            });
            fromWallet = taken.debited;
            owed = taken.shortfall;
          }
          result = { delta, skipped: false, fromPayout, fromWallet, owed };
          await Order.updateOne(
            { _id: order._id },
            { $inc: { "returnFinance.sellerCharged": delta, "returnFinance.owedBySeller": owed, "returnFinance.fromWallet": fromWallet, "returnFinance.fromPendingPayout": fromPayout } },
            { session },
          );
        } else {
          const back = roundCurrency(-delta);
          await payBackFromAdmin({
            ownerType: OWNER_TYPE.SELLER,
            ownerId: order.seller,
            amount: back,
            bucket: "available",
            session,
            ledgerType: LEDGER_TRANSACTION_TYPE.SELLER_RETURN_FREIGHT_REVERSED,
            ledgerReference: `RFR-${order.orderId}`,
            ledgerDescription: "Courier freight of a return given back to the seller",
            orderId: order._id,
            idempotencyKey: key,
            metadata: meta,
          });
          result = { delta, skipped: false, returned: back };
          await Order.updateOne({ _id: order._id }, { $inc: { "returnFinance.sellerCharged": delta } }, { session });
        }
        await Order.updateOne(
          { _id: order._id },
          { $set: { returnFreightApplied: target, "returnFinance.pickupFee": target, "returnFinance.pickupFeePayer": "seller" } },
          { session },
        );
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } finally {
    session.endSession();
  }
  return result;
}

/**
 * The admin types in the real freight (or it came from Shiprocket).
 * @param {{ type: "forward"|"reverse", amount: number, source?: string }} p
 */
export async function recordFreight(orderId, { type, amount, source = "admin" } = {}) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) throw err("Enter the freight amount (0 or more).");
  if (!["forward", "reverse"].includes(type)) throw err('type must be "forward" or "reverse".');
  const query = mongoose.Types.ObjectId.isValid(orderId) ? { _id: orderId } : { orderId };
  const order = await Order.findOne(query);
  if (!order) throw err("Order not found", 404);
  if (order.fulfillmentType !== "SHIPROCKET") throw err("This is not a courier (Shiprocket) order.");

  const rounded = roundCurrency(value);
  if (type === "forward") {
    if (!order.shiprocket) order.shiprocket = { history: [] };
    order.shiprocket.freightCharge = rounded;
    await order.save();
    const earning = await refreshPlatformEarning(order._id);
    return { type, amount: rounded, earning };
  }
  order.returnFreightCharge = rounded;
  order.returnFreightSource = source;
  await order.save();
  const applied = await applyReturnFreightToSeller(order._id);
  const earning = await refreshPlatformEarning(order._id);
  return { type, amount: rounded, applied, earning };
}
