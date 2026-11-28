import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import axios from "axios";
import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import Order from "../app/models/order.js";
import Seller from "../app/models/seller.js";
import User from "../app/models/customer.js";
import Category from "../app/models/category.js";
import Product from "../app/models/product.js";
import Setting from "../app/models/setting.js";
import LocalPincode from "../app/models/localPincode.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "sr-automation-secret";
// Fake courier credentials: the LIVE code path runs, but every HTTP call goes to the fake below.
process.env.SHIPROCKET_EMAIL = "fake@example.com";
process.env.SHIPROCKET_PASSWORD = "fake-password";
process.env.SHIPROCKET_CONTACT_EMAIL = "shop@example.com";
process.env.SHIPROCKET_AWB_RETRY_DELAY_MS = "5";

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");
const { retryPendingShiprocketAutomation } = await import("../app/services/shipping/shiprocketAutomation.js");

jest.setTimeout(120000);

/**
 * REAL MongoDB end-to-end test for the "Packed = shipment + AWB + pickup + label" automation,
 * through the real HTTP routes. Shiprocket itself is replaced by a scripted fake (no network).
 * Runs only with RUN_E2E_TESTS=true and MONGO_URI_E2E (a throw-away local mongod; never MONGO_URI).
 * MONGO_URI_E2E must be a replica set (the real-checkout tests place orders, and checkout uses transactions).
 */
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);

