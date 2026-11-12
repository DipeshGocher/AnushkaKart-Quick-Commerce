/**
 * ReturnQcService — the quality-check (QC) step of a return, end to end.
 *
 *   returned ─► QC passed ─► refund customer (wallet) ─► refund_completed
 *            └► QC failed ─► (customer may dispute for N hours)
 *                              ├─ no dispute  ─► seller payout released after the window
 *                              └─ dispute ─► admin decides
 *                                     ├─ customer right ─► treated as QC passed (refund, seller debited)
 *                                     └─ seller right   ─► payout released
 *   returned for too long ─► reminders ─► admin escalation ─► auto QC-pass (customer is refunded)
 *
 * Rules that keep this safe:
 *   - Every state change is a conditional update (findOneAndUpdate with the expected
 *     returnStatus), so a seller click, an admin click and the auto-pass job can never
 *     both win. The loser gets a 409 and nothing is changed.
 *   - ALL validation happens BEFORE any write.
 *   - If the refund transaction fails after QC passed, the order stays `qc_passed`
 *     (refund pending). It can be retried from the UI and is retried by a job.
 *   - Notifications are fire-and-forget and never break the flow.
 */

import Order from "../../models/order.js";
import Payout from "../../models/payout.js";
import Admin from "../../models/admin.js";
import { orderMatchQueryFromRouteParam } from "../../utils/orderLookup.js";
import { emitNotificationEvent } from "../../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../../modules/notifications/notification.constants.js";
import { processPayout } from "../finance/payoutService.js";
import OrderReturnService from "./orderReturnService.js";
import {
  getQcPolicy,
  getQcDeadlines,
  getQcTargetStage,
  shouldAutoPass,
  getDisputeWindowEndsAt,
  isDisputeOpenable,
  QC_NOTE_MIN_LENGTH,
  DISPUTE_REASON_MIN_LENGTH,
  MAX_EVIDENCE_IMAGES,
} from "../../utils/returnQcPolicy.js";
import logger from "../logger.js";

const HOUR_MS = 60 * 60 * 1000;
const MAX_REFUND_ATTEMPTS = 8;
const MAX_PAYOUT_ATTEMPTS = 5;
// A `qc_passed` order younger than this may still have its refund running right now.
const REFUND_RETRY_AFTER_MS = 5 * 60 * 1000;

