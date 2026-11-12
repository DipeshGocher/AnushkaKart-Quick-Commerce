import { jest } from "@jest/globals";

/**
 * Cross-layer check: ONE backend status change must read the same in every panel.
 *
 * Backend (real webhook service) -> admin/seller view (raw order)
 *                                -> customer view (real sanitiser the API/socket uses)
 *                                -> frontend label/options helpers (the real shared file)
 */
const mockOrderFindOne = jest.fn();

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: { findOne: mockOrderFindOne, findById: jest.fn(), findByIdAndUpdate: jest.fn() },
}));
jest.unstable_mockModule("../app/models/customer.js", () => ({ default: { findById: jest.fn() } }));
jest.unstable_mockModule("../app/models/product.js", () => ({ default: { find: jest.fn() } }));
jest.unstable_mockModule("../app/services/orderSettlement.js", () => ({ applyDeliveredSettlement: jest.fn().mockResolvedValue(true) }));
jest.unstable_mockModule("../app/services/orderCompensation.js", () => ({ compensateOrderCancellation: jest.fn().mockResolvedValue(true) }));
jest.unstable_mockModule("../app/modules/notifications/notification.emitter.js", () => ({ emitNotificationEvent: jest.fn() }));
jest.unstable_mockModule("../app/services/cacheService.js", () => ({
  invalidate: jest.fn().mockResolvedValue(true),
  buildKey: (...a) => a.join(":"),
}));

// The REAL socket emitter runs here (it is what sanitises the live update); only its
// heavy dependencies are stubbed, and the socket server is a recording fake.
jest.unstable_mockModule("../app/models/notification.js", () => ({ default: {} }));
jest.unstable_mockModule("../app/services/deliveryNearbyService.js", () => ({
  getDeliveryPartnerIdsWithinSellerRadius: jest.fn(),
  getDeliveryPartnerIdsWithinCustomerRadius: jest.fn(),
}));

const { registerOrderSocketGetter } = await import("../app/services/orderSocketEmitter.js");
const sockets = []; // every { room, event, body } actually "sent to a client"
registerOrderSocketGetter(() => ({
  to: (room) => ({ emit: (event, body) => sockets.push({ room, event, body }) }),
}));

const { processShiprocketWebhook, cancelShiprocketShipmentForOrder } = await import(
  "../app/services/shipping/shiprocketService.js"
);
const { sanitizeOrderForCustomer, buildCustomerShiprocket } = await import("../app/utils/customerShipmentView.js");
const ui = await import("../../frontend/src/shared/utils/orderStatus.js");

const clone = (o) => JSON.parse(JSON.stringify(o));
/** What the customer API returns for this stored order. */
const customerView = (order) => sanitizeOrderForCustomer(clone(order));

function courierOrder() {
  return {
    orderId: "ORD-X-1",
    fulfillmentType: "SHIPROCKET",
    workflowVersion: 2,
    workflowStatus: "SELLER_ACCEPTED",
    status: "confirmed",
    orderStatus: "confirmed",
    customer: "C1",
    seller: "S1",
    address: { city: "Indore" },
    shiprocket: {
      shipmentId: "1",
      shiprocketOrderId: "9",
      awb: "AWB-X",
      courierName: "Shiprocket Courier Partner",
      currentStatus: "AWB_ASSIGNED",
      labelUrl: "https://secret/label",
      history: [{ status: "NEW", remarks: "Order created for Shiprocket fulfillment", source: "system" }],
    },
    save: jest.fn().mockResolvedValue(true),
  };
}

const push = (order, current_status, extra = {}) => {
  mockOrderFindOne.mockResolvedValue(order);
  return processShiprocketWebhook({ order_id: order.orderId, awb: "AWB-X", current_status, location: "Hub", ...extra });
};

describe("one status change, same story in admin, seller and customer panels", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sockets.length = 0;
  });

  // [courier event, expected label everywhere, expected core status, can seller still cancel?]
  const journey = [
    ["PICKUP SCHEDULED", "Packed", "packed", true],
    ["PICKED UP", "Shipped", "packed", false],
    ["IN TRANSIT", "Shipped", "packed", false],
    ["OUT FOR DELIVERY", "Out for delivery", "out_for_delivery", false],
    ["DELIVERED", "Delivered", "delivered", false],
  ];

  it.each(journey)("after courier event '%s' every panel says '%s'", async (event, label, coreStatus, sellerCanCancel) => {
    const order = courierOrder();
    // bring the order to the stage just before this event by replaying earlier events
    for (const [prev] of journey) {
      if (prev === event) break;
      await push(order, prev);
    }
    await push(order, event);

    expect(order.status).toBe(coreStatus);

    const admin = order; // raw stored order = what admin/seller APIs return
    const customer = customerView(order);

    // same label in all three places (+ the customer list/detail helper)
    expect(ui.getStageLabel(admin)).toBe(label);
    expect(ui.getStageLabel(customer)).toBe(label);
    expect(ui.getOrderStatusLabel(customer)).toBe(label);
    expect(ui.getLegacyStatusFromOrder(admin)).toBe(ui.getLegacyStatusFromOrder(customer));

    // The live update the customer's open page receives (real emitter -> customer room)
    const toCustomer = sockets.filter((s) => s.room === "customer:C1" && s.event === "order:status:update").at(-1);
    const toOrderRoom = sockets.filter((s) => s.room === "order:ORD-X-1").at(-1);
    expect(toCustomer).toBeDefined();
    expect(toCustomer.body.status).toBe(coreStatus);
    // it carries the same stage as the REST view ...
    expect(
      ui.getStageLabel({
        ...customer,
        status: toCustomer.body.status,
        workflowStatus: toCustomer.body.workflowStatus,
        shiprocket: toCustomer.body.shiprocket,
      }),
    ).toBe(label);
    // ... and never leaks internal shipment data (order room is shared with admin/delivery sockets)
    for (const sent of [toCustomer, toOrderRoom]) {
      expect(JSON.stringify(sent.body)).not.toMatch(/secret|labelUrl|manifestUrl|shipmentId|shiprocketOrderId|Shiprocket fulfillment|Webhook event/);
    }

    // dropdown rules the seller sees match what the backend will actually allow
    expect(ui.canCancelOrder(admin, "seller")).toBe(sellerCanCancel);
    expect(ui.getStatusOptions(admin, "seller").some((o) => o.value === "cancelled")).toBe(sellerCanCancel);
  });

  it("a cancelled-before-pickup order reads Cancelled everywhere and cannot be re-opened by a late scan", async () => {
    const order = courierOrder();
    await cancelShiprocketShipmentForOrder(order); // seller cancels before pickup
    order.status = "cancelled";
    order.orderStatus = "cancelled";
    order.workflowStatus = "CANCELLED";

    const late = await push(order, "IN TRANSIT");

    expect(late.ignored).toBe(true);
    expect(ui.getStageLabel(order)).toBe("Cancelled");
    expect(ui.getStageLabel(customerView(order))).toBe("Cancelled");
    expect(ui.getStatusOptions(order, "admin")).toHaveLength(1);
  });

  it("before a courier is assigned the customer sees only the order status - no shipment details", () => {
    const order = courierOrder();
    order.shiprocket = { currentStatus: "NEW", awb: null, courierName: "Shiprocket Courier Partner", history: [{ status: "NEW", source: "system" }] };
    const view = buildCustomerShiprocket(order.shiprocket);
    expect(view).toEqual(expect.objectContaining({ awb: null, courierName: null, trackingUrl: null, history: [] }));
    expect(ui.getStageLabel(customerView(order))).toBe("Confirmed");
  });
});
