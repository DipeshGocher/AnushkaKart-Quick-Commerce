import { jest } from "@jest/globals";
import axios from "axios";

const mockOrderFindOne = jest.fn();

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: { findOne: mockOrderFindOne, findById: jest.fn(), findByIdAndUpdate: jest.fn() },
}));
jest.unstable_mockModule("../app/models/customer.js", () => ({ default: { findById: jest.fn() } }));
jest.unstable_mockModule("../app/models/product.js", () => ({ default: { find: jest.fn() } }));

const mockApplyDeliveredSettlement = jest.fn().mockResolvedValue(true);
const mockCompensateOrderCancellation = jest.fn().mockResolvedValue(true);
const mockEmitOrderStatusUpdate = jest.fn();
const mockEmitNotificationEvent = jest.fn();

jest.unstable_mockModule("../app/services/orderSettlement.js", () => ({
  applyDeliveredSettlement: mockApplyDeliveredSettlement,
}));
jest.unstable_mockModule("../app/services/orderCompensation.js", () => ({
  compensateOrderCancellation: mockCompensateOrderCancellation,
}));
jest.unstable_mockModule("../app/services/orderSocketEmitter.js", () => ({
  emitOrderStatusUpdate: mockEmitOrderStatusUpdate,
}));
jest.unstable_mockModule("../app/modules/notifications/notification.emitter.js", () => ({
  emitNotificationEvent: mockEmitNotificationEvent,
}));
jest.unstable_mockModule("../app/services/cacheService.js", () => ({
  invalidate: jest.fn().mockResolvedValue(true),
  buildKey: (...args) => args.join(":"),
}));

const {
  processShiprocketWebhook,
  updateShiprocketManualStatus,
  cancelShiprocketShipmentForOrder,
} = await import("../app/services/shipping/shiprocketService.js");

