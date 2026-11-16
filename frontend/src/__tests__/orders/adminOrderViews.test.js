import {
  ORDER_VIEWS,
  RETURN_VIEWS,
  resolveOrdersView,
  legacyOrderRedirect,
  resolveReturnsView,
  returnMatchesView,
  returnGroupOfOrder,
  orderGroupTitle,
  returnGroupTitle,
} from "../../shared/utils/adminOrderViews.js";
import { adminRouteMatchesOrder } from "../../shared/utils/orderStatus.js";

const order = (over) => ({ workflowVersion: 2, returnStatus: "none", ...over });
const O = {
  new: order({ status: "pending", workflowStatus: "SELLER_PENDING" }),
  confirmed: order({ status: "confirmed", workflowStatus: "SELLER_ACCEPTED" }),
  packed: order({ status: "packed", workflowStatus: "PICKUP_READY" }),
  onTheWay: order({ status: "out_for_delivery", workflowStatus: "OUT_FOR_DELIVERY" }),
  delivered: order({ status: "delivered", workflowStatus: "DELIVERED" }),
  cancelled: order({ status: "cancelled", workflowStatus: "CANCELLED" }),
  returnRejected: order({ status: "delivered", workflowStatus: "DELIVERED", returnStatus: "return_rejected" }),
  returnRequested: order({ status: "delivered", workflowStatus: "DELIVERED", returnStatus: "return_requested" }),
  // the admin list maps any return in progress/finished to status "returned"
  returned: order({ status: "returned", workflowStatus: "DELIVERED", returnStatus: "refund_completed" }),
};
const names = (group) => Object.keys(O).filter((k) => adminRouteMatchesOrder(group, O[k])).sort();

describe("Orders pages: Active and Completed", () => {
  it("Active Orders = in progress and not in a return", () => {
    expect(names("active")).toEqual(["confirmed", "new", "onTheWay", "packed"]);
  });

  it("Completed Orders = delivered + cancelled; a rejected return comes back here", () => {
    expect(names("completed")).toEqual(["cancelled", "delivered", "returnRejected"]);
  });

  it("an order is never in both, and orders in a return are in neither", () => {
    const a = names("active");
    const c = names("completed");
    expect(a.filter((x) => c.includes(x))).toEqual([]);
    expect([...a, ...c]).not.toContain("returnRequested");
    expect([...a, ...c]).not.toContain("returned");
  });

  it("the pills filter inside a page the same way the old pages did", () => {
    expect(names("pending")).toEqual(["new"]);
    expect(names("processed")).toEqual(["confirmed", "packed"]);
    expect(names("out-for-delivery")).toEqual(["onTheWay"]);
    expect(names("delivered")).toEqual(["delivered", "returnRejected"]);
    expect(names("cancelled")).toEqual(["cancelled"]);
  });

  it("there are only two groups with the agreed pills", () => {
    expect(ORDER_VIEWS.active.map((v) => v.label)).toEqual(["All active", "New", "Being prepared", "On the way", "UPI approval"]);
    expect(ORDER_VIEWS.completed.map((v) => v.label)).toEqual(["All", "Delivered", "Cancelled"]);
    expect(orderGroupTitle("active")).toBe("Active Orders");
    expect(orderGroupTitle("completed")).toBe("Completed Orders");
  });

  it("a pill from the URL narrows the page; an unknown or wrong-group pill falls back to the group", () => {
    expect(resolveOrdersView("active", "pending")).toEqual({ group: "active", status: "pending" });
    expect(resolveOrdersView("active", "upi-pending")).toEqual({ group: "active", status: "upi-pending" });
    expect(resolveOrdersView("completed", "delivered")).toEqual({ group: "completed", status: "delivered" });
    expect(resolveOrdersView("active", "delivered")).toEqual({ group: "active", status: "active" });
    expect(resolveOrdersView("completed", "nonsense")).toEqual({ group: "completed", status: "completed" });
    expect(resolveOrdersView("anything", undefined)).toEqual({ group: "active", status: "active" });
  });
});