function err(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const idOf = (value) => String(value?._id || value || "");

function cleanImages(images) {
  if (images === undefined || images === null) return [];
  if (!Array.isArray(images)) throw err("images must be a list of image URLs.", 400);
  const cleaned = images.map((u) => String(u || "").trim()).filter(Boolean);
  if (cleaned.length > MAX_EVIDENCE_IMAGES) {
    throw err(`You can attach at most ${MAX_EVIDENCE_IMAGES} images.`, 400);
  }
  if (cleaned.some((u) => !/^https?:\/\//i.test(u))) {
    throw err("Each image must be a valid uploaded image URL.", 400);
  }
  return cleaned;
}

async function getAdminIds() {
  try {
    const admins = await Admin.find().select("_id").lean();
    return (admins || []).map((a) => a?._id).filter(Boolean);
  } catch {
    return [];
  }
}

function notify(event, payload) {
  try {
    emitNotificationEvent(event, payload);
  } catch (error) {
    logger.warn("Return QC notification failed", { event, error: error.message });
  }
}

function basePayload(order, extra = {}) {
  return {
    orderId: order.orderId,
    customerId: order.customer,
    userId: order.customer,
    sellerId: order.seller,
    ...extra,
  };
}

async function loadOrder(orderId) {
  const key = orderMatchQueryFromRouteParam(orderId);
  if (!key) throw err("Order not found", 404);
  const order = await Order.findOne(key);
  if (!order) throw err("Order not found", 404);
  return order;
}

/**
 * Runs the refund. On failure the order is left as `qc_passed` and the error is recorded
 * so the retry job / admin can pick it up.
 */
async function runRefund(order, completeRefund) {
  const refund = completeRefund || ((o) => OrderReturnService.completeReturnAndRefund(o));
  try {
    const result = await refund(order);
    if (result && result.returnStatus && result.returnStatus !== "refund_completed") {
      throw new Error(`Refund did not complete (status: ${result.returnStatus})`);
    }
    return result || order;
  } catch (error) {
    await Order.updateOne(
      { _id: order._id },
      {
        $inc: { returnRefundAttempts: 1 },
        $set: { returnRefundLastError: String(error.message || error).slice(0, 300) },
      },
    ).catch(() => {});
    logger.error("Return refund failed after QC passed", {
      scope: "ReturnQC",
      orderId: order.orderId,
      error: error.message,
    });
    throw err(
      `QC was saved, but the refund could not be completed yet (${error.message}). It will be retried automatically.`,
      500,
    );
  }
}

/**
 * Seller payout for a failed-QC order. Only runs once the dispute window is closed
 * (or an admin ruled for the seller). Safe to call repeatedly.
 */
export async function releaseSellerPayoutAfterQcFail(orderDocOrId) {
  const id = orderDocOrId?._id || orderDocOrId;
  const order = await Order.findOne({
    _id: id,
    returnStatus: "qc_failed",
    "settlementStatus.sellerPayout": "HOLD",
    returnQcPayoutReleasedAt: null,
  });
  if (!order) return false;
  if (order.returnDispute?.status === "open") return false;

  const autoRelease =
    String(process.env.AUTO_RELEASE_SELLER_PAYOUT || "true").toLowerCase() === "true";

  try {
    if (autoRelease) {
      const payout = await Payout.findOne({
        payoutType: "SELLER",
        relatedOrderIds: order._id,
        status: { $in: ["PENDING", "PROCESSING"] },
      })
        .select("_id")
        .lean();
      if (payout?._id) await processPayout(payout._id);
    } else {
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            "settlementStatus.sellerPayout": "PENDING",
            "financeFlags.sellerPayoutHeld": false,
          },
        },
      );
    }
    await Order.updateOne({ _id: order._id }, { $set: { returnQcPayoutReleasedAt: new Date() } });
    return true;
  } catch (error) {
    await Order.updateOne({ _id: order._id }, { $inc: { returnQcPayoutAttempts: 1 } }).catch(() => {});
    logger.warn("Seller payout release after QC fail failed", {
      scope: "ReturnQC",
      orderId: order.orderId,
      error: error.message,
    });
    return false;
  }
}

/**
 * Record a QC decision.
 *
 * @param {object} p
 * @param {string} p.orderId       route param (orderId or _id)
 * @param {{id?:string, role:"seller"|"admin"|"system"}} p.actor
 * @param {"qc_passed"|"qc_failed"|"passed"|"failed"} p.qcStatus
 * @param {string} [p.note]
 * @param {string[]} [p.evidenceImages]  required (>=1) for a failed QC
 * @param {Function} [p.completeRefund]  injected refund executor
 * @param {Date} [p.now]
 */