/** A courier order as it looks right after the seller booked the shipment. */
function courierOrder(overrides = {}) {
  return {
    orderId: "ORD-FLOW-1",
    fulfillmentType: "SHIPROCKET",
    workflowVersion: 2,
    workflowStatus: "PICKUP_READY",
    status: "packed",
    orderStatus: "packed",
    customer: "CUST-1",
    seller: "SELLER-1",
    address: { city: "Indore" },
    shiprocket: {
      shipmentId: "123",
      shiprocketOrderId: "765",
      awb: "AWB1",
      courierName: "Shiprocket Courier Partner",
      currentStatus: "AWB_ASSIGNED",
      history: [],
    },
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const event = (current_status, extra = {}) => ({
  order_id: "ORD-FLOW-1",
  awb: "AWB1",
  current_status,
  location: "Some Hub",
  ...extra,
});

describe("Shiprocket status lifecycle (webhook)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("walks the whole courier path and keeps order status, workflow and shipment in sync", async () => {
    const order = courierOrder({ status: "confirmed", orderStatus: "confirmed", workflowStatus: "SELLER_ACCEPTED" });
    mockOrderFindOne.mockResolvedValue(order);

    // Pickup booked directly in Shiprocket -> seller side is done ("packed")
    let res = await processShiprocketWebhook(event("PICKUP SCHEDULED"));
    expect(res.success).toBe(true);
    expect(order.shiprocket.currentStatus).toBe("PICKUP_SCHEDULED");
    expect(order.status).toBe("packed");
    expect(order.workflowStatus).toBe("PICKUP_READY");
    expect(order.shiprocket.pickupScheduledAt).toBeInstanceOf(Date);

    // Courier takes the parcel; real courier name replaces our placeholder
    res = await processShiprocketWebhook(event("PICKED UP", { courier_name: "Blue Dart" }));
    expect(order.shiprocket.currentStatus).toBe("PICKED_UP");
    expect(order.shiprocket.courierName).toBe("Blue Dart");
    expect(order.shiprocket.shippedAt).toBeInstanceOf(Date);
    expect(order.status).toBe("packed");

    res = await processShiprocketWebhook(event("IN TRANSIT"));
    expect(order.shiprocket.currentStatus).toBe("IN_TRANSIT");

    res = await processShiprocketWebhook(event("OUT FOR DELIVERY"));
    expect(order.shiprocket.currentStatus).toBe("OUT_FOR_DELIVERY");
    expect(order.status).toBe("out_for_delivery");
    expect(order.orderStatus).toBe("out_for_delivery");
    expect(order.workflowStatus).toBe("OUT_FOR_DELIVERY");
    // Regression: this used to emit an `undefined` event name (wrong constant),
    // so couriers' "out for delivery" push never reached the customer.
    expect(mockEmitNotificationEvent).toHaveBeenCalledWith(
      "OUT_FOR_DELIVERY",
      expect.objectContaining({ orderId: "ORD-FLOW-1" }),
    );
    expect(mockEmitNotificationEvent.mock.calls.every(([name]) => typeof name === "string")).toBe(true);

    res = await processShiprocketWebhook(event("DELIVERED"));
    expect(order.shiprocket.currentStatus).toBe("DELIVERED");
    expect(order.status).toBe("delivered");
    expect(order.orderStatus).toBe("delivered");
    expect(order.workflowStatus).toBe("DELIVERED");
    expect(order.deliveredAt).toBeInstanceOf(Date);
    expect(mockApplyDeliveredSettlement).toHaveBeenCalledTimes(1);

    // Every applied event pushed a live update to the UIs (5 events).
    expect(mockEmitOrderStatusUpdate).toHaveBeenCalledTimes(5);
    expect(order.shiprocket.history.map((h) => h.status)).toEqual([
      "PICKUP_SCHEDULED",
      "PICKED_UP",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
    ]);
  });

  it("ignores a late IN TRANSIT after OUT FOR DELIVERY (no backwards move, no live update)", async () => {
    const order = courierOrder({ status: "out_for_delivery", workflowStatus: "OUT_FOR_DELIVERY" });
    order.shiprocket.currentStatus = "OUT_FOR_DELIVERY";
    mockOrderFindOne.mockResolvedValue(order);

    const res = await processShiprocketWebhook(event("IN TRANSIT"));

    expect(res).toEqual(expect.objectContaining({ success: true, ignored: true }));
    expect(order.status).toBe("out_for_delivery");
    expect(order.workflowStatus).toBe("OUT_FOR_DELIVERY");
    expect(order.shiprocket.currentStatus).toBe("OUT_FOR_DELIVERY");
    expect(order.shiprocket.history).toHaveLength(0);
    expect(order.save).not.toHaveBeenCalled();
    expect(mockEmitOrderStatusUpdate).not.toHaveBeenCalled();
  });

  it("never reopens a delivered order and never settles twice", async () => {
    const order = courierOrder({ status: "delivered", orderStatus: "delivered", workflowStatus: "DELIVERED" });
    order.shiprocket.currentStatus = "DELIVERED";
    mockOrderFindOne.mockResolvedValue(order);

    const dup = await processShiprocketWebhook(event("DELIVERED"));
    expect(dup.duplicate).toBe(true);

    const late = await processShiprocketWebhook(event("IN TRANSIT"));
    expect(late.ignored).toBe(true);

    expect(order.status).toBe("delivered");
    expect(order.workflowStatus).toBe("DELIVERED");
    expect(mockApplyDeliveredSettlement).not.toHaveBeenCalled();
    expect(mockCompensateOrderCancellation).not.toHaveBeenCalled();
  });

  it("still records a weight penalty that arrives on a stale event", async () => {
    const order = courierOrder({ status: "delivered", workflowStatus: "DELIVERED" });
    order.shiprocket.currentStatus = "DELIVERED";
    mockOrderFindOne.mockResolvedValue(order);

    const res = await processShiprocketWebhook(
      event("IN TRANSIT", { weight_discrepancy_amount: 60, discrepancy_reason: "Charged 1.5kg vs 1kg" }),
    );

    expect(res.ignored).toBe(true);
    expect(order.status).toBe("delivered");
    expect(order.shiprocket.weightDiscrepancyAmount).toBe(60);
    expect(order.save).toHaveBeenCalledTimes(1);
  });

  it("treats Shiprocket's 'CANCELED' spelling as a cancellation (refund flow runs once)", async () => {
    const order = courierOrder({ status: "confirmed", workflowStatus: "SELLER_ACCEPTED" });
    mockOrderFindOne.mockResolvedValue(order);

    await processShiprocketWebhook(event("CANCELED", { status_remarks: "Cancelled by seller on panel" }));

    expect(order.shiprocket.currentStatus).toBe("CANCELLED");
    expect(order.status).toBe("cancelled");
    expect(order.workflowStatus).toBe("CANCELLED");
    expect(mockCompensateOrderCancellation).toHaveBeenCalledTimes(1);
    expect(mockEmitNotificationEvent).toHaveBeenCalledWith(
      "ORDER_CANCELLED",
      expect.objectContaining({ orderId: "ORD-FLOW-1" }),
    );
  });

  it("return-to-origin: RTO INITIATED keeps order live, stale forward events are ignored, RTO DELIVERED cancels + refunds", async () => {
    const order = courierOrder({ status: "out_for_delivery", workflowStatus: "OUT_FOR_DELIVERY" });
    order.shiprocket.currentStatus = "OUT_FOR_DELIVERY";
    mockOrderFindOne.mockResolvedValue(order);

    await processShiprocketWebhook(event("RTO INITIATED"));
    expect(order.shiprocket.currentStatus).toBe("RTO_INITIATED");
    expect(order.status).toBe("out_for_delivery"); // not final yet
    expect(mockCompensateOrderCancellation).not.toHaveBeenCalled();

    const stale = await processShiprocketWebhook(event("IN TRANSIT"));
    expect(stale.ignored).toBe(true);
    expect(order.shiprocket.currentStatus).toBe("RTO_INITIATED");

    await processShiprocketWebhook(event("RTO DELIVERED"));
    expect(order.status).toBe("cancelled");
    expect(order.workflowStatus).toBe("CANCELLED");
    expect(mockCompensateOrderCancellation).toHaveBeenCalledTimes(1);
  });

  it("attaches a late-assigned AWB, tracking link and real courier name", async () => {
    const order = courierOrder({ status: "confirmed", workflowStatus: "SELLER_ACCEPTED" });
    order.shiprocket.awb = null;
    order.shiprocket.currentStatus = "NEW";
    mockOrderFindOne.mockResolvedValue(order);

    await processShiprocketWebhook({
      order_id: "ORD-FLOW-1",
      awb: "AWB-LATE",
      current_status: "AWB ASSIGNED",
      courier_name: "Delhivery",
      etd: "09 Nov 2026",
    });

    expect(order.shiprocket.awb).toBe("AWB-LATE");
    expect(order.shiprocket.trackingUrl).toBe("https://shiprocket.co/tracking/AWB-LATE");
    expect(order.shiprocket.courierName).toBe("Delhivery");
    expect(order.shiprocket.etd).toBe("09 Nov 2026");
  });

  it("rejects an event whose AWB does not belong to the order", async () => {
    mockOrderFindOne.mockResolvedValue(courierOrder());
    const res = await processShiprocketWebhook(event("IN TRANSIT", { awb: "SOMEONE-ELSE" }));
    expect(res.success).toBe(false);
  });
});

