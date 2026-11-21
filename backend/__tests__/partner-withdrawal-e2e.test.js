import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import Order from "../app/models/order.js";
import User from "../app/models/customer.js";
import Seller from "../app/models/seller.js";
import Delivery from "../app/models/delivery.js";
import Category from "../app/models/category.js";
import Wallet from "../app/models/wallet.js";
import Payout from "../app/models/payout.js";
import Transaction from "../app/models/transaction.js";
import LedgerEntry from "../app/models/ledgerEntry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "partner-wd-secret";
delete process.env.RETURN_WINDOW_MINUTES;
delete process.env.ENABLE_PAYOUT_BATCH_JOB;
delete process.env.SERVER_SIDE_COUPON_ENGINE;

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");
const fin = await import("../app/services/finance/orderFinanceService.js");
const { generateOrderPaymentBreakdown } = await import("../app/services/finance/pricingService.js");
const { default: releaseExpiredSellerHolds } = await import("../app/jobs/returnWindowReleaseJob.js");
const payoutJob = await import("../app/jobs/payoutBatchJob.js");
const { isServerSideCouponEngineEnabled } = await import("../app/constants/finance.js");
const { bulkProcessPayouts } = await import("../app/services/finance/payoutService.js");
const { default: OrderReturnService } = await import("../app/services/order/orderReturnService.js");

jest.setTimeout(120000);

const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);
const HOUR = 3600 * 1000;

describe("the two switches are ON by default (no env needed)", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it("payout job and coupon engine are on unless explicitly switched off", () => {
    delete process.env.ENABLE_PAYOUT_BATCH_JOB;
    delete process.env.SERVER_SIDE_COUPON_ENGINE;
    expect(payoutJob.isPayoutBatchJobEnabled()).toBe(true);
    expect(isServerSideCouponEngineEnabled()).toBe(true);
    process.env.ENABLE_PAYOUT_BATCH_JOB = "false";
    process.env.SERVER_SIDE_COUPON_ENGINE = "false";
    expect(payoutJob.isPayoutBatchJobEnabled()).toBe(false);
    expect(isServerSideCouponEngineEnabled()).toBe(false);
    process.env.ENABLE_PAYOUT_BATCH_JOB = "true";
    process.env.SERVER_SIDE_COUPON_ENGINE = "true";
    expect(payoutJob.isPayoutBatchJobEnabled()).toBe(true);
    expect(isServerSideCouponEngineEnabled()).toBe(true);
  });
});

