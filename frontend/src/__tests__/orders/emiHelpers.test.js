import { buildEmiPdfHtml, choosePageBreaks, emiDate, emiMoney } from "../../shared/utils/emiPdf.js";
import { validateEmiForm } from "../../shared/utils/emiForm.js";
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
  imei1: "123456789012345",
  imei2: "",
  ...over,
  result: { ...baseResult, ...(over.result || {}) },
});
const print = { shop: { name: "Anushka Mobile Gallery", address: "Bus stand", phone: "8808802020" }, terms: ["Pay on time."], lateFee: 590 };

describe("formatting", () => {
  it("rupees and dates read the way shopkeepers expect", () => {
    expect(emiMoney(1234567)).toBe("₹12,34,567");
    expect(emiMoney(5416.6)).toBe("₹5,417");
    expect(emiMoney(null)).toBe("₹0");
    expect(emiDate("2026-12-01")).toBe("01 Dec 2026");
    expect(emiDate("")).toBe("—");
  });
});

describe("PDF page", () => {
  it("shows the shop, customer, product, every figure and every instalment", () => {
    const html = buildEmiPdfHtml({ quote: quote(), print });
    for (const text of [
      "Anushka Mobile Gallery", "8808802020", "FQ-ABC123DEF4", "Rahul Verma", "9999999999",
      "Galaxy A15 (6/128 GB)", "123456789012345", "₹18,000", "₹3,000", "₹15,000", "₹1,500", "₹19,500",
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
  const ok = { name: "Rahul Verma", phone: "9876543210", pan: "", aadhaar: "", imei1: "", imei2: "" };

  it("a minimal form passes; PAN, Aadhaar and IMEI are optional", () => {
    expect(validateEmiForm(ok)).toBe("");
    expect(validateEmiForm({ ...ok, pan: "ABCDE1234F", aadhaar: "123412341234", imei1: "123456789012345", imei2: "543210987654321" })).toBe("");
  });

  it.each([
    [{ name: "A" }, /full name/],
    [{ phone: "12345" }, /10 digit/],
    [{ phone: "1234567890" }, /10 digit/],
    [{ pan: "ABC" }, /PAN/],
    [{ aadhaar: "1234" }, /Aadhaar/],
    [{ imei1: "123" }, /IMEI 1/],
    [{ imei2: "123" }, /IMEI 2/],
    [{ imei1: "123456789012345", imei2: "123456789012345" }, /different/],
  ])("%j is refused", (over, pattern) => {
    expect(validateEmiForm({ ...ok, ...over })).toMatch(pattern);
  });

  it("asks for the EMI details first when there is no result yet", () => {
    expect(validateEmiForm(ok, { hasResult: false })).toMatch(/down payment/);
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
