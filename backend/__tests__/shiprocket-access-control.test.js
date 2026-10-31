import { jest } from "@jest/globals";

const mockOrderFindOne = jest.fn();
const mockOrderFindById = jest.fn();

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    findOne: mockOrderFindOne,
    findById: mockOrderFindById,
  },
}));

const mockProcessShiprocketOrder = jest.fn();
const mockRequestShiprocketPickup = jest.fn();
const mockGetShiprocketLabel = jest.fn();

jest.unstable_mockModule("../app/services/shipping/shiprocketService.js", () => ({
  processShiprocketOrder: mockProcessShiprocketOrder,
  requestShiprocketPickup: mockRequestShiprocketPickup,
  getShiprocketLabel: mockGetShiprocketLabel,
  listLocalPincodes: jest.fn(),
  addLocalPincode: jest.fn(),
  updateLocalPincode: jest.fn(),
  deleteLocalPincode: jest.fn(),
  toggleLocalPincodeStatus: jest.fn(),
  updateShiprocketManualStatus: jest.fn(),
  processShiprocketWebhook: jest.fn(),
  isShiprocketConfigured: jest.fn().mockReturnValue(false),
  recordShiprocketWeightDiscrepancy: jest.fn(),
  createShiprocketReversePickup: jest.fn(),
  getShiprocketReverseLabel: jest.fn(),
  updateShiprocketReverseStatus: jest.fn(),
}));

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {},
}));

jest.unstable_mockModule("../app/models/localPincode.js", () => ({
  default: {},
}));

const {
  processShiprocket,
  scheduleShiprocketPickup,
  fetchShiprocketLabel,
} = await import("../app/controller/shippingController.js");

function createMockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((data) => {
    res.body = data;
    return res;
  });
  return res;
}

