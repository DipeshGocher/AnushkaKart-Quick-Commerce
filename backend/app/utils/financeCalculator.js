/**
 * EMI / finance calculator (single source of truth, pure functions).
 *
 * Rules (from the shop's own EMI sheet):
 *   finance amount = product price - down payment
 *   total interest = flat:     amount x rate% x months
 *                    reducing: equal principal each month, interest on the opening balance
 *   file charge    = slab picked by the finance amount. It is a SEPARATE charge, added on top of the
 *                    interest (it is not part of the interest) and paid through the EMIs.
 *   total charge   = interest + file charge;  total payable = finance amount + total charge
 *   EMI            = (finance amount + interest + file charge) spread over the months
 *   first EMI date = by the day of the month the finance is taken (rules are configurable).
 *
 * Money rules (same as the shop's sheet):
 *   - the interest is a whole-rupee amount (1,764.80 -> 1,765), so total payable is a whole rupee too;
 *   - every EMI is rounded UP to the paisa (4,188.333 -> 4,188.34);
 *   - the last EMI takes what is left, so the EMIs add up to the total payable to the paisa
 *     (the last EMI can be a few paise lower than the others, never higher);
 *   - on screen / PDF / WhatsApp every amount is shown with paise, so nothing is rounded away.
 *   Flat and reducing both go through exactly the same rounding, so the figures always agree:
 *   sum(EMIs) = total payable, total payable - finance amount = file charge + interest.
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
/** Round UP to the paisa; the toFixed(6) guards against 4188.34 being held as 4188.340000000001. */
const ceil2 = (n) => Math.ceil(Number((Number(n) * 100).toFixed(6))) / 100;

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
  const exactInterest = monthlyInterest.reduce((a, b) => a + b, 0); // not rounded: used to spread the rounding evenly

  // The interest is a whole-rupee amount (as on the shop's sheet: 1,764.80 -> 1,765). The file charge is
  // a SEPARATE charge on top of the interest (it is not part of it), and is paid through the EMIs.
  // toFixed(6) removes float dust (1764.4999999999 vs 1764.5) so a true half rupee always rounds up
  const interest = Math.round(Number(exactInterest.toFixed(6)));
  const fileCharge = round2(pickFileCharge(balance, cfg.fileChargeSlabs));
  const totalCharge = round2(interest + fileCharge); // everything paid on top of the finance amount
  const totalPayable = round2(balance + totalCharge);
  // The file charge plus the rounding of the interest, spread evenly over the EMIs.
  const adjust = totalCharge - exactInterest;

  // Every EMI is rounded UP to the paisa (4,188.333 -> 4,188.34), like the sheet; the LAST EMI takes
  // whatever is left, so the EMIs always add up to the total payable to the paisa. The last EMI can
  // therefore be a few paise lower than the others, never higher.
  const exact = monthlyInterest.map((intr) => principalPer + intr + adjust / m);
  const amounts = [];
  let running = 0;
  for (let i = 0; i < m - 1; i += 1) {
    const emi = ceil2(exact[i]);
    amounts.push(emi);
    running = round2(running + emi);
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
    interest, // interest only (what the customer pays on top of the loan, without the file charge)
    fileCharge,
    totalInterest: totalCharge, // legacy name: interest + file charge = total paid on top of the loan
    remainingInterest: interest, // legacy name of `interest` (older saved quotations use it)
    totalPayable,
    monthlyEmi: schedule[0].amount,
    // True when the EMIs really differ (reducing). A last EMI a few paise lower (rounding) is not "varying".
    emiVaries: Math.max(...amounts) - Math.min(...amounts) > 1,
    financeDate: toIso(financeDate.y, financeDate.m, financeDate.d),
    firstEmiDate: firstDue,
    schedule,
  };
}