describe("Shiprocket manual status update (admin) obeys the same rules", () => {
  beforeEach(() => jest.clearAllMocks());

  it("refuses to re-deliver (would double-settle) or reopen a delivered order", async () => {
    const order = courierOrder({ status: "delivered", workflowStatus: "DELIVERED" });
    order.shiprocket.currentStatus = "DELIVERED";
    mockOrderFindOne.mockResolvedValue(order);

    await expect(updateShiprocketManualStatus("ORD-FLOW-1", { status: "DELIVERED" })).rejects.toMatchObject({ statusCode: 409 });
    await expect(updateShiprocketManualStatus("ORD-FLOW-1", { status: "IN_TRANSIT" })).rejects.toMatchObject({ statusCode: 409 });
    expect(mockApplyDeliveredSettlement).not.toHaveBeenCalled();
    expect(order.save).not.toHaveBeenCalled();
  });

  it("refuses to move the shipment backwards", async () => {
    const order = courierOrder({ status: "out_for_delivery", workflowStatus: "OUT_FOR_DELIVERY" });
    order.shiprocket.currentStatus = "OUT_FOR_DELIVERY";
    mockOrderFindOne.mockResolvedValue(order);

    await expect(updateShiprocketManualStatus("ORD-FLOW-1", { status: "IN_TRANSIT" })).rejects.toMatchObject({ statusCode: 409 });
    expect(order.status).toBe("out_for_delivery");
  });

  it("still allows normal forward and cancel updates", async () => {
    const order = courierOrder();
    mockOrderFindOne.mockResolvedValue(order);
    await updateShiprocketManualStatus("ORD-FLOW-1", { status: "OUT_FOR_DELIVERY" });
    expect(order.status).toBe("out_for_delivery");
    expect(order.shiprocket.currentStatus).toBe("OUT_FOR_DELIVERY");
  });
});

