import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { jest } from "@jest/globals";

process.env.JWT_SECRET = process.env.JWT_SECRET || "emi-service-test-secret";
process.env.REDIS_DISABLED = "true";

// Starts a never-ending cache cleanup timer at import time; irrelevant here.
jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { validateConfigInput, buildQuotationMessage, buildWhatsappUrl, publicConfig } = await import(
  "../app/services/finance/emiService.js"
);
const { DEFAULT_EMI_CONFIG } = await import("../app/utils/financeCalculator.js");
const { default: setupRoutes } = await import("../app/routes/index.js");

const app = express();
app.use(express.json());
setupRoutes(app);
const token = (role) => jwt.sign({ id: "64b7f0f0f0f0f0f0f0f0f0f0", role }, process.env.JWT_SECRET);

const goodConfig = () => ({
  enabled: true,
  interestType: "flat",
  interestRatePerMonth: 5,
  fileChargeSlabs: [
    { upTo: 10000, fileCharge: 750 },
    { upTo: 20000, fileCharge: 1500 },
    { upTo: null, fileCharge: 2000 },
  ],
  tenures: [3, 6, 12],
  dueDateRules: DEFAULT_EMI_CONFIG.dueDateRules,
  lateFee: 590,
  minDownPaymentPercent: 10,
  whatsappNumber: "88088 02020",
  shop: { name: "  Anushka Mobile Gallery ", address: "Bus stand", phone: "8808802020" },
  terms: ["One", "", "  Two  "],
});

