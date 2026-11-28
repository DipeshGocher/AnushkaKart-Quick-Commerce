import mongoose from "mongoose";
import Order from "../../models/order.js";
import {
  LEDGER_DIRECTION,
  LEDGER_TRANSACTION_TYPE,
  ORDER_PAYMENT_STATUS,
  ORDER_SETTLEMENT_STATUS,
  OWNER_TYPE,
  PAYOUT_TYPE,
} from "../../constants/finance.js";
import { addMoney, roundCurrency } from "../../utils/money.js";
import { computeReturnWindowDates } from "../../utils/returnWindow.js";
import { createLedgerEntry } from "./ledgerService.js";
import { createFinanceAuditLog } from "./auditLogService.js";
import {
  applyRecoverableDue,
  creditWallet,
  getOrCreateWallet,
  updateCashInHand,
} from "./walletService.js";
import { createPendingPayoutForOrder } from "./payoutService.js";
import { computeOverallSettlement } from "./settlementStatus.js";
import { computePlatformEarning } from "../../utils/platformEarning.js";
import { emitNotificationEvent } from "../../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../../modules/notifications/notification.constants.js";

function toOrderIdQuery(orderOrId) {
  if (!orderOrId) return null;
  if (typeof orderOrId === "object" && orderOrId._id) {
    return { _id: orderOrId._id };
  }
  if (mongoose.Types.ObjectId.isValid(orderOrId)) {
    return { _id: new mongoose.Types.ObjectId(orderOrId) };
  }
  return { orderId: String(orderOrId) };
}

async function findOrderForUpdate(orderOrId, session) {
  const query = toOrderIdQuery(orderOrId);
  if (!query) {
    throw new Error("Order not found");
  }
  const order = await Order.findOne(query, null, { session });
  if (!order) {
    throw new Error("Order not found");
  }
  // Backward-compat: older / partially-upgraded orders may have paymentBreakdown without snapshots.
  // Mongoose will throw a cast error on save if `paymentBreakdown.snapshots` is undefined.
  if (order.paymentBreakdown) {
    const snapshots = order.paymentBreakdown.snapshots;
    if (!snapshots || typeof snapshots !== "object") {
      order.paymentBreakdown.snapshots = {
        deliverySettings: {},
        categoryCommissionSettings: [],
        handlingFeeStrategy: null,
        handlingCategoryUsed: {},
      };
    }
  }
  return order;
}

function syncLegacyPricing(order) {
  const breakdown = order.paymentBreakdown || {};
  order.pricing = {
    subtotal: breakdown.productSubtotal || order.pricing?.subtotal || 0,
    deliveryFee: breakdown.deliveryFeeCharged || order.pricing?.deliveryFee || 0,
    platformFee: breakdown.handlingFeeCharged || order.pricing?.platformFee || 0,
    codFee: breakdown.codFeeCharged || order.pricing?.codFee || 0,
    gst: breakdown.taxTotal || order.pricing?.gst || 0,
    tip: breakdown.tipTotal || order.pricing?.tip || 0,
    discount: breakdown.discountTotal || order.pricing?.discount || 0,
    total: breakdown.grandTotal || order.pricing?.total || 0,
    walletAmount: breakdown.walletAmount || order.pricing?.walletAmount || 0,
  };
}

function ensurePaymentBreakdownSnapshots(order) {
  if (!order?.paymentBreakdown) return;
  const snapshots = order.paymentBreakdown.snapshots;
  if (snapshots && typeof snapshots === "object") return;
  order.paymentBreakdown.snapshots = {
    deliverySettings: {},
    categoryCommissionSettings: [],
    handlingFeeStrategy: null,
    handlingCategoryUsed: {},
  };
}

