/**
 * DeliveryEarningsService
 *
 * Owns the read-side aggregations for the delivery partner's dashboard:
 *   - getDeliveryStats         ← getDeliveryStats handler
 *   - getDeliveryEarnings      ← getDeliveryEarnings handler
 *   - getDeliveryCodCashSummary ← getDeliveryCodCashSummary handler
 *
 * Framework-agnostic. Inputs are primitives; output shapes match the
 * existing HTTP response payloads byte-for-byte so frontend consumers see
 * no change.
 *
 * Throws errors with `err.statusCode` for the auth-failure cases the COD
 * summary handler used to handle inline.
 */

import mongoose from "mongoose";
import Order from "../../models/order.js";
import Transaction from "../../models/transaction.js";
import Wallet from "../../models/wallet.js";
import { roundCurrency } from "../../utils/money.js";
import { buildKey, getOrSet, getTTL } from "../cacheService.js";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function svcErr(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toDeliveryBoyId(rawId) {
  if (rawId == null) {
    throw svcErr("Unauthorized", 401);
  }
  if (!mongoose.Types.ObjectId.isValid(String(rawId))) {
    throw svcErr("Invalid user id", 401);
  }
  return new mongoose.Types.ObjectId(String(rawId));
}

/**
 * Dashboard summary: total deliveries, today's earnings, incentives, cash in hand.
 * Cached for ~30s (`deliveryStats` TTL) to absorb dashboard polling.
 */
export async function getDeliveryStats(rawId) {
  const deliveryBoyId = toDeliveryBoyId(rawId);
  const cacheKey = buildKey("delivery", "stats", String(deliveryBoyId));
  return getOrSet(
    cacheKey,
    () => computeDeliveryStats(deliveryBoyId),
    getTTL("deliveryStats"),
  );
}

async function computeDeliveryStats(deliveryBoyId) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const endOfYesterday = new Date(startOfToday);
  endOfYesterday.setMilliseconds(-1);

  const [totalDeliveries, todayDeliveries, pendingOrders, cancelledOrders, yesterdayTxs] = await Promise.all([
    Order.countDocuments({
      $or: [
        { deliveryBoy: deliveryBoyId, status: "delivered" },
        { returnDeliveryBoy: deliveryBoyId, returnStatus: { $in: ["returned", "refund_completed"] } },
      ],
    }),
    Order.countDocuments({
      $or: [
        {
          deliveryBoy: deliveryBoyId,
          status: "delivered",
          $expr: { $gte: [{ $toDate: { $ifNull: ["$deliveredAt", "$updatedAt"] } }, startOfToday] },
        },
        {
          returnDeliveryBoy: deliveryBoyId,
          returnStatus: { $in: ["returned", "refund_completed"] },
          $expr: { $gte: [{ $toDate: "$updatedAt" }, startOfToday] },
        },
      ],
    }),
    Order.countDocuments({
      $or: [
        { deliveryBoy: deliveryBoyId, status: { $nin: ["delivered", "cancelled"] } },
        { returnDeliveryBoy: deliveryBoyId, returnStatus: { $in: ["return_assigned", "return_in_transit", "return_drop_pending"] } },
      ],
    }),
    Order.countDocuments({
      deliveryBoy: deliveryBoyId,
      status: "cancelled",
    }),
    Transaction.find({
      user: deliveryBoyId,
      userModel: "Delivery",
      status: "Settled",
      type: { $in: ["Delivery Earning", "Incentive", "Bonus"] },
      createdAt: { $gte: startOfYesterday, $lte: endOfYesterday },
    }).lean(),
  ]);

  const allTransactions = await Transaction.find({
    user: deliveryBoyId,
    userModel: "Delivery",
    $or: [
      { createdAt: { $gte: startOfToday } },
      { updatedAt: { $gte: startOfToday } },
    ],
  })
    .populate("order", "pricing paymentBreakdown")
    .lean();

  const todayEarnings = allTransactions
    .filter(
      (t) =>
        t.status === "Settled" &&
        (t.type === "Delivery Earning" ||
          t.type === "Incentive" ||
          t.type === "Bonus"),
    )
    .reduce((acc, t) => acc + t.amount, 0);

  const yesterdayEarnings = yesterdayTxs.reduce((acc, t) => acc + (t.amount || 0), 0);
  const growthPercentage = yesterdayEarnings > 0
    ? Math.round(((todayEarnings - yesterdayEarnings) / yesterdayEarnings) * 100)
    : (todayEarnings > 0 ? 100 : 0);

  const incentives = allTransactions
    .filter(
      (t) =>
        t.status === "Settled" &&
        (t.type === "Incentive" || t.type === "Bonus"),
    )
    .reduce((acc, t) => acc + t.amount, 0);

  const tipsReceived = allTransactions
    .filter((t) => t.type === "Delivery Earning" && t.status === "Settled")
    .reduce(
      (acc, t) =>
        acc +
        Number(
          t?.meta?.tipAmount ??
            t?.order?.paymentBreakdown?.riderTipAmount ??
            t?.order?.pricing?.tip ??
            0,
        ),
      0,
    );

  const wallet = await Wallet.findOne({
    ownerType: "DELIVERY_PARTNER",
    ownerId: deliveryBoyId,
  })
    .select("cashInHand")
    .lean();
  const cashCollected = roundCurrency(wallet?.cashInHand || 0);

  // Simple incentive tier mock logic for UI
  const targetOrders = 10;
  const remainingOrders = targetOrders - (totalDeliveries % targetOrders);
  const incentiveAmount = 300;

  return {
    today: todayEarnings,
    todayDeliveries,
    deliveries: totalDeliveries,
    pendingDeliveries: pendingOrders,
    cancelledDeliveries: cancelledOrders,
    yesterdayEarnings,
    growthPercentage,
    incentiveData: {
      remainingOrders: remainingOrders === 0 ? targetOrders : remainingOrders,
      amount: incentiveAmount,
      tipsReceived: tipsReceived
    },
    incentives,
    cashCollected,
  };
}