export async function completeQc({
  orderId,
  actor,
  qcStatus,
  note,
  evidenceImages,
  completeRefund,
  now = new Date(),
}) {
  const decision = String(qcStatus || "").replace(/^qc_/, "");
  if (decision !== "passed" && decision !== "failed") {
    throw err("Invalid qcStatus value.", 400);
  }
  const role = actor?.role;
  if (!["seller", "admin", "system"].includes(role)) {
    throw err("Access denied. Only admin or the assigned seller can perform QC.", 403);
  }

  const order = await loadOrder(orderId);

  if (role === "seller" && idOf(order.seller) !== String(actor.id)) {
    throw err("Access denied. Only admin or the assigned seller can perform QC.", 403);
  }

  // ── A passed QC whose refund is still pending: retry the refund. Only when a previous
  //    attempt failed (or it is old enough) — a brand-new qc_passed may have its refund
  //    running right now, and we must not start a second one next to it.
  if (decision === "passed" && order.returnStatus === "qc_passed") {
    const qcAt = order.returnQcAt ? new Date(order.returnQcAt).getTime() : 0;
    const stale = now.getTime() - qcAt > REFUND_RETRY_AFTER_MS;
    if (!(Number(order.returnRefundAttempts || 0) > 0 || stale)) {
      throw err("The refund for this return is already being processed.", 409);
    }
    return { order: await runRefund(order, completeRefund), retried: true };
  }

  if (order.returnStatus !== "returned") {
    throw err("QC can only be completed after the item is returned.", 400);
  }

  const trimmedNote = String(note || "").trim().slice(0, 500);

  // ── Validate everything BEFORE touching the order.
  let evidence = [];
  if (decision === "failed") {
    if (role === "system") throw err("The system can only auto-pass a QC.", 400);
    if (trimmedNote.length < QC_NOTE_MIN_LENGTH) {
      throw err(
        `Please explain why QC failed (at least ${QC_NOTE_MIN_LENGTH} characters). The customer will see this.`,
        400,
      );
    }
    evidence = cleanImages(evidenceImages);
    if (evidence.length === 0) {
      throw err("Please attach at least 1 photo as proof for the failed QC.", 400);
    }
  }

  const isPass = decision === "passed";
  const set = {
    returnStatus: isPass ? "qc_passed" : "qc_failed",
    returnQcStatus: isPass ? "passed" : "failed",
    returnQcAt: now,
    returnQcByRole: role,
    returnQcAutoPassed: role === "system",
  };
  if (role !== "system") set.returnQcBy = actor.id;
  if (trimmedNote) set.returnQcNote = trimmedNote;
  if (!isPass) {
    set.returnQcEvidenceImages = evidence;
    set["returnDispute.status"] = "none";
  }
  const claim = await Order.findOneAndUpdate(
    { _id: order._id, returnStatus: "returned" },
    { $set: set },
    { new: true },
  );
  if (!claim) {
    throw err("This return was already processed by someone else.", 409);
  }

  if (isPass) {
    const refunded = await runRefund(claim, completeRefund);
    if (role === "system") {
      notify(
        NOTIFICATION_EVENTS.RETURN_QC_AUTO_PASSED,
        basePayload(claim, { data: { refundAmount: claim.returnRefundAmount || 0 } }),
      );
    }
    return { order: refunded, retried: false };
  }

  const windowEndsAt = getDisputeWindowEndsAt(claim);
  notify(
    NOTIFICATION_EVENTS.RETURN_QC_FAILED,
    basePayload(claim, {
      data: {
        note: trimmedNote,
        disputeWindowHours: getQcPolicy().disputeWindowHours,
        disputeDeadline: windowEndsAt?.toISOString(),
      },
    }),
  );
  return { order: claim, retried: false };
}

/** Customer disagrees with a failed QC. */
export async function raiseDispute({ customerId, orderId, reason, images, now = new Date() }) {
  const trimmedReason = String(reason || "").trim().slice(0, 500);
  if (trimmedReason.length < DISPUTE_REASON_MIN_LENGTH) {
    throw err(`Please tell us why you disagree (at least ${DISPUTE_REASON_MIN_LENGTH} characters).`, 400);
  }
  const evidence = cleanImages(images);

  const order = await loadOrder(orderId);
  if (idOf(order.customer) !== String(customerId)) throw err("Order not found", 404);
  if (order.returnStatus !== "qc_failed") {
    throw err("A dispute can only be raised after a failed quality check.", 400);
  }
  if (order.returnDispute?.status && order.returnDispute.status !== "none") {
    throw err("A dispute has already been raised for this return.", 409);
  }
  if (!isDisputeOpenable(order, now)) {
    throw err("The dispute window for this return has closed.", 400);
  }

  const cutoff = new Date(now.getTime() - getQcPolicy().disputeWindowHours * HOUR_MS);
  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      returnStatus: "qc_failed",
      returnQcAt: { $gte: cutoff },
      "returnDispute.status": { $in: [null, "none"] },
    },
    {
      $set: {
        "returnDispute.status": "open",
        "returnDispute.raisedAt": now,
        "returnDispute.reason": trimmedReason,
        "returnDispute.images": evidence,
      },
    },
    { new: true },
  );
  if (!updated) throw err("A dispute has already been raised or the window has closed.", 409);

  const adminIds = await getAdminIds();
  notify(
    NOTIFICATION_EVENTS.RETURN_DISPUTE_RAISED,
    basePayload(updated, { adminIds, data: { reason: trimmedReason } }),
  );
  return updated;
}

