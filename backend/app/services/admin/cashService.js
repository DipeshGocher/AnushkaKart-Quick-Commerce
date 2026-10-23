import mongoose from "mongoose";
import Delivery from "../../models/delivery.js";
import Transaction from "../../models/transaction.js";
import Notification from "../../models/notification.js";
import Order from "../../models/order.js";
import Wallet from "../../models/wallet.js";
import { buildKey, del } from "../cacheService.js";

export async function getDeliveryCashBalancesData({ page, limit, skip }) {
  const ridersPipeline = [
    {
      $lookup: {
        from: "transactions",
        let: { riderId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $or: [
                      { $eq: ["$user", "$$riderId"] },
                      { $eq: ["$user", { $toString: "$$riderId" }] },
                    ],
                  },
                  { $eq: ["$userModel", "Delivery"] },
                ],
              },
            },
          },
        ],
        as: "allTransactions",
      },
    },
    {
      $lookup: {
        from: "orders",
        let: { riderId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ["$deliveryBoy", "$$riderId"] },
                  { $eq: ["$deliveryBoy", { $toString: "$$riderId" }] },
                ],
              },
            },
          },
        ],
        as: "allOrders",
      },
    },
    {
      $project: {
        name: 1,
        phone: 1,
        avatar: 1,
        limit: { $ifNull: ["$limit", 5000] },
        documents: 1,
        currentCash: {
          $max: [
            0,
            {
              $reduce: {
                input: {
                  $filter: {
                    input: "$allTransactions",
                    as: "transaction",
                    cond: {
                      $and: [
                        {
                          $in: [
                            "$$transaction.type",
                            ["Cash Collection", "Cash Settlement"],
                          ],
                        },
                        { $ne: ["$$transaction.status", "Failed"] },
                      ],
                    },
                  },
                },
                initialValue: 0,
                in: {
                  $cond: [
                    { $eq: ["$$this.type", "Cash Collection"] },
                    { $add: ["$$value", { $abs: "$$this.amount" }] },
                    {
                      $subtract: ["$$value", { $abs: "$$this.amount" }],
                    },
                  ],
                },
              },
            },
          ],
        },
        pendingOrders: {
          $size: {
            $filter: {
              input: "$allOrders",
              as: "order",
              cond: {
                $and: [
                  {
                    $in: [
                      "$$order.status",
                      ["placed", "confirmed", "processing", "packed", "shipped", "picked_up", "out_for_delivery"],
                    ],
                  },
                  {
                    $or: [
                      { $in: ["$$order.paymentMode", ["COD", "cod"]] },
                      { $in: ["$$order.payment.method", ["cash", "cod"]] },
                    ],
                  },
                ],
              },
            },
          },
        },
        totalOrders: {
          $size: {
            $filter: {
              input: "$allOrders",
              as: "order",
              cond: { $eq: ["$$order.status", "delivered"] },
            },
          },
        },
        totalSettled: {
          $reduce: {
            input: {
              $filter: {
                input: "$allTransactions",
                as: "transaction",
                cond: {
                  $and: [
                    { $eq: ["$$transaction.type", "Cash Settlement"] },
                    { $ne: ["$$transaction.status", "Failed"] },
                  ],
                },
              },
            },
            initialValue: 0,
            in: { $add: ["$$value", { $abs: "$$this.amount" }] },
          },
        },
        lastSettlementTxn: {
          $arrayElemAt: [
            {
              $sortArray: {
                input: {
                  $filter: {
                    input: "$allTransactions",
                    as: "transaction",
                    cond: {
                      $and: [
                        { $eq: ["$$transaction.type", "Cash Settlement"] },
                        { $ne: ["$$transaction.status", "Failed"] },
                      ],
                    },
                  },
                },
                sortBy: { createdAt: -1 },
              },
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        id: "$_id",
        name: 1,
        phone: 1,
        avatar: {
          $cond: [
            { $ifNull: ["$documents.profileImage", false] },
            "$documents.profileImage",
            {
              $concat: [
                "https://api.dicebear.com/7.x/avataaars/svg?seed=",
                "$name",
              ],
            },
          ],
        },
        currentCash: 1,
        totalSettled: 1,
        limit: 1,
        status: {
          $cond: [
            { $gt: ["$currentCash", 4500] },
            "critical",
            {
              $cond: [
                { $gt: ["$currentCash", 3000] },
                "warning",
                "safe",
              ],
            },
          ],
        },
        pendingOrders: 1,
        totalOrders: 1,
        lastSettlement: {
          $ifNull: ["$lastSettlementTxn.createdAt", "Never"],
        },
      },
    },
    {
      $facet: {
        meta: [{ $count: "total" }],
        items: [{ $skip: skip }, { $limit: limit }],
        globalStats: [
          {
            $group: {
              _id: null,
              totalInHand: { $sum: "$currentCash" },
              totalSettled: { $sum: "$totalSettled" },
              overLimitCount: {
                $sum: {
                  $cond: [{ $gte: ["$currentCash", "$limit"] }, 1, 0],
                },
              },
              totalRiders: { $sum: 1 },
            },
          },
        ],
      },
    },
  ];

  const [aggregateResult, inTransitResult] = await Promise.all([
    Delivery.aggregate(ridersPipeline),
    Order.aggregate([
      {
        $match: {
          paymentMode: { $in: ["COD", "cod"] },
          status: {
            $in: [
              "placed",
              "confirmed",
              "processing",
              "packed",
              "shipped",
              "picked_up",
              "out_for_delivery",
            ],
          },
          orderStatus: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          amount: {
            $sum: {
              $ifNull: ["$paymentBreakdown.grandTotal", "$pricing.total"],
            },
          },
        },
      },
    ]),
  ]);

  const facetDoc = aggregateResult?.[0] || {};
  const meta = facetDoc.meta?.[0];
  const riders = facetDoc.items ?? [];
  const total = meta?.total ?? riders.length;

  const inTransitCodCount = inTransitResult[0]?.count || 0;
  const inTransitCodAmount = inTransitResult[0]?.amount || 0;

  const globalStat = facetDoc.globalStats?.[0];
  const totalInHand = globalStat?.totalInHand ?? 0;
  const totalSettled = globalStat?.totalSettled ?? 0;
  const totalRidersCount = globalStat?.totalRiders ?? total;
  const overLimitCount = globalStat?.overLimitCount ?? 0;
  const avgBalance = totalRidersCount ? Math.round(totalInHand / totalRidersCount) : 0;

  return {
    items: riders,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    stats: {
      totalInHand,
      totalSettled,
      inTransitCodCount,
      inTransitCodAmount,
      totalRiders: totalRidersCount,
      overLimitCount,
      avgBalance,
    },
  };
}

export async function settleRiderCashEntry({ riderId, amount, method, notes, actorId }) {
  if (!riderId || !amount || amount <= 0) {
    throw new Error("Missing riderId or invalid amount");
  }

  const rider = await Delivery.findById(riderId);
  if (!rider) {
    return null;
  }

  const amountAbs = Math.abs(Number(amount));

  // 1. Check if there is an existing pending handover transaction for this rider
  let settlement = await Transaction.findOne({
    user: riderId,
    userModel: "Delivery",
    type: "Cash Settlement",
    status: { $in: ["Pending", "Processing"] },
  }).sort({ createdAt: -1 });

  if (settlement) {
    settlement.status = "Settled";
    settlement.amount = -amountAbs;
    settlement.notes = notes || `Settled by Admin at Hub. Method: ${method || "Cash"}`;
    if (!settlement.reference) {
      settlement.reference = `CSH-SET-${Date.now()}`;
    }
    await settlement.save();
  } else {
    settlement = await Transaction.create({
      user: riderId,
      userModel: "Delivery",
      type: "Cash Settlement",
      amount: -amountAbs,
      status: "Settled",
      reference: `CSH-SET-${Date.now()}`,
      notes: notes || `Settled by Admin at Hub. Method: ${method || "Cash"}`,
    });
  }

  // 2. Reconcile COD Orders for this rider so codPendingAmount becomes 0
  const pendingOrders = await Order.find({
    deliveryBoy: riderId,
    paymentMode: { $in: ["COD", "cod"] },
    status: { $ne: "cancelled" },
    orderStatus: { $ne: "cancelled" },
    "paymentBreakdown.codPendingAmount": { $gt: 0 },
  }).sort({ createdAt: 1 });

  let remaining = amountAbs;
  for (const order of pendingOrders) {
    if (remaining <= 0) break;
    const pending = Number(order.paymentBreakdown?.codPendingAmount || 0);
    if (pending <= 0) continue;
    const settleAmt = Math.min(pending, remaining);
    order.paymentBreakdown.codPendingAmount = Math.max(0, pending - settleAmt);
    order.paymentBreakdown.codRemittedAmount = (order.paymentBreakdown.codRemittedAmount || 0) + settleAmt;
    if (order.paymentBreakdown.codPendingAmount === 0) {
      if (!order.financeFlags) order.financeFlags = {};
      order.financeFlags.codSettled = true;
      order.financeFlags.codMarkedCollected = true;
    }
    await order.save();
    remaining -= settleAmt;
  }

  // 3. Update Wallet cashInHand
  try {
    const wallet = await Wallet.findOne({
      ownerType: { $in: ["DELIVERY_PARTNER", "DELIVERY"] },
      ownerId: riderId,
    });
    if (wallet) {
      wallet.cashInHand = Math.max(0, (wallet.cashInHand || 0) - amountAbs);
      await wallet.save();
    }
  } catch (wErr) {
    // Non-blocking
  }

  // 4. Invalidate rider COD cache
  try {
    const cacheKey = buildKey("delivery", "codSummary", String(riderId));
    await del(cacheKey);
  } catch (cErr) {
    // Non-blocking
  }

  // 5. Notify rider
  try {
    await Notification.create({
      recipient: riderId,
      recipientModel: "Delivery",
      title: "Cash Settled at Hub",
      message: `Admin has collected and verified ₹${amountAbs.toLocaleString()} cash from you. Your balance is updated.`,
      type: "payment",
      data: { transactionId: settlement._id },
    });
  } catch (nErr) {}

  return settlement;
}

export async function getRiderCashDetailsData(riderId) {
  const riderOid = mongoose.Types.ObjectId.isValid(riderId)
    ? new mongoose.Types.ObjectId(riderId)
    : null;

  const userQuery = riderOid
    ? { $in: [riderOid, String(riderId)] }
    : riderId;

  const [transactions, pendingOrders, riderDoc] = await Promise.all([
    Transaction.find({
      user: userQuery,
      userModel: "Delivery",
      type: { $in: ["Cash Collection", "Cash Settlement", "Withdrawal", "Delivery Earning"] },
    })
      .populate("order", "orderId pricing paymentBreakdown status createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),

    Order.find({
      deliveryBoy: userQuery,
      paymentMode: { $in: ["COD", "cod"] },
      status: { $in: ["placed", "confirmed", "processing", "packed", "shipped", "picked_up", "out_for_delivery"] },
    })
      .select("orderId paymentBreakdown pricing status createdAt")
      .sort({ createdAt: -1 })
      .lean(),

    Delivery.findById(riderId).select("name phone limit documents").lean(),
  ]);

  const items = transactions.map((transaction) => ({
    id: transaction.order?.orderId || transaction.reference || String(transaction._id),
    reference: transaction.reference || "",
    type: transaction.type,
    amount: transaction.amount,
    status: transaction.status,
    time: new Date(transaction.createdAt).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    createdAt: transaction.createdAt,
    date: transaction.createdAt,
  }));

  const pendingFormatted = pendingOrders.map((o) => ({
    orderId: o.orderId,
    amount: o.paymentBreakdown?.grandTotal || o.pricing?.total || 0,
    status: o.status,
    createdAt: o.createdAt,
  }));

  const pendingTotal = pendingFormatted.reduce((acc, o) => acc + (o.amount || 0), 0);

  const cashCollected = transactions
    .filter((t) => t.type === "Cash Collection" && t.status !== "Failed")
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

  const cashSettled = transactions
    .filter((t) => t.type === "Cash Settlement" && t.status !== "Failed")
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

  const currentCash = Math.max(cashCollected - cashSettled, 0);
  const limit = riderDoc?.limit || 5000;

  return {
    summary: {
      riderId: String(riderId),
      name: riderDoc?.name || "Rider",
      currentCash,
      limit,
      safeLimitRemaining: Math.max(limit - currentCash, 0),
      status: currentCash >= limit ? "critical" : currentCash > 3000 ? "warning" : "safe",
      pendingCodOrdersCount: pendingOrders.length,
      pendingCodOrdersTotal: pendingTotal,
    },
    pendingOrders: pendingFormatted,
    items,
  };
}

export async function getCashSettlementHistoryData({ page, limit, skip }) {
  const query = { userModel: "Delivery", type: "Cash Settlement" };

  const [history, total] = await Promise.all([
    Transaction.find(query)
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(query),
  ]);

  const items = history.map((entry) => ({
    id: (entry.reference || entry._id).toString(),
    rider: entry.user?.name || "Unknown Rider",
    amount: Math.abs(entry.amount),
    date: entry.createdAt,
    method: entry.notes?.replace("Method: ", "") || "Cash Submission",
    status: "completed",
  }));

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
