import { buildEmiPdfHtml, choosePageBreaks, emiDate, emiMoney } from "../../shared/utils/emiPdf.js";
import { validateEmiForm, checkDownPayment, minDownPaymentAmount, defaultDownPaymentAmount } from "../../shared/utils/emiForm.js";
import { isFinanceHeader } from "../../modules/customer/services/emiHeaders.js";


const baseResult = {
  price: 18000,
  downPayment: 3000,
  financeAmount: 15000,
  fileCharge: 1500,
  remainingInterest: 3000,
  totalPayable: 19500,
  months: 3,
  interestType: "flat",
  monthlyEmi: 6500,
  emiVaries: false,
  financeDate: "2026-11-05",
  firstEmiDate: "2026-12-01",
  schedule: [
    { no: 1, dueDate: "2026-12-01", amount: 6500 },
    { no: 2, dueDate: "2027-01-01", amount: 6500 },
    { no: 3, dueDate: "2027-02-01", amount: 6500 },
  ],
};
const quote = (over = {}) => ({
  quoteId: "FQ-ABC123DEF4",
  customer: { name: "Rahul Verma", phone: "9999999999" },
  product: { name: "Galaxy A15", variantName: "6/128 GB" },
  ...over,
  result: { ...baseResult, ...(over.result || {}) },
});
const print = { shop: { name: "Anushka Mobile Gallery", address: "Bus stand", phone: "8808802020" }, terms: ["Pay on time."], lateFee: 590 };

describe("formatting", () => {
  it("rupees and dates read the way shopkeepers expect", () => {
    // always with paise, so no amount is rounded away on screen
    expect(emiMoney(1234567)).toBe("₹12,34,567.00");
    expect(emiMoney(5416.6)).toBe("₹5,416.60");
    expect(emiMoney(4188.34)).toBe("₹4,188.34");
    expect(emiMoney(10800)).toBe("₹10,800.00");
    expect(emiMoney(null)).toBe("₹0.00");
    expect(emiDate("2026-12-01")).toBe("01 Dec 2026");
    expect(emiDate("")).toBe("—");
  });
});

describe("PDF page", () => {
  it("shows the shop, customer, product, every figure and every instalment", () => {
    const html = buildEmiPdfHtml({ quote: quote(), print });
    for (const text of [
      "Anushka Mobile Gallery", "8808802020", "FQ-ABC123DEF4", "Rahul Verma", "9999999999",
      "Galaxy A15 (6/128 GB)", "₹18,000", "₹3,000", "₹15,000", "₹1,500", "₹19,500",
      "3 महीने", "फ्लैट", "01 Dec 2026", "01 Jan 2027", "01 Feb 2027", "Pay on time.", "₹590",
    ]) {
      expect(html).toContain(text);
    }
    expect(html.match(/<tr><td>\d+<\/td>/g)).toHaveLength(3);
  });

  it("reducing loans are labelled and the first EMI is called 'first'", () => {
    const html = buildEmiPdfHtml({ quote: quote({ result: { interestType: "reducing", emiVaries: true } }), print });
    expect(html).toContain("रिड्यूसिंग");
    expect(html).toContain("पहली EMI");
  });

  it("whatever the customer typed is escaped, so it cannot inject markup", () => {
    const evil = quote({ customer: { name: '<img src=x onerror="alert(1)">', phone: "9999999999" } });
    const html = buildEmiPdfHtml({ quote: evil, print: { ...print, terms: ["<script>x()</script>"] } });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>x()");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("a 24 month schedule produces 24 rows", () => {
    const schedule = Array.from({ length: 24 }, (_, i) => ({ no: i + 1, dueDate: "2027-01-10", amount: 3000 }));
    const html = buildEmiPdfHtml({ quote: quote({ result: { months: 24, schedule } }), print });
    expect(html.match(/<tr><td>\d+<\/td>/g)).toHaveLength(24);
  });
});

describe("PDF page breaks never cut a row in half", () => {
  it("one page when everything fits", () => {
    expect(choosePageBreaks([100, 200], 900, 1000)).toEqual([0, 900]);
  });

  it("cuts at the last row boundary that fits on the page", () => {
    // page holds 1000px; rows start every 100px
    const rows = Array.from({ length: 18 }, (_, i) => (i + 1) * 100);
    expect(choosePageBreaks(rows, 1850, 1000)).toEqual([0, 1000, 1850]);
    // a boundary at 980 is preferred over a hard cut at 1000
    expect(choosePageBreaks([300, 650, 980], 1800, 1000)).toEqual([0, 980, 1800]);
  });

  it("never exceeds the page height and always ends at the total", () => {
    const rows = Array.from({ length: 70 }, (_, i) => (i + 1) * 37);
    const breaks = choosePageBreaks(rows, 2590, 800);
    expect(breaks[0]).toBe(0);
    expect(breaks[breaks.length - 1]).toBe(2590);
    for (let i = 1; i < breaks.length; i += 1) {
      expect(breaks[i]).toBeGreaterThan(breaks[i - 1]);
      expect(breaks[i] - breaks[i - 1]).toBeLessThanOrEqual(800);
    }
  });

  it("falls back to a hard cut when a block is taller than the page (no infinite loop)", () => {
    expect(choosePageBreaks([], 2500, 1000)).toEqual([0, 1000, 2000, 2500]);
    expect(choosePageBreaks([10, 20], 2500, 1000)).toEqual([0, 1000, 2000, 2500]);
  });

  it("ignores junk values", () => {
    expect(choosePageBreaks([NaN, -5, 0, 5000, "x"], 1500, 1000)).toEqual([0, 1000, 1500]);
  });
});

