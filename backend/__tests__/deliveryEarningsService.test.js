import { jest } from "@jest/globals";
import mongoose from "mongoose";

const mockTransactionFind = jest.fn();
const mockWalletFindOne = jest.fn();

jest.unstable_mockModule("../app/models/transaction.js", () => ({
  default: {
    find: mockTransactionFind,
  },
}));

jest.unstable_mockModule("../app/models/wallet.js", () => ({
  default: {
    findOne: mockWalletFindOne,
  },
}));

jest.unstable_mockModule("../app/services/cacheService.js", () => ({
  buildKey: (...parts) => parts.join(":"),
  getTTL: () => 30,
  getOrSet: async (_key, fn) => fn(),
  invalidate: jest.fn(),
}));

const { getDeliveryEarnings } = await import(
  "../app/services/delivery/deliveryEarningsService.js"
);

describe("deliveryEarningsService - getDeliveryEarnings", () => {
  const deliveryBoyId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupMocks = (currentTxs = [], prevTxs = [], cashInHand = 150) => {
    // First call: current period query
    // Returns query chain: .sort().limit().populate()
    const currentQueryChain = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue(currentTxs),
    };

    // Second call: previous period query
    // Returns query chain: .select()
    const prevQueryChain = {
      select: jest.fn().mockResolvedValue(prevTxs),
    };

    mockTransactionFind
      .mockReturnValueOnce(currentQueryChain)
      .mockReturnValueOnce(prevQueryChain);

    mockWalletFindOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ cashInHand }),
      }),
    });
  };

  it("should return zero earnings and 0% growth when no orders exist", async () => {
    setupMocks([], [], 0);

    const result = await getDeliveryEarnings(deliveryBoyId, "daily", "2026-10-22T10:00:00Z");

    expect(result.totalEarnings).toBe(0);
    expect(result.growthPercentage).toBe(0);
    expect(result.prevEarnings).toBe(0);
    expect(result.comparisonLabel).toBe("yesterday");
    expect(result.breakdown).toBeDefined();
    expect(result.breakdown.baseEarnings).toBe(0);
    expect(result.breakdown.distanceEarnings).toBe(0);
    expect(result.breakdown.tipsReceived).toBe(0);
  });

  it("should return 100% growth when previous period had 0 and current has earnings", async () => {
    const currentTxs = [
      {
        type: "Delivery Earning",
        status: "Settled",
        amount: 75,
        createdAt: new Date("2026-10-22T12:00:00Z"),
        meta: { payoutBase: 50, payoutDistance: 25 },
      },
    ];

    setupMocks(currentTxs, [], 200);

    const result = await getDeliveryEarnings(deliveryBoyId, "monthly", "2026-10-22T10:00:00Z");

    expect(result.totalEarnings).toBe(75);
    expect(result.prevEarnings).toBe(0);
    expect(result.growthPercentage).toBe(100);
    expect(result.comparisonLabel).toBe("last month");
    expect(result.breakdown.baseEarnings).toBe(50);
    expect(result.breakdown.distanceEarnings).toBe(25);
    expect(result.breakdown.cashCollected).toBe(200);
  });

  it("should correctly compute percentage growth when both current and previous have earnings", async () => {
    const currentTxs = [
      {
        type: "Delivery Earning",
        status: "Settled",
        amount: 150,
        createdAt: new Date("2026-10-22T12:00:00Z"),
        meta: { payoutBase: 100, payoutDistance: 30, tipAmount: 20 },
      },
    ];

    const prevTxs = [
      {
        type: "Delivery Earning",
        status: "Settled",
        amount: 100,
      },
    ];

    setupMocks(currentTxs, prevTxs, 500);

    const result = await getDeliveryEarnings(deliveryBoyId, "weekly", "2026-10-22T10:00:00Z");

    // ((150 - 100) / 100) * 100 = 50%
    expect(result.totalEarnings).toBe(150);
    expect(result.prevEarnings).toBe(100);
    expect(result.growthPercentage).toBe(50);
    expect(result.comparisonLabel).toBe("last week");
    expect(result.tipsReceived).toBe(20);
    expect(result.breakdown.cashCollected).toBe(500);
  });
});