export function freezeFinancialSnapshot(order, breakdown) {
  if (!order || !breakdown) return order;

  const sanitized = { ...breakdown };
  if (!sanitized.snapshots || typeof sanitized.snapshots !== "object") {
    sanitized.snapshots = {
      deliverySettings: {},
      categoryCommissionSettings: [],
      handlingFeeStrategy: null,
      handlingCategoryUsed: {},
    };
  }

  order.paymentBreakdown = {
    ...sanitized,
    codCollectedAmount: roundCurrency(sanitized.codCollectedAmount || 0),
    codRemittedAmount: roundCurrency(sanitized.codRemittedAmount || 0),
    codPendingAmount: roundCurrency(sanitized.codPendingAmount || 0),
    walletAmount: roundCurrency(sanitized.walletAmount || order.pricing?.walletAmount || 0),
  };
  ensurePaymentBreakdownSnapshots(order);

  order.distanceSnapshot = {
    distanceKmActual: roundCurrency(sanitized.distanceKmActual || 0),
    distanceKmRounded: roundCurrency(sanitized.distanceKmRounded || 0),
    source: sanitized?.snapshots?.deliverySettings?.distanceSource || "haversine",
  };

  order.pricingSnapshot = {
    deliverySettings: sanitized?.snapshots?.deliverySettings || {},
    categoryCommissionSettings: sanitized?.snapshots?.categoryCommissionSettings || [],
    handlingFeeStrategy: sanitized?.snapshots?.handlingFeeStrategy || null,
    handlingCategoryUsed: sanitized?.snapshots?.handlingCategoryUsed || {},
  };

  syncLegacyPricing(order);
  return order;
}

export async function createPendingSellerPayout(order, { session, actorId } = {}) {
  const sellerId = order?.seller || order?.sellerId;
  if (!sellerId) return null;
  if (order.financeFlags?.sellerPayoutQueued) return null;

  const baseAmount = roundCurrency(order.paymentBreakdown?.sellerPayoutTotal || 0);
  const discrepancy = Number(order.shiprocket?.weightDiscrepancyAmount || 0);
  const deduction = discrepancy > 0 ? Math.min(baseAmount, discrepancy) : 0;
  // Remember that the weight charge is taken (here, as the payout is created), so it is never taken twice.
  if (discrepancy > 0 && order.shiprocket) order.shiprocket.weightDiscrepancyApplied = discrepancy;
  let amount = roundCurrency(Math.max(0, baseAmount - deduction));

  // Money this seller still owes from an earlier return (their balance could not cover it then) is
  // taken from this payout.
  const returnRecovery = await applyRecoverableDue({
    ownerType: OWNER_TYPE.SELLER,
    ownerId: sellerId,
    amount,
    session,
    orderId: order._id,
    reference: order.orderId,
  });
  if (returnRecovery > 0) amount = roundCurrency(Math.max(0, amount - returnRecovery));

  if (amount <= 0) {
    order.settlementStatus = {
      ...(order.settlementStatus || {}),
      sellerPayout: "NOT_APPLICABLE",
    };
    return null;
  }

  const payout = await createPendingPayoutForOrder(
    {
      order,
      payoutType: PAYOUT_TYPE.SELLER,
      beneficiaryId: sellerId,
      amount,
      createdBy: actorId || null,
      metadata: {
        flow: "order_delivered",
        weightDiscrepancyDeduction: deduction,
        returnRecoveryDeduction: returnRecovery,
        originalSellerPayout: baseAmount,
      },
    },
    { session },
  );

  order.financeFlags = {
    ...(order.financeFlags || {}),
    sellerPayoutQueued: true,
  };
  order.settlementStatus = {
    ...(order.settlementStatus || {}),
    sellerPayout: "PENDING",
  };
  return payout;
}

export async function releaseHeldSellerPayout(orderOrId, { actorId = null } = {}) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await findOrderForUpdate(orderOrId, session);

    if (!order?.seller) {
      await session.commitTransaction();
      return null;
    }

    if (order.financeFlags?.sellerPayoutQueued) {
      await session.commitTransaction();
      return null;
    }

    const payout = await createPendingSellerPayout(order, { session, actorId });
    order.financeFlags = {
      ...(order.financeFlags || {}),
      sellerPayoutHeld: false,
    };
    if (payout) {
      order.settlementStatus = {
        ...(order.settlementStatus || {}),
        sellerPayout: "PENDING",
      };
    }

    await order.save({ session });
    await session.commitTransaction();
    return payout;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function createPendingRiderPayout(order, { session, actorId } = {}) {
  if (!order?.deliveryBoy) {
    order.settlementStatus = {
      ...(order.settlementStatus || {}),
      riderPayout: "NOT_APPLICABLE",
    };
    return null;
  }
  if (order.financeFlags?.riderPayoutQueued) return null;

  const amount = roundCurrency(order.delivery?.riderEarning ?? order.paymentBreakdown?.riderPayoutTotal ?? 0);
  if (amount <= 0) {
    order.settlementStatus = {
      ...(order.settlementStatus || {}),
      riderPayout: "NOT_APPLICABLE",
    };
    return null;
  }

  const payout = await createPendingPayoutForOrder(
    {
      order,
      payoutType: PAYOUT_TYPE.DELIVERY_PARTNER,
      beneficiaryId: order.deliveryBoy,
      amount,
      createdBy: actorId || null,
      metadata: { flow: "order_delivered" },
    },
    { session },
  );

  order.financeFlags = {
    ...(order.financeFlags || {}),
    riderPayoutQueued: true,
  };
  order.settlementStatus = {
    ...(order.settlementStatus || {}),
    riderPayout: "PENDING",
  };
  return payout;
}

