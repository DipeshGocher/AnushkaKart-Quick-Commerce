/**
 * Single source of truth for order status across customer, seller, delivery, and admin UIs.
 * Mirrors backend `legacyStatusFromWorkflow` (see backend/app/constants/orderWorkflow.js).
 */

export const WORKFLOW_STATUS = {
  CREATED: "CREATED",
  SELLER_PENDING: "SELLER_PENDING",
  SELLER_ACCEPTED: "SELLER_ACCEPTED",
  DELIVERY_SEARCH: "DELIVERY_SEARCH",
  DELIVERY_ASSIGNED: "DELIVERY_ASSIGNED",
  PICKUP_READY: "PICKUP_READY",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

const LEGACY_ENUM = new Set([
  "pending",
  "confirmed",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

function legacyFromWorkflow(workflowStatus) {
  switch (workflowStatus) {
    case WORKFLOW_STATUS.CREATED:
    case WORKFLOW_STATUS.SELLER_PENDING:
      return "pending";
    case WORKFLOW_STATUS.SELLER_ACCEPTED:
    case WORKFLOW_STATUS.DELIVERY_SEARCH:
    case WORKFLOW_STATUS.DELIVERY_ASSIGNED:
      return "confirmed";
    case WORKFLOW_STATUS.PICKUP_READY:
      return "packed";
    case WORKFLOW_STATUS.OUT_FOR_DELIVERY:
      return "out_for_delivery";
    case WORKFLOW_STATUS.DELIVERED:
      return "delivered";
    case WORKFLOW_STATUS.CANCELLED:
      return "cancelled";
    default:
      return "pending";
  }
}

/**
 * Normalized legacy bucket (matches Order.status enum + v2 workflow mapping).
 * Use for filters, tabs, and comparisons across panels.
 */
export function getLegacyStatusFromOrder(order) {
  if (!order) return "pending";
  const v = Number(order.workflowVersion) || 0;
  if (v >= 2 && order.workflowStatus) {
    const workflowStatus = String(order.workflowStatus).toUpperCase();

    if (workflowStatus === WORKFLOW_STATUS.OUT_FOR_DELIVERY) {
      return "out_for_delivery";
    }
    if (workflowStatus === WORKFLOW_STATUS.DELIVERED) {
      return "delivered";
    }
    if (workflowStatus === WORKFLOW_STATUS.PICKUP_READY) {
      return "packed";
    }
    // "Packed" is a flag on local orders (pickupReadyAt) that the seller can set
    // while the delivery workflow is still searching / assigned.
    if (
      order.pickupReadyAt &&
      (workflowStatus === WORKFLOW_STATUS.DELIVERY_ASSIGNED ||
        workflowStatus === WORKFLOW_STATUS.DELIVERY_SEARCH ||
        workflowStatus === WORKFLOW_STATUS.SELLER_ACCEPTED)
    ) {
      return "packed";
    }
    if (workflowStatus === WORKFLOW_STATUS.DELIVERY_ASSIGNED) {
      return "confirmed";
    }

    return legacyFromWorkflow(workflowStatus);
  }

  const s = String(order.status ?? "").toLowerCase();
  if (s === "packed") return "packed";

  const riderStep = Number(order.deliveryRiderStep) || 0;
  if (riderStep >= 3 || order.outForDeliveryAt || order.pickupConfirmedAt) {
    return "out_for_delivery";
  }
  if (order.pickupReadyAt) {
    return "packed";
  }
  if (riderStep >= 1 || order.assignedAt || order.deliveryBoy) {
    return "confirmed";
  }

  if (LEGACY_ENUM.has(s)) return s;
  return "pending";
}

const DISPLAY_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** "IN TRANSIT" / "in-transit" / "CANCELED" -> "IN_TRANSIT" / "CANCELLED" (mirrors backend). */
export function normalizeShipmentStatus(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/CANCELED/g, "CANCELLED");
}

const COURIER_IN_TRANSIT = new Set(["PICKED_UP", "SHIPPED", "IN_TRANSIT", "REACHED_AT_DESTINATION_HUB"]);

/** Courier orders only: has the courier physically taken the parcel? (Mirrors backend `courierHasParcel`.) */
export function courierHasParcel(order) {
  if (order?.fulfillmentType !== "SHIPROCKET") return false;
  const sr = order?.shiprocket || {};
  const key = normalizeShipmentStatus(sr.currentStatus);
  return Boolean(
    sr.shippedAt ||
      COURIER_IN_TRANSIT.has(key) ||
      key === "OUT_FOR_DELIVERY" ||
      key === "UNDELIVERED" ||
      key.startsWith("RTO"),
  );
}

/**
 * The one label every panel uses for an order's current stage.
 * Same buckets as `getLegacyStatusFromOrder`, plus the courier-only stages the
 * legacy enum has no word for ("Shipped", "Returning to seller").
 */
export function getStageLabel(order) {
  const bucket = getLegacyStatusFromOrder(order);
  if (order?.fulfillmentType === "SHIPROCKET" && bucket !== "delivered" && bucket !== "cancelled") {
    const key = normalizeShipmentStatus(order?.shiprocket?.currentStatus);
    if (key.startsWith("RTO")) return "Returning to seller";
    if (key === "UNDELIVERED") return "Delivery attempt failed";
    if (bucket === "packed" && (COURIER_IN_TRANSIT.has(key) || order?.shiprocket?.shippedAt)) return "Shipped";
  }
  return DISPLAY_LABELS[bucket] || String(bucket).replace(/_/g, " ");
}

// Local workflow states in which no rider has been assigned yet.
const BEFORE_RIDER_WORKFLOW = new Set([
  WORKFLOW_STATUS.CREATED,
  WORKFLOW_STATUS.SELLER_PENDING,
  WORKFLOW_STATUS.SELLER_ACCEPTED,
  WORKFLOW_STATUS.DELIVERY_SEARCH,
]);

/**
 * May this actor still cancel? Mirrors the backend rules:
 * - courier orders: only until the courier has the parcel
 * - local orders: sellers only until a rider is assigned; admin until it is delivered
 */
export function canCancelOrder(order, role = "seller") {
  const bucket = getLegacyStatusFromOrder(order);
  if (bucket === "delivered" || bucket === "cancelled") return false;
  if (order?.fulfillmentType === "SHIPROCKET") {
    return !courierHasParcel(order) && bucket !== "out_for_delivery";
  }
  if (role === "admin") return true;
  if (bucket === "out_for_delivery") return false;
  const ws = String(order?.workflowStatus || "").toUpperCase();
  // No workflow info (legacy orders) -> keep the old behaviour.
  return !ws || BEFORE_RIDER_WORKFLOW.has(ws);
}

/**
 * Status dropdown choices for one order and one role ("seller" | "admin").
 * First entry is always the current stage (so a <select> value always matches).
 * Every panel should render its dropdown from this so they can never disagree.
 *
 * `overrideReasonRequired` marks admin-only forced steps on local deliveries
 * (normally the rider completes these with the customer OTP).
 */
export function getStatusOptions(order, role = "seller") {
  const bucket = getLegacyStatusFromOrder(order);
  const isCourier = order?.fulfillmentType === "SHIPROCKET";
  const isAdmin = role === "admin";
  const options = [{ value: bucket, label: getStageLabel(order) }];
  const add = (value, label, extra = {}) => options.push({ value, label, ...extra });
  const cancelOption = () => canCancelOrder(order, role) && add("cancelled", "Cancel Order");

  if (bucket === "pending") {
    add("confirmed", "Confirm");
    cancelOption();
  } else if (bucket === "confirmed") {
    add("packed", isCourier ? "Pack & Create Shipment" : "Mark Packed");
    if (isAdmin && !isCourier) add("out_for_delivery", "Out for Delivery (override)", { overrideReasonRequired: true });
    cancelOption();
  } else if (bucket === "packed") {
    if (isAdmin && !isCourier) {
      add("out_for_delivery", "Out for Delivery (override)", { overrideReasonRequired: true });
      add("delivered", "Delivered (override)", { overrideReasonRequired: true });
    }
    cancelOption();
  } else if (bucket === "out_for_delivery") {
    if (isAdmin && !isCourier) add("delivered", "Delivered (override)", { overrideReasonRequired: true });
    cancelOption();
  }
  return options;
}

/** Human-readable status for list/detail badges (customer-facing tone). */
export function getOrderStatusLabel(order) {
  const rs = order?.returnStatus;
  if (rs && rs !== "none") {
    switch (rs) {
      case "return_requested": return "Return Requested";
      case "return_approved": return "Return Approved";
      case "return_pickup_assigned": return "Pickup Assigned";
      case "return_pickup_verified": return "Pickup Verified";
      case "returned": return "Return Delivered to Seller";
      case "qc_passed": return "Return QC Passed";
      case "qc_failed": return "Return QC Failed";
      case "refund_completed": return "Returned & Refunded";
      default: return rs.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    }
  }

  return getStageLabel(order);
}

/**
 * Admin sidebar uses path segments like `processed` and `out-for-delivery`.
 * Map route param → whether an order belongs in that view.
 */
export function adminRouteMatchesOrder(routeStatus, order) {
  const legacy = getLegacyStatusFromOrder(order);
  if (routeStatus === "all") return true;
  if (routeStatus === "upi-pending") {
    const mode = String(order?.paymentMode || order?.payment || order?.rawOrder?.paymentMode || "").toUpperCase();
    const pStatus = String(order?.paymentStatus || order?.rawOrder?.paymentStatus || "").toUpperCase();
    return mode.includes("UPI") && (pStatus === "AWAITING_VERIFICATION" || pStatus === "CREATED" || pStatus === "PENDING");
  }
  if (routeStatus === "pending") return legacy === "pending";
  if (routeStatus === "processed") {
    return legacy === "confirmed" || legacy === "packed";
  }
  if (routeStatus === "out-for-delivery") {
    return legacy === "out_for_delivery";
  }
  if (routeStatus === "delivered") {
    const rs = order?.returnStatus;
    const hasActiveOrCompletedReturn = rs && !["none", "return_rejected"].includes(rs);
    return legacy === "delivered" && !hasActiveOrCompletedReturn;
  }
  if (routeStatus === "cancelled") return legacy === "cancelled";
  if (routeStatus === "returned") {
    const rs = order?.returnStatus;
    return (rs && rs !== "none") || order?.status === "returned";
  }
  return legacy === routeStatus;
}
