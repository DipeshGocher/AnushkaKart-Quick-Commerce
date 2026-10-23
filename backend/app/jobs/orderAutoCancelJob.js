import dotenv from "dotenv";
import Order from "../models/order.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import {
  processSellerTimeoutJob,
  processDeliveryTimeoutJob,
  processReturnPickupTimeoutJob,
} from "../services/orderWorkflowService.js";
import { compensateOrderCancellation } from "../services/orderCompensation.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import logger from "../services/logger.js";

dotenv.config();

const DEFAULT_INTERVAL_MS = 10000;
const AUTO_CANCEL_INTERVAL_MS = parseInt(
  process.env.AUTO_CANCEL_INTERVAL_MS || `${DEFAULT_INTERVAL_MS}`,
  10,
);

/**
 * Fallback when Bull/Redis is unavailable: reconciles expired seller-pending orders (v2)
 * by delegating to the same handler as the queue worker.
 * Legacy v1 orders use status + expiresAt only.
 */
const autoCancelExpiredOrders = async () => {
  const startTime = Date.now();
  
  try {
    const now = new Date();

    const v2Expired = await Order.find({
      workflowVersion: { $gte: 2 },
      workflowStatus: WORKFLOW_STATUS.SELLER_PENDING,
      sellerPendingExpiresAt: { $lte: now },
    })
      .select("orderId")
      .lean();

    for (const row of v2Expired) {
      try {
        await processSellerTimeoutJob({ orderId: row.orderId });
      } catch (err) {
        logger.error('v2 seller timeout failed', {
          jobName: 'orderAutoCancelJob',
          orderId: row.orderId,
          error: err.message
        });
      }
    }

    const v2DeliveryExpired = await Order.find({
      workflowVersion: { $gte: 2 },
      workflowStatus: WORKFLOW_STATUS.DELIVERY_SEARCH,
      deliverySearchExpiresAt: { $lte: now },
    })
      .select("orderId deliverySearchMeta")
      .lean();

    for (const row of v2DeliveryExpired) {
      try {
        const attempt = row.deliverySearchMeta?.attempt || 1;
        await processDeliveryTimeoutJob({ orderId: row.orderId, attempt });
      } catch (err) {
        logger.error('v2 delivery timeout failed', {
          jobName: 'orderAutoCancelJob',
          orderId: row.orderId,
          error: err.message
        });
      }
    }

    // Return-pickup broadcast loop — safety net for when Bull/Redis is down
    // or a worker missed a job. Same semantics as the delivery-search
    // fallback above.
    const returnPickupExpired = await Order.find({
      returnStatus: "return_pickup_assigned",
      returnDeliveryBoy: null,
      returnSearchExpiresAt: { $lte: now },
    })
      .select("orderId returnSearchMeta")
      .lean();

    for (const row of returnPickupExpired) {
      try {
        const attempt = row.returnSearchMeta?.attempt || 1;
        await processReturnPickupTimeoutJob({ orderId: row.orderId, attempt });
      } catch (err) {
        logger.error('return-pickup timeout failed', {
          jobName: 'orderAutoCancelJob',
          orderId: row.orderId,
          error: err.message,
        });
      }
    }

    const paymentExpiredOrders = await Order.find({
      $and: [
        {
          $or: [
            { workflowStatus: WORKFLOW_STATUS.CREATED },
            { workflowStatus: "CREATED" },
            { workflowStatus: "created" },
            { status: "pending" },
          ],
        },
        {
          $or: [
            { paymentMode: { $in: ["ONLINE", "online"] } },
            { "payment.method": "online" },
          ],
        },
        {
          paymentStatus: { $nin: ["PAID", "completed", "CAPTURED"] },
          "payment.status": { $nin: ["completed", "refunded"] },
        },
        {
          status: { $ne: "cancelled" },
        },
        {
          $or: [
            { "stockReservation.status": { $ne: "RELEASED" } },
            { "stockReservation.status": { $exists: false } },
            { stockReservation: null },
          ],
        },
        {
          $or: [
            { "stockReservation.expiresAt": { $lte: now } },
            { expiresAt: { $lte: now } },
          ],
        },
      ],
    })
      .select("_id orderId")
      .lean();

    for (const row of paymentExpiredOrders) {
      try {
        const updated = await Order.findOneAndUpdate(
          {
            _id: row._id,
            paymentStatus: { $nin: ["PAID", "completed", "CAPTURED"] },
            status: { $ne: "cancelled" },
          },
          {
            $set: {
              workflowStatus: WORKFLOW_STATUS.CANCELLED,
              status: "cancelled",
              orderStatus: "cancelled",
              cancelledBy: "system",
              cancelReason: "Payment timeout (15 mins expired)",
            },
          },
          { new: true },
        );
        if (updated) {
          await compensateOrderCancellation(updated, updated.orderId);
          emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_CANCELLED, {
            orderId: updated.orderId,
            customerId: updated.customer,
            userId: updated.customer,
            sellerId: updated.seller,
            customerMessage: "Order cancelled due to payment timeout.",
            sellerMessage: `Order #${updated.orderId} cancelled due to payment timeout.`,
          });
        }
      } catch (err) {
        logger.error('payment timeout cancellation failed', {
          jobName: 'orderAutoCancelJob',
          orderId: row.orderId,
          error: err.message
        });
      }
    }

    const legacyExpired = await Order.find({
      $or: [
        { workflowVersion: { $exists: false } },
        { workflowVersion: { $lt: 2 } },
      ],
      status: "pending",
      expiresAt: { $lte: now },
    });

    for (const order of legacyExpired) {
      order.status = "cancelled";
      order.cancelledBy = "system";
      order.cancelReason = "Seller timeout";
      await order.save();

      try {
        await compensateOrderCancellation(order, order.orderId);
      } catch (e) {
        logger.error('legacy compensation failed', {
          jobName: 'orderAutoCancelJob',
          orderId: order.orderId,
          error: e.message
        });
      }

      emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_CANCELLED, {
        orderId: order.orderId,
        customerId: order.customer,
        userId: order.customer,
        sellerId: order.seller,
        customerMessage:
          "Your order was cancelled because it was not accepted in time.",
        sellerMessage:
          `Order #${order.orderId} was cancelled because it was not accepted in time.`,
      });
    }

    // Stale orders cleanup:
    // 1. Local delivery orders unfulfilled (>24 hours) or stuck out_for_delivery (>12 hours)
    // 2. Shiprocket / General unfulfilled orders (>48 hours)
    const nowMs = Date.now();
    const localCutoff24h = new Date(nowMs - 24 * 60 * 60 * 1000);
    const localOutForDeliveryCutoff12h = new Date(nowMs - 12 * 60 * 60 * 1000);
    const generalCutoff48h = new Date(nowMs - 48 * 60 * 60 * 1000);

    const staleOrders = await Order.find({
      status: { $nin: ["delivered", "cancelled"] },
      workflowStatus: { $nin: [WORKFLOW_STATUS.DELIVERED, WORKFLOW_STATUS.CANCELLED] },
      $or: [
        // Local orders: unfulfilled > 24 hours
        {
          fulfillmentType: { $ne: "SHIPROCKET" },
          $expr: { $lte: [{ $toDate: "$createdAt" }, localCutoff24h] },
        },
        // Local orders: out for delivery > 12 hours
        {
          fulfillmentType: { $ne: "SHIPROCKET" },
          status: "out_for_delivery",
          $expr: {
            $lte: [
              { $toDate: { $ifNull: ["$outForDeliveryAt", "$updatedAt"] } },
              localOutForDeliveryCutoff12h,
            ],
          },
        },
        // Shiprocket & general orders: unfulfilled > 48 hours
        {
          $expr: { $lte: [{ $toDate: "$createdAt" }, generalCutoff48h] },
        },
      ],
    });

    for (const order of staleOrders) {
      try {
        const isLocal = order.fulfillmentType !== "SHIPROCKET";
        let reason = "Order delivery expired (>48 hours undelivered)";
        if (isLocal) {
          if (order.status === "out_for_delivery") {
            reason = "Local delivery attempt expired (>12h out for delivery without completion)";
          } else {
            reason = "Local delivery unfulfilled / unassigned (>24h)";
          }
        } else {
          reason = "Shiprocket order delivery window expired (>48h)";
        }

        order.status = "cancelled";
        order.workflowStatus = WORKFLOW_STATUS.CANCELLED;
        order.cancelledBy = "system";
        order.cancelReason = reason;
        await order.save();

        await compensateOrderCancellation(order, order.orderId, {
          reason,
        });

        emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_CANCELLED, {
          orderId: order.orderId,
          customerId: order.customer,
          userId: order.customer,
          sellerId: order.seller,
          customerMessage: "Order cancelled as delivery window expired.",
          sellerMessage: `Order #${order.orderId} cancelled: ${reason}.`,
        });
      } catch (err) {
        logger.error('stale order auto-cancel failed', {
          jobName: 'orderAutoCancelJob',
          orderId: order.orderId,
          error: err.message,
        });
      }
    }

    const n =
      v2Expired.length +
      v2DeliveryExpired.length +
      returnPickupExpired.length +
      paymentExpiredOrders.length +
      legacyExpired.length +
      staleOrders.length;

    const duration = Date.now() - startTime;

    if (n > 0) {
      logger.info('Order auto-cancel job completed', {
        jobName: 'orderAutoCancelJob',
        duration,
        v2SellerExpired: v2Expired.length,
        v2DeliveryExpired: v2DeliveryExpired.length,
        returnPickupExpired: returnPickupExpired.length,
        paymentExpired: paymentExpiredOrders.length,
        legacyExpired: legacyExpired.length,
        total: n
      });
    }
  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error('Order auto-cancel job failed', {
      jobName: 'orderAutoCancelJob',
      duration,
      error: err.message,
      stack: err.stack
    });
  }
};

/**
 * Start order auto-cancel job using distributed scheduler
 * This function is called by the scheduler process role
 */
export const startOrderAutoCancelJob = () => {
  // This function is now a no-op - the distributed scheduler handles registration
  // Kept for backward compatibility
  logger.warn('startOrderAutoCancelJob called directly - use distributed scheduler instead');
};

/**
 * Get the job handler function for distributed scheduler registration
 * @returns {Function}
 */
export const getOrderAutoCancelJobHandler = () => autoCancelExpiredOrders;

/**
 * Get the job interval in milliseconds
 * @returns {number}
 */
export const getOrderAutoCancelJobInterval = () => AUTO_CANCEL_INTERVAL_MS;

export default startOrderAutoCancelJob;
