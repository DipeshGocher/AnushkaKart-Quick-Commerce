import { jest } from "@jest/globals";
import mongoose from "mongoose";

const mockOrderAggregate = jest.fn();
const mockProductAggregate = jest.fn();

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    aggregate: mockOrderAggregate,
  },
}));

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    aggregate: mockProductAggregate,
  },
}));

jest.unstable_mockModule("../app/services/cacheService.js", () => ({
  buildKey: (...parts) => parts.join(":"),
  getTTL: () => 60,
  getOrSet: async (_key, fn) => fn(),
  invalidate: jest.fn(),
}));

const { getSellerStats } = await import("../app/services/seller/sellerStatsService.js");

describe("sellerStatsService getSellerStats", () => {
  const sellerId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should calculate totalOrders including cancelled orders, and compute cancellation rate and AOV", async () => {
    // Mock Order.aggregate response
    mockOrderAggregate.mockResolvedValue([
      {
        overview: [
          {
            totalSales: 3000,
            deliveredOrders: 2,
            cancelledOrders: 1,
            pendingOrders: 3,
            totalOrders: 6, // 2 delivered + 1 cancelled + 3 pending = 6 total orders
          },
        ],
        currentWeek: [{ sales: 1500, count: 1 }],
        prevWeek: [{ sales: 1500, count: 1 }],
        salesTrend: [
          { _id: "2026-10-18", sales: 1500, orders: 1 },
          { _id: "2026-10-19", sales: 1500, orders: 1 },
        ],
        topCities: [{ _id: "Jhansi", count: 6 }],
        peakHours: [{ _id: 14, count: 4 }],
        topProductsCurrent: [],
        topProductsPrev: [],
        trafficSources: [],
        devices: [{ _id: "Mobile", count: 6 }],
      },
    ]);

    mockProductAggregate.mockResolvedValue([
      { subject: "Groceries", A: 12, fullMark: 100 },
      { subject: "Electronics", A: 5, fullMark: 100 },
    ]);

    const result = await getSellerStats(sellerId.toString(), { range: "daily" });

    // Assertions
    expect(result).toBeDefined();
    expect(result.overview.totalOrders).toBe("6");
    expect(result.overview.totalOrdersRaw).toBe(6);
    expect(result.overview.deliveredOrders).toBe(2);
    expect(result.overview.cancelledOrders).toBe(1);
    expect(result.overview.pendingOrders).toBe(3);
    expect(result.overview.cancellationRate).toBe("16.7%"); // 1 / 6 = 16.666% -> 16.7%
    expect(result.overview.totalSales).toBe("₹3,000");
    expect(result.overview.avgOrderValue).toBe("₹1,500"); // 3000 / 2 delivered orders = 1500
    expect(result.categoryMix).toHaveLength(2);
    expect(result.categoryMix[0].subject).toBe("Groceries");
  });

  it("should handle 0 delivered orders and 0 total orders gracefully without NaN or errors", async () => {
    mockOrderAggregate.mockResolvedValue([
      {
        overview: [],
        currentWeek: [],
        prevWeek: [],
        salesTrend: [],
        topCities: [],
        peakHours: [],
        topProductsCurrent: [],
        topProductsPrev: [],
        trafficSources: [],
        devices: [],
      },
    ]);

    mockProductAggregate.mockResolvedValue([]);

    const result = await getSellerStats(sellerId.toString(), { range: "daily" });

    expect(result.overview.totalOrders).toBe("0");
    expect(result.overview.deliveredOrders).toBe(0);
    expect(result.overview.cancelledOrders).toBe(0);
    expect(result.overview.pendingOrders).toBe(0);
    expect(result.overview.cancellationRate).toBe("0.0%");
    expect(result.overview.totalSales).toBe("₹0");
    expect(result.overview.avgOrderValue).toBe("₹0");
  });
});
