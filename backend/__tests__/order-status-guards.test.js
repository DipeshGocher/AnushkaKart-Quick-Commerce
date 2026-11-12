import { jest } from "@jest/globals";

const mockOrderFindOne = jest.fn();
const mockHandleResponse = jest.fn();
const mockProcessShiprocketOrder = jest.fn();
const mockCancelShiprocketShipment = jest.fn();
const mockSellerRejectAtomic = jest.fn();
const mockSellerAcceptAtomic = jest.fn();
const mockCompensate = jest.fn().mockResolvedValue(true);
const mockEmitOrderStatusUpdate = jest.fn();
const mockEmitNotificationEvent = jest.fn();
const mockApplyDeliveredSettlement = jest.fn().mockResolvedValue(true);
const mockProductUpdate = jest.fn().mockResolvedValue({});

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: { findOne: mockOrderFindOne, findById: jest.fn() },
}));
jest.unstable_mockModule("../app/models/cart.js", () => ({ default: {} }));
jest.unstable_mockModule("../app/models/product.js", () => ({ default: { findByIdAndUpdate: mockProductUpdate } }));
jest.unstable_mockModule("../app/models/transaction.js", () => ({ default: { findOneAndUpdate: jest.fn() } }));
jest.unstable_mockModule("../app/models/stockHistory.js", () => ({ default: { create: jest.fn() } }));
jest.unstable_mockModule("../app/models/notification.js", () => ({ default: {} }));
jest.unstable_mockModule("../app/models/seller.js", () => ({ default: {} }));
jest.unstable_mockModule("../app/models/delivery.js", () => ({ default: {} }));
jest.unstable_mockModule("../app/models/setting.js", () => ({ default: {} }));
jest.unstable_mockModule("../app/models/customer.js", () => ({ default: {} }));

jest.unstable_mockModule("../app/services/orderSettlement.js", () => ({
  applyDeliveredSettlement: mockApplyDeliveredSettlement,
}));
jest.unstable_mockModule("../app/services/orderCompensation.js", () => ({
  compensateOrderCancellation: mockCompensate,
}));
jest.unstable_mockModule("../app/utils/orderLookup.js", () => ({
  orderMatchQueryFromRouteParam: (id) => ({ orderId: id }),
  orderMatchQueryFlexible: jest.fn(),
}));
jest.unstable_mockModule("../app/utils/helper.js", () => ({ default: mockHandleResponse }));
jest.unstable_mockModule("../app/utils/pagination.js", () => ({ default: jest.fn() }));
jest.unstable_mockModule("../app/services/orderWorkflowService.js", () => ({
  afterPlaceOrderV2: jest.fn(),
  sellerAcceptAtomic: mockSellerAcceptAtomic,
  sellerRejectAtomic: mockSellerRejectAtomic,
  deliveryAcceptAtomic: jest.fn(),
  customerCancelV2: jest.fn(),
  resolveWorkflowStatus: jest.fn(),
  startReturnPickupBroadcast: jest.fn(),
  removeReturnPickupTimeoutJob: jest.fn(),
}));
jest.unstable_mockModule("../app/services/finance/orderFinanceService.js", () => ({
  freezeFinancialSnapshot: jest.fn((o) => o),
  reverseOrderFinanceOnCancellation: jest.fn(),
}));
jest.unstable_mockModule("../app/utils/geoUtils.js", () => ({ distanceMeters: jest.fn() }));
jest.unstable_mockModule("../app/services/orderSocketEmitter.js", () => ({
  emitDeliveryBroadcastForSeller: jest.fn(),
  retractDeliveryBroadcastForOrder: jest.fn(),
  emitToSeller: jest.fn(),
  emitToDelivery: jest.fn(),
  emitToCustomer: jest.fn(),
  emitToOrder: jest.fn(),
  emitReturnBroadcastForCustomer: jest.fn(),
  emitOrderStatusUpdate: mockEmitOrderStatusUpdate,
}));
jest.unstable_mockModule("../app/modules/notifications/notification.emitter.js", () => ({
  emitNotificationEvent: mockEmitNotificationEvent,
}));
jest.unstable_mockModule("../app/services/cacheService.js", () => ({
  invalidate: jest.fn().mockResolvedValue(true),
  buildKey: (...a) => a.join(":"),
  getOrSet: jest.fn(async (_key, loader) => loader()),
  getTTL: () => 0,
}));
jest.unstable_mockModule("../app/services/seller/sellerStatsService.js", () => ({
  invalidateSellerStatsCache: jest.fn().mockResolvedValue(true),
}));
jest.unstable_mockModule("../app/services/shipping/shiprocketService.js", () => ({
  processShiprocketOrder: mockProcessShiprocketOrder,
  cancelShiprocketShipmentForOrder: mockCancelShiprocketShipment,
  // other modules in the import graph pull these named exports
  calculateShiprocketLiveRate: jest.fn(),
  createShiprocketReversePickup: jest.fn(),
  syncSellerPickupLocationToShiprocket: jest.fn(),
}));

const { updateOrderStatus } = await import("../app/controller/orderController.js");

const reply = (_res, status, message, data) => ({ status, message, data });

