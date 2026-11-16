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
import Wallet from "../app/models/wallet.js";
import Payout from "../app/models/payout.js";
import LedgerEntry from "../app/models/ledgerEntry.js";
import Transaction from "../app/models/transaction.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "return-money-secret";

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");
const { default: OrderReturnService } = await import("../app/services/order/orderReturnService.js");
const { createPendingPayoutForOrder } = await import("../app/services/finance/payoutService.js");
const { createPendingSellerPayout } = await import("../app/services/finance/orderFinanceService.js");
const { OWNER_TYPE, PAYOUT_TYPE } = await import("../app/constants/finance.js");

jest.setTimeout(120000);

/**
 * REAL MongoDB test of the return money flow (customer refund, seller, admin commission, pickup fee).
 * Runs only with RUN_E2E_TESTS=true and MONGO_URI_E2E = a REPLICA SET (the refund is one transaction);
 * a throw-away local mongod, never MONGO_URI.
 */
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);

(RUN ? describe : describe.skip)("Return money (customer / seller / admin / pickup fee) - real DB", () => {
  let app;
  let customer;
  let seller;
  let seq = 0;

  const adminTok = () => `Bearer ${jwt.sign({ id: String(new mongoose.Types.ObjectId()), role: "admin" }, process.env.JWT_SECRET, { expiresIn: "2h" })}`;
  const userTok = (id) => `Bearer ${jwt.sign({ id: String(id), role: "user" }, process.env.JWT_SECRET, { expiresIn: "2h" })}`;

  const wallet = (ownerType, ownerId = null) => Wallet.findOne({ ownerType, ownerId });
  const setWallet = (ownerType, ownerId, fields) =>
    Wallet.findOneAndUpdate({ ownerType, ownerId }, { $set: fields, $setOnInsert: { ownerType, ownerId } }, { upsert: true, new: true });
  const ledger = (orderId, type) => LedgerEntry.find({ orderId, type }).lean();
  const reload = (o) => Order.findById(o._id).lean();

  /** A delivered order, return accepted by QC, waiting for the refund. Lines carry 10% commission. */
  async function makeReturn({
    items = [{ name: "Phone", quantity: 1, price: 1000 }],
    returned = [0],
    fault = "customer",
    paymentMode = "ONLINE",
    payout = "pending", // "pending" (held) | "paid" | "none"
    returnStatus = "qc_passed",
    returnQty = null,
  } = {}) {
    seq += 1;
    const full = items.map((i) => ({ product: new mongoose.Types.ObjectId(), ...i }));
    const subtotal = full.reduce((a, i) => a + i.price * i.quantity, 0);
    const sellerTotal = subtotal * 0.9;
    const returnItems = returned.map((idx) => ({
      product: full[idx].product, name: full[idx].name, itemIndex: idx,
      quantity: returnQty ?? full[idx].quantity, price: full[idx].price, status: "approved",
    }));
    const refund = returnItems.reduce((a, r) => a + r.price * r.quantity, 0);
    const o = await Order.create({
      orderId: `ORD-RM-${Date.now()}-${seq}`,
      customer: customer._id,
      seller: seller._id,
      items: full,
      address: { name: "R", address: "x", city: "Indore", state: "MP", pincode: "452001", phone: "9876543210" },
      paymentMode,
      status: "delivered",
      orderStatus: "delivered",
      workflowVersion: 2,
      workflowStatus: "DELIVERED",
      deliveredAt: new Date(Date.now() - 60 * 60 * 1000),
      paymentBreakdown: {
        productSubtotal: subtotal,
        sellerPayoutTotal: sellerTotal,
        adminProductCommissionTotal: subtotal * 0.1,
        platformTotalEarning: subtotal * 0.1 + 20,
        grandTotal: subtotal + 80,
        lineItems: full.map((i) => ({
          productId: i.product, productName: i.name, quantity: i.quantity,
          itemSubtotal: i.price * i.quantity, sellerPayout: i.price * i.quantity * 0.9, adminProductCommission: i.price * i.quantity * 0.1,
        })),
      },
      financeFlags: { adminEarningCredited: true, deliveredSettlementApplied: true, sellerPayoutQueued: payout !== "none", sellerPayoutHeld: payout === "pending" },
      settlementStatus: { sellerPayout: payout === "pending" ? "HOLD" : payout === "paid" ? "COMPLETED" : "NOT_APPLICABLE", adminEarningCredited: true },
      returnStatus,
      returnReason: "test",
      returnReasonCode: fault === "seller" ? "DAMAGED_DEFECTIVE" : "CHANGED_MIND",
      returnFault: fault,
      returnItems,
      returnRefundAmount: refund,
      returnDeliveryCommission: 25,
    });
    if (payout === "pending") {
      await createPendingPayoutForOrder({ order: o, payoutType: PAYOUT_TYPE.SELLER, beneficiaryId: seller._id, amount: sellerTotal });
    }
    return o;
  }

  const refund = (o) => OrderReturnService.completeReturnAndRefund(o);

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: "2mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `return_money_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });

  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    customer = await User.create({ name: "Rahul", phone: `90000${s.slice(-5)}`, role: "user", isVerified: true });
    seller = await Seller.create({
      name: "S", email: `s_${s}@example.com`, phone: `91000${s.slice(-5)}`, password: "Password@123",
      shopName: "Shop", pincode: "452001", isVerified: true, isActive: true, applicationStatus: "approved",
      location: { type: "Point", coordinates: [75.87, 22.71] },
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  describe("payout still on hold (return inside the window)", () => {
    it("customer's choice: customer +1,000 wallet; seller's 900 payout cancelled; admin commission 100 taken back; platform pays the pickup fee", async () => {
      const o = await makeReturn();
      const done = await refund(o);
      expect(done.returnStatus).toBe("refund_completed");

      expect((await wallet(OWNER_TYPE.CUSTOMER, customer._id)).availableBalance).toBe(1000);
      const payout = await Payout.findOne({ relatedOrderIds: o._id }).lean();
      expect(payout.status).toBe("CANCELLED");
      expect((await wallet(OWNER_TYPE.SELLER, seller._id)).pendingBalance).toBe(0);

      const rev = await ledger(o._id, "ADMIN_EARNING_REVERSED");
      expect(rev).toHaveLength(1);
      expect(rev[0]).toMatchObject({ amount: 100, direction: "DEBIT" });

      const saved = await reload(o);
      expect(saved.status).toBe("returned");
      expect(saved.settlementStatus.sellerPayout).toBe("CANCELLED");
      expect(saved.returnFinance).toMatchObject({
        refundAmount: 1000, sellerShare: 900, adminCommission: 100, adminCommissionReversed: 100,
        pickupFee: 25, pickupFeePayer: "platform", sellerCharged: 900,
        fromPendingPayout: 900, fromWallet: 0, owedBySeller: 0, payoutAction: "cancelled",
      });
      const tx = await Transaction.findOne({ order: o._id, userModel: "Seller", type: "Refund" }).lean();
      expect(tx.amount).toBe(-900);
    });

    it("seller's fault: the seller also pays the 25 pickup fee (here it exceeds the payout, so 25 is owed and recovered later)", async () => {
      const o = await makeReturn({ fault: "seller" });
      await refund(o);
      const saved = await reload(o);
      expect(saved.returnFinance).toMatchObject({ pickupFeePayer: "seller", sellerCharged: 925, fromPendingPayout: 900, owedBySeller: 25 });
      expect((await wallet(OWNER_TYPE.SELLER, seller._id)).recoverableDue).toBe(25);
      expect((await wallet(OWNER_TYPE.SELLER, seller._id)).availableBalance).toBe(0); // never negative
    });

    it("PARTIAL return: only the returned item's share comes off the payout (it is reduced, not cancelled)", async () => {
      const o = await makeReturn({
        items: [{ name: "Phone", quantity: 1, price: 1000 }, { name: "Case", quantity: 1, price: 500 }],
        returned: [1],
      });
      await refund(o);

      expect((await wallet(OWNER_TYPE.CUSTOMER, customer._id)).availableBalance).toBe(500);
      const payout = await Payout.findOne({ relatedOrderIds: o._id }).lean();
      expect(payout.status).toBe("PENDING");
      expect(payout.amount).toBe(900); // 1,350 - 450
      expect(payout.metadata.returnReducedBy).toBe(450);
      const w = await wallet(OWNER_TYPE.SELLER, seller._id);
      expect(w.pendingBalance).toBe(900);
      const saved = await reload(o);
      expect(saved.settlementStatus.sellerPayout).toBe("HOLD"); // the rest of the payout is still held
      expect(saved.returnFinance).toMatchObject({ refundAmount: 500, sellerShare: 450, adminCommissionReversed: 50, payoutAction: "reduced" });
      expect((await ledger(o._id, "ADMIN_EARNING_REVERSED"))[0].amount).toBe(50);
      expect(await ledger(o._id, "PAYOUT_REDUCED")).toHaveLength(1);
    });

    it("partial return + seller's fault: payout reduced by share AND pickup fee", async () => {
      const o = await makeReturn({
        items: [{ name: "Phone", quantity: 1, price: 1000 }, { name: "Case", quantity: 1, price: 500 }],
        returned: [1], fault: "seller",
      });
      await refund(o);
      const payout = await Payout.findOne({ relatedOrderIds: o._id }).lean();
      expect(payout.amount).toBe(875); // 1,350 - 450 - 25
      expect((await reload(o)).returnFinance).toMatchObject({ sellerCharged: 475, fromPendingPayout: 475, owedBySeller: 0 });
    });

    it("2 of 3 units returned: two thirds of that line", async () => {
      const o = await makeReturn({ items: [{ name: "Cable", quantity: 3, price: 100 }], returned: [0], returnQty: 2 });
      await refund(o);
      expect((await wallet(OWNER_TYPE.CUSTOMER, customer._id)).availableBalance).toBe(200);
      expect((await Payout.findOne({ relatedOrderIds: o._id }).lean()).amount).toBe(90); // 270 - 180
      expect((await reload(o)).returnFinance).toMatchObject({ sellerShare: 180, adminCommissionReversed: 20 });
    });
  });

  describe("payout already paid to the seller's wallet", () => {
    it("the seller's wallet is debited by what they earned (900), not the full price (1,000)", async () => {
      await setWallet(OWNER_TYPE.SELLER, seller._id, { availableBalance: 5000 });
      const o = await makeReturn({ payout: "paid" });
      await refund(o);
      const w = await wallet(OWNER_TYPE.SELLER, seller._id);
      expect(w.availableBalance).toBe(4100);
      const saved = await reload(o);
      expect(saved.returnFinance).toMatchObject({ fromWallet: 900, fromPendingPayout: 0, owedBySeller: 0, payoutAction: "wallet_debited" });
      expect((await Transaction.findOne({ order: o._id, userModel: "Seller", type: "Refund" }).lean()).amount).toBe(-900);
    });

    it("seller's fault: 925 is debited", async () => {
      await setWallet(OWNER_TYPE.SELLER, seller._id, { availableBalance: 5000 });
      const o = await makeReturn({ payout: "paid", fault: "seller" });
      await refund(o);
      expect((await wallet(OWNER_TYPE.SELLER, seller._id)).availableBalance).toBe(4075);
    });

    it("seller's wallet too low: the refund still goes through; the shortfall is owed and the balance never goes negative", async () => {
      await setWallet(OWNER_TYPE.SELLER, seller._id, { availableBalance: 300 });
      const o = await makeReturn({ payout: "paid" });
      const done = await refund(o);
      expect(done.returnStatus).toBe("refund_completed"); // the customer is never left waiting
      expect((await wallet(OWNER_TYPE.CUSTOMER, customer._id)).availableBalance).toBe(1000);
      const w = await wallet(OWNER_TYPE.SELLER, seller._id);
      expect(w.availableBalance).toBe(0);
      expect(w.recoverableDue).toBe(600);
      expect((await reload(o)).returnFinance).toMatchObject({ fromWallet: 300, owedBySeller: 600 });
      expect(await ledger(o._id, "RETURN_RECOVERY_DUE")).toHaveLength(1);
    });

    it("what the seller owes is taken from their NEXT payout", async () => {
      await setWallet(OWNER_TYPE.SELLER, seller._id, { availableBalance: 300 });
      const returned = await makeReturn({ payout: "paid" });
      await refund(returned);
      expect((await wallet(OWNER_TYPE.SELLER, seller._id)).recoverableDue).toBe(600);

      // the seller's next delivered order: payout 450, of which 450 goes to what they owe
      const next = await makeReturn({ payout: "none", returnStatus: "none" });
      await Order.updateOne({ _id: next._id }, { $set: { "paymentBreakdown.sellerPayoutTotal": 450 } });
      const fresh = await Order.findById(next._id);
      const created = await createPendingSellerPayout(fresh, {});
      expect(created).toBeNull(); // nothing left to pay out
      expect((await wallet(OWNER_TYPE.SELLER, seller._id)).recoverableDue).toBe(150);

      // and the one after: payout 1,000 -> 150 goes to the debt, the seller gets 850
      const next2 = await makeReturn({ payout: "none", returnStatus: "none" });
      await Order.updateOne({ _id: next2._id }, { $set: { "paymentBreakdown.sellerPayoutTotal": 1000 } });
      const created2 = await createPendingSellerPayout(await Order.findById(next2._id), {});
      expect(created2.amount).toBe(850);
      expect(created2.metadata.returnRecoveryDeduction).toBe(150);
      expect((await wallet(OWNER_TYPE.SELLER, seller._id)).recoverableDue).toBe(0);
      expect(await ledger(next2._id, "RETURN_RECOVERY_APPLIED")).toHaveLength(1);
    });
  });

  describe("COD, idempotency and not-QC-passed", () => {
    it("COD: no admin earning was booked, so none is taken back; customer and seller are settled the same way", async () => {
      const o = await makeReturn({ paymentMode: "COD" });
      await refund(o);
      expect(await ledger(o._id, "ADMIN_EARNING_REVERSED")).toHaveLength(0);
      expect((await wallet(OWNER_TYPE.CUSTOMER, customer._id)).availableBalance).toBe(1000);
      expect((await reload(o)).returnFinance).toMatchObject({ adminCommission: 100, adminCommissionReversed: 0, sellerCharged: 900 });
    });

    it("running the refund twice pays the customer once and takes the money from the seller once", async () => {
      await setWallet(OWNER_TYPE.SELLER, seller._id, { availableBalance: 5000 });
      const o = await makeReturn({ payout: "paid" });
      await refund(o);
      await refund(await Order.findById(o._id));
      expect((await wallet(OWNER_TYPE.CUSTOMER, customer._id)).availableBalance).toBe(1000);
      expect((await wallet(OWNER_TYPE.SELLER, seller._id)).availableBalance).toBe(4100);
      expect(await ledger(o._id, "ADMIN_EARNING_REVERSED")).toHaveLength(1);
      expect(await Transaction.countDocuments({ order: o._id, userModel: "Seller", type: "Refund" })).toBe(1);
    });

    it("a return that has not passed QC moves no money", async () => {
      const o = await makeReturn({ returnStatus: "qc_failed" });
      await refund(o);
      expect(await wallet(OWNER_TYPE.CUSTOMER, customer._id)).toBeNull();
      expect((await Payout.findOne({ relatedOrderIds: o._id }).lean()).status).toBe("PENDING");
      expect(await ledger(o._id, "ADMIN_EARNING_REVERSED")).toHaveLength(0);
    });

    it("an old return with no reason code: platform pays the pickup fee (seller charged only their share)", async () => {
      const o = await makeReturn();
      await Order.updateOne({ _id: o._id }, { $set: { returnFault: null, returnReasonCode: null } });
      await refund(await Order.findById(o._id));
      expect((await reload(o)).returnFinance).toMatchObject({ pickupFeePayer: "platform", sellerCharged: 900 });
    });
  });

  describe("through the real API", () => {
    const post = (url, body, auth) => request(app).post(url).set("Authorization", auth).send(body);

    it("the customer chooses a reason from the list: it is stored with its fault, and a wrong code is refused", async () => {
      const list = await request(app).get("/api/orders/return-reasons").set("Authorization", userTok(customer._id));
      expect(list.status).toBe(200);
      expect(list.body.results.map((r) => r.code)).toContain("DAMAGED_DEFECTIVE");

      const o = await makeReturn({ returnStatus: "none", payout: "none" });
      await Order.updateOne({ _id: o._id }, { $set: { returnItems: [], returnRefundAmount: 0, returnFault: null, returnReasonCode: null, returnReason: null, returnEligibleAt: new Date(Date.now() - 1000), returnWindowExpiresAt: new Date(Date.now() + 3600 * 1000) } });
      const bad = await post(`/api/orders/${o.orderId}/returns`, { items: [{ itemIndex: 0, quantity: 1 }], reasonCode: "NOPE", conditionAssurance: true, images: ["https://x/y.png"] }, userTok(customer._id));
      expect(bad.status).toBe(400);
      const ok = await post(`/api/orders/${o.orderId}/returns`, { items: [{ itemIndex: 0, quantity: 1 }], reasonCode: "DAMAGED_DEFECTIVE", conditionAssurance: true, images: ["https://x/y.png"] }, userTok(customer._id));
      expect(ok.status).toBe(200);
      const saved = await reload(o);
      expect(saved).toMatchObject({ returnReasonCode: "DAMAGED_DEFECTIVE", returnFault: "seller", returnReason: "Item is damaged or defective", returnStatus: "return_requested" });
    });

    it("an old app that sends only a written reason still works (fault unknown)", async () => {
      const o = await makeReturn({ returnStatus: "none", payout: "none" });
      await Order.updateOne({ _id: o._id }, { $set: { returnItems: [], returnRefundAmount: 0, returnFault: null, returnReasonCode: null, returnEligibleAt: new Date(Date.now() - 1000), returnWindowExpiresAt: new Date(Date.now() + 3600 * 1000) } });
      const ok = await post(`/api/orders/${o.orderId}/returns`, { items: [{ itemIndex: 0, quantity: 1 }], reason: "Defective product", conditionAssurance: true, images: ["https://x/y.png"] }, userTok(customer._id));
      expect(ok.status).toBe(200);
      expect(await reload(o)).toMatchObject({ returnFault: "unknown", returnReasonCode: null, returnReason: "Defective product" });
    });

    it("admin QC pass -> refund_completed with the money applied; the Returns list and details show it (and a seller sees only their side)", async () => {
      await setWallet(OWNER_TYPE.SELLER, seller._id, { availableBalance: 5000 });
      const o = await makeReturn({ payout: "paid", returnStatus: "returned", fault: "seller" });
      await Order.updateOne({ _id: o._id }, { $set: { returnPickedAt: new Date(), returnDeliveredBackAt: new Date() } });

      const before = await request(app).get("/api/orders/seller-returns").query({ group: "active", limit: 50 }).set("Authorization", adminTok());
      const row = before.body.result.items.find((r) => r.orderId === o.orderId);
      expect(row.returnMoney).toMatchObject({ status: "if_qc_passes", refundAmount: 1000, sellerShare: 900, pickupFeePayer: "seller", sellerCharged: 925, adminCommission: 100 });

      const qc = await request(app).put(`/api/orders/returns/${o.orderId}/qc`).set("Authorization", adminTok()).send({ qcStatus: "qc_passed" });
      expect(qc.status).toBe(200);
      const saved = await reload(o);
      expect(saved.returnStatus).toBe("refund_completed");
      expect((await wallet(OWNER_TYPE.CUSTOMER, customer._id)).availableBalance).toBe(1000);
      expect((await wallet(OWNER_TYPE.SELLER, seller._id)).availableBalance).toBe(4075);

      const done = await request(app).get("/api/orders/seller-returns").query({ group: "completed", limit: 50 }).set("Authorization", adminTok());
      const doneRow = done.body.result.items.find((r) => r.orderId === o.orderId);
      expect(doneRow.returnMoney).toMatchObject({ status: "applied", fromWallet: 925, adminCommissionReversed: 100 });

      const details = await request(app).get(`/api/orders/${o.orderId}/returns`).set("Authorization", adminTok());
      expect(details.body.result.returnMoney.status).toBe("applied");
      const mine = await request(app).get(`/api/orders/${o.orderId}/returns`).set("Authorization", userTok(customer._id));
      expect(mine.body.result.returnMoney).toEqual({ status: "applied", refundAmount: 1000 }); // the customer sees only the refund
    });
  });
});
