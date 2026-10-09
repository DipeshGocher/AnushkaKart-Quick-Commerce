import { jest } from "@jest/globals";

const mockLocalPincodeFindOne = jest.fn();
const mockLocalPincodeCountDocuments = jest.fn();
const mockLocalPincodeInsertMany = jest.fn();
const mockOrderFindOne = jest.fn();
const mockOrderFindById = jest.fn();
const mockOrderFindByIdAndUpdate = jest.fn();

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

const {
  isPincodeLocal,
  getLocalPincodeDetails,
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

    it("auto-seeds default pincodes if collection is empty", async () => {
      mockLocalPincodeCountDocuments.mockResolvedValue(0);
      mockLocalPincodeFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ pincode: "284204", isActive: true }),
      });

      await isPincodeLocal("284204");
      expect(mockLocalPincodeInsertMany).toHaveBeenCalled();
    });
  });

  describe("Shiprocket Service Flow (Local / Simulated Dev Mode)", () => {
    it("processes a Shiprocket order and generates simulated AWB when live credentials are absent", async () => {
      const mockOrder = {
        orderId: "ORD-TEST-101",
        address: { city: "Indore", name: "Rahul", phone: "9876543210" },
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

    it("processes inbound Shiprocket webhook event and updates order status", async () => {
      const mockOrder = {
        orderId: "ORD-TEST-104",
        fulfillmentType: "SHIPROCKET",
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
      expect(mockOrder.shiprocket.history.length).toBe(1);
      expect(mockOrder.shiprocket.history[0].source).toBe("webhook");
      expect(mockOrder.save).toHaveBeenCalled();
    });
  });
});
