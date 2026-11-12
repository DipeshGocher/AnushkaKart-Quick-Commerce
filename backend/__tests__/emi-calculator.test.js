import { jest } from "@jest/globals";
import {
  calculateEmi,
  DEFAULT_EMI_CONFIG,
  firstEmiDate,
  pickFileCharge,
  istDateParts,
} from "../app/utils/financeCalculator.js";
import { encryptPii, decryptPii, maskAadhaar, maskPan } from "../app/utils/piiCrypto.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "emi-test-secret";

const cfg = (over = {}) => ({ ...DEFAULT_EMI_CONFIG, ...over });
// Noon IST on a given day: unambiguous in every server timezone.
const onDay = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 6, 30));

/**
 * The shop's original sheet, copied logic-for-logic (flat + reducing, file charge slabs,
 * 5% a month). Used as the reference our server calculator must agree with.
 */
function sheet(price, down, months, type) {
  const balance = Math.max(0, price - down);
  const r = 5;
  const principalPer = months ? balance / months : 0;
  let rawInterest = 0;
  let opening = balance;
  const pays = [];
  const flatMonthly = (balance * r) / 100;
  for (let i = 1; i <= months; i += 1) {
    const intr = type === "flat" ? flatMonthly : (opening * r) / 100;
    const principal = i === months ? opening : Math.min(principalPer, opening);
    rawInterest += intr;
    pays.push(principal + intr);
    opening = Math.max(0, opening - principal);
  }
  const tier = balance < 10000 ? 750 : balance < 20000 ? 1500 : 2000;
  return { balance, rawInterest, total: balance + rawInterest, fileCharge: tier, pays };
}

describe("EMI calculator vs the shop's original sheet", () => {
  const cases = [];
  for (const price of [8000, 12000, 15999, 30000, 45000]) {
    for (const down of [0, 2000, 5000]) {
      for (const months of [3, 6, 9, 12, 24]) {
        for (const type of ["flat", "reducing"]) cases.push([price, down, months, type]);
      }
    }
  }

  it.each(cases)("price %s down %s %s months %s", (price, down, months, type) => {
    const ref = sheet(price, down, months, type);
    // Where the file charge fits inside the interest the sheet is internally consistent.
    if (ref.fileCharge > ref.rawInterest) return;

    const r = calculateEmi({ price, downPayment: down, months, config: cfg({ interestType: type }), now: onDay(2026, 11, 5) });
    expect(Math.abs(r.financeAmount - (ref.balance))).toBeLessThanOrEqual(0.0101);
    expect(r.fileCharge).toBe(ref.fileCharge);
    expect(Math.abs(r.totalInterest - (ref.rawInterest))).toBeLessThanOrEqual(0.0101);
    expect(Math.abs(r.remainingInterest - (ref.rawInterest - ref.fileCharge))).toBeLessThanOrEqual(0.0101);
    expect(Math.abs(r.totalPayable - (ref.total))).toBeLessThanOrEqual(0.0101);
    r.schedule.forEach((s, i) => {
      if (i < months - 1) expect(Math.abs(s.amount - ref.pays[i])).toBeLessThanOrEqual(0.5);
    });
  });
});

describe("worked example (Rs 30,000, Rs 5,000 down, 6 months, flat 5%)", () => {
  const r = calculateEmi({ price: 30000, downPayment: 5000, months: 6, config: cfg(), now: onDay(2026, 11, 5) });

  it("matches the hand calculation", () => {
    expect(r.financeAmount).toBe(25000);
    expect(r.totalInterest).toBe(7500);
    expect(r.fileCharge).toBe(2000);
    expect(r.remainingInterest).toBe(5500);
    expect(r.totalPayable).toBe(32500);
    expect(r.monthlyEmi).toBe(5417);
    expect(r.emiVaries).toBe(true); // last EMI is Rs 5,415 so the total is exact
    expect(r.schedule.map((s) => s.amount)).toEqual([5417, 5417, 5417, 5417, 5417, 5415]);
  });

  it("EMIs always add up exactly to the total payable", () => {
    expect(r.schedule.reduce((a, s) => a + s.amount, 0)).toBeCloseTo(r.totalPayable, 2);
  });
});

