import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import axios from "axios";
import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import User from "../app/models/customer.js";
import Seller from "../app/models/seller.js";
import Category from "../app/models/category.js";
import Product from "../app/models/product.js";
import Setting from "../app/models/setting.js";
import Order from "../app/models/order.js";
import LocalPincode from "../app/models/localPincode.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "cod-fee-secret";
// Fake courier credentials: the LIVE code path runs, but every HTTP call goes to the fake below.
process.env.SHIPROCKET_EMAIL = "fake@example.com";
process.env.SHIPROCKET_PASSWORD = "fake-password";
process.env.SHIPROCKET_CONTACT_EMAIL = "shop@example.com";
delete process.env.SHIPROCKET_COD_FEE;

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");
const { invalidatePlatformRulesCache } = await import("../app/services/platformRulesService.js");
const { invalidate } = await import("../app/services/cacheService.js");
const { processShiprocketOrder } = await import("../app/services/shipping/shiprocketService.js");
const { computePlatformEarning } = await import("../app/utils/platformEarning.js");

jest.setTimeout(120000);

/**
 * REAL MongoDB test of the COD fee: Shiprocket charges extra for Cash on Delivery, the customer who picks COD
 * pays exactly that extra ("COD fee" line on the payment page), prepaid customers never do.
 * Shiprocket itself is a scripted fake. Runs only with RUN_E2E_TESTS=true and MONGO_URI_E2E (throw-away mongod).
 */
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);

