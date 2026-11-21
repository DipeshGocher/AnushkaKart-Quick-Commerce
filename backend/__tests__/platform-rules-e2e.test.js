import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
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
import Payout from "../app/models/payout.js";
import Wallet from "../app/models/wallet.js";
import LocalPincode from "../app/models/localPincode.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "platform-rules-secret";
delete process.env.LOCAL_RETURN_WINDOW_MINUTES;
delete process.env.RETURN_WINDOW_MINUTES;
delete process.env.SHIPROCKET_RETURN_WINDOW_DAYS;

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");
const { invalidatePlatformRulesCache } = await import("../app/services/platformRulesService.js");
const { invalidate } = await import("../app/services/cacheService.js");
const fin = await import("../app/services/finance/orderFinanceService.js");
const { default: OrderReturnService } = await import("../app/services/order/orderReturnService.js");
const { default: releaseExpiredSellerHolds } = await import("../app/jobs/returnWindowReleaseJob.js");
const { generateOrderPaymentBreakdown } = await import("../app/services/finance/pricingService.js");

jest.setTimeout(120000);

/**
 * REAL MongoDB test of the admin "Payment Modes" / "Return Modes" rules.
 * Runs only with RUN_E2E_TESTS=true and MONGO_URI_E2E = a throw-away replica set.
 */
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);
const MIN = 60 * 1000;