function localOrder(overrides = {}) {
  return {
    _id: "m1",
    orderId: "ORD-L",
    fulfillmentType: "LOCAL",
    workflowVersion: 2,
    workflowStatus: "DELIVERY_SEARCH",
    status: "confirmed",
    orderStatus: "confirmed",
    seller: "seller-1",
    customer: "cust-1",
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function courierOrder(overrides = {}) {
  return {
    _id: "m2",
    orderId: "ORD-C",
    fulfillmentType: "SHIPROCKET",
    workflowVersion: 2,
    workflowStatus: "SELLER_ACCEPTED",
    status: "confirmed",
    orderStatus: "confirmed",
    seller: "seller-1",
    customer: "cust-1",
    items: [],
    shiprocket: { currentStatus: "NEW", history: [] },
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const call = (order, body, user) => {
  mockOrderFindOne.mockResolvedValue(order);
  return updateOrderStatus({ params: { orderId: order.orderId }, body, user }, {});
};
const seller = { id: "seller-1", role: "seller" };
const admin = { id: "admin-1", role: "admin" };

describe("updateOrderStatus - local rider orders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleResponse.mockImplementation(reply);
  });

  it("seller 'packed' BEFORE a rider is found only sets the packed flag; the order stays in rider search", async () => {
    const order = localOrder({ workflowStatus: "DELIVERY_SEARCH" });

    const res = await call(order, { status: "packed" }, seller);

    expect(res.status).toBe(200);
    expect(order.status).toBe("packed");
    expect(order.orderStatus).toBe("packed");
    expect(order.pickupReadyAt).toBeInstanceOf(Date);
    // Regression: this used to jump to PICKUP_READY with no rider -> order stuck.
    expect(order.workflowStatus).toBe("DELIVERY_SEARCH");
    // live update carries the flag so every open screen shows "Packed"
    expect(mockEmitOrderStatusUpdate).toHaveBeenCalledWith(
      "ORD-L",
      expect.objectContaining({ status: "packed", workflowStatus: "DELIVERY_SEARCH", pickupReadyAt: order.pickupReadyAt }),
      "cust-1",
    );
  });

  it.each(["SELLER_ACCEPTED", "DELIVERY_ASSIGNED"])(
    "seller 'packed' while %s keeps the rider workflow untouched",
    async (workflowStatus) => {
      const order = localOrder({ workflowStatus });
      await call(order, { status: "packed" }, seller);
      expect(order.status).toBe("packed");
      expect(order.workflowStatus).toBe(workflowStatus);
      expect(order.pickupReadyAt).toBeInstanceOf(Date);
    },
  );

  it("normalises status case ('Packed') instead of writing an invalid enum value", async () => {
    const order = localOrder();
    await call(order, { status: "Packed" }, seller);
    expect(order.status).toBe("packed");
  });

  it("a seller cannot mark someone else's order", async () => {
    const order = localOrder({ seller: "other-seller" });
    const res = await call(order, { status: "packed" }, seller);
    expect(res.status).toBe(403);
    expect(order.save).not.toHaveBeenCalled();
  });

  it("a seller can never set out_for_delivery / delivered", async () => {
    const order = localOrder({ status: "packed" });
    expect((await call(order, { status: "out_for_delivery" }, seller)).status).toBe(403);
    expect((await call(order, { status: "delivered" }, seller)).status).toBe(403);
    expect(order.save).not.toHaveBeenCalled();
  });

  it("admin must give a reason to force a rider-owned step, and it is applied once given", async () => {
    const order = localOrder({ status: "packed", workflowStatus: "DELIVERY_ASSIGNED" });

    const denied = await call(order, { status: "out_for_delivery" }, admin);
    expect(denied.status).toBe(400);
    expect(order.status).toBe("packed");

    const ok = await call(order, { status: "out_for_delivery", overrideReason: "Rider phone dead, confirmed by call" }, admin);
    expect(ok.status).toBe(200);
    expect(order.status).toBe("out_for_delivery");
    expect(order.workflowStatus).toBe("OUT_FOR_DELIVERY");
  });

  it("rejects moving backwards and moving out of delivered", async () => {
    const delivered = localOrder({ status: "delivered", workflowStatus: "DELIVERED" });
    expect((await call(delivered, { status: "packed" }, admin)).status).toBe(400);

    const out = localOrder({ status: "out_for_delivery", workflowStatus: "OUT_FOR_DELIVERY" });
    expect((await call(out, { status: "packed" }, admin)).status).toBe(400);
  });
});

describe("updateOrderStatus - courier (Shiprocket) orders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleResponse.mockImplementation(reply);
    mockProcessShiprocketOrder.mockResolvedValue({ success: true });
    mockCancelShiprocketShipment.mockResolvedValue({ cancelled: true });
  });

  it("'packed' books the shipment first (so 'packed' always means there is something to hand over)", async () => {
    const order = courierOrder();

    const res = await call(order, { status: "packed" }, seller);

    expect(res.status).toBe(200);
    expect(mockProcessShiprocketOrder).toHaveBeenCalledWith(order);
    expect(order.status).toBe("packed");
    expect(order.workflowStatus).toBe("PICKUP_READY");
    expect(order.pickupReadyAt).toBeInstanceOf(Date);
    // Regression: used to fabricate AWB_ASSIGNED with no shipment/AWB.
    expect(order.shiprocket.currentStatus).toBe("NEW");
  });

  it("does not re-book a shipment that already exists", async () => {
    const order = courierOrder({
      shiprocket: { shipmentId: "123", awb: "AWB1", currentStatus: "AWB_ASSIGNED", history: [] },
    });
    await call(order, { status: "packed" }, seller);
    expect(mockProcessShiprocketOrder).not.toHaveBeenCalled();
    expect(order.status).toBe("packed");
  });

  it("if booking the shipment fails the order is NOT marked packed", async () => {
    const order = courierOrder();
    mockProcessShiprocketOrder.mockRejectedValue(Object.assign(new Error("Shiprocket Error: pincode not serviceable"), { statusCode: 400 }));

    const res = await call(order, { status: "packed" }, seller);

    expect(res.status).toBe(400);
    expect(res.message).toMatch(/pincode/);
    expect(order.status).toBe("confirmed");
    expect(order.save).not.toHaveBeenCalled();
  });

  it("another seller cannot trigger shipment booking or cancellation for this order", async () => {
    const order = courierOrder({ seller: "someone-else" });
    expect((await call(order, { status: "packed" }, seller)).status).toBe(403);
    expect((await call(order, { status: "cancelled" }, seller)).status).toBe(403);
    expect(mockProcessShiprocketOrder).not.toHaveBeenCalled();
    expect(mockCancelShiprocketShipment).not.toHaveBeenCalled();
  });

  it.each(["out_for_delivery", "delivered"])("admin cannot hand-set '%s' (courier tracking owns it)", async (target) => {
    const order = courierOrder({ status: "packed", shiprocket: { awb: "AWB1", shipmentId: "1", currentStatus: "IN_TRANSIT", history: [] } });
    const res = await call(order, { status: target, overrideReason: "please" }, admin);
    expect(res.status).toBe(400);
    expect(res.message).toMatch(/Shiprocket/);
    expect(order.status).toBe("packed");
    expect(mockApplyDeliveredSettlement).not.toHaveBeenCalled();
  });

  it("cannot cancel once the courier has the parcel; nothing is refunded", async () => {
    const order = courierOrder({
      status: "packed",
      workflowStatus: "PICKUP_READY",
      shiprocket: { awb: "AWB1", shipmentId: "1", currentStatus: "IN_TRANSIT", history: [] },
    });
    mockCancelShiprocketShipment.mockRejectedValue(Object.assign(new Error("courier already picked up"), { statusCode: 409 }));

    for (const user of [admin, seller]) {
      const res = await call(order, { status: "cancelled" }, user);
      expect(res.status).toBe(409);
    }
    expect(order.status).toBe("packed");
    expect(mockSellerRejectAtomic).not.toHaveBeenCalled();
    expect(mockCompensate).not.toHaveBeenCalled();
    expect(order.save).not.toHaveBeenCalled();
  });

  it("seller cancel before pickup: shipment is cancelled on Shiprocket BEFORE the order is cancelled/refunded", async () => {
    const order = courierOrder({
      shiprocket: { awb: "AWB1", shipmentId: "1", currentStatus: "AWB_ASSIGNED", history: [] },
    });
    const sequence = [];
    mockCancelShiprocketShipment.mockImplementation(async () => { sequence.push("shiprocket-cancel"); return { cancelled: true }; });
    mockSellerRejectAtomic.mockImplementation(async () => { sequence.push("order-cancel"); return { orderId: "ORD-C", status: "cancelled" }; });

    const res = await call(order, { status: "cancelled", reason: "Out of stock" }, seller);

    expect(res.status).toBe(200);
    expect(sequence).toEqual(["shiprocket-cancel", "order-cancel"]);
  });

  it("admin cancel before pickup: shipment cancelled, stock restored and customer refunded once", async () => {
    const order = courierOrder({
      status: "confirmed",
      items: [{ product: "p1", quantity: 2 }],
      shiprocket: { awb: "AWB1", shipmentId: "1", currentStatus: "PICKUP_SCHEDULED", history: [] },
    });

    const res = await call(order, { status: "cancelled", reason: "Customer asked" }, admin);

    expect(res.status).toBe(200);
    expect(mockCancelShiprocketShipment).toHaveBeenCalledWith(order);
    expect(order.status).toBe("cancelled");
    expect(order.orderStatus).toBe("cancelled");
    expect(order.workflowStatus).toBe("CANCELLED");
    expect(mockProductUpdate).toHaveBeenCalledWith("p1", { $inc: { stock: 2 } });
    expect(mockCompensate).toHaveBeenCalledTimes(1);
  });

  it("local orders never call the Shiprocket service", async () => {
    const order = localOrder();
    await call(order, { status: "cancelled" }, admin);
    expect(mockCancelShiprocketShipment).not.toHaveBeenCalled();
    expect(mockProcessShiprocketOrder).not.toHaveBeenCalled();
  });
});