(RUN ? describe : describe.skip)("COD fee - real DB end to end", () => {
  let app;
  let ctx;
  let calls;
  let fake;

  const token = (id, role) => jwt.sign({ id: String(id), role }, process.env.JWT_SECRET, { expiresIn: "2h" });

  function installFake() {
    jest.spyOn(axios, "get").mockImplementation(async (url, config) => {
      if (String(url).includes("/courier/serviceability/")) {
        calls.push({ url: "/courier/serviceability/", params: config?.params });
        const list = Number(config?.params?.cod) === 1 ? fake.codCouriers : fake.prepaidCouriers;
        return { data: { data: { available_courier_companies: list } } };
      }
      throw new Error(`Unexpected GET ${url}`);
    });
    jest.spyOn(axios, "post").mockImplementation(async (url, body) => {
      const u = String(url).replace("https://apiv2.shiprocket.in/v1/external", "");
      calls.push({ url: u, body });
      if (u === "/auth/login") return { data: { token: "fake-jwt" } };
      if (u === "/orders/create/adhoc") return { data: { order_id: 5551, shipment_id: 7771, status_code: 1 } };
      if (u === "/courier/assign/awb") {
        return { data: { response: { data: { awb_code: "AWB1", courier_name: "Ekart", courier_company_id: body?.courier_id || 10 } } } };
      }
      return { data: {} };
    });
  }
  const resetFake = () => {
    calls = [];
    fake = {
      // checkout quote on the prepaid basis: the cheapest courier is Ekart at 56
      prepaidCouriers: [
        { courier_company_id: 33, courier_name: "Delhivery Air", rate: 118, cod: 1 },
        { courier_company_id: 12, courier_name: "Ekart", rate: 56, cod: 1 },
      ],
      // the same parcel as COD: Ekart now costs 91, so the COD fee is 35
      codCouriers: [
        { courier_company_id: 33, courier_name: "Delhivery Air", rate: 160, cod: 1 },
        { courier_company_id: 12, courier_name: "Ekart", rate: 91, cod: 1 },
      ],
    };
  };

  async function seed() {
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const customer = await User.create({ name: "Customer", phone: `90000${s.slice(-5)}`, role: "user", isVerified: true });
    const seller = await Seller.create({
      name: "Seller", email: `seller_${s}@example.com`, phone: `91000${s.slice(-5)}`, password: "Password@123",
      shopName: "Mart", pincode: "452001", isVerified: true, location: { type: "Point", coordinates: [75.87, 22.717] },
    });
    await LocalPincode.create({ pincode: "452001", city: "Indore", isActive: true });
    const header = await Category.create({ name: `H ${s}`, slug: `h-${s}`, type: "header", adminCommissionType: "percentage", adminCommissionValue: 10, handlingFeeType: "fixed", handlingFeeValue: 20, status: "active" });
    const category = await Category.create({ name: `C ${s}`, slug: `c-${s}`, type: "category", parentId: header._id, status: "active" });
    const subcategory = await Category.create({ name: `S ${s}`, slug: `s-${s}`, type: "subcategory", parentId: category._id, status: "active" });
    const product = await Product.create({
      name: "Speaker", slug: `speaker-${s}`, sku: `SKU-${s}`, description: "x", price: 100, salePrice: 100, stock: 500,
      headerId: header._id, categoryId: category._id, subcategoryId: subcategory._id, sellerId: seller._id, status: "active",
    });
    await Setting.create({
      deliveryPricingMode: "distance_based", pricingMode: "distance_based", customerBaseDeliveryFee: 30,
      riderBasePayout: 30, baseDeliveryCharge: 30, baseDistanceCapacityKm: 0.5, incrementalKmSurcharge: 10,
      deliveryPartnerRatePerKm: 5, fleetCommissionRatePerKm: 5, fixedDeliveryFee: 30,
      customerPricingType: "fixed", customerFixedCharge: 50, riderEarningType: "fixed", riderFixedEarning: 40,
      handlingFeeStrategy: "highest_category_fee", codEnabled: true, onlineEnabled: true,
    });
    invalidatePlatformRulesCache();
    return { customer, seller, product, ct: token(customer._id, "user") };
  }

  const localAddress = { type: "Home", name: "C", address: "RNT Marg, Indore", city: "Indore", pincode: "452001", phone: "9999999999", location: { lat: 22.72, lng: 75.88 } };
  const courierAddress = { type: "Home", name: "C", address: "MG Road, Bengaluru", city: "Bengaluru", state: "Karnataka", pincode: "560001", phone: "9999999999", location: { lat: 12.97, lng: 77.59 } };

  const items = () => [{ product: String(ctx.product._id), quantity: 1, price: 100 }];
  const place = (mode, address = courierAddress) =>
    request(app).post("/api/orders").set("Authorization", `Bearer ${ctx.ct}`)
      .send({ items: items(), address, paymentMode: mode, timeSlot: "now" });
  const preview = (address = courierAddress, extra = {}) =>
    request(app).post("/api/orders/checkout/preview").set("Authorization", `Bearer ${ctx.ct}`)
      .send({ items: items(), address, ...extra });
  const placed = async (res) => Order.findOne({ orderId: res.body.result.order.orderId }).lean();

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: "5mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `cod_fee_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });
  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    await invalidate("cache:platform:settings:*");
    resetFake();
    jest.restoreAllMocks();
    installFake();
    ctx = await seed();
  });
  afterAll(async () => {
    jest.restoreAllMocks();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  describe("checkout preview (the customer has not chosen how to pay yet)", () => {
    it("shows the courier fee on the prepaid basis and quotes the COD fee separately; the total has no COD fee", async () => {
      const res = await preview();
      expect(res.status).toBe(200);
      const b = res.body.result.breakdown;
      expect(b.deliveryFeeCharged).toBe(56);
      expect(b.codFeeQuote).toBe(35); // 91 (COD) - 56 (prepaid), same courier
      expect(b.codFeeCharged).toBe(0);
      expect(b.grandTotal).toBe(176); // 100 + 56 + 20 handling
      expect(res.body.result.allowedPaymentModes.COD).toBe(true);
    });

    it("a payment mode sent with the preview does not change the total (the payment page adds the fee itself)", async () => {
      const res = await preview(courierAddress, { paymentMode: "COD" });
      expect(res.body.result.breakdown.grandTotal).toBe(176);
      expect(res.body.result.breakdown.codFeeCharged).toBe(0);
    });

    it("local delivery has no COD fee at all", async () => {
      const res = await preview(localAddress);
      expect(res.body.result.breakdown.codFeeQuote).toBe(0);
    });
  });

  describe("placing the order", () => {
    it("COD: the order total carries exactly Shiprocket's COD extra, as its own line", async () => {
      const res = await place("COD");
      expect(res.status).toBe(201);
      const o = await placed(res);
      expect(o.paymentBreakdown).toMatchObject({ deliveryFeeCharged: 56, codFeeCharged: 35, grandTotal: 211 });
      expect(o.pricing).toMatchObject({ deliveryFee: 56, codFee: 35, total: 211 });
    });

    it("online and UPI QR: no COD fee", async () => {
      for (const mode of ["ONLINE", "UPI_QR"]) {
        const res = await place(mode);
        expect(res.status).toBe(201);
        const o = await placed(res);
        expect(o.paymentBreakdown).toMatchObject({ codFeeCharged: 0, grandTotal: 176 });
        expect(o.pricing.codFee || 0).toBe(0);
      }
    });

    it("local delivery by COD: no COD fee", async () => {
      const res = await place("COD", localAddress);
      expect(res.status).toBe(201);
      expect((await placed(res)).paymentBreakdown.codFeeCharged).toBe(0);
    });

    it("the same number the payment page shows is what is charged (quote == charged)", async () => {
      const quote = (await preview()).body.result.breakdown;
      const o = await placed(await place("COD"));
      expect(o.paymentBreakdown.codFeeCharged).toBe(quote.codFeeQuote);
      expect(o.paymentBreakdown.grandTotal).toBe(quote.grandTotal + quote.codFeeQuote);
    });
  });

  describe("COD is not possible for this pincode", () => {
    beforeEach(() => {
      fake.codCouriers = []; // Shiprocket: no courier takes COD here
    });

    it("the preview hides COD and placing a COD order is refused; online still works", async () => {
      const res = await preview();
      expect(res.body.result.allowedPaymentModes).toMatchObject({ COD: false, ONLINE: true });
      const cod = await place("COD");
      expect(cod.status).toBe(400);
      expect(cod.body.message).toMatch(/Cash on Delivery is not available/);
      expect((await place("ONLINE")).status).toBe(201);
    });
  });

  describe("Shiprocket is unreachable (flat fallback rate)", () => {
    it("no COD fee is invented", async () => {
      jest.restoreAllMocks();
      jest.spyOn(axios, "get").mockRejectedValue(new Error("offline"));
      jest.spyOn(axios, "post").mockResolvedValue({ data: { token: "x" } });
      const res = await preview();
      expect(res.body.result.breakdown.codFeeQuote).toBe(0);
    });
  });

  describe("courier booking and the platform's books", () => {
    it("the courier is told to collect the COD fee too (it is part of the amount it takes from the customer)", async () => {
      const o = await Order.findById((await placed(await place("COD")))._id);
      await processShiprocketOrder(o);
      const create = calls.find((c) => c.url === "/orders/create/adhoc").body;
      expect(create.payment_method).toBe("COD");
      // collectable = sub_total + shipping + other charges - discount = 100 + 56 + (20 handling + 35 COD) = 211
      expect(create.sub_total + create.shipping_charges + create.transaction_charges - create.total_discount).toBe(211);
      // the COD booking asks for the cheapest COD courier (Ekart)
      expect(calls.find((c) => c.url === "/courier/assign/awb").body.courier_id).toBe(12);
    });

    it("the COD fee earns what the extra freight costs: the platform is the same as for a prepaid order", async () => {
      const cod = computePlatformEarning(await placed(await place("COD")));
      const online = computePlatformEarning(await placed(await place("ONLINE")));
      expect(cod.parts.codFee).toBe(35);
      expect(cod.parts.freightCost).toBe(-91); // 56 courier + 35 COD charge
      expect(cod.net).toBe(online.net);
    });
  });
});