describe("EMIs add up exactly for any input (rounding never leaks)", () => {
  it("many random inputs, both interest types", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 400; n += 1) {
      const price = Math.round(3000 + rnd() * 120000);
      const down = Math.round(rnd() * price * 0.9);
      const months = DEFAULT_EMI_CONFIG.tenures[Math.floor(rnd() * DEFAULT_EMI_CONFIG.tenures.length)];
      const type = rnd() > 0.5 ? "flat" : "reducing";
      const r = calculateEmi({ price, downPayment: down, months, config: cfg({ interestType: type }), now: onDay(2026, 11, 5) });
      const sum = r.schedule.reduce((a, s) => a + s.amount, 0);
      expect(Math.abs(sum - r.totalPayable)).toBeLessThan(0.011);
      expect(r.schedule).toHaveLength(months);
      expect(r.schedule.every((s) => s.amount > 0)).toBe(true);
      // customer never pays less than the amount financed + the file charge
      expect(r.totalPayable).toBeGreaterThanOrEqual(r.financeAmount + r.fileCharge - 0.01);
    }
  });
});

describe("file charge bigger than the interest (short tenure)", () => {
  it("Rs 15,000 for 1 month: interest 750 < file charge 1,500 -> customer pays the file charge, no negative interest", () => {
    const r = calculateEmi({ price: 15000, downPayment: 0, months: 1, config: cfg(), now: onDay(2026, 11, 5) });
    expect(r.fileCharge).toBe(1500);
    expect(r.remainingInterest).toBe(0);
    expect(r.totalInterest).toBe(1500);
    expect(r.totalPayable).toBe(16500);
    expect(r.schedule[0].amount).toBe(16500);
  });

  it("reducing interest also tops up evenly so the total is exact", () => {
    const r = calculateEmi({ price: 15000, downPayment: 0, months: 2, config: cfg({ interestType: "reducing", interestRatePerMonth: 1 }), now: onDay(2026, 11, 5) });
    expect(r.remainingInterest).toBe(0);
    expect(r.totalPayable).toBe(16500);
    expect(r.schedule.reduce((a, s) => a + s.amount, 0)).toBeCloseTo(16500, 2);
  });
});

describe("reducing vs flat", () => {
  it("reducing charges less interest than flat for the same loan", () => {
    const flat = calculateEmi({ price: 40000, downPayment: 10000, months: 12, config: cfg({ interestType: "flat" }), now: onDay(2026, 11, 5) });
    const red = calculateEmi({ price: 40000, downPayment: 10000, months: 12, config: cfg({ interestType: "reducing" }), now: onDay(2026, 11, 5) });
    expect(red.totalInterest).toBeLessThan(flat.totalInterest);
    expect(red.interestType).toBe("reducing");
    expect(red.schedule[0].amount).toBeGreaterThan(red.schedule[11].amount); // EMIs fall over time
    expect(red.emiVaries).toBe(true);
  });
});

describe("file charge slabs", () => {
  const slabs = DEFAULT_EMI_CONFIG.fileChargeSlabs;
  it.each([
    [1, 750],
    [9999.99, 750],
    [10000, 1500],
    [19999, 1500],
    [20000, 2000],
    [500000, 2000],
  ])("finance amount %s -> file charge %s", (amount, charge) => {
    expect(pickFileCharge(amount, slabs)).toBe(charge);
  });

  it("uses whatever slabs the admin sets", () => {
    const custom = [{ upTo: 5000, fileCharge: 100 }, { upTo: null, fileCharge: 300 }];
    expect(pickFileCharge(4999, custom)).toBe(100);
    expect(pickFileCharge(5000, custom)).toBe(300);
  });
});

