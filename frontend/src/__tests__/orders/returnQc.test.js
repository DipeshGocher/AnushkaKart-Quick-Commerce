import {
  formatDuration,
  getQcCountdown,
  getDisputeInfo,
  getQcDeciderLabel,
} from "../../shared/utils/returnQc.js";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-10T12:00:00Z").getTime();
const at = (hoursFromNow) => new Date(NOW + hoursFromNow * HOUR).toISOString();

const returned = (dueInH, autoPassInH) => ({
  returnStatus: "returned",
  qc: {
    policy: { dueHours: 48, autoPassHours: 72, disputeWindowHours: 48 },
    qcDueAt: at(dueInH),
    qcAutoPassAt: at(autoPassInH),
  },
});

describe("formatDuration", () => {
  it.each([
    [30 * 1000, "1m"],
    [45 * 60 * 1000, "45m"],
    [5 * HOUR, "5h"],
    [5 * HOUR + 20 * 60 * 1000, "5h 20m"],
    [2 * 24 * HOUR, "2d"],
    [2 * 24 * HOUR + 3 * HOUR, "2d 3h"],
  ])("%s ms -> %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe("getQcCountdown (seller / admin)", () => {
  it("is null unless the return is waiting for QC", () => {
    expect(getQcCountdown({ returnStatus: "qc_failed", qc: {} }, NOW)).toBeNull();
    expect(getQcCountdown({ returnStatus: "returned" }, NOW)).toBeNull();
    expect(getQcCountdown(null, NOW)).toBeNull();
  });

  it("far from the deadline: calm info tone with the remaining time", () => {
    const c = getQcCountdown(returned(40, 64), NOW);
    expect(c.tone).toBe("info");
    expect(c.label).toBe("QC due in 1d 16h");
    expect(c.detail).toMatch(/72 hours/);
  });

  it("last 8 hours: warning", () => {
    expect(getQcCountdown(returned(6, 30), NOW).tone).toBe("warning");
  });

  it("overdue: red, and says how long until the customer is auto-refunded", () => {
    const c = getQcCountdown(returned(-2, 22), NOW);
    expect(c.tone).toBe("danger");
    expect(c.label).toBe("Overdue - auto-refund in 22h");
  });

  it("past auto-pass time: says it is being auto-approved", () => {
    const c = getQcCountdown(returned(-30, -1), NOW);
    expect(c.tone).toBe("danger");
    expect(c.label).toMatch(/Auto-approving/);
  });
});

describe("getDisputeInfo", () => {
  const failed = (over = {}) => ({
    returnStatus: "qc_failed",
    returnDispute: { status: "none" },
    qc: { canDispute: true, disputeWindowEndsAt: at(30) },
    ...over,
  });

  it("not relevant before QC fails", () => {
    expect(getDisputeInfo({ returnStatus: "returned" }, NOW)).toBeNull();
    expect(getDisputeInfo({ returnStatus: "refund_completed" }, NOW)).toBeNull();
  });

  it("window open: shows the time left", () => {
    const d = getDisputeInfo(failed(), NOW);
    expect(d.status).toBe("window");
    expect(d.label).toBe("Customer can dispute for 1d 6h");
  });

  it("open dispute", () => {
    expect(getDisputeInfo(failed({ returnDispute: { status: "open" } }), NOW).status).toBe("open");
  });

  it("upheld = failure stands", () => {
    expect(getDisputeInfo(failed({ returnDispute: { status: "upheld" } }), NOW).status).toBe("upheld");
  });

  it("window over without a dispute: closed (also for old orders with no qc info)", () => {
    expect(getDisputeInfo(failed({ qc: { canDispute: false, disputeWindowEndsAt: at(-1) } }), NOW).status).toBe("closed");
    expect(getDisputeInfo({ returnStatus: "qc_failed" }, NOW).status).toBe("closed");
  });

  it("overturned dispute is reported even after the order moved on to refunded", () => {
    const d = getDisputeInfo({ returnStatus: "refund_completed", returnDispute: { status: "overturned" } }, NOW);
    expect(d.status).toBe("overturned");
    expect(d.tone).toBe("success");
  });
});

describe("getQcDeciderLabel", () => {
  it.each([
    [{ returnQcAutoPassed: true }, "Auto-approved (QC time ran out)"],
    [{ returnQcByRole: "system" }, "Auto-approved (QC time ran out)"],
    [{ returnQcByRole: "admin" }, "Checked by admin"],
    [{ returnQcByRole: "seller" }, "Checked by seller"],
    [{}, ""],
  ])("%j", (ret, label) => {
    expect(getQcDeciderLabel(ret)).toBe(label);
  });
});
