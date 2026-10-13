import Transaction from "../../models/transaction.js";
import Notification from "../../models/notification.js";
import { getAdminFinanceSummary } from "../finance/walletService.js";
import { getLedgerEntries } from "../finance/ledgerService.js";

export async function getAdminWalletOverview({ page, limit }) {
  const stats = await getAdminFinanceSummary();
  const ledger = await getLedgerEntries({ page, limit });
  const transactionItems = ledger.items.map((entry) => ({
    id: entry.transactionId || entry.reference || String(entry._id),
    type: entry.type,
    amount:
      entry.direction === "DEBIT"
        ? -Math.abs(entry.amount || 0)
        : Math.abs(entry.amount || 0),
    status: entry.status,
    sender: entry.direction === "DEBIT" ? entry.actorType : "System/Order",
    recipient: entry.direction === "CREDIT" ? entry.actorType : "Platform Wallet",
    date: new Date(entry.createdAt).toLocaleDateString(),
    time: new Date(entry.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    notes: entry.description || entry.type,
    method: entry.paymentMode || "N/A",
  }));

  return {
    stats: {
      totalPlatformEarning: stats.totalPlatformEarning,
      totalAdminEarning: stats.totalAdminEarning,
      availableBalance: stats.availableBalance,
      sellerPendingPayouts: stats.sellerPendingPayouts,
      deliveryPendingPayouts: stats.deliveryPendingPayouts,
      systemFloat: stats.systemFloatCOD,
    },
    transactions: {
      items: transactionItems,
      page: ledger.page,
      limit: ledger.limit,
      total: ledger.total,
      totalPages: ledger.totalPages,
    },
  };
}



export async function getSellerWithdrawalsData({ page, limit, skip, status }) {
  const query = { userModel: "Seller", type: "Withdrawal" };
  if (status && status !== "all") {
    query.status = new RegExp(`^${status}$`, "i");
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .populate("user", "name shopName phone bankDetails accountHolder accountNumber ifsc bankName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(query),
  ]);

  return {
    items: transactions,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getWarehouseWithdrawalsData({ page = 1, limit = 25 }) {
  return {
    items: [],
    page,
    limit,
    total: 0,
    totalPages: 1,
  };
}

export async function getSellerTransactionsData({ page, limit, skip, status, type, search }) {
  const query = { userModel: "Seller" };

  if (status && status !== "all") {
    if (status === "paid" || status === "settled") {
      query.status = { $in: ["Settled", "settled", "completed", "processed"] };
    } else if (status === "pending") {
      query.status = { $in: ["Pending", "pending", "Processing", "processing"] };
    } else if (status === "failed") {
      query.status = { $in: ["Failed", "failed", "Cancelled", "cancelled"] };
    }
  }

  if (type && type !== "all") {
    if (type === "sale") {
      query.type = { $in: ["Order Payment", "Seller Earning", "sale"] };
    } else if (type === "payout") {
      query.type = { $in: ["Withdrawal", "Payout", "payout"] };
    } else if (type === "refund") {
      query.type = { $in: ["Refund", "refund"] };
    }
  }

  const globalStatsAggPromise = Transaction.aggregate([
    { $match: { userModel: "Seller" } },
    {
      $lookup: {
        from: "orders",
        localField: "order",
        foreignField: "_id",
        as: "orderDoc",
      },
    },
    {
      $unwind: {
        path: "$orderDoc",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: null,
        totalSales: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$type", ["Order Payment", "Seller Earning", "sale"]] },
                  { $ne: ["$status", "Failed"] },
                ],
              },
              { $abs: "$amount" },
              0,
            ],
          },
        },
        totalCommission: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$type", ["Order Payment", "Seller Earning", "sale"]] },
                  { $ne: ["$status", "Failed"] },
                ],
              },
              {
                $ifNull: [
                  "$orderDoc.paymentBreakdown.platformFee",
                  { $ifNull: ["$orderDoc.pricing.platformFee", 0] },
                ],
              },
              0,
            ],
          },
        },
        totalPaidOut: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$type", ["Withdrawal", "Payout", "payout"]] },
                  { $in: ["$status", ["Settled", "settled", "completed", "processed"]] },
                ],
              },
              { $abs: "$amount" },
              0,
            ],
          },
        },
        pendingTotal: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", ["Pending", "pending", "Processing", "processing"]] },
                  { $ne: ["$status", "Failed"] },
                ],
              },
              { $abs: "$amount" },
              0,
            ],
          },
        },
      },
    },
  ]);

  const [transactions, total, statsAgg] = await Promise.all([
    Transaction.find(query)
      .populate("user", "name shopName phone bankDetails accountHolder accountNumber ifsc bankName")
      .populate({
        path: "order",
        select: "orderId pricing paymentBreakdown paymentMode paymentStatus items status",
        populate: {
          path: "items.product",
          select: "name",
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(query),
    globalStatsAggPromise,
  ]);

  const globalStats = statsAgg?.[0] || {};

  return {
    items: transactions,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    stats: {
      totalSales: globalStats.totalSales || 0,
      totalCommission: globalStats.totalCommission || 0,
      totalPaidOut: globalStats.totalPaidOut || 0,
      pendingTotal: globalStats.pendingTotal || 0,
    },
  };
}

export async function getDeliveryWithdrawalsData({ page, limit, skip, status }) {
  const query = { userModel: "Delivery", type: "Withdrawal" };
  if (status && status !== "all") {
    query.status = new RegExp(`^${status}$`, "i");
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .populate("user", "name phone bankDetails accountHolder accountNumber ifsc bankName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(query),
  ]);

  return {
    items: transactions,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function updateWithdrawalStatusById({ id, status, reason }) {
  if (!["Settled", "Failed", "Processing"].includes(status)) {
    throw new Error("Invalid status");
  }

  const transaction = await Transaction.findById(id).populate("user", "name");
  if (!transaction) {
    return null;
  }

  transaction.status = status;
  if (reason) {
    transaction.notes = reason;
    if (!transaction.meta) transaction.meta = {};
    transaction.meta.reason = reason;
  }

  await transaction.save();
  return transaction;
}


