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
import Wallet from "../app/models/wallet.js";
import Payout from "../app/models/payout.js";
import LedgerEntry from "../app/models/ledgerEntry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "courier-cod-secret";
delete process.env.SHIPROCKET_EMAIL;
delete process.env.SHIPROCKET_PASSWORD;

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(), translateBatch: jest.fn(), translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");
const { applyDeliveredSettlement } = await import("../app/services/orderSettlement.js");
const { default: releaseExpiredSellerHolds } = await import("../app/jobs/returnWindowReleaseJob.js");

const { getAdminFinanceSummary, getAdminMoneyOverview } = await import("../app/services/finance/walletService.js");
const { invalidatePlatformRulesCache } = await import("../app/services/platformRulesService.js");

jest.setTimeout(180000);
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);
const HOUR = 3600 * 1000;

(RUN ? describe : describe.skip)("courier (Shiprocket) cash on delivery: booked at delivery, credited when the courier pays - real DB", () => {
  let app, customer, seller, product;
  const tok = (id, role) => `Bearer ${jwt.sign({ id: String(id), role }, process.env.JWT_SECRET, { expiresIn: "2h" })}`;
  const adminTok = () => tok(new mongoose.Types.ObjectId(), "admin");
  const wal = async (type, id = null) => (await Wallet.findOne({ ownerType: type, ownerId: id }).lean()) || { availableBalance: 0 };
  const courierAddress = { type: "Home", name: "C", address: "MG Road, Pune", city: "Pune", pincode: "411001", phone: "9999999999", location: { lat: 18.52, lng: 73.85 } };

  async function placeCourierCod() {
    const res = await request(app).post("/api/orders").set("Authorization", tok(customer._id, "user"))
      .send({ items: [{ product: String(product._id), quantity: 2, price: 100 }], address: courierAddress, paymentMode: "COD", timeSlot: "now" });
    if (res.status !== 201) throw new Error(`place failed ${res.status} ${JSON.stringify(res.body)}`);
    return Order.findOne({ orderId: res.body.result.order.orderId }).lean();
  }
  async function deliver(o) {
    delete process.env.RETURN_WINDOW_MINUTES;
    delete process.env.LOCAL_RETURN_WINDOW_MINUTES;
    await Order.updateOne({ _id: o._id }, { $set: { status: "out_for_delivery", orderStatus: "out_for_delivery", workflowStatus: "OUT_FOR_DELIVERY", deliveredAt: new Date(Date.now() - HOUR) } });
    await applyDeliveredSettlement(await Order.findById(o._id), o.orderId);
    return Order.findById(o._id).lean();
  }
  const receive = (orderId, body) => request(app).post(`/api/shipping/shiprocket/cod-received/${orderId}`).set("Authorization", adminTok()).send(body || {});

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: "5mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `courier_cod_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    customer = await User.create({ name: "Rahul", phone: `90000${s.slice(-5)}`, role: "user", isVerified: true });
    seller = await Seller.create({
      name: "Seller", email: `seller_${s}@example.com`, phone: `91000${s.slice(-5)}`, password: "Password@123", shopName: "Mart",
      pincode: "452001", isVerified: true, isActive: true, applicationStatus: "approved", location: { type: "Point", coordinates: [75.87, 22.717] },
    });
    const header = await Category.create({ name: `H ${s}`, slug: `h-${s}`, type: "header", adminCommissionType: "percentage", adminCommissionValue: 10, handlingFeeType: "fixed", handlingFeeValue: 20, status: "active" });
    const category = await Category.create({ name: `C ${s}`, slug: `c-${s}`, type: "category", parentId: header._id, status: "active" });
    const sub = await Category.create({ name: `S ${s}`, slug: `s-${s}`, type: "subcategory", parentId: category._id, status: "active" });
    product = await Product.create({
      name: "Speaker", slug: `speaker-${s}`, sku: `SKU-${s}`, description: "x", price: 100, salePrice: 100, stock: 1000,
      headerId: header._id, categoryId: category._id, subcategoryId: sub._id, sellerId: seller._id, status: "active",
    });
    await Setting.create({
      deliveryPricingMode: "distance_based", pricingMode: "distance_based", customerBaseDeliveryFee: 30,
      riderBasePayout: 30, baseDeliveryCharge: 30, baseDistanceCapacityKm: 0.5, incrementalKmSurcharge: 10,
      deliveryPartnerRatePerKm: 5, fleetCommissionRatePerKm: 5, fixedDeliveryFee: 30,
      customerPricingType: "fixed", customerFixedCharge: 50, riderEarningType: "fixed", riderFixedEarning: 40,
      handlingFeeStrategy: "highest_category_fee", codEnabled: true, onlineEnabled: true,
    });
    invalidatePlatformRulesCache();
  });
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  it("a courier COD order can be placed, and nothing is booked as cash before delivery", async () => {
    const o = await placeCourierCod();
    expect(o.fulfillmentType).toBe("SHIPROCKET");
    expect(o.paymentMode).toBe("COD");
    expect(o.paymentBreakdown.codCollectedAmount || 0).toBe(0);
    expect(await receive(o.orderId)).toMatchObject({ status: 409 }); // not delivered yet
  });

  it("delivery books the whole total as 'with the courier'; no rider cash, nothing in the admin wallet yet", async () => {
    const o = await deliver(await placeCourierCod());
    const total = o.paymentBreakdown.grandTotal;
    expect(total).toBeGreaterThan(0);
    expect(o.paymentBreakdown.codCollectedAmount).toBe(total);
    expect(o.paymentBreakdown.codRemittedAmount).toBe(0);
    expect(o.paymentBreakdown.codPendingAmount).toBe(total);
    expect(o.paymentStatus).toBe("CASH_COLLECTED");
    expect(o.financeFlags.codMarkedCollected).toBe(true);
    expect((await wal("ADMIN")).availableBalance).toBe(0);
    const ov = await getAdminMoneyOverview();
    expect(ov.courierCash).toBeGreaterThanOrEqual(total);
    expect(ov.riderCash).toBe(0); // it is not rider cash
  });

  it("delivering again changes nothing (idempotent)", async () => {
    const o = await deliver(await placeCourierCod());
    const again = await deliver(o);
    expect(again.paymentBreakdown.codCollectedAmount).toBe(o.paymentBreakdown.codCollectedAmount);
    expect(again.paymentBreakdown.codPendingAmount).toBe(o.paymentBreakdown.codPendingAmount);
  });

  it("admin receives part, then the rest: the admin wallet gets exactly that, the order ends fully reconciled", async () => {
    const o = await deliver(await placeCourierCod());
    const total = o.paymentBreakdown.grandTotal;
    const before = (await wal("ADMIN")).availableBalance;

    const part = await receive(o.orderId, { amount: 100, reference: "UTR-1" });
    expect(part.status).toBe(200);
    expect(part.body.result).toMatchObject({ received: 100, codPendingAmount: total - 100 });
    expect((await wal("ADMIN")).availableBalance).toBe(before + 100);
    expect((await Order.findById(o._id).lean()).paymentStatus).toBe("PARTIALLY_REMITTED");

    const over = await receive(o.orderId, { amount: total }); // more than what is left
    expect(over.status).toBe(400);
    expect((await wal("ADMIN")).availableBalance).toBe(before + 100);

    const rest = await receive(o.orderId); // default = everything pending
    expect(rest.status).toBe(200);
    expect((await wal("ADMIN")).availableBalance).toBe(before + total);
    const done = await Order.findById(o._id).lean();
    expect(done.paymentStatus).toBe("COD_RECONCILED");
    expect(done.paymentBreakdown.codPendingAmount).toBe(0);
    expect(done.paymentBreakdown.codRemittedAmount).toBe(total);

    expect((await receive(o.orderId)).status).toBe(409); // nothing left to receive
    expect(await LedgerEntry.countDocuments({ orderId: o._id, type: "COD_REMITTED" })).toBe(2);
  });

  it("only an admin can record it; invalid amounts are refused", async () => {
    const o = await deliver(await placeCourierCod());
    const asSeller = await request(app).post(`/api/shipping/shiprocket/cod-received/${o.orderId}`).set("Authorization", tok(seller._id, "seller")).send({});
    expect(asSeller.status).toBe(403);
    expect((await receive(o.orderId, { amount: 0 })).status).toBe(400);
    expect((await receive(o.orderId, { amount: -5 })).status).toBe(400);
  });

  it("the seller is paid only from cash that really arrived: payout waits until the courier's cash is received", async () => {
    const o = await deliver(await placeCourierCod());
    // the platform wallet holds nothing (money from earlier tests is taken out so the test is exact)
    await Wallet.updateOne({ ownerType: "ADMIN" }, { $set: { availableBalance: 0 } });
    await Order.updateOne({ _id: o._id }, { $set: { returnWindowExpiresAt: new Date(Date.now() - HOUR) } });
    await releaseExpiredSellerHolds();
    await releaseExpiredSellerHolds();
    const sellerBefore = (await wal("SELLER", seller._id)).availableBalance;
    const payoutBefore = await Payout.findOne({ relatedOrderIds: o._id, payoutType: "SELLER" }).lean();
    expect(payoutBefore).toBeTruthy();
    expect(payoutBefore.status).not.toBe("COMPLETED"); // nothing to pay it from yet
    const owed = payoutBefore.amount;

    expect((await receive(o.orderId)).status).toBe(200); // the courier's cash arrives
    await releaseExpiredSellerHolds(); // the minute-by-minute job retries held payouts once the platform wallet has the money
    const payoutAfter = await Payout.findOne({ relatedOrderIds: o._id, payoutType: "SELLER" }).lean();
    expect(payoutAfter.status).toBe("COMPLETED");
    expect((await wal("SELLER", seller._id)).availableBalance).toBe(sellerBefore + owed);
  });

  it("the Wallet page numbers: courier cash shrinks as the courier pays", async () => {
    const o = await deliver(await placeCourierCod());
    const start = (await getAdminMoneyOverview()).courierCash;
    await receive(o.orderId, { amount: 50 });
    expect((await getAdminMoneyOverview()).courierCash).toBe(start - 50);
    const summary = await getAdminFinanceSummary();
    expect(summary.adminEarningCashPending).toBeGreaterThanOrEqual(0);
  });
});
