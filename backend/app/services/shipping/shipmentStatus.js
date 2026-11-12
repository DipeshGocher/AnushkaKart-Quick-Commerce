/**
 * Pure helpers for courier (Shiprocket) shipment status handling.
 *
 * One place for: normalising courier status strings, ordering them so late /
 * duplicate webhook events can't move an order backwards, and deciding whether
 * an order can still be cancelled. No DB / network access here on purpose, so
 * it is trivially unit-testable.
 */

/** "IN TRANSIT" / "in-transit" / "CANCELED" -> "IN_TRANSIT" / "CANCELLED" */
export function normalizeShipmentStatus(raw) {
  const key = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  // Shiprocket spells it with one L.
  return key.replace(/CANCELED/g, "CANCELLED");
}

/**
 * Forward-only ranking of the normal delivery path. Anything not listed here
 * (UNDELIVERED, RTO_*, CANCELLED, ...) is an "exception" state with no rank.
 */
const FORWARD_RANK = {
  NEW: 0,
  ORDER_CREATED: 0,
  PENDING_DISPATCH: 0,
  AWB_ASSIGNED: 1,
  PICKUP_SCHEDULED: 2,
  PICKUP_QUEUED: 2,
  PICKUP_GENERATED: 2,
  OUT_FOR_PICKUP: 2,
  PICKED_UP: 3,
  SHIPPED: 3,
  IN_TRANSIT: 3,
  REACHED_AT_DESTINATION_HUB: 3,
  OUT_FOR_DELIVERY: 4,
  DELIVERED: 5,
};

export function shipmentRank(statusKey) {
  const rank = FORWARD_RANK[statusKey];
  return rank === undefined ? null : rank;
}

export function isRtoStatus(statusKey) {
  return String(statusKey || "").startsWith("RTO");
}

export function isInTransitStatus(statusKey) {
  return ["PICKED_UP", "SHIPPED", "IN_TRANSIT", "REACHED_AT_DESTINATION_HUB"].includes(statusKey);
}

export function isPickupScheduledStatus(statusKey) {
  return ["PICKUP_SCHEDULED", "PICKUP_QUEUED", "PICKUP_GENERATED", "OUT_FOR_PICKUP"].includes(statusKey);
}

export function isCancelledStatus(statusKey) {
  return statusKey === "CANCELLED";
}

export function isRtoDeliveredStatus(statusKey) {
  return statusKey === "RTO_DELIVERED" || statusKey === "RTO_ACKNOWLEDGED";
}

/**
 * Should an incoming courier event be ignored because applying it would move
 * the order backwards (or change a finished order)?
 *
 * @returns {string|null} reason to ignore, or null if the event can be applied.
 */
export function outOfOrderReason(order, nextKey) {
  const coreStatus = String(order?.status || "").toLowerCase();
  const currentKey = normalizeShipmentStatus(order?.shiprocket?.currentStatus);

  // Same event again (retries / duplicate webhooks).
  if (currentKey && currentKey === nextKey && ["DELIVERED", "CANCELLED"].includes(nextKey)) {
    return "duplicate";
  }
  // Finished orders never change because of a late courier scan.
  if (coreStatus === "delivered" || coreStatus === "cancelled") {
    return `order already ${coreStatus}`;
  }

  const nextRank = shipmentRank(nextKey);
  const currentRank = shipmentRank(currentKey);

  // After a return-to-origin started, forward-path events are stale noise.
  if (isRtoStatus(currentKey) && nextRank !== null) {
    return "shipment is already returning to seller";
  }
  if (nextRank !== null && currentRank !== null && nextRank < currentRank) {
    return `stale event ${nextKey} after ${currentKey}`;
  }
  return null;
}

/** Has the courier physically taken / started moving the parcel? */
export function courierHasParcel(shiprocket) {
  if (!shiprocket) return false;
  const key = normalizeShipmentStatus(shiprocket.currentStatus);
  const rank = shipmentRank(key);
  return Boolean(
    shiprocket.shippedAt ||
      (rank !== null && rank >= 3) ||
      isRtoStatus(key) ||
      key === "UNDELIVERED",
  );
}

/**
 * Cancelling after the courier holds the parcel would refund the customer
 * while the parcel is still being delivered. Block it.
 */
export function assertShipmentCancellable(order) {
  if (courierHasParcel(order?.shiprocket)) {
    const err = new Error(
      "The courier has already picked up this shipment, so it can no longer be cancelled. It will be returned to the seller if it cannot be delivered.",
    );
    err.statusCode = 409;
    throw err;
  }
}