export async function creditAdminEarning(order, { session, actorId } = {}) {
  if (order.financeFlags?.adminEarningCredited) return null;

  // The earning is counted when the order is delivered, for online AND cash orders. For a cash order the
  // money itself reaches the platform later (the rider hands the cash over: "COD remitted"), so its ledger
  // row says so (metadata.cashPending) and the order's codPendingAmount shows what is still to come.
  const adminEarning = roundCurrency(order.paymentBreakdown?.platformTotalEarning || 0);
  if (adminEarning <= 0) {
    order.settlementStatus = {
      ...(order.settlementStatus || {}),
      adminEarningCredited: true,
    };
    order.financeFlags = {
      ...(order.financeFlags || {}),
      adminEarningCredited: true,
    };
    return null;
  }

  const adminWallet = await getOrCreateWallet(OWNER_TYPE.ADMIN, null, { session });
  await createLedgerEntry(
    {
      orderId: order._id,
      walletId: adminWallet._id,
      actorType: OWNER_TYPE.ADMIN,
      actorId: null,
      type: LEDGER_TRANSACTION_TYPE.ADMIN_EARNING_CREDITED,
      direction: LEDGER_DIRECTION.CREDIT,
      amount: adminEarning,
      paymentMode: order.paymentMode,
      description: "Platform earning recognized on delivery",
      reference: order.orderId,
      metadata: order.paymentMode === "COD" ? { cashPending: true } : {},
    },
    { session },
  );

  order.settlementStatus = {
    ...(order.settlementStatus || {}),
    adminEarningCredited: true,
  };
  order.financeFlags = {
    ...(order.financeFlags || {}),
    adminEarningCredited: true,
    adminEarningBooked: true,
  };

  await createFinanceAuditLog(
    {
      action: "ORDER_DELIVERED_SETTLED",
      actorType: OWNER_TYPE.ADMIN,
      actorId: actorId || null,
      orderId: order._id,
      metadata: { adminEarning },
    },
    { session },
  );

  return adminEarning;
}

