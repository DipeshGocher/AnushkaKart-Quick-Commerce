/**
 * A return that was approved but whose pickup never got started ("return_approved"), for two reasons:
 *   - courier (Shiprocket): the reverse pickup could not be booked, or the courier cancelled it;
 *   - local: no delivery partner accepted the pickup after all the search rounds.
 *
 * This is NOT a rejection. Nothing here changes the return's outcome; it keeps trying and tells people:
 *   courier : the booking is retried (up to 3 times, 10 minutes apart); after that the admin is alerted
 *             (again every 24 hours) so a person can book it by hand;
 *   local   : after 2 hours without a pickup the admin, the seller and the customer are told (the admin and
 *             seller again every 12 hours) so someone assigns a delivery partner.
 */
import Order from "../../models/order.js";
import Admin from "../../models/admin.js";
import { createShiprocketReversePickup } from "../shipping/shiprocketService.js";
import { emitNotificationEvent } from "../../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../../modules/notifications/notification.constants.js";
import logger from "../logger.js";

const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;
export const MAX_REBOOK_ATTEMPTS = 3;
export const REBOOK_GAP_MS = 10 * MIN_MS;
const LOCAL_WAIT_MS = 2 * HOUR_MS;
const COURIER_ALERT_EVERY_MS = 24 * HOUR_MS;
const LOCAL_ALERT_EVERY_MS = 12 * HOUR_MS;

async function adminIds() {
  try {
    return (await Admin.find().select("_id").lean()).map((a) => a._id);
  } catch {
    return [];
  }
}

const ms = (d) => (d ? new Date(d).getTime() : 0);

/** Sends the "pickup is delayed" message to the customer, the seller and the admin. */
export async function notifyReturnPickupDelayed(order, reason, { toCustomer = true } = {}) {
  emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_PICKUP_DELAYED, {
    orderId: order.orderId,
    customerId: toCustomer ? order.customer : null,
    userId: toCustomer ? order.customer : null,
    sellerId: order.seller,
    adminIds: await adminIds(),
    data: { reason },
  });
}

export async function sweepStuckReturnPickups({ now = new Date(), limit = 100 } = {}) {
  const rows = await Order.find({ returnStatus: "return_approved" })
    .select("_id orderId orderId customer seller fulfillmentType shiprocket.reverseAwb returnPickupStuckAt returnPickupRecoveryAttempts returnPickupRecoveryAt returnPickupAlertedAt")
    .limit(limit)
    .lean();
  const summary = { checked: rows.length, rebooked: 0, alerted: 0 };

  for (const row of rows) {
    try {
      // First time we see it: start the clock (approving takes a moment and the pickup search is still running).
      if (!row.returnPickupStuckAt) {
        await Order.updateOne({ _id: row._id, returnStatus: "return_approved", returnPickupStuckAt: null }, { $set: { returnPickupStuckAt: now } });
        continue;
      }
      const stuckFor = now.getTime() - ms(row.returnPickupStuckAt);
      const alertedAgo = row.returnPickupAlertedAt ? now.getTime() - ms(row.returnPickupAlertedAt) : Infinity;

      if (row.fulfillmentType === "SHIPROCKET") {
        if (row.shiprocket?.reverseAwb) continue; // a pickup exists; the courier's status updates move it on
        const attempts = Number(row.returnPickupRecoveryAttempts || 0);
        const sinceAttempt = row.returnPickupRecoveryAt ? now.getTime() - ms(row.returnPickupRecoveryAt) : Infinity;
        if (attempts < MAX_REBOOK_ATTEMPTS) {
          if (sinceAttempt < REBOOK_GAP_MS || stuckFor < REBOOK_GAP_MS) continue;
          const claimed = await Order.updateOne(
            { _id: row._id, returnStatus: "return_approved", $or: [{ returnPickupRecoveryAttempts: attempts }, { returnPickupRecoveryAttempts: null }] },
            { $set: { returnPickupRecoveryAt: now }, $inc: { returnPickupRecoveryAttempts: 1 } },
          );
          if (!claimed.modifiedCount) continue;
          try {
            await createShiprocketReversePickup(row.orderId);
            summary.rebooked += 1;
          } catch (error) {
            logger.warn("Return pickup rebooking failed", { scope: "ReturnPickupRecovery", orderId: row.orderId, attempt: attempts + 1, error: error.message });
          }
        } else if (alertedAgo >= COURIER_ALERT_EVERY_MS) {
          await Order.updateOne({ _id: row._id }, { $set: { returnPickupAlertedAt: now } });
          await notifyReturnPickupDelayed(row, "The courier pickup for this return could not be booked automatically. Please book it from the order page.", { toCustomer: !row.returnPickupAlertedAt });
          summary.alerted += 1;
        }
        continue;
      }

      // Local return: no delivery partner accepted the pickup.
      if (stuckFor >= LOCAL_WAIT_MS && alertedAgo >= (row.returnPickupAlertedAt ? LOCAL_ALERT_EVERY_MS : 0)) {
        await Order.updateOne({ _id: row._id }, { $set: { returnPickupAlertedAt: now } });
        await notifyReturnPickupDelayed(row, "No delivery partner has accepted this return pickup yet. Please assign one.", { toCustomer: !row.returnPickupAlertedAt });
        summary.alerted += 1;
      }
    } catch (error) {
      logger.error("Return pickup recovery failed", { scope: "ReturnPickupRecovery", orderId: row.orderId, error: error.message });
    }
  }
  return summary;
}

export default { sweepStuckReturnPickups, notifyReturnPickupDelayed };
