import { jest } from "@jest/globals";

/**
 * Return QC flow: time limits, evidence-backed failures, customer dispute,
 * admin decision, auto-pass, payout release and refund retry.
 *
 * The Order model is replaced by a tiny in-memory collection that implements
 * the Mongo semantics the service depends on (conditional findOneAndUpdate,
 * dotted $set, $in/$ne/$lt/$lte/$gte, null == missing). That lets us prove
 * the race-safety claims (two actors, only one wins) instead of just mocking them.
 */

const HOUR = 60 * 60 * 1000;
let store = [];

const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const setPath = (obj, path, value) => {
  const keys = path.split(".");
  let cur = obj;
  keys.slice(0, -1).forEach((k) => {
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  });
  cur[keys[keys.length - 1]] = value;
};
const same = (a, b) => String(a) === String(b);

function matches(doc, query) {
  return Object.entries(query).every(([path, cond]) => {
    if (path === "$or") return cond.some((q) => matches(doc, q));
    const val = getPath(doc, path);
    if (cond && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)) {
      return Object.entries(cond).every(([op, arg]) => {
        if (op === "$in") return arg.some((x) => (x === null ? val == null : same(x, val)));
        if (op === "$ne") return !same(arg, val);
        if (op === "$lt") return val != null && val < arg;
        if (op === "$lte") return val != null && val <= arg;
        if (op === "$gte") return val != null && val >= arg;
        throw new Error(`unsupported op ${op}`);
      });
    }
    if (cond === null) return val == null;
    return same(cond, val);
  });
}

function applyUpdate(doc, update) {
  Object.entries(update.$set || {}).forEach(([k, v]) => setPath(doc, k, v));
  Object.entries(update.$inc || {}).forEach(([k, v]) => setPath(doc, k, (getPath(doc, k) || 0) + v));
}

// Like Mongo, hand back a COPY (a snapshot), never the live stored document.
const wrap = (doc) => {
  if (!doc) return null;
  const copy = structuredClone(doc);
  return Object.assign(copy, { toObject: () => copy });
};
const query = (rows) => {
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
  findOne: jest.fn(async (q) => wrap(store.find((d) => matches(d, q)) || null)),
  find: jest.fn((q) => query(store.filter((d) => matches(d, q)))),
  findOneAndUpdate: jest.fn(async (q, update) => {
    const doc = store.find((d) => matches(d, q));
    if (!doc) return null;
    applyUpdate(doc, update);
    return wrap(doc);
  }),
  updateOne: jest.fn(async (q, update) => {
    const doc = store.find((d) => matches(d, q));
    if (!doc) return { modifiedCount: 0 };
    applyUpdate(doc, update);
    return { modifiedCount: 1 };
  }),
};

const mockPayoutFindOne = jest.fn();
const mockProcessPayout = jest.fn();
const mockEmit = jest.fn();
const mockAdminFind = jest.fn();
const mockRefund = jest.fn();

