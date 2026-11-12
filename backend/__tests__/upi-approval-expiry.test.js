import { jest } from "@jest/globals";

/**
 * UPI QR orders: auto-cancel + stock release when admin does not verify in time.
 * NO refund of any kind is created (the payment was never verified).
 * Order is an in-memory collection with Mongo-like conditional updates, so the
 * "admin approves at the same moment the job cancels" race is really exercised.
 */

const HOUR = 60 * 60 * 1000;
let store = [];

const getPath = (o, p) => p.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
const setPath = (o, p, v) => {
  const ks = p.split(".");
  let c = o;
  ks.slice(0, -1).forEach((k) => {
    if (c[k] == null || typeof c[k] !== "object") c[k] = {};
    c = c[k];
  });
  c[ks[ks.length - 1]] = v;
};
const same = (a, b) => String(a) === String(b);

function matches(doc, q) {
  return Object.entries(q).every(([path, cond]) => {
    const val = getPath(doc, path);
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      return Object.entries(cond).every(([op, arg]) => {
        if (op === "$in") return arg.some((x) => same(x, val));
        if (op === "$ne") return !same(arg, val);
        if (op === "$lte") return val != null && val <= arg;
        throw new Error("unsupported " + op);
      });
    }
    return same(cond, val);
  });
}
const clone = (d) => (d ? structuredClone(d) : null);
const chain = (rows) => {
  const q = {
    select: () => q,
    limit: (n) => {
      rows = rows.slice(0, n);
      return q;
    },
    lean: () => Promise.resolve(rows),
    then: (res, rej) => Promise.resolve(rows).then(res, rej),
  };
  return q;
};

const mockOrder = {
  findOne: jest.fn(async (q) => clone(store.find((d) => matches(d, q)))),
  find: jest.fn((q) => chain(store.filter((d) => matches(d, q)).map(clone))),
  findOneAndUpdate: jest.fn(async (q, update) => {
    const doc = store.find((d) => matches(d, q));
    if (!doc) return null;
    Object.entries(update.$set || {}).forEach(([k, v]) => setPath(doc, k, v));
    return clone(doc);
  }),
};

const mockCompensate = jest.fn();
const mockEmit = jest.fn();
// If the service ever touches these, the "no refund" tests below fail.
const mockCreditWallet = jest.fn();
const mockTxCreate = jest.fn();

