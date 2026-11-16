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
    const r = calculateEmi({ price, downPayment: down, months, config: cfg({ interestType: type }), now: onDay(2026, 11, 5) });
    expect(Math.abs(r.financeAmount - (ref.balance))).toBeLessThanOrEqual(0.0101);
    expect(r.fileCharge).toBe(ref.fileCharge);
    // The file charge is a SEPARATE charge on top of the interest. The only difference from the raw
    // sheet maths is the whole-rupee rounding of the interest (< Rs 0.50).
    expect(Math.abs(r.interest - ref.rawInterest)).toBeLessThanOrEqual(0.5);
    expect(r.remainingInterest).toBe(r.interest);
    expect(Math.abs(r.totalInterest - (ref.rawInterest + ref.fileCharge))).toBeLessThanOrEqual(0.5);
    expect(Math.abs(r.totalPayable - (ref.total + ref.fileCharge))).toBeLessThanOrEqual(0.5);
    r.schedule.forEach((s, i) => {
      // each EMI = the sheet's EMI + one month's share of the file charge
      if (i < months - 1) expect(Math.abs(s.amount - (ref.pays[i] + ref.fileCharge / months))).toBeLessThanOrEqual(0.51);
    });
  });
});

describe("worked example (Rs 30,000, Rs 5,000 down, 6 months, flat 5%)", () => {
  const r = calculateEmi({ price: 30000, downPayment: 5000, months: 6, config: cfg(), now: onDay(2026, 11, 5) });

  it("matches the hand calculation", () => {
    expect(r.financeAmount).toBe(25000);
    expect(r.interest).toBe(7500); // 25,000 x 5% x 6
    expect(r.fileCharge).toBe(2000); // separate, on top of the interest
    expect(r.remainingInterest).toBe(7500);
    expect(r.totalInterest).toBe(9500); // interest + file charge
    expect(r.totalPayable).toBe(34500); // 25,000 + 7,500 + 2,000
    expect(r.monthlyEmi).toBe(5750); // 34,500 / 6
    expect(r.emiVaries).toBe(false);
    expect(r.schedule.map((s) => s.amount)).toEqual([5750, 5750, 5750, 5750, 5750, 5750]);
  });

  it("EMIs always add up exactly to the total payable", () => {
    expect(r.schedule.reduce((a, s) => a + s.amount, 0)).toBeCloseTo(r.totalPayable, 2);
  });
});

/**
 * Every number the customer can see must agree with every other number. Checked for flat AND
 * reducing over many inputs (the "paiso ki baat" guard: no rupee or paisa may leak).
 */
