/**
 * Courier "Packed" automation.
 *
 * When a seller marks a courier (Shiprocket) order Packed, one call does everything that does
 * not need a human: book the shipment, assign the AWB, request the pickup and fetch the label.
 * The seller then only prints the label, sticks it on the parcel and hands it over.
 *
 * Failure policy:
 *  - Booking the shipment itself fails  -> throws (nothing was created, the caller keeps the order as it was).
 *  - A LATER step fails (AWB / pickup / label) -> never throws. The first failed step is stored on
 *    `order.shiprocket.automation` and this same function is simply run again (Retry button or the
 *    retry job) - every step is idempotent and resumes where it stopped.
 *
 * Local (rider) orders never reach this code: it refuses anything that is not a courier order.
 */

import mongoose from "mongoose";
import Order from "../../models/order.js";
import {
  processShiprocketOrder,
  assignShiprocketAwb,
  requestShiprocketPickup,
  getShiprocketLabel,
} from "./shiprocketService.js";
import { isPickupScheduledStatus, isInTransitStatus } from "./shipmentStatus.js";

const LOCK_MS = 90 * 1000;
export const MAX_AUTO_ATTEMPTS = 6;

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function resolveOrder(orderParam) {
  if (orderParam && typeof orderParam === "object") return orderParam;
  const key = String(orderParam || "");
  let order = await Order.findOne({ orderId: key });
  if (!order && mongoose.Types.ObjectId.isValid(key)) order = await Order.findById(key);
  if (!order) throw httpError("Order not found", 404);
  return order;
}

/** Takes the per-order lock; false when another request/job is already working on this order. */
async function acquireLock(orderId) {
  const now = new Date();
  const res = await Order.updateOne(
    {
      _id: orderId,
      $or: [
        { shiprocketFulfillLockUntil: null },
        { shiprocketFulfillLockUntil: { $exists: false } },
        { shiprocketFulfillLockUntil: { $lt: now } },
      ],
    },
    { $set: { shiprocketFulfillLockUntil: new Date(now.getTime() + LOCK_MS) } },
  );
  return (res.modifiedCount ?? res.nModified ?? 0) > 0;
}

function releaseLock(orderId) {
  return Order.updateOne({ _id: orderId }, { $set: { shiprocketFulfillLockUntil: null } }).catch(() => {});
}

const reason = (e) => String(e?.message || e || "Unknown error").slice(0, 300);

function isPickupDone(sr) {
  return Boolean(sr?.pickupScheduledAt) || isPickupScheduledStatus(String(sr?.currentStatus || "").toUpperCase());
}

/** Shipment already handed to / moving with the courier: nothing left to automate. */
function isPastPickup(order) {
  const s = String(order.shiprocket?.currentStatus || "").toUpperCase();
  return (
    isInTransitStatus(s) ||
    ["OUT_FOR_DELIVERY", "DELIVERED"].includes(s) ||
    s.startsWith("RTO") ||
    Boolean(order.shiprocket?.shippedAt)
  );
}

/**
 * Runs (or resumes) shipment -> AWB -> pickup -> label for one courier order.
 * @param {object|string} orderParam Order document, orderId or _id
 * @param {{ attempts?: number, retryDelayMs?: number }} [options] AWB retry settings
 * @returns {Promise<{ state: string, complete: boolean, inProgress?: boolean, steps: object, errors: object, shipment: object }>}
 */