describe("quotation form checks", () => {
  const ok = { name: "Rahul Verma", phone: "9876543210", pan: "", aadhaar: "" };

  it("a minimal form passes; PAN and Aadhaar are optional", () => {
    expect(validateEmiForm(ok)).toBe("");
    expect(validateEmiForm({ ...ok, pan: "ABCDE1234F", aadhaar: "123412341234" })).toBe("");
  });

  it.each([
    [{ name: "A" }, /full name/],
    [{ phone: "12345" }, /10 digit/],
    [{ phone: "1234567890" }, /10 digit/],
    [{ pan: "ABC" }, /PAN/],
    [{ aadhaar: "1234" }, /Aadhaar/],
  ])("%j is refused", (over, pattern) => {
    expect(validateEmiForm({ ...ok, ...over })).toMatch(pattern);
  });

  it("asks for the EMI details first when there is no result yet", () => {
    expect(validateEmiForm(ok, { hasResult: false })).toMatch(/down payment/);
  });
});

describe("down payment (auto-filled minimum, live error below it)", () => {
  it("the auto-filled amount is the admin's minimum %, rounded up to a whole rupee", () => {
    expect(minDownPaymentAmount(18000, 35)).toBe(6300);
    expect(minDownPaymentAmount(18000, 40)).toBe(7200);
    expect(minDownPaymentAmount(18000, 20)).toBe(3600);
    expect(minDownPaymentAmount(14999, 35)).toBe(5250); // 5249.65 -> 5250
    expect(minDownPaymentAmount(18000, 0)).toBe(0);
  });

  it("the minimum itself and anything above it is fine, with the live percentage", () => {
    expect(checkDownPayment(18000, 35, "6300")).toMatchObject({ ok: true, error: "", minAmount: 6300 });
    expect(checkDownPayment(18000, 35, "7200").percent).toBeCloseTo(40, 5);
    expect(checkDownPayment(18000, 35, "17999").ok).toBe(true);
  });

  it("below the minimum is an error right away, naming the minimum", () => {
    const r = checkDownPayment(18000, 35, "6299");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Minimum down payment is ₹6,300 \(35%\)/);
  });

  it("empty, the full price and more are refused", () => {
    expect(checkDownPayment(18000, 35, "").ok).toBe(false);
    expect(checkDownPayment(18000, 0, "18000").error).toMatch(/less than the product price/);
    expect(checkDownPayment(18000, 0, "20000").ok).toBe(false);
  });

  it("with no minimum set, 0 is allowed", () => {
    expect(checkDownPayment(18000, 0, "0").ok).toBe(true);
  });
});

describe("the down payment the calculator opens with", () => {
  it("is the admin's default share of the price: 40 % of 129999 is 52000 (rounded up to a whole rupee)", () => {
    expect(defaultDownPaymentAmount(129999, 40, 30)).toBe(52000);
    expect(defaultDownPaymentAmount(18000, 40, 30)).toBe(7200);
    expect(defaultDownPaymentAmount(10001, 40, 30)).toBe(4001);
  });
  it("never goes below the minimum, even if the default is set lower or missing", () => {
    expect(defaultDownPaymentAmount(18000, 20, 30)).toBe(5400);
    expect(defaultDownPaymentAmount(18000, 0, 30)).toBe(5400);
    expect(defaultDownPaymentAmount(18000, undefined, 30)).toBe(5400);
  });
  it("with no default and no minimum it is 0", () => {
    expect(defaultDownPaymentAmount(18000, 0, 0)).toBe(0);
  });
  it("the opening amount always passes the live check, and 1 rupee less than the minimum fails with a clear message", () => {
    for (const price of [999, 10001, 18000, 129999, 56789]) {
      const open = defaultDownPaymentAmount(price, 40, 30);
      expect(checkDownPayment(price, 30, String(open)).ok).toBe(true);
      const min = minDownPaymentAmount(price, 30);
      expect(checkDownPayment(price, 30, String(min)).ok).toBe(true);
      const below = checkDownPayment(price, 30, String(min - 1));
      expect(below.ok).toBe(false);
      expect(below.error).toMatch(/Minimum down payment is ₹[\d,]+ \(30%\)/);
    }
  });
  it("30 % minimum of 129999 is 38999.7 -> 39000", () => {
    expect(minDownPaymentAmount(129999, 30)).toBe(39000);
    expect(checkDownPayment(129999, 30, "38999").ok).toBe(false);
    expect(checkDownPayment(129999, 30, "39000").ok).toBe(true);
  });
});

describe("which products show the finance button", () => {
  const headers = { enabled: true, headerIds: ["h1", "h2"] };
  it("matches the product's header category (object or plain id)", () => {
    expect(isFinanceHeader(headers, { headerId: { _id: "h1" } })).toBe(true);
    expect(isFinanceHeader(headers, { headerId: "h2" })).toBe(true);
    expect(isFinanceHeader(headers, { headerId: "h3" })).toBe(false);
    expect(isFinanceHeader(headers, {})).toBe(false);
  });
  it("is off when finance is off, still loading, or there is no product", () => {
    expect(isFinanceHeader({ enabled: false, headerIds: ["h1"] }, { headerId: "h1" })).toBe(false);
    expect(isFinanceHeader(null, { headerId: "h1" })).toBe(false);
    expect(isFinanceHeader(headers, null)).toBe(false);
  });
});