describe("first EMI date", () => {
  const rules = DEFAULT_EMI_CONFIG.dueDateRules;
  it.each([
    [{ y: 2026, m: 11, d: 1 }, "2026-12-01"],
    [{ y: 2026, m: 11, d: 10 }, "2026-12-01"],
    [{ y: 2026, m: 11, d: 11 }, "2026-12-10"],
    [{ y: 2026, m: 11, d: 20 }, "2026-12-10"],
    [{ y: 2026, m: 11, d: 21 }, "2026-12-20"],
    [{ y: 2026, m: 11, d: 31 }, "2026-12-20"],
    [{ y: 2026, m: 12, d: 15 }, "2027-01-10"], // rolls over the year
  ])("finance on %j -> %s", (date, expected) => {
    expect(firstEmiDate(date, rules)).toBe(expected);
  });

  it("monthly dates keep the same day and cross year ends", () => {
    const r = calculateEmi({ price: 20000, downPayment: 0, months: 4, config: cfg(), now: onDay(2026, 11, 25) });
    expect(r.firstEmiDate).toBe("2026-12-20");
    expect(r.schedule.map((s) => s.dueDate)).toEqual(["2026-12-20", "2027-01-20", "2027-02-20", "2027-03-20"]);
  });

  it("uses the Indian calendar day, not the server's: 11:30 pm IST on the 10th is still the 10th", () => {
    const lateIst = new Date(Date.UTC(2026, 10, 10, 18, 0)); // 23:30 IST on 10 Nov
    expect(istDateParts(lateIst)).toEqual({ y: 2026, m: 11, d: 10 });
    const r = calculateEmi({ price: 20000, downPayment: 0, months: 2, config: cfg(), now: lateIst });
    expect(r.firstEmiDate).toBe("2026-12-01");
  });

  it("works with custom rules from the admin", () => {
    const rules2 = [{ fromDay: 1, toDay: 15, dueDay: 5 }, { fromDay: 16, toDay: 31, dueDay: 25 }];
    expect(firstEmiDate({ y: 2026, m: 3, d: 15 }, rules2)).toBe("2026-04-05");
    expect(firstEmiDate({ y: 2026, m: 3, d: 16 }, rules2)).toBe("2026-04-25");
  });
});

describe("input checks", () => {
  const base = { price: 30000, downPayment: 5000, months: 6, config: cfg(), now: onDay(2026, 11, 5) };
  it.each([
    ["down payment equal to the price", { downPayment: 30000 }],
    ["down payment above the price", { downPayment: 31000 }],
    ["negative down payment", { downPayment: -1 }],
    ["not-a-number down payment", { downPayment: "abc" }],
    ["tenure the admin has not allowed", { months: 7 }],
    ["fractional tenure", { months: 6.5 }],
    ["zero price", { price: 0 }],
  ])("%s is refused with a 400", (_n, over) => {
    expect(() => calculateEmi({ ...base, ...over })).toThrow();
    try {
      calculateEmi({ ...base, ...over });
    } catch (e) {
      expect(e.statusCode).toBe(400);
    }
  });

  it("minimum down payment percentage is enforced", () => {
    const c = cfg({ minDownPaymentPercent: 20 });
    expect(() => calculateEmi({ ...base, config: c, downPayment: 5000 })).toThrow(/Minimum down payment is Rs 6000/);
    expect(calculateEmi({ ...base, config: c, downPayment: 6000 }).financeAmount).toBe(24000);
  });

  it("zero down payment is allowed", () => {
    expect(calculateEmi({ ...base, downPayment: 0 }).financeAmount).toBe(30000);
  });
});

describe("ID number protection", () => {
  it("encrypts and decrypts, never stores plain text, and differs every time", () => {
    const a = encryptPii("ABCDE1234F");
    const b = encryptPii("ABCDE1234F");
    expect(a).not.toContain("ABCDE1234F");
    expect(a).not.toBe(b);
    expect(decryptPii(a)).toBe("ABCDE1234F");
  });

  it("a tampered or empty value decrypts to nothing instead of throwing", () => {
    const a = encryptPii("123412341234");
    expect(decryptPii(a.slice(0, -4) + "AAAA")).toBe("");
    expect(decryptPii("")).toBe("");
    expect(decryptPii("garbage")).toBe("");
  });

  it("masks show only the safe part", () => {
    expect(maskAadhaar("123412341234")).toBe("XXXX XXXX 1234");
    expect(maskPan("abcde1234f")).toBe("ABCDE****F");
    expect(maskAadhaar("123")).toBe("");
    expect(maskPan("nope")).toBe("");
  });
});