(RUN ? describe : describe.skip)("seller / delivery withdrawals from the wallet - real DB", () => {
  let app, customer, seller, rider, header, seq = 0;
  const settings = {
    customerPricingType: "distance", customerBaseDistance: 2, customerBaseCharge: 30, customerExtraPerKm: 10,
    riderEarningType: "distance", riderBaseDistance: 2, riderBaseEarning: 20, riderExtraPerKm: 6,
  };
  const tok = (id, role) => `Bearer ${jwt.sign({ id: String(id), role }, process.env.JWT_SECRET, { expiresIn: "2h" })}`;
  const wallet = (type, id = null) => Wallet.findOne({ ownerType: type, ownerId: id }).lean();
  const adminWallet = () => wallet("ADMIN");
  const sellerWithdraw = (amount) => request(app).post("/api/seller/request-withdrawal").set("Authorization", tok(seller._id, "seller")).send({ amount });
  const riderWithdraw = (amount) => request(app).post("/api/delivery/request-withdrawal").set("Authorization", tok(rider._id, "delivery")).send({ amount });
  const adminSet = (id, status, reason) => request(app).put(`/api/admin/withdrawals/${id}`).set("Authorization", tok(new mongoose.Types.ObjectId(), "admin")).send({ status, reason });
  const sellerEarnings = () => request(app).get("/api/seller/earnings").set("Authorization", tok(seller._id, "seller"));
  const sellerPayout = (o) => Payout.findOne({ relatedOrderIds: o._id, payoutType: "SELLER" }).lean();
  const riderPayout = (o) => Payout.findOne({ relatedOrderIds: o._id, payoutType: "DELIVERY_PARTNER" }).lean();
  const setAdminWallet = (availableBalance) => Wallet.findOneAndUpdate({ ownerType: "ADMIN", ownerId: null }, { $set: { availableBalance } }, { upsert: true, new: true });

  async function order({ paymentMode = "ONLINE", withRider = true, price = 1000 } = {}) {
    seq += 1;
    const productId = new mongoose.Types.ObjectId();
    const breakdown = await generateOrderPaymentBreakdown({
      preHydratedItems: [{ productId: String(productId), productName: "Phone", quantity: 1, price, headerCategoryId: String(header._id), sellerId: String(seller._id) }],
      distanceKm: 3, deliverySettings: settings, handlingFeeStrategy: "highest_category_fee",
    });
    const o = await Order.create({
      orderId: `ORD-PW-${Date.now()}-${seq}`, customer: customer._id, seller: seller._id,
      items: [{ product: productId, name: "Phone", quantity: 1, price }],
      address: { name: "R", address: "x", city: "Indore", state: "MP", pincode: "452001", phone: "9876543210" },
      paymentMode, paymentStatus: "CREATED", status: "out_for_delivery", orderStatus: "out_for_delivery",
      workflowVersion: 2, workflowStatus: "OUT_FOR_DELIVERY", fulfillmentType: "LOCAL",
      ...(withRider ? { deliveryBoy: rider._id, deliveryPartner: rider._id } : {}),
    });
    fin.freezeFinancialSnapshot(o, breakdown);
    await o.save();
    if (paymentMode === "ONLINE") await fin.handleOnlineOrderFinance(o._id, { transactionId: "pay_x" });
    await fin.settleDeliveredOrder(o._id);
    return Order.findById(o._id).lean();
  }
  const closeWindow = (o) => Order.updateOne({ _id: o._id }, { $set: { returnWindowExpiresAt: new Date(Date.now() - HOUR) } });

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: "2mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `partner_wd_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });
  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    customer = await User.create({ name: "Rahul", phone: `90000${s.slice(-5)}`, role: "user", isVerified: true });
    seller = await Seller.create({
      name: "S", email: `s_${s}@example.com`, phone: `91000${s.slice(-5)}`, password: "Password@123", shopName: "Shop", pincode: "452001",
      isVerified: true, isActive: true, applicationStatus: "approved", location: { type: "Point", coordinates: [75.87, 22.71] },
      bankDetails: { accountHolderName: "Seller S", accountNumber: "123456789012", bankName: "SBI", ifscCode: "SBIN0001234" },
    });
    rider = await Delivery.create({ name: "Ravi", phone: `92000${s.slice(-5)}`, password: "Password@123", isVerified: true, isActive: true, bankDetails: { accountHolder: "Ravi", accountNumber: "999988887777", ifsc: "HDFC0000123", bankName: "HDFC" } });
    header = await Category.create({ name: "Electronics", slug: `el-${s}`, type: "header", adminCommissionType: "percentage", adminCommissionValue: 10, adminCommission: 10, handlingFeeType: "fixed", handlingFeeValue: 5, handlingFees: 5 });
  });
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  describe("seller: the money is withdrawable only after the return window", () => {
    it("right after delivery the earning is ON HOLD: nothing can be withdrawn", async () => {
      const o = await order();
      expect((await sellerPayout(o)).status).toBe("PENDING");
      expect((await Order.findById(o._id).lean()).settlementStatus.sellerPayout).toBe("HOLD");
      const w = await wallet("SELLER", seller._id);
      expect(w.availableBalance).toBe(0);
      expect(w.pendingBalance).toBe(900);
      const res = await sellerWithdraw(100);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Insufficient balance. Available: ₹0/);
      expect(await Transaction.countDocuments({ type: "Withdrawal" })).toBe(0);
      const earn = (await sellerEarnings()).body.result.balances;
      expect(earn.availableBalance).toBe(0);
      expect(earn.onHoldBalance).toBe(900);
    });

    it("the payout job does not touch money that is still on hold", async () => {
      await setAdminWallet(100000);
      const o = await order();
      const r = await bulkProcessPayouts({ limit: 50 });
      expect(r.completed).toBeGreaterThanOrEqual(1); // the rider's payout
      expect((await sellerPayout(o)).status).toBe("PENDING");
      expect((await wallet("SELLER", seller._id)).availableBalance).toBe(0);
    });

    it("when the return window closes the job releases it: now it is available and can be withdrawn", async () => {
      await setAdminWallet(100000);
      const o = await order();
      await closeWindow(o);
      await releaseExpiredSellerHolds();
      expect((await sellerPayout(o)).status).toBe("COMPLETED");
      const w = await wallet("SELLER", seller._id);
      expect(w).toMatchObject({ availableBalance: 900, pendingBalance: 0 });
      expect((await sellerEarnings()).body.result.balances.availableBalance).toBe(900);

      const res = await sellerWithdraw(400);
      expect(res.status).toBe(201);
      expect(res.body.result).toMatchObject({ status: "Pending", amount: -400, userModel: "Seller" });
      expect((await wallet("SELLER", seller._id)).availableBalance).toBe(500);
      const led = await LedgerEntry.find({ type: "WITHDRAWAL", actorType: "SELLER" }).lean();
      expect(led).toHaveLength(1);
      expect(led[0]).toMatchObject({ amount: 400, direction: "DEBIT" });
      expect((await sellerWithdraw(501)).status).toBe(400);
      expect((await sellerEarnings()).body.result.balances).toMatchObject({ availableBalance: 500, pendingWithdrawals: 400 });
    });

    it("an order that was RETURNED never became withdrawable money", async () => {
      await setAdminWallet(100000);
      const o = await order();
      const returnItems = [{ product: o.items[0].product, name: "Phone", itemIndex: 0, quantity: 1, price: 1000, status: "approved" }];
      await Order.updateOne({ _id: o._id }, { $set: { returnStatus: "qc_passed", returnFault: "customer", returnDeliveryCommission: 25, returnItems } });
      await OrderReturnService.completeReturnAndRefund(await Order.findById(o._id));
      await closeWindow(o);
      await releaseExpiredSellerHolds();
      const w = await wallet("SELLER", seller._id);
      expect(w.availableBalance).toBe(0);
      expect((await sellerWithdraw(1)).status).toBe(400);
    });

    it("a rejected return releases the money (the seller was right)", async () => {
      await setAdminWallet(100000);
      const o = await order();
      await Order.updateOne({ _id: o._id }, { $set: { returnStatus: "return_rejected" } });
      await releaseExpiredSellerHolds();
      expect((await wallet("SELLER", seller._id)).availableBalance).toBe(900);
    });

    it("two withdrawals at the same moment for the whole balance: only one is accepted", async () => {
      await setAdminWallet(100000);
      const o = await order();
      await closeWindow(o);
      await releaseExpiredSellerHolds();
      const results = await Promise.all([sellerWithdraw(900), sellerWithdraw(900), sellerWithdraw(900)]);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(await Transaction.countDocuments({ type: "Withdrawal" })).toBe(1);
      expect((await wallet("SELLER", seller._id)).availableBalance).toBe(0);
    });

    it("no bank account linked: refused before any money moves", async () => {
      await Seller.updateOne({ _id: seller._id }, { $unset: { bankDetails: 1 } });
      expect((await sellerWithdraw(10)).status).toBe(400);
    });
  });

  describe("the admin settles or fails a withdrawal", () => {
    async function withdrawable() {
      await setAdminWallet(2000);
      const o = await order();
      await closeWindow(o);
      await releaseExpiredSellerHolds();
      const res = await sellerWithdraw(400);
      return res.body.result._id;
    }

    it("Settled: the seller's wallet stays down and the admin wallet is NOT debited again (it already paid the money into the seller's wallet when the payout was processed)", async () => {
      const id = await withdrawable();
      const adminBefore = (await adminWallet()).availableBalance;
      const res = await adminSet(id, "Settled");
      expect(res.status).toBe(200);
      expect((await Transaction.findById(id).lean()).status).toBe("Settled");
      expect((await adminWallet()).availableBalance).toBe(adminBefore);
      expect(await LedgerEntry.countDocuments({ type: "PARTNER_WITHDRAWAL_PAID" })).toBe(0);
      expect((await wallet("SELLER", seller._id)).availableBalance).toBe(500);
    });

    it("Failed: the money goes back to the seller's wallet", async () => {
      const id = await withdrawable();
      const res = await adminSet(id, "Failed", "Bank details wrong");
      expect(res.status).toBe(200);
      expect((await wallet("SELLER", seller._id)).availableBalance).toBe(900);
      expect((await Transaction.findById(id).lean()).status).toBe("Failed");
      expect(await LedgerEntry.countDocuments({ type: "PARTNER_WITHDRAWAL_REJECTED" })).toBe(1);
      expect(await LedgerEntry.countDocuments({ type: "PARTNER_WITHDRAWAL_PAID" })).toBe(0);
    });

    it("Processing first, then Settled; settling twice or failing after settled is refused and nothing is booked twice", async () => {
      const id = await withdrawable();
      expect((await adminSet(id, "Processing")).status).toBe(200);
      expect((await adminSet(id, "Settled")).status).toBe(200);
      const twice = await adminSet(id, "Settled");
      expect(twice.status).toBe(409);
      const again = await adminSet(id, "Failed", "too late");
      expect(again.status).toBe(409);
      expect(again.body.message).toMatch(/already settled or failed/);
      expect(await LedgerEntry.countDocuments({ type: "PARTNER_WITHDRAWAL_REJECTED" })).toBe(0);
      expect((await wallet("SELLER", seller._id)).availableBalance).toBe(500);
    });

    it("an older request made before this change (no wallet debit) is still handled the old way", async () => {
      const t = await Transaction.create({ user: seller._id, userModel: "Seller", type: "Withdrawal", amount: -300, status: "Pending", reference: "WDR-OLD" });
      const res = await adminSet(t._id, "Settled");
      expect(res.status).toBe(200);
      expect((await Transaction.findById(t._id).lean()).status).toBe("Settled");
      expect(await LedgerEntry.countDocuments({ type: "PARTNER_WITHDRAWAL_PAID" })).toBe(0);
    });
  });

  describe("delivery partner", () => {
    it("online order: the rider's payout is paid by the job into the wallet right away; the rider withdraws it; the admin settles", async () => {
      await setAdminWallet(100000);
      const o = await order({ paymentMode: "ONLINE" });
      const rp = await riderPayout(o);
      expect(rp.status).toBe("PENDING");
      expect((await riderWithdraw(10)).status).toBe(400); // not paid into the wallet yet
      await bulkProcessPayouts({ limit: 50 });
      expect((await riderPayout(o)).status).toBe("COMPLETED");
      const w = await wallet("DELIVERY_PARTNER", rider._id);
      expect(w.availableBalance).toBe(rp.amount);
      const res = await riderWithdraw(rp.amount);
      expect(res.status).toBe(201);
      expect((await wallet("DELIVERY_PARTNER", rider._id)).availableBalance).toBe(0);
      expect((await riderWithdraw(1)).status).toBe(400);
      const set = await adminSet(res.body.result._id, "Settled");
      expect(set.status).toBe(200);
      expect((await Transaction.findById(res.body.result._id).lean()).status).toBe("Settled");
    });

    it("cash on delivery: the rider keeps the commission out of the cash, so there is nothing to withdraw (no double pay)", async () => {
      const o = await order({ paymentMode: "COD" });
      expect(await riderPayout(o)).toBeNull();
      expect((await wallet("DELIVERY_PARTNER", rider._id))?.availableBalance || 0).toBe(0);
      expect((await riderWithdraw(5)).status).toBe(400);
    });

    it("the rider's withdrawal can be failed and the money comes back", async () => {
      await setAdminWallet(100000);
      const o = await order({ paymentMode: "ONLINE" });
      await bulkProcessPayouts({ limit: 50 });
      const amount = (await riderPayout(o)).amount;
      const id = (await riderWithdraw(amount)).body.result._id;
      await adminSet(id, "Failed", "UPI wrong");
      expect((await wallet("DELIVERY_PARTNER", rider._id)).availableBalance).toBe(amount);
    });
  });

  describe("the payout job is not starved or stuck", () => {
    it("held seller payouts do not fill the batch: later payouts still get paid", async () => {
      await setAdminWallet(100000);
      const held = [];
      for (let i = 0; i < 3; i += 1) held.push(await order({ withRider: false }));
      const rider1 = await order({ paymentMode: "ONLINE" });
      const r = await bulkProcessPayouts({ limit: 1 }); // a batch of ONE: it must pick the releasable payout, not a held one
      expect(r.total).toBe(1);
      expect(r.results[0].status).toBe("COMPLETED");
      expect((await riderPayout(rider1)).status).toBe("COMPLETED");
      for (const h of held) expect((await sellerPayout(h)).status).toBe("PENDING");
    });

    it("a payout that fails (platform balance too low) goes to the back of the line", async () => {
      const a = await order({ paymentMode: "ONLINE" });
      await setAdminWallet(0); // the platform has no money: the rider's payout will fail
      const first = await bulkProcessPayouts({ limit: 5 });
      expect(first.failed).toBeGreaterThanOrEqual(1);
      expect((await riderPayout(a)).metadata.lastFailedAt).toBeTruthy();
    });
  });
});
