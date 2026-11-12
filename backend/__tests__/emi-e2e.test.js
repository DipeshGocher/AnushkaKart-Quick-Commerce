import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import Category from "../app/models/category.js";
import Product from "../app/models/product.js";
import Seller from "../app/models/seller.js";
import Setting from "../app/models/setting.js";
import FinanceConfig from "../app/models/financeConfig.js";
import FinanceQuote from "../app/models/financeQuote.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "emi-e2e-secret";

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");
const { decryptPii } = await import("../app/utils/piiCrypto.js");

jest.setTimeout(120000);

/**
 * REAL MongoDB end-to-end test for the EMI / finance feature.
 * Runs only with RUN_E2E_TESTS=true and MONGO_URI_E2E (never falls back to MONGO_URI),
 * in a throw-away database that is dropped at the end.
 */
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);
const PAN = "ABCDE1234F";
const AADHAAR = "123412341234";

(RUN ? describe : describe.skip)("EMI / finance - real DB end to end", () => {
  let app;
  let ctx;
  let phoneSeq = 0;

  const tok = (role, id = new mongoose.Types.ObjectId()) => jwt.sign({ id: String(id), role }, process.env.JWT_SECRET, { expiresIn: "2h" });
  const admin = () => `Bearer ${tok("admin")}`;
  const nextPhone = () => `98${String(10000000 + ++phoneSeq * 7919).slice(0, 8)}`;

  async function seed() {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const mobileHeader = await Category.create({ name: `Mobile ${suffix}`, slug: `mobile-${suffix}`, type: "header", status: "active", financeEnabled: false });
    const otherHeader = await Category.create({ name: `Grocery ${suffix}`, slug: `grocery-${suffix}`, type: "header", status: "active" });
    const seller = await Seller.create({
      name: "S", email: `s_${suffix}@example.com`, phone: `91${suffix.slice(-8)}`, password: "Password@123",
      shopName: "Shop", pincode: "452001", isVerified: true, location: { type: "Point", coordinates: [75.87, 22.71] },
    });
    const tree = async (header, tag) => {
      const category = await Category.create({ name: `C-${tag} ${suffix}`, slug: `c-${tag}-${suffix}`, type: "category", parentId: header._id, status: "active" });
      const subcategory = await Category.create({ name: `S-${tag} ${suffix}`, slug: `s-${tag}-${suffix}`, type: "subcategory", parentId: category._id, status: "active" });
      return { categoryId: category._id, subcategoryId: subcategory._id };
    };
    const mobileTree = await tree(mobileHeader, "m");
    const otherTree = await tree(otherHeader, "g");
    const base = { description: "x", stock: 10, status: "active", sellerId: seller._id };
    const phone = await Product.create({
      ...base, name: "Galaxy A15", slug: `a15-${suffix}`, sku: `A15-${suffix}`, price: 20000, salePrice: 18000, headerId: mobileHeader._id, ...mobileTree,
      mainImage: "https://cdn.test/a15.png",
      variants: [
        { name: "4/64 GB", sku: "A15-4-64", price: 15000, salePrice: 14000, stock: 5, images: ["https://cdn.test/a15-4.png"] },
        { name: "6/128 GB", sku: "A15-6-128", price: 20000, salePrice: 18000, stock: 5 },
      ],
    });
    const single = await Product.create({ ...base, name: "Keypad Phone", slug: `kp-${suffix}`, sku: `KP-${suffix}`, price: 2500, headerId: mobileHeader._id, ...mobileTree });
    const grocery = await Product.create({ ...base, name: "Rice", slug: `rice-${suffix}`, sku: `RICE-${suffix}`, price: 600, headerId: otherHeader._id, ...otherTree });
    const inactive = await Product.create({ ...base, name: "Old Phone", slug: `old-${suffix}`, sku: `OLD-${suffix}`, price: 9000, headerId: mobileHeader._id, ...mobileTree, status: "inactive" });
    return { mobileHeader, otherHeader, phone, single, grocery, inactive };
  }

  const enableMobile = (on = true) => Category.updateOne({ _id: ctx.mobileHeader._id }, { $set: { financeEnabled: on } });
  const setConfig = (patch) => request(app).put("/api/emi/admin/config").set("Authorization", admin()).send(patch);
  const baseConfig = () => ({
    enabled: true, interestType: "flat", interestRatePerMonth: 5,
    fileChargeSlabs: [{ upTo: 10000, fileCharge: 750 }, { upTo: 20000, fileCharge: 1500 }, { upTo: null, fileCharge: 2000 }],
    tenures: [3, 6, 12], lateFee: 590, minDownPaymentPercent: 0, whatsappNumber: "8808802020",
    dueDateRules: [{ fromDay: 1, toDay: 10, dueDay: 1 }, { fromDay: 11, toDay: 20, dueDay: 10 }, { fromDay: 21, toDay: 31, dueDay: 20 }],
    shop: { name: "Anushka Mobile Gallery", address: "Bus stand, Mauranipur", phone: "8808802020" },
    terms: ["Pay on time."],
  });
  const calc = (body) => request(app).post("/api/emi/calculate").send(body);
  const quoteBody = (over = {}) => ({
    productId: String(ctx.phone._id), variantSku: "A15-6-128", downPayment: 5000, months: 6,
    customer: { name: "Rahul Verma", phone: nextPhone(), pan: PAN, aadhaar: AADHAAR },
    imei1: "123456789012345", ...over,
  });
  const quote = (over = {}, auth) => {
    const r = request(app).post("/api/emi/quotes");
    if (auth) r.set("Authorization", auth);
    return r.send(quoteBody(over));
  };

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: "2mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `emi_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });

  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    ctx = await seed();
    await enableMobile(true);
    await FinanceConfig.create({ key: "default", ...baseConfig(), whatsappNumber: "8808802020" });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  describe("which products get the finance button", () => {
    it("only header categories the admin switched on", async () => {
      const res = await request(app).get("/api/emi/enabled-headers");
      expect(res.status).toBe(200);
      expect(res.body.result).toEqual({ enabled: true, headerIds: [String(ctx.mobileHeader._id)] });
      await enableMobile(false);
      expect((await request(app).get("/api/emi/enabled-headers")).body.result.headerIds).toEqual([]);
    });

    it("turning finance off globally hides it everywhere", async () => {
      await setConfig({ ...baseConfig(), enabled: false });
      expect((await request(app).get("/api/emi/enabled-headers")).body.result).toEqual({ enabled: false, headerIds: [] });
      const info = await request(app).get(`/api/emi/product/${ctx.phone._id}`).query({ variant: "A15-6-128" });
      expect(info.body.result.available).toBe(false);
    });

    it("the admin can switch a header category on through the category API (FormData string 'true')", async () => {
      await enableMobile(false);
      const res = await request(app)
        .put(`/api/admin/categories/${ctx.mobileHeader._id}`)
        .set("Authorization", admin())
        .field("financeEnabled", "true");
      expect(res.status).toBe(200);
      expect((await Category.findById(ctx.mobileHeader._id).lean()).financeEnabled).toBe(true);
      const off = await request(app).put(`/api/admin/categories/${ctx.mobileHeader._id}`).set("Authorization", admin()).field("financeEnabled", "false");
      expect(off.status).toBe(200);
      expect((await Category.findById(ctx.mobileHeader._id).lean()).financeEnabled).toBe(false);
    });
  });

  describe("auto-filled product details", () => {
    it("variant name, price (sale price) and image come from the server", async () => {
      const res = await request(app).get(`/api/emi/product/${ctx.phone._id}`).query({ variant: "A15-4-64" });
      expect(res.status).toBe(200);
      expect(res.body.result.available).toBe(true);
      expect(res.body.result.product).toMatchObject({
        id: String(ctx.phone._id), name: "Galaxy A15", variantName: "4/64 GB", variantSku: "A15-4-64", price: 14000,
        image: "https://cdn.test/a15-4.png",
      });
      expect(res.body.result.config).toEqual({ enabled: true, interestType: "flat", tenures: [3, 6, 12], minDownPaymentPercent: 0 });
    });

    it("a variant can be found by its name too, and the other variant has its own price", async () => {
      const res = await request(app).get(`/api/emi/product/${ctx.phone._id}`).query({ variant: "6/128 GB" });
      expect(res.body.result.product).toMatchObject({ variantSku: "A15-6-128", price: 18000, image: "https://cdn.test/a15.png" });
    });

    it("a product with variants but no variant chosen asks for one", async () => {
      const res = await request(app).get(`/api/emi/product/${ctx.phone._id}`);
      expect(res.body.result.available).toBe(false);
      expect(res.body.result.reason).toMatch(/variant/i);
    });

    it("a product without variants uses its own price", async () => {
      const res = await request(app).get(`/api/emi/product/${ctx.single._id}`);
      expect(res.body.result.available).toBe(true);
      expect(res.body.result.product.price).toBe(2500);
    });

    it("a product outside a finance category, an inactive product and a bad id are all refused cleanly", async () => {
      const g = await request(app).get(`/api/emi/product/${ctx.grocery._id}`);
      expect(g.body.result.available).toBe(false);
      expect((await request(app).get(`/api/emi/product/${ctx.inactive._id}`)).status).toBe(404);
      expect((await request(app).get("/api/emi/product/not-an-id")).status).toBe(404);
      expect((await request(app).get(`/api/emi/product/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
    });
  });

  describe("calculation (server decides every number)", () => {
    it("worked example: Rs 18,000 phone, Rs 3,000 down, 6 months, flat 5%", async () => {
      const res = await calc({ productId: String(ctx.phone._id), variantSku: "A15-6-128", downPayment: 3000, months: 6 });
      expect(res.status).toBe(200);
      const r = res.body.result;
      expect(r).toMatchObject({ price: 18000, downPayment: 3000, financeAmount: 15000, months: 6, interestType: "flat", fileCharge: 1500, totalInterest: 4500, remainingInterest: 3000, totalPayable: 19500 });
      expect(r.schedule.reduce((a, s) => a + s.amount, 0)).toBeCloseTo(19500, 2);
      expect(r.schedule).toHaveLength(6);
    });

    it("the browser cannot override the price", async () => {
      const res = await calc({ productId: String(ctx.phone._id), variantSku: "A15-6-128", downPayment: 3000, months: 6, price: 1, financeAmount: 1, interestType: "reducing" });
      expect(res.body.result.price).toBe(18000);
      expect(res.body.result.interestType).toBe("flat");
    });

    it.each([
      ["down payment equal to price", { downPayment: 18000 }],
      ["negative down payment", { downPayment: -5 }],
      ["missing down payment", { downPayment: undefined }],
      ["a duration the admin has not allowed", { months: 7 }],
      ["no duration", { months: undefined }],
    ])("%s is a 400", async (_n, over) => {
      const res = await calc({ productId: String(ctx.phone._id), variantSku: "A15-6-128", downPayment: 3000, months: 6, ...over });
      expect(res.status).toBe(400);
    });

    it("admin settings drive the result: reducing interest, new slabs, new tenures, minimum down payment", async () => {
      const body = { productId: String(ctx.phone._id), variantSku: "A15-6-128", downPayment: 3000, months: 6 };
      const flat = (await calc(body)).body.result;

      const saved = await setConfig({
        ...baseConfig(), interestType: "reducing", interestRatePerMonth: 3,
        fileChargeSlabs: [{ upTo: 50000, fileCharge: 400 }, { upTo: null, fileCharge: 900 }],
        tenures: [6, 9], minDownPaymentPercent: 10,
      });
      expect(saved.status).toBe(200);

      const r = (await calc(body)).body.result;
      expect(r.interestType).toBe("reducing");
      expect(r.fileCharge).toBe(400);
      expect(r.totalInterest).toBeLessThan(flat.totalInterest);
      expect(r.emiVaries).toBe(true);

      expect((await calc({ ...body, months: 3 })).status).toBe(400); // 3 no longer offered
      expect((await calc({ ...body, downPayment: 1000 })).status).toBe(400); // below 10% of 18,000
      expect((await calc({ ...body, downPayment: 1800 })).status).toBe(200);
    });
  });

  describe("admin settings API", () => {
    it("returns defaults when nothing was saved, and rejects bad input without changing anything", async () => {
      await FinanceConfig.deleteMany({});
      const got = await request(app).get("/api/emi/admin/config").set("Authorization", admin());
      expect(got.status).toBe(200);
      expect(got.body.result.interestType).toBe("flat");
      expect(got.body.result.fileChargeSlabs).toHaveLength(3);
      expect(got.body.result.terms.length).toBeGreaterThan(0);

      const bad = await setConfig({ ...baseConfig(), interestRatePerMonth: 999 });
      expect(bad.status).toBe(400);
      expect(await FinanceConfig.countDocuments({})).toBe(0);
    });

    it("saves, and the saved values come back", async () => {
      const res = await setConfig({ ...baseConfig(), lateFee: 750, whatsappNumber: "9998887776", shop: { name: "My Shop", address: "A", phone: "1" } });
      expect(res.status).toBe(200);
      const doc = await FinanceConfig.findOne({ key: "default" }).lean();
      expect(doc.lateFee).toBe(750);
      expect(doc.whatsappNumber).toBe("9998887776");
      expect(doc.shop.name).toBe("My Shop");
      expect(await FinanceConfig.countDocuments({})).toBe(1);
    });
  });

  describe("quotation: saved, safe, ready for WhatsApp and PDF", () => {
    it("creates a quotation with a WhatsApp link, and stores ID numbers encrypted", async () => {
      const res = await quote();
      expect(res.status).toBe(201);
      const { quote: q, whatsappUrl, message, print } = res.body.result;

      expect(q.quoteId).toMatch(/^FQ-[0-9A-F]{10}$/);
      expect(q.result.financeAmount).toBe(13000); // 18,000 - 5,000
      expect(q.product).toMatchObject({ name: "Galaxy A15", variantName: "6/128 GB", variantSku: "A15-6-128" });
      expect(whatsappUrl.startsWith("https://wa.me/918808802020?text=")).toBe(true);
      expect(decodeURIComponent(whatsappUrl.split("?text=")[1])).toBe(message);
      expect(message).toContain(q.quoteId);
      expect(message).toContain("Rahul Verma");
      expect(message).toContain("PAN: ABCDE****F");
      expect(message).toContain("Aadhaar: XXXX XXXX 1234");
      expect(message).toContain("IMEI 1: 123456789012345");
      expect(print.shop.name).toBe("Anushka Mobile Gallery");
      expect(print.terms).toEqual(["Pay on time."]);

      // the customer never gets the ID numbers back, not even masked
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain(PAN);
      expect(raw).not.toContain(AADHAAR);
      expect(raw).not.toContain("panMasked");

      // stored encrypted
      const stored = await FinanceQuote.findOne({ quoteId: q.quoteId }).select("+customer.panEnc +customer.aadhaarEnc").lean();
      expect(stored.customer.panEnc).not.toContain(PAN);
      expect(stored.customer.aadhaarEnc).not.toContain(AADHAAR);
      expect(decryptPii(stored.customer.panEnc)).toBe(PAN);
      expect(decryptPii(stored.customer.aadhaarEnc)).toBe(AADHAAR);
      expect(stored.customer.panMasked).toBe("ABCDE****F");
      expect(stored.status).toBe("new");
      expect(stored.settingsSnapshot.interestRatePerMonth).toBe(5);
    });

    it("PAN, Aadhaar and IMEI are optional", async () => {
      const res = await quote({ customer: { name: "Sita Devi", phone: nextPhone() }, imei1: undefined });
      expect(res.status).toBe(201);
      expect(res.body.result.message).not.toContain("PAN:");
      expect(res.body.result.message).not.toContain("Aadhaar:");
    });

    it("a logged-in customer is linked to the quotation; a guest is fine too", async () => {
      const userId = new mongoose.Types.ObjectId();
      const res = await quote({}, `Bearer ${tok("user", userId)}`);
      expect(res.status).toBe(201);
      expect(String((await FinanceQuote.findOne({ quoteId: res.body.result.quote.quoteId }).lean()).customerUser)).toBe(String(userId));
      const guest = await quote();
      expect(guest.status).toBe(201);
      expect((await FinanceQuote.findOne({ quoteId: guest.body.result.quote.quoteId }).lean()).customerUser).toBeNull();
    });

    it.each([
      ["short name", { customer: { name: "A", phone: "9876543210" } }],
      ["phone with 9 digits", { customer: { name: "Rahul", phone: "987654321" } }],
      ["phone starting with 1", { customer: { name: "Rahul", phone: "1234567890" } }],
      ["bad PAN", { customer: { name: "Rahul", phone: "9876543210", pan: "ABC123" } }],
      ["bad Aadhaar", { customer: { name: "Rahul", phone: "9876543210", aadhaar: "1234" } }],
      ["short IMEI", { imei1: "12345" }],
      ["same IMEI twice", { imei1: "123456789012345", imei2: "123456789012345" }],
      ["down payment above the price", { downPayment: 99999 }],
      ["a duration that is not offered", { months: 5 }],
      ["a product with no finance", { productId: "GROCERY" }],
    ])("rejects %s and saves nothing", async (_n, over) => {
      const body = { ...over };
      if (body.productId === "GROCERY") body.productId = String(ctx.grocery._id);
      const res = await quote(body);
      expect(res.status).toBe(400);
      expect(await FinanceQuote.countDocuments({})).toBe(0);
    });

    it("no WhatsApp number anywhere: a clear 503 and nothing is saved", async () => {
      await FinanceConfig.updateOne({ key: "default" }, { $set: { whatsappNumber: "" } });
      const res = await quote();
      expect(res.status).toBe(503);
      expect(await FinanceQuote.countDocuments({})).toBe(0);
    });

    it("falls back to the store's WhatsApp number from general settings", async () => {
      await FinanceConfig.updateOne({ key: "default" }, { $set: { whatsappNumber: "" } });
      await Setting.create({ whatsappNumber: "9111122222" });
      const res = await quote();
      expect(res.status).toBe(201);
      expect(res.body.result.whatsappUrl.startsWith("https://wa.me/919111122222?")).toBe(true);
    });

    it("a saved quotation keeps its numbers when the admin changes the settings later", async () => {
      const created = await quote();
      const id = created.body.result.quote.quoteId;
      const before = (await FinanceQuote.findOne({ quoteId: id }).lean()).result;
      await setConfig({ ...baseConfig(), interestRatePerMonth: 9, interestType: "reducing" });
      const after = (await FinanceQuote.findOne({ quoteId: id }).lean()).result;
      expect(after).toEqual(before);
      expect(after.interestType).toBe("flat");
    });

    it("spamming one phone number is rate limited", async () => {
      const phone = nextPhone();
      const results = [];
      for (let i = 0; i < 12; i += 1) {
        results.push((await quote({ customer: { name: "Spammer", phone } })).status);
      }
      expect(results.slice(0, 10).every((s) => s === 201)).toBe(true);
      expect(results.slice(10)).toEqual([429, 429]);
    });
  });

  describe("admin: quotation requests", () => {
    it("list, search, filter, open (masked), reveal, update status and note", async () => {
      const a = (await quote({ customer: { name: "Rahul Verma", phone: nextPhone(), pan: PAN, aadhaar: AADHAAR } })).body.result.quote;
      const b = (await quote({ customer: { name: "Sita Devi", phone: nextPhone() }, variantSku: "A15-4-64", downPayment: 2000 })).body.result.quote;

      const list = await request(app).get("/api/emi/admin/quotes").set("Authorization", admin());
      expect(list.status).toBe(200);
      expect(list.body.result.total).toBe(2);
      expect(list.body.result.newCount).toBe(2);
      expect(JSON.stringify(list.body)).not.toContain(PAN);
      expect(JSON.stringify(list.body)).not.toContain("panEnc");

      const search = await request(app).get("/api/emi/admin/quotes").query({ search: "sita" }).set("Authorization", admin());
      expect(search.body.result.items.map((i) => i.quoteId)).toEqual([b.quoteId]);

      const detail = await request(app).get(`/api/emi/admin/quotes/${a.quoteId}`).set("Authorization", admin());
      expect(detail.status).toBe(200);
      expect(detail.body.result.customer.panMasked).toBe("ABCDE****F");
      expect(detail.body.result.customer.pan).toBeUndefined();
      expect(JSON.stringify(detail.body)).not.toContain("panEnc");

      const revealed = await request(app).get(`/api/emi/admin/quotes/${a.quoteId}`).query({ reveal: "true" }).set("Authorization", admin());
      expect(revealed.body.result.customer.pan).toBe(PAN);
      expect(revealed.body.result.customer.aadhaar).toBe(AADHAAR);

      const patch = await request(app).patch(`/api/emi/admin/quotes/${a.quoteId}`).set("Authorization", admin()).send({ status: "contacted", adminNote: "Called, coming tomorrow" });
      expect(patch.status).toBe(200);
      expect(patch.body.result.status).toBe("contacted");
      expect(patch.body.result.adminNote).toBe("Called, coming tomorrow");

      const onlyNew = await request(app).get("/api/emi/admin/quotes").query({ status: "new" }).set("Authorization", admin());
      expect(onlyNew.body.result.items.map((i) => i.quoteId)).toEqual([b.quoteId]);

      expect((await request(app).patch(`/api/emi/admin/quotes/${a.quoteId}`).set("Authorization", admin()).send({ status: "bogus" })).status).toBe(400);
      expect((await request(app).get("/api/emi/admin/quotes/FQ-NOPE")).status).toBe(401);
      expect((await request(app).get("/api/emi/admin/quotes/FQ-NOPE").set("Authorization", admin())).status).toBe(404);
    });

    it("follow-up can be marked done and undone, and a quotation can be deleted", async () => {
      const a = (await quote()).body.result.quote;
      const b = (await quote()).body.result.quote;
      const url = (id) => `/api/emi/admin/quotes/${id}`;

      // marked followed-up -> leaves the "new" list and the new counter, still in "all"
      expect((await request(app).patch(url(a.quoteId)).set("Authorization", admin()).send({ status: "contacted" })).status).toBe(200);
      const onlyNew = await request(app).get("/api/emi/admin/quotes").query({ status: "new" }).set("Authorization", admin());
      expect(onlyNew.body.result.items.map((i) => i.quoteId)).toEqual([b.quoteId]);
      expect(onlyNew.body.result.newCount).toBe(1);
      expect((await request(app).get("/api/emi/admin/quotes").set("Authorization", admin())).body.result.total).toBe(2);

      // undo -> back to new
      expect((await request(app).patch(url(a.quoteId)).set("Authorization", admin()).send({ status: "new" })).body.result.status).toBe("new");

      // delete: needs admin, removes only that one, second delete is a 404
      expect((await request(app).delete(url(a.quoteId))).status).toBe(401);
      expect((await request(app).delete(url(a.quoteId)).set("Authorization", `Bearer ${tok("user")}`)).status).toBe(403);
      expect(await FinanceQuote.countDocuments({})).toBe(2);
      expect((await request(app).delete(url(a.quoteId)).set("Authorization", admin())).status).toBe(200);
      expect(await FinanceQuote.countDocuments({})).toBe(1);
      expect(await FinanceQuote.findOne({ quoteId: b.quoteId })).not.toBeNull();
      expect((await request(app).delete(url(a.quoteId)).set("Authorization", admin())).status).toBe(404);
    });

    it("a customer cannot read the admin list", async () => {
      expect((await request(app).get("/api/emi/admin/quotes").set("Authorization", `Bearer ${tok("user")}`)).status).toBe(403);
    });

    it("search text is treated as text, not as a pattern", async () => {
      await quote();
      const res = await request(app).get("/api/emi/admin/quotes").query({ search: ".*(" }).set("Authorization", admin());
      expect(res.status).toBe(200);
      expect(res.body.result.total).toBe(0);
    });
  });
});
