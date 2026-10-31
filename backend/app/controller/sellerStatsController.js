import Order from "../models/order.js";
import Customer from "../models/customer.js";
import Transaction from "../models/transaction.js";
import handleResponse from "../utils/helper.js";
import mongoose from "mongoose";
import Wallet from "../models/wallet.js";
import { getSellerStats as getSellerStatsFromService } from "../services/seller/sellerStatsService.js";
import { getErrorStatus } from "../utils/httpError.js";

/* ===============================
   GET SELLER DASHBOARD STATS
   Delegates to SellerStatsService (P6.2 — cache-fronted) so the heavy
   $facet aggregation + category pipeline are absorbed for ~60s.
================================ */
export const getSellerStats = async (req, res) => {
    try {
        const result = await getSellerStatsFromService(req.user.id, {
            range: req.query?.range,
            timeRange: req.query?.timeRange,
            startDate: req.query?.startDate,
            endDate: req.query?.endDate,
        });
        return handleResponse(res, 200, "Stats fetched successfully", result);
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};

/* ===============================
   GET SELLER EARNINGS / TRANSACTIONS
================================ */
export const getSellerEarnings = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const sellerOid = new mongoose.Types.ObjectId(sellerId);

        const transactions = await Transaction.find({ user: sellerId, userModel: 'Seller' })
            .sort({ createdAt: -1 })
            .populate({
                path: "order",
                select: "orderId status workflowStatus paymentBreakdown customer address shippingAddress deliveryAddress",
                populate: { path: "customer", select: "name phone" },
            });

        const settledEarnings = transactions
            .filter(t => t.type === 'Order Payment' && t.status === 'Settled')
            .reduce((acc, t) => acc + (t.order?.paymentBreakdown?.sellerPayoutTotal || t.amount || 0), 0);

        const settledWithdrawals = transactions
            .filter(t => t.type === 'Withdrawal' && t.status === 'Settled')
            .reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);

        const pendingOrdersPayout = transactions
            .filter(t => {
                if (t.type !== 'Order Payment') return false;
                const isCancelled =
                    t.order?.status === "cancelled" ||
                    t.order?.status === "Cancelled" ||
                    t.order?.workflowStatus === "CANCELLED" ||
                    t.status === "Failed" ||
                    t.status === "Cancelled";
                const isDelivered =
                    t.order?.status === "delivered" ||
                    t.order?.status === "Delivered" ||
                    t.order?.workflowStatus === "DELIVERED" ||
                    t.status === "Settled" ||
                    t.status === "Completed";
                return !isCancelled && !isDelivered;
            })
            .reduce((acc, t) => acc + (t.order?.paymentBreakdown?.sellerPayoutTotal || t.amount || 0), 0);

        const pendingWithdrawals = transactions
            .filter(t => t.type === 'Withdrawal' && (t.status === 'Pending' || t.status === 'Processing'))
            .reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);

        const settledBalance = Math.max(0, settledEarnings - settledWithdrawals);
        const realAvailableBalance = Math.max(0, settledBalance - pendingWithdrawals);

        // Fetch wallet for live pending balance (money on hold due to return window)
        const wallet = await Wallet.findOne({ ownerType: 'SELLER', ownerId: sellerId });
        const onHoldBalance = wallet ? wallet.pendingBalance : 0;

        // Auto-heal wallet if drifted
        if (wallet && wallet.availableBalance !== realAvailableBalance) {
            wallet.availableBalance = realAvailableBalance;
            await wallet.save();
        }
        const liveAvailableBalance = realAvailableBalance;

        // Keep "Total Revenue" aligned with Dashboard definition:
        // sum of delivered seller orders from Order collection (matches both ObjectId and String seller references).
        const [orderRevenueAgg] = await Order.aggregate([
            {
                $match: {
                    $or: [
                        { seller: sellerOid },
                        { seller: sellerId.toString() }
                    ],
                    status: 'delivered',
                },
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: { $ifNull: ["$paymentBreakdown.sellerPayoutTotal", 0] } },
                },
            },
        ]);
        const totalRevenue = Number(orderRevenueAgg?.totalRevenue || 0);

        const totalWithdrawn = transactions
            .filter(t => t.type === 'Withdrawal' && t.status === 'Settled')
            .reduce((acc, t) => acc + Math.abs(t.amount), 0);

        // Monthly Revenue Aggregation (Last 6 Months) from Delivered Orders
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyAggregation = await Order.aggregate([
            {
                $match: {
                    $or: [
                        { seller: sellerOid },
                        { seller: sellerId.toString() }
                    ],
                    status: 'delivered',
                    $expr: {
                        $gte: [{ $toDate: { $ifNull: ["$deliveredAt", "$createdAt"] } }, sixMonthsAgo]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m",
                            date: { $toDate: { $ifNull: ["$deliveredAt", "$createdAt"] } }
                        }
                    },
                    revenue: { $sum: { $ifNull: ["$paymentBreakdown.sellerPayoutTotal", 0] } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const chartData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const dateStr = d.toISOString().slice(0, 7);
            const data = monthlyAggregation.find(m => m._id === dateStr);
            chartData.push({
                name: monthNames[d.getMonth()],
                revenue: data ? Number(data.revenue.toFixed(2)) : 0
            });
        }

        return handleResponse(res, 200, "Earnings fetched successfully", {
            balances: {
                settledBalance: settledBalance,
                pendingOrdersPayout: pendingOrdersPayout,
                pendingPayouts: pendingOrdersPayout,
                pendingWithdrawals: pendingWithdrawals,
                onHoldBalance: onHoldBalance, // New field
                availableBalance: liveAvailableBalance, // New field for clarity
                totalRevenue: totalRevenue,
                totalWithdrawn: totalWithdrawn
            },
            monthlyChart: chartData,
            ledger: transactions.map((t) => {
                const isWithdrawal = t.type === "Withdrawal";
                const isCancelled =
                    t.order?.status === "cancelled" ||
                    t.order?.status === "Cancelled" ||
                    t.order?.workflowStatus === "CANCELLED" ||
                    t.status === "Failed" ||
                    t.status === "Cancelled";

                let resolvedStatus = t.status || "Pending";
                if (!isWithdrawal) {
                    if (isCancelled) {
                        resolvedStatus = "Cancelled";
                    } else if (
                        t.order?.status === "delivered" ||
                        t.order?.status === "Delivered" ||
                        t.order?.workflowStatus === "DELIVERED" ||
                        t.status === "Settled" ||
                        t.status === "Completed"
                    ) {
                        resolvedStatus = "Settled";
                    } else {
                        resolvedStatus = "Pending";
                    }
                } else {
                    resolvedStatus = (t.status === "Completed" || t.status === "Settled") ? "Settled" : (t.status || "Pending");
                }

                let customerName = "Customer";
                if (isWithdrawal) {
                    customerName = t.meta?.bankDetails?.bankName
                        ? `${t.meta.bankDetails.bankName} Transfer`
                        : t.notes || "Bank Transfer";
                } else if (t.order?.customer?.name) {
                    customerName = t.order.customer.name;
                } else if (t.order?.address?.receiverName) {
                    customerName = t.order.address.receiverName;
                } else if (t.order?.address?.name) {
                    customerName = t.order.address.name;
                } else if (t.order?.shippingAddress?.fullName) {
                    customerName = t.order.shippingAddress.fullName;
                } else if (t.order?.deliveryAddress?.name) {
                    customerName = t.order.deliveryAddress.name;
                }

                return {
                    id: (t.reference || t._id).toString(),
                    type: t.type,
                    amount: isWithdrawal
                        ? -Math.abs(t.amount)
                        : t.order?.paymentBreakdown?.sellerPayoutTotal || t.amount,
                    status: resolvedStatus,
                    rawStatus: t.status,
                    orderStatus: t.order?.status || null,
                    date: t.createdAt.toISOString().split("T")[0],
                    time: t.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    customer: customerName,
                    ref: t.order ? `#${t.order.orderId}` : t.reference || t._id,
                    notes: t.notes || null,
                    meta: t.meta || null,
                };
            }),
        });
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};