describe("admin finance settings validation", () => {
  it("accepts a proper config and cleans it", () => {
    const out = validateConfigInput(goodConfig());
    expect(out.interestType).toBe("flat");
    expect(out.whatsappNumber).toBe("8808802020");
    expect(out.shop.name).toBe("Anushka Mobile Gallery");
    expect(out.terms).toEqual(["One", "Two"]);
    expect(out.tenures).toEqual([3, 6, 12]);
    expect(out.fileChargeSlabs[2]).toEqual({ upTo: null, fileCharge: 2000 });
  });

  it("accepts form strings (admin inputs are text) and sorts / de-duplicates tenures", () => {
    const c = goodConfig();
    c.interestRatePerMonth = "4.5";
    c.fileChargeSlabs = [{ upTo: "5000", fileCharge: "100" }, { upTo: "", fileCharge: "300" }];
    c.tenures = ["12", 6, "6", 3];
    c.lateFee = "250";
    const out = validateConfigInput(c);
    expect(out.interestRatePerMonth).toBe(4.5);
    expect(out.fileChargeSlabs).toEqual([{ upTo: 5000, fileCharge: 100 }, { upTo: null, fileCharge: 300 }]);
    expect(out.tenures).toEqual([3, 6, 12]);
    expect(out.lateFee).toBe(250);
  });

  it.each([
    ["unknown interest type", (c) => (c.interestType = "compound"), /Interest type/],
    ["negative rate", (c) => (c.interestRatePerMonth = -1), /Interest rate/],
    ["absurd rate", (c) => (c.interestRatePerMonth = 80), /Interest rate/],
    ["no slabs", (c) => (c.fileChargeSlabs = []), /slab/],
    ["slab limits not increasing", (c) => (c.fileChargeSlabs = [{ upTo: 20000, fileCharge: 1 }, { upTo: 10000, fileCharge: 2 }, { upTo: null, fileCharge: 3 }]), /higher than the previous/],
    ["last slab with a limit", (c) => (c.fileChargeSlabs = [{ upTo: 10000, fileCharge: 1 }, { upTo: 20000, fileCharge: 2 }]), /last slab/i],
    ["negative file charge", (c) => (c.fileChargeSlabs[0].fileCharge = -5), /file charge/],
    ["no tenures", (c) => (c.tenures = []), /durations/],
    ["fractional tenure", (c) => (c.tenures = [3, 2.5]), /durations/],
    ["tenure too long", (c) => (c.tenures = [3, 120]), /durations/],
    ["date rules with a gap", (c) => (c.dueDateRules = [{ fromDay: 1, toDay: 10, dueDay: 1 }, { fromDay: 15, toDay: 31, dueDay: 10 }]), /no gaps/],
    ["date rules overlapping", (c) => (c.dueDateRules = [{ fromDay: 1, toDay: 15, dueDay: 1 }, { fromDay: 10, toDay: 31, dueDay: 10 }]), /no gaps/],
    ["date rules not reaching 31", (c) => (c.dueDateRules = [{ fromDay: 1, toDay: 20, dueDay: 1 }]), /no gaps/],
    ["first EMI day 30 (does not exist every month)", (c) => (c.dueDateRules = [{ fromDay: 1, toDay: 31, dueDay: 30 }]), /between 1 and 28/],
    ["negative late fee", (c) => (c.lateFee = -1), /Late fee/],
    ["min down payment 100%", (c) => (c.minDownPaymentPercent = 100), /Minimum down payment/],
    ["short WhatsApp number", (c) => (c.whatsappNumber = "12345"), /WhatsApp/],
    ["too many terms", (c) => (c.terms = Array(30).fill("x")), /terms/],
  ])("rejects: %s", (_name, mutate, pattern) => {
    const c = goodConfig();
    mutate(c);
    let error;
    try {
      validateConfigInput(c);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(400);
    expect(error.message).toMatch(pattern);
  });

  it("customers never see the WhatsApp number or the interest rate", () => {
    const pub = publicConfig({ ...DEFAULT_EMI_CONFIG, whatsappNumber: "919999999999", interestRatePerMonth: 5 });
    expect(Object.keys(pub).sort()).toEqual(["enabled", "interestType", "minDownPaymentPercent", "tenures"]);
  });
});

describe("WhatsApp quotation message", () => {
  const quote = (over = {}) => ({
    quoteId: "FQ-ABC123DEF4",
    customer: { name: "Rahul Verma", phone: "9999999999", panMasked: "ABCDE****F", aadhaarMasked: "XXXX XXXX 1234" },
    product: { name: "Galaxy A15", variantName: "6/128 GB" },
    imei1: "123456789012345",
    imei2: "",
    result: {
      price: 30000,
      downPayment: 5000,
      financeAmount: 25000,
      fileCharge: 2000,
      remainingInterest: 5500,
      totalPayable: 32500,
      months: 6,
      interestType: "flat",
      monthlyEmi: 5417,
      emiVaries: true,
      firstEmiDate: "2026-12-01",
      schedule: [5417, 5417, 5417, 5417, 5417, 5415].map((amount, i) => ({ no: i + 1, amount, dueDate: `2026-${String(12 + i > 12 ? 12 + i - 12 : 12 + i).padStart(2, "0")}-01` })),
    },
    ...over,
  });

  it("contains everything the shop needs and only masked ID numbers", () => {
    const msg = buildQuotationMessage(quote());
    expect(msg).toContain("FQ-ABC123DEF4");
    expect(msg).toContain("Rahul Verma");
    expect(msg).toContain("9999999999");
    expect(msg).toContain("Galaxy A15 (6/128 GB)");
    expect(msg).toContain("IMEI 1: 123456789012345");
    expect(msg).not.toContain("IMEI 2");
    expect(msg).toContain("Down payment: Rs 5,000");
    expect(msg).toContain("File charge: Rs 2,000");
    expect(msg).toContain("Interest (flat): Rs 5,500");
    expect(msg).toContain("Total payable: Rs 32,500");
    expect(msg).toContain("PAN: ABCDE****F");
    expect(msg).toContain("Aadhaar: XXXX XXXX 1234");
  });

  it("groups equal EMIs so a 24 month schedule stays short enough for a WhatsApp link", () => {
    const schedule = Array.from({ length: 24 }, (_, i) => ({ no: i + 1, amount: i === 23 ? 3411 : 3417, dueDate: `2027-${String((i % 12) + 1).padStart(2, "0")}-10` }));
    const msg = buildQuotationMessage(quote({ result: { ...quote().result, months: 24, schedule } }));
    expect(msg).toContain("EMI 1-23: Rs 3,417 each");
    expect(msg).toContain("EMI 24: Rs 3,411");
    expect(encodeURIComponent(msg).length).toBeLessThan(2000);
  });

  it("reducing interest (every EMI different) is still fully listed and the link stays short", () => {
    const schedule = Array.from({ length: 24 }, (_, i) => ({ no: i + 1, amount: 6000 - i * 37, dueDate: `2027-${String((i % 12) + 1).padStart(2, "0")}-10` }));
    const msg = buildQuotationMessage(quote({ result: { ...quote().result, months: 24, interestType: "reducing", schedule } }));
    expect(msg).toContain("Interest (reducing)");
    expect(msg).toContain("First EMI:");
    expect(msg.match(/EMI \d+:/g)).toHaveLength(24);
    expect(buildWhatsappUrl("919999999999", msg).length).toBeLessThan(4500);
  });

  it("builds a wa.me link with the encoded text", () => {
    expect(buildWhatsappUrl("918808802020", "Hi & bye\nnext")).toBe("https://wa.me/918808802020?text=Hi%20%26%20bye%0Anext");
  });
});

describe("EMI routes are protected", () => {
  it.each([
    ["get", "/api/emi/admin/config"],
    ["put", "/api/emi/admin/config"],
    ["get", "/api/emi/admin/quotes"],
    ["get", "/api/emi/admin/quotes/FQ-1"],
    ["patch", "/api/emi/admin/quotes/FQ-1"],
  ])("%s %s needs an admin", async (method, url) => {
    const anon = await request(app)[method](url).send({});
    expect(anon.status).toBe(401);
    for (const role of ["user", "customer", "seller", "delivery"]) {
      const res = await request(app)[method](url).set("Authorization", `Bearer ${token(role)}`).send({});
      expect(res.status).toBe(403);
    }
  });
});
