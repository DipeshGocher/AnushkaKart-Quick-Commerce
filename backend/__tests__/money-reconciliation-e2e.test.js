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
const { getAdminFinanceSummary, getAdminMoneyOverview } = await import("../app/services/finance/walletService.js");
const { invalidatePlatformRulesCache } = await import("../app/services/platformRulesService.js");

jest.setTimeout(240000);
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);
const R = (n) => Math.round(n * 100) / 100;
const HOUR = 3600 * 1000;
const OUT = "C:/Users/ACER/AppData/Local/Temp/claude/e8154b4f0ce897e4/8d87d581-5ff3-4334-93cc-16e09fd2f1a7/scratchpad/recon-out.txt";
const note = (...a) => fs.appendFileSync(OUT, a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") + "\n");

(RUN ? describe : describe.skip)("MONEY: a whole shop day, every balance reconciled to the paisa - real DB", () => {
  let app, customer, seller, rider, rider2, product, ctx = {};

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
    if (res.status !== 201) throw new Error(`place ${mode} failed: ${res.status} ${JSON.stringify(res.body)}`);
    return Order.findOne({ orderId: res.body.result.order.orderId }).lean();
  }
  /** pay (online: the gateway capture; QR: UTR + admin approval) */
  async function pay(o) {
    if (o.paymentMode === "ONLINE") await fin.handleOnlineOrderFinance(o._id, { transactionId: `pay_${o.orderId}` });
    if (o.paymentMode === "UPI_QR") {
      const utr = String(Math.floor(100000000000 + Math.random() * 899999999999));
      expect((await request(app).post(`/api/orders/${o.orderId}/payment/submit-utr`).set("Authorization", ct()).send({ utrNumber: utr })).status).toBe(200);
      expect((await request(app).post(`/api/orders/${o.orderId}/payment/approve-upi`).set("Authorization", adminTok).send({})).status).toBe(200);
    }
    return reload(o);
  }
  async function deliver(o, who = rider) {
    // importing the app re-reads .env (which may set a tiny return window): use the built-in 4 hours
    delete process.env.RETURN_WINDOW_MINUTES;
    delete process.env.LOCAL_RETURN_WINDOW_MINUTES;
    await Order.updateOne({ _id: o._id }, { $set: { status: "out_for_delivery", orderStatus: "out_for_delivery", workflowStatus: "OUT_FOR_DELIVERY", ...(o.fulfillmentType === "LOCAL" ? { deliveryBoy: who._id, deliveryPartner: who._id } : {}), deliveredAt: new Date(Date.now() - HOUR) } });
    await applyDeliveredSettlement(await Order.findById(o._id), o.orderId);
    return reload(o);
  }
  const closeWindow = (o) => Order.updateOne({ _id: o._id }, { $set: { returnWindowExpiresAt: new Date(Date.now() - HOUR) } });
  const sellerPayout = (o) => Payout.findOne({ relatedOrderIds: o._id, payoutType: "SELLER" }).lean();
  const riderPayout = (o) => Payout.findOne({ relatedOrderIds: o._id, payoutType: "DELIVERY_PARTNER", "metadata.flow": { $ne: "return_pickup" } }).lean();

  beforeAll(async () => {
    fs.writeFileSync(OUT, "");
    app = express();
    app.use(express.json({ limit: "5mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `recon_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    customer = await User.create({ name: "Rahul", phone: `90000${s.slice(-5)}`, role: "user", isVerified: true });
    seller = await Seller.create({
      name: "Seller", email: `seller_${s}@example.com`, phone: `91000${s.slice(-5)}`, password: "Password@123", shopName: "Mart",
      pincode: "452001", isVerified: true, isActive: true, applicationStatus: "approved", location: { type: "Point", coordinates: [75.87, 22.717] },
      bankDetails: { accountHolderName: "Seller", accountNumber: "123456789012", bankName: "SBI", ifscCode: "SBIN0001234" },
    });
    rider = await Delivery.create({ name: "Ravi", phone: `92000${s.slice(-5)}`, password: "Password@123", isVerified: true, isActive: true, bankDetails: { accountHolder: "Ravi", accountNumber: "999988887777", ifsc: "HDFC0000123", bankName: "HDFC" } });
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

  /* The day, in order. Each step asserts its own exact numbers; the last tests reconcile the whole system. */

  it("step 1: orders are placed and paid; every order splits into seller + rider + platform with nothing left over", async () => {
    // 200 of goods, 50 delivery, 20 handling, 10% commission, rider paid 40 -> customer pays 270
    const o1 = await pay(await place("ONLINE"));
    const o2 = await place("COD");
    const o3 = await pay(await place("UPI_QR"));
    const o4 = await pay(await place("ONLINE"));
    const o5 = await pay(await place("ONLINE")); // will be cancelled
    const o7 = await pay(await place("ONLINE", { address: courierAddress }));
    ctx = { o1, o2, o3, o4, o5, o7 };
    for (const o of [o1, o2, o3, o4, o5]) {
      const b = o.paymentBreakdown;
      expect(o.fulfillmentType).toBe("LOCAL");
      expect(b).toMatchObject({ productSubtotal: 200, deliveryFeeCharged: 50, handlingFeeCharged: 20, grandTotal: 270, sellerPayoutTotal: 180, adminProductCommissionTotal: 20, riderPayoutTotal: 40 });
      // nothing leaks: what the customer pays = seller + rider + platform
      expect(R(b.sellerPayoutTotal + b.riderPayoutTotal + b.platformTotalEarning)).toBe(b.grandTotal);
    }
    expect(o7.fulfillmentType).toBe("SHIPROCKET");
    const b7 = o7.paymentBreakdown;
    expect(R(b7.sellerPayoutTotal + b7.riderPayoutTotal + b7.platformTotalEarning)).toBe(b7.grandTotal);
    expect(b7.riderPayoutTotal).toBe(0);
    expect(b7.deliveryFeeCharged).toBeGreaterThanOrEqual(99); // the fallback courier fee (no live rate in the test)
    // the platform holds exactly what was captured so far (3 online + 1 QR + courier online)
    expect((await wal("ADMIN")).availableBalance).toBe(R(270 * 4 + b7.grandTotal));
    expect(o2.paymentStatus).not.toBe("PAID"); // the cash order has not been paid yet
  });

  it("step 2: deliveries - the cash order's cash is with the rider (net of his commission); online riders get a payout", async () => {
    const { o1, o2, o3, o4, o7 } = ctx;
    ctx.d1 = await deliver(o1);
    ctx.d2 = await deliver(o2);
    ctx.d3 = await deliver(o3);
    ctx.d4 = await deliver(o4);
    ctx.d7 = await deliver(o7);
    // cash order: the rider collected 270 and keeps his 40 -> he must hand over 230
    expect(ctx.d2.paymentBreakdown).toMatchObject({ codCollectedAmount: 230, codRemittedAmount: 0, codPendingAmount: 230 });
    expect((await wal("DELIVERY_PARTNER", rider._id)).cashInHand).toBe(230);
    expect((await riderPayout(ctx.d2))).toBeNull(); // paid out of the cash: never twice
    const cashTx = await Transaction.findOne({ reference: `CASH-COL-${o2.orderId}` }).lean();
    expect(cashTx.amount).toBe(230); // the Collect Cash screen shows what he really holds
    // online / QR orders: payout records exist, seller's on hold
    for (const d of [ctx.d1, ctx.d3, ctx.d4]) {
      expect((await riderPayout(d))).toMatchObject({ amount: 40, status: "PENDING" });
      expect((await sellerPayout(d))).toMatchObject({ amount: 180, status: "PENDING" });
      expect(d.settlementStatus.sellerPayout).toBe("HOLD");
    }
    // earnings are counted at delivery for every order, cash included
    expect(ctx.d1.platformEarning.net).toBe(50);
    expect(ctx.d2.platformEarning.net).toBe(50);
    expect(await LedgerEntry.countDocuments({ type: "ADMIN_EARNING_CREDITED", orderId: o2._id })).toBe(1);
  });

  it("step 3: admin 'Collect Cash' - the cash reaches the admin wallet exactly once, over-collection and double clicks are refused", async () => {
    const before = (await wal("ADMIN")).availableBalance;
    const tooMuch = await request(app).post("/api/admin/settle-cash").set("Authorization", adminTok).send({ riderId: String(rider._id), amount: 300, method: "Cash" });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.message).toMatch(/only holds ₹230/);
    expect((await wal("ADMIN")).availableBalance).toBe(before);

    const part = await request(app).post("/api/admin/settle-cash").set("Authorization", adminTok).send({ riderId: String(rider._id), amount: 100, method: "Cash" });
    expect(part.status).toBe(201);
    expect((await wal("ADMIN")).availableBalance).toBe(before + 100);
    expect((await wal("DELIVERY_PARTNER", rider._id)).cashInHand).toBe(130);
    expect((await reload(ctx.d2)).paymentBreakdown).toMatchObject({ codRemittedAmount: 100, codPendingAmount: 130 });

    const rest = await request(app).post("/api/admin/settle-cash").set("Authorization", adminTok).send({ riderId: String(rider._id), amount: 130, method: "Cash" });
    expect(rest.status).toBe(201);
    const dblClick = await request(app).post("/api/admin/settle-cash").set("Authorization", adminTok).send({ riderId: String(rider._id), amount: 130, method: "Cash" });
    expect(dblClick.status).toBe(400);
    expect((await wal("ADMIN")).availableBalance).toBe(before + 230);
    expect((await wal("DELIVERY_PARTNER", rider._id)).cashInHand).toBe(0);
    const o = await reload(ctx.d2);
    expect(o.paymentBreakdown).toMatchObject({ codRemittedAmount: 230, codPendingAmount: 0 });
    expect(o.paymentStatus).toBe("COD_RECONCILED");
    expect(await LedgerEntry.countDocuments({ type: "COD_REMITTED", actorType: "ADMIN" })).toBe(2);
    // the cash history agrees: collected 230, settled 230, nothing left in hand
    const cashPage = await request(app).get("/api/admin/delivery-cash").set("Authorization", adminTok);
    const row = (cashPage.body.result.items || cashPage.body.result.riders || []).find((r) => String(r.id) === String(rider._id));
    expect(row.currentCash).toBe(0);
    expect(row.totalSettled).toBe(230);
  });

  it("step 4: a paid order is cancelled and a delivered one is fully returned - both refunds land in the customer's wallet", async () => {
    // cancel o5 (paid online) - the customer's money goes to the wallet, the platform keeps holding it
    const adminBefore = (await wal("ADMIN")).availableBalance;
    await Order.updateOne({ _id: ctx.o5._id }, { $set: { status: "pending", orderStatus: "pending", workflowStatus: "SELLER_PENDING" } });
    const cancel = await request(app).put(`/api/orders/cancel/${ctx.o5.orderId}`).set("Authorization", ct()).send({ reason: "Changed my mind" });
    expect(cancel.status).toBe(200);
    expect((await wal("CUSTOMER", customer._id)).availableBalance).toBe(270);
    expect((await wal("ADMIN")).availableBalance).toBe(adminBefore);

    // return o4 in full (customer's fault, local rider picks it up)
    await Order.updateOne({ _id: ctx.d4._id }, { $set: { returnStatus: "qc_passed", returnFault: "customer", returnDeliveryBoy: rider2._id, returnDeliveryCommission: 25, returnQcRestock: true, returnItems: [{ product: product._id, name: "Speaker", itemIndex: 0, quantity: 2, price: 100, status: "approved" }] } });
    await fin; // (keeps the import used)
    const { createReturnPickupRiderPayout } = await import("../app/services/finance/returnPickupPayoutService.js");
    await createReturnPickupRiderPayout(await Order.findById(ctx.d4._id));
    await OrderReturnService.completeReturnAndRefund(await Order.findById(ctx.d4._id));
    const r4 = await reload(ctx.d4);
    expect(r4.status).toBe("returned");
    expect(r4.returnFinance).toMatchObject({ refundAmount: 200, sellerShare: 180, adminCommission: 20, adminCommissionReversed: 20, pickupFee: 25, pickupFeePayer: "platform" });
    expect((await wal("CUSTOMER", customer._id)).availableBalance).toBe(470);
    expect((await sellerPayout(ctx.d4)).status).toBe("CANCELLED");
    // net earning of the returned order: fees 70 - rider 40 - pickup 25 = 5 (commission undone)
    expect(r4.platformEarning.net).toBe(5);
  });

  it("step 5: return windows close - seller payouts are released; the payout job pays the riders; everyone's wallet is exact", async () => {
    for (const d of [ctx.d1, ctx.d2, ctx.d3, ctx.d7]) await closeWindow(d);
    await releaseExpiredSellerHolds();
    const job = await bulkProcessPayouts({ limit: 100 });
    expect(job.failed).toBe(0);
    // seller: o1 + o2 + o3 + o7 payouts (o4's was cancelled by the return)
    const sellerTotal = R(180 * 3 + ctx.d7.paymentBreakdown.sellerPayoutTotal);
    const sw = await wal("SELLER", seller._id);
    expect(sw).toMatchObject({ availableBalance: sellerTotal, pendingBalance: 0 });
    // rider R: delivery payouts for o1, o3 and o4 (he delivered o4 before it was returned; o2 was cash: kept
    // from the cash); rider2: the return pickup commission
    expect((await wal("DELIVERY_PARTNER", rider._id)).availableBalance).toBe(120);
    expect((await wal("DELIVERY_PARTNER", rider2._id)).availableBalance).toBe(25);
    ctx.sellerTotal = sellerTotal;
    for (const d of [ctx.d1, ctx.d2, ctx.d3, ctx.d7]) expect((await sellerPayout(d)).status).toBe("COMPLETED");
  });

  it("step 6: weight charge and freight on the courier order change exactly the right balances", async () => {
    const sellerBefore = (await wal("SELLER", seller._id)).availableBalance;
    const w = await recordShiprocketWeightDiscrepancy(ctx.o7.orderId, { discrepancyAmount: 30, reason: "heavier" });
    expect(w.applied).toMatchObject({ delta: 30, fromWallet: 30, owed: 0 });
    expect((await wal("SELLER", seller._id)).availableBalance).toBe(R(sellerBefore - 30));
    const before = (await reload(ctx.o7)).platformEarning.net;
    const f = await recordFreight(ctx.o7.orderId, { type: "forward", amount: 80 });
    const fee = ctx.d7.paymentBreakdown.deliveryFeeCharged;
    expect(f.earning.net).toBe(R(before + (fee - 80))); // the estimate was the fee charged
    ctx.weight = 30;
  });

  it("step 7: seller and rider withdrawals - the wallet is debited at once, admin Settled / Failed move the right money", async () => {
    const adminStart = (await wal("ADMIN")).availableBalance;
    const sellerAvail = (await wal("SELLER", seller._id)).availableBalance;

    expect((await request(app).post("/api/seller/request-withdrawal").set("Authorization", tok(seller._id, "seller")).send({ amount: sellerAvail + 1 })).status).toBe(400);
    const sw1 = await request(app).post("/api/seller/request-withdrawal").set("Authorization", tok(seller._id, "seller")).send({ amount: 300 });
    const sw2 = await request(app).post("/api/seller/request-withdrawal").set("Authorization", tok(seller._id, "seller")).send({ amount: 200 });
    expect([sw1.status, sw2.status]).toEqual([201, 201]);
    expect((await wal("SELLER", seller._id)).availableBalance).toBe(R(sellerAvail - 500));
    expect((await wal("ADMIN")).availableBalance).toBe(adminStart); // the admin wallet moves only when the admin pays

    const rw = await request(app).post("/api/delivery/request-withdrawal").set("Authorization", tok(rider._id, "delivery")).send({ amount: 120 });
    expect(rw.status).toBe(201);
    expect((await request(app).post("/api/delivery/request-withdrawal").set("Authorization", tok(rider._id, "delivery")).send({ amount: 1 })).status).toBe(400);

    const set = (id, status, reason) => request(app).put(`/api/admin/withdrawals/${id}`).set("Authorization", adminTok).send({ status, reason });
    expect((await set(sw1.body.result._id, "Settled")).status).toBe(200); // paid
    expect((await set(sw2.body.result._id, "Failed", "wrong account")).status).toBe(200); // back to the seller
    expect((await set(rw.body.result._id, "Settled")).status).toBe(200); // paid

    expect((await wal("ADMIN")).availableBalance).toBe(adminStart); // partner payouts already left the admin wallet when processed
    expect((await wal("SELLER", seller._id)).availableBalance).toBe(R(sellerAvail - 300));
    expect((await wal("DELIVERY_PARTNER", rider._id)).availableBalance).toBe(0);
    // each request can be settled only once
    expect((await set(sw1.body.result._id, "Settled")).status).toBe(409);
    expect((await set(sw2.body.result._id, "Failed", "again")).status).toBe(409);
    ctx.partnerPaid = 420;
    ctx.sellerWithdrawn = 300;
  });

  it("step 8: the customer withdraws refund money - paid and rejected requests", async () => {
    await request(app).put("/api/customer/wallet/account").set("Authorization", ct()).send({ method: "upi", upiId: "rahul@oksbi" });
    const adminStart = (await wal("ADMIN")).availableBalance;
    const a = await request(app).post("/api/customer/wallet/withdraw").set("Authorization", ct()).send({ amount: 300 });
    const b = await request(app).post("/api/customer/wallet/withdraw").set("Authorization", ct()).send({ amount: 170 });
    expect([a.status, b.status]).toEqual([201, 201]);
    expect((await wal("CUSTOMER", customer._id)).availableBalance).toBe(0);
    expect((await request(app).post("/api/customer/wallet/withdraw").set("Authorization", ct()).send({ amount: 1 })).status).toBe(400);
    expect((await request(app).put(`/api/admin/customer-withdrawals/${a.body.result.withdrawal.id}/pay`).set("Authorization", adminTok).send({ reference: "UTR-RECON-1" })).status).toBe(200);
    expect((await request(app).put(`/api/admin/customer-withdrawals/${b.body.result.withdrawal.id}/reject`).set("Authorization", adminTok).send({ reason: "Name does not match" })).status).toBe(200);
    expect((await wal("ADMIN")).availableBalance).toBe(R(adminStart - 300));
    expect((await wal("CUSTOMER", customer._id)).availableBalance).toBe(170);
    ctx.customerPaid = 300;
  });

  /* ───────────── the reconciliation of the whole system ───────────── */

  it("RECONCILIATION 1: bank = money in - money paid out = admin wallet + partners' withdrawable balances + partner withdrawals waiting", async () => {
    const orders = await Order.find({}).lean();
    // money IN: online / QR payments captured + cash the riders handed over
    let moneyIn = 0;
    for (const o of orders) {
      if (o.financeFlags?.onlinePaymentCaptured) moneyIn += o.paymentBreakdown.grandTotal;
      if (o.paymentMode === "COD") moneyIn += o.paymentBreakdown.codRemittedAmount || 0;
    }
    const paidOut = R(ctx.partnerPaid + ctx.customerPaid); // money that really left the bank: partners' withdrawals + the customer's
    const admin = (await wal("ADMIN")).availableBalance;
    const partnerWallets = await Wallet.find({ ownerType: { $in: ["SELLER", "DELIVERY_PARTNER"] } }).lean();
    const partnersAvail = partnerWallets.reduce((a, w) => a + w.availableBalance, 0);
    const partnerWdWaiting = (await Transaction.find({ type: "Withdrawal", status: { $in: ["Pending", "Processing"] } }).lean()).reduce((a, t) => a + Math.abs(t.amount), 0);
    note("moneyIn", moneyIn, "paidOut", paidOut, "admin", admin, "partnersAvail", partnersAvail, "partnerWdWaiting", partnerWdWaiting);
    expect(R(moneyIn - paidOut)).toBe(R(admin + partnersAvail + partnerWdWaiting));
    // the admin Wallet page's first number is exactly this bank figure
    const overview = await getAdminMoneyOverview();
    expect(overview.platformHolds).toBe(R(moneyIn - paidOut));
  });

  it("RECONCILIATION 2: nobody's wallet is negative, nothing is stuck, every request is in a final state", async () => {
    for (const w of await Wallet.find({}).lean()) {
      expect(w.availableBalance).toBeGreaterThanOrEqual(0);
      expect(w.pendingBalance).toBeGreaterThanOrEqual(0);
      expect(w.cashInHand).toBeGreaterThanOrEqual(0);
    }
    expect(await Payout.countDocuments({ status: { $in: ["PENDING", "PROCESSING"] } })).toBe(0);
    expect(await CustomerWithdrawal.countDocuments({ status: "pending" })).toBe(0);
    expect(await Transaction.countDocuments({ type: "Withdrawal", status: { $in: ["Pending", "Processing"] } })).toBe(0);
    expect(await Wallet.countDocuments({ recoverableDue: { $gt: 0 } })).toBe(0);
  });

  it("RECONCILIATION 3: every party's balance equals what the day's orders say it should be", async () => {
    const d7 = await reload(ctx.o7);
    // seller: 180 x3 (o1,o2,o3) + the courier order's share - the weight charge - what was withdrawn (300; the failed 200 came back)
    const sellerExpected = R(180 * 3 + d7.paymentBreakdown.sellerPayoutTotal - ctx.weight - ctx.sellerWithdrawn);
    expect((await wal("SELLER", seller._id)).availableBalance).toBe(sellerExpected);
    // riders: all paid out / withdrawn; rider2 still holds the return pickup commission
    expect((await wal("DELIVERY_PARTNER", rider._id)).availableBalance).toBe(0);
    expect((await wal("DELIVERY_PARTNER", rider2._id)).availableBalance).toBe(25);
    // customer: refunds 470 - paid 300 = 170 (the rejected request came back)
    expect((await wal("CUSTOMER", customer._id)).availableBalance).toBe(170);
    expect((await User.findById(customer._id).lean()).walletBalance).toBe(170); // the old profile mirror agrees
    // the cash rider hands over nothing more
    expect((await wal("DELIVERY_PARTNER", rider._id)).cashInHand).toBe(0);
  });

  it("RECONCILIATION 4: the admin report - total earning is the sum of each order's real earning; the cash-pending part is zero once all cash is collected", async () => {
    const summary = await getAdminFinanceSummary();
    const orders = await Order.find({ status: { $in: ["delivered", "returned"] } }).lean();
    const sum = R(orders.reduce((a, o) => a + (o.platformEarning?.net ?? o.paymentBreakdown.platformTotalEarning), 0));
    expect(summary.totalAdminEarning).toBe(sum);
    expect(summary.adminEarningCashPending).toBe(0);
    note("totalAdminEarning", summary.totalAdminEarning);
  });

  it("RECONCILIATION 5: the ledger and the wallets agree (drift check)", async () => {
    const drifts = [];
    for (const w of await Wallet.find({}).lean()) {
      const match = w.ownerId ? { actorType: w.ownerType, actorId: w.ownerId } : { actorType: w.ownerType, actorId: null };
      // profit-recognition rows are not wallet movements (same rule as the real verifier job)
      const rows = await LedgerEntry.find({ ...match, status: { $ne: "FAILED" }, type: { $nin: ["ADMIN_EARNING_CREDITED", "ADMIN_EARNING_REVERSED", "RETURN_RECOVERY_DUE", "RETURN_RECOVERY_APPLIED"] } }).lean();
      // a rider's cash in hand is tracked apart from the wallet balance (same rule as the real verifier job)
      const moves = rows.filter((r) => r.metadata?.bucket !== "cashInHand" && !(r.actorType === "DELIVERY_PARTNER" && ["ORDER_COD_COLLECTED", "COD_REMITTED"].includes(r.type)));
      const net = R(moves.reduce((a, r) => a + (r.direction === "CREDIT" ? r.amount : -r.amount), 0));
      const held = R(w.availableBalance + w.pendingBalance);
      if (Math.abs(net - held) > 0.01) drifts.push({ owner: w.ownerType, held, ledgerNet: net, drift: R(held - net) });
    }
    const adminRows = await LedgerEntry.find({ actorType: "ADMIN" }).lean();
    const byType = {};
    for (const r of adminRows) byType[`${r.type}/${r.direction}`] = R((byType[`${r.type}/${r.direction}`] || 0) + r.amount);
    note("ADMIN LEDGER BY TYPE", byType);
    note("LEDGER DRIFTS", drifts);
    expect(drifts).toEqual([]);
  });
});
