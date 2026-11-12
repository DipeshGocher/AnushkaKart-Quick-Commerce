import {
  getLegacyStatusFromOrder,
  getStageLabel,
  getOrderStatusLabel,
  getStatusOptions,
  canCancelOrder,
  courierHasParcel,
  normalizeShipmentStatus,
  adminRouteMatchesOrder,
} from "../../shared/utils/orderStatus.js";

/**
 * One table drives every panel. If seller, admin and customer views ever
 * disagree about a stage, these tests fail.
 */
const base = { workflowVersion: 2 };
const local = (status, workflowStatus, extra = {}) => ({ ...base, fulfillmentType: "LOCAL", status, workflowStatus, ...extra });
const courier = (status, workflowStatus, srStatus, extra = {}) => ({
  ...base,
  fulfillmentType: "SHIPROCKET",
  status,
  workflowStatus,
  shiprocket: { currentStatus: srStatus, ...(extra.shiprocket || {}) },
  ...extra,
});

const values = (opts) => opts.map((o) => o.value);

describe("Local rider delivery - one stage, same everywhere", () => {
  const packedAt = new Date().toISOString();
  const rows = [
    // [name, order, bucket, label, sellerOptions, adminOptions]
    ["placed", local("pending", "SELLER_PENDING"), "pending", "Pending", ["pending", "confirmed", "cancelled"], ["pending", "confirmed", "cancelled"]],
    ["accepted, no rider yet", local("confirmed", "DELIVERY_SEARCH"), "confirmed", "Confirmed", ["confirmed", "packed", "cancelled"], ["confirmed", "packed", "out_for_delivery", "cancelled"]],
    ["packed BEFORE a rider is found", local("packed", "DELIVERY_SEARCH", { pickupReadyAt: packedAt }), "packed", "Packed", ["packed", "cancelled"], ["packed", "out_for_delivery", "delivered", "cancelled"]],
    ["rider assigned", local("confirmed", "DELIVERY_ASSIGNED"), "confirmed", "Confirmed", ["confirmed", "packed"], ["confirmed", "packed", "out_for_delivery", "cancelled"]],
    ["rider assigned + packed", local("packed", "DELIVERY_ASSIGNED", { pickupReadyAt: packedAt }), "packed", "Packed", ["packed"], ["packed", "out_for_delivery", "delivered", "cancelled"]],
    ["rider at store (pickup ready)", local("packed", "PICKUP_READY", { pickupReadyAt: packedAt }), "packed", "Packed", ["packed"], ["packed", "out_for_delivery", "delivered", "cancelled"]],
    ["out for delivery", local("out_for_delivery", "OUT_FOR_DELIVERY"), "out_for_delivery", "Out for delivery", ["out_for_delivery"], ["out_for_delivery", "delivered", "cancelled"]],
    ["delivered", local("delivered", "DELIVERED"), "delivered", "Delivered", ["delivered"], ["delivered"]],
    ["cancelled", local("cancelled", "CANCELLED"), "cancelled", "Cancelled", ["cancelled"], ["cancelled"]],
  ];

  it.each(rows)("%s", (_name, order, bucket, label, sellerOpts, adminOpts) => {
    expect(getLegacyStatusFromOrder(order)).toBe(bucket);
    expect(getStageLabel(order)).toBe(label);
    expect(getOrderStatusLabel(order)).toBe(label); // customer-facing label is identical
    expect(values(getStatusOptions(order, "seller"))).toEqual(sellerOpts);
    expect(values(getStatusOptions(order, "admin"))).toEqual(adminOpts);
  });

  it("the first option is always the current stage, so a <select> value always matches", () => {
    for (const [, order, bucket] of rows) {
      expect(getStatusOptions(order, "seller")[0].value).toBe(bucket);
      expect(getStatusOptions(order, "admin")[0].value).toBe(bucket);
    }
  });

  it("a seller can cancel only until a rider is assigned; admin any time before delivery", () => {
    expect(canCancelOrder(local("confirmed", "DELIVERY_SEARCH"), "seller")).toBe(true);
    expect(canCancelOrder(local("packed", "DELIVERY_SEARCH", { pickupReadyAt: "x" }), "seller")).toBe(true);
    expect(canCancelOrder(local("confirmed", "DELIVERY_ASSIGNED"), "seller")).toBe(false);
    expect(canCancelOrder(local("packed", "PICKUP_READY"), "seller")).toBe(false);
    expect(canCancelOrder(local("out_for_delivery", "OUT_FOR_DELIVERY"), "seller")).toBe(false);
    expect(canCancelOrder(local("out_for_delivery", "OUT_FOR_DELIVERY"), "admin")).toBe(true);
    expect(canCancelOrder(local("delivered", "DELIVERED"), "admin")).toBe(false);
  });

  it("forcing a rider-owned step is admin-only and flagged as needing a reason", () => {
    const adminOpts = getStatusOptions(local("confirmed", "DELIVERY_ASSIGNED"), "admin");
    expect(adminOpts.find((o) => o.value === "out_for_delivery").overrideReasonRequired).toBe(true);
    expect(getStatusOptions(local("confirmed", "DELIVERY_ASSIGNED"), "seller").some((o) => o.overrideReasonRequired)).toBe(false);
  });

  it("the packed flag shows up in the admin sidebar buckets too", () => {
    const o = local("packed", "DELIVERY_SEARCH", { pickupReadyAt: "x" });
    expect(adminRouteMatchesOrder("processed", o)).toBe(true);
    expect(adminRouteMatchesOrder("pending", o)).toBe(false);
  });

  it("legacy (v1) orders keep working", () => {
    const v1 = { fulfillmentType: "LOCAL", status: "packed" };
    expect(getLegacyStatusFromOrder(v1)).toBe("packed");
    expect(getStageLabel(v1)).toBe("Packed");
    expect(values(getStatusOptions(v1, "seller"))).toEqual(["packed", "cancelled"]);
  });
});

