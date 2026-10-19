import { jest } from "@jest/globals";

const mockWalletFindOne = jest.fn();
const mockWalletCreate = jest.fn();

const mockOrderAggregate = jest.fn();
const mockPayoutAggregate = jest.fn();
const mockTransactionAggregate = jest.fn();

jest.unstable_mockModule("../app/models/wallet.js", () => ({
  default: {
    findOne: mockWalletFindOne,
    create: mockWalletCreate,
  },
}));

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    aggregate: mockOrderAggregate,
  },
}));

jest.unstable_mockModule("../app/models/payout.js", () => ({
  default: {
    aggregate: mockPayoutAggregate,
  },
}));

jest.unstable_mockModule("../app/models/transaction.js", () => ({
  default: {
    aggregate: mockTransactionAggregate,
  },
}));

const { getAdminFinanceSummary } = await import(
  "../app/services/finance/walletService.js"
);

describe("getAdminFinanceSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionAggregate.mockResolvedValue([]);

    // Admin wallet exists with some available balance
    mockWalletFindOne.mockResolvedValue({
      ownerType: "ADMIN",
      ownerId: null,
      availableBalance: 999,
      pendingBalance: 0,
      cashInHand: 0,
      totalCredited: 0,
      totalDebited: 0,
      status: "ACTIVE",
      save: jest.fn(),
    });
  });

  it("computes systemFloatCOD from Transaction collection & settlement pipeline", async () => {
    // getAdminFinanceSummary runs 6 aggregates:
    // 1) onlineCollection, 2) codReconciled, 3) adminEarning, 4) pendingPayouts, 5) systemFloatCOD (Transaction), 6) platformGross
    mockOrderAggregate
      .mockResolvedValueOnce([{ _id: null, amount: 270 }]) // onlineCollection
      .mockResolvedValueOnce([{ _id: null, amount: 60 }]) // codReconciled
      .mockResolvedValueOnce([{ _id: null, amount: 50 }]) // adminEarning
      .mockResolvedValueOnce([{ _id: null, amount: 9999 }]); // platformGross

    mockPayoutAggregate.mockResolvedValueOnce([
      { _id: "SELLER", amount: 180 },
      { _id: "DELIVERY_PARTNER", amount: 40 },
    ]);

    mockTransactionAggregate.mockResolvedValueOnce([
      { _id: null, amount: 375.55 },
    ]);

    const summary = await getAdminFinanceSummary();

    expect(summary.systemFloatCOD).toBe(375.55);
    expect(summary.totalPlatformEarning).toBe(9999);
    expect(summary.availableBalance).toBe(9779);
    expect(summary.walletAvailableBalance).toBe(999);
    expect(mockOrderAggregate).toHaveBeenCalledTimes(4);
    expect(mockPayoutAggregate).toHaveBeenCalledTimes(1);
    expect(mockTransactionAggregate).toHaveBeenCalledTimes(1);
  });

  it("builds systemFloatCOD pipeline using Cash Collection & Cash Settlement aggregation on Delivery transactions", async () => {
    mockOrderAggregate
      .mockResolvedValueOnce([{ _id: null, amount: 0 }])
      .mockResolvedValueOnce([{ _id: null, amount: 0 }])
      .mockResolvedValueOnce([{ _id: null, amount: 0 }])
      .mockResolvedValueOnce([{ _id: null, amount: 0 }]);
    mockPayoutAggregate.mockResolvedValueOnce([]);
    mockTransactionAggregate.mockResolvedValueOnce([]);

    await getAdminFinanceSummary();

    const pipeline = mockTransactionAggregate.mock.calls[0]?.[0];
    expect(Array.isArray(pipeline)).toBe(true);
    expect(JSON.stringify(pipeline)).toContain("Cash Collection");
    expect(JSON.stringify(pipeline)).toContain("Cash Settlement");
  });
});