/** Admin rules on an open dispute. */
export async function resolveDispute({
  adminId,
  orderId,
  decision,
  note,
  completeRefund,
  now = new Date(),
}) {
  if (decision !== "customer" && decision !== "seller") {
    throw err('decision must be "customer" or "seller".', 400);
  }
  const trimmedNote = String(note || "").trim().slice(0, 500);
  if (trimmedNote.length < 5) throw err("Please add a short note explaining your decision.", 400);

  const order = await loadOrder(orderId);
  if (order.returnStatus !== "qc_failed" || order.returnDispute?.status !== "open") {
    throw err("There is no open dispute for this return.", 400);
  }

  const resolution = {
    "returnDispute.resolvedAt": now,
    "returnDispute.resolvedBy": adminId,
    "returnDispute.resolutionNote": trimmedNote,
  };

  if (decision === "customer") {
    const claim = await Order.findOneAndUpdate(
      { _id: order._id, returnStatus: "qc_failed", "returnDispute.status": "open" },
      {
        $set: {
          ...resolution,
          "returnDispute.status": "overturned",
          returnStatus: "qc_passed",
          returnQcStatus: "passed",
        },
      },
      { new: true },
    );
    if (!claim) throw err("This dispute was already resolved.", 409);
    notify(
      NOTIFICATION_EVENTS.RETURN_DISPUTE_RESOLVED,
      basePayload(claim, { data: { decision, note: trimmedNote } }),
    );
    // Same money path as a normal QC pass: customer credited, seller payout cancelled / debited.
    const refunded = await runRefund(claim, completeRefund);
    return { order: refunded, decision };
  }

  const claim = await Order.findOneAndUpdate(
    { _id: order._id, returnStatus: "qc_failed", "returnDispute.status": "open" },
    { $set: { ...resolution, "returnDispute.status": "upheld" } },
    { new: true },
  );
  if (!claim) throw err("This dispute was already resolved.", 409);
  await releaseSellerPayoutAfterQcFail(claim);
  notify(
    NOTIFICATION_EVENTS.RETURN_DISPUTE_RESOLVED,
    basePayload(claim, { data: { decision, note: trimmedNote } }),
  );
  return { order: claim, decision };
}

/* ─────────────────────────── Scheduled work ─────────────────────────── */

/**
 * Reminders → admin escalation → auto-pass, for orders sitting at `returned`.
 */