describe("Courier (Shiprocket) delivery - one stage, same everywhere", () => {
  const rows = [
    ["placed", courier("pending", "SELLER_PENDING", "NEW"), "pending", "Pending", ["pending", "confirmed", "cancelled"], ["pending", "confirmed", "cancelled"]],
    ["accepted, shipment not booked", courier("confirmed", "SELLER_ACCEPTED", "NEW"), "confirmed", "Confirmed", ["confirmed", "packed", "cancelled"], ["confirmed", "packed", "cancelled"]],
    ["shipment booked (AWB)", courier("confirmed", "SELLER_ACCEPTED", "AWB_ASSIGNED"), "confirmed", "Confirmed", ["confirmed", "packed", "cancelled"], ["confirmed", "packed", "cancelled"]],
    ["pickup scheduled", courier("packed", "PICKUP_READY", "PICKUP_SCHEDULED"), "packed", "Packed", ["packed", "cancelled"], ["packed", "cancelled"]],
    ["courier picked up / in transit", courier("packed", "PICKUP_READY", "IN_TRANSIT"), "packed", "Shipped", ["packed"], ["packed"]],
    ["out for delivery", courier("out_for_delivery", "OUT_FOR_DELIVERY", "OUT_FOR_DELIVERY"), "out_for_delivery", "Out for delivery", ["out_for_delivery"], ["out_for_delivery"]],
    ["delivered", courier("delivered", "DELIVERED", "DELIVERED"), "delivered", "Delivered", ["delivered"], ["delivered"]],
    ["cancelled", courier("cancelled", "CANCELLED", "CANCELLED"), "cancelled", "Cancelled", ["cancelled"], ["cancelled"]],
  ];

  it.each(rows)("%s", (_name, order, bucket, label, sellerOpts, adminOpts) => {
    expect(getLegacyStatusFromOrder(order)).toBe(bucket);
    expect(getStageLabel(order)).toBe(label);
    expect(getOrderStatusLabel(order)).toBe(label);
    expect(values(getStatusOptions(order, "seller"))).toEqual(sellerOpts);
    expect(values(getStatusOptions(order, "admin"))).toEqual(adminOpts);
  });

  it("'packed' for a courier order is labelled as booking the shipment", () => {
    const opts = getStatusOptions(courier("confirmed", "SELLER_ACCEPTED", "NEW"), "seller");
    expect(opts.find((o) => o.value === "packed").label).toBe("Pack & Create Shipment");
  });

  it("nobody is offered out_for_delivery / delivered for a courier order (Shiprocket tracking owns them)", () => {
    for (const [, order] of rows) {
      for (const role of ["seller", "admin"]) {
        const vals = values(getStatusOptions(order, role));
        const bucket = getLegacyStatusFromOrder(order);
        const extra = vals.filter((v) => v !== bucket);
        expect(extra).not.toContain("out_for_delivery");
        expect(extra).not.toContain("delivered");
      }
    }
  });

  it("cannot cancel once the courier has the parcel (any spelling of the status)", () => {
    for (const sr of ["PICKED_UP", "IN_TRANSIT", "IN TRANSIT", "OUT_FOR_DELIVERY", "UNDELIVERED", "RTO_INITIATED", "RTO INITIATED"]) {
      const order = courier("packed", "PICKUP_READY", sr);
      expect(courierHasParcel(order)).toBe(true);
      expect(canCancelOrder(order, "seller")).toBe(false);
      expect(canCancelOrder(order, "admin")).toBe(false);
    }
    for (const sr of ["NEW", "AWB_ASSIGNED", "PICKUP_SCHEDULED"]) {
      expect(canCancelOrder(courier("packed", "PICKUP_READY", sr), "seller")).toBe(true);
    }
  });

  it("stored spelling does not matter: 'IN TRANSIT' (old data) still reads as Shipped", () => {
    expect(getStageLabel(courier("packed", "PICKUP_READY", "IN TRANSIT"))).toBe("Shipped");
    expect(getStageLabel(courier("packed", "PICKUP_READY", "PICKED UP"))).toBe("Shipped");
  });

  it("shows return-to-origin and failed attempts instead of a stale status", () => {
    expect(getStageLabel(courier("out_for_delivery", "OUT_FOR_DELIVERY", "RTO_INITIATED"))).toBe("Returning to seller");
    expect(getStageLabel(courier("out_for_delivery", "OUT_FOR_DELIVERY", "UNDELIVERED"))).toBe("Delivery attempt failed");
  });

  it("the customer-sanitised order (normalised status, no secrets) gives the same label as the raw admin order", () => {
    const rawAdmin = courier("packed", "PICKUP_READY", "IN TRANSIT", { shiprocket: { currentStatus: "IN TRANSIT", labelUrl: "x", shipmentId: "1" } });
    const customerView = { ...rawAdmin, shiprocket: { currentStatus: "IN_TRANSIT", awb: "A1" } };
    expect(getStageLabel(customerView)).toBe(getStageLabel(rawAdmin));
  });

  it("a returned/refunded order still reads as its return state", () => {
    expect(getOrderStatusLabel({ ...courier("delivered", "DELIVERED", "DELIVERED"), returnStatus: "refund_completed" })).toBe("Returned & Refunded");
  });
});

describe("normalizeShipmentStatus mirrors the backend", () => {
  it.each([
    ["IN TRANSIT", "IN_TRANSIT"],
    ["Out For Delivery", "OUT_FOR_DELIVERY"],
    ["CANCELED", "CANCELLED"],
    [undefined, ""],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeShipmentStatus(raw)).toBe(expected);
  });
});
