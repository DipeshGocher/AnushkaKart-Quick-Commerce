/**
 * What a seller/admin should see and be able to press on a courier (Shiprocket) order.
 *
 * One rule for both panels, so they can never disagree:
 *  - ONE booking button. It books the shipment, assigns the AWB, requests the pickup and fetches the label,
 *    and it can be pressed again at any time: every step resumes where it stopped.
 *  - "Retry" stays visible for as long as the booking is not finished (it used to disappear once the AWB existed).
 *  - There is no separate "Schedule Pickup" button: the one booking button already does that step.
 *  - "Print Label" is offered as soon as the shipment has an AWB.
 */

const PICKUP_DONE_STATUSES = ["PICKUP_SCHEDULED", "PICKUP_QUEUED"];
const PAST_PICKUP_STATUSES = [
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "RTO_INITIATED",
  "RTO_DELIVERED",
  "RTO_ACKNOWLEDGED",
];
const PENDING_AUTOMATION_STATES = ["AWB_PENDING", "PICKUP_PENDING", "LABEL_PENDING"];

const upper = (v) => String(v || "").toUpperCase();

/**
 * @param {object} order order as returned by the API (needs fulfillmentType, status, shiprocket)
 * @returns {null | {
 *   kind: "NOT_BOOKED"|"PENDING"|"READY"|"PAST_PICKUP"|"CLOSED",
 *   showBookButton: boolean, bookLabel: string, showPrintLabel: boolean,
 *   message: string, tone: "info"|"warning"|"success"|"none", error: string|null
 * }}
 */
export function getCourierBookingView(order) {
  if (!order || order.fulfillmentType !== "SHIPROCKET") return null;

  const sr = order.shiprocket || {};
  const orderStatus = String(order.status || "").toLowerCase();
  const srStatus = upper(sr.currentStatus);
  const hasShipment = Boolean(sr.shipmentId);
  const hasAwb = Boolean(sr.awb);

  const closed = {
    showBookButton: false,
    bookLabel: "",
    showPrintLabel: false,
    message: "",
    tone: "none",
    error: null,
  };

  if (["cancelled", "delivered"].includes(orderStatus)) return { kind: "CLOSED", ...closed };

  const pastPickup =
    PAST_PICKUP_STATUSES.includes(srStatus) ||
    Boolean(sr.shippedAt) ||
    Boolean(sr.deliveredAt) ||
    ["shipped", "out_for_delivery"].includes(orderStatus);
  if (pastPickup) {
    return {
      kind: "PAST_PICKUP",
      ...closed,
      showPrintLabel: hasAwb,
      message: "The courier has the parcel. Use Track to follow it.",
      tone: "info",
    };
  }

  if (!hasShipment) {
    return {
      kind: "NOT_BOOKED",
      ...closed,
      showBookButton: true,
      bookLabel: "Book Courier",
      message: "Press Book Courier. It books the shipment, the pickup and the label in one go.",
      tone: "info",
    };
  }

  const pickupDone =
    PICKUP_DONE_STATUSES.includes(srStatus) ||
    Boolean(sr.pickupScheduledAt) ||
    (sr.history || []).some((h) => upper(h?.status) === "PICKUP_SCHEDULED");
  const automationState = sr.automation?.state || null;
  const finished = hasAwb && pickupDone && !PENDING_AUTOMATION_STATES.includes(automationState);

  if (finished) {
    return {
      kind: "READY",
      ...closed,
      showPrintLabel: true,
      message: "Ready. Print the label, stick it on the parcel and hand it to the courier.",
      tone: "success",
    };
  }

  const error = sr.automation?.lastError || null;
  const missing = !hasAwb ? "the courier (AWB)" : !pickupDone ? "the pickup" : "the label";
  return {
    kind: "PENDING",
    ...closed,
    showBookButton: true,
    bookLabel: "Retry Booking",
    showPrintLabel: hasAwb,
    message: error
      ? `Booking is not finished: ${error}. It is retried automatically every few minutes; press Retry Booking to try now.`
      : `Booking is not finished yet (${missing} is still pending). It is retried automatically every few minutes; press Retry Booking to try now.`,
    tone: "warning",
    error,
  };
}