jest.unstable_mockModule("../app/models/order.js", () => ({ default: mockOrder }));
jest.unstable_mockModule("../app/models/payout.js", () => ({
  default: { findOne: (...a) => ({ select: () => ({ lean: () => mockPayoutFindOne(...a) }) }) },
}));
jest.unstable_mockModule("../app/models/admin.js", () => ({
  default: { find: () => ({ select: () => ({ lean: () => mockAdminFind() }) }) },
}));
jest.unstable_mockModule("../app/utils/orderLookup.js", () => ({
  orderMatchQueryFromRouteParam: (id) => ({ _id: id }),
}));
jest.unstable_mockModule("../app/modules/notifications/notification.emitter.js", () => ({
  emitNotificationEvent: mockEmit,
}));
jest.unstable_mockModule("../app/services/finance/payoutService.js", () => ({
  processPayout: mockProcessPayout,
}));
jest.unstable_mockModule("../app/services/order/orderReturnService.js", () => ({
  default: { completeReturnAndRefund: jest.fn() },
}));
jest.unstable_mockModule("../app/services/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const svc = await import("../app/services/order/returnQcService.js");
const policy = await import("../app/utils/returnQcPolicy.js");
const { NOTIFICATION_EVENTS } = await import("../app/modules/notifications/notification.constants.js");
const { buildNotification } = await import("../app/modules/notifications/notification.builder.js");

const NOW = new Date("2026-11-10T12:00:00Z");
const hoursAgo = (h) => new Date(NOW.getTime() - h * HOUR);
const SELLER = "seller-1";
const CUSTOMER = "cust-1";
const IMG = "https://cdn.example.com/proof.jpg";

const makeOrder = (over = {}) => ({
  _id: "o1",
  orderId: "ORD-1",
  seller: SELLER,
  customer: CUSTOMER,
  returnStatus: "returned",
  returnDeliveredBackAt: hoursAgo(1),
  returnRefundAmount: 500,
  returnQcReminderStage: 0,
  returnDispute: { status: "none" },
  settlementStatus: { sellerPayout: "HOLD" },
  ...over,
});

const seller = { id: SELLER, role: "seller" };
const admin = { id: "admin-1", role: "admin" };
const done = (o) => ({ ...o, returnStatus: "refund_completed" });

beforeEach(() => {
  store = [];
  jest.clearAllMocks();
  mockAdminFind.mockResolvedValue([{ _id: "admin-1" }]);
  mockRefund.mockImplementation(async (o) => {
    const doc = store.find((d) => String(d._id) === String(o._id));
    doc.returnStatus = "refund_completed";
    return doc;
  });
});

const events = () => mockEmit.mock.calls.map((c) => c[0]);
const payloadOf = (event) => mockEmit.mock.calls.find((c) => c[0] === event)?.[1];

describe("QC policy (pure)", () => {
  it("defaults: reminders 24h/40h, due 48h, auto-pass 72h, dispute window 48h", () => {
    const p = policy.getQcPolicy();
    expect(p.dueHours).toBe(48);
    expect(p.autoPassHours).toBe(72);
    expect(p.reminderHours).toEqual([24, 40]);
    expect(p.disputeWindowHours).toBe(48);
  });

  it("auto-pass can never be configured before the admin escalation", () => {
    process.env.RETURN_QC_DUE_HOURS = "48";
    process.env.RETURN_QC_AUTO_PASS_HOURS = "10";
    expect(policy.getQcPolicy().autoPassHours).toBeGreaterThan(48);
    delete process.env.RETURN_QC_DUE_HOURS;
    delete process.env.RETURN_QC_AUTO_PASS_HOURS;
  });

  it.each([
    [1, 0],
    [23.9, 0],
    [24, 1],
    [39.9, 1],
    [40, 2],
    [47.9, 2],
    [48, 3],
    [60, 3],
  ])("returned %sh ago -> SLA stage %s", (h, stage) => {
    expect(policy.getQcTargetStage(makeOrder({ returnDeliveredBackAt: hoursAgo(h) }), NOW)).toBe(stage);
  });

  it("auto-pass starts at 72h, not before", () => {
    expect(policy.shouldAutoPass(makeOrder({ returnDeliveredBackAt: hoursAgo(71.9) }), NOW)).toBe(false);
    expect(policy.shouldAutoPass(makeOrder({ returnDeliveredBackAt: hoursAgo(72) }), NOW)).toBe(true);
  });

  it("legacy orders without returnDeliveredBackAt fall back to updatedAt", () => {
    const o = makeOrder({ returnDeliveredBackAt: undefined, updatedAt: hoursAgo(80) });
    expect(policy.shouldAutoPass(o, NOW)).toBe(true);
  });

  it("dispute is only openable on a failed QC, once, inside the window", () => {
    const failed = (over) => makeOrder({ returnStatus: "qc_failed", returnQcAt: hoursAgo(1), ...over });
    expect(policy.isDisputeOpenable(failed(), NOW)).toBe(true);
    expect(policy.isDisputeOpenable(failed({ returnQcAt: hoursAgo(49) }), NOW)).toBe(false);
    expect(policy.isDisputeOpenable(failed({ returnDispute: { status: "open" } }), NOW)).toBe(false);
    expect(policy.isDisputeOpenable(makeOrder(), NOW)).toBe(false);
  });
});

describe("completeQc — QC passed", () => {
  it("seller passes: claims the order then refunds the customer", async () => {
    store.push(makeOrder());
    const { order } = await svc.completeQc({ orderId: "o1", actor: seller, qcStatus: "qc_passed", completeRefund: mockRefund, now: NOW });
    expect(mockRefund).toHaveBeenCalledTimes(1);
    expect(order.returnStatus).toBe("refund_completed");
    expect(store[0].returnQcStatus).toBe("passed");
    expect(store[0].returnQcByRole).toBe("seller");
    expect(store[0].returnQcAutoPassed).toBe(false);
  });

  it("accepts both qc_passed and passed spellings", async () => {
    store.push(makeOrder());
    await svc.completeQc({ orderId: "o1", actor: admin, qcStatus: "passed", completeRefund: mockRefund, now: NOW });
    expect(store[0].returnQcByRole).toBe("admin");
  });

  it("another seller cannot QC this order and nothing changes", async () => {
    store.push(makeOrder());
    await expect(
      svc.completeQc({ orderId: "o1", actor: { id: "other", role: "seller" }, qcStatus: "qc_passed", completeRefund: mockRefund }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(store[0].returnStatus).toBe("returned");
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it("customer role / unknown role is rejected", async () => {
    store.push(makeOrder());
    await expect(
      svc.completeQc({ orderId: "o1", actor: { id: CUSTOMER, role: "customer" }, qcStatus: "qc_passed" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("cannot QC before the item is returned", async () => {
    store.push(makeOrder({ returnStatus: "return_in_transit" }));
    await expect(
      svc.completeQc({ orderId: "o1", actor: seller, qcStatus: "qc_passed", completeRefund: mockRefund }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(store[0].returnStatus).toBe("return_in_transit");
  });

  it("invalid qcStatus is a 400 and writes nothing", async () => {
    store.push(makeOrder());
    await expect(svc.completeQc({ orderId: "o1", actor: seller, qcStatus: "maybe" })).rejects.toMatchObject({ statusCode: 400 });
    expect(mockOrder.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("completeQc — refund failure and retry (the old stuck-order bug)", () => {
  it("if the refund throws, order stays qc_passed with the error recorded", async () => {
    store.push(makeOrder());
    mockRefund.mockRejectedValueOnce(new Error("Insufficient available balance"));
    await expect(
      svc.completeQc({ orderId: "o1", actor: seller, qcStatus: "qc_passed", completeRefund: mockRefund, now: NOW }),
    ).rejects.toMatchObject({ statusCode: 500, message: expect.stringContaining("retried automatically") });
    expect(store[0].returnStatus).toBe("qc_passed");
    expect(store[0].returnRefundAttempts).toBe(1);
    expect(store[0].returnRefundLastError).toMatch(/Insufficient/);
  });

  it("clicking QC passed again retries the refund instead of failing with 'already returned'", async () => {
    store.push(makeOrder({ returnStatus: "qc_passed", returnQcAt: hoursAgo(1), returnRefundAttempts: 1 }));
    const { order, retried } = await svc.completeQc({ orderId: "o1", actor: seller, qcStatus: "qc_passed", completeRefund: mockRefund, now: NOW });
    expect(retried).toBe(true);
    expect(order.returnStatus).toBe("refund_completed");
  });

  it("a refund executor that silently does nothing is treated as a failure, not success", async () => {
    store.push(makeOrder());
    mockRefund.mockImplementationOnce(async (o) => o); // still qc_passed
    await expect(
      svc.completeQc({ orderId: "o1", actor: seller, qcStatus: "qc_passed", completeRefund: mockRefund, now: NOW }),
    ).rejects.toMatchObject({ statusCode: 500 });
  });

  it("retry job refunds old stuck qc_passed orders but leaves fresh ones alone", async () => {
    store.push(makeOrder({ _id: "stuck", returnStatus: "qc_passed", returnQcAt: hoursAgo(2) }));
    store.push(makeOrder({ _id: "fresh", returnStatus: "qc_passed", returnQcAt: new Date(NOW.getTime() - 60 * 1000) }));
    const out = await svc.retryPendingRefunds({ completeRefund: mockRefund, now: NOW });
    expect(out).toEqual({ checked: 1, refunded: 1, failed: 0 });
    expect(store.find((d) => d._id === "fresh").returnStatus).toBe("qc_passed");
  });

  it("after 8 failed attempts the retry job stops and alerts admin once", async () => {
    store.push(makeOrder({ returnStatus: "qc_passed", returnQcAt: hoursAgo(5), returnRefundAttempts: 7 }));
    mockRefund.mockRejectedValue(new Error("boom"));
    await svc.retryPendingRefunds({ completeRefund: mockRefund, now: NOW });
    expect(events()).toContain(NOTIFICATION_EVENTS.RETURN_REFUND_FAILED);
    mockEmit.mockClear();
    mockRefund.mockClear();
    const again = await svc.retryPendingRefunds({ completeRefund: mockRefund, now: NOW });
    expect(again.checked).toBe(0);
    expect(mockRefund).not.toHaveBeenCalled();
  });
});

describe("completeQc — QC failed needs proof, holds the payout", () => {
  const fail = (over = {}) =>
    svc.completeQc({
      orderId: "o1",
      actor: seller,
      qcStatus: "qc_failed",
      note: "Screen is cracked, not the condition shown at pickup",
      evidenceImages: [IMG],
      completeRefund: mockRefund,
      now: NOW,
      ...over,
    });

  it("requires a real reason (>= 10 chars) — and changes nothing without it", async () => {
    store.push(makeOrder());
    await expect(fail({ note: "bad" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(fail({ note: "" })).rejects.toMatchObject({ statusCode: 400 });
    expect(store[0].returnStatus).toBe("returned");
  });

  it("requires at least one photo — and changes nothing without it", async () => {
    store.push(makeOrder());
    await expect(fail({ evidenceImages: [] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(fail({ evidenceImages: undefined })).rejects.toMatchObject({ statusCode: 400 });
    expect(store[0].returnStatus).toBe("returned");
    expect(store[0].returnQcAt).toBeUndefined();
  });

  it("rejects non-URL evidence and more than 5 images", async () => {
    store.push(makeOrder());
    await expect(fail({ evidenceImages: ["javascript:alert(1)"] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(fail({ evidenceImages: Array(6).fill(IMG) })).rejects.toMatchObject({ statusCode: 400 });
    expect(store[0].returnStatus).toBe("returned");
  });

  it("valid failure: saved with evidence, NO refund, NO payout release, customer notified with dispute window", async () => {
    store.push(makeOrder());
    const { order } = await fail();
    expect(order.returnStatus).toBe("qc_failed");
    expect(store[0].returnQcEvidenceImages).toEqual([IMG]);
    expect(store[0].returnDispute.status).toBe("none");
    expect(mockRefund).not.toHaveBeenCalled();
    expect(mockProcessPayout).not.toHaveBeenCalled();
    expect(store[0].settlementStatus.sellerPayout).toBe("HOLD");
    const p = payloadOf(NOTIFICATION_EVENTS.RETURN_QC_FAILED);
    expect(p.customerId).toBe(CUSTOMER);
    expect(p.data.disputeWindowHours).toBe(48);
    expect(p.data.disputeDeadline).toBe(new Date(NOW.getTime() + 48 * HOUR).toISOString());
  });

  it("the system (auto-pass) can never fail a QC", async () => {
    store.push(makeOrder());
    await expect(fail({ actor: { role: "system" } })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("race safety — only one decision can win", () => {
  it("seller and auto-pass fire together: exactly one refund, the loser gets 409", async () => {
    store.push(makeOrder({ returnDeliveredBackAt: hoursAgo(80) }));
    const results = await Promise.allSettled([
      svc.completeQc({ orderId: "o1", actor: seller, qcStatus: "qc_passed", completeRefund: mockRefund, now: NOW }),
      svc.completeQc({ orderId: "o1", actor: { role: "system" }, qcStatus: "qc_passed", completeRefund: mockRefund, now: NOW }),
    ]);
    expect(mockRefund).toHaveBeenCalledTimes(1);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.statusCode).toBe(409);
  });

  it("a fresh qc_passed whose refund is still running is not refunded a second time by a repeat click", async () => {
    store.push(makeOrder({ returnStatus: "qc_passed", returnQcAt: new Date(NOW.getTime() - 5000), returnRefundAttempts: 0 }));
    await expect(
      svc.completeQc({ orderId: "o1", actor: seller, qcStatus: "qc_passed", completeRefund: mockRefund, now: NOW }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it("seller fails while admin passes: whoever claims first wins, never both", async () => {
    store.push(makeOrder());
    await Promise.allSettled([
      svc.completeQc({ orderId: "o1", actor: seller, qcStatus: "qc_failed", note: "Damaged beyond use, see photo", evidenceImages: [IMG], now: NOW }),
      svc.completeQc({ orderId: "o1", actor: admin, qcStatus: "qc_passed", completeRefund: mockRefund, now: NOW }),
    ]);
    const final = store[0].returnStatus;
    expect(["qc_failed", "refund_completed"]).toContain(final);
    if (final === "qc_failed") expect(mockRefund).not.toHaveBeenCalled();
  });
});

describe("SLA sweep: reminders -> admin escalation -> auto-pass", () => {
  const run = () => svc.sweepReturnQcDeadlines({ completeRefund: mockRefund, now: NOW });

  it("does nothing for a fresh return", async () => {
    store.push(makeOrder({ returnDeliveredBackAt: hoursAgo(2) }));
    expect(await run()).toMatchObject({ reminded: 0, escalated: 0, autoPassed: 0 });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("24h: reminds the seller once; running again does not spam", async () => {
    store.push(makeOrder({ returnDeliveredBackAt: hoursAgo(25) }));
    expect((await run()).reminded).toBe(1);
    expect(events()).toEqual([NOTIFICATION_EVENTS.RETURN_QC_REMINDER]);
    expect(payloadOf(NOTIFICATION_EVENTS.RETURN_QC_REMINDER).sellerId).toBe(SELLER);
    expect((await run()).reminded).toBe(0);
    expect(mockEmit).toHaveBeenCalledTimes(1);
  });

  it("41h: second reminder", async () => {
    store.push(makeOrder({ returnDeliveredBackAt: hoursAgo(41), returnQcReminderStage: 1 }));
    expect((await run()).reminded).toBe(1);
    expect(store[0].returnQcReminderStage).toBe(2);
  });

  it("49h: escalates to admin (and seller) once, order is still waiting", async () => {
    store.push(makeOrder({ returnDeliveredBackAt: hoursAgo(49), returnQcReminderStage: 2 }));
    expect((await run()).escalated).toBe(1);
    expect(payloadOf(NOTIFICATION_EVENTS.RETURN_QC_ESCALATED).adminIds).toEqual(["admin-1"]);
    expect(store[0].returnStatus).toBe("returned");
    expect((await run()).escalated).toBe(0);
  });

  it("73h: auto-passes, refunds the customer, flags it as system + notifies", async () => {
    store.push(makeOrder({ returnDeliveredBackAt: hoursAgo(73), returnQcReminderStage: 3 }));
    expect((await run()).autoPassed).toBe(1);
    expect(mockRefund).toHaveBeenCalledTimes(1);
    expect(store[0].returnStatus).toBe("refund_completed");
    expect(store[0].returnQcAutoPassed).toBe(true);
    expect(store[0].returnQcByRole).toBe("system");
    expect(store[0].returnQcNote).toMatch(/Auto-approved/);
    expect(events()).toContain(NOTIFICATION_EVENTS.RETURN_QC_AUTO_PASSED);
  });

  it("an order that was never reminded still auto-passes (e.g. job was down)", async () => {
    store.push(makeOrder({ returnDeliveredBackAt: hoursAgo(100), returnQcReminderStage: 0 }));
    expect((await run()).autoPassed).toBe(1);
  });

  it("one order failing does not stop the others", async () => {
    store.push(makeOrder({ _id: "bad", returnDeliveredBackAt: hoursAgo(80) }));
    store.push(makeOrder({ _id: "good", returnDeliveredBackAt: hoursAgo(80) }));
    mockRefund.mockRejectedValueOnce(new Error("db down"));
    const out = await run();
    expect(out.failed).toBe(1);
    expect(out.autoPassed).toBe(1);
  });

  it("ignores orders that are not at 'returned'", async () => {
    store.push(makeOrder({ returnStatus: "qc_failed", returnDeliveredBackAt: hoursAgo(100) }));
    store.push(makeOrder({ _id: "o2", returnStatus: "refund_completed", returnDeliveredBackAt: hoursAgo(100) }));
    expect((await run()).checked).toBe(0);
  });
});

describe("customer dispute", () => {
  const failedOrder = (over = {}) =>
    makeOrder({ returnStatus: "qc_failed", returnQcStatus: "failed", returnQcAt: hoursAgo(2), ...over });
  const dispute = (over = {}) =>
    svc.raiseDispute({
      customerId: CUSTOMER,
      orderId: "o1",
      reason: "The item was fine when I sent it, here is proof",
      images: [IMG],
      now: NOW,
      ...over,
    });

  it("opens a dispute and tells admin + seller", async () => {
    store.push(failedOrder());
    const o = await dispute();
    expect(o.returnDispute.status).toBe("open");
    expect(store[0].returnDispute.reason).toMatch(/fine when I sent/);
    expect(store[0].returnDispute.images).toEqual([IMG]);
    const p = payloadOf(NOTIFICATION_EVENTS.RETURN_DISPUTE_RAISED);
    expect(p.adminIds).toEqual(["admin-1"]);
    expect(p.sellerId).toBe(SELLER);
  });

  it("needs a real reason", async () => {
    store.push(failedOrder());
    await expect(dispute({ reason: "no" })).rejects.toMatchObject({ statusCode: 400 });
    expect(store[0].returnDispute.status).toBe("none");
  });

  it("only the order's own customer can dispute (others get 404)", async () => {
    store.push(failedOrder());
    await expect(dispute({ customerId: "someone-else" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("only after a failed QC", async () => {
    store.push(failedOrder({ returnStatus: "returned" }));
    await expect(dispute()).rejects.toMatchObject({ statusCode: 400 });
  });

  it("only inside the 48h window", async () => {
    store.push(failedOrder({ returnQcAt: hoursAgo(49) }));
    await expect(dispute()).rejects.toMatchObject({ statusCode: 400 });
    expect(store[0].returnDispute.status).toBe("none");
  });

  it("only once", async () => {
    store.push(failedOrder());
    await dispute();
    await expect(dispute()).rejects.toMatchObject({ statusCode: 409 });
  });

  it("double-click race: exactly one dispute is created", async () => {
    store.push(failedOrder());
    const r = await Promise.allSettled([dispute(), dispute()]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(mockEmit.mock.calls.filter((c) => c[0] === NOTIFICATION_EVENTS.RETURN_DISPUTE_RAISED)).toHaveLength(1);
  });
});

describe("admin resolves a dispute", () => {
  const open = (over = {}) =>
    makeOrder({
      returnStatus: "qc_failed",
      returnQcAt: hoursAgo(2),
      returnDispute: { status: "open", reason: "x".repeat(20) },
      ...over,
    });
  const resolve = (decision, over = {}) =>
    svc.resolveDispute({ adminId: "admin-1", orderId: "o1", decision, note: "Reviewed both sides and the photos", completeRefund: mockRefund, now: NOW, ...over });

  it("customer right: overturned, treated as QC passed, customer refunded, both notified", async () => {
    store.push(open());
    const { order } = await resolve("customer");
    expect(mockRefund).toHaveBeenCalledTimes(1);
    expect(order.returnStatus).toBe("refund_completed");
    expect(store[0].returnDispute.status).toBe("overturned");
    expect(store[0].returnQcStatus).toBe("passed");
    expect(store[0].returnDispute.resolutionNote).toMatch(/Reviewed/);
    expect(payloadOf(NOTIFICATION_EVENTS.RETURN_DISPUTE_RESOLVED).data.decision).toBe("customer");
  });

  it("customer right but refund fails: stays qc_passed so it can be retried (money is not lost)", async () => {
    store.push(open());
    mockRefund.mockRejectedValueOnce(new Error("wallet error"));
    await expect(resolve("customer")).rejects.toMatchObject({ statusCode: 500 });
    expect(store[0].returnStatus).toBe("qc_passed");
    expect(store[0].returnDispute.status).toBe("overturned");
    const retry = await svc.retryPendingRefunds({ completeRefund: mockRefund, now: new Date(NOW.getTime() + HOUR) });
    expect(retry.refunded).toBe(1);
  });

  it("seller right: failure stands, seller payout released immediately, no refund", async () => {
    store.push(open());
    mockPayoutFindOne.mockResolvedValue({ _id: "pay-1" });
    const { order } = await resolve("seller");
    expect(order.returnStatus).toBe("qc_failed");
    expect(store[0].returnDispute.status).toBe("upheld");
    expect(mockRefund).not.toHaveBeenCalled();
    expect(mockProcessPayout).toHaveBeenCalledWith("pay-1");
    expect(store[0].returnQcPayoutReleasedAt).toBeInstanceOf(Date);
  });

  it("needs a note and a valid decision — nothing changes otherwise", async () => {
    store.push(open());
    await expect(resolve("customer", { note: "" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(resolve("both")).rejects.toMatchObject({ statusCode: 400 });
    expect(store[0].returnDispute.status).toBe("open");
  });

  it("no open dispute -> 400", async () => {
    store.push(open({ returnDispute: { status: "none" } }));
    await expect(resolve("customer")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("cannot be resolved twice (double click)", async () => {
    store.push(open());
    mockPayoutFindOne.mockResolvedValue(null);
    const r = await Promise.allSettled([resolve("customer"), resolve("seller")]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(mockRefund.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe("seller payout after a failed QC", () => {
  const failed = (over = {}) =>
    makeOrder({ returnStatus: "qc_failed", returnQcAt: hoursAgo(49), returnDispute: { status: "none" }, ...over });

  it("window still open: payout stays on hold", async () => {
    store.push(failed({ returnQcAt: hoursAgo(10) }));
    expect(await svc.releaseExpiredDisputeWindows({ now: NOW })).toEqual({ checked: 0, released: 0 });
    expect(mockProcessPayout).not.toHaveBeenCalled();
  });

  it("window closed, no dispute: payout released exactly once across repeated job runs", async () => {
    store.push(failed());
    mockPayoutFindOne.mockResolvedValue({ _id: "pay-1" });
    expect((await svc.releaseExpiredDisputeWindows({ now: NOW })).released).toBe(1);
    expect((await svc.releaseExpiredDisputeWindows({ now: NOW })).checked).toBe(0);
    expect(mockProcessPayout).toHaveBeenCalledTimes(1);
  });

  it("an open dispute blocks the release no matter how old", async () => {
    store.push(failed({ returnQcAt: hoursAgo(500), returnDispute: { status: "open" } }));
    expect((await svc.releaseExpiredDisputeWindows({ now: NOW })).checked).toBe(0);
    expect(await svc.releaseSellerPayoutAfterQcFail("o1")).toBe(false);
    expect(mockProcessPayout).not.toHaveBeenCalled();
  });

  it("payout already completed earlier (legacy) is never paid twice", async () => {
    store.push(failed({ settlementStatus: { sellerPayout: "COMPLETED" } }));
    expect((await svc.releaseExpiredDisputeWindows({ now: NOW })).checked).toBe(0);
    expect(await svc.releaseSellerPayoutAfterQcFail("o1")).toBe(false);
  });

  it("processPayout failing is retried later, but capped at 5 attempts", async () => {
    store.push(failed());
    mockPayoutFindOne.mockResolvedValue({ _id: "pay-1" });
    mockProcessPayout.mockRejectedValue(new Error("bank down"));
    for (let i = 0; i < 7; i++) await svc.releaseExpiredDisputeWindows({ now: NOW });
    expect(mockProcessPayout).toHaveBeenCalledTimes(5);
    expect(store[0].returnQcPayoutReleasedAt).toBeUndefined();
  });

  it("manual-release mode just un-holds the payout", async () => {
    process.env.AUTO_RELEASE_SELLER_PAYOUT = "false";
    store.push(failed());
    await svc.releaseExpiredDisputeWindows({ now: NOW });
    expect(store[0].settlementStatus.sellerPayout).toBe("PENDING");
    expect(mockProcessPayout).not.toHaveBeenCalled();
    delete process.env.AUTO_RELEASE_SELLER_PAYOUT;
  });
});

describe("notification copy", () => {
  it("failed-QC message to the customer mentions the reason and the dispute option", () => {
    const [n] = buildNotification(NOTIFICATION_EVENTS.RETURN_QC_FAILED, {
      orderId: "ORD-1",
      customerId: CUSTOMER,
      data: { note: "Screen cracked", disputeWindowHours: 48 },
    });
    expect(n.body).toMatch(/Screen cracked/);
    expect(n.body).toMatch(/dispute/i);
    expect(n.role).toBe("customer");
  });

  it.each([
    [NOTIFICATION_EVENTS.RETURN_QC_REMINDER, { sellerId: SELLER }, ["seller"]],
    [NOTIFICATION_EVENTS.RETURN_QC_ESCALATED, { sellerId: SELLER, adminIds: ["a1", "a2"] }, ["admin", "admin", "seller"]],
    [NOTIFICATION_EVENTS.RETURN_QC_AUTO_PASSED, { sellerId: SELLER, customerId: CUSTOMER }, ["customer", "seller"]],
    [NOTIFICATION_EVENTS.RETURN_DISPUTE_RAISED, { sellerId: SELLER, adminIds: ["a1"] }, ["admin", "seller"]],
    [NOTIFICATION_EVENTS.RETURN_DISPUTE_RESOLVED, { sellerId: SELLER, customerId: CUSTOMER, data: { decision: "seller" } }, ["customer", "seller"]],
    [NOTIFICATION_EVENTS.RETURN_REFUND_FAILED, { adminIds: ["a1"] }, ["admin"]],
  ])("%s reaches the right people", (event, payload, roles) => {
    const out = buildNotification(event, { orderId: "ORD-1", ...payload });
    expect(out.map((n) => n.role).sort()).toEqual([...roles].sort());
    out.forEach((n) => expect(n.body).toBeTruthy());
  });
});
