import { jest } from "@jest/globals";

const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
};
const mockStartSession = jest.fn().mockResolvedValue(mockSession);

const mockCartFindOne = jest.fn();
const mockCustomerFindById = jest.fn();
const mockCouponFindByIdAndUpdate = jest.fn();
const mockCheckoutGroupFindOne = jest.fn();
const mockCheckoutGroupSave = jest.fn();
const mockOrderFind = jest.fn();
const mockTransactionCreate = jest.fn();
const mockReserveStockForItems = jest.fn();
const mockBuildCheckoutPricingSnapshot = jest.fn();
const mockGenerateUniqueCheckoutGroupId = jest.fn();
const mockGenerateUniquePublicOrderId = jest.fn();
const mockAfterPlaceOrderV2 = jest.fn();
const mockStoreIdempotencyResult = jest.fn();
const mockStoreIdempotencyError = jest.fn();
const mockReleaseIdempotencyLock = jest.fn();
const mockAcquireIdempotencyLock = jest.fn();
const mockCheckIdempotency = jest.fn();
const mockValidateIdempotencyKey = jest.fn();

let orderSequence = 0;

const CheckoutGroupMock = jest.fn().mockImplementation((doc) => ({
  ...doc,
  _id: "checkout-group-oid",
  save: mockCheckoutGroupSave,
  toObject() {
    return { ...this };
  },
}));
CheckoutGroupMock.findOne = mockCheckoutGroupFindOne;

const OrderMock = jest.fn().mockImplementation((doc) => {
  orderSequence += 1;
  return {
    ...doc,
    _id: `order-${orderSequence}`,
    save: jest.fn().mockResolvedValue(true),
    toObject() {
      return { ...this };
    },
  };
});
OrderMock.find = mockOrderFind;
OrderMock.findOne = jest.fn();

class MockSchema {
  constructor(def) { this.def = def; }
  index() {}
  pre() {}
  virtual() { return { get() {}, set() {} }; }
}
MockSchema.Types = { ObjectId: String };

jest.unstable_mockModule("mongoose", () => ({
  default: {
    startSession: mockStartSession,
    Schema: MockSchema,
    Types: { ObjectId: String },
    model: jest.fn(),
  },
  Schema: MockSchema,
  Types: { ObjectId: String },
  model: jest.fn(),
}));

jest.unstable_mockModule("../app/models/customer.js", () => ({
  default: {
    findById: mockCustomerFindById,
  },
}));

jest.unstable_mockModule("../app/models/coupon.js", () => ({
  default: {
    findByIdAndUpdate: mockCouponFindByIdAndUpdate,
  },
}));

jest.unstable_mockModule("../app/models/cart.js", () => ({
  default: {
    findOne: mockCartFindOne,
  },
}));

jest.unstable_mockModule("../app/models/checkoutGroup.js", () => ({
  default: CheckoutGroupMock,
}));

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: OrderMock,
}));

jest.unstable_mockModule("../app/models/transaction.js", () => ({
  default: {
    create: mockTransactionCreate,
  },
}));

jest.unstable_mockModule("../app/services/checkoutPricingService.js", () => ({
  buildCheckoutPricingSnapshot: mockBuildCheckoutPricingSnapshot,
}));

jest.unstable_mockModule("../app/services/stockService.js", () => ({
  computeStockReservationWindow: jest.fn(() => ({
    status: "RESERVED",
    reservedAt: new Date("2026-03-29T00:00:00.000Z"),
    expiresAt: new Date("2026-03-29T00:15:00.000Z"),
    releasedAt: null,
  })),
  reserveStockForItems: mockReserveStockForItems,
}));

jest.unstable_mockModule("../app/services/orderIdService.js", () => ({
  generateUniqueCheckoutGroupId: mockGenerateUniqueCheckoutGroupId,
  generateUniquePublicOrderId: mockGenerateUniquePublicOrderId,
}));

jest.unstable_mockModule("../app/services/orderWorkflowService.js", () => ({
  afterPlaceOrderV2: mockAfterPlaceOrderV2,
}));

jest.unstable_mockModule("../app/services/finance/orderFinanceService.js", () => ({
  freezeFinancialSnapshot: jest.fn((order, breakdown) => {
    order.paymentBreakdown = breakdown;
    order.pricing = {
      total: breakdown.grandTotal || 0,
    };
    return order;
  }),
}));