export async function handleOnlineOrderFinance(
  orderOrId,
  { actorId = null, transactionId = "", metadata = {} } = {},
) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await findOrderForUpdate(orderOrId, session);

    if (order.paymentMode !== "ONLINE" && order.paymentMode !== "UPI_QR") {
      order.paymentMode = "ONLINE";
    }

    if (order.financeFlags?.onlinePaymentCaptured) {
      await session.commitTransaction();
      return order;
    }

    const grandTotal = roundCurrency(order.paymentBreakdown?.grandTotal || order.pricing?.total || 0);
    const credit = await creditWallet({
      ownerType: OWNER_TYPE.ADMIN,
      ownerId: null,
      amount: grandTotal,
      bucket: "available",
      session,
    });

    await createLedgerEntry(
      {
        orderId: order._id,
        walletId: credit.wallet._id,
        actorType: OWNER_TYPE.ADMIN,
        actorId: null,
        type: LEDGER_TRANSACTION_TYPE.ORDER_ONLINE_PAYMENT_CAPTURED,
        direction: LEDGER_DIRECTION.CREDIT,
        amount: grandTotal,
        paymentMode: order.paymentMode || "ONLINE",
        metadata: {
          ...metadata,
          gatewayTransactionId: transactionId || undefined,
        },
        description:
          order.paymentMode === "UPI_QR"
            ? "UPI payment approved and captured from customer"
            : "Online payment captured from customer",
        reference: order.orderId,
        balanceBefore: credit.before,
        balanceAfter: credit.after,
      },
      { session },
    );

    order.financeFlags = {
      ...(order.financeFlags || {}),
      onlinePaymentCaptured: true,
    };
    order.paymentStatus = ORDER_PAYMENT_STATUS.PAID;
    order.payment = {
      ...(order.payment || {}),
      method: order.paymentMode === "UPI_QR" ? "upi_qr" : "online",
      status: "completed",
      transactionId: transactionId || order.payment?.transactionId,
    };

    await createFinanceAuditLog(
      {
        action: "ONLINE_PAYMENT_VERIFIED",
        actorType: OWNER_TYPE.ADMIN,
        actorId: actorId || null,
        orderId: order._id,
        metadata: {
          amount: grandTotal,
          gatewayTransactionId: transactionId || null,
        },
      },
      { session },
    );

    await order.save({ session });
    await session.commitTransaction();
    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function handleCodOrderFinance(
  orderOrId,
  { amount = null, deliveryPartnerId = null, actorId = null } = {},
) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await findOrderForUpdate(orderOrId, session);

    if (order.paymentMode === "ONLINE") {
      throw new Error("COD collection is not allowed for ONLINE orders");
    }

    if (order.paymentMode !== "COD") {
      order.paymentMode = "COD";
    }

    const isDelivered =
      order.status === "delivered" || order.orderStatus === "delivered";
    if (!isDelivered) {
      throw new Error("COD can only be collected after order delivery");
    }

    if (order.financeFlags?.codMarkedCollected) {
      await session.commitTransaction();
      return order;
    }

    if (!order.deliveryBoy && deliveryPartnerId) {
      order.deliveryBoy = deliveryPartnerId;
      order.deliveryPartner = deliveryPartnerId;
    }
    const partnerId = order.deliveryBoy || deliveryPartnerId;
    if (!partnerId) {
      throw new Error("Delivery partner is required for COD collection");
    }

    const codAmountGross = roundCurrency(
      amount == null ? order.paymentBreakdown?.grandTotal || order.pricing?.total || 0 : amount,
    );
    if (codAmountGross <= 0) {
      throw new Error("COD collection amount must be greater than 0");
    }

    // Requirement: system float (COD) should track remittable cash with delivery partners,
    // i.e. gross order amount minus delivery partner commission.
    const deliveryPartnerCommission = roundCurrency(
      order.paymentBreakdown?.riderPayoutTotal || 0,
    );
    const codAmountNet = roundCurrency(
      Math.max(codAmountGross - deliveryPartnerCommission, 0),
    );

    await updateCashInHand({
      ownerType: OWNER_TYPE.DELIVERY_PARTNER,
      ownerId: partnerId,
      deltaAmount: codAmountNet,
      session,
    });

    if (!order.paymentBreakdown) order.paymentBreakdown = {};
    order.paymentBreakdown.codCollectedAmount = roundCurrency(
      (order.paymentBreakdown.codCollectedAmount || 0) + codAmountNet,
    );
    order.paymentBreakdown.codRemittedAmount = roundCurrency(
      order.paymentBreakdown.codRemittedAmount || 0,
    );
    order.paymentBreakdown.codPendingAmount = roundCurrency(
      order.paymentBreakdown.codCollectedAmount - order.paymentBreakdown.codRemittedAmount,
    );
    if (typeof order.markModified === "function") {
      order.markModified("paymentBreakdown");
    }

    order.paymentStatus = ORDER_PAYMENT_STATUS.CASH_COLLECTED;
    order.payment = {
      ...(order.payment || {}),
      method: "cash",
      status: "completed",
    };
    order.financeFlags = {
      ...(order.financeFlags || {}),
      codMarkedCollected: true,
    };

    const riderWallet = await getOrCreateWallet(
      OWNER_TYPE.DELIVERY_PARTNER,
      partnerId,
      { session },
    );
    await createLedgerEntry(
      {
        orderId: order._id,
        walletId: riderWallet._id,
        actorType: OWNER_TYPE.DELIVERY_PARTNER,
        actorId: partnerId,
        type: LEDGER_TRANSACTION_TYPE.ORDER_COD_COLLECTED,
        direction: LEDGER_DIRECTION.CREDIT,
        amount: codAmountNet,
        paymentMode: "COD",
        description: "COD cash added to system float (net of rider commission)",
        reference: order.orderId,
      },
      { session },
    );

    await createFinanceAuditLog(
      {
        action: "COD_MARKED_COLLECTED",
        actorType: OWNER_TYPE.DELIVERY_PARTNER,
        actorId: actorId || partnerId,
        orderId: order._id,
        metadata: {
          amountGross: codAmountGross,
          deliveryPartnerCommission,
          amountNet: codAmountNet,
          deliveryPartnerId: String(partnerId),
        },
      },
      { session },
    );

    await order.save({ session });
    await session.commitTransaction();
    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * COD order delivered by a COURIER (Shiprocket): there is no rider, so the customer's cash is held by the
 * courier company, not by us. The whole order total is booked as "collected, not received yet"
 * (codPendingAmount) so nothing is lost track of; the admin wallet is credited only when the courier
 * really pays it out (see remitCourierCod). Idempotent.
 */
