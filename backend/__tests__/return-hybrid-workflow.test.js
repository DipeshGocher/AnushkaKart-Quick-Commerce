import { jest } from "@jest/globals";

// Mock dependencies
const mockOrderFindOne = jest.fn();
const mockOrderFindById = jest.fn();
const mockProductFind = jest.fn();
const mockProductUpdateOne = jest.fn();
const mockStockHistoryCreate = jest.fn();
const mockSettingFindOne = jest.fn();
const mockUserFindById = jest.fn();
const mockSellerFindById = jest.fn();
const mockWarehouseFindById = jest.fn();
const mockOrderOtpFindOne = jest.fn();
const mockTransactionCreate = jest.fn();
const mockCreateShiprocketReversePickup = jest.fn();
const mockEmitReturnBroadcastForCustomer = jest.fn();
const mockEmitNotificationEvent = jest.fn();
const mockWalletCredit = jest.fn();
const mockWalletDebit = jest.fn();

// Mock Mongoose transaction
const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
  withTransaction: jest.fn(async (callback) => {
    return await callback();
  }),
};

jest.unstable_mockModule("mongoose", () => ({
  default: {
    startSession: jest.fn().mockResolvedValue(mockSession),
    Types: {
      ObjectId: {
        isValid: (id) => typeof id === "string" && id.length === 24,
      },
    },
  },
}));

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    findOne: mockOrderFindOne,
    findById: mockOrderFindById,
  },
}));

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    find: mockProductFind,
    updateOne: mockProductUpdateOne,
  },
}));

jest.unstable_mockModule("../app/models/stockHistory.js", () => ({
  default: {
    create: mockStockHistoryCreate,
  },
}));

jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: {
    findOne: mockSettingFindOne,
  },
}));

jest.unstable_mockModule("../app/models/customer.js", () => ({
  default: {
    findById: mockUserFindById,
  },
}));

jest.unstable_mockModule("../app/models/seller.js", () => ({
  default: {
    findById: mockSellerFindById,
  },
}));

jest.unstable_mockModule("../app/models/warehouse.js", () => ({
  default: {
    findById: mockWarehouseFindById,
  },
}));

jest.unstable_mockModule("../app/models/orderOtp.js", () => ({
  default: {
    findOne: mockOrderOtpFindOne,
  },
}));

jest.unstable_mockModule("../app/models/transaction.js", () => ({
  default: {
    create: mockTransactionCreate,
  },
}));

jest.unstable_mockModule("../app/utils/orderLookup.js", () => ({
  orderMatchQueryFromRouteParam: (id) => ({ orderId: id }),
}));

jest.unstable_mockModule("../app/modules/notifications/notification.emitter.js", () => ({
  emitNotificationEvent: mockEmitNotificationEvent,
}));

jest.unstable_mockModule("../app/services/orderSocketEmitter.js", () => ({
  emitReturnBroadcastForCustomer: mockEmitReturnBroadcastForCustomer,
  emitToSeller: jest.fn(),
}));

jest.unstable_mockModule("../app/services/shipping/shiprocketService.js", () => ({
  createShiprocketReversePickup: mockCreateShiprocketReversePickup,
}));

jest.unstable_mockModule("../app/services/finance/walletService.js", () => ({
  creditWallet: mockWalletCredit,
  debitWallet: mockWalletDebit,
}));

jest.unstable_mockModule("../app/services/finance/payoutService.js", () => ({
  cancelPendingPayoutForOrder: jest.fn(),
}));

jest.unstable_mockModule("../app/services/firebaseService.js", () => ({
  clearOrderTracking: jest.fn().mockResolvedValue(true),
}));

jest.unstable_mockModule("../app/services/cacheService.js", () => ({
  buildKey: (...args) => args.join(":"),
  invalidate: jest.fn().mockResolvedValue(true),
}));

