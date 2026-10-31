import Order from "../models/order.js";
import { orderMatchQueryFromRouteParam } from "../utils/orderLookup.js";
import Transaction from "../models/transaction.js";
import Delivery from "../models/delivery.js";
import DeliveryAssignment from "../models/deliveryAssignment.js";
import Wallet from "../models/wallet.js";
import handleResponse from "../utils/helper.js";
import mongoose from "mongoose";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import {
    writeDeliveryLocation,
    appendTrailPoint,
    clearOrderTracking,
    clearRiderPresence,
} from "../services/firebaseService.js";
import { applyDeliveredSettlement } from "../services/orderSettlement.js";
import { roundCurrency } from "../utils/money.js";
import logger from "../services/logger.js";
import { shouldThrottle as throttleLocationUpdate } from "../services/delivery/locationThrottleService.js";
import {
    getDeliveryStats as getDeliveryStatsFromService,
    getDeliveryEarnings as getDeliveryEarningsFromService,
    getDeliveryCodCashSummary as getDeliveryCodCashSummaryFromService,
} from "../services/delivery/deliveryEarningsService.js";
import { buildKey, del } from "../services/cacheService.js";
import { getErrorStatus } from "../utils/httpError.js";

/* ===============================
   GET DELIVERY DASHBOARD STATS
================================ */
export const getDeliveryStats = async (req, res) => {
    try {
        const result = await getDeliveryStatsFromService(req.user.id);
        return handleResponse(res, 200, "Stats fetched", result);
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};

/* ===============================
   GET DELIVERY EARNINGS
================================ */
export const getDeliveryEarnings = async (req, res) => {
    try {
        const { timeframe, date } = req.query;
        const result = await getDeliveryEarningsFromService(req.user.id, timeframe, date);
        return handleResponse(res, 200, "Earnings fetched", result);
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};

/* ===============================
   GET DELIVERY COD CASH SUMMARY
================================ */
export const getDeliveryCodCashSummary = async (req, res) => {
    try {
        const rawId = req.user?.id ?? req.user?._id;
        const result = await getDeliveryCodCashSummaryFromService(rawId);
        return handleResponse(res, 200, "COD cash summary fetched", result);
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};

/* ===============================
   SUBMIT DELIVERY COD CASH
================================ */
export const submitDeliveryCodCashToAdmin = async (req, res) => {
    try {
        const rawId = req.user?.id ?? req.user?._id;
        if (!rawId) {
            return handleResponse(res, 401, "Unauthorized");
        }
        if (!mongoose.Types.ObjectId.isValid(String(rawId))) {
            return handleResponse(res, 401, "Invalid user id");
        }

        const deliveryBoyId = new mongoose.Types.ObjectId(String(rawId));
        const orders = await Order.find({
            deliveryBoy: deliveryBoyId,
            paymentMode: { $in: ["COD", "cod"] },
            status: { $ne: "cancelled" },
            orderStatus: { $ne: "cancelled" },
            "paymentBreakdown.codPendingAmount": { $gt: 0 },
        })
            .select("orderId paymentBreakdown.codPendingAmount")
            .sort({ createdAt: 1 })
            .lean();

        if (!orders.length) {
            return handleResponse(
                res,
                400,
                "No collected COD cash is ready to submit. Mark customer cash as collected first.",
            );
        }

        const totalAvailable = roundCurrency(
            orders.reduce(
                (sum, order) => sum + Number(order?.paymentBreakdown?.codPendingAmount || 0),
                0,
            ),
        );
        const requestedRaw = req.body?.amount;
        const requestedAmount =
            requestedRaw == null || requestedRaw === ""
                ? null
                : roundCurrency(requestedRaw);

        if (requestedAmount != null && (!Number.isFinite(Number(requestedRaw)) || requestedAmount <= 0)) {
            return handleResponse(res, 400, "Enter a valid amount to submit");
        }

        const amountToSubmit = requestedAmount == null ? totalAvailable : requestedAmount;
        if (amountToSubmit <= 0) {
            return handleResponse(
                res,
                400,
                "No collected COD cash is ready to submit.",
            );
        }
        if (amountToSubmit > totalAvailable) {
            return handleResponse(
                res,
                400,
                `You can submit up to ₹${totalAvailable.toLocaleString()}`,
            );
        }

        // Generate clean 4-digit deposit slip reference (e.g. DEP-8942)
        const slipCode = Math.floor(1000 + Math.random() * 9000);
        const depositRef = `DEP-${slipCode}`;

        // Check if there is an existing pending handover transaction, update it or create new
        let handoverTx = await Transaction.findOne({
            user: deliveryBoyId,
            userModel: "Delivery",
            type: "Cash Settlement",
            status: { $in: ["Pending", "Processing"] },
        });

        if (handoverTx) {
            handoverTx.amount = -Math.abs(amountToSubmit);
            handoverTx.reference = depositRef;
            handoverTx.notes = req.body?.notes || `Deposit Handover Slip #${depositRef} at Hub Counter`;
            handoverTx.meta = {
                source: "delivery_cod_cash_page",
                depositRef,
                orderCount: orders.length,
                orderIds: orders.map((o) => o.orderId),
            };
            await handoverTx.save();
        } else {
            handoverTx = await Transaction.create({
                user: deliveryBoyId,
                userModel: "Delivery",
                type: "Cash Settlement",
                amount: -Math.abs(amountToSubmit),
                status: "Pending",
                reference: depositRef,
                notes: req.body?.notes || `Deposit Handover Slip #${depositRef} at Hub Counter`,
                meta: {
                    source: "delivery_cod_cash_page",
                    depositRef,
                    orderCount: orders.length,
                    orderIds: orders.map((o) => o.orderId),
                },
            });
        }

        // Clear cache so rider app gets updated pendingHandover immediately
        try {
            const cacheKey = buildKey("delivery", "codSummary", String(deliveryBoyId));
            await del(cacheKey);
        } catch (cErr) {}

        return handleResponse(res, 200, "Cash handover request created successfully", {
            reference: depositRef,
            amount: amountToSubmit,
            orderCount: orders.length,
            status: "Pending",
            message: "Show this deposit reference to the Hub Manager to verify & settle cash.",
        });
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};

/* ===============================
   GET DELIVERY ORDER HISTORY
================================ */
/**
 * Any order this rider was linked to: primary assignment, return pickup, or v2 broadcast winner.
 */
async function buildAssignedToPartnerFilter(deliveryBoyId) {
    const clauses = [
        { deliveryBoy: deliveryBoyId },
        { returnDeliveryBoy: deliveryBoyId },
    ];
    try {
        const winnerOrderIds = await DeliveryAssignment.distinct("orderId", {
            winnerDeliveryId: deliveryBoyId,
        });
        if (winnerOrderIds?.length) {
            clauses.push({ orderId: { $in: winnerOrderIds } });
        }
    } catch {
        /* ignore */
    }
    return { $or: clauses };
}

export const getMyDeliveryOrders = async (req, res) => {
    try {
        const rawId = req.user?.id ?? req.user?._id;
        if (!rawId) {
            return handleResponse(res, 401, "Unauthorized");
        }
        if (!mongoose.Types.ObjectId.isValid(String(rawId))) {
            return handleResponse(res, 401, "Invalid user id");
        }
        const deliveryBoyId = new mongoose.Types.ObjectId(String(rawId));
        const { status } = req.query;
        const normalized = (status || "all").toLowerCase();

        const assignedToPartner = await buildAssignedToPartnerFilter(deliveryBoyId);

        /** Separate forward delivery vs return pickup query based on normalized filter */
        let query;
        if (normalized === "delivered") {
            query = {
                deliveryBoy: deliveryBoyId,
                $or: [
                    { status: "delivered" },
                    { workflowStatus: WORKFLOW_STATUS.DELIVERED },
                ],
            };
        } else if (normalized === "cancelled") {
            query = {
                deliveryBoy: deliveryBoyId,
                $or: [
                    { status: "cancelled" },
                    { workflowStatus: WORKFLOW_STATUS.CANCELLED },
                ],
            };
        } else if (normalized === "returns") {
            query = {
                returnDeliveryBoy: deliveryBoyId,
                returnStatus: { $ne: "none" },
            };
        } else {
            query = assignedToPartner;
        }

        const rawOrders = await Order.find(query)
            .sort({ createdAt: -1 })
            .limit(100)
            .populate("seller", "shopName address")
            .populate("customer", "name phone")
            .lean();

        const refToIdString = (ref) => {
            if (!ref) return "";
            if (typeof ref === "string") return ref;
            if (ref._id) return String(ref._id);
            return String(ref);
        };

        const tasks = [];
        const riderIdStr = deliveryBoyId.toString();

        for (const order of rawOrders) {
            const isForwardRider = Boolean(
                order.deliveryBoy && refToIdString(order.deliveryBoy) === riderIdStr
            );
            const isReturnRider = Boolean(
                order.returnDeliveryBoy &&
                refToIdString(order.returnDeliveryBoy) === riderIdStr &&
                order.returnStatus &&
                order.returnStatus !== "none"
            );

            const forwardEarning =
                order.riderEarnings ??
                order.delivery?.riderEarning ??
                Math.round((order.pricing?.total || 0) * 0.1);

            const returnEarning =
                order.returnDeliveryCommission ??
                order.returnCommission ??
                0;

            const isDelivered = order.workflowStatus === WORKFLOW_STATUS.DELIVERED || order.status === "delivered";
            const isCancelled = order.workflowStatus === WORKFLOW_STATUS.CANCELLED || order.status === "cancelled";

            // 1. Forward Delivery Task
            if (
                isForwardRider &&
                (normalized === "all" || normalized === "delivered" || normalized === "cancelled")
            ) {
                if (normalized === "delivered" && !isDelivered) {
                    // skip
                } else if (normalized === "cancelled" && !isCancelled) {
                    // skip
                } else {
                    tasks.push({
                        ...order,
                        _id: isReturnRider ? `${order._id}_delivery` : order._id,
                        orderMongoId: order._id,
                        orderId: order.orderId,
                        taskType: "DELIVERY",
                        isReturnTask: false,
                        taskEarnings: isCancelled ? 0 : forwardEarning,
                        taskDate: order.deliveredAt || order.createdAt,
                        taskStatus: isDelivered ? "delivered" : (isCancelled ? "cancelled" : (order.status || "active")),
                    });
                }
            }

            // 2. Return Pickup Task
            if (
                isReturnRider &&
                (normalized === "all" || normalized === "returns")
            ) {
                const isReturned = order.returnStatus === "returned" || order.returnStatus === "refund_completed";

                tasks.push({
                    ...order,
                    _id: isForwardRider ? `${order._id}_return` : order._id,
                    orderMongoId: order._id,
                    orderId: order.orderId,
                    taskType: "RETURN",
                    isReturnTask: true,
                    taskEarnings: returnEarning,
                    taskDate: order.returnDeliveredBackAt || order.returnDropVerifiedAt || order.returnPickedAt || order.updatedAt || order.createdAt,
                    taskStatus: isReturned ? "returned" : (order.returnStatus || "return_assigned"),
                });
            }
        }

        // Sort tasks by taskDate descending
        tasks.sort((a, b) => new Date(b.taskDate || b.createdAt) - new Date(a.taskDate || a.createdAt));

        return handleResponse(res, 200, "Delivery orders fetched", tasks);
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};

/* ===============================
   REQUEST WITHDRAWAL (Delivery)
================================ */
export const requestWithdrawal = async (req, res) => {
    try {
        const deliveryBoyId = req.user.id;
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return handleResponse(res, 400, "Please enter a valid amount");
        }

        // 1. Calculate current available balance
        const transactions = await Transaction.find({ user: deliveryBoyId, userModel: 'Delivery' });

        const settledBalance = transactions
            .filter(t => t.status === 'Settled')
            .reduce((acc, t) => acc + t.amount, 0);

        const pendingPayouts = transactions
            .filter(t => (t.status === 'Pending' || t.status === 'Processing') && t.type === 'Withdrawal')
            .reduce((acc, t) => acc + Math.abs(t.amount), 0);

        const availableBalance = settledBalance - pendingPayouts;

        if (amount > availableBalance) {
            return handleResponse(res, 400, `Insufficient balance. Available: ₹${availableBalance}`);
        }

        // 2. Create Withdrawal Transaction
        const withdrawal = await Transaction.create({
            user: deliveryBoyId,
            userModel: "Delivery",
            type: "Withdrawal",
            amount: -Math.abs(amount),
            status: "Pending",
            reference: `WDR-DL-${Date.now()}`
        });

        // 3. Sync Wallet for DELIVERY_PARTNER
        try {
            const wallet = await Wallet.findOne({
                ownerType: { $in: ["DELIVERY_PARTNER", "DELIVERY"] },
                ownerId: deliveryBoyId,
            });
            if (wallet) {
                wallet.availableBalance = Math.max(0, (wallet.availableBalance || 0) - Math.abs(amount));
                wallet.pendingBalance = (wallet.pendingBalance || 0) + Math.abs(amount);
                await wallet.save();
            }
        } catch (wErr) {
            logger.warn("Wallet sync warning on delivery withdrawal request:", wErr?.message || wErr);
        }

        return handleResponse(res, 201, "Withdrawal request submitted successfully", withdrawal);
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};

/* ===============================
   GET DELIVERY WITHDRAWALS & BALANCE
================================ */
export const getDeliveryWithdrawals = async (req, res) => {
    try {
        const rawId = req.user?.id ?? req.user?._id;
        if (!rawId) {
            return handleResponse(res, 401, "Unauthorized");
        }
        const deliveryBoyId = new mongoose.Types.ObjectId(String(rawId));

        // 1. Fetch all transactions for this rider (to get complete history & true financial balance)
        const allTransactions = await Transaction.find({
            user: deliveryBoyId,
            userModel: "Delivery",
        }).sort({ createdAt: -1 }).lean();

        // Settled earnings from delivery, bonus, incentives
        const settledEarnings = allTransactions
            .filter((t) => t.status === "Settled" && ["Delivery Earning", "Incentive", "Bonus"].includes(t.type))
            .reduce((acc, t) => acc + (t.amount || 0), 0);

        // Settled withdrawals (money already paid out by Admin)
        const settledWithdrawals = allTransactions
            .filter((t) => t.status === "Settled" && t.type === "Withdrawal")
            .reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);

        // Pending withdrawals (currently awaiting Admin settlement)
        const pendingWithdrawals = allTransactions
            .filter((t) => (t.status === "Pending" || t.status === "Processing") && t.type === "Withdrawal")
            .reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);

        // Also check Wallet collection in case wallet.availableBalance is explicitly maintained
        const wallet = await Wallet.findOne({
            ownerType: { $in: ["DELIVERY_PARTNER", "DELIVERY"] },
            ownerId: deliveryBoyId,
        }).lean();

        // Available balance ready to withdraw
        const calculatedAvailable = Math.max(0, settledEarnings - settledWithdrawals - pendingWithdrawals);
        const availableBalance = wallet && typeof wallet.availableBalance === 'number' && wallet.availableBalance > 0
            ? wallet.availableBalance
            : calculatedAvailable;
        const finalPendingWithdrawals = wallet && typeof wallet.pendingBalance === 'number' && wallet.pendingBalance > 0
            ? wallet.pendingBalance
            : pendingWithdrawals;

        // Withdrawal history list
        const history = allTransactions
            .filter((t) => t.type === "Withdrawal")
            .map((t) => ({
                id: t.reference || String(t._id),
                _id: t._id,
                amount: Math.abs(t.amount),
                status: t.status,
                createdAt: t.createdAt,
                date: t.createdAt,
                reference: t.reference || `WDR-DL-${String(t._id).slice(-6).toUpperCase()}`,
                notes: t.notes || "",
            }));

        return handleResponse(res, 200, "Withdrawals data fetched successfully", {
            availableBalance,
            settledEarnings,
            settledWithdrawals,
            pendingWithdrawals: finalPendingWithdrawals,
            history,
            transactions: history,
        });
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};

/* ===============================
   UPDATE LIVE LOCATION (Delivery)
================================ */
export const updateDeliveryLocation = async (req, res) => {
    try {
        const deliveryId = req.user.id;
        const { lat, lng, accuracy, heading, speed, orderId } = req.body || {};

        if (
            typeof lat !== "number" ||
            typeof lng !== "number" ||
            Number.isNaN(lat) ||
            Number.isNaN(lng)
        ) {
            return handleResponse(res, 400, "Valid numeric lat and lng are required");
        }

        const throttled = await throttleLocationUpdate(deliveryId, lat, lng, orderId);
        if (throttled) {
            return handleResponse(res, 200, "Location update throttled", {
                throttled: true,
            });
        }

        // Normalize to [lng, lat] as required by GeoJSON
        const coordinates = [Number(lng), Number(lat)];

        const delivery = await Delivery.findByIdAndUpdate(
            deliveryId,
            {
                $set: {
                    location: {
                        type: "Point",
                        coordinates,
                    },
                    lastLocationAt: new Date(),
                },
            },
            { new: true }
        ).select("_id location isOnline");

        if (!delivery) {
            return handleResponse(res, 404, "Delivery partner not found");
        }

        // SECURITY: when an orderId is supplied, the rider is telling us which
        // active delivery this ping belongs to. We MUST verify the assignment
        // synchronously before fanning out to Firebase — otherwise a rider can
        // pollute another order's live-tracking path (and the customer map
        // would render the wrong rider). The previous fire-and-forget check
        // ran *after* the Firebase write and never blocked anything.
        //
        // Rules:
        //   - orderId omitted          -> only the delivery-keyed RTDB entry is
        //                                 written (no per-order fanout). Trail
        //                                 is skipped. This preserves the
        //                                 "background heartbeat" code path.
        //   - orderId references a doc -> rider must equal order.deliveryBoy,
        //                                 otherwise 403/404 and no RTDB write.
        //   - canonical orderId        -> always read from Mongo, never from
        //                                 the request body, so the RTDB path
        //                                 cannot be spoofed via case-drift or
        //                                 alternate ids.
        let activeOrderId = null;
        if (orderId) {
            const orderMatch = orderMatchQueryFromRouteParam(orderId);
            if (!orderMatch) {
                return handleResponse(res, 400, "Invalid orderId");
            }

            const order = await Order.findOne(orderMatch)
                .select("orderId deliveryBoy")
                .lean();

            if (!order) {
                return handleResponse(res, 404, "Order not found");
            }

            const assignedRiderId = order.deliveryBoy
                ? String(order.deliveryBoy)
                : null;
            if (assignedRiderId !== String(deliveryId)) {
                return handleResponse(
                    res,
                    403,
                    "Order is not assigned to this delivery partner"
                );
            }

            activeOrderId = order.orderId;
        }

        const snapshot = {
            lat,
            lng,
            accuracy: typeof accuracy === "number" ? accuracy : undefined,
            heading: typeof heading === "number" ? heading : undefined,
            speed: typeof speed === "number" ? speed : undefined,
            lastUpdatedAt: new Date().toISOString(),
            deliveryId,
            orderId: activeOrderId,
        };

        // Fan out to Firebase and trail — fire-and-forget, never block the
        // response. Reaching this line guarantees activeOrderId (if set) is
        // the canonical id of an order this rider is actually assigned to.
        writeDeliveryLocation(deliveryId, activeOrderId, snapshot).catch(() => { });
        if (activeOrderId) {
            appendTrailPoint(activeOrderId, { lat, lng, t: Date.now() }).catch(() => { });
        }

        return handleResponse(res, 200, "Location updated", {
            location: delivery.location,
            activeOrderId,
        });
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};
/*
 * DEPRECATED + REMOVED: Delivery-completion OTP generation/validation moved
 * to the canonical workflow service:
 *   POST /orders/workflow/:orderId/otp/request  -> requestHandoffOtpAtomic
 *   POST /orders/workflow/:orderId/otp/verify   -> verifyHandoffOtpAndDeliver
 *
 * The previous generateDeliveryOtp / validateDeliveryOtp controllers
 * and their /delivery/orders/:orderId/(generate|validate)-otp routes
 * were removed once the workflow state machine became the single source
 * of truth for delivery completion. All behaviors (Delivery.location
 * fallback, proximity check, Firebase tracking cleanup on success,
 * structured OTP error codes, otpValidatedAt + otpValidationLocation
 * persistence, delivery:otp:validated socket fan-out) now live in
 * app/services/orderWorkflowService.js.
 */