describe("old admin URLs still work (nothing breaks for bookmarks and old links)", () => {
  it.each([
    ["all", "/admin/orders/active"],
    ["pending", "/admin/orders/active?view=pending"],
    ["processed", "/admin/orders/active?view=processed"],
    ["out-for-delivery", "/admin/orders/active?view=out-for-delivery"],
    ["upi-pending", "/admin/orders/active?view=upi-pending"],
    ["delivered", "/admin/orders/completed?view=delivered"],
    ["cancelled", "/admin/orders/completed?view=cancelled"],
    ["returned", "/admin/returns/active"],
    ["something-unknown", "/admin/orders/active"],
  ])("/admin/orders/%s -> %s", (segment, target) => {
    expect(legacyOrderRedirect(segment)).toBe(target);
  });

  it("the new group names are not redirected", () => {
    expect(legacyOrderRedirect("active")).toBeNull();
    expect(legacyOrderRedirect("completed")).toBeNull();
  });

  it("every redirect lands on a pill that exists", () => {
    for (const seg of ["all", "pending", "processed", "out-for-delivery", "upi-pending", "delivered", "cancelled"]) {
      const url = new URL(legacyOrderRedirect(seg), "http://x");
      const group = url.pathname.split("/").pop();
      const view = url.searchParams.get("view");
      const { status } = resolveOrdersView(group, view);
      if (view) expect(status).toBe(view);
    }
  });
});

describe("Returns pages: Active and Completed", () => {
  const ret = (returnStatus, extra = {}) => ({ returnStatus, ...extra });

  it("two groups with the agreed pills", () => {
    expect(returnGroupTitle("active")).toBe("Active Returns");
    expect(returnGroupTitle("completed")).toBe("Completed Returns");
    expect(RETURN_VIEWS.active.map((v) => v.label)).toEqual(["All active", "Requested", "Pickup / In transit", "Quality check", "Disputes"]);
    expect(RETURN_VIEWS.completed.map((v) => v.label)).toEqual(["All", "Refunded", "Rejected", "QC failed (closed)"]);
  });

  it("each pill lists the right returns", () => {
    const view = (g, id) => resolveReturnsView(g, id).view;
    const inView = (g, id, r) => returnMatchesView(view(g, id), r);
    expect(inView("active", "requested", ret("return_requested"))).toBe(true);
    expect(inView("active", "requested", ret("returned"))).toBe(false);
    for (const s of ["return_approved", "return_pickup_assigned", "return_in_transit", "return_drop_pending"]) {
      expect(inView("active", "pickup", ret(s))).toBe(true);
    }
    for (const s of ["returned", "qc_passed", "qc_failed"]) expect(inView("active", "qc", ret(s))).toBe(true);
    expect(inView("active", "disputes", ret("qc_failed", { returnDispute: { status: "open" } }))).toBe(true);
    expect(inView("active", "disputes", ret("qc_failed", { returnDispute: { status: "none" } }))).toBe(false);
    expect(inView("completed", "refunded", ret("refund_completed"))).toBe(true);
    expect(inView("completed", "rejected", ret("return_rejected"))).toBe(true);
    expect(inView("completed", "qc-failed", ret("qc_failed"))).toBe(true);
    expect(inView("active", "all", ret("anything"))).toBe(true);
  });

  it("an unknown pill falls back to the group's first pill", () => {
    expect(resolveReturnsView("active", "zzz").view.id).toBe("all");
    expect(resolveReturnsView("completed", undefined).view.id).toBe("all");
  });

  it("which page an order's return is on (same rule as the server)", () => {
    expect(returnGroupOfOrder({ returnStatus: "return_requested" })).toBe("active");
    expect(returnGroupOfOrder({ returnStatus: "returned" })).toBe("active");
    expect(returnGroupOfOrder({ returnStatus: "qc_passed" })).toBe("active");
    expect(returnGroupOfOrder({ returnStatus: "qc_failed" })).toBe("active");
    expect(returnGroupOfOrder({ returnStatus: "qc_failed", returnDispute: { status: "open" } })).toBe("active");
    expect(returnGroupOfOrder({ returnStatus: "qc_failed", returnQcPayoutReleasedAt: "2026-11-01" })).toBe("completed");
    expect(returnGroupOfOrder({ returnStatus: "qc_failed", returnDispute: { status: "upheld" } })).toBe("completed");
    expect(returnGroupOfOrder({ returnStatus: "refund_completed" })).toBe("completed");
    expect(returnGroupOfOrder({ returnStatus: "return_rejected" })).toBe("completed");
  });
});
