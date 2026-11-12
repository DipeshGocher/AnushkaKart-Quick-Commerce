import { jest } from "@jest/globals";

const mockFindOne = jest.fn();
const mockFindOneAndUpdate = jest.fn();
const mockUpdateOne = jest.fn().mockResolvedValue({});
const mockEmitOrderStatusUpdate = jest.fn();

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: { findOne: mockFindOne, findOneAndUpdate: mockFindOneAndUpdate, updateOne: mockUpdateOne },
}));
jest.unstable_mockModule("../app/models/deliveryAssignment.js", () => ({
  default: { findOne: () => ({ sort: async () => null }) },
}));
jest.unstable_mockModule("../app/models/orderOtp.js", () => ({ default: {} }));
jest.unstable_mockModule("../app/models/seller.js", () => ({ default: {} }));
jest.unstable_mockModule("../app/models/delivery.js", () => ({
  // rider has no stored location -> radius check is skipped
  default: { findById: () => ({ select: () => ({ lean: async () => null }) }) },
}));
jest.unstable_mockModule("../app/services/firebaseService.js", () => ({
  clearOrderTracking: jest.fn(),
  clearRiderPresence: jest.fn(),
}));
jest.unstable_mockModule("../app/config/redis.js", () => ({ getRedisClient: () => null }));
jest.unstable_mockModule("../app/services/workflow/jobSchedulerPort.js", () => ({
  scheduleSellerTimeout: jest.fn(),
  removeSellerTimeout: jest.fn(),
  scheduleDeliveryTimeout: jest.fn(),
  removeDeliveryTimeout: jest.fn(),
  scheduleReturnPickupTimeout: jest.fn(),
  removeReturnPickupTimeout: jest.fn(),
}));
jest.unstable_mockModule("../app/services/orderSocketEmitter.js", () => ({
  emitOrderStatusUpdate: mockEmitOrderStatusUpdate,
  emitToSeller: jest.fn(),
  emitDeliveryBroadcastForSeller: jest.fn(),
  emitReturnBroadcastForCustomer: jest.fn(),
  emitToCustomer: jest.fn(),
  emitToOrder: jest.fn(),
  retractDeliveryBroadcastForOrder: jest.fn(),
}));
jest.unstable_mockModule("../app/services/orderCompensation.js", () => ({ compensateOrderCancellation: jest.fn() }));
jest.unstable_mockModule("../app/services/orderSettlement.js", () => ({ applyDeliveredSettlement: jest.fn() }));
jest.unstable_mockModule("../app/services/seller/sellerStatsService.js", () => ({ invalidateSellerStatsCache: jest.fn() }));
jest.unstable_mockModule("../app/modules/notifications/notification.emitter.js", () => ({ emitNotificationEvent: jest.fn() }));
jest.unstable_mockModule("../app/utils/orderLookup.js", () => ({
  requireCanonicalOrderId: async (id) => id,
  orderMatchQueryFromRouteParam: jest.fn(),
  orderMatchQueryFlexible: jest.fn(),
}));

const { deliveryAcceptAtomic } = await import("../app/services/orderWorkflowService.js");

const RIDER = "507f1f77bcf86cd799439011";

function assignedOrder(extra = {}) {
  return {
    _id: "m1",
    orderId: "ORD-RIDER-1",
    customer: "cust-1",
    seller: "seller-1",
    fulfillmentType: "LOCAL",
    workflowStatus: "DELIVERY_ASSIGNED",
    status: "confirmed", // what the atomic assignment writes
    deliverySearchMeta: { attempt: 1 },
    ...extra,
  };
}

describe("rider accepts an order the seller already packed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // pre-check read: .select().lean()
    mockFindOne.mockReturnValue({ select: () => ({ lean: async () => ({ orderId: "ORD-RIDER-1", fulfillmentType: "LOCAL" }) }) });
  });

  it("keeps the order 'packed' (not reset to 'confirmed') and tells every screen", async () => {
    const packedAt = new Date();
    const updated = assignedOrder({ pickupReadyAt: packedAt });
    mockFindOneAndUpdate.mockResolvedValue(updated);

    const { order, duplicate } = await deliveryAcceptAtomic(RIDER, "ORD-RIDER-1");

    expect(duplicate).toBe(false);
    // rider workflow moved on normally ...
    expect(order.workflowStatus).toBe("DELIVERY_ASSIGNED");
    // ... but seller/admin/customer keep seeing "packed"
    expect(order.status).toBe("packed");
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: "m1" },
      { $set: { status: "packed", orderStatus: "packed" } },
    );
    expect(mockEmitOrderStatusUpdate).toHaveBeenCalledWith(
      "ORD-RIDER-1",
      expect.objectContaining({ workflowStatus: "DELIVERY_ASSIGNED", status: "packed", pickupReadyAt: packedAt }),
      "cust-1",
    );
  });

  it("a not-yet-packed order stays 'confirmed' after assignment (no extra write)", async () => {
    mockFindOneAndUpdate.mockResolvedValue(assignedOrder());

    const { order } = await deliveryAcceptAtomic(RIDER, "ORD-RIDER-1");

    expect(order.status).toBe("confirmed");
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it("the assignment itself only matches orders that are still open for riders (DELIVERY_SEARCH, no rider yet)", async () => {
    mockFindOneAndUpdate.mockResolvedValue(assignedOrder());
    await deliveryAcceptAtomic(RIDER, "ORD-RIDER-1");

    const [filter] = mockFindOneAndUpdate.mock.calls[0];
    expect(filter).toEqual(expect.objectContaining({ workflowStatus: "DELIVERY_SEARCH", deliveryBoy: null }));
    expect(filter.fulfillmentType).toEqual({ $ne: "SHIPROCKET" });
  });
});
