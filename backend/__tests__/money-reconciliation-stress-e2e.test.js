import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import User from "../app/models/customer.js";
import Seller from "../app/models/seller.js";
import Delivery from "../app/models/delivery.js";
import Category from "../app/models/category.js";
import Product from "../app/models/product.js";
import Setting from "../app/models/setting.js";
import Order from "../app/models/order.js";
import Wallet from "../app/models/wallet.js";
import Payout from "../app/models/payout.js";
import Transaction from "../app/models/transaction.js";
import LedgerEntry from "../app/models/ledgerEntry.js";
import CustomerWithdrawal from "../app/models/customerWithdrawal.js";
import LocalPincode from "../app/models/localPincode.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "reconcile-secret";
delete process.env.SHIPROCKET_EMAIL;
delete process.env.SHIPROCKET_PASSWORD;

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");
const fin = await import("../app/services/finance/orderFinanceService.js");
const { applyDeliveredSettlement } = await import("../app/services/orderSettlement.js");
const { default: releaseExpiredSellerHolds } = await import("../app/jobs/returnWindowReleaseJob.js");
const { bulkProcessPayouts } = await import("../app/services/finance/payoutService.js");
const { default: OrderReturnService } = await import("../app/services/order/orderReturnService.js");
const { recordShiprocketWeightDiscrepancy } = await import("../app/services/shipping/shiprocketService.js");
const { recordFreight } = await import("../app/services/finance/freightService.js");
const { getAdminFinanceSummary } = await import("../app/services/finance/walletService.js");
const { invalidatePlatformRulesCache } = await import("../app/services/platformRulesService.js");
const { createReturnPickupRiderPayout } = await import("../app/services/finance/returnPickupPayoutService.js");

