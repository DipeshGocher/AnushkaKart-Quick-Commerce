/**
 * Customer-safe view of courier (Shiprocket) shipment data.
 *
 * The raw `order.shiprocket` sub-document carries internal data (shipment ids,
 * label/manifest URLs, weight-discrepancy penalties, internal log remarks,
 * vendor names). Customers only need: courier name, a way to track, the
 * estimated delivery date and a friendly status timeline. Everything else is
 * stripped here so every customer-facing surface (REST + socket) shares one
 * contract.
 */

// Placeholder courier names we write ourselves before a real courier is known.
const PLACEHOLDER_COURIER_NAMES = new Set([
  "shiprocket courier partner",
  "shiprocket express logistics",
  "pending assignment",
]);

// Internal-only states: never shown to customers.
const INTERNAL_STATUSES = new Set([
  "NEW",
  "ORDER_CREATED",
  "PENDING_DISPATCH",
  "WEIGHT_DISCREPANCY",
]);

const STATUS_LABELS = {
  AWB_ASSIGNED: "Shipment booked",
  PICKUP_SCHEDULED: "Pickup scheduled",
  PICKUP_QUEUED: "Pickup scheduled",
  OUT_FOR_PICKUP: "Out for pickup",
  PICKED_UP: "Picked up by courier",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In transit",
  REACHED_AT_DESTINATION_HUB: "Reached destination hub",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  UNDELIVERED: "Delivery attempt unsuccessful",
  RTO_INITIATED: "Returning to seller",
  RTO_DELIVERED: "Returned to seller",
  CANCELLED: "Cancelled",
  CANCELED: "Cancelled",
};

function statusKey(status) {
  return String(status || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function titleCase(key) {
  return key
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function customerStatusLabel(status) {
  const key = statusKey(status);
  if (!key || INTERNAL_STATUSES.has(key)) return null;
  return STATUS_LABELS[key] || titleCase(key);
}

function cleanCourierName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed || PLACEHOLDER_COURIER_NAMES.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

/**
 * Build the customer-safe `shiprocket` object. Returns null when there is
 * nothing to expose.
 */
export function buildCustomerShiprocket(shiprocket) {
  if (!shiprocket) return null;
  const raw = typeof shiprocket.toObject === "function" ? shiprocket.toObject() : shiprocket;

  const awb = raw.awb ? String(raw.awb) : null;
  const history = (Array.isArray(raw.history) ? raw.history : [])
    .map((event) => {
      const label = customerStatusLabel(event?.status);
      if (!label) return null;
      return {
        status: label,
        code: statusKey(event.status),
        // Only courier-reported scans carry a meaningful location; our own
        // system/manual entries default to the customer's own city.
        location: event.source === "webhook" ? event.location || "" : "",
        timestamp: event.timestamp,
      };
    })
    .filter(Boolean);

  return {
    awb,
    courierName: cleanCourierName(raw.courierName),
    trackingUrl: awb ? raw.trackingUrl || `https://shiprocket.co/tracking/${awb}` : null,
    // Normalised code ("IN TRANSIT" -> "IN_TRANSIT") so clients can compare reliably.
    currentStatus: INTERNAL_STATUSES.has(statusKey(raw.currentStatus)) ? null : statusKey(raw.currentStatus) || null,
    statusLabel: customerStatusLabel(raw.currentStatus),
    etd: raw.etd || null,
    pickupScheduledAt: raw.pickupScheduledAt || null,
    shippedAt: raw.shippedAt || null,
    deliveredAt: raw.deliveredAt || null,
    // Return (reverse pickup) info the customer's return screen already uses.
    reverseAwb: raw.reverseAwb || null,
    reverseCourierName: cleanCourierName(raw.reverseCourierName),
    reverseStatus: raw.reverseStatus || null,
    history,
  };
}

/**
 * Strip seller private details and internal shipment data from an
 * order that is about to be returned to its owning customer. Mutates and
 * returns the (lean) order object.
 *
 * - Courier orders: sanitised shipment; seller reduced to a name
 *   (their pickup address/phone/location is for the courier, not the buyer).
 * - Local-rider orders: no courier data is relevant, so it is dropped; seller
 *   details stay because the live-tracking map needs the store location.
 */
export function sanitizeOrderForCustomer(order) {
  if (!order || typeof order !== "object") return order;

  if (order.fulfillmentType === "SHIPROCKET") {
    order.shiprocket = buildCustomerShiprocket(order.shiprocket);
    // Only strip *populated* documents; a bare ObjectId reference has nothing private.
    const isPopulated = (ref) => ref && typeof ref === "object" && !ref._bsontype;
    if (isPopulated(order.seller)) {
      order.seller = {
        _id: order.seller._id,
        shopName: order.seller.shopName,
        name: order.seller.name,
      };
    }
  } else {
    delete order.shiprocket;
  }

  return order;
}