export async function sweepReturnQcDeadlines({ completeRefund, now = new Date(), limit = 200 } = {}) {
  const rows = await Order.find({ returnStatus: "returned" })
    .select(
      "_id orderId seller customer returnDeliveredBackAt returnDropVerifiedAt updatedAt returnQcReminderStage returnRefundAmount",
    )
    .limit(limit)
    .lean();

  const summary = { checked: rows.length, reminded: 0, escalated: 0, autoPassed: 0, failed: 0 };

  for (const row of rows) {
    try {
      if (shouldAutoPass(row, now)) {
        await completeQc({
          orderId: String(row._id),
          actor: { role: "system" },
          qcStatus: "passed",
          note: `Auto-approved: QC was not completed within ${getQcPolicy().autoPassHours} hours of the item reaching the seller.`,
          completeRefund,
          now,
        });
        summary.autoPassed += 1;
        continue;
      }

      const target = getQcTargetStage(row, now);
      const current = Number(row.returnQcReminderStage || 0);
      if (target <= current) continue;

      const bumped = await Order.updateOne(
        { _id: row._id, returnStatus: "returned", returnQcReminderStage: { $lt: target } },
        { $set: { returnQcReminderStage: target } },
      );
      if (!bumped.modifiedCount) continue;

      const { dueAt, autoPassAt } = getQcDeadlines(row, now);
      const hoursToDue = Math.max(0, Math.round((dueAt.getTime() - now.getTime()) / HOUR_MS));
      const hoursToAutoPass = Math.max(0, Math.round((autoPassAt.getTime() - now.getTime()) / HOUR_MS));

      if (target === 3) {
        notify(
          NOTIFICATION_EVENTS.RETURN_QC_ESCALATED,
          basePayload(row, { adminIds: await getAdminIds(), data: { hoursToAutoPass } }),
        );
        summary.escalated += 1;
      } else {
        notify(
          NOTIFICATION_EVENTS.RETURN_QC_REMINDER,
          basePayload(row, { data: { hoursToDue, hoursToAutoPass } }),
        );
        summary.reminded += 1;
      }
    } catch (error) {
      // Includes 409 when a seller/admin finished the QC while we were looping — expected.
      if (error.statusCode !== 409) {
        summary.failed += 1;
        logger.error("Return QC deadline sweep failed for order", {
          scope: "ReturnQC",
          orderId: row.orderId,
          error: error.message,
        });
      }
    }
  }
  return summary;
}

/** Release seller payouts once the customer's dispute window has closed without a dispute. */
export async function releaseExpiredDisputeWindows({ now = new Date(), limit = 100 } = {}) {
  const cutoff = new Date(now.getTime() - getQcPolicy().disputeWindowHours * HOUR_MS);
  const rows = await Order.find({
    returnStatus: "qc_failed",
    returnQcAt: { $lte: cutoff },
    "returnDispute.status": { $ne: "open" },
    "settlementStatus.sellerPayout": "HOLD",
    returnQcPayoutReleasedAt: null,
    $or: [{ returnQcPayoutAttempts: { $lt: MAX_PAYOUT_ATTEMPTS } }, { returnQcPayoutAttempts: null }],
  })
    .select("_id")
    .limit(limit)
    .lean();

  let released = 0;
  for (const row of rows) {
    if (await releaseSellerPayoutAfterQcFail(row._id)) released += 1;
  }
  return { checked: rows.length, released };
}

/** Retry customer refunds that failed after a QC pass. */
export async function retryPendingRefunds({ completeRefund, now = new Date(), limit = 50 } = {}) {
  const olderThan = new Date(now.getTime() - REFUND_RETRY_AFTER_MS);
  const rows = await Order.find({
    returnStatus: "qc_passed",
    returnQcAt: { $lte: olderThan },
    // Orders created before this field existed have no value, and Mongo's $lt never matches a missing field.
    $or: [{ returnRefundAttempts: { $lt: MAX_REFUND_ATTEMPTS } }, { returnRefundAttempts: null }],
  }).limit(limit);

  const summary = { checked: rows.length, refunded: 0, failed: 0 };
  for (const order of rows) {
    try {
      await runRefund(order, completeRefund);
      summary.refunded += 1;
    } catch {
      summary.failed += 1;
      if (Number(order.returnRefundAttempts || 0) + 1 >= MAX_REFUND_ATTEMPTS) {
        notify(
          NOTIFICATION_EVENTS.RETURN_REFUND_FAILED,
          basePayload(order, { adminIds: await getAdminIds() }),
        );
      }
    }
  }
  return summary;
}

export default {
  completeQc,
  raiseDispute,
  resolveDispute,
  releaseSellerPayoutAfterQcFail,
  sweepReturnQcDeadlines,
  releaseExpiredDisputeWindows,
  retryPendingRefunds,
};
