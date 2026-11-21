import Transaction from "../models/transaction.js";
import {
  handleCodOrderFinance,
  recordCourierCodCollected,
  settleDeliveredOrder,
} from "./finance/orderFinanceService.js";

/**
 * Financial side effects when order becomes delivered (mirrors orderController).
 */
export async function applyDeliveredSettlement(order, orderIdString) {
  const settled = await settleDeliveredOrder(order._id);

  const method = (order.payment?.method || "").toLowerCase();
  const isCod = settled.paymentMode === "COD" || method === "cash" || method === "cod";
  if (isCod && settled.deliveryBoy && !settled.financeFlags?.codMarkedCollected) {
    await handleCodOrderFinance(settled._id, {
      deliveryPartnerId: settled.deliveryBoy,
    });
  }

  // Courier (Shiprocket) COD: no rider, the courier holds the cash until it pays it out.
  if (isCod && !settled.deliveryBoy && settled.fulfillmentType === "SHIPROCKET" && !settled.financeFlags?.codMarkedCollected) {
    await recordCourierCodCollected(settled._id);
  }

  // Legacy transaction compatibility for existing seller/rider dashboards.
  await Transaction.updateMany(
    { reference: orderIdString, userModel: "Seller" },
    { status: "Settled" },
  );

  if (settled.deliveryBoy) {
    const deliveryEarning = Math.round(settled.paymentBreakdown?.riderPayoutTotal || 0);
    const deliveryMeta = {
      tipAmount: Math.round(settled.paymentBreakdown?.riderTipAmount || 0),
      payoutBase: Math.round(settled.paymentBreakdown?.riderPayoutBase || 0),
      payoutDistance: Math.round(settled.paymentBreakdown?.riderPayoutDistance || 0),
      payoutBonus: Math.round(settled.paymentBreakdown?.riderPayoutBonus || 0),
    };
    await Transaction.findOneAndUpdate(
      { reference: `DEL-ERN-${orderIdString}` },
      {
        $set: {
          amount: deliveryEarning,
          status: "Settled",
          meta: deliveryMeta,
        },
        $setOnInsert: {
          user: settled.deliveryBoy,
          userModel: "Delivery",
          order: settled._id,
          type: "Delivery Earning",
          reference: `DEL-ERN-${orderIdString}`,
        },
      },
      { upsert: true, new: true },
    );

    if (isCod) {
      // The cash the rider really holds for the platform: the order total minus his own commission, which he
      // keeps (this is what he hands over, and what the admin's Collect Cash screen must show).
      const Order = (await import("../models/order.js")).default;
      const fresh = await Order.findById(settled._id).select("paymentBreakdown").lean();
      const cashHeld = Number(fresh?.paymentBreakdown?.codCollectedAmount || 0) ||
        Number(settled.paymentBreakdown?.grandTotal || settled.pricing?.total || 0);
      await Transaction.findOneAndUpdate(
        { reference: `CASH-COL-${orderIdString}` },
        {
          $setOnInsert: {
            user: settled.deliveryBoy,
            userModel: "Delivery",
            order: settled._id,
            type: "Cash Collection",
            amount: cashHeld,
            status: "Settled",
            reference: `CASH-COL-${orderIdString}`,
          },
        },
        { upsert: true, new: true },
      );
    }
  }
}
