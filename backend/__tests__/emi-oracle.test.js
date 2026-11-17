import { calculateEmi, DEFAULT_EMI_CONFIG } from "../app/utils/financeCalculator.js";

/**
 * Independent check of the EMI maths with exact fractions (BigInt, no floating point at all).
 * The calculator must give the same answer as this slow-but-exact version for flat AND reducing,
 * for any price, down payment, rate, duration and file-charge slab.
 */
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a || 1n; };
const F = (n, d = 1n) => { const g = gcd(n, d); const s = d < 0n ? -1n : 1n; return { n: (s * n) / g, d: (s * d) / g }; };
const add = (x, y) => F(x.n * y.d + y.n * x.d, x.d * y.d);
const sub = (x, y) => F(x.n * y.d - y.n * x.d, x.d * y.d);
const mul = (x, y) => F(x.n * y.n, x.d * y.d);
const div = (x, y) => F(x.n * y.d, x.d * y.n);
const floorF = (x) => (x.n >= 0n ? x.n / x.d : -((-x.n + x.d - 1n) / x.d));
const ceilF = (x) => -floorF(F(-x.n, x.d));
const roundHalfUp = (x) => floorF(add(x, F(1n, 2n)));

function oracle({ balancePaise, ratePercentHundredths, months, fileCharge, type }) {
  const B = F(balancePaise);
  const monthlyRate = F(BigInt(ratePercentHundredths), 10000n); // 5.00 % -> 500/10000 = 0.05
  const M = BigInt(months);
  const interestOf = [];
  for (let i = 0n; i < M; i += 1n) {
    const opening = type === "flat" ? B : mul(B, F(M - i, M)); // reducing: equal principal, interest on what is left
    interestOf.push(mul(opening, monthlyRate));
  }
  const exactInterest = interestOf.reduce(add, F(0n));
  const interestRupees = roundHalfUp(div(exactInterest, F(100n)));
  const totalCharge = add(F(interestRupees * 100n), F(BigInt(fileCharge) * 100n));
  const totalPayable = add(B, totalCharge);
  const adjust = sub(totalCharge, exactInterest);
  const emis = [];
  let running = F(0n);
  for (let i = 0; i < months - 1; i += 1) {
    const exact = add(add(div(B, F(M)), interestOf[i]), div(adjust, F(M)));
    const e = ceilF(exact);
    emis.push(e);
    running = add(running, F(e));
  }
  emis.push(floorF(sub(totalPayable, running)));
  return { interestRupees, totalPayablePaise: floorF(totalPayable), emisPaise: emis };
}

const paise = (rupees) => BigInt(Math.round(rupees * 100));

// small deterministic random generator so a failure can be reproduced
let seed = 20261116;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pickOf = (arr) => arr[Math.floor(rnd() * arr.length)];

const NOW = new Date("2026-11-16T10:00:00+05:30");