jest.unstable_mockModule("../app/models/order.js", () => ({ default: mockOrder }));
jest.unstable_mockModule("../app/models/transaction.js", () => ({ default: { create: mockTxCreate } }));
jest.unstable_mockModule("../app/services/finance/walletService.js", () => ({ creditWallet: mockCreditWallet }));
jest.unstable_mockModule("../app/services/orderCompensation.js", () => ({
  compensateOrderCancellation: mockCompensate,
}));
jest.unstable_mockModule("../app/modules/notifications/notification.emitter.js", () => ({
  emitNotificationEvent: mockEmit,
}));
jest.unstable_mockModule("../app/services/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const svc = await import("../app/services/order/upiApprovalExpiryService.js");
const policy = await import("../app/utils/upiApprovalPolicy.js");
const { NOTIFICATION_EVENTS } = await import("../app/modules/notifications/notification.constants.js");

const NOW = new Date("2026-11-10T12:00:00Z");
const ago = (h) => new Date(NOW.getTime() - h * HOUR);

const makeOrder = (over = {}) => ({
  _id: "o1",
  orderId: "ORD-1",
  customer: "cust-1",
  seller: "sel-1",
  paymentMode: "UPI_QR",
  paymentStatus: "AWAITING_VERIFICATION",
  status: "pending",
  workflowStatus: "CREATED",
  utrNumber: "402938491029",
  upiApprovalExpiresAt: ago(1),
  pricing: { total: 8521 },
  stockReservation: { status: "COMMITTED" },
  ...over,
});

beforeEach(() => {
  store = [];
  jest.clearAllMocks();
  mockCompensate.mockImplementation(async (o) => {
    const d = store.find((x) => same(x._id, o._id));
    if (d) d.stockReservation = { status: "RELEASED" };
  });
});

const events = () => mockEmit.mock.calls.map((c) => c[0]);
const expectNoRefund = () => {
  expect(mockTxCreate).not.toHaveBeenCalled();
  expect(mockCreditWallet).not.toHaveBeenCalled();
};

describe("policy", () => {
  it("defaults to 48h admin approval and 24h to send a UTR", () => {
    expect(policy.getUpiApprovalPolicy()).toEqual({ approvalHours: 48, noUtrHours: 24 });
  });

  it("deadlines are computed from the given time", () => {
    expect(policy.expiryAfterUtrSubmitted(NOW).getTime()).toBe(NOW.getTime() + 48 * HOUR);
    expect(policy.expiryWaitingForUtr(NOW).getTime()).toBe(NOW.getTime() + 24 * HOUR);
  });

  it("is env-overridable and ignores nonsense", () => {
    process.env.UPI_QR_APPROVAL_HOURS = "12";
    process.env.UPI_QR_NO_UTR_HOURS = "abc";
    expect(policy.getUpiApprovalPolicy()).toEqual({ approvalHours: 12, noUtrHours: 24 });
    delete process.env.UPI_QR_APPROVAL_HOURS;
    delete process.env.UPI_QR_NO_UTR_HOURS;
  });
});

describe("sweep - what gets cancelled", () => {
  it("UTR submitted and 48h passed: cancelled, stock released, customer told - and NO refund of any kind", async () => {
    store.push(makeOrder());
    const out = await svc.expireUnverifiedUpiOrders({ now: NOW });
    expect(out).toMatchObject({ checked: 1, expired: 1, failed: 0 });

    expect(store[0]).toMatchObject({
      status: "cancelled",
      orderStatus: "cancelled",
      workflowStatus: "CANCELLED",
      cancelledBy: "system",
      paymentStatus: "FAILED",
      upiApprovalExpiresAt: null,
      utrNumber: "402938491029", // kept so admin can check the bank statement if the customer complains
    });
    expect(store[0].cancelReason).toMatch(/not verified within 48 hours/);
    expect(mockCompensate).toHaveBeenCalledTimes(1);
    expect(store[0].stockReservation.status).toBe("RELEASED");
    expectNoRefund();

    expect(events()).toEqual([NOTIFICATION_EVENTS.ORDER_CANCELLED]);
    const msg = mockEmit.mock.calls[0][1];
    expect(msg.customerId).toBe("cust-1");
    expect(msg.customerMessage).toMatch(/contact support/i);
    expect(msg.customerMessage).toMatch(/402938491029/);
    expect(msg.customerMessage).not.toMatch(/refund/i);
  });

  it("no UTR ever sent: cancelled and stock released, no refund", async () => {
    store.push(makeOrder({ utrNumber: null }));
    const out = await svc.expireUnverifiedUpiOrders({ now: NOW });
    expect(out.expired).toBe(1);
    expect(store[0].status).toBe("cancelled");
    expect(mockCompensate).toHaveBeenCalled();
    expectNoRefund();
  });

  it("rejected UTR and no correction sent: cancelled, no refund", async () => {
    store.push(makeOrder({ paymentStatus: "REJECTED" }));
    const out = await svc.expireUnverifiedUpiOrders({ now: NOW });
    expect(out.expired).toBe(1);
    expect(store[0].cancelReason).toMatch(/rejected/);
    expectNoRefund();
  });

  it("deadline not reached yet: untouched", async () => {
    store.push(makeOrder({ upiApprovalExpiresAt: new Date(NOW.getTime() + HOUR) }));
    expect((await svc.expireUnverifiedUpiOrders({ now: NOW })).checked).toBe(0);
    expect(store[0].status).toBe("pending");
    expect(mockCompensate).not.toHaveBeenCalled();
  });

  it("old orders without a deadline are NEVER cancelled", async () => {
    store.push(makeOrder({ upiApprovalExpiresAt: undefined }));
    store.push(makeOrder({ _id: "o2", orderId: "ORD-2", upiApprovalExpiresAt: null }));
    expect((await svc.expireUnverifiedUpiOrders({ now: NOW })).checked).toBe(0);
    expect(store.every((o) => o.status === "pending")).toBe(true);
  });

  it.each([
    ["verified (PAID)", { paymentStatus: "PAID" }],
    ["COD order", { paymentMode: "COD", paymentStatus: "PENDING_CASH_COLLECTION" }],
    ["online order", { paymentMode: "ONLINE", paymentStatus: "CREATED" }],
    ["already cancelled", { status: "cancelled" }],
  ])("%s is never touched, even with an old deadline", async (_name, over) => {
    store.push(makeOrder(over));
    expect((await svc.expireUnverifiedUpiOrders({ now: NOW })).expired).toBe(0);
    expect(mockCompensate).not.toHaveBeenCalled();
    expectNoRefund();
  });
});

describe("races and retries", () => {
  it("admin verifies first: the job loses, order stays paid", async () => {
    store.push(makeOrder({ paymentStatus: "PAID", upiApprovalExpiresAt: null }));
    const out = await svc.expireUpiOrder("o1", { now: NOW });
    expect(out.status).toBe("skipped");
    expect(store[0].status).toBe("pending");
    expect(mockCompensate).not.toHaveBeenCalled();
  });

  it("running the job twice never cancels twice", async () => {
    store.push(makeOrder());
    await svc.expireUnverifiedUpiOrders({ now: NOW });
    const second = await svc.expireUnverifiedUpiOrders({ now: NOW });
    expect(second).toMatchObject({ checked: 0, expired: 0 });
    expect(mockCompensate).toHaveBeenCalledTimes(1);
    expectNoRefund();
  });

  it("two jobs racing on the same order: exactly one wins", async () => {
    store.push(makeOrder());
    const [a, b] = await Promise.all([svc.expireUpiOrder("o1", { now: NOW }), svc.expireUpiOrder("o1", { now: NOW })]);
    expect([a.status, b.status].sort()).toEqual(["expired", "skipped"]);
    expect(mockCompensate).toHaveBeenCalledTimes(1);
  });

  it("stock release failing is retried on the next sweep (stock is not leaked)", async () => {
    store.push(makeOrder());
    mockCompensate.mockRejectedValueOnce(new Error("db blip")).mockRejectedValueOnce(new Error("db blip"));
    const first = await svc.expireUnverifiedUpiOrders({ now: NOW });
    expect(first.expired).toBe(1);
    expect(store[0].status).toBe("cancelled");
    expect(store[0].stockReservation.status).toBe("COMMITTED"); // both attempts failed

    const second = await svc.expireUnverifiedUpiOrders({ now: NOW });
    expect(second.retried).toBe(1);
    expect(store[0].stockReservation.status).toBe("RELEASED");
  });

  it("one bad order does not stop the others", async () => {
    store.push(makeOrder({ _id: "bad", orderId: "ORD-BAD" }));
    store.push(makeOrder({ _id: "good", orderId: "ORD-GOOD" }));
    mockCompensate.mockRejectedValueOnce(new Error("db down")).mockRejectedValueOnce(new Error("db down"));
    const out = await svc.expireUnverifiedUpiOrders({ now: NOW });
    expect(out.expired).toBe(2);
    expect(store.every((o) => o.status === "cancelled")).toBe(true);
  });
});
