/**
 * The admin Orders / Returns pages are just two groups each:
 *   Orders:  Active Orders  | Completed Orders
 *   Returns: Active Returns | Completed Returns
 * Inside a page a few pills narrow the list (they are filters of the same page, not new pages).
 * The old, more detailed URLs still work: they redirect to the matching group and pill.
 */

export const ORDER_GROUPS = ["active", "completed"];

/** Pills of the Orders pages. `id` is also the status filter the server understands. */
export const ORDER_VIEWS = {
  active: [
    { id: "active", label: "All active" },
    { id: "pending", label: "New" },
    { id: "processed", label: "Being prepared" },
    { id: "out-for-delivery", label: "On the way" },
    { id: "upi-pending", label: "UPI approval" },
  ],
  completed: [
    { id: "completed", label: "All" },
    { id: "delivered", label: "Delivered" },
    { id: "cancelled", label: "Cancelled" },
  ],
};

export const orderGroupTitle = (group) => (group === "completed" ? "Completed Orders" : "Active Orders");

/** Group + pill from the URL: an unknown pill falls back to the group's "All". */
export function resolveOrdersView(group, viewParam) {
  const g = group === "completed" ? "completed" : "active";
  const views = ORDER_VIEWS[g];
  const view = views.find((v) => v.id === String(viewParam || "").toLowerCase());
  return { group: g, status: view ? view.id : g };
}

/** Old order URLs -> the new page (with its pill). null when the segment is already a new group. */
const LEGACY_ORDER_ROUTES = {
  all: "/admin/orders/active",
  pending: "/admin/orders/active?view=pending",
  processed: "/admin/orders/active?view=processed",
  "out-for-delivery": "/admin/orders/active?view=out-for-delivery",
  "upi-pending": "/admin/orders/active?view=upi-pending",
  delivered: "/admin/orders/completed?view=delivered",
  cancelled: "/admin/orders/completed?view=cancelled",
  returned: "/admin/returns/active",
};

export function legacyOrderRedirect(segment) {
  const key = String(segment || "").toLowerCase();
  if (ORDER_GROUPS.includes(key)) return null;
  return LEGACY_ORDER_ROUTES[key] || "/admin/orders/active";
}

/* ───────────── Returns ───────────── */

export const RETURN_GROUPS = ["active", "completed"];

/** Pills of the Returns pages; each lists the returnStatus values it covers (the page filters with them). */
export const RETURN_VIEWS = {
  active: [
    { id: "all", label: "All active", statuses: null },
    { id: "requested", label: "Requested", statuses: ["return_requested"] },
    { id: "pickup", label: "Pickup / In transit", statuses: ["return_approved", "return_pickup_assigned", "return_in_transit", "return_drop_pending"] },
    { id: "qc", label: "Quality check", statuses: ["returned", "qc_passed", "qc_failed"] },
    { id: "disputes", label: "Disputes", statuses: null, dispute: true },
  ],
  completed: [
    { id: "all", label: "All" },
    { id: "refunded", label: "Refunded", statuses: ["refund_completed"] },
    { id: "rejected", label: "Rejected", statuses: ["return_rejected"] },
    { id: "qc-failed", label: "QC failed (closed)", statuses: ["qc_failed"] },
  ],
};

export const returnGroupTitle = (group) => (group === "completed" ? "Completed Returns" : "Active Returns");

export function resolveReturnsView(group, viewParam) {
  const g = group === "completed" ? "completed" : "active";
  const view = RETURN_VIEWS[g].find((v) => v.id === String(viewParam || "").toLowerCase());
  return { group: g, view: view || RETURN_VIEWS[g][0] };
}

/**
 * Which Returns page an order's return is on (mirrors the server's `returnGroupQuery`):
 * finished = refunded / rejected / a failed QC whose payout was released or whose dispute was decided.
 */
export function returnGroupOfOrder(order) {
  const rs = order?.returnStatus;
  if (rs === "refund_completed" || rs === "return_rejected") return "completed";
  if (rs === "qc_failed" && (order?.returnQcPayoutReleasedAt || ["upheld", "overturned"].includes(order?.returnDispute?.status))) {
    return "completed";
  }
  return "active";
}

/** Does a return row belong under this pill? (the group itself is already decided by the server) */
export function returnMatchesView(view, ret) {
  if (!view || view.id === "all") return true;
  if (view.dispute) return ret?.returnDispute?.status === "open";
  if (Array.isArray(view.statuses)) return view.statuses.includes(ret?.returnStatus);
  return true;
}