describe("every figure agrees with every other figure (flat and reducing)", () => {
  const paise = (n) => Math.round(n * 100);
  const cases = [];
  for (const type of ["flat", "reducing"]) {
    for (const rate of [2.7, 3, 5, 6]) {
      for (const price of [10000, 15999, 18000, 29999, 45500, 99999]) {
        for (const down of [0, 3000, 7200]) {
          for (const months of [1, 2, 3, 6, 9, 12, 18, 24]) {
            if (down < price) cases.push([type, rate, price, down, months]);
          }
        }
      }
    }
  }

  it("1,000+ combinations: sums, rounding and the file-charge rule all hold", () => {
    expect(cases.length).toBeGreaterThan(1000);
    for (const [type, rate, price, down, months] of cases) {
      const tag = `${type} ${rate}% ${price}-${down} ${months}m`;
      const config = cfg({ interestType: type, interestRatePerMonth: rate, tenures: [months] });
      const r = calculateEmi({ price, downPayment: down, months, config, now: onDay(2026, 11, 5) });

      // EMIs add up to the total payable, to the paisa
      expect({ tag, sum: paise(r.schedule.reduce((a, s) => a + s.amount, 0)) }).toEqual({ tag, sum: paise(r.totalPayable) });
      // every EMI is an exact paisa amount (no 3rd decimal) and positive
      for (const s of r.schedule) {
        expect({ tag, ok: Math.abs(s.amount * 100 - Math.round(s.amount * 100)) < 1e-6 && s.amount > 0 }).toEqual({ tag, ok: true });
      }
      // total charge is a whole rupee
      expect({ tag, whole: Number.isInteger(r.totalInterest) }).toEqual({ tag, whole: true });
      // total payable - finance amount = total charge = file charge + interest
      expect({ tag, v: paise(r.totalPayable - r.financeAmount) }).toEqual({ tag, v: paise(r.totalInterest) });
      expect({ tag, v: paise(r.fileCharge + r.interest) }).toEqual({ tag, v: paise(r.totalInterest) });
      // the file charge is separate: it never changes the interest, and the interest is never negative
      expect(r.interest).toBeGreaterThanOrEqual(0);
      expect(r.remainingInterest).toBe(r.interest);
      expect(r.totalInterest).toBeGreaterThanOrEqual(r.fileCharge);
      expect(r.schedule).toHaveLength(months);

      if (type === "flat") {
        // flat: every EMI except the last is identical; the last is lower by at most 1 paisa per EMI
        const head = r.schedule.slice(0, -1).map((s) => s.amount);
        expect({ tag, same: head.every((a) => a === r.schedule[0].amount) }).toEqual({ tag, same: true });
        const last = r.schedule[months - 1].amount;
        expect({ tag, ok: last <= r.schedule[0].amount + 1e-9 && r.schedule[0].amount - last <= 0.01 * (months - 1) + 1e-9 }).toEqual({ tag, ok: true });
        expect(r.emiVaries).toBe(false);
      } else {
        // reducing: EMIs never rise (interest falls as the balance falls)
        for (let i = 1; i < months - 1; i += 1) expect(r.schedule[i].amount).toBeLessThanOrEqual(r.schedule[i - 1].amount + 1e-9);
      }
    }
  });

  it("reducing really is cheaper than flat for the same loan, for every tenure over 1 month", () => {
    for (const months of [3, 6, 12, 24]) {
      const f = calculateEmi({ price: 45500, downPayment: 5500, months, config: cfg({ interestType: "flat", tenures: [months] }), now: onDay(2026, 11, 5) });
      const rd = calculateEmi({ price: 45500, downPayment: 5500, months, config: cfg({ interestType: "reducing", tenures: [months] }), now: onDay(2026, 11, 5) });
      expect(rd.totalInterest).toBeLessThan(f.totalInterest);
      expect(rd.financeAmount).toBe(f.financeAmount);
    }
  });

  it("hand-checked reducing example: Rs 12,000 loan, 3 months, 5% a month", () => {
    // principal 4,000 a month; interest 600 + 400 + 200 = 1,200; file charge for 12,000 is 1,500 (separate, +500 a month)
    const r = calculateEmi({ price: 12000, downPayment: 0, months: 3, config: cfg({ interestType: "reducing", tenures: [3] }), now: onDay(2026, 11, 5) });
    expect(r.interest).toBe(1200);
    expect(r.fileCharge).toBe(1500);
    expect(r.totalInterest).toBe(2700);
    expect(r.totalPayable).toBe(14700); // 12,000 + 1,200 + 1,500
    expect(r.schedule.map((s) => s.amount)).toEqual([5100, 4900, 4700]);
  });

  it("hand-checked reducing example: Rs 40,000 loan, 4 months, 5% a month", () => {
    // principal 10,000 a month; interest 2,000 + 1,500 + 1,000 + 500 = 5,000; file charge 2,000 (+500 a month)
    const r = calculateEmi({ price: 40000, downPayment: 0, months: 4, config: cfg({ interestType: "reducing", tenures: [4] }), now: onDay(2026, 11, 5) });
    expect(r.interest).toBe(5000);
    expect(r.fileCharge).toBe(2000);
    expect(r.totalInterest).toBe(7000);
    expect(r.totalPayable).toBe(47000);
    expect(r.schedule.map((s) => s.amount)).toEqual([12500, 12000, 11500, 11000]);
  });

  it("hand-checked flat example with paise: Rs 20,999 loan, 3 months, 6% a month", () => {
    // interest 20,999 x 6% x 3 = 3,779.82 -> 3,780 (whole rupee); file charge 2,000 on top
    // total 20,999 + 3,780 + 2,000 = 26,779; EMI 26,779 / 3 = 8,926.333.. -> 8,926.34, 8,926.34, last 8,926.32
    const r = calculateEmi({ price: 29999, downPayment: 9000, months: 3, config: cfg({ interestRatePerMonth: 6, tenures: [3] }), now: onDay(2026, 11, 5) });
    expect(r.financeAmount).toBe(20999);
    expect(r.interest).toBe(3780);
    expect(r.fileCharge).toBe(2000);
    expect(r.totalInterest).toBe(5780);
    expect(r.totalPayable).toBe(26779);
    expect(r.schedule.map((s) => s.amount)).toEqual([8926.34, 8926.34, 8926.32]);
  });

  it("the screenshot case: Rs 23,999 loan, 6% a month, file charge 1,800 on top of the interest", () => {
    const r = calculateEmi({ price: 33999, downPayment: 10000, months: 3, config: cfg({ interestRatePerMonth: 6, fileChargeSlabs: [{ upTo: null, fileCharge: 1800 }], tenures: [3] }), now: onDay(2026, 11, 5) });
    expect(r.financeAmount).toBe(23999);
    expect(r.interest).toBe(4320); // 23,999 x 6% x 3 = 4,319.82
    expect(r.fileCharge).toBe(1800);
    expect(r.totalPayable).toBe(30119); // 23,999 + 4,320 + 1,800
    expect(r.schedule.map((s) => s.amount)).toEqual([10039.67, 10039.67, 10039.66]);
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

describe("file charge is always a separate charge on top of the interest (short tenures too)", () => {
  it("Rs 15,000 for 1 month: interest 750 + file charge 1,500, both paid", () => {
    const r = calculateEmi({ price: 15000, downPayment: 0, months: 1, config: cfg(), now: onDay(2026, 11, 5) });
    expect(r.fileCharge).toBe(1500);
    expect(r.interest).toBe(750);
    expect(r.totalInterest).toBe(2250);
    expect(r.totalPayable).toBe(17250);
    expect(r.schedule[0].amount).toBe(17250);
  });

  it("reducing interest: the file charge is spread evenly over the EMIs and the total is exact", () => {
    const r = calculateEmi({ price: 15000, downPayment: 0, months: 2, config: cfg({ interestType: "reducing", interestRatePerMonth: 1 }), now: onDay(2026, 11, 5) });
    expect(r.interest).toBe(225); // 150 + 75
    expect(r.totalPayable).toBe(16725); // 15,000 + 225 + 1,500
    expect(r.schedule.reduce((a, s) => a + s.amount, 0)).toBeCloseTo(16725, 2);
  });

  it("a file charge of 0 (admin removed it) means total payable = loan + interest", () => {
    const r = calculateEmi({ price: 20000, downPayment: 0, months: 4, config: cfg({ fileChargeSlabs: [{ upTo: null, fileCharge: 0 }] }), now: onDay(2026, 11, 5) });
    expect(r.fileCharge).toBe(0);
    expect(r.totalPayable).toBe(20000 + 4000);
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