(RUN ? describe : describe.skip)("Payment modes and return windows - real DB", () => {
  let app;
  let ctx;

  const token = (id, role) => jwt.sign({ id: String(id), role }, process.env.JWT_SECRET, { expiresIn: "2h" });

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
    return { customer, seller, header, product, ct: token(customer._id, "user"), at: token(new mongoose.Types.ObjectId(), "admin") };
  }

  const localAddress = { type: "Home", name: "C", address: "RNT Marg, Indore", city: "Indore", pincode: "452001", phone: "9999999999", location: { lat: 22.72, lng: 75.88 } };
  const courierAddress = { type: "Home", name: "C", address: "MG Road, Bengaluru", city: "Bengaluru", pincode: "560001", phone: "9999999999", location: { lat: 12.97, lng: 77.59 } };

  const place = (mode, address = localAddress, extra = {}) =>
    request(app).post("/api/orders").set("Authorization", `Bearer ${ctx.ct}`)
      .send({ items: [{ product: String(ctx.product._id), quantity: 1, price: 100 }], address, paymentMode: mode, timeSlot: "now", ...extra });
  const preview = (address) =>
    request(app).post("/api/orders/checkout/preview").set("Authorization", `Bearer ${ctx.ct}`)
      .send({ items: [{ product: String(ctx.product._id), quantity: 1, price: 100 }], address, paymentMode: "COD" });
  const savePayment = (body, t = ctx.at) => request(app).put("/api/settings/payment-modes").set("Authorization", `Bearer ${t}`).send(body);
  const saveReturn = (body, t = ctx.at) => request(app).put("/api/settings/return-windows").set("Authorization", `Bearer ${t}`).send(body);
  const publicSettings = () => request(app).get("/api/settings");
  const stock = async () => (await Product.findById(ctx.product._id).lean()).stock;

  const allOn = { local: { cod: true, online: true, upiQr: true }, shiprocket: { cod: true, online: true, upiQr: true } };

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: "5mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `platform_rules_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });
  beforeEach(async () => {
    // Importing the app re-reads .env, which may carry old return-window variables: this test is
    // about the built-in defaults, so clear them again for every test.
    delete process.env.LOCAL_RETURN_WINDOW_MINUTES;
    delete process.env.RETURN_WINDOW_MINUTES;
    delete process.env.SHIPROCKET_RETURN_WINDOW_DAYS;
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    await invalidate("cache:platform:settings:*");
    ctx = await seed();
  });
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  describe("nothing saved yet (what happens right after deploy)", () => {
    it("local delivery keeps COD, online and UPI QR", async () => {
      for (const mode of ["COD", "ONLINE", "UPI_QR"]) {
        const res = await place(mode);
        expect(res.status).toBe(201);
        expect(res.body.result.order.fulfillmentType).toBe("LOCAL");
      }
    });

    it("courier (Shiprocket) delivery: COD, online and UPI QR all work by default", async () => {
      const cod = await place("COD", courierAddress);
      expect(cod.status).toBe(201);
      expect(cod.body.result.order.fulfillmentType).toBe("SHIPROCKET");
      expect(cod.body.result.order.paymentMode).toBe("COD");

      const online = await place("ONLINE", courierAddress);
      expect(online.status).toBe(201);
      expect(online.body.result.order.fulfillmentType).toBe("SHIPROCKET");
      const qr = await place("UPI_QR", courierAddress);
      expect(qr.status).toBe(201);
      expect(qr.body.result.order.fulfillmentType).toBe("SHIPROCKET");
    });

    it("the checkout preview tells the payment screen which modes to show", async () => {
      const local = await preview(localAddress);
      expect(local.status).toBe(200);
      expect(local.body.result.allowedPaymentModes).toEqual({ COD: true, ONLINE: true, UPI_QR: true });
      const courier = await preview(courierAddress);
      expect(courier.body.result.allowedPaymentModes).toEqual({ COD: true, ONLINE: true, UPI_QR: true });
    });

    it("public settings expose the effective modes and 4 hours / 7 days windows", async () => {
      const res = await publicSettings();
      expect(res.body.result.paymentModes).toEqual({
        local: { cod: true, online: true, upiQr: true },
        shiprocket: { cod: true, online: true, upiQr: true },
      });
      expect(res.body.result.returnWindows.local).toMatchObject({ value: 4, unit: "hours", minutes: 240 });
      expect(res.body.result.returnWindows.shiprocket).toMatchObject({ value: 7, unit: "days", minutes: 10080 });
    });
  });

  describe("admin saves payment modes", () => {
    it("only an admin can save", async () => {
      expect((await savePayment(allOn, ctx.ct)).status).toBe(403);
      expect((await request(app).put("/api/settings/payment-modes").send(allOn)).status).toBe(401);
    });

    it("saving, then reading the public settings, shows the new modes (cache refreshed)", async () => {
      expect((await publicSettings()).body.result.paymentModes.local.cod).toBe(true);
      const res = await savePayment({ local: { cod: false, online: true, upiQr: true }, shiprocket: { cod: false, online: true, upiQr: false } });
      expect(res.status).toBe(200);
      const pm = (await publicSettings()).body.result.paymentModes;
      expect(pm.local).toEqual({ cod: false, online: true, upiQr: true });
      expect(pm.shiprocket).toEqual({ cod: false, online: true, upiQr: false });
    });

    it("every mode off is refused and nothing is saved", async () => {
      const bad = await savePayment({ local: { cod: false, online: false, upiQr: false }, shiprocket: { cod: true, online: true, upiQr: true } });
      expect(bad.status).toBe(400);
      expect(bad.body.message).toMatch(/Local delivery: keep at least one/);
      const bad2 = await savePayment({ local: { cod: true, online: true, upiQr: true }, shiprocket: { cod: false, online: false, upiQr: false } });
      expect(bad2.status).toBe(400);
      expect(bad2.body.message).toMatch(/Shiprocket: keep at least one/);
      expect((await publicSettings()).body.result.paymentModes.local.cod).toBe(true);
    });

    it("courier COD can be switched off and on by the admin; local COD is unaffected", async () => {
      const off = await savePayment({ local: { cod: true, online: true, upiQr: true }, shiprocket: { cod: false, online: true, upiQr: true } });
      expect(off.status).toBe(200);
      expect(off.body.result.paymentModes.shiprocket.cod).toBe(false);
      const stored = await Setting.findOne({}).lean();
      expect(stored.paymentModes.shiprocket.cod).toBe(false);
      const before = await stock();
      const refused = await place("COD", courierAddress);
      expect(refused.status).toBe(400);
      expect(refused.body.message).toMatch(/Cash on Delivery is not available for courier-delivered items/);
      expect(await stock()).toBe(before); // refused before anything was reserved
      expect((await place("COD", localAddress)).status).toBe(201);
      expect((await place("ONLINE", courierAddress)).status).toBe(201);
      await savePayment(allOn);
      expect((await place("COD", courierAddress)).status).toBe(201);
    });

    it("COD switched off for local: COD orders are refused (nothing reserved), the other modes still work", async () => {
      await savePayment({ local: { cod: false, online: true, upiQr: true }, shiprocket: { cod: true, online: true, upiQr: true } });
      const before = await stock();
      const cod = await place("COD");
      expect(cod.status).toBe(400);
      expect(cod.body.message).toMatch(/Cash on Delivery is not available for this order\. Please choose: Online payment or UPI QR payment/);
      expect(await stock()).toBe(before);
      expect((await place("ONLINE")).status).toBe(201);
      expect((await place("UPI_QR")).status).toBe(201);
      const pv = await preview(localAddress);
      expect(pv.body.result.allowedPaymentModes).toEqual({ COD: false, ONLINE: true, UPI_QR: true });
    });

    it("UPI QR switched off for local: QR is refused and online/COD still work; switching it back on works at once", async () => {
      await savePayment({ local: { cod: true, online: true, upiQr: false }, shiprocket: { cod: true, online: true, upiQr: true } });
      expect((await place("UPI_QR")).status).toBe(400);
      expect((await place("COD")).status).toBe(201);
      await savePayment(allOn);
      expect((await place("UPI_QR")).status).toBe(201);
    });

    it("local can be COD only, and then online is refused", async () => {
      await savePayment({ local: { cod: true, online: false, upiQr: false }, shiprocket: { cod: true, online: true, upiQr: true } });
      expect((await place("COD")).status).toBe(201);
      expect((await place("ONLINE")).status).toBe(400);
      expect((await place("UPI_QR")).status).toBe(400);
    });

    it("Shiprocket QR off: courier orders can be paid by COD or online only", async () => {
      await savePayment({ local: { cod: true, online: true, upiQr: true }, shiprocket: { cod: true, online: true, upiQr: false } });
      expect((await place("UPI_QR", courierAddress)).status).toBe(400);
      expect((await place("ONLINE", courierAddress)).status).toBe(201);
      // local is unaffected
      expect((await place("UPI_QR", localAddress)).status).toBe(201);
    });

    it("the old COD switch (before the new page is ever saved) still works as a fallback", async () => {
      await Setting.updateOne({}, { $set: { codEnabled: false } });
      invalidatePlatformRulesCache();
      expect((await place("COD")).status).toBe(400);
      expect((await place("ONLINE")).status).toBe(201);
    });

    it("saving delivery charges (Fees & Charges page) does not undo the payment modes", async () => {
      await savePayment({ local: { cod: false, online: true, upiQr: true }, shiprocket: { cod: true, online: true, upiQr: true } });
      const res = await request(app).put("/api/admin/settings/delivery").set("Authorization", `Bearer ${ctx.at}`)
        .send({ customerPricingType: "fixed", customerFixedCharge: 40 });
      expect([200, 201]).toContain(res.status);
      invalidatePlatformRulesCache();
      expect((await place("COD")).status).toBe(400);
    });
  });

  describe("admin saves return windows", () => {
    it("only an admin can save; bad values are refused", async () => {
      const good = { local: { value: 4, unit: "hours" }, shiprocket: { value: 7, unit: "days" } };
      expect((await saveReturn(good, ctx.ct)).status).toBe(403);
      for (const bad of [
        { ...good, local: { value: 0, unit: "hours" } },
        { ...good, local: { value: 1.5, unit: "hours" } },
        { ...good, local: { value: "abc", unit: "hours" } },
        { ...good, shiprocket: { value: 7, unit: "weeks" } },
        { ...good, shiprocket: { value: 91, unit: "days" } },
        { local: good.local },
      ]) {
        expect((await saveReturn(bad)).status).toBe(400);
      }
      const ok = await saveReturn(good);
      expect(ok.status).toBe(200);
      expect(ok.body.result.returnWindows.local).toMatchObject({ value: 4, unit: "hours", minutes: 240, source: "admin" });
    });

    async function deliver(fulfillmentType, deliveredAt) {
      const o = await Order.create({
        orderId: `ORD-RW-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        customer: ctx.customer._id, seller: ctx.seller._id,
        items: [{ product: ctx.product._id, name: "Speaker", quantity: 1, price: 100 }],
        address: { name: "C", address: "x", city: "Indore", state: "MP", pincode: "452001", phone: "9876543210" },
        paymentMode: "COD", status: "out_for_delivery", orderStatus: "out_for_delivery", workflowVersion: 2, workflowStatus: "OUT_FOR_DELIVERY",
        fulfillmentType,
        paymentBreakdown: { productSubtotal: 100, grandTotal: 150, sellerPayoutTotal: 90, adminProductCommissionTotal: 10, platformTotalEarning: 10, lineItems: [] },
        deliveredAt,
      });
      await fin.settleDeliveredOrder(o._id);
      return Order.findById(o._id).lean();
    }
    const windowMinutesOf = (o) => Math.round((new Date(o.returnWindowExpiresAt) - new Date(o.deliveredAt)) / MIN);

    it("an order delivered gets the saved window for its delivery type", async () => {
      await saveReturn({ local: { value: 2, unit: "hours" }, shiprocket: { value: 3, unit: "days" } });
      const local = await deliver("LOCAL", new Date());
      const courier = await deliver("SHIPROCKET", new Date());
      expect(windowMinutesOf(local)).toBe(120);
      expect(windowMinutesOf(courier)).toBe(3 * 1440);
    });

    it("changing the window later does NOT change an order that was already delivered", async () => {
      await saveReturn({ local: { value: 2, unit: "hours" }, shiprocket: { value: 3, unit: "days" } });
      const earlier = await deliver("LOCAL", new Date());
      await saveReturn({ local: { value: 1, unit: "days" }, shiprocket: { value: 10, unit: "days" } });
      const stillSame = await Order.findById(earlier._id).lean();
      expect(windowMinutesOf(stillSame)).toBe(120);
      const later = await deliver("LOCAL", new Date());
      expect(windowMinutesOf(later)).toBe(1440);
      const laterCourier = await deliver("SHIPROCKET", new Date());
      expect(windowMinutesOf(laterCourier)).toBe(10 * 1440);
    });

    it("nothing saved: delivered orders still get 4 hours / 7 days", async () => {
      expect(windowMinutesOf(await deliver("LOCAL", new Date()))).toBe(240);
      expect(windowMinutesOf(await deliver("SHIPROCKET", new Date()))).toBe(7 * 1440);
    });

    it("a return is accepted inside the window and refused after it, naming the window", async () => {
      await saveReturn({ local: { value: 2, unit: "hours" }, shiprocket: { value: 3, unit: "days" } });
      const fresh = await deliver("LOCAL", new Date(Date.now() - 60 * MIN)); // delivered 1 hour ago
      const okReturn = await OrderReturnService.createReturnRequest(ctx.customer._id, fresh.orderId, {
        items: [{ itemIndex: 0, quantity: 1 }], reason: "Changed my mind",
      });
      expect(okReturn.returnStatus).toBe("return_requested");

      const old = await deliver("LOCAL", new Date(Date.now() - 3 * 60 * MIN)); // delivered 3 hours ago, window 2 hours
      await expect(
        OrderReturnService.createReturnRequest(ctx.customer._id, old.orderId, { items: [{ itemIndex: 0, quantity: 1 }], reason: "Changed my mind" }),
      ).rejects.toThrow(/Return window has expired\. You can only request a return within 2 hours of delivery/);

      const courierOld = await deliver("SHIPROCKET", new Date(Date.now() - 2 * 1440 * MIN)); // 2 days ago, window 3 days
      const okCourier = await OrderReturnService.createReturnRequest(ctx.customer._id, courierOld.orderId, {
        items: [{ itemIndex: 0, quantity: 1 }], reason: "Changed my mind",
      });
      expect(okCourier.returnStatus).toBe("return_requested");
    });
  });

  describe("a rejected return no longer freezes the seller's payout", () => {
    const settings = {
      customerPricingType: "distance", customerBaseDistance: 2, customerBaseCharge: 30, customerExtraPerKm: 10,
      riderEarningType: "distance", riderBaseDistance: 2, riderBaseEarning: 20, riderExtraPerKm: 6,
    };

    async function heldOrder() {
      const productId = new mongoose.Types.ObjectId();
      const breakdown = await generateOrderPaymentBreakdown({
        preHydratedItems: [{ productId: String(productId), productName: "Phone", quantity: 1, price: 1000, headerCategoryId: String(ctx.header._id), sellerId: String(ctx.seller._id) }],
        distanceKm: 3, deliverySettings: settings, handlingFeeStrategy: "highest_category_fee",
      });
      const o = await Order.create({
        orderId: `ORD-HOLD-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        customer: ctx.customer._id, seller: ctx.seller._id,
        items: [{ product: productId, name: "Phone", quantity: 1, price: 1000 }],
        address: { name: "C", address: "x", city: "Indore", state: "MP", pincode: "452001", phone: "9876543210" },
        paymentMode: "ONLINE", paymentStatus: "CREATED", status: "out_for_delivery", orderStatus: "out_for_delivery",
        workflowVersion: 2, workflowStatus: "OUT_FOR_DELIVERY", fulfillmentType: "LOCAL",
      });
      fin.freezeFinancialSnapshot(o, breakdown);
      await o.save();
      await fin.handleOnlineOrderFinance(o._id, { transactionId: "pay_x" });
      await fin.settleDeliveredOrder(o._id); // payout is created and put on HOLD (return window is open)
      return Order.findById(o._id).lean();
    }

    it("control: no return, window still open -> payout stays on hold", async () => {
      const o = await heldOrder();
      expect(o.settlementStatus.sellerPayout).toBe("HOLD");
      await releaseExpiredSellerHolds();
      expect((await Order.findById(o._id).lean()).settlementStatus.sellerPayout).toBe("HOLD");
    });

    it("return rejected -> the payout is released on the next job run, without waiting for the window", async () => {
      const o = await heldOrder();
      await Order.updateOne({ _id: o._id }, { $set: { returnStatus: "return_rejected" } });
      await releaseExpiredSellerHolds();
      const after = await Order.findById(o._id).lean();
      expect(after.settlementStatus.sellerPayout).toBe("COMPLETED");
      const payout = await Payout.findOne({ relatedOrderIds: o._id, payoutType: "SELLER" }).lean();
      expect(payout.status).toBe("COMPLETED");
      const w = await Wallet.findOne({ ownerType: "SELLER", ownerId: ctx.seller._id }).lean();
      expect(w.availableBalance).toBe(payout.amount);
    });

    it("return requested but not decided yet -> payout stays on hold", async () => {
      const o = await heldOrder();
      await Order.updateOne({ _id: o._id }, { $set: { returnStatus: "return_requested" } });
      await releaseExpiredSellerHolds();
      expect((await Order.findById(o._id).lean()).settlementStatus.sellerPayout).toBe("HOLD");
    });

    it("return accepted (QC passed, refunded) -> payout is cancelled, not released", async () => {
      const o = await heldOrder();
      await Order.updateOne({ _id: o._id }, {
        $set: {
          returnStatus: "qc_passed", returnFault: "customer", returnDeliveryCommission: 25, returnRefundAmount: 1000,
          returnItems: [{ product: o.items[0].product, name: "Phone", quantity: 1, price: 1000, itemIndex: 0, status: "approved" }],
        },
      });
      await OrderReturnService.completeReturnAndRefund(await Order.findById(o._id));
      await releaseExpiredSellerHolds();
      const payout = await Payout.findOne({ relatedOrderIds: o._id, payoutType: "SELLER" }).lean();
      expect(payout.status).toBe("CANCELLED");
    });
  });
});
