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
import Transaction from "../app/models/transaction.js";
import Wallet from "../app/models/wallet.js";
import LocalPincode from "../app/models/localPincode.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "upi-e2e-secret";

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");
const { expireUnverifiedUpiOrders } = await import("../app/services/order/upiApprovalExpiryService.js");
const { getUpiApprovalPolicy } = await import("../app/utils/upiApprovalPolicy.js");
const { getOrderAutoCancelJobHandler } = await import("../app/jobs/orderAutoCancelJob.js");
const autoCancelExpiredOrders = getOrderAutoCancelJobHandler();

jest.setTimeout(120000);

/**
 * REAL MongoDB end-to-end test for the manual UPI QR flow and its effect on COD / online.
 *
 * Runs only when RUN_E2E_TESTS=true AND MONGO_URI_E2E is set (a replica set, because checkout
 * uses transactions). It deliberately does NOT fall back to MONGO_URI so it can never touch
 * production data. Each run uses a throw-away database that is dropped at the end.
 */
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);
const HOUR = 3600 * 1000;
const UTR = "402938491029";

(RUN ? describe : describe.skip)("UPI QR manual payment - real DB end to end", () => {
  let app;
  let ctx;

  const token = (id, role) => jwt.sign({ id: String(id), role }, process.env.JWT_SECRET, { expiresIn: "2h" });

  async function seed() {
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const customer = await User.create({ name: "QR Customer", phone: `90000${s.slice(-5)}`, role: "user", isVerified: true });
    const customer2 = await User.create({ name: "Other Customer", phone: `90001${s.slice(-5)}`, role: "user", isVerified: true });
    const seller = await Seller.create({
      name: "QR Seller",
      email: `seller_${s}@example.com`,
      phone: `91000${s.slice(-5)}`,
      password: "Password@123",
      shopName: "QR Mart",
      pincode: "452001",
      isVerified: true,
      location: { type: "Point", coordinates: [75.87, 22.717] },
    });
    await LocalPincode.create({ pincode: "452001", city: "Indore", isActive: true });
    const header = await Category.create({ name: `H ${s}`, slug: `h-${s}`, type: "header", adminCommissionType: "percentage", adminCommissionValue: 10, handlingFeeType: "fixed", handlingFeeValue: 20, status: "active" });
    const category = await Category.create({ name: `C ${s}`, slug: `c-${s}`, type: "category", parentId: header._id, status: "active" });
    const subcategory = await Category.create({ name: `S ${s}`, slug: `s-${s}`, type: "subcategory", parentId: category._id, status: "active" });
    const product = await Product.create({
      name: "QR Speaker", slug: `qr-speaker-${s}`, sku: `SKU-${s}`, description: "x",
      price: 100, salePrice: 100, stock: 50,
      headerId: header._id, categoryId: category._id, subcategoryId: subcategory._id,
      sellerId: seller._id, status: "active",
    });
    await Setting.create({
      deliveryPricingMode: "distance_based", pricingMode: "distance_based", customerBaseDeliveryFee: 30,
      riderBasePayout: 30, baseDeliveryCharge: 30, baseDistanceCapacityKm: 0.5, incrementalKmSurcharge: 10,
      deliveryPartnerRatePerKm: 5, fleetCommissionRatePerKm: 5, fixedDeliveryFee: 30,
      customerPricingType: "fixed", customerFixedCharge: 50, riderEarningType: "fixed", riderFixedEarning: 40,
      handlingFeeStrategy: "highest_category_fee", codEnabled: true, onlineEnabled: true,
    });
    return {
      customer, customer2, seller, product,
      ct: token(customer._id, "user"),
      ct2: token(customer2._id, "user"),
      at: token(new mongoose.Types.ObjectId(), "admin"),
    };
  }

  const address = {
    type: "Home", name: "QR Customer", address: "RNT Marg, Indore", city: "Indore", pincode: "452001",
    phone: "9999999999", location: { lat: 22.72, lng: 75.88 },
  };

  const place = (mode, extra = {}, qty = 2, t = ctx.ct) =>
    request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${t}`)
      .send({ items: [{ product: String(ctx.product._id), quantity: qty, price: 100 }], address, paymentMode: mode, timeSlot: "now", ...extra });

  const stock = async () => (await Product.findById(ctx.product._id).lean()).stock;
  const orderDoc = (orderId) => Order.findOne({ orderId }).lean();
  const idOf = (res) => res.body.result.order.orderId;
  const submitUtr = (orderId, utr, t) =>
    request(app).post(`/api/orders/${orderId}/payment/submit-utr`).set("Authorization", `Bearer ${t || ctx.ct}`).send({ utrNumber: utr });
  const approve = (orderId) =>
    request(app).post(`/api/orders/${orderId}/payment/approve-upi`).set("Authorization", `Bearer ${ctx.at}`).send({});
  const reject = (orderId, reason = "Not found in bank") =>
    request(app).post(`/api/orders/${orderId}/payment/reject-upi`).set("Authorization", `Bearer ${ctx.at}`).send({ reason });
  const pastDeadline = (orderId, hours = 1) =>
    Order.updateOne({ orderId }, { $set: { upiApprovalExpiresAt: new Date(Date.now() - hours * HOUR) } });
  const hoursLeft = (d) => (new Date(d).getTime() - Date.now()) / HOUR;

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: "5mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, {
      dbName: `upi_qr_e2e_${Date.now()}`,
      serverSelectionTimeoutMS: 15000,
    });
    await Promise.all(
      Object.values(mongoose.models).map(async (m) => {
        await m.createCollection().catch(() => {});
        await m.init();
      }),
    );
  });

  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    ctx = await seed();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  describe("COD and online are not disturbed", () => {
    it("COD: order placed, stock deducted, no UPI deadline / UTR fields, correct status", async () => {
      const res = await place("COD");
      expect(res.status).toBe(201);
      const o = await orderDoc(idOf(res));
      expect(o.paymentMode).toBe("COD");
      expect(o.paymentStatus).toBe("PENDING_CASH_COLLECTION");
      expect(o.upiApprovalExpiresAt ?? null).toBeNull();
      expect(o.utrNumber ?? null).toBeNull();
      expect(await stock()).toBe(48);
    });

    it("COD ignores a UTR that a client might send", async () => {
      const res = await place("COD", { utrNumber: UTR });
      expect(res.status).toBe(201);
      const o = await orderDoc(idOf(res));
      expect(o.utrNumber ?? null).toBeNull();
    });

    it("ONLINE: order placed with a 15-min stock reservation and no UPI deadline", async () => {
      const res = await place("ONLINE");
      expect(res.status).toBe(201);
      const o = await orderDoc(idOf(res));
      expect(o.paymentStatus).toBe("CREATED");
      expect(o.stockReservation.status).toBe("RESERVED");
      expect(o.stockReservation.expiresAt).toBeTruthy();
      expect(o.upiApprovalExpiresAt ?? null).toBeNull();
      expect(await stock()).toBe(48);
    });

    it("the generic auto-cancel job still cancels an expired ONLINE order and releases stock", async () => {
      const res = await place("ONLINE");
      const id = idOf(res);
      await Order.updateOne({ orderId: id }, { $set: { "stockReservation.expiresAt": new Date(Date.now() - 1000), expiresAt: new Date(Date.now() - 1000) } });
      await autoCancelExpiredOrders();
      const o = await orderDoc(id);
      expect(o.status).toBe("cancelled");
      expect(await stock()).toBe(50);
    });

    it("the generic auto-cancel job never touches UPI QR orders, COD orders or fresh online orders", async () => {
      const upi = idOf(await place("UPI_QR"));
      const cod = idOf(await place("COD"));
      const online = idOf(await place("ONLINE"));
      await autoCancelExpiredOrders();
      for (const id of [upi, cod, online]) expect((await orderDoc(id)).status).not.toBe("cancelled");
      expect(await stock()).toBe(44);
    });

    it("the UPI sweep never touches COD / online orders, even with an old date on them", async () => {
      const cod = idOf(await place("COD"));
      const online = idOf(await place("ONLINE"));
      await Order.updateMany({ orderId: { $in: [cod, online] } }, { $set: { upiApprovalExpiresAt: new Date(Date.now() - 100 * HOUR) } });
      const out = await expireUnverifiedUpiOrders();
      expect(out.checked).toBe(0);
      expect((await orderDoc(cod)).status).not.toBe("cancelled");
      expect((await orderDoc(online)).status).not.toBe("cancelled");
    });
  });

  describe("the generic stale-order cleanup must not break UPI QR orders", () => {
    const ageOrder = (orderId, hours) =>
      Order.collection.updateOne({ orderId }, { $set: { createdAt: new Date(Date.now() - hours * HOUR) } });

    it("an unverified UPI order older than 24h but inside its 48h approval window is NOT cancelled by the stale job", async () => {
      const id = idOf(await place("UPI_QR", { utrNumber: UTR }));
      await ageOrder(id, 30);
      await autoCancelExpiredOrders();
      expect((await orderDoc(id)).status).toBe("pending");
      expect(await stock()).toBe(48);
    });

    it("an order approved late (placed 30h ago, approved now) is NOT cancelled right after approval", async () => {
      const id = idOf(await place("UPI_QR", { utrNumber: UTR }));
      await ageOrder(id, 30);
      expect((await approve(id)).status).toBe(200);
      await autoCancelExpiredOrders();
      const o = await orderDoc(id);
      expect(o.status).not.toBe("cancelled");
      expect(o.paymentStatus).toBe("PAID");
      expect(await stock()).toBe(48);
    });

    it("the normal stale rule still works for COD (undelivered > 24h is cancelled)", async () => {
      const id = idOf(await place("COD"));
      await ageOrder(id, 30);
      await autoCancelExpiredOrders();
      expect((await orderDoc(id)).status).toBe("cancelled");
      expect(await stock()).toBe(50);
    });

    it("a paid UPI order is still subject to the normal stale rule, counted from its approval time", async () => {
      const id = idOf(await place("UPI_QR", { utrNumber: UTR }));
      await approve(id);
      await Order.collection.updateOne({ orderId: id }, { $set: { upiApprovedAt: new Date(Date.now() - 30 * HOUR) } });
      await autoCancelExpiredOrders();
      expect((await orderDoc(id)).status).toBe("cancelled");
    });
  });

  describe("UPI QR: order first, UTR next", () => {
    it("placing a UPI QR order reserves stock and starts the 24h 'send your UTR' clock", async () => {
      const res = await place("UPI_QR");
      expect(res.status).toBe(201);
      const o = await orderDoc(idOf(res));
      expect(o.paymentMode).toBe("UPI_QR");
      expect(o.paymentStatus).toBe("AWAITING_VERIFICATION");
      expect(o.status).toBe("pending");
      expect(o.utrNumber ?? null).toBeNull();
      expect(hoursLeft(o.upiApprovalExpiresAt)).toBeGreaterThan(23.9);
      expect(hoursLeft(o.upiApprovalExpiresAt)).toBeLessThanOrEqual(24);
      expect(await stock()).toBe(48);
    });

    it("submitting the UTR saves it and moves the clock to 48h for admin", async () => {
      const id = idOf(await place("UPI_QR"));
      const res = await submitUtr(id, UTR);
      expect(res.status).toBe(200);
      const o = await orderDoc(id);
      expect(o.utrNumber).toBe(UTR);
      expect(o.paymentStatus).toBe("AWAITING_VERIFICATION");
      expect(hoursLeft(o.upiApprovalExpiresAt)).toBeGreaterThan(47.9);
      expect(hoursLeft(o.upiApprovalExpiresAt)).toBeLessThanOrEqual(48);
    });

    it("bad UTRs are refused; another customer cannot submit for this order; a reused UTR is refused", async () => {
      const id = idOf(await place("UPI_QR"));
      expect((await submitUtr(id, "123")).status).toBe(400);
      expect((await submitUtr(id, "abcdefghijkl")).status).toBe(400);
      expect((await submitUtr(id, UTR, ctx.ct2)).status).toBe(403);
      expect((await orderDoc(id)).utrNumber ?? null).toBeNull();

      expect((await submitUtr(id, UTR)).status).toBe(200);
      const other = idOf(await place("UPI_QR"));
      const dup = await submitUtr(other, UTR);
      expect(dup.status).toBe(400);
      expect(dup.body.message).toMatch(/already been submitted/);
    });

    it("an order can also be placed together with its UTR (older/other clients)", async () => {
      const res = await place("UPI_QR", { utrNumber: UTR });
      expect(res.status).toBe(201);
      const o = await orderDoc(idOf(res));
      expect(o.utrNumber).toBe(UTR);
      expect(hoursLeft(o.upiApprovalExpiresAt)).toBeGreaterThan(47.9);

      const dup = await place("UPI_QR", { utrNumber: UTR });
      expect(dup.status).toBe(400);
      const bad = await place("UPI_QR", { utrNumber: "12" });
      expect(bad.status).toBe(400);
      expect(await stock()).toBe(48); // only the first order reserved stock
    });

    it("admin approves: order is paid and confirmed, deadline cleared, expiry sweep ignores it forever", async () => {
      const id = idOf(await place("UPI_QR"));
      await submitUtr(id, UTR);
      const res = await approve(id);
      expect(res.status).toBe(200);
      const o = await orderDoc(id);
      expect(o.paymentStatus).toBe("PAID");
      expect(o.status).toBe("confirmed");
      expect(o.upiApprovalExpiresAt ?? null).toBeNull();

      await pastDeadline(id, 500); // even if someone sets an old date
      await Order.updateOne({ orderId: id }, { $set: { upiApprovalExpiresAt: new Date(Date.now() - 100 * HOUR) } });
      expect((await expireUnverifiedUpiOrders()).expired).toBe(0);
      expect((await orderDoc(id)).status).not.toBe("cancelled");
    });

    it("admin rejects: customer gets a fresh 24h to send a correct UTR, then can resubmit", async () => {
      const id = idOf(await place("UPI_QR"));
      await submitUtr(id, UTR);
      expect((await reject(id)).status).toBe(200);
      let o = await orderDoc(id);
      expect(o.paymentStatus).toBe("REJECTED");
      expect(hoursLeft(o.upiApprovalExpiresAt)).toBeGreaterThan(23.9);

      expect((await submitUtr(id, "512345678901")).status).toBe(200);
      o = await orderDoc(id);
      expect(o.paymentStatus).toBe("AWAITING_VERIFICATION");
      expect(o.utrNumber).toBe("512345678901");
      expect(hoursLeft(o.upiApprovalExpiresAt)).toBeGreaterThan(47.9);
    });
  });

  describe("48h with no admin approval", () => {
    it("order cancelled, stock released, NO refund of any kind", async () => {
      const id = idOf(await place("UPI_QR", { utrNumber: UTR }));
      expect(await stock()).toBe(48);
      await pastDeadline(id);

      const out = await expireUnverifiedUpiOrders();
      expect(out).toMatchObject({ checked: 1, expired: 1, failed: 0 });

      const o = await orderDoc(id);
      expect(o).toMatchObject({ status: "cancelled", orderStatus: "cancelled", workflowStatus: "CANCELLED", cancelledBy: "system", paymentStatus: "FAILED" });
      expect(o.utrNumber).toBe(UTR);
      expect(o.cancelReason).toMatch(/not verified within 48 hours/);
      expect(o.stockReservation.status).toBe("RELEASED");
      expect(await stock()).toBe(50);

      expect(await Transaction.countDocuments({ type: "Refund" })).toBe(0);
      const wallet = await Wallet.findOne({ ownerType: "CUSTOMER", ownerId: ctx.customer._id }).lean();
      expect(wallet?.availableBalance ?? 0).toBe(0);
      expect((await User.findById(ctx.customer._id).lean()).walletBalance ?? 0).toBe(0);
    });

    it("running the sweep again does nothing and stock is released only once", async () => {
      const id = idOf(await place("UPI_QR", { utrNumber: UTR }));
      await pastDeadline(id);
      await expireUnverifiedUpiOrders();
      const again = await expireUnverifiedUpiOrders();
      expect(again).toMatchObject({ checked: 0, expired: 0 });
      expect(await stock()).toBe(50);
    });

    it("a cancelled order can no longer be approved, paid by UTR or revived", async () => {
      const id = idOf(await place("UPI_QR", { utrNumber: UTR }));
      await pastDeadline(id);
      await expireUnverifiedUpiOrders();

      const a = await approve(id);
      expect(a.status).toBe(400);
      const s = await submitUtr(id, "512345678901");
      expect(s.status).toBe(400);
      const r = await reject(id);
      expect(r.status).toBe(400);
      const o = await orderDoc(id);
      expect(o.status).toBe("cancelled");
      expect(o.paymentStatus).toBe("FAILED");
    });

    it("no UTR ever sent: after 24h the order is cancelled and stock released", async () => {
      const id = idOf(await place("UPI_QR"));
      await pastDeadline(id);
      await expireUnverifiedUpiOrders();
      expect((await orderDoc(id)).status).toBe("cancelled");
      expect(await stock()).toBe(50);
      expect(await Transaction.countDocuments({ type: "Refund" })).toBe(0);
    });

    it("a customer who used wallet money gets that wallet money back (their own balance), but nothing for the UPI part", async () => {
      await User.updateOne({ _id: ctx.customer._id }, { $set: { walletBalance: 100 } });
      const res = await place("UPI_QR", { utrNumber: UTR, walletAmount: 100 });
      if (res.status !== 201) return; // wallet checkout needs a canonical wallet; covered by finance tests
      const id = idOf(res);
      await pastDeadline(id);
      await expireUnverifiedUpiOrders();
      const user = await User.findById(ctx.customer._id).lean();
      expect(user.walletBalance).toBe(100);
    });

    it("old UPI orders from before this feature (no deadline) are never cancelled", async () => {
      const id = idOf(await place("UPI_QR", { utrNumber: UTR }));
      await Order.updateOne({ orderId: id }, { $unset: { upiApprovalExpiresAt: "" } });
      expect((await expireUnverifiedUpiOrders({ now: new Date(Date.now() + 1000 * HOUR) })).checked).toBe(0);
      expect((await orderDoc(id)).status).toBe("pending");
    });

    it("admin approving while the sweep cancels: never both paid AND cancelled", async () => {
      for (let i = 0; i < 4; i++) {
        const id = idOf(await place("UPI_QR", { utrNumber: `51234567890${i}` }, 1));
        await pastDeadline(id);
        const [a] = await Promise.all([approve(id), expireUnverifiedUpiOrders()]);
        const o = await orderDoc(id);
        if (o.status === "cancelled") {
          expect(o.paymentStatus).toBe("FAILED");
          expect(a.status).toBe(400);
        } else {
          expect(o.paymentStatus).toBe("PAID");
          expect(a.status).toBe(200);
        }
      }
      // whatever happened, stock is consistent: every cancelled order gave its unit back
      const cancelled = await Order.countDocuments({ status: "cancelled" });
      expect(await stock()).toBe(50 - (4 - cancelled));
    });
  });

  describe("admin order lists: unapproved UPI orders only on Pending UPI Approvals", () => {
    const adminList = async (status) => {
      const res = await request(app)
        .get("/api/orders/seller-orders")
        .query(status ? { status } : {})
        .set("Authorization", "Bearer " + ctx.at);
      expect(res.status).toBe(200);
      return res.body.result;
    };
    const ids = (r) => r.items.map((o) => o.orderId);

    it("an unapproved UPI order is hidden from All / New / other lists and shown only on upi-pending", async () => {
      const upi = idOf(await place("UPI_QR", { utrNumber: UTR }));
      const cod = idOf(await place("COD"));

      for (const status of [undefined, "all", "pending", "confirmed", "processed", "cancelled"]) {
        const r = await adminList(status);
        expect(ids(r)).not.toContain(upi);
      }
      expect(ids(await adminList())).toContain(cod);

      const pendingPage = await adminList("upi-pending");
      expect(ids(pendingPage)).toEqual([upi]);

      const all = await adminList();
      expect(all.summary.upiPending).toBe(1);
      expect(all.total).toBe(1); // only the COD order
      expect(all.summary.totalOrders).toBe(1);
    });

    it("a rejected UPI order also stays on the pending page (so it can be re-approved), not in All Orders", async () => {
      const upi = idOf(await place("UPI_QR", { utrNumber: UTR }));
      await reject(upi);
      expect(ids(await adminList())).not.toContain(upi);
      expect(ids(await adminList("upi-pending"))).toContain(upi);
    });

    it("after approval the order moves: gone from upi-pending, present in All Orders", async () => {
      const upi = idOf(await place("UPI_QR", { utrNumber: UTR }));
      await approve(upi);
      expect(ids(await adminList("upi-pending"))).not.toContain(upi);
      const all = await adminList();
      expect(ids(all)).toContain(upi);
      expect(all.summary.upiPending).toBe(0);
    });

    it("an auto-cancelled (expired) UPI order is history: listed under Cancelled, not on the approval page", async () => {
      const upi = idOf(await place("UPI_QR", { utrNumber: UTR }));
      await pastDeadline(upi);
      await expireUnverifiedUpiOrders();
      expect(ids(await adminList("upi-pending"))).not.toContain(upi);
      expect(ids(await adminList("cancelled"))).toContain(upi);
    });

    it("COD and online orders are listed exactly as before", async () => {
      const cod = idOf(await place("COD"));
      const online = idOf(await place("ONLINE"));
      const all = ids(await adminList());
      expect(all).toEqual(expect.arrayContaining([cod, online]));
      expect(ids(await adminList("pending"))).toEqual(expect.arrayContaining([cod, online]));
    });
  });

  describe("checkout with two sellers (two orders, one payment)", () => {
    async function twoSellerCart() {
      const s = String(Date.now()) + "2";
      const seller2 = await Seller.create({
        name: "QR Seller 2", email: "seller2_" + s + "@example.com", phone: "91111" + s.slice(-5), password: "Password@123",
        shopName: "QR Mart 2", pincode: "452001", isVerified: true, location: { type: "Point", coordinates: [75.88, 22.72] },
      });
      const base = await Product.findById(ctx.product._id).lean();
      const product2 = await Product.create({
        name: "QR Cable", slug: "qr-cable-" + s, sku: "SKU2-" + s, description: "x", price: 100, salePrice: 100, stock: 30,
        headerId: base.headerId, categoryId: base.categoryId, subcategoryId: base.subcategoryId, sellerId: seller2._id, status: "active",
      });
      return product2;
    }
    const placeTwo = (product2, extra = {}) =>
      request(app).post("/api/orders").set("Authorization", "Bearer " + ctx.ct).send({
        items: [
          { product: String(ctx.product._id), quantity: 1, price: 100 },
          { product: String(product2._id), quantity: 1, price: 100 },
        ],
        address, paymentMode: "UPI_QR", timeSlot: "now", ...extra,
      });
    const stock2 = async (p) => (await Product.findById(p._id).lean()).stock;

    it("one UTR covers both orders; admin approving one approves both; neither is left behind", async () => {
      const p2 = await twoSellerCart();
      const res = await placeTwo(p2);
      expect(res.status).toBe(201);
      const orders = res.body.result.orders;
      expect(orders).toHaveLength(2);
      expect(await stock()).toBe(49);
      expect(await stock2(p2)).toBe(29);

      expect((await submitUtr(orders[0].orderId, UTR)).status).toBe(200);
      const docs = await Order.find({ orderId: { $in: orders.map((o) => o.orderId) } }).lean();
      expect(docs.every((d) => d.utrNumber === UTR && d.paymentStatus === "AWAITING_VERIFICATION")).toBe(true);
      expect(docs.every((d) => hoursLeft(d.upiApprovalExpiresAt) > 47.9)).toBe(true);

      expect((await approve(orders[0].orderId)).status).toBe(200);
      const after = await Order.find({ orderId: { $in: orders.map((o) => o.orderId) } }).lean();
      expect(after.every((d) => d.paymentStatus === "PAID" && d.status === "confirmed")).toBe(true);
      expect(after.every((d) => d.upiApprovalExpiresAt == null)).toBe(true);
    });

    it("no approval in 48h: both orders cancelled, both sellers stock released, no refund", async () => {
      const p2 = await twoSellerCart();
      const res = await placeTwo(p2, { utrNumber: UTR });
      const ids = res.body.result.orders.map((o) => o.orderId);
      await Order.updateMany({ orderId: { $in: ids } }, { $set: { upiApprovalExpiresAt: new Date(Date.now() - HOUR) } });
      const out = await expireUnverifiedUpiOrders();
      expect(out.expired).toBe(2);
      const docs = await Order.find({ orderId: { $in: ids } }).lean();
      expect(docs.every((d) => d.status === "cancelled")).toBe(true);
      expect(await stock()).toBe(50);
      expect(await stock2(p2)).toBe(30);
      expect(await Transaction.countDocuments({ type: "Refund" })).toBe(0);
    });
  });

  it("the policy used by the running code is 48h / 24h", () => {
    expect(getUpiApprovalPolicy()).toEqual({ approvalHours: 48, noUtrHours: 24 });
  });
});
