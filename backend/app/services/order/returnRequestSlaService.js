/**
 * A customer asked for a return and nobody has answered yet (status "return_requested").
 *
 * There is NO automatic approval: a return only happens when the seller or the admin approves it. So that a
 * request can never sit forgotten, the seller and the admin are reminded:
 *
 *   24h  -> reminder to the seller
 *   40h  -> second reminder to the seller
 *   48h  -> the admin is told "the seller has not answered" (and again every 24 hours after that)
 *
 * Until it is answered the seller's payout stays on hold; once the request is approved or rejected the
 * normal flow takes over (a rejection releases the payout).
 */
import Order from "../../models/order.js";
import Admin from "../../models/admin.js";
import { emitNotificationEvent } from "../../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../../modules/notifications/notification.constants.js";
import logger from "../logger.js";

const HOUR_MS = 60 * 60 * 1000;
const MAX_STAGE = 12;

function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getRequestSlaPolicy() {
  const dueHours = positiveNumber(process.env.RETURN_REQUEST_DUE_HOURS, 48);
  return { dueHours, reminderHours: [dueHours * 0.5, Math.round(dueHours * (5 / 6) * 100) / 100] };
}

/**
 * Which reminder stage a request has reached: 0 nothing yet, 1 and 2 seller reminders,
 * 3 = admin told at the due time, then +1 for every further 24 hours.
 */
export function getRequestStage(requestedAt, now = new Date()) {
  const start = requestedAt ? new Date(requestedAt).getTime() : NaN;
  if (!Number.isFinite(start)) return 0;
  const hours = (now.getTime() - start) / HOUR_MS;
  const { dueHours, reminderHours } = getRequestSlaPolicy();
  if (hours >= dueHours) return Math.min(MAX_STAGE, 3 + Math.floor((hours - dueHours) / 24));
  if (hours >= reminderHours[1]) return 2;
  if (hours >= reminderHours[0]) return 1;
  return 0;
}

async function getAdminIds() {
  try {
    return (await Admin.find().select("_id").lean()).map((a) => a._id);
  } catch {
    return [];
  }
}

/** Sends the reminders that are due. Safe to run often: each stage is sent once (conditional update). */
export async function sweepReturnRequests({ now = new Date(), limit = 200 } = {}) {
  const rows = await Order.find({ returnStatus: "return_requested" })
    .select("_id orderId seller returnRequestedAt returnRequestReminderStage")
    .limit(limit)
    .lean();
  const summary = { checked: rows.length, reminded: 0, escalated: 0 };
  let adminIds = null;

  for (const row of rows) {
    try {
      const target = getRequestStage(row.returnRequestedAt, now);
      const current = Number(row.returnRequestReminderStage || 0);
      if (target <= current) continue;

      const claimed = await Order.updateOne(
        {
          _id: row._id,
          returnStatus: "return_requested",
          $or: [{ returnRequestReminderStage: { $lt: target } }, { returnRequestReminderStage: null }],
        },
        { $set: { returnRequestReminderStage: target } },
      );
      if (!claimed.modifiedCount) continue;

      if (target >= 3) {
        if (!adminIds) adminIds = await getAdminIds();
        const hours = Math.round((now.getTime() - new Date(row.returnRequestedAt).getTime()) / HOUR_MS);
        emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_REQUEST_ESCALATED, {
          orderId: row.orderId,
          sellerId: row.seller,
          adminIds,
          data: { hours },
        });
        summary.escalated += 1;
      } else {
        emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_REQUEST_REMINDER, {
          orderId: row.orderId,
          sellerId: row.seller,
        });
        summary.reminded += 1;
      }
    } catch (error) {
      logger.error("Return request reminder failed", { scope: "ReturnRequestSla", orderId: row.orderId, error: error.message });
    }
  }
  return summary;
}

export default { sweepReturnRequests, getRequestStage, getRequestSlaPolicy };
