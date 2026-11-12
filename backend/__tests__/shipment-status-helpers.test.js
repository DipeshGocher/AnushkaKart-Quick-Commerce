import {
  normalizeShipmentStatus,
  outOfOrderReason,
  courierHasParcel,
  assertShipmentCancellable,
  isInTransitStatus,
  isPickupScheduledStatus,
} from "../app/services/shipping/shipmentStatus.js";
import {
  buildCustomerShiprocket,
  sanitizeOrderForCustomer,
  customerStatusLabel,
} from "../app/utils/customerShipmentView.js";

describe("normalizeShipmentStatus", () => {
  it.each([
    ["IN TRANSIT", "IN_TRANSIT"],
    ["in-transit", "IN_TRANSIT"],
    ["Out For Delivery", "OUT_FOR_DELIVERY"],
    ["PICKED UP", "PICKED_UP"],
    ["RTO INITIATED", "RTO_INITIATED"],
    // Shiprocket spells it with one L; we must treat it as CANCELLED.
    ["CANCELED", "CANCELLED"],
    ["Canceled", "CANCELLED"],
    ["CANCELLED", "CANCELLED"],
    ["", ""],
    [undefined, ""],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeShipmentStatus(raw)).toBe(expected);
  });
});

describe("outOfOrderReason (forward-only guard)", () => {
  const order = (status, currentStatus, extra = {}) => ({
    status,
    shiprocket: { currentStatus, ...extra },
  });

  it("allows the normal forward path step by step", () => {
    const path = ["AWB_ASSIGNED", "PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
    for (let i = 1; i < path.length; i += 1) {
      expect(outOfOrderReason(order("packed", path[i - 1]), path[i])).toBeNull();
    }
  });

  it("allows skipping steps forward (courier events can be missed)", () => {
    expect(outOfOrderReason(order("confirmed", "AWB_ASSIGNED"), "DELIVERED")).toBeNull();
    expect(outOfOrderReason(order("packed", "PICKUP_SCHEDULED"), "OUT_FOR_DELIVERY")).toBeNull();
  });

  it("ignores a late IN_TRANSIT after OUT_FOR_DELIVERY", () => {
    expect(outOfOrderReason(order("out_for_delivery", "OUT_FOR_DELIVERY"), "IN_TRANSIT")).toMatch(/stale/);
  });

  it("ignores any event on a delivered or cancelled order", () => {
    expect(outOfOrderReason(order("delivered", "DELIVERED"), "IN_TRANSIT")).toMatch(/already delivered/);
    expect(outOfOrderReason(order("cancelled", "CANCELLED"), "OUT_FOR_DELIVERY")).toMatch(/already cancelled/);
    expect(outOfOrderReason(order("delivered", "DELIVERED"), "RTO_INITIATED")).toMatch(/already delivered/);
  });

  it("flags an exact repeat of a terminal event as a duplicate", () => {
    expect(outOfOrderReason(order("delivered", "DELIVERED"), "DELIVERED")).toBe("duplicate");
    expect(outOfOrderReason(order("cancelled", "CANCELLED"), "CANCELLED")).toBe("duplicate");
  });

  it("does not treat forward-path events as valid once the shipment is returning (RTO)", () => {
    expect(outOfOrderReason(order("out_for_delivery", "RTO_INITIATED"), "IN_TRANSIT")).toMatch(/returning/);
    // RTO progression itself is fine.
    expect(outOfOrderReason(order("out_for_delivery", "RTO_INITIATED"), "RTO_DELIVERED")).toBeNull();
  });

  it("allows a re-attempt after a failed delivery (UNDELIVERED -> OUT_FOR_DELIVERY)", () => {
    expect(outOfOrderReason(order("out_for_delivery", "UNDELIVERED"), "OUT_FOR_DELIVERY")).toBeNull();
  });

  it("allows cancel at any live stage", () => {
    expect(outOfOrderReason(order("confirmed", "AWB_ASSIGNED"), "CANCELLED")).toBeNull();
  });

  it("works when stored status used a space (older webhook data)", () => {
    expect(outOfOrderReason(order("packed", "OUT FOR DELIVERY"), "IN_TRANSIT")).toMatch(/stale/);
  });
});

describe("courierHasParcel / assertShipmentCancellable", () => {
  it.each(["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "UNDELIVERED", "RTO_INITIATED", "IN TRANSIT"])(
    "%s means the courier has the parcel",
    (currentStatus) => {
      expect(courierHasParcel({ currentStatus })).toBe(true);
      expect(() => assertShipmentCancellable({ shiprocket: { currentStatus } })).toThrow(/already picked up/);
    },
  );

  it.each([undefined, "NEW", "AWB_ASSIGNED", "PICKUP_SCHEDULED"])(
    "%s is still cancellable (courier does not hold the parcel)",
    (currentStatus) => {
      expect(courierHasParcel({ currentStatus })).toBe(false);
      expect(() => assertShipmentCancellable({ shiprocket: { currentStatus } })).not.toThrow();
    },
  );

  it("treats shippedAt as proof the parcel left", () => {
    expect(courierHasParcel({ currentStatus: "AWB_ASSIGNED", shippedAt: new Date() })).toBe(true);
  });

  it("refusal carries HTTP 409", () => {
    try {
      assertShipmentCancellable({ shiprocket: { currentStatus: "IN_TRANSIT" } });
    } catch (e) {
      expect(e.statusCode).toBe(409);
    }
  });
});

describe("status classifiers", () => {
  it("groups courier states", () => {
    expect(isInTransitStatus("PICKED_UP")).toBe(true);
    expect(isInTransitStatus("SHIPPED")).toBe(true);
    expect(isInTransitStatus("OUT_FOR_DELIVERY")).toBe(false);
    expect(isPickupScheduledStatus("PICKUP_SCHEDULED")).toBe(true);
    expect(isPickupScheduledStatus("PICKED_UP")).toBe(false);
  });
});

describe("customer-safe shipment view", () => {
  const raw = {
    shipmentId: "S1",
    shiprocketOrderId: "SO1",
    awb: "AWB1",
    courierName: "Blue Dart",
    labelUrl: "https://x/label",
    manifestUrl: "https://x/manifest",
    currentStatus: "IN TRANSIT",
    weightDiscrepancyAmount: 80,
    history: [
      { status: "NEW", remarks: "Order created for Shiprocket fulfillment", source: "system" },
      { status: "AWB_ASSIGNED", location: "Indore", source: "api" },
      { status: "IN TRANSIT", location: "Jaipur Hub", remarks: "internal", source: "webhook" },
      { status: "WEIGHT_DISCREPANCY", remarks: "₹80 deducted from seller", source: "webhook" },
    ],
  };

  it("exposes only customer-needed fields", () => {
    const view = buildCustomerShiprocket(raw);
    expect(view).toEqual(
      expect.objectContaining({
        awb: "AWB1",
        courierName: "Blue Dart",
        trackingUrl: "https://shiprocket.co/tracking/AWB1",
        currentStatus: "IN_TRANSIT",
        statusLabel: "In transit",
      }),
    );
    for (const secret of ["shipmentId", "shiprocketOrderId", "labelUrl", "manifestUrl", "weightDiscrepancyAmount"]) {
      expect(view).not.toHaveProperty(secret);
    }
  });

  it("hides internal history, remarks and our own placeholder locations", () => {
    const { history } = buildCustomerShiprocket(raw);
    expect(history.map((h) => h.status)).toEqual(["Shipment booked", "In transit"]);
    expect(history[0].location).toBe(""); // api/system location is the customer's own city
    expect(history[1].location).toBe("Jaipur Hub"); // courier scan location is real
    expect(JSON.stringify(history)).not.toMatch(/Shiprocket fulfillment|deducted|internal/);
  });

  it("shows nothing before a courier is assigned", () => {
    const view = buildCustomerShiprocket({
      currentStatus: "NEW",
      courierName: "Shiprocket Courier Partner",
      history: [{ status: "NEW", source: "system" }],
    });
    expect(view.awb).toBeNull();
    expect(view.courierName).toBeNull();
    expect(view.trackingUrl).toBeNull();
    expect(view.currentStatus).toBeNull();
    expect(view.history).toEqual([]);
  });

  it("labels courier statuses in customer language", () => {
    expect(customerStatusLabel("OUT FOR DELIVERY")).toBe("Out for delivery");
    expect(customerStatusLabel("RTO INITIATED")).toBe("Returning to seller");
    expect(customerStatusLabel("CANCELED")).toBe("Cancelled");
    expect(customerStatusLabel("NEW")).toBeNull();
  });

  it("strips seller private details for courier orders but keeps local-order seller data", () => {
    const courier = sanitizeOrderForCustomer({
      fulfillmentType: "SHIPROCKET",
      shiprocket: raw,
      seller: { _id: "s", shopName: "Harsh's Hub", address: "Corp House", phone: "99", location: {} },
    });
    expect(courier.seller).toEqual({ _id: "s", shopName: "Harsh's Hub", name: undefined });

    const local = sanitizeOrderForCustomer({
      fulfillmentType: "LOCAL",
      shiprocket: { currentStatus: "PENDING_DISPATCH" },
      seller: { _id: "s", shopName: "Store", address: "Main St", location: { coordinates: [1, 2] } },
    });
    expect(local.seller.address).toBe("Main St"); // live-tracking map needs it
    expect(local).not.toHaveProperty("shiprocket");
  });

  it("leaves bare ObjectId references alone", () => {
    const ref = { _bsontype: "ObjectId", toString: () => "abc" };
    const out = sanitizeOrderForCustomer({ fulfillmentType: "SHIPROCKET", seller: ref, shiprocket: null });
    expect(out.seller).toBe(ref);
  });
});