/**
 * Earnings page payload: totals, 7-day chart, latest 20 transactions.
 * Cached for ~30s (`deliveryEarnings` TTL) to absorb dashboard polling.
 */
export async function getDeliveryEarnings(rawId, timeframe = "weekly", targetDateStr = null) {
  const deliveryBoyId = toDeliveryBoyId(rawId);
  const dateKey = targetDateStr ? targetDateStr.split('T')[0] : "now";
  const cacheKey = buildKey("delivery", "earnings", String(deliveryBoyId), timeframe, dateKey);
  return getOrSet(
    cacheKey,
    () => computeDeliveryEarnings(deliveryBoyId, timeframe, targetDateStr),
    getTTL("deliveryEarnings"),
  );
}

async function computeDeliveryEarnings(deliveryBoyId, timeframe = "weekly", targetDateStr = null) {
  const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
  
  let startBound = new Date(targetDate);
  let endBound = new Date(targetDate);
  let prevStartBound = new Date(startBound);
  let prevEndBound = new Date(endBound);
  let comparisonLabel = "yesterday";
  
  if (timeframe === "daily") {
    startBound.setHours(0, 0, 0, 0);
    endBound.setHours(23, 59, 59, 999);
    prevStartBound = new Date(startBound);
    prevStartBound.setDate(prevStartBound.getDate() - 1);
    prevEndBound = new Date(endBound);
    prevEndBound.setDate(prevEndBound.getDate() - 1);
    comparisonLabel = "yesterday";
  } else if (timeframe === "monthly") {
    startBound = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    endBound = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);
    prevStartBound = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
    prevEndBound = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0, 23, 59, 59, 999);
    comparisonLabel = "last month";
  } else {
    const day = targetDate.getDay(); 
    const diffToMonday = targetDate.getDate() - day + (day === 0 ? -6 : 1);
    startBound = new Date(targetDate.setDate(diffToMonday));
    startBound.setHours(0, 0, 0, 0);
    endBound = new Date(startBound);
    endBound.setDate(startBound.getDate() + 6);
    endBound.setHours(23, 59, 59, 999);
    prevStartBound = new Date(startBound);
    prevStartBound.setDate(prevStartBound.getDate() - 7);
    prevEndBound = new Date(endBound);
    prevEndBound.setDate(prevEndBound.getDate() - 7);
    comparisonLabel = "last week";
  }

  const [transactions, prevTransactions] = await Promise.all([
    Transaction.find({
      user: deliveryBoyId,
      userModel: "Delivery",
      $or: [
        { createdAt: { $gte: startBound, $lte: endBound } },
        { updatedAt: { $gte: startBound, $lte: endBound } },
        { date: { $gte: startBound, $lte: endBound } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("order", "orderId pricing paymentBreakdown"),
    Transaction.find({
      user: deliveryBoyId,
      userModel: "Delivery",
      $or: [
        { createdAt: { $gte: prevStartBound, $lte: prevEndBound } },
        { updatedAt: { $gte: prevStartBound, $lte: prevEndBound } },
        { date: { $gte: prevStartBound, $lte: prevEndBound } },
      ],
    }).select("amount status type"),
  ]);

  const wallet = await Wallet.findOne({
    ownerType: "DELIVERY_PARTNER",
    ownerId: deliveryBoyId,
  })
    .select("cashInHand")
    .lean();

  const totalEarnings = transactions
    .filter(
      (t) =>
        t.status === "Settled" &&
        (t.type === "Delivery Earning" ||
          t.type === "Incentive" ||
          t.type === "Bonus"),
    )
    .reduce((acc, t) => acc + t.amount, 0);

  const tipsReceived = transactions
    .filter((t) => t.type === "Delivery Earning" && t.status === "Settled")
    .reduce(
      (acc, t) =>
        acc +
        Number(
          t?.meta?.tipAmount ??
            t?.order?.paymentBreakdown?.riderTipAmount ??
            t?.order?.pricing?.tip ??
            0,
        ),
      0,
    );

  const onlinePay = transactions
    .filter((t) => t.type === "Delivery Earning" && t.status === "Settled")
    .reduce((acc, t) => acc + t.amount, 0);

  const incentives = transactions
    .filter(
      (t) =>
        (t.type === "Incentive" || t.type === "Bonus") && t.status === "Settled",
    )
    .reduce((acc, t) => acc + t.amount, 0);

  const cashCollected = roundCurrency(wallet?.cashInHand || 0);

  const chartData = [];
  
  if (timeframe === "daily") {
    const blocks = ["12AM", "4AM", "8AM", "12PM", "4PM", "8PM"];
    const blockTotals = [0, 0, 0, 0, 0, 0];
    const blockIncentives = [0, 0, 0, 0, 0, 0];
    
    transactions.forEach(t => {
      if (t.status === "Settled" && ["Delivery Earning", "Incentive", "Bonus"].includes(t.type)) {
        const hour = new Date(t.createdAt).getHours();
        const blockIndex = Math.floor(hour / 4);
        blockTotals[blockIndex] += t.amount;
        if (t.type === "Incentive" || t.type === "Bonus") {
          blockIncentives[blockIndex] += t.amount;
        }
      }
    });
    
    for (let i = 0; i < 6; i++) {
      chartData.push({
        name: blocks[i],
        earnings: blockTotals[i] - blockIncentives[i],
        incentives: blockIncentives[i]
      });
    }
  } else if (timeframe === "monthly") {
    const weekTotals = [0, 0, 0, 0, 0];
    const weekIncentives = [0, 0, 0, 0, 0];
    
    transactions.forEach(t => {
      if (t.status === "Settled" && ["Delivery Earning", "Incentive", "Bonus"].includes(t.type)) {
        const date = new Date(t.createdAt).getDate();
        const weekIndex = Math.min(Math.floor((date - 1) / 7), 4);
        weekTotals[weekIndex] += t.amount;
        if (t.type === "Incentive" || t.type === "Bonus") {
          weekIncentives[weekIndex] += t.amount;
        }
      }
    });
    
    for (let i = 0; i < 5; i++) {
      chartData.push({
        name: `W${i+1}`,
        earnings: weekTotals[i] - weekIncentives[i],
        incentives: weekIncentives[i]
      });
    }
  } else {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    const dayIncentives = [0, 0, 0, 0, 0, 0, 0];
    
    transactions.forEach(t => {
      if (t.status === "Settled" && ["Delivery Earning", "Incentive", "Bonus"].includes(t.type)) {
        let dayIndex = new Date(t.createdAt).getDay() - 1;
        if (dayIndex === -1) dayIndex = 6;
        dayTotals[dayIndex] += t.amount;
        if (t.type === "Incentive" || t.type === "Bonus") {
          dayIncentives[dayIndex] += t.amount;
        }
      }
    });
    
    for (let i = 0; i < 7; i++) {
      chartData.push({
        name: days[i],
        earnings: dayTotals[i] - dayIncentives[i],
        incentives: dayIncentives[i]
      });
    }
  }

  const prevEarnings = prevTransactions
    .filter(
      (t) =>
        t.status === "Settled" &&
        (t.type === "Delivery Earning" ||
          t.type === "Incentive" ||
          t.type === "Bonus"),
    )
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  let growthPercentage = 0;
  if (prevEarnings > 0) {
    growthPercentage = Math.round(((totalEarnings - prevEarnings) / prevEarnings) * 100);
  } else if (totalEarnings > 0) {
    growthPercentage = 100;
  } else {
    growthPercentage = 0;
  }

  const orderEarnings = Math.max(0, totalEarnings - incentives - tipsReceived);
  const baseEarnings = transactions
    .filter((t) => t.type === "Delivery Earning" && t.status === "Settled")
    .reduce((acc, t) => acc + Number(t?.meta?.payoutBase || 0), 0);
  const distanceEarnings = transactions
    .filter((t) => t.type === "Delivery Earning" && t.status === "Settled")
    .reduce((acc, t) => acc + Number(t?.meta?.payoutDistance || 0), 0);

  return {
    totalEarnings,
    onlinePay,
    incentives,
    tipsReceived,
    cashCollected,
    chartData,
    transactions: transactions.slice(0, 20),
    growthPercentage,
    prevEarnings,
    comparisonLabel,
    breakdown: {
      orderEarnings,
      baseEarnings: baseEarnings || orderEarnings,
      distanceEarnings: distanceEarnings || 0,
      incentives,
      tipsReceived,
      cashCollected,
    },
  };
}

/**
 * COD cash summary: system float, cash in hand, per-order toRemit/toCollect.
 * Cached for ~30s (`deliveryCodSummary` TTL).
 */
export async function getDeliveryCodCashSummary(rawId) {
  const deliveryBoyId = toDeliveryBoyId(rawId);
  const cacheKey = buildKey("delivery", "codSummary", String(deliveryBoyId));
  return getOrSet(
    cacheKey,
    () => computeDeliveryCodCashSummary(deliveryBoyId),
    getTTL("deliveryCodSummary"),
  );
}

async function computeDeliveryCodCashSummary(deliveryBoyId) {
  const wallet = await Wallet.findOne({
    ownerType: "DELIVERY_PARTNER",
    ownerId: deliveryBoyId,
  })
    .select("cashInHand")
    .lean();

  const orders = await Order.find({
    deliveryBoy: deliveryBoyId,
    paymentMode: "COD",
    status: { $ne: "cancelled" },
    orderStatus: { $ne: "cancelled" },
  })
    .select(
      "orderId status orderStatus deliveredAt createdAt financeFlags paymentBreakdown pricing",
    )
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const normalized = orders.map((order) => {
    const codMarkedCollected = Boolean(
      order.financeFlags?.codMarkedCollected,
    );
    const gross = roundCurrency(
      order.paymentBreakdown?.grandTotal ?? order.pricing?.total ?? 0,
    );
    const riderCommission = roundCurrency(
      order.paymentBreakdown?.riderPayoutTotal ?? 0,
    );

    const estimatedNet = roundCurrency(Math.max(gross - riderCommission, 0));
    const pendingNet = roundCurrency(
      order.paymentBreakdown?.codPendingAmount ?? 0,
    );
    const contribution = codMarkedCollected ? pendingNet : estimatedNet;

    return {
      orderId: order.orderId,
      status: order.status,
      orderStatus: order.orderStatus,
      deliveredAt: order.deliveredAt || null,
      createdAt: order.createdAt || null,
      codMarkedCollected,
      amountGross: gross,
      riderCommission,
      amountNetExpected: estimatedNet,
      amountNetPending: pendingNet,
      systemFloatContribution: contribution,
    };
  });

  const systemFloatCOD = roundCurrency(
    normalized.reduce(
      (sum, row) => sum + Number(row.systemFloatContribution || 0),
      0,
    ),
  );

  const toRemit = normalized
    .filter(
      (row) => row.codMarkedCollected && Number(row.amountNetPending || 0) > 0,
    )
    .slice(0, 50);

  const toCollect = normalized
    .filter(
      (row) =>
        !row.codMarkedCollected && Number(row.amountNetExpected || 0) > 0,
    )
    .slice(0, 50);

  const [recentSettlements, pendingHandover] = await Promise.all([
    Transaction.find({
      user: deliveryBoyId,
      userModel: "Delivery",
      type: "Cash Settlement",
      status: "Settled",
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Transaction.findOne({
      user: deliveryBoyId,
      userModel: "Delivery",
      type: "Cash Settlement",
      status: { $in: ["Pending", "Processing"] },
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const cashToRemitTotal = roundCurrency(
    toRemit.reduce((sum, row) => sum + Number(row.amountNetPending || 0), 0)
  );
  const recordedCash = roundCurrency(wallet?.cashInHand || 0);
  const cashInHand = Math.max(recordedCash, cashToRemitTotal);

  return {
    systemFloatCOD,
    cashInHand,
    toRemit,
    toCollect,
    pendingHandover: pendingHandover
      ? {
          id: pendingHandover.reference || String(pendingHandover._id),
          reference: pendingHandover.reference || `DEP-${String(pendingHandover._id).slice(-4).toUpperCase()}`,
          amount: Math.abs(pendingHandover.amount),
          status: pendingHandover.status,
          createdAt: pendingHandover.createdAt,
          notes: pendingHandover.notes || "",
        }
      : null,
    recentSettlements: recentSettlements.map((t) => ({
      id: t.reference || String(t._id),
      reference: t.reference || `CSH-SET-${String(t._id).slice(-6).toUpperCase()}`,
      amount: Math.abs(t.amount),
      status: t.status,
      createdAt: t.createdAt,
      date: t.createdAt,
      notes: t.notes || "",
    })),
  };
}

export default {
  getDeliveryStats,
  getDeliveryEarnings,
  getDeliveryCodCashSummary,
};