describe("EMI maths agrees with an exact-fraction check (flat and reducing)", () => {
  const slabs = DEFAULT_EMI_CONFIG.fileChargeSlabs;
  const tenures = [1, 2, 3, 4, 5, 6, 9, 12, 18, 24, 36];
  const cases = [];
  for (let i = 0; i < 1500; i += 1) {
    const price = Math.round((1000 + rnd() * 149000) * 100) / 100; // paise level prices too
    const down = Math.round(rnd() * price * 0.9 * 100) / 100;
    cases.push({
      type: pickOf(["flat", "reducing"]),
      price,
      down: Math.min(down, price - 1),
      rateHundredths: pickOf([0, 100, 150, 200, 250, 300, 333, 450, 500, 575, 600, 750, 1000, 1250, 1999, 2500]),
      months: pickOf(tenures),
    });
  }
  // a few hand picked awkward ones: exact .5 rupee interest, tiny balance, longest duration
  cases.push({ type: "flat", price: 10000, down: 0, rateHundredths: 500, months: 1 });
  cases.push({ type: "flat", price: 1000.1, down: 0, rateHundredths: 50, months: 1 });
  cases.push({ type: "reducing", price: 25000, down: 2500, rateHundredths: 450, months: 36 });
  cases.push({ type: "reducing", price: 99999.99, down: 1, rateHundredths: 1999, months: 24 });

  test.each([["flat"], ["reducing"]])("%s: interest, total payable and every EMI match the exact answer", (type) => {
    let checked = 0;
    for (const c of cases.filter((x) => x.type === type)) {
      const cfg = { ...DEFAULT_EMI_CONFIG, interestType: type, interestRatePerMonth: c.rateHundredths / 100, tenures };
      const got = calculateEmi({ price: c.price, downPayment: c.down, months: c.months, config: cfg, now: NOW });
      const balancePaise = paise(c.price) - paise(c.down);
      const fileCharge = (() => { const bal = Number(balancePaise) / 100; for (const s of slabs) if (s.upTo == null || bal < s.upTo) return s.fileCharge; return 0; })();
      const want = oracle({ balancePaise, ratePercentHundredths: c.rateHundredths, months: c.months, fileCharge, type });
      const label = JSON.stringify(c);

      expect({ c: label, v: got.interest }).toEqual({ c: label, v: Number(want.interestRupees) });
      expect({ c: label, v: Math.round(got.totalPayable * 100) }).toEqual({ c: label, v: Number(want.totalPayablePaise) });
      expect({ c: label, v: got.schedule.map((s) => Math.round(s.amount * 100)) }).toEqual({ c: label, v: want.emisPaise.map(Number) });
      // the EMIs always add up to the total payable, to the paisa
      const sum = got.schedule.reduce((a, s) => a + Math.round(s.amount * 100), 0);
      expect({ c: label, v: sum }).toEqual({ c: label, v: Math.round(got.totalPayable * 100) });
      // the last EMI is never higher than the others and never lower by more than a paisa per month
      const last = got.schedule[got.schedule.length - 1].amount;
      if (type === "flat") {
        expect(last).toBeLessThanOrEqual(got.schedule[0].amount + 1e-9);
        expect(got.schedule[0].amount - last).toBeLessThanOrEqual(0.01 * c.months + 1e-9);
      }
      checked += 1;
    }
    expect(checked).toBeGreaterThan(500);
  });

  test("reducing: EMIs go down month by month and flat with the same inputs costs at least as much", () => {
    for (let i = 0; i < 200; i += 1) {
      const price = 5000 + Math.floor(rnd() * 95000);
      const months = pickOf([3, 6, 9, 12, 18, 24]);
      const base = { ...DEFAULT_EMI_CONFIG, interestRatePerMonth: pickOf([2, 3, 5, 7.5]), tenures };
      const flat = calculateEmi({ price, downPayment: 0, months, config: { ...base, interestType: "flat" }, now: NOW });
      const red = calculateEmi({ price, downPayment: 0, months, config: { ...base, interestType: "reducing" }, now: NOW });
      for (let k = 1; k < red.schedule.length; k += 1) {
        expect(red.schedule[k].amount).toBeLessThanOrEqual(red.schedule[k - 1].amount + 1e-9);
      }
      expect(red.interest).toBeLessThanOrEqual(flat.interest);
      expect(red.fileCharge).toBe(flat.fileCharge);
    }
  });

  // The number in the "Interest" box of the calculator is the interest of the chosen duration. For the
  // usual 3 / 6 / 9 / 12 months it must equal the plain textbook formula, whichever type the admin chose:
  //   flat      balance x rate x months
  //   reducing  balance x rate x (months + 1) / 2   (equal principal, interest on what is left)
  test("interest for 3, 6, 9 and 12 months equals the closed-form formula (flat and reducing)", () => {
    const four = [3, 6, 9, 12];
    let checked = 0;
    for (let i = 0; i < 400; i += 1) {
      const price = Math.round((5000 + rnd() * 145000) * 100) / 100;
      const down = Math.round(price * (0.3 + rnd() * 0.5) * 100) / 100;
      const rateHundredths = pickOf([100, 150, 200, 250, 300, 450, 500, 750, 1000]);
      for (const type of ["flat", "reducing"]) {
        for (const months of four) {
          const cfg = { ...DEFAULT_EMI_CONFIG, interestType: type, interestRatePerMonth: rateHundredths / 100, tenures: four };
          const got = calculateEmi({ price, downPayment: down, months, config: cfg, now: NOW });
          const balPaise = paise(price) - paise(down);
          // exact interest in paise: balance x rate x (months for flat, (months+1)/2 for reducing); the 2 keeps it whole
          const factor = type === "flat" ? BigInt(months) * 2n : BigInt(months + 1);
          const exactPaise = F(balPaise * BigInt(rateHundredths) * factor, 10000n * 2n);
          const wantRupees = Number(roundHalfUp(div(exactPaise, F(100n))));
          expect({ type, months, price, down, rate: rateHundredths, interest: got.interest }).toEqual({ type, months, price, down, rate: rateHundredths, interest: wantRupees });
          checked += 1;
        }
      }
    }
    expect(checked).toBe(400 * 2 * 4);
  });

  test("the interest type the admin saves is the one used (nothing else decides it)", () => {
    const common = { price: 30000, downPayment: 5000, months: 6, now: NOW };
    const flat = calculateEmi({ ...common, config: { ...DEFAULT_EMI_CONFIG, interestType: "flat" } });
    const red = calculateEmi({ ...common, config: { ...DEFAULT_EMI_CONFIG, interestType: "reducing" } });
    expect(flat.interestType).toBe("flat");
    expect(red.interestType).toBe("reducing");
    expect(flat.interest).toBe(7500); // 25,000 x 5 % x 6
    expect(red.interest).toBe(4375); // 25,000 x 5 % x (6+1)/2
    expect(flat.interest).not.toBe(red.interest);
  });
});
