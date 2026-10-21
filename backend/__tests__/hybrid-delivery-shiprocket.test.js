import { jest } from "@jest/globals";
import axios from "axios";

const mockLocalPincodeFindOne = jest.fn();
const mockLocalPincodeCountDocuments = jest.fn();
const mockLocalPincodeInsertMany = jest.fn();
const mockOrderFindOne = jest.fn();
const mockOrderFindById = jest.fn();
const mockOrderFindByIdAndUpdate = jest.fn();
const mockCustomerFindById = jest.fn();
const mockProductFind = jest.fn();

jest.unstable_mockModule("../app/models/localPincode.js", () => ({
  default: {
    findOne: mockLocalPincodeFindOne,
    countDocuments: mockLocalPincodeCountDocuments,
    insertMany: mockLocalPincodeInsertMany,
  },
}));

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    findOne: mockOrderFindOne,
    findById: mockOrderFindById,
    findByIdAndUpdate: mockOrderFindByIdAndUpdate,
  },
}));

jest.unstable_mockModule("../app/models/customer.js", () => ({
  default: { findById: mockCustomerFindById },
}));

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: { find: mockProductFind },
}));

const mockApplyDeliveredSettlement = jest.fn().mockResolvedValue(true);
const mockCompensateOrderCancellation = jest.fn().mockResolvedValue(true);
const mockEmitOrderStatusUpdate = jest.fn();
const mockEmitNotificationEvent = jest.fn();
const mockInvalidate = jest.fn().mockResolvedValue(true);

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
  invalidate: mockInvalidate,
  buildKey: (...args) => args.join(":"),
}));

const {
  isPincodeLocal,
  getLocalPincodeDetails,
  evaluateDeliveryEligibility,
} = await import("../app/services/shipping/localPincodeService.js");

const {
  processShiprocketOrder,
  updateShiprocketManualStatus,
  processShiprocketWebhook,
} = await import("../app/services/shipping/shiprocketService.js");

