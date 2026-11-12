/**
/**
 * UPI QR orders: auto-cancel when the payment is not verified in time.
 *
 *   - UTR submitted, admin has not verified within UPI_QR_APPROVAL_HOURS (48h)  -> cancelled, stock released
 *   - no UTR / rejected UTR and no (re)submission within UPI_QR_NO_UTR_HOURS (24h) -> cancelled, stock released
 *
 * NO refund is created or paid automatically: the payment was never verified, so we do not
 * know the UTR is real or that money arrived. If the customer really paid, they contact
 * support with their UTR and admin settles it manually after checking the bank statement.
 *
 * Safety rules:
 *   - The deadline lives on the order (`upiApprovalExpiresAt`). Orders created before this
 *     feature have none, so deploying never cancels an old pending order.
 *   - Cancelling is ONE conditional update on the expected payment state, so an admin who
 *     verifies the payment at the same moment either wins (order is paid and untouched) or
 *     loses (order is cancelled and approval is refused) - never both.
 *   - Stock cleanup runs after the claim and is idempotent; if it fails it is retried by the next sweep.
 */

import Order from "../../models/order.js";
import { WORKFLOW_STATUS } from "../../constants/orderWorkflow.js";
import { compensateOrderCancellation } from "../orderCompensation.js";
import { emitNotificationEvent } from "../../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../../modules/notifications/notification.constants.js";
import { getUpiApprovalPolicy } from "../../utils/upiApprovalPolicy.js";
import logger from "../logger.js";

const WAITING_STATES = ["AWAITING_VERIFICATION", "CREATED", "REJECTED"];

function notify(event, payload) {
  try {
    emitNotificationEvent(event, payload);
  } catch (error) {
    logger.warn("UPI expiry notification failed", { event, error: error.message });
  }
}

async function cleanUpCancelledOrder(order, reason) {
  await compensateOrderCancellation(order, order.orderId, { reason });
}

/** Cancel ONE order whose deadline has passed. Returns what happened. */
export async function expireUpiOrder(orderId, { now = new Date() } = {}) {
  const policy = getUpiApprovalPolicy();

  const current = await Order.findOne({ _id: orderId });
  if (!current) return { status: "skipped" };

  const hadUtr = current.paymentStatus === "AWAITING_VERIFICATION" && Boolean(current.utrNumber);
  const reason = hadUtr
    ? `UPI payment was not verified within ${policy.approvalHours} hours`
    : current.paymentStatus === "REJECTED"
      ? `UPI payment was rejected and no corrected UTR was sent within ${policy.noUtrHours} hours`
      : `UPI payment was not completed within ${policy.noUtrHours} hours`;

  const claim = await Order.findOneAndUpdate(
    {
      _id: current._id,
      paymentMode: "UPI_QR",
      paymentStatus: { $in: WAITING_STATES },
      status: { $ne: "cancelled" },
      upiApprovalExpiresAt: { $lte: now },
    },
    {
      $set: {
        workflowStatus: WORKFLOW_STATUS.CANCELLED,
        status: "cancelled",
        orderStatus: "cancelled",
        cancelledBy: "system",
        cancelReason: reason,
        paymentStatus: "FAILED",
        "payment.status": "failed",
        paymentRejectedReason: reason,
        upiApprovalExpiresAt: null,
        upiExpiryCancelledAt: now,
      },
    },
    { new: true },
  );
  // Lost the race: admin verified / customer re-submitted at the same moment. Nothing to do.
  if (!claim) return { status: "skipped" };

  let cleanupOk = true;
  try {
    await cleanUpCancelledOrder(claim, reason);
  } catch (error) {
    cleanupOk = false;
    logger.error("UPI expiry: stock/finance cleanup failed (will retry)", {
      scope: "UpiApprovalExpiry",
      orderId: claim.orderId,
      error: error.message,
    });
  }

  const customerMessage = hadUtr
    ? `Your order #${claim.orderId} was cancelled because your UPI payment could not be verified in ${policy.approvalHours} hours. If you have already paid, please contact support with your UTR (${claim.utrNumber}).`
    : `Your order #${claim.orderId} was cancelled because the payment was not completed in time.`;

  // The seller was never told about an order that was never paid, so only the customer hears about the cancellation.
  notify(NOTIFICATION_EVENTS.ORDER_CANCELLED, {
    orderId: claim.orderId,
    customerId: claim.customer,
    userId: claim.customer,
    customerMessage,
  });

  return { status: "expired", hadUtr, cleanupOk };
}

/** Sweep: cancel every UPI order past its deadline, then retry any half-finished cleanup. */
export async function expireUnverifiedUpiOrders({ now = new Date(), limit = 100 } = {}) {
  const summary = { checked: 0, expired: 0, skipped: 0, failed: 0, retried: 0 };

  const due = await Order.find({
    paymentMode: "UPI_QR",
    paymentStatus: { $in: WAITING_STATES },
    status: { $ne: "cancelled" },
    upiApprovalExpiresAt: { $lte: now },
  })
    .select("_id orderId")
    .limit(limit)
    .lean();
  summary.checked = due.length;

  for (const row of due) {
    try {
      const out = await expireUpiOrder(row._id, { now });
      if (out.status === "expired") {
        summary.expired += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.failed += 1;
      logger.error("UPI approval expiry failed for order", {
        scope: "UpiApprovalExpiry",
        orderId: row.orderId,
        error: error.message,
      });
    }
  }

  // Cancelled by us earlier but stock/finance cleanup did not finish.
  const half = await Order.find({
    paymentMode: "UPI_QR",
    status: "cancelled",
    cancelledBy: "system",
    upiExpiryCancelledAt: { $lte: now },
    "stockReservation.status": { $ne: "RELEASED" },
  })
    .limit(limit);
  for (const order of half) {
    try {
      await cleanUpCancelledOrder(order, order.cancelReason || "UPI payment expired");
      summary.retried += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error("UPI expiry cleanup retry failed", {
        scope: "UpiApprovalExpiry",
        orderId: order.orderId,
        error: error.message,
      });
    }
  }

  return summary;
}

export default { expireUpiOrder, expireUnverifiedUpiOrders };