export async function autoFulfillShiprocketOrder(orderParam, options = {}) {
  const order = await resolveOrder(orderParam);

  if (order.fulfillmentType !== "SHIPROCKET") {
    throw httpError("This order is assigned to local delivery, not Shiprocket", 400);
  }
  if (order.status === "cancelled" || order.status === "delivered") {
    throw httpError(`Order is already ${String(order.status).toUpperCase()}; no courier action is possible.`, 409);
  }

  if (!(await acquireLock(order._id))) {
    return {
      state: order.shiprocket?.automation?.state || null,
      complete: false,
      inProgress: true,
      steps: {},
      errors: {},
      shipment: order.shiprocket,
    };
  }

  try {
    // The lock was free, so any earlier run has finished: make sure we work on what it saved.
    const fresh = await Order.findById(order._id).select("shiprocket").lean();
    if (fresh?.shiprocket?.shipmentId && !order.shiprocket?.shipmentId) {
      order.shiprocket = fresh.shiprocket;
    }

    const steps = { shipment: false, awb: false, pickup: false, label: false };
    const errors = {};

    // 1. Shipment. A failure here is the caller's error: nothing exists yet.
    await processShiprocketOrder(order);
    steps.shipment = true;

    if (isPastPickup(order)) {
      return { state: "COMPLETE", complete: true, steps: { ...steps, awb: true, pickup: true, label: true }, errors, shipment: order.shiprocket };
    }

    // 2. AWB
    if (!order.shiprocket?.awb) {
      try {
        const envDelay = Number(process.env.SHIPROCKET_AWB_RETRY_DELAY_MS);
        await assignShiprocketAwb(order, {
          attempts: options.attempts,
          retryDelayMs: options.retryDelayMs ?? (Number.isFinite(envDelay) && envDelay >= 0 ? envDelay : undefined),
        });
      } catch (e) {
        errors.awb = reason(e);
      }
    }
    steps.awb = Boolean(order.shiprocket?.awb);

    // 3. Pickup (needs the AWB)
    if (steps.awb) {
      if (isPickupDone(order.shiprocket)) {
        steps.pickup = true;
      } else {
        try {
          await requestShiprocketPickup(order);
          steps.pickup = true;
        } catch (e) {
          errors.pickup = reason(e);
        }
      }
    }

    // 4. Label (needs the AWB). The URL is stored so the seller can reopen it any time.
    if (steps.awb) {
      if (order.shiprocket?.labelUrl) {
        steps.label = true;
      } else {
        try {
          const label = await getShiprocketLabel(order);
          steps.label = Boolean(label?.labelUrl);
          if (steps.label && !order.shiprocket.labelUrl) order.shiprocket.labelUrl = label.labelUrl; // saved with the state below
          if (!steps.label) errors.label = "Shiprocket has not returned the label yet";
        } catch (e) {
          errors.label = reason(e);
        }
      }
    }

    const state = !steps.awb ? "AWB_PENDING" : !steps.pickup ? "PICKUP_PENDING" : !steps.label ? "LABEL_PENDING" : "COMPLETE";
    const firstError = errors.awb || errors.pickup || errors.label || null;
    const prev = order.shiprocket?.automation || {};
    order.shiprocket.automation = {
      state,
      lastError: state === "COMPLETE" ? null : firstError,
      attempts: state === "COMPLETE" ? 0 : (Number(prev.attempts) || 0) + 1,
      lastAttemptAt: new Date(),
    };
    await order.save();

    return { state, complete: state === "COMPLETE", steps, errors, shipment: order.shiprocket };
  } finally {
    await releaseLock(order._id);
  }
}

/** Orders whose automation stopped half way and are due another attempt (used by the retry job). */
export async function findOrdersNeedingRetry({ now = new Date(), minGapMs = 5 * 60 * 1000, limit = 20 } = {}) {
  return Order.find({
    fulfillmentType: "SHIPROCKET",
    status: { $in: ["confirmed", "packed"] },
    "shiprocket.shipmentId": { $ne: null },
    "shiprocket.automation.state": { $in: ["AWB_PENDING", "PICKUP_PENDING", "LABEL_PENDING"] },
    "shiprocket.automation.attempts": { $lt: MAX_AUTO_ATTEMPTS },
    "shiprocket.automation.lastAttemptAt": { $lte: new Date(now.getTime() - minGapMs) },
  })
    .sort({ "shiprocket.automation.lastAttemptAt": 1 })
    .limit(limit);
}

/** One pass of the retry job. Never throws; returns counts for logging. */
export async function retryPendingShiprocketAutomation(options = {}) {
  const orders = await findOrdersNeedingRetry(options);
  const summary = { found: orders.length, completed: 0, stillPending: 0, failed: 0 };
  for (const order of orders) {
    try {
      const r = await autoFulfillShiprocketOrder(order, { attempts: 1 });
      if (r.complete) summary.completed += 1;
      else summary.stillPending += 1;
    } catch (_) {
      summary.failed += 1;
    }
  }
  return summary;
}