jest.unstable_mockModule("../app/services/idempotencyService.js", () => ({
  checkIdempotency: mockCheckIdempotency,
  acquireIdempotencyLock: mockAcquireIdempotencyLock,
  storeIdempotencyResult: mockStoreIdempotencyResult,
  storeIdempotencyError: mockStoreIdempotencyError,
  releaseIdempotencyLock: mockReleaseIdempotencyLock,
  isRetryableError: jest.fn((error) => Boolean(error?.retryable)),
  validateIdempotencyKey: mockValidateIdempotencyKey,
}));

jest.unstable_mockModule("../app/services/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { placeOrderAtomic } = await import("../app/services/orderPlacementService.js");

function mockLean(value) {
  return {
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe("checkout atomic service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderSequence = 0;
    mockCheckoutGroupSave.mockResolvedValue(true);
    mockTransactionCreate.mockResolvedValue([]);
    mockGenerateUniqueCheckoutGroupId.mockResolvedValue("CHK-01JSRTEST0000000000000000");
    mockGenerateUniquePublicOrderId
      .mockResolvedValueOnce("ORD-01JSRTEST0000000000000001")
      .mockResolvedValueOnce("ORD-01JSRTEST0000000000000002");
    mockCheckIdempotency.mockResolvedValue({
      exists: false,
      inProgress: false,
      checksumMismatch: false,
    });
    mockAcquireIdempotencyLock.mockResolvedValue(true);
    mockValidateIdempotencyKey.mockReturnValue(true);
    mockCheckoutGroupFindOne.mockReturnValue(mockLean(null));
    OrderMock.findOne.mockReturnValue(mockLean(null));
    mockOrderFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });
    mockCartFindOne.mockResolvedValue(null);
    mockCustomerFindById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: "67f0000000000000000000c1",
        walletBalance: 0,
      }),
    });
    mockCouponFindByIdAndUpdate.mockReturnValue({
      catch: jest.fn(),
    });
    mockReserveStockForItems.mockResolvedValue(undefined);
    mockBuildCheckoutPricingSnapshot.mockResolvedValue({
      sellerCount: 1,
      itemCount: 1,
      aggregateBreakdown: {
        currency: "INR",
        grandTotal: 120,
        productSubtotal: 100,
        deliveryFeeCharged: 20,
        handlingFeeCharged: 0,
        discountTotal: 0,
        taxTotal: 0,
        sellerPayoutTotal: 90,
        adminProductCommissionTotal: 10,
        riderPayoutTotal: 10,
        platformTotalEarning: 20,
        lineItems: [],
        snapshots: {},
      },
      sellerBreakdownEntries: [
        {
          sellerId: "67f000000000000000000001",
          distanceKm: 1.2,
          items: [
            {
              productId: "67f000000000000000000011",
              productName: "Apple",
              quantity: 1,
              price: 100,
              image: "https://cdn.test/apple.png",
            },
          ],
          breakdown: {
            currency: "INR",
            grandTotal: 120,
            productSubtotal: 100,
            deliveryFeeCharged: 20,
            handlingFeeCharged: 0,
            discountTotal: 0,
            taxTotal: 0,
            sellerPayoutTotal: 90,
            adminProductCommissionTotal: 10,
            riderPayoutTotal: 10,
            platformTotalEarning: 20,
            lineItems: [],
            snapshots: {},
          },
        },
      ],
    });
  });

  const CUSTOMER = "67f0000000000000000000c1";
  const baseItems = [{ product: "67f000000000000000000011", quantity: 1, price: 100 }];
  const place = (extra = {}, idempotencyKey = null) =>
    placeOrderAtomic({
      customerId: CUSTOMER,
      payload: { items: baseItems, address: { city: "Indore" }, paymentMode: "UPI_QR", ...extra },
      idempotencyKey,
    });
  const createdOrderDoc = () => OrderMock.mock.calls[0][0];

  test("UPI QR order placed together with a valid UTR stores it and waits for admin verification", async () => {
    await place({ utrNumber: "402938491029" });

    const doc = createdOrderDoc();
    expect(doc.paymentMode).toBe("UPI_QR");
    expect(doc.paymentStatus).toBe("AWAITING_VERIFICATION");
    expect(doc.utrNumber).toBe("402938491029");
    expect(doc.utrSubmittedAt).toBeInstanceOf(Date);
    expect(doc.payment).toMatchObject({ method: "upi_qr", status: "pending", transactionId: "402938491029" });
    expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
  });

  test("the UTR is looked up for duplicates before anything is reserved", async () => {
    await place({ utrNumber: "402938491029" });
    const query = OrderMock.findOne.mock.calls.find((c) => c[0]?.utrNumber)?.[0];
    expect(query).toMatchObject({
      utrNumber: "402938491029",
      paymentStatus: { $in: ["PAID", "AWAITING_VERIFICATION"] },
    });
  });

  test("a UTR already used by another order is rejected and nothing is created or reserved", async () => {
    OrderMock.findOne.mockReturnValue(mockLean({ orderId: "ORD-OLD" }));

    await expect(place({ utrNumber: "402938491029" })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("already been submitted"),
    });
    expect(OrderMock).not.toHaveBeenCalled();
    expect(mockReserveStockForItems).not.toHaveBeenCalled();
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  test.each(["12345", "abcdefghijkl", "1234567890123"])("invalid UTR %j for UPI QR is refused without side effects", async (bad) => {
    await expect(place({ utrNumber: bad })).rejects.toMatchObject({ statusCode: 400 });
    expect(OrderMock).not.toHaveBeenCalled();
    expect(mockReserveStockForItems).not.toHaveBeenCalled();
  });

  test("UPI QR order gets an auto-cancel deadline: 48h with a UTR, 24h without; COD gets none", async () => {
    await place({ utrNumber: "402938491029" });
    const withUtr = createdOrderDoc().upiApprovalExpiresAt.getTime() - Date.now();
    expect(withUtr).toBeGreaterThan(47.9 * 3600 * 1000);
    expect(withUtr).toBeLessThanOrEqual(48 * 3600 * 1000);

    OrderMock.mockClear();
    mockGenerateUniquePublicOrderId.mockResolvedValueOnce("ORD-01JSRTEST0000000000000003");
    await place();
    const noUtr = createdOrderDoc().upiApprovalExpiresAt.getTime() - Date.now();
    expect(noUtr).toBeGreaterThan(23.9 * 3600 * 1000);
    expect(noUtr).toBeLessThanOrEqual(24 * 3600 * 1000);

    OrderMock.mockClear();
    mockGenerateUniquePublicOrderId.mockResolvedValueOnce("ORD-01JSRTEST0000000000000004");
    mockAfterPlaceOrderV2.mockResolvedValue(undefined);
    await place({ paymentMode: "COD" });
    expect(createdOrderDoc().upiApprovalExpiresAt).toBeUndefined();
  });

  test("without a UTR the old behaviour is unchanged (order created, UTR submitted later)", async () => {
    await place();
    const doc = createdOrderDoc();
    expect(doc.paymentStatus).toBe("AWAITING_VERIFICATION");
    expect(doc.utrNumber).toBeUndefined();
    expect(doc.payment.transactionId).toBeUndefined();
  });

  test("a UTR sent with COD or online payment is ignored, never stored", async () => {
    mockAfterPlaceOrderV2.mockResolvedValue(undefined); // COD starts the seller workflow
    await place({ paymentMode: "COD", utrNumber: "402938491029" });
    const doc = createdOrderDoc();
    expect(doc.paymentMode).toBe("COD");
    expect(doc.utrNumber).toBeUndefined();
    expect(doc.paymentStatus).toBe("PENDING_CASH_COLLECTION");
    expect(OrderMock.findOne.mock.calls.some((c) => c[0]?.utrNumber)).toBe(false);
  });

  test("if the order cannot be created (e.g. out of stock) the whole thing rolls back and no UTR is recorded", async () => {
    mockReserveStockForItems.mockRejectedValueOnce(Object.assign(new Error("Insufficient stock"), { statusCode: 409 }));
    await expect(place({ utrNumber: "402938491029" })).rejects.toMatchObject({ statusCode: 409 });
    expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
    expect(mockSession.commitTransaction).not.toHaveBeenCalled();
  });
});

describe("create-order request validation accepts the UTR", () => {
  let createFinanceOrderSchema;
  beforeAll(async () => {
    ({ createFinanceOrderSchema } = await import("../app/validation/financeValidation.js"));
  });
  const base = {
    address: { address: "RNT Marg", city: "Indore", pincode: "452001" },
    paymentMode: "UPI_QR",
    items: [{ product: "67f000000000000000000011", quantity: 1 }],
  };

  test("12-digit UTR is accepted, no UTR is accepted (older clients)", () => {
    expect(createFinanceOrderSchema.validate({ ...base, utrNumber: "402938491029" }).error).toBeUndefined();
    expect(createFinanceOrderSchema.validate(base).error).toBeUndefined();
  });

  test.each(["123", "abcdefghijkl", "40293849102a"])("bad UTR %j is rejected with a clear message", (bad) => {
    const { error } = createFinanceOrderSchema.validate({ ...base, utrNumber: bad });
    expect(error?.message).toMatch(/12-digit/);
  });
});