export async function recordCourierCodCollected(orderOrId) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await findOrderForUpdate(orderOrId, session);
    if (order.paymentMode !== "COD" || order.fulfillmentType !== "SHIPROCKET") {
      await session.commitTransaction();
      return order;
    }
    if (order.financeFlags?.codMarkedCollected) {
      await session.commitTransaction();
      return order;
    }
    const total = roundCurrency(order.paymentBreakdown?.grandTotal || order.pricing?.total || 0);
    if (total <= 0) {
      await session.commitTransaction();
      return order;
    }
    if (!order.paymentBreakdown) order.paymentBreakdown = {};
    order.paymentBreakdown.codCollectedAmount = total;
    order.paymentBreakdown.codRemittedAmount = roundCurrency(order.paymentBreakdown.codRemittedAmount || 0);
    order.paymentBreakdown.codPendingAmount = roundCurrency(total - order.paymentBreakdown.codRemittedAmount);
    if (typeof order.markModified === "function") order.markModified("paymentBreakdown");
    order.paymentStatus = ORDER_PAYMENT_STATUS.CASH_COLLECTED;
    order.payment = { ...(order.payment || {}), method: "cash", status: "completed" };
    order.financeFlags = { ...(order.financeFlags || {}), codMarkedCollected: true };
    await createFinanceAuditLog(
      {
        action: "COD_MARKED_COLLECTED",
        actorType: OWNER_TYPE.ADMIN,
        actorId: null,
        orderId: order._id,
        metadata: { amount: total, holder: "COURIER" },
      },
      { session },
    );
    await order.save({ session });
    await session.commitTransaction();
    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * The courier (Shiprocket) paid the COD cash of one order into the platform's bank: credit the admin wallet.
 * `amount` defaults to everything still pending; a part payment is allowed, more than pending is not.
 */