describe("Hybrid Delivery Architecture - Local vs Shiprocket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Local Pincode Service", () => {
    it("recognizes local serviced pincodes", async () => {
      mockLocalPincodeCountDocuments.mockResolvedValue(2);

      mockLocalPincodeFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          pincode: "284204",
          areaName: "Mauranipur Hub",
          deliveryTimeEstimate: "12-15 mins",
          isActive: true,
        }),
      });

      const isLocal = await isPincodeLocal("284204");
      expect(isLocal).toBe(true);
      expect(mockLocalPincodeFindOne).toHaveBeenCalledWith({
        pincode: "284204",
        isActive: true,
      });
    });

    it("identifies out-of-reach non-local pincode as false", async () => {
      mockLocalPincodeCountDocuments.mockResolvedValue(2);

      mockLocalPincodeFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const isLocal = await isPincodeLocal("110001");
      expect(isLocal).toBe(false);
    });

    it("keeps an empty admin pincode list non-local", async () => {
      mockLocalPincodeFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      expect(await isPincodeLocal("284204")).toBe(false);
      expect(mockLocalPincodeInsertMany).not.toHaveBeenCalled();
    });

    it("routes riders only when seller and customer pincodes are both active", async () => {
      mockLocalPincodeCountDocuments.mockResolvedValue(2);
      mockLocalPincodeFindOne.mockImplementation(({ pincode }) => ({
        lean: jest.fn().mockResolvedValue(["284204", "284205"].includes(pincode)
          ? { pincode, deliveryTimeEstimate: "20-35 mins", isActive: true }
          : null),
      }));
      const bothScenarios = [
        ["284204", "284205", "LOCAL_RIDERS"],
        ["284204", "110001", "SHIPROCKET"],
        ["110001", "284204", "SHIPROCKET"],
        ["110001", "110002", "SHIPROCKET"],
        ["284204", "", "SHIPROCKET"],
      ];
      for (const [customerPincode, sellerPincode, expected] of bothScenarios) {
        const result = await evaluateDeliveryEligibility({ customerPincode, sellerPincode, deliveryMode: "both" });
        expect(result.fulfillmentType).toBe(expected);
      }

      // quick_only: only local riders if both local, else blocked (fulfillmentType: null, isDeliverable: false)
      const quickLocal = await evaluateDeliveryEligibility({ customerPincode: "284204", sellerPincode: "284205", deliveryMode: "quick_only" });
      expect(quickLocal.isDeliverable).toBe(true);
      expect(quickLocal.fulfillmentType).toBe("LOCAL_RIDERS");

      const quickOutside = await evaluateDeliveryEligibility({ customerPincode: "284204", sellerPincode: "110001", deliveryMode: "quick_only" });
      expect(quickOutside.isDeliverable).toBe(false);
      expect(quickOutside.fulfillmentType).toBe(null);
    });
  });

  describe("Shiprocket Service Flow (Local / Simulated Dev Mode)", () => {
    it("processes a Shiprocket order and generates simulated AWB when live credentials are absent", async () => {
      const mockOrder = {
        orderId: "ORD-TEST-101",
        fulfillmentType: "SHIPROCKET",
        address: { city: "Indore", state: "Madhya Pradesh", pincode: "452001", address: "Main Road", name: "Rahul", phone: "9876543210" },
        pricing: { subtotal: 350 },
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderFindOne.mockResolvedValue(mockOrder);

      const result = await processShiprocketOrder("ORD-TEST-101");
      expect(result.success).toBe(true);
      expect(result.mode).toBe("SIMULATED");
      expect(mockOrder.fulfillmentType).toBe("SHIPROCKET");
      expect(mockOrder.shiprocket).toBeDefined();
      expect(mockOrder.shiprocket.awb).toMatch(/^SR\d+IN$/);
      expect(mockOrder.shiprocket.currentStatus).toBe("AWB_ASSIGNED");
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it("uses real order address, catalog weight and API shipment IDs in live mode", async () => {
      const previousEmail = process.env.SHIPROCKET_EMAIL;
      const previousPassword = process.env.SHIPROCKET_PASSWORD;
      const previousContactEmail = process.env.SHIPROCKET_CONTACT_EMAIL;
      process.env.SHIPROCKET_EMAIL = "api@example.test";
      process.env.SHIPROCKET_PASSWORD = "test-password";
      process.env.SHIPROCKET_CONTACT_EMAIL = "store@example.test";
      mockCustomerFindById.mockReturnValue({ select: () => ({ lean: async () => ({ email: "buyer@example.test" }) }) });
      mockProductFind.mockReturnValue({ select: () => ({ lean: async () => [
        { _id: "507f1f77bcf86cd799439011", sku: "WIRE-1", weight: "750 g" },
      ] }) });
      const order = {
        orderId: "ORD-LIVE-101",
        fulfillmentType: "SHIPROCKET",
        paymentMode: "COD",
        customer: "507f1f77bcf86cd799439012",
        address: { name: "Buyer", address: "Main Road", city: "Indore", state: "Madhya Pradesh", pincode: "452001", phone: "9876543210" },
        items: [{ name: "Wire", product: "507f1f77bcf86cd799439011", quantity: 2, price: 499 }],
        paymentBreakdown: { productSubtotal: 998, deliveryFeeCharged: 49, handlingFeeCharged: 10, discountTotal: 20, walletAmount: 100 },
        save: jest.fn().mockResolvedValue(true),
      };
      mockOrderFindOne.mockResolvedValue(order);
      const post = jest.spyOn(axios, "post").mockImplementation(async (url, payload) => {
        if (url.endsWith("/auth/login")) return { data: { token: "test-token" } };
        if (url.endsWith("/orders/create/adhoc")) return { data: { order_id: 765, shipment_id: 123, status_code: 1 } };
        if (url.endsWith("/courier/assign/awb")) return { data: { response: { data: { awb_code: "AWB123", courier_name: "Test Courier" } } } };
        throw new Error(`Unexpected API route: ${url}`);
      });
      try {
        const result = await processShiprocketOrder(order.orderId);
        expect(result.success).toBe(true);
        const createCall = post.mock.calls.find(([url]) => url.endsWith("/orders/create/adhoc"));
        expect(createCall[1]).toEqual(expect.objectContaining({
          billing_email: "buyer@example.test",
          billing_phone: "9876543210",
          billing_pincode: "452001",
          sub_total: 998,
          shipping_charges: 49,
          transaction_charges: 10,
          total_discount: 120,
          weight: 1.5,
          order_items: [expect.objectContaining({ sku: "WIRE-1", units: 2 })],
        }));
        expect(order.shiprocket).toEqual(expect.objectContaining({ shipmentId: "123", shiprocketOrderId: "765", awb: "AWB123" }));
      } finally {
        post.mockRestore();
        if (previousEmail === undefined) delete process.env.SHIPROCKET_EMAIL;
        else process.env.SHIPROCKET_EMAIL = previousEmail;
        if (previousPassword === undefined) delete process.env.SHIPROCKET_PASSWORD;
        else process.env.SHIPROCKET_PASSWORD = previousPassword;
        if (previousContactEmail === undefined) delete process.env.SHIPROCKET_CONTACT_EMAIL;
        else process.env.SHIPROCKET_CONTACT_EMAIL = previousContactEmail;
      }
    });

    it("allows Super Admin to update Shiprocket status manually", async () => {
      const mockOrder = {
        orderId: "ORD-TEST-102",
        fulfillmentType: "SHIPROCKET",
        shiprocket: { currentStatus: "AWB_ASSIGNED", history: [] },
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderFindOne.mockResolvedValue(mockOrder);

      const result = await updateShiprocketManualStatus("ORD-TEST-102", {
        status: "IN_TRANSIT",
        remarks: "Package received at Mauranipur Sorting Center",
        location: "Mauranipur Hub",
      });

      expect(result.success).toBe(true);
      expect(mockOrder.shiprocket.currentStatus).toBe("IN_TRANSIT");
      expect(mockOrder.status).toBe("packed");
      expect(mockOrder.shiprocket.history.length).toBe(1);
      expect(mockOrder.shiprocket.history[0].source).toBe("manual");
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it("rejects invalid manual status with 400 error", async () => {
      const mockOrder = {
        orderId: "ORD-TEST-103",
        shiprocket: { history: [] },
        save: jest.fn(),
      };
      mockOrderFindOne.mockResolvedValue(mockOrder);

      await expect(
        updateShiprocketManualStatus("ORD-TEST-103", { status: "INVALID_STATUS" })
      ).rejects.toThrow("Invalid status: INVALID_STATUS");
    });

    it("processes inbound Shiprocket webhook event and updates order status with settlement and sockets", async () => {
      const mockOrder = {
        orderId: "ORD-TEST-104",
        fulfillmentType: "SHIPROCKET",
        workflowVersion: 2,
        customer: "CUST-101",
        seller: "SELLER-101",
        shiprocket: { awb: "SR12345678IN", currentStatus: "IN_TRANSIT", history: [] },
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderFindOne.mockResolvedValue(mockOrder);

      const webhookPayload = {
        order_id: "ORD-TEST-104",
        awb: "SR12345678IN",
        current_status: "DELIVERED",
        location: "Indore Hub",
        status_remarks: "Shipment delivered to customer",
      };

      const res = await processShiprocketWebhook(webhookPayload);
      expect(res.success).toBe(true);
      expect(mockOrder.shiprocket.currentStatus).toBe("DELIVERED");
      expect(mockOrder.status).toBe("delivered");
      expect(mockOrder.workflowStatus).toBe("DELIVERED");
      expect(mockApplyDeliveredSettlement).toHaveBeenCalledWith(mockOrder, "ORD-TEST-104");
      expect(mockEmitOrderStatusUpdate).toHaveBeenCalled();
      expect(mockEmitNotificationEvent).toHaveBeenCalled();
      expect(mockInvalidate).toHaveBeenCalled();
      expect(mockOrder.shiprocket.history.length).toBe(1);
      expect(mockOrder.shiprocket.history[0].source).toBe("webhook");
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it("triggers cancellation compensation when Shiprocket manual status is set to CANCELLED", async () => {
      const mockOrder = {
        orderId: "ORD-TEST-105",
        fulfillmentType: "SHIPROCKET",
        workflowVersion: 2,
        customer: "CUST-102",
        seller: "SELLER-102",
        shiprocket: { currentStatus: "AWB_ASSIGNED", history: [] },
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderFindOne.mockResolvedValue(mockOrder);

      const result = await updateShiprocketManualStatus("ORD-TEST-105", {
        status: "CANCELLED",
        remarks: "Shipment cancelled by courier",
      });

      expect(result.success).toBe(true);
      expect(mockOrder.status).toBe("cancelled");
      expect(mockOrder.workflowStatus).toBe("CANCELLED");
      expect(mockCompensateOrderCancellation).toHaveBeenCalledWith(
        mockOrder,
        "ORD-TEST-105",
        expect.objectContaining({ reason: "Shipment cancelled by courier" }),
      );
      expect(mockEmitOrderStatusUpdate).toHaveBeenCalled();
      expect(mockOrder.save).toHaveBeenCalled();
    });
  });
});