jest.unstable_mockModule("../app/services/logger.js", () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { OrderReturnService } = await import("../app/services/order/orderReturnService.js");
const { getReturnWindowMinutes, computeReturnWindowForOrder } = await import("../app/utils/returnWindow.js");

describe("Hybrid Quick-Commerce & Pan-India Return Workflows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. Dynamic Return Window Calculation", () => {
    it("should calculate 240 minutes (4 hours) return window for local quick-commerce orders", () => {
      const localOrder = { fulfillmentType: "LOCAL" };
      const minutes = getReturnWindowMinutes(localOrder);
      expect(minutes).toBe(240);
    });

    it("should calculate 10080 minutes (7 days) return window for Shiprocket courier orders", () => {
      const courierOrder = { fulfillmentType: "SHIPROCKET" };
      const minutes = getReturnWindowMinutes(courierOrder);
      expect(minutes).toBe(10080);
    });

    it("computeReturnWindowForOrder should format displayWindow as '4 hours' for local and '7 days' for courier", () => {
      const now = new Date();
      const localWindow = computeReturnWindowForOrder({ fulfillmentType: "LOCAL", deliveredAt: now });
      expect(localWindow.displayWindow).toBe("4 hours");
      expect(localWindow.windowMinutes).toBe(240);

      const courierWindow = computeReturnWindowForOrder({ fulfillmentType: "SHIPROCKET", deliveredAt: now });
      expect(courierWindow.displayWindow).toBe("7 days");
      expect(courierWindow.windowMinutes).toBe(10080);
    });
  });

  describe("2. Non-Returnable Flag Enforcement", () => {
    it("should reject return request if product is flagged as non-returnable (isReturnable: false)", async () => {
      const customerId = "cust_123";
      const orderId = "ORD_001";
      const deliveredTime = new Date(Date.now() - 30 * 60 * 1000); // delivered 30 mins ago

      const mockOrder = {
        orderId,
        customer: customerId,
        status: "delivered",
        returnStatus: "none",
        deliveredAt: deliveredTime,
        fulfillmentType: "LOCAL",
        items: [
          {
            product: "prod_milk_id",
            name: "Fresh Amul Milk 500ml",
            quantity: 2,
            price: 35,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderFindOne.mockResolvedValue(mockOrder);

      // Product is marked non-returnable
      mockProductFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: "prod_milk_id",
              name: "Fresh Amul Milk 500ml",
              isReturnable: false,
              returnPolicyNote: "Perishable dairy product",
            },
          ]),
        }),
      });

      await expect(
        OrderReturnService.createReturnRequest(customerId, orderId, {
          items: [{ itemIndex: 0, quantity: 1 }],
          reason: "Damaged packaging",
        })
      ).rejects.toThrow(/non-returnable/i);
    });

    it("should allow return request if product is returnable", async () => {
      const customerId = "cust_123";
      const orderId = "ORD_002";
      const deliveredTime = new Date(Date.now() - 30 * 60 * 1000);

      const mockOrder = {
        orderId,
        customer: customerId,
        status: "delivered",
        returnStatus: "none",
        deliveredAt: deliveredTime,
        fulfillmentType: "SHIPROCKET",
        items: [
          {
            product: "prod_shirt_id",
            name: "Cotton Casual Shirt",
            quantity: 1,
            price: 799,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderFindOne.mockResolvedValue(mockOrder);

      mockProductFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: "prod_shirt_id",
              name: "Cotton Casual Shirt",
              isReturnable: true,
              returnPolicyNote: "",
            },
          ]),
        }),
      });

      const result = await OrderReturnService.createReturnRequest(customerId, orderId, {
        items: [{ itemIndex: 0, quantity: 1 }],
        reason: "Size does not fit",
        conditionAssurance: true,
      });

      expect(result.returnStatus).toBe("return_requested");
      expect(mockOrder.save).toHaveBeenCalled();
    });
  });

  describe("3. Shiprocket Reverse Pickup Dispatch on Approval", () => {
    it("should trigger Shiprocket reverse pickup auto-booking for SHIPROCKET orders and NOT broadcast to local riders", async () => {
      const orderId = "ORD_COURIER_100";
      const mockOrder = {
        orderId,
        seller: "seller_1",
        customer: "cust_1",
        status: "delivered",
        returnStatus: "return_requested",
        fulfillmentType: "SHIPROCKET",
        returnItems: [
          {
            product: "prod_1",
            name: "Branded Sneakers",
            quantity: 1,
            price: 1500,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderFindOne.mockResolvedValue(mockOrder);
      mockSettingFindOne.mockResolvedValue({ returnDeliveryCommission: 30 });
      mockSellerFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            shopName: "Urban Shoes",
            address: "Main Market, Jhansi",
            phone: "9876543210",
          }),
        }),
      });
      mockUserFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            name: "Rajesh",
            phone: "9123456780",
          }),
        }),
      });

      await OrderReturnService.approveReturn(orderId, "admin_user", "admin");

      expect(mockCreateShiprocketReversePickup).toHaveBeenCalledWith(mockOrder);
      expect(mockEmitReturnBroadcastForCustomer).not.toHaveBeenCalled();
      expect(mockOrder.returnStatus).toBe("return_approved");
    });

    it("should broadcast to local riders for LOCAL orders", async () => {
      const orderId = "ORD_LOCAL_200";
      const mockOrder = {
        orderId,
        seller: "seller_1",
        customer: "cust_1",
        status: "delivered",
        returnStatus: "return_requested",
        fulfillmentType: "LOCAL",
        address: {
          location: { coordinates: [78.5685, 25.4484] },
          fullAddress: "Civil Lines, Jhansi",
        },
        returnItems: [
          {
            product: "prod_2",
            name: "Basmati Rice 5kg",
            quantity: 1,
            price: 450,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderFindOne.mockResolvedValue(mockOrder);
      mockSettingFindOne.mockResolvedValue({ returnDeliveryCommission: 25 });
      mockSellerFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            shopName: "Daily Grocery",
            address: "Sadar Bazaar, Jhansi",
            phone: "9876543210",
          }),
        }),
      });
      mockUserFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            name: "Amit",
            phone: "9123456780",
          }),
        }),
      });

      await OrderReturnService.approveReturn(orderId, "admin_user", "admin");

      expect(mockCreateShiprocketReversePickup).not.toHaveBeenCalled();
      expect(mockEmitReturnBroadcastForCustomer).toHaveBeenCalled();
      expect(mockOrder.returnStatus).toBe("return_approved");
    });
  });

  describe("4. Stock Restocking on QC Pass", () => {
    it("should atomically restock product inventory and record StockHistory on qc_passed", async () => {
      const mockOrder = {
        _id: "order_mongo_id",
        orderId: "ORD_RESTOCK_01",
        seller: "seller_1",
        customer: "cust_1",
        status: "delivered",
        returnStatus: "qc_passed",
        returnRefundAmount: 500,
        returnDeliveryCommission: 25,
        paymentMode: "ONLINE",
        returnItems: [
          {
            product: "prod_tshirt",
            quantity: 2,
            price: 250,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderFindById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockOrder),
      });

      await OrderReturnService.completeReturnAndRefund(mockOrder);

      // Verify product stock incremented by 2
      expect(mockProductUpdateOne).toHaveBeenCalledWith(
        { _id: "prod_tshirt" },
        { $inc: { stock: 2 } },
        expect.objectContaining({ session: mockSession })
      );

      // Verify StockHistory entry created with type Restock
      expect(mockStockHistoryCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            product: "prod_tshirt",
            quantity: 2,
            type: "Restock",
          }),
        ]),
        expect.objectContaining({ session: mockSession })
      );

      // Verify refund credited to customer wallet
      expect(mockWalletCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: "cust_1",
          amount: 500,
          session: mockSession,
        })
      );
    });

    it("should NOT restock inventory when return is qc_failed", async () => {
      const mockOrder = {
        _id: "order_mongo_id_2",
        orderId: "ORD_QC_FAILED_02",
        seller: "seller_1",
        customer: "cust_1",
        status: "delivered",
        returnStatus: "qc_failed",
        returnRefundAmount: 0,
        returnDeliveryCommission: 25,
        returnItems: [
          {
            product: "prod_tshirt",
            quantity: 2,
            price: 250,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderFindById.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockOrder),
      });

      await OrderReturnService.completeReturnAndRefund(mockOrder);

      expect(mockProductUpdateOne).not.toHaveBeenCalled();
      expect(mockStockHistoryCreate).not.toHaveBeenCalled();
      expect(mockWalletCredit).not.toHaveBeenCalled();
    });
  });
});