export async function remitCourierCod(orderOrId, { amount = null, actorId = null, reference = "" } = {}) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await findOrderForUpdate(orderOrId, session);
    if (order.paymentMode !== "COD" || order.fulfillmentType !== "SHIPROCKET") {
      const e = new Error("This is not a courier (Shiprocket) cash-on-delivery order.");
      e.statusCode = 400;
      throw e;
    }
    if (order.status !== "delivered" && order.orderStatus !== "delivered" && order.status !== "returned") {
      const e = new Error("The courier's cash can only be received after the order is delivered.");
      e.statusCode = 409;
      throw e;
    }
    const collected = roundCurrency(order.paymentBreakdown?.codCollectedAmount || 0);
    const remitted = roundCurrency(order.paymentBreakdown?.codRemittedAmount || 0);
    const pending = roundCurrency(collected - remitted);
    if (collected <= 0 || pending <= 0) {
      const e = new Error("There is no courier cash pending for this order.");
      e.statusCode = 409;
      throw e;
    }
    const requested = amount == null || amount === "" ? pending : roundCurrency(amount);
    if (!(requested > 0)) {
      const e = new Error("Enter an amount greater than 0.");
      e.statusCode = 400;
      throw e;
    }
    if (requested > pending) {
      const e = new Error(`Only ₹${pending} is pending for this order; you cannot receive ₹${requested}.`);
      e.statusCode = 400;
      throw e;
    }

    const adminCredit = await creditWallet({
      ownerType: OWNER_TYPE.ADMIN,
      ownerId: null,
      amount: requested,
      bucket: "available",
      session,
    });
    await createLedgerEntry(
      {
        orderId: order._id,
        walletId: adminCredit.wallet._id,
        actorType: OWNER_TYPE.ADMIN,
        actorId: null,
        type: LEDGER_TRANSACTION_TYPE.COD_REMITTED,
        direction: LEDGER_DIRECTION.CREDIT,
        amount: requested,
        paymentMode: "COD",
        metadata: { via: "courier_cod", reference: String(reference || "") },
        description: "Courier (Shiprocket) COD cash received",
        reference: order.orderId,
        balanceBefore: adminCredit.before,
        balanceAfter: adminCredit.after,
      },
      { session },
    );

    const nextRemitted = addMoney(remitted, requested);
    const nextPending = roundCurrency(collected - nextRemitted);
    order.paymentBreakdown.codRemittedAmount = nextRemitted;
    order.paymentBreakdown.codPendingAmount = nextPending;
    if (typeof order.markModified === "function") order.markModified("paymentBreakdown");
    order.paymentStatus = nextPending <= 0 ? ORDER_PAYMENT_STATUS.COD_RECONCILED : ORDER_PAYMENT_STATUS.PARTIALLY_REMITTED;
    if (nextPending <= 0) {
      order.settlementStatus = { ...(order.settlementStatus || {}), reconciledAt: new Date() };
    }
    await createFinanceAuditLog(
      {
        action: "COD_RECONCILED",
        actorType: OWNER_TYPE.ADMIN,
        actorId: actorId || null,
        orderId: order._id,
        metadata: { amount: requested, holder: "COURIER", codRemittedAmount: nextRemitted, codPendingAmount: nextPending, reference: String(reference || "") },
      },
      { session },
    );
    await order.save({ session });
    await session.commitTransaction();
    return { orderId: order.orderId, received: requested, codRemittedAmount: nextRemitted, codPendingAmount: nextPending };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function settleDeliveredOrder(orderOrId, { actorId = null } = {}) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await findOrderForUpdate(orderOrId, session);

    if (order.status !== "delivered") {
      order.status = "delivered";
    }
    order.orderStatus = "delivered";
    if (!order.deliveredAt) {
      order.deliveredAt = new Date();
    }

    if (!order.returnEligibleAt || !order.returnWindowExpiresAt) {
      const { eligibleAt, windowExpiresAt } = await computeReturnWindowDates(order.deliveredAt, order);
      order.returnEligibleAt = order.returnEligibleAt || eligibleAt;
      order.returnWindowExpiresAt = order.returnWindowExpiresAt || windowExpiresAt;
      order.returnDeadline = order.returnDeadline || windowExpiresAt;
    }

    if (order.paymentMode === "ONLINE" && !order.financeFlags?.onlinePaymentCaptured) {
      throw new Error("Cannot settle delivered online order before payment capture");
    }

    if (order.financeFlags?.deliveredSettlementApplied) {
      await session.commitTransaction();
      return order;
    }

    const now = new Date();
    const holdSellerPayout =
      order.returnWindowExpiresAt instanceof Date && order.returnWindowExpiresAt > now;

    await createPendingSellerPayout(order, { session, actorId });

    if (holdSellerPayout) {
      order.financeFlags = {
        ...(order.financeFlags || {}),
        sellerPayoutHeld: true,
      };
      order.settlementStatus = {
        ...(order.settlementStatus || {}),
        sellerPayout: "HOLD",
      };
    }
    if (order.paymentMode === "COD") {
      // On COD the rider keeps their commission out of the collected cash
      // (handleCodOrderFinance only books gross minus commission as owed), so
      // queuing a payout as well would pay them twice.
      order.financeFlags = {
        ...(order.financeFlags || {}),
        riderPayoutQueued: true,
      };
      order.settlementStatus = {
        ...(order.settlementStatus || {}),
        riderPayout: order.deliveryBoy ? "COMPLETED" : "NOT_APPLICABLE",
      };
    } else {
      await createPendingRiderPayout(order, { session, actorId });
    }
    await creditAdminEarning(order, { session, actorId });

    order.financeFlags = {
      ...(order.financeFlags || {}),
      deliveredSettlementApplied: true,
    };

    order.settlementStatus = computeOverallSettlement(order);

    const earning = computePlatformEarning(order);
    order.platformEarning = { net: earning.net, parts: earning.parts, updatedAt: new Date() };

    await order.save({ session });
    await session.commitTransaction();
    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function reconcileCodCash(
  orderOrId,
  amount,
  deliveryPartnerId,
  { actorId = null, metadata = {} } = {},
) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await findOrderForUpdate(orderOrId, session);
    const partnerId = deliveryPartnerId || order.deliveryBoy;
    if (!partnerId) {
      throw new Error("Delivery partner is required for reconciliation");
    }
    if (order.paymentMode !== "COD") {
      throw new Error("COD reconciliation is only allowed for COD orders");
    }

    const requested = roundCurrency(amount || 0);
    if (requested <= 0) {
      throw new Error("Reconciliation amount must be greater than 0");
    }

    const codCollected = roundCurrency(order.paymentBreakdown?.codCollectedAmount || 0);
    const codRemitted = roundCurrency(order.paymentBreakdown?.codRemittedAmount || 0);
    const codPending = roundCurrency(codCollected - codRemitted);
    if (codPending <= 0) {
      throw new Error("No COD pending amount for this order");
    }
    if (requested > codPending) {
      throw new Error("Reconciliation amount exceeds COD pending amount");
    }

    await updateCashInHand({
      ownerType: OWNER_TYPE.DELIVERY_PARTNER,
      ownerId: partnerId,
      deltaAmount: -requested,
      session,
    });

    const adminCredit = await creditWallet({
      ownerType: OWNER_TYPE.ADMIN,
      ownerId: null,
      amount: requested,
      bucket: "available",
      session,
    });

    const riderWallet = await getOrCreateWallet(
      OWNER_TYPE.DELIVERY_PARTNER,
      partnerId,
      { session },
    );

    await createLedgerEntry(
      {
        orderId: order._id,
        walletId: riderWallet._id,
        actorType: OWNER_TYPE.DELIVERY_PARTNER,
        actorId: partnerId,
        type: LEDGER_TRANSACTION_TYPE.COD_REMITTED,
        direction: LEDGER_DIRECTION.DEBIT,
        amount: requested,
        paymentMode: "COD",
        metadata,
        description: "COD remitted by delivery partner",
        reference: order.orderId,
      },
      { session },
    );

    await createLedgerEntry(
      {
        orderId: order._id,
        walletId: adminCredit.wallet._id,
        actorType: OWNER_TYPE.ADMIN,
        actorId: null,
        type: LEDGER_TRANSACTION_TYPE.COD_REMITTED,
        direction: LEDGER_DIRECTION.CREDIT,
        amount: requested,
        paymentMode: "COD",
        metadata,
        description: "COD remittance credited to admin wallet",
        reference: order.orderId,
        balanceBefore: adminCredit.before,
        balanceAfter: adminCredit.after,
      },
      { session },
    );

    const nextRemitted = addMoney(codRemitted, requested);
    const nextPending = roundCurrency(codCollected - nextRemitted);

    if (!order.paymentBreakdown) order.paymentBreakdown = {};
    order.paymentBreakdown.codCollectedAmount = codCollected;
    order.paymentBreakdown.codRemittedAmount = nextRemitted;
    order.paymentBreakdown.codPendingAmount = nextPending;
    if (typeof order.markModified === "function") {
      order.markModified("paymentBreakdown");
    }

    order.paymentStatus =
      nextPending <= 0
        ? ORDER_PAYMENT_STATUS.COD_RECONCILED
        : ORDER_PAYMENT_STATUS.PARTIALLY_REMITTED;

    if (nextPending <= 0) {
      order.settlementStatus = {
        ...(order.settlementStatus || {}),
        reconciledAt: new Date(),
      };
    }

    await createFinanceAuditLog(
      {
        action: "COD_RECONCILED",
        actorType: OWNER_TYPE.ADMIN,
        actorId: actorId || null,
        orderId: order._id,
        metadata: {
          amount: requested,
          deliveryPartnerId: String(partnerId),
          codRemittedAmount: nextRemitted,
          codPendingAmount: nextPending,
        },
      },
      { session },
    );

    await order.save({ session });
    await session.commitTransaction();
    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function reverseOrderFinanceOnCancellation(
  orderOrId,
  { actorId = null, reason = "Order cancelled before settlement" } = {},
) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await findOrderForUpdate(orderOrId, session);

    // Audit Phase 3 (C-3): idempotency guard. Without this, a retried
    // cancellation (e.g. a stalled job that fires twice, or the v1 caller
    // racing with a queue worker) would re-debit the ADMIN wallet for the
    // gateway refund and re-credit the customer wallet — overpaying the
    // customer and depleting the admin float. The flag is set further
    // down in the same transaction so a crash before commit safely leaves
    // it false and a future retry can complete the work.
    if (order.financeFlags?.cancellationReversalApplied) {
      await session.commitTransaction();
      return order;
    }

    // A cancelled order that was already paid (gateway or UPI QR) is refunded into the customer's wallet,
    // from where they can withdraw it to their bank. The money stays on the platform until the admin pays
    // that withdrawal, so the admin wallet is not touched here.
    let walletRefundedAmount = 0;
    const paidBeforeCancel =
      (order.paymentMode === "ONLINE" || order.paymentMode === "UPI_QR") &&
      order.financeFlags?.onlinePaymentCaptured;
    if (paidBeforeCancel) {
      const refundAmount = roundCurrency(order.paymentBreakdown?.grandTotal || 0);
      if (refundAmount > 0 && order.customer) {
        await creditWallet({
          ownerType: OWNER_TYPE.CUSTOMER,
          ownerId: order.customer,
          amount: refundAmount,
          bucket: "available",
          session,
          ledgerType: LEDGER_TRANSACTION_TYPE.WALLET_REFUND,
          ledgerReference: `CAN-REF-${order.orderId}`,
          ledgerDescription: `Refund for cancelled order: ${reason}`,
          orderId: order._id,
          paymentMode: order.paymentMode,
          idempotencyKey: `CAN-CUST-REFUND-${order._id}`,
          metadata: { source: "order_cancelled", reason },
        });
        // loaded here (not at the top) so this file does not need the transaction model to be imported
        const { default: Transaction } = await import("../../models/transaction.js");
        await Transaction.create(
          [
            {
              user: order.customer,
              userModel: "User",
              order: order._id,
              type: "Refund",
              amount: refundAmount,
              status: "Settled",
              reference: `CAN-REF-${order.orderId}`,
              meta: { orderId: order._id, type: "order_cancelled_wallet" },
            },
          ],
          { session },
        );
        walletRefundedAmount = refundAmount;
      }
      order.paymentStatus = ORDER_PAYMENT_STATUS.REFUNDED;
    }

    // NEW: Refund Wallet Amount Used
    const walletUsed = roundCurrency(order.pricing?.walletAmount || order.paymentBreakdown?.walletAmount || 0);
    if (walletUsed > 0) {
      await creditWallet({
        ownerType: OWNER_TYPE.CUSTOMER,
        ownerId: order.customer,
        amount: walletUsed,
        bucket: "available",
        session,
      });

      const customerWallet = await getOrCreateWallet(OWNER_TYPE.CUSTOMER, order.customer, { session });
      await createLedgerEntry(
        {
          orderId: order._id,
          walletId: customerWallet._id,
          actorType: OWNER_TYPE.CUSTOMER,
          actorId: order.customer,
          type: LEDGER_TRANSACTION_TYPE.WALLET_REFUND,
          direction: LEDGER_DIRECTION.CREDIT,
          amount: walletUsed,
          paymentMode: "WALLET",
          description: `Refund for wallet payment: ${reason}`,
          reference: order.orderId,
        },
        { session },
      );
    }

    order.settlementStatus = {
      ...(order.settlementStatus || {}),
      overall: ORDER_SETTLEMENT_STATUS.CANCELLED,
      sellerPayout: "NOT_APPLICABLE",
      riderPayout: "NOT_APPLICABLE",
    };

    // Audit Phase 3 (C-3): mark the reversal as applied INSIDE the same
    // transaction that issued the wallet refund / gateway debit / audit
    // log. The flag is committed atomically with the side-effects so the
    // idempotency guard at the top of this function is correct under
    // crash-and-retry.
    order.financeFlags = {
      ...(order.financeFlags || {}),
      cancellationReversalApplied: true,
    };

    await createFinanceAuditLog(
      {
        action: "FINANCE_ADJUSTMENT_APPLIED",
        actorType: OWNER_TYPE.ADMIN,
        actorId: actorId || null,
        orderId: order._id,
        metadata: { reason },
      },
      { session },
    );

    await order.save({ session });
    await session.commitTransaction();
    if (walletRefundedAmount > 0) {
      emitNotificationEvent(NOTIFICATION_EVENTS.REFUND_COMPLETED, {
        orderId: order.orderId,
        customerId: order.customer,
        userId: order.customer,
        data: { refundAmount: walletRefundedAmount },
      });
    }
    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
