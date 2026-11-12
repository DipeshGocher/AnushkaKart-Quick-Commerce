/**
 * EMI / finance calculator (single source of truth, pure functions).
 *
 * Rules (from the shop's own EMI sheet):
 *   finance amount = product price - down payment
 *   total interest = flat:     amount x rate% x months
 *                    reducing: equal principal each month, interest on the opening balance
 *   file charge    = slab picked by the finance amount; it is taken OUT OF the interest
 *                    (it is not added on top). So  remaining interest = total interest - file charge.
 *   If the file charge is bigger than the interest (very short tenures) the customer still pays
 *   at least the file charge:  total charge = max(interest, file charge).
 *   first EMI date = by the day of the month the finance is taken (rules are configurable).
 *
 * Money rules: every EMI is a whole rupee; the last EMI absorbs the rounding difference, so
 * the EMIs always add up exactly to the total payable.
 */

export const DEFAULT_EMI_CONFIG = Object.freeze({
  enabled: true,
  interestType: "flat",
  interestRatePerMonth: 5,
  fileChargeSlabs: [
    { upTo: 10000, fileCharge: 750 },
    { upTo: 20000, fileCharge: 1500 },
    { upTo: null, fileCharge: 2000 },
  ],
  tenures: [1, 2, 3, 4, 5, 6, 9, 12, 18, 24],
  dueDateRules: [
    { fromDay: 1, toDay: 10, dueDay: 1 },
    { fromDay: 11, toDay: 20, dueDay: 10 },
    { fromDay: 21, toDay: 31, dueDay: 20 },
  ],
  lateFee: 590,
  minDownPaymentPercent: 0,
});

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function fail(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

const pad = (n) => String(n).padStart(2, "0");
const toIso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** Calendar date in India (the shop's timezone), whatever timezone the server runs in. */
export function istDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

export function pickFileCharge(amount, slabs) {
  const list = Array.isArray(slabs) ? slabs : [];
  for (const slab of list) {
    if (slab.upTo == null || amount < Number(slab.upTo)) return Number(slab.fileCharge) || 0;
  }
  return list.length ? Number(list[list.length - 1].fileCharge) || 0 : 0;
}

export function pickDueDay(dayOfMonth, rules) {
  const list = Array.isArray(rules) ? rules : [];
  const rule = list.find((r) => dayOfMonth >= r.fromDay && dayOfMonth <= r.toDay) || list[list.length - 1];
  return rule ? Number(rule.dueDay) : 1;
}

/** { y, m, d } -> first EMI date as 'YYYY-MM-DD' (always in a following month). */
export function firstEmiDate(financeDate, rules) {
  const dueDay = pickDueDay(financeDate.d, rules);
  const dt = new Date(Date.UTC(financeDate.y, financeDate.m, dueDay)); // month index m == next month
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function addMonthsIso(iso, count) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + count, d));
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/**
 * @param {{ price:number, downPayment:number, months:number, config:object, now?:Date }} input
 */
export function calculateEmi({ price, downPayment, months, config, now = new Date() }) {
  const cfg = { ...DEFAULT_EMI_CONFIG, ...(config || {}) };
  const p = round2(price);
  const down = round2(downPayment);
  const m = Number(months);

  if (!Number.isFinite(p) || p <= 0) throw fail("Product price is not available for finance.");
  if (!Number.isFinite(down) || down < 0) throw fail("Enter a valid down payment.");
  if (down >= p) throw fail("Down payment must be less than the product price.");
  if (!Number.isInteger(m) || !(cfg.tenures || []).includes(m)) throw fail("Choose a valid EMI duration.");

  const minDown = round2((p * (Number(cfg.minDownPaymentPercent) || 0)) / 100);
  if (down < minDown) throw fail(`Minimum down payment is Rs ${Math.ceil(minDown)}.`);

  const balance = round2(p - down);
  const rate = (Number(cfg.interestRatePerMonth) || 0) / 100;
  const type = cfg.interestType === "reducing" ? "reducing" : "flat";

  // total interest + the interest part of every month (before rounding)
  const principalPer = balance / m;
  const monthlyInterest = [];
  if (type === "flat") {
    for (let i = 0; i < m; i += 1) monthlyInterest.push(balance * rate);
  } else {
    let opening = balance;
    for (let i = 0; i < m; i += 1) {
      monthlyInterest.push(opening * rate);
      opening -= principalPer;
    }
  }
  const rawInterest = round2(monthlyInterest.reduce((a, b) => a + b, 0));

  const fileCharge = round2(pickFileCharge(balance, cfg.fileChargeSlabs));
  const totalCharge = round2(Math.max(rawInterest, fileCharge));
  const topUp = totalCharge - rawInterest; // > 0 only when the file charge exceeds the interest
  const remainingInterest = round2(totalCharge - fileCharge);
  const totalPayable = round2(balance + totalCharge);

  const exact = monthlyInterest.map((intr) => principalPer + intr + topUp / m);
  const amounts = [];
  let running = 0;
  for (let i = 0; i < m - 1; i += 1) {
    const whole = Math.round(exact[i]);
    amounts.push(whole);
    running += whole;
  }
  amounts.push(round2(totalPayable - running));

  const financeDate = istDateParts(now);
  const firstDue = firstEmiDate(financeDate, cfg.dueDateRules);
  const schedule = amounts.map((amount, i) => ({
    no: i + 1,
    dueDate: addMonthsIso(firstDue, i),
    amount,
  }));

  return {
    price: p,
    downPayment: down,
    financeAmount: balance,
    months: m,
    interestType: type,
    interestRatePerMonth: Number(cfg.interestRatePerMonth) || 0,
    totalInterest: totalCharge,
    fileCharge,
    remainingInterest,
    totalPayable,
    monthlyEmi: schedule[0].amount,
    emiVaries: schedule.some((s) => s.amount !== schedule[0].amount),
    financeDate: toIso(financeDate.y, financeDate.m, financeDate.d),
    firstEmiDate: firstDue,
    schedule,
  };
}