describe("Shiprocket Access Control & RBAC (Admin vs Seller)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("processShiprocket", () => {
    it("allows Super Admin to process any order", async () => {
      const req = {
        params: { orderId: "ORD-ADMIN-01" },
        user: { id: "admin-1", role: "admin" },
      };
      const res = createMockRes();

      mockProcessShiprocketOrder.mockResolvedValue({
        success: true,
        message: "Shiprocket shipment processed",
        shipment: { awb: "SR12345678IN" },
      });

      await processShiprocket(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockProcessShiprocketOrder).toHaveBeenCalledWith("ORD-ADMIN-01");
    });

    it("allows Seller to process their own order", async () => {
      const sellerId = "64b7f1a2c3d4e5f6a7b8c9d0";
      const req = {
        params: { orderId: "ORD-SELLER-01" },
        user: { id: sellerId, role: "seller" },
      };
      const res = createMockRes();

      mockOrderFindOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            orderId: "ORD-SELLER-01",
            seller: sellerId,
            warehouseId: null,
          }),
        }),
      });

      mockProcessShiprocketOrder.mockResolvedValue({
        success: true,
        message: "Shiprocket shipment processed",
        shipment: { awb: "SR87654321IN" },
      });

      await processShiprocket(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockProcessShiprocketOrder).toHaveBeenCalledWith("ORD-SELLER-01");
    });

    it("rejects Seller attempting to process an order belonging to another seller with 403", async () => {
      const sellerId = "64b7f1a2c3d4e5f6a7b8c9d0";
      const otherSellerId = "64b7f1a2c3d4e5f6a7b8c9d1";
      const req = {
        params: { orderId: "ORD-OTHER-01" },
        user: { id: sellerId, role: "seller" },
      };
      const res = createMockRes();

      mockOrderFindOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            orderId: "ORD-OTHER-01",
            seller: otherSellerId,
            warehouseId: null,
          }),
        }),
      });

      await processShiprocket(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("Unauthorized");
      expect(mockProcessShiprocketOrder).not.toHaveBeenCalled();
    });

    it("allows Seller to process their order even if seller field is populated as an object", async () => {
      const sellerId = "64b7f1a2c3d4e5f6a7b8c9d0";
      const req = {
        params: { orderId: "ORD-SELLER-POP-01" },
        user: { _id: sellerId, role: "seller" },
      };
      const res = createMockRes();

      mockOrderFindOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            orderId: "ORD-SELLER-POP-01",
            seller: { _id: sellerId, shopName: "My Shop" },
            warehouseId: null,
          }),
        }),
      });

      mockProcessShiprocketOrder.mockResolvedValue({
        success: true,
        message: "Shiprocket shipment processed",
        shipment: { awb: "SR99999999IN" },
      });

      await processShiprocket(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockProcessShiprocketOrder).toHaveBeenCalledWith("ORD-SELLER-POP-01");
    });

    it("allows Warehouse manager to process order assigned to their warehouseId", async () => {
      const warehouseId = "64b7f1a2c3d4e5f6a7b8c9d9";
      const req = {
        params: { orderId: "ORD-WH-01" },
        user: { id: warehouseId, role: "warehouse" },
      };
      const res = createMockRes();

      mockOrderFindOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            orderId: "ORD-WH-01",
            seller: null,
            warehouseId: warehouseId,
          }),
        }),
      });

      mockProcessShiprocketOrder.mockResolvedValue({
        success: true,
        message: "Shiprocket shipment processed",
        shipment: { awb: "SR88888888IN" },
      });

      await processShiprocket(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockProcessShiprocketOrder).toHaveBeenCalledWith("ORD-WH-01");
    });
  });

  describe("scheduleShiprocketPickup", () => {
    it("allows Seller to schedule pickup for their own order", async () => {
      const sellerId = "64b7f1a2c3d4e5f6a7b8c9d0";
      const req = {
        params: { orderId: "ORD-SELLER-02" },
        user: { id: sellerId, role: "seller" },
      };
      const res = createMockRes();

      mockOrderFindOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            orderId: "ORD-SELLER-02",
            seller: sellerId,
            warehouseId: null,
          }),
        }),
      });

      mockRequestShiprocketPickup.mockResolvedValue({
        success: true,
        message: "Pickup scheduled successfully",
      });

      await scheduleShiprocketPickup(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockRequestShiprocketPickup).toHaveBeenCalledWith("ORD-SELLER-02");
    });

    it("rejects Seller attempting to schedule pickup for another seller's order with 403", async () => {
      const sellerId = "64b7f1a2c3d4e5f6a7b8c9d0";
      const otherSellerId = "64b7f1a2c3d4e5f6a7b8c9d1";
      const req = {
        params: { orderId: "ORD-OTHER-02" },
        user: { id: sellerId, role: "seller" },
      };
      const res = createMockRes();

      mockOrderFindOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            orderId: "ORD-OTHER-02",
            seller: otherSellerId,
            warehouseId: null,
          }),
        }),
      });

      await scheduleShiprocketPickup(req, res);

      expect(res.statusCode).toBe(403);
      expect(mockRequestShiprocketPickup).not.toHaveBeenCalled();
    });
  });

  describe("fetchShiprocketLabel", () => {
    it("allows Seller to fetch shipping label for their own order", async () => {
      const sellerId = "64b7f1a2c3d4e5f6a7b8c9d0";
      const req = {
        params: { orderId: "ORD-SELLER-03" },
        user: { id: sellerId, role: "seller" },
      };
      const res = createMockRes();

      mockOrderFindOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            orderId: "ORD-SELLER-03",
            seller: sellerId,
            warehouseId: null,
          }),
        }),
      });

      mockGetShiprocketLabel.mockResolvedValue({
        success: true,
        labelUrl: "https://shiprocket.co/label/123.pdf",
      });

      await fetchShiprocketLabel(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockGetShiprocketLabel).toHaveBeenCalledWith("ORD-SELLER-03");
    });

    it("rejects Seller attempting to fetch label for another seller's order with 403", async () => {
      const sellerId = "64b7f1a2c3d4e5f6a7b8c9d0";
      const otherSellerId = "64b7f1a2c3d4e5f6a7b8c9d1";
      const req = {
        params: { orderId: "ORD-OTHER-03" },
        user: { id: sellerId, role: "seller" },
      };
      const res = createMockRes();

      mockOrderFindOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            orderId: "ORD-OTHER-03",
            seller: otherSellerId,
            warehouseId: null,
          }),
        }),
      });

      await fetchShiprocketLabel(req, res);

      expect(res.statusCode).toBe(403);
      expect(mockGetShiprocketLabel).not.toHaveBeenCalled();
    });
  });
});