jest.setTimeout(240000);
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);
const R = (n) => Math.round(n * 100) / 100;
const HOUR = 3600 * 1000;
const OUT = "C:/Users/ACER/AppData/Local/Temp/claude/e8154b4f0ce897e4/8d87d581-5ff3-4334-93cc-16e09fd2f1a7/scratchpad/recon-stress-out.txt";
const note = (...a) => fs.appendFileSync(OUT, a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") + "\n");

(RUN ? describe : describe.skip)("MONEY (stress): returns after payouts, empty wallets, courier freight, cash races - the books balance after every step - real DB", () => {
  let app, customer, seller, rider, rider2, product;

  const tok = (id, role) => `Bearer ${jwt.sign({ id: String(id), role }, process.env.JWT_SECRET, { expiresIn: "2h" })}`;
  const adminTok = tok(new mongoose.Types.ObjectId(), "admin");
  const ct = () => tok(customer._id, "user");
  const wal = async (type, id = null) => (await Wallet.findOne({ ownerType: type, ownerId: id }).lean()) || { availableBalance: 0, pendingBalance: 0, cashInHand: 0, recoverableDue: 0 };
  const reload = (o) => Order.findById(o._id).lean();
  const localAddress = { type: "Home", name: "C", address: "RNT Marg, Indore", city: "Indore", pincode: "452001", phone: "9999999999", location: { lat: 22.72, lng: 75.88 } };
  const courierAddress = { type: "Home", name: "C", address: "MG Road, Pune", city: "Pune", pincode: "411001", phone: "9999999999", location: { lat: 18.52, lng: 73.85 } };

  async function place(mode, { address = localAddress, qty = 2 } = {}) {
    const res = await request(app).post("/api/orders").set("Authorization", ct())
      .send({ items: [{ product: String(product._id), quantity: qty, price: 100 }], address, paymentMode: mode, timeSlot: "now" });
    if (res.status !== 201) throw new Error("place " + mode + " failed: " + res.status + " " + JSON.stringify(res.body));
    return Order.findOne({ orderId: res.body.result.order.orderId }).lean();
  }
  async function pay(o) {
    if (o.paymentMode === "ONLINE") await fin.handleOnlineOrderFinance(o._id, { transactionId: "pay_" + o.orderId });
    return reload(o);
  }
  async function deliver(o, who = rider) {
    delete process.env.RETURN_WINDOW_MINUTES;
    delete process.env.LOCAL_RETURN_WINDOW_MINUTES;
    await Order.updateOne({ _id: o._id }, { $set: { status: "out_for_delivery", orderStatus: "out_for_delivery", workflowStatus: "OUT_FOR_DELIVERY", ...(o.fulfillmentType === "LOCAL" ? { deliveryBoy: who._id, deliveryPartner: who._id } : {}), deliveredAt: new Date(Date.now() - HOUR) } });
    await applyDeliveredSettlement(await Order.findById(o._id), o.orderId);
    return reload(o);
  }
  const closeWindow = (o) => Order.updateOne({ _id: o._id }, { $set: { returnWindowExpiresAt: new Date(Date.now() - HOUR) } });
  const sellerPayout = (o) => Payout.findOne({ relatedOrderIds: o._id, payoutType: "SELLER" }).lean();

  /** The books must balance after EVERY step: nothing created, nothing lost, nobody negative. */
  async function books(label) {
    const orders = await Order.find({}).lean();
    let moneyIn = 0;
    for (const o of orders) {
      if (o.financeFlags?.onlinePaymentCaptured) moneyIn += o.paymentBreakdown.grandTotal;
      if (o.paymentMode === "COD") moneyIn += o.paymentBreakdown.codRemittedAmount || 0;
    }
    const cw = await CustomerWithdrawal.find({ status: "paid" }).lean();
    const partnerPaid = (await Transaction.find({ type: "Withdrawal", status: "Settled" }).lean()).reduce((a, t) => a + Math.abs(t.amount), 0);
    const paidOut = R(partnerPaid + cw.reduce((a, w) => a + w.amount, 0));
    const admin = (await wal("ADMIN")).availableBalance;
    const partners = await Wallet.find({ ownerType: { $in: ["SELLER", "DELIVERY_PARTNER"] } }).lean();
    const partnersAvail = partners.reduce((a, w) => a + w.availableBalance, 0);
    const waiting = (await Transaction.find({ type: "Withdrawal", status: { $in: ["Pending", "Processing"] } }).lean()).reduce((a, t) => a + Math.abs(t.amount), 0);
    const drifts = [];
    const negatives = [];
    for (const w of await Wallet.find({}).lean()) {
      if (w.availableBalance < 0 || w.pendingBalance < 0 || w.cashInHand < 0) negatives.push({ owner: w.ownerType, a: w.availableBalance, p: w.pendingBalance, c: w.cashInHand });
      const match = w.ownerId ? { actorType: w.ownerType, actorId: w.ownerId } : { actorType: w.ownerType, actorId: null };
      const rows = await LedgerEntry.find({ ...match, status: { $ne: "FAILED" }, type: { $nin: ["ADMIN_EARNING_CREDITED", "ADMIN_EARNING_REVERSED", "RETURN_RECOVERY_DUE", "RETURN_RECOVERY_APPLIED"] } }).lean();
      // a rider's cash in hand is tracked apart from the wallet balance (same rule as the real verifier job)
      const moves = rows.filter((r) => r.metadata?.bucket !== "cashInHand" && !(r.actorType === "DELIVERY_PARTNER" && ["ORDER_COD_COLLECTED", "COD_REMITTED"].includes(r.type)));
      const net = R(moves.reduce((a, r) => a + (r.direction === "CREDIT" ? r.amount : -r.amount), 0));
      const held = R(w.availableBalance + w.pendingBalance);
      if (Math.abs(net - held) > 0.01) drifts.push({ owner: w.ownerType, held, ledgerNet: net });
    }
    note(label, { moneyIn, paidOut, admin, partnersAvail, waiting });
    expect({ label, negatives }).toEqual({ label, negatives: [] });
    expect({ label, bank: R(moneyIn - paidOut) }).toEqual({ label, bank: R(admin + partnersAvail + waiting) });
    expect({ label, drifts }).toEqual({ label, drifts: [] });
  }
  const customerLiability = async () => R((await wal("CUSTOMER", customer._id)).availableBalance);

  async function refundOrder(d, { qty = 2, fault = "customer", pickupRider = rider2 } = {}) {
    await Order.updateOne({ _id: d._id }, { $set: { returnStatus: "qc_passed", returnFault: fault, returnDeliveryCommission: 25, returnQcRestock: true, ...(pickupRider ? { returnDeliveryBoy: pickupRider._id } : {}), returnItems: [{ product: product._id, name: "Speaker", itemIndex: 0, quantity: qty, price: 100, status: "approved" }] } });
    if (pickupRider) await createReturnPickupRiderPayout(await Order.findById(d._id));
    await OrderReturnService.completeReturnAndRefund(await Order.findById(d._id));
    return reload(d);
  }
  const processEverything = async (...orders) => {
    for (const o of orders) await closeWindow(o);
    await releaseExpiredSellerHolds();
    await bulkProcessPayouts({ limit: 200 });
  };
  const settleWithdrawal = (id, status = "Settled") => request(app).put("/api/admin/withdrawals/" + id).set("Authorization", adminTok).send({ status, reason: "test" });

  beforeAll(async () => {
    fs.writeFileSync(OUT, "");
    app = express();
    app.use(express.json({ limit: "5mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: "recon_stress_" + Date.now(), serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    customer = await User.create({ name: "Rahul", phone: `90000${s.slice(-5)}`, role: "user", isVerified: true });
    seller = await Seller.create({
      name: "Seller", email: `seller_${s}@example.com`, phone: `91000${s.slice(-5)}`, password: "Password@123", shopName: "Mart",
      pincode: "452001", isVerified: true, isActive: true, applicationStatus: "approved", location: { type: "Point", coordinates: [75.87, 22.717] },
      bankDetails: { accountHolderName: "Seller", accountNumber: "123456789012", bankName: "SBI", ifscCode: "SBIN0001234" },
    });
    rider = await Delivery.create({ name: "Ravi", phone: `92000${s.slice(-5)}`, password: "Password@123", isVerified: true, isActive: true });
    rider2 = await Delivery.create({ name: "Raju", phone: `93000${s.slice(-5)}`, password: "Password@123", isVerified: true, isActive: true });
    await LocalPincode.create({ pincode: "452001", city: "Indore", isActive: true });
    const header = await Category.create({ name: `H ${s}`, slug: `h-${s}`, type: "header", adminCommissionType: "percentage", adminCommissionValue: 10, handlingFeeType: "fixed", handlingFeeValue: 20, status: "active" });
    const category = await Category.create({ name: `C ${s}`, slug: `c-${s}`, type: "category", parentId: header._id, status: "active" });
    const subcategory = await Category.create({ name: `S ${s}`, slug: `s-${s}`, type: "subcategory", parentId: category._id, status: "active" });
    product = await Product.create({
      name: "Speaker", slug: `speaker-${s}`, sku: `SKU-${s}`, description: "x", price: 100, salePrice: 100, stock: 1000,
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
  });
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  it("A. a return AFTER the seller was already paid: the seller's money comes back to the platform, the refund is covered, the platform keeps exactly its net earning", async () => {
    const x1 = await deliver(await pay(await place("ONLINE")));
    await processEverything(x1);
    expect((await wal("SELLER", seller._id)).availableBalance).toBe(180);
    const r = await refundOrder(x1);
    expect(r.returnFinance).toMatchObject({ refundAmount: 200, sellerShare: 180, fromWallet: 180, fromPendingPayout: 0, owedBySeller: 0 });
    expect((await wal("SELLER", seller._id)).availableBalance).toBe(0);
    expect(await customerLiability()).toBe(200);
    await bulkProcessPayouts({ limit: 200 }); // the return pickup commission
    const admin = (await wal("ADMIN")).availableBalance;
    expect(admin).toBe(270 - 180 - 40 + 180 - 25); // captured, seller paid, rider paid, seller gave it back, return pickup
    expect(R(admin - (await customerLiability()))).toBe(r.platformEarning.net); // what is left after owing the customer = the real earning
    expect(r.platformEarning.net).toBe(5);
    await books("A");
  });

  it("B. the seller already WITHDREW the money and then a return comes: the wallet cannot cover it, the rest is owed and taken from the next payout - nothing is lost", async () => {
    const x2 = await deliver(await pay(await place("ONLINE")));
    await processEverything(x2);
    const w = await request(app).post("/api/seller/request-withdrawal").set("Authorization", tok(seller._id, "seller")).send({ amount: 180 });
    expect(w.status).toBe(201);
    expect((await settleWithdrawal(w.body.result._id)).status).toBe(200); // 180 left the bank
    await books("B-after-withdrawal");
    const r = await refundOrder(x2);
    expect(r.returnFinance).toMatchObject({ fromWallet: 0, owedBySeller: 180, sellerCharged: 180 });
    expect((await wal("SELLER", seller._id)).recoverableDue).toBe(180);
    expect(await customerLiability()).toBe(400);
    await books("B-after-return");
    // the next order's payout pays the debt: the seller gets nothing for it, the platform keeps that money
    const x3 = await deliver(await pay(await place("ONLINE")));
    await processEverything(x3);
    expect((await wal("SELLER", seller._id)).recoverableDue).toBe(0);
    expect((await wal("SELLER", seller._id)).availableBalance).toBe(0);
    expect(await sellerPayout(x3)).toBeNull();
    await books("B-after-recovery");
  });

  it("C. a partial return (1 of 4) after the payout: only that part comes back", async () => {
    const x4 = await deliver(await pay(await place("ONLINE", { qty: 4 })));
    expect(x4.paymentBreakdown).toMatchObject({ grandTotal: 470, sellerPayoutTotal: 360 });
    await processEverything(x4);
    const sellerBefore = (await wal("SELLER", seller._id)).availableBalance;
    const custBefore = await customerLiability();
    const r = await refundOrder(x4, { qty: 1 });
    expect(r.returnFinance).toMatchObject({ refundAmount: 100, sellerShare: 90, fromWallet: 90 });
    expect((await wal("SELLER", seller._id)).availableBalance).toBe(R(sellerBefore - 90));
    expect(await customerLiability()).toBe(custBefore + 100);
    await bulkProcessPayouts({ limit: 200 });
    await books("C-partial-return");
  });

  it("D. courier order: seller-fault return, the freight recorded later and lowered, a weight charge taken then waived - every rupee moves exactly once", async () => {
    const x5 = await deliver(await pay(await place("ONLINE", { address: courierAddress })));
    await processEverything(x5);
    await books("D-delivered");
    const r = await refundOrder(x5, { fault: "seller", qty: 2, pickupRider: null });
    expect(r.returnFinance.pickupFee).toBe(0); // the real freight is not known yet
    await books("D-refund");
    const f1 = await recordFreight(x5.orderId, { type: "reverse", amount: 90 });
    expect(f1.applied.delta).toBe(90);
    await books("D-freight-90");
    const f2 = await recordFreight(x5.orderId, { type: "reverse", amount: 70 });
    expect(f2.applied.delta).toBe(-20);
    await books("D-freight-70");
    const wc = await recordShiprocketWeightDiscrepancy(x5.orderId, { discrepancyAmount: 30, reason: "heavier" });
    expect(wc.applied.delta).toBe(30);
    await books("D-weight-30");
    const wv = await recordShiprocketWeightDiscrepancy(x5.orderId, { discrepancyAmount: 0 });
    expect(wv.applied.delta).toBe(-30);
    await books("D-weight-waived");
  });

  it("E. cash: two riders, partial handovers, and two collections at the same moment - the cash is booked once, no ghost settlement", async () => {
    const c1 = await deliver(await place("COD"), rider);
    const c2 = await deliver(await place("COD"), rider2);
    await books("E-delivered");
    const adminBefore = (await wal("ADMIN")).availableBalance;
    const collect = (riderId, amount) => request(app).post("/api/admin/settle-cash").set("Authorization", adminTok).send({ riderId: String(riderId), amount, method: "Cash" });
    expect((await collect(rider._id, 100)).status).toBe(201);
    expect((await wal("ADMIN")).availableBalance).toBe(adminBefore + 100);
    await books("E-partial");
    const both = await Promise.all([collect(rider._id, 130), collect(rider._id, 130)]);
    expect(both.filter((r) => r.status === 201)).toHaveLength(1);
    expect([400, 409]).toContain(both.find((r) => r.status !== 201).status);
    expect((await wal("ADMIN")).availableBalance).toBe(adminBefore + 230);
    expect((await wal("DELIVERY_PARTNER", rider._id)).cashInHand).toBe(0);
    const settlements = await Transaction.find({ user: rider._id, type: "Cash Settlement" }).lean();
    expect(R(settlements.reduce((a, t) => a + Math.abs(t.amount), 0))).toBe(230); // exactly what was collected
    expect((await collect(rider2._id, 230)).status).toBe(201);
    expect((await wal("ADMIN")).availableBalance).toBe(adminBefore + 460);
    expect((await reload(c1)).paymentBreakdown.codPendingAmount).toBe(0);
    expect((await reload(c2)).paymentBreakdown.codPendingAmount).toBe(0);
    await books("E-collected");
    await processEverything(c1, c2);
    await books("E-payouts");
  });

  it("F. a QR order the admin rejects, and a paid order cancelled: no money appears from nowhere", async () => {
    const q = await place("UPI_QR");
    await request(app).post(`/api/orders/${q.orderId}/payment/submit-utr`).set("Authorization", ct()).send({ utrNumber: "502938491077" });
    const rej = await request(app).post(`/api/orders/${q.orderId}/payment/reject-upi`).set("Authorization", adminTok).send({ reason: "Not found in bank" });
    expect(rej.status).toBe(200);
    expect((await reload(q)).financeFlags?.onlinePaymentCaptured).toBeFalsy();
    await books("F-qr-rejected");
    const before = await customerLiability();
    const paid = await pay(await place("ONLINE"));
    await Order.updateOne({ _id: paid._id }, { $set: { status: "pending", orderStatus: "pending", workflowStatus: "SELLER_PENDING" } });
    expect((await request(app).put(`/api/orders/cancel/${paid.orderId}`).set("Authorization", ct()).send({ reason: "x" })).status).toBe(200);
    expect(await customerLiability()).toBe(before + 270);
    await books("F-cancelled");
    await request(app).put("/api/customer/wallet/account").set("Authorization", ct()).send({ method: "upi", upiId: "rahul@oksbi" });
    const all = await customerLiability();
    const wd = await request(app).post("/api/customer/wallet/withdraw").set("Authorization", ct()).send({ amount: all });
    expect(wd.status).toBe(201);
    expect((await request(app).put(`/api/admin/customer-withdrawals/${wd.body.result.withdrawal.id}/pay`).set("Authorization", adminTok).send({ reference: "UTR-STRESS-1" })).status).toBe(200);
    expect(await customerLiability()).toBe(0);
    await books("F-customer-paid");
  });

  it("G. at the end: the report matches the orders and the books still balance", async () => {
    const summary = await getAdminFinanceSummary();
    const orders = await Order.find({ status: { $in: ["delivered", "returned"] } }).lean();
    expect(summary.totalAdminEarning).toBe(R(orders.reduce((a, o) => a + (o.platformEarning?.net ?? o.paymentBreakdown.platformTotalEarning), 0)));
    await books("G-final");
  });
});