(RUN ? describe : describe.skip)("Courier Packed automation - real DB end to end", () => {
  let app;
  let seller;
  let otherSeller;
  let orderSeq = 0;

  // ---- scripted fake Shiprocket -------------------------------------------------------------
  let calls;
  let fake;
  const resetFake = () => {
    calls = [];
    fake = { create: "ok", awbFailures: 0, pickup: "ok", label: "ok", couriers: null, refuseCourierId: false };
  };
  const urlOf = (u) => String(u).replace("https://apiv2.shiprocket.in/v1/external", "");
  const names = () => calls.map((c) => c.url);
  const count = (u) => names().filter((n) => n === u).length;

  function installFake() {
    jest.spyOn(axios, "get").mockImplementation(async (url, config) => {
      if (fake.couriers && String(url).includes("/courier/serviceability/")) {
        calls.push({ url: "/courier/serviceability/", params: config?.params });
        return { data: { data: { available_courier_companies: fake.couriers } } };
      }
      throw new Error("offline (serviceability falls back to the flat rate)");
    });
    jest.spyOn(axios, "post").mockImplementation(async (url, body) => {
      const u = urlOf(url);
      calls.push({ url: u, body });
      if (u === "/auth/login") return { data: { token: "fake-jwt" } };
      if (u === "/orders/create/adhoc") {
        if (fake.create === "fail") throw Object.assign(new Error("create failed"), { response: { data: { message: "Pickup address not verified" } } });
        return { data: { order_id: 5551, shipment_id: 7771, status_code: 1 } };
      }
      if (u === "/courier/assign/awb") {
        if (body?.courier_id && fake.refuseCourierId) {
          return { data: { awb_assign_status: 0, message: "Courier not serviceable right now" } };
        }
        if (fake.awbFailures > 0) {
          fake.awbFailures -= 1;
          return { data: { awb_assign_status: 0, message: "Courier busy, try again" } };
        }
        return { data: { awb_assign_status: 1, response: { data: { awb_code: "AWB123456", courier_name: "Delhivery Surface", courier_company_id: body?.courier_id || 10 } } } };
      }
      if (u === "/courier/generate/pickup") {
        if (fake.pickup === "fail") throw Object.assign(new Error("Request failed with status code 400"), { response: { status: 400, data: { message: "Pickup slot unavailable" } } });
        if (fake.pickup === "already") throw Object.assign(new Error("Request failed with status code 400"), { response: { status: 400, data: { message: "Pickup already scheduled for this shipment" } } });
        return { data: { pickup_status: 1 } };
      }
      if (u === "/courier/generate/label") {
        if (fake.label === "fail") throw Object.assign(new Error("label failed"), { response: { data: { message: "Label service down" } } });
        return { data: { label_created: 1, label_url: "https://label.test/7771.pdf" } };
      }
      if (u === "/orders/cancel/shipment/awbs" || u === "/orders/cancel") return { data: { status: 200 } };
      throw new Error(`Unexpected Shiprocket call: ${u}`);
    });
  }

  // ---- helpers ------------------------------------------------------------------------------
  const tok = (role, id) => jwt.sign({ id: String(id), role }, process.env.JWT_SECRET, { expiresIn: "2h" });
  const asSeller = (s = seller) => `Bearer ${tok("seller", s._id)}`;
  const asAdmin = () => `Bearer ${tok("admin", new mongoose.Types.ObjectId())}`;

  const makeSeller = (tag) =>
    Seller.create({
      name: `S ${tag}`, email: `s_${tag}_${Date.now()}@example.com`, phone: `91${String(Date.now()).slice(-8)}`, password: "Password@123",
      shopName: `Shop ${tag}`, pincode: "284204", isVerified: true, isActive: true, applicationStatus: "approved",
      location: { type: "Point", coordinates: [78.9, 25.2] },
    });

  async function makeOrder(over = {}) {
    orderSeq += 1;
    return Order.create({
      orderId: `ORD-SR-${Date.now()}-${orderSeq}`,
      customer: new mongoose.Types.ObjectId(),
      seller: seller._id,
      items: [{ product: new mongoose.Types.ObjectId(), name: "Galaxy A15", quantity: 1, price: 18000 }],
      address: { name: "Rahul Verma", address: "12 MG Road", city: "Pune", state: "Maharashtra", pincode: "411001", phone: "9876543210" },
      paymentMode: "COD",
      paymentBreakdown: { productSubtotal: 18000, deliveryFeeCharged: 60, grandTotal: 18060 },
      status: "confirmed",
      orderStatus: "confirmed",
      workflowVersion: 2,
      workflowStatus: "SELLER_ACCEPTED",
      fulfillmentType: "SHIPROCKET",
      ...over,
    });
  }

  const pack = async (order, auth = asSeller()) => {
    const res = await request(app).put(`/api/orders/status/${order.orderId}`).set("Authorization", auth).send({ status: "packed" });
    if (res.status >= 400 && process.env.DEBUG_E2E) process.stderr.write(`PACK ${res.status} ${JSON.stringify(res.body)}\n`);
    return res;
  };
  const fulfill = (order, auth = asSeller()) => request(app).post(`/api/shipping/shiprocket/fulfill/${order.orderId}`).set("Authorization", auth);
  const reload = (order) => Order.findById(order._id).lean();

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: "2mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `sr_auto_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });

  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    seller = await makeSeller("a");
    otherSeller = await makeSeller("b");
    resetFake();
    jest.restoreAllMocks();
    installFake();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  // ------------------------------------------------------------------------------------------
  describe("courier order: one click on Packed does everything", () => {
    it("books the shipment, assigns the AWB, requests pickup and fetches the label - in that order", async () => {
      const order = await makeOrder();
      const res = await pack(order);

      expect(res.status).toBe(200);
      expect(names().filter((n) => n !== "/auth/login")).toEqual([
        "/orders/create/adhoc", "/courier/assign/awb", "/courier/generate/pickup", "/courier/generate/label",
      ]);

      const saved = await reload(order);
      expect(saved.status).toBe("packed");
      expect(saved.workflowStatus).toBe("PICKUP_READY");
      expect(saved.shiprocket).toMatchObject({
        shipmentId: "7771", shiprocketOrderId: "5551", awb: "AWB123456", courierName: "Delhivery Surface",
        labelUrl: "https://label.test/7771.pdf", currentStatus: "PICKUP_SCHEDULED",
      });
      expect(saved.shiprocket.pickupScheduledAt).toBeTruthy();
      expect(saved.shiprocket.automation).toMatchObject({ state: "COMPLETE", lastError: null });
      expect(saved.shiprocketFulfillLockUntil).toBeNull();
      // the response the seller's screen receives already carries the AWB and label
      expect(res.body.result.shiprocket).toMatchObject({ awb: "AWB123456", labelUrl: "https://label.test/7771.pdf" });
    });

    it("the booking payload carries the customer, address, amount and COD flag", async () => {
      const order = await makeOrder();
      await pack(order);
      const body = calls.find((c) => c.url === "/orders/create/adhoc").body;
      expect(body).toMatchObject({
        order_id: order.orderId, billing_pincode: "411001", billing_phone: "9876543210", payment_method: "COD", sub_total: 18000,
      });
    });

    it("pressing Packed / Retry again changes nothing and never books a second shipment", async () => {
      const order = await makeOrder();
      await pack(order);
      const before = calls.length;
      const again = await fulfill(order);
      expect(again.status).toBe(200);
      expect(again.body.result.complete).toBe(true);
      expect(calls.length).toBe(before); // not a single extra Shiprocket call
    });

    it("two simultaneous clicks on Packed book exactly one shipment", async () => {
      const order = await makeOrder();
      const [a, b] = await Promise.all([pack(order), pack(order)]);
      expect([a.status, b.status].sort()).toEqual([200, 200]);
      expect(count("/orders/create/adhoc")).toBe(1);
      expect(count("/courier/generate/pickup")).toBe(1);
      const saved = await reload(order);
      expect(saved.shiprocket.awb).toBe("AWB123456");
      expect(saved.status).toBe("packed");
    });

    it("the seller can reopen the label any time", async () => {
      const order = await makeOrder();
      await pack(order);
      const res = await request(app).get(`/api/shipping/shiprocket/label/${order.orderId}`).set("Authorization", asSeller());
      expect(res.status).toBe(200);
      expect(res.body.result.labelUrl).toBe("https://label.test/7771.pdf");
    });
  });

  describe("when a step fails the order is still Packed and recovers by itself", () => {
    it("AWB keeps failing: 1 try at booking + 3 retries, no pickup, state AWB_PENDING with the reason; the Retry button then completes it", async () => {
      fake.awbFailures = 99;
      const order = await makeOrder();
      const res = await pack(order);

      expect(res.status).toBe(200); // the seller's Packed is not blocked
      expect(count("/courier/assign/awb")).toBe(4); // 1 during booking + 3 retries
      expect(count("/courier/generate/pickup")).toBe(0);
      let saved = await reload(order);
      expect(saved.status).toBe("packed");
      expect(saved.shiprocket.awb).toBeNull();
      expect(saved.shiprocket.shipmentId).toBe("7771");
      expect(saved.shiprocket.automation).toMatchObject({ state: "AWB_PENDING", attempts: 1 });
      expect(saved.shiprocket.automation.lastError).toMatch(/Courier busy/);

      fake.awbFailures = 0;
      const retry = await fulfill(order);
      expect(retry.status).toBe(200);
      expect(retry.body.result.complete).toBe(true);
      expect(count("/orders/create/adhoc")).toBe(1); // the shipment was NOT booked again
      saved = await reload(order);
      expect(saved.shiprocket).toMatchObject({ awb: "AWB123456", labelUrl: "https://label.test/7771.pdf", currentStatus: "PICKUP_SCHEDULED" });
      expect(saved.shiprocket.automation.state).toBe("COMPLETE");
    });

    it("AWB fails once at booking, the retry succeeds: no failure is shown at all", async () => {
      fake.awbFailures = 1;
      const order = await makeOrder();
      await pack(order);
      expect(count("/courier/assign/awb")).toBe(2); // booking try failed, first retry worked
      expect((await reload(order)).shiprocket.automation.state).toBe("COMPLETE");
    });

    it("pickup fails: AWB and label are kept, state PICKUP_PENDING; the retry job finishes it", async () => {
      fake.pickup = "fail";
      const order = await makeOrder();
      await pack(order);
      let saved = await reload(order);
      expect(saved.status).toBe("packed");
      expect(saved.shiprocket.awb).toBe("AWB123456");
      expect(saved.shiprocket.labelUrl).toBe("https://label.test/7771.pdf");
      expect(saved.shiprocket.pickupScheduledAt).toBeFalsy();
      expect(saved.shiprocket.automation).toMatchObject({ state: "PICKUP_PENDING" });
      // the seller must see Shiprocket's own reason, never just "Request failed with status code 400"
      expect(saved.shiprocket.automation.lastError).toMatch(/Pickup slot unavailable/);
      expect(saved.shiprocket.automation.lastError).not.toBe("Request failed with status code 400");

      // too soon for the job (it waits a few minutes between tries)
      expect((await retryPendingShiprocketAutomation()).found).toBe(0);

      fake.pickup = "ok";
      const summary = await retryPendingShiprocketAutomation({ minGapMs: 0 });
      expect(summary).toMatchObject({ found: 1, completed: 1, stillPending: 0, failed: 0 });
      saved = await reload(order);
      expect(saved.shiprocket.currentStatus).toBe("PICKUP_SCHEDULED");
      expect(saved.shiprocket.automation.state).toBe("COMPLETE");
      expect(count("/orders/create/adhoc")).toBe(1);
    });

    describe("the courier booked is the one the checkout fee was quoted for", () => {
      const couriers = [
        { courier_company_id: 33, courier_name: "Delhivery Air", rate: 118 },
        { courier_company_id: 12, courier_name: "Ekart Surface", rate: 56 },
        { courier_company_id: 44, courier_name: "Xpressbees", rate: 71 },
      ];

      it("asks Shiprocket for the cheapest courier (what checkout charged) and keeps its id for retries", async () => {
        fake.couriers = couriers;
        const order = await makeOrder();
        await pack(order);
        const assign = calls.find((c) => c.url === "/courier/assign/awb");
        expect(assign.body).toMatchObject({ shipment_id: 7771, courier_id: 12 });
        const quote = calls.find((c) => c.url === "/courier/serviceability/");
        expect(quote.params).toMatchObject({ pickup_postcode: "284204", delivery_postcode: "411001", cod: 1 }); // COD order, seller pincode
        const saved = await reload(order);
        expect(saved.shiprocket.awb).toBe("AWB123456");
        expect(saved.shiprocket.courierId).toBe("12");
        expect(saved.shiprocket.automation.state).toBe("COMPLETE");
      });

      it("the courier is refused: Shiprocket chooses, the order is still booked", async () => {
        fake.couriers = couriers;
        fake.refuseCourierId = true;
        const order = await makeOrder();
        await pack(order);
        const assigns = calls.filter((c) => c.url === "/courier/assign/awb");
        expect(assigns).toHaveLength(2);
        expect(assigns[0].body.courier_id).toBe(12);
        expect(assigns[1].body.courier_id).toBeUndefined();
        expect((await reload(order)).shiprocket.awb).toBe("AWB123456");
      });

      it("no live rate (Shiprocket offline): books exactly as before, no courier asked for", async () => {
        const order = await makeOrder();
        await pack(order);
        const assign = calls.find((c) => c.url === "/courier/assign/awb");
        expect(assign.body.courier_id).toBeUndefined();
        expect((await reload(order)).shiprocket.awb).toBe("AWB123456");
      });
    });

    it("Shiprocket says the pickup already exists: treated as scheduled, order completes (no stuck Retry)", async () => {
      fake.pickup = "already";
      const order = await makeOrder();
      await pack(order);
      const saved = await reload(order);
      expect(saved.shiprocket.currentStatus).toBe("PICKUP_SCHEDULED");
      expect(saved.shiprocket.automation.state).toBe("COMPLETE");
    });

    it("label fails: pickup is still booked, state LABEL_PENDING, and Print Label works once the service is back", async () => {
      fake.label = "fail";
      const order = await makeOrder();
      await pack(order);
      const saved = await reload(order);
      expect(saved.shiprocket.pickupScheduledAt).toBeTruthy();
      expect(saved.shiprocket.automation.state).toBe("LABEL_PENDING");

      fake.label = "ok";
      const res = await request(app).get(`/api/shipping/shiprocket/label/${order.orderId}`).set("Authorization", asSeller());
      expect(res.body.result.labelUrl).toBe("https://label.test/7771.pdf");
    });

    it("the job gives up after the maximum number of automatic tries (no endless retrying)", async () => {
      fake.pickup = "fail";
      const order = await makeOrder();
      await pack(order);
      await Order.updateOne({ _id: order._id }, { $set: { "shiprocket.automation.attempts": 6 } });
      expect((await retryPendingShiprocketAutomation({ minGapMs: 0 })).found).toBe(0);
    });

    it("if booking the shipment itself fails nothing is created and the order is NOT marked packed", async () => {
      fake.create = "fail";
      const order = await makeOrder();
      const res = await pack(order);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.message).toMatch(/Pickup address not verified/);
      const saved = await reload(order);
      expect(saved.status).toBe("confirmed");
      expect(saved.shiprocket.shipmentId).toBeNull();
      expect(saved.shiprocketFulfillLockUntil).toBeNull(); // lock released even on failure

      fake.create = "ok";
      expect((await pack(order)).status).toBe(200);
      expect((await reload(order)).status).toBe("packed");
    });
  });

  describe("permissions and guards", () => {
    it("another seller cannot pack or retry this order", async () => {
      const order = await makeOrder();
      expect((await pack(order, asSeller(otherSeller))).status).toBe(403);
      expect((await fulfill(order, asSeller(otherSeller))).status).toBe(403);
      expect(count("/orders/create/adhoc")).toBe(0);
    });

    it("admin can run the pipeline for any order", async () => {
      const order = await makeOrder();
      expect((await fulfill(order, asAdmin())).status).toBe(200);
      expect((await reload(order)).shiprocket.awb).toBe("AWB123456");
    });

    it("an unpaid online order is not booked (money first)", async () => {
      const order = await makeOrder({ paymentMode: "ONLINE", paymentStatus: "CREATED" });
      const res = await pack(order);
      expect(res.status).toBe(409);
      expect(count("/orders/create/adhoc")).toBe(0);
      expect((await reload(order)).status).toBe("confirmed");
    });

    it("a cancelled order cannot be fulfilled", async () => {
      const order = await makeOrder({ status: "cancelled", orderStatus: "cancelled", workflowStatus: "CANCELLED" });
      expect((await fulfill(order)).status).toBe(409);
      expect(calls.length).toBe(0);
    });

    it("nobody can fulfil a local (rider) order through the courier endpoint", async () => {
      const order = await makeOrder({ fulfillmentType: "LOCAL" });
      const res = await fulfill(order);
      expect(res.status).toBe(400);
      expect(calls.length).toBe(0);
    });

    it("a courier order can still be cancelled after the pickup was booked (the courier shipment is cancelled too)", async () => {
      const order = await makeOrder();
      await pack(order);
      const res = await request(app).put(`/api/orders/status/${order.orderId}`).set("Authorization", asSeller()).send({ status: "cancelled", reason: "out of stock" });
      expect(res.status).toBe(200);
      expect(count("/orders/cancel/shipment/awbs")).toBe(1);
      expect((await reload(order)).status).toBe("cancelled");
    });
  });

  describe("local development without Shiprocket credentials (simulated mode)", () => {
    const saved = {};
    beforeEach(() => {
      saved.email = process.env.SHIPROCKET_EMAIL;
      saved.password = process.env.SHIPROCKET_PASSWORD;
      delete process.env.SHIPROCKET_EMAIL;
      delete process.env.SHIPROCKET_PASSWORD;
    });
    afterEach(() => {
      process.env.SHIPROCKET_EMAIL = saved.email;
      process.env.SHIPROCKET_PASSWORD = saved.password;
    });

    it("Packed still produces an AWB, pickup and label without calling Shiprocket", async () => {
      const order = await makeOrder();
      const res = await pack(order);
      expect(res.status).toBe(200);
      expect(calls.length).toBe(0);
      const s = await reload(order);
      expect(s.status).toBe("packed");
      expect(s.shiprocket.awb).toMatch(/^SR\d+IN$/);
      expect(s.shiprocket.labelUrl).toBeTruthy();
      expect(s.shiprocket.currentStatus).toBe("PICKUP_SCHEDULED");
      expect(s.shiprocket.automation.state).toBe("COMPLETE");
    });
  });

  describe("a REAL order: customer checkout -> seller confirms -> seller packs", () => {
    let ctx;
    const customerTok = () => `Bearer ${tok("user", ctx.customer._id)}`;
    const checkout = (pincode, city, state, paymentMode = "COD") =>
      request(app)
        .post("/api/orders")
        .set("Authorization", customerTok())
        .send({
          items: [{ product: String(ctx.product._id), quantity: 2, price: 1500 }],
          address: { type: "Home", name: "Rahul Verma", address: "12 MG Road", city, state, pincode, phone: "9876543210", location: { lat: 18.52, lng: 73.85 } },
          paymentMode,
          timeSlot: "now",
        });
    // For the packed-automation test the customer pays by UPI QR and the admin approves it.
    const payByQrAndApprove = async (orderId) => {
      const utr = await request(app).post(`/api/orders/${orderId}/payment/submit-utr`).set("Authorization", customerTok()).send({ utrNumber: "402938491029" });
      expect(utr.status).toBe(200);
      const ok = await request(app).post(`/api/orders/${orderId}/payment/approve-upi`).set("Authorization", asAdmin()).send({});
      expect(ok.status).toBe(200);
    };
    const setStatus = (orderId, status) =>
      request(app).put(`/api/orders/status/${orderId}`).set("Authorization", asSeller(ctx.seller)).send({ status });

    beforeEach(async () => {
      const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const customer = await User.create({ name: "Rahul Verma", phone: `90000${s.slice(-5)}`, role: "user", isVerified: true });
      const sel = await Seller.create({
        name: "Mauranipur Seller", email: `real_${s}@example.com`, phone: `91000${s.slice(-5)}`, password: "Password@123",
        shopName: "Anushka Mobile Gallery", pincode: "284204", isVerified: true, isActive: true, applicationStatus: "approved",
        location: { type: "Point", coordinates: [78.9, 25.25] },
      });
      await LocalPincode.create({ pincode: "284204", city: "Mauranipur", isActive: true });
      const header = await Category.create({ name: `H ${s}`, slug: `h-${s}`, type: "header", adminCommissionType: "percentage", adminCommissionValue: 10, handlingFeeType: "fixed", handlingFeeValue: 20, status: "active" });
      const category = await Category.create({ name: `C ${s}`, slug: `c-${s}`, type: "category", parentId: header._id, status: "active" });
      const subcategory = await Category.create({ name: `S ${s}`, slug: `s-${s}`, type: "subcategory", parentId: category._id, status: "active" });
      const product = await Product.create({
        name: "Galaxy A15", slug: `a15-${s}`, sku: `A15-${s}`, description: "x", price: 1500, salePrice: 1500, stock: 20,
        headerId: header._id, categoryId: category._id, subcategoryId: subcategory._id, sellerId: sel._id, status: "active",
      });
      await Setting.create({
        deliveryPricingMode: "distance_based", pricingMode: "distance_based", customerBaseDeliveryFee: 30,
        riderBasePayout: 30, baseDeliveryCharge: 30, baseDistanceCapacityKm: 0.5, incrementalKmSurcharge: 10,
        deliveryPartnerRatePerKm: 5, fleetCommissionRatePerKm: 5, fixedDeliveryFee: 30,
        customerPricingType: "fixed", customerFixedCharge: 50, riderEarningType: "fixed", riderFixedEarning: 40,
        handlingFeeStrategy: "highest_category_fee", codEnabled: true, onlineEnabled: true,
      });
      ctx = { customer, seller: sel, product };
    });

    it("out-of-town customer (Pune): courier order -> confirm -> Packed gives AWB, pickup and label with no extra clicks", async () => {
      // Cash on delivery is a normal choice for courier orders now (the admin can switch it off)...
      const codOrder = await checkout("411001", "Pune", "Maharashtra", "COD");
      expect(codOrder.status).toBe(201);
      expect(codOrder.body.result.order.fulfillmentType).toBe("SHIPROCKET");
      // ...this test follows the UPI QR order.
      const placed = await checkout("411001", "Pune", "Maharashtra", "UPI_QR");
      expect(placed.status).toBe(201);
      const orderId = placed.body.result.order.orderId;
      await payByQrAndApprove(orderId);
      let o = await Order.findOne({ orderId }).lean();
      expect(o.fulfillmentType).toBe("SHIPROCKET");
      expect(o.status).toBe("confirmed"); // the admin's QR approval hands the order to the seller
      expect(calls.length).toBe(0); // nothing is booked until the seller acts

      const confirmed = await setStatus(orderId, "confirmed");
      expect(confirmed.status).toBe(200);
      expect(calls.length).toBe(0); // confirming does not book a courier either

      const packed = await setStatus(orderId, "packed");
      expect(packed.status).toBe(200);
      o = await Order.findOne({ orderId }).lean();
      expect(o.status).toBe("packed");
      expect(o.shiprocket).toMatchObject({
        awb: "AWB123456", courierName: "Delhivery Surface", labelUrl: "https://label.test/7771.pdf", currentStatus: "PICKUP_SCHEDULED",
      });
      expect(o.shiprocket.automation.state).toBe("COMPLETE");
      expect(names().filter((n) => n !== "/auth/login")).toEqual([
        "/orders/create/adhoc", "/courier/assign/awb", "/courier/generate/pickup", "/courier/generate/label",
      ]);
      // what Shiprocket was told, from the real checkout numbers
      const booking = calls.find((c) => c.url === "/orders/create/adhoc").body;
      expect(booking).toMatchObject({ order_id: orderId, billing_pincode: "411001", billing_city: "Pune", payment_method: "Prepaid", sub_total: 3000 });
      expect(booking.order_items).toEqual([expect.objectContaining({ name: "Galaxy A15", units: 2, selling_price: 1500 })]);
    });

    it("local customer (Mauranipur): the same steps use the rider flow and never touch Shiprocket", async () => {
      const placed = await checkout("284204", "Mauranipur", "Uttar Pradesh");
      expect(placed.status).toBe(201);
      const orderId = placed.body.result.order.orderId;
      let o = await Order.findOne({ orderId }).lean();
      expect(o.fulfillmentType).toBe("LOCAL");

      expect((await setStatus(orderId, "confirmed")).status).toBe(200);
      const before = (await Order.findOne({ orderId }).lean()).workflowStatus;
      expect((await setStatus(orderId, "packed")).status).toBe(200);

      o = await Order.findOne({ orderId }).lean();
      expect(calls.length).toBe(0);
      expect(o.status).toBe("packed");
      expect(o.pickupReadyAt).toBeTruthy();
      expect(o.workflowStatus).toBe(before); // rider workflow state untouched by "packed"
      expect(o.shiprocket.shipmentId).toBeNull();
      expect(o.shiprocket.automation.state).toBeNull();
    });
  });

  describe("local (rider) delivery is not affected", () => {
    it("Packed on a local order makes no Shiprocket call and keeps the rider workflow where it was", async () => {
      const order = await makeOrder({ fulfillmentType: "LOCAL", workflowStatus: "DELIVERY_SEARCH" });
      const res = await pack(order);

      expect(res.status).toBe(200);
      expect(calls.length).toBe(0);
      const saved = await reload(order);
      expect(saved.status).toBe("packed");
      expect(saved.pickupReadyAt).toBeTruthy(); // "packed" is a flag the rider sees
      expect(saved.workflowStatus).toBe("DELIVERY_SEARCH"); // still searching for a rider
      expect(saved.shiprocket.shipmentId).toBeNull();
      expect(saved.shiprocket.automation.state).toBeNull();
    });

    it("a local order is never picked up by the retry job", async () => {
      await makeOrder({ fulfillmentType: "LOCAL", status: "packed" });
      expect((await retryPendingShiprocketAutomation({ minGapMs: 0 })).found).toBe(0);
    });
  });
});