describe("cancelShiprocketShipmentForOrder (seller/admin cancels a courier order)", () => {
  const ENV_KEYS = ["SHIPROCKET_EMAIL", "SHIPROCKET_PASSWORD"];
  let saved;
  let post;

  beforeEach(() => {
    jest.clearAllMocks();
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  });
  afterEach(() => {
    if (post) post.mockRestore();
    post = null;
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  const goLive = () => {
    process.env.SHIPROCKET_EMAIL = "api@example.test";
    process.env.SHIPROCKET_PASSWORD = "test-password";
  };

  it.each(["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "RTO_INITIATED"])(
    "refuses once the courier has the parcel (%s) and never calls Shiprocket",
    async (currentStatus) => {
      post = jest.spyOn(axios, "post");
      const order = courierOrder();
      order.shiprocket.currentStatus = currentStatus;

      await expect(cancelShiprocketShipmentForOrder(order)).rejects.toMatchObject({ statusCode: 409 });
      expect(post).not.toHaveBeenCalled();
      expect(order.shiprocket.currentStatus).toBe(currentStatus);
      expect(order.save).not.toHaveBeenCalled();
    },
  );

  it("does nothing when no shipment was ever booked", async () => {
    const order = courierOrder({ shiprocket: { currentStatus: "NEW", history: [] } });
    const res = await cancelShiprocketShipmentForOrder(order);
    expect(res).toEqual({ cancelled: false, reason: "NO_SHIPMENT" });
    expect(order.save).not.toHaveBeenCalled();
  });

  it("marks a booked-but-not-picked-up shipment cancelled (dev/simulated mode)", async () => {
    const order = courierOrder();
    order.shiprocket.currentStatus = "PICKUP_SCHEDULED";

    const res = await cancelShiprocketShipmentForOrder(order);

    expect(res).toEqual({ cancelled: true, mode: "SIMULATED" });
    expect(order.shiprocket.currentStatus).toBe("CANCELLED");
    expect(order.shiprocket.history.at(-1)).toEqual(expect.objectContaining({ status: "CANCELLED" }));
    expect(order.save).toHaveBeenCalledTimes(1);
  });

  it("LIVE: cancels the AWB and the Shiprocket order before reporting success", async () => {
    goLive();
    post = jest.spyOn(axios, "post").mockImplementation(async (url) => {
      if (url.endsWith("/auth/login")) return { data: { token: "t" } };
      return { data: { message: "ok" } };
    });
    const order = courierOrder();

    const res = await cancelShiprocketShipmentForOrder(order);

    expect(res).toEqual({ cancelled: true, mode: "LIVE" });
    const awbCall = post.mock.calls.find(([u]) => u.endsWith("/orders/cancel/shipment/awbs"));
    const orderCall = post.mock.calls.find(([u]) => u.endsWith("/orders/cancel"));
    expect(awbCall[1]).toEqual({ awbs: ["AWB1"] });
    expect(orderCall[1]).toEqual({ ids: [765] });
    expect(order.shiprocket.currentStatus).toBe("CANCELLED");
  });

  it("LIVE: if Shiprocket refuses, throws and leaves the order untouched so it is NOT cancelled/refunded", async () => {
    goLive();
    post = jest.spyOn(axios, "post").mockImplementation(async (url) => {
      if (url.endsWith("/auth/login")) return { data: { token: "t" } };
      const err = new Error("Request failed");
      err.response = { data: { message: "Shipment cannot be cancelled" } };
      throw err;
    });
    const order = courierOrder();

    await expect(cancelShiprocketShipmentForOrder(order)).rejects.toMatchObject({
      statusCode: 502,
      message: expect.stringContaining("Shipment cannot be cancelled"),
    });
    expect(order.shiprocket.currentStatus).toBe("AWB_ASSIGNED");
    expect(order.save).not.toHaveBeenCalled();
  });

  it("LIVE: AWB cancelled but order-close call fails -> still cancelled (shipment is already dead)", async () => {
    goLive();
    post = jest.spyOn(axios, "post").mockImplementation(async (url) => {
      if (url.endsWith("/auth/login")) return { data: { token: "t" } };
      if (url.endsWith("/orders/cancel")) throw new Error("already closed");
      return { data: {} };
    });
    const order = courierOrder();

    const res = await cancelShiprocketShipmentForOrder(order);
    expect(res.cancelled).toBe(true);
    expect(order.shiprocket.currentStatus).toBe("CANCELLED");
  });

  it("a later Shiprocket CANCELED webhook for the same order is a harmless duplicate", async () => {
    const order = courierOrder();
    await cancelShiprocketShipmentForOrder(order);
    // Seller flow then marks the order itself cancelled.
    order.status = "cancelled";
    order.orderStatus = "cancelled";
    mockOrderFindOne.mockResolvedValue(order);

    const res = await processShiprocketWebhook(event("CANCELED"));
    expect(res.duplicate).toBe(true);
    expect(mockCompensateOrderCancellation).not.toHaveBeenCalled(); // no double refund
  });
});
