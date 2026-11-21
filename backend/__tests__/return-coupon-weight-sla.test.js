import mongoose from "mongoose";
import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import Order from "../app/models/order.js";
import User from "../app/models/customer.js";
import Seller from "../app/models/seller.js";
import Category from "../app/models/category.js";
import Wallet from "../app/models/wallet.js";
import Payout from "../app/models/payout.js";
import LedgerEntry from "../app/models/ledgerEntry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
delete process.env.RETURN_WINDOW_MINUTES;

const { computeReturnMoney } = await import("../app/services/order/returnMoney.js");
const { getRequestStage, sweepReturnRequests } = await import("../app/services/order/returnRequestSlaService.js");
const { default: OrderReturnService } = await import("../app/services/order/orderReturnService.js");
const fin = await import("../app/services/finance/orderFinanceService.js");
const { generateOrderPaymentBreakdown } = await import("../app/services/finance/pricingService.js");
const { recordShiprocketWeightDiscrepancy } = await import("../app/services/shipping/shiprocketService.js");
const { processPayout } = await import("../app/services/finance/payoutService.js");

jest.setTimeout(120000);

/* ───────────────────────── 1. coupon share is not refunded (pure) ───────────────────────── */

describe("return money with a coupon (no database)", () => {
  const line = (productId, price, qty, commissionPct = 10) => ({
    productId, quantity: qty, itemSubtotal: price * qty,
    sellerPayout: price * qty * (1 - commissionPct / 100), adminProductCommission: price * qty * (commissionPct / 100),
  });
  const mk = ({ items, discount = 0, returned, commissionPct = 10 }) => {
    const full = items.map((i) => ({ product: new mongoose.Types.ObjectId(), ...i }));
    const subtotal = full.reduce((a, i) => a + i.price * i.quantity, 0);
    return {
      items: full,
      paymentMode: "ONLINE",
      paymentBreakdown: {
        productSubtotal: subtotal, discountTotal: discount,
        sellerPayoutTotal: subtotal * (1 - commissionPct / 100), adminProductCommissionTotal: subtotal * (commissionPct / 100),
        platformTotalEarning: subtotal * (commissionPct / 100), lineItems: full.map((i) => line(i.product, i.price, i.quantity, commissionPct)),
      },
      financeFlags: { adminEarningCredited: true },
      returnItems: returned.map((idx) => ({ product: full[idx].product, itemIndex: idx, quantity: full[idx].quantity, price: full[idx].price })),
    };
  };

  it("no coupon: the customer gets the full price (nothing changed)", () => {
    const m = computeReturnMoney(mk({ items: [{ price: 1000, quantity: 1 }], returned: [0] }));
    expect(m).toMatchObject({ refundAmount: 1000, itemValue: 1000, discountShare: 0, sellerShare: 900, adminCommission: 100 });
  });

  it("₹100 coupon on a ₹1000 item, the whole order returned: the customer gets back ₹900, the seller still gives back what they earned (₹900)", () => {
    const m = computeReturnMoney(mk({ items: [{ price: 1000, quantity: 1 }], discount: 100, returned: [0] }));
    expect(m).toMatchObject({ refundAmount: 900, itemValue: 1000, discountShare: 100, sellerShare: 900, adminCommission: 100 });
  });

  it("the seller gives back what they EARNED even when that is more than the customer paid (5% commission, ₹100 coupon)", () => {
    const m = computeReturnMoney(mk({ items: [{ price: 1000, quantity: 1 }], discount: 100, returned: [0], commissionPct: 5 }));
    expect(m.refundAmount).toBe(900);
    expect(m.sellerShare).toBe(950);
  });

  it("partial return: only the returned item's share of the coupon is held back (₹150 coupon on ₹1000 + ₹500)", () => {
    const items = [{ price: 1000, quantity: 1 }, { price: 500, quantity: 1 }];
    expect(computeReturnMoney(mk({ items, discount: 150, returned: [1] }))).toMatchObject({ refundAmount: 450, discountShare: 50, itemValue: 500 });
    expect(computeReturnMoney(mk({ items, discount: 150, returned: [0] }))).toMatchObject({ refundAmount: 900, discountShare: 100 });
    expect(computeReturnMoney(mk({ items, discount: 150, returned: [0, 1] }))).toMatchObject({ refundAmount: 1350, discountShare: 150 });
  });

  it("a part of the quantity: the share follows the returned part", () => {
    const m = computeReturnMoney(mk({ items: [{ price: 100, quantity: 4 }], discount: 40, returned: [0] }));
    expect(m).toMatchObject({ itemValue: 400, discountShare: 40, refundAmount: 360 });
    const order = mk({ items: [{ price: 100, quantity: 4 }], discount: 40, returned: [0] });
    order.returnItems[0].quantity = 1;
    expect(computeReturnMoney(order)).toMatchObject({ itemValue: 100, discountShare: 10, refundAmount: 90 });
  });

  it("never refunds less than 0 and never more than the price, even with a coupon bigger than the items", () => {
    const m = computeReturnMoney(mk({ items: [{ price: 100, quantity: 1 }], discount: 500, returned: [0] }));
    expect(m.refundAmount).toBe(0);
    expect(m.discountShare).toBe(100);
  });

  it("the rupee amounts add up to the paise (₹100 coupon over three items)", () => {
    const items = [{ price: 333, quantity: 1 }, { price: 333, quantity: 1 }, { price: 334, quantity: 1 }];
    const all = computeReturnMoney(mk({ items, discount: 100, returned: [0, 1, 2] }));
    expect(all.refundAmount).toBe(900);
    expect(all.discountShare).toBe(100);
  });
});

/* ───────────────────────── 3. reminders (pure) ───────────────────────── */

describe("return request reminders (no database)", () => {
  const t0 = new Date("2026-11-20T10:00:00Z");
  const at = (hours) => new Date(t0.getTime() + hours * 3600 * 1000);
  it("seller reminders at 24h and 40h, the admin is told at 48h and again every day", () => {
    expect(getRequestStage(t0, at(1))).toBe(0);
    expect(getRequestStage(t0, at(23.9))).toBe(0);
    expect(getRequestStage(t0, at(24))).toBe(1);
    expect(getRequestStage(t0, at(39))).toBe(1);
    expect(getRequestStage(t0, at(41))).toBe(2);
    expect(getRequestStage(t0, at(48))).toBe(3);
    expect(getRequestStage(t0, at(71))).toBe(3);
    expect(getRequestStage(t0, at(72))).toBe(4);
    expect(getRequestStage(t0, at(96))).toBe(5);
    expect(getRequestStage(null, at(500))).toBe(0);
  });
});

/* ───────────────────────── real database ───────────────────────── */

const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);
const HOUR = 3600 * 1000;

(RUN ? describe : describe.skip)("coupon refund / weight charge / return request reminders - real DB", () => {
  let customer, seller, header, seq = 0;
  const settings = {
    customerPricingType: "distance", customerBaseDistance: 2, customerBaseCharge: 30, customerExtraPerKm: 10,
    riderEarningType: "distance", riderBaseDistance: 2, riderBaseEarning: 20, riderExtraPerKm: 6,
  };
  const wallet = (type, id = null) => Wallet.findOne({ ownerType: type, ownerId: id }).lean();
  const sellerPayout = (o) => Payout.findOne({ relatedOrderIds: o._id, payoutType: "SELLER" }).lean();

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `fixes_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });
  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    customer = await User.create({ name: "Rahul", phone: `90000${s.slice(-5)}`, role: "user", isVerified: true });
    seller = await Seller.create({ name: "S", email: `s_${s}@example.com`, phone: `91000${s.slice(-5)}`, password: "Password@123", shopName: "Shop", pincode: "452001", isVerified: true, isActive: true, applicationStatus: "approved", location: { type: "Point", coordinates: [75.87, 22.71] } });
    header = await Category.create({ name: "Electronics", slug: `el-${s}`, type: "header", adminCommissionType: "percentage", adminCommissionValue: 10, adminCommission: 10, handlingFeeType: "fixed", handlingFeeValue: 5, handlingFees: 5 });
  });
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  /** A real priced order (through the pricing code) that has been paid and delivered. */
  async function deliveredOrder({ items = [{ name: "Phone", price: 1000, quantity: 1 }], discount = 0, fulfillment = "SHIPROCKET", settle = true } = {}) {
    seq += 1;
    const prepared = items.map((i) => ({ ...i, productId: new mongoose.Types.ObjectId() }));
    const breakdown = await generateOrderPaymentBreakdown({
      preHydratedItems: prepared.map((i) => ({ productId: String(i.productId), productName: i.name, quantity: i.quantity, price: i.price, headerCategoryId: String(header._id), sellerId: String(seller._id) })),
      distanceKm: 3, discountTotal: discount, deliverySettings: settings, handlingFeeStrategy: "highest_category_fee",
      fulfillmentType: fulfillment, courierDeliveryFee: fulfillment === "SHIPROCKET" ? 60 : null,
    });
    const o = await Order.create({
      orderId: `ORD-FX-${Date.now()}-${seq}`, customer: customer._id, seller: seller._id,
      items: prepared.map((i) => ({ product: i.productId, name: i.name, quantity: i.quantity, price: i.price })),
      address: { name: "R", address: "x", city: "Indore", state: "MP", pincode: "452001", phone: "9876543210" },
      paymentMode: "ONLINE", paymentStatus: "CREATED", status: "out_for_delivery", orderStatus: "out_for_delivery",
      workflowVersion: 2, workflowStatus: "OUT_FOR_DELIVERY", fulfillmentType: fulfillment,
    });
    fin.freezeFinancialSnapshot(o, breakdown);
    await o.save();
    await fin.handleOnlineOrderFinance(o._id, { transactionId: "pay_x" });
    if (settle) await fin.settleDeliveredOrder(o._id);
    return Order.findById(o._id).lean();
  }

  /* ── 1. coupon ── */
  describe("1. the coupon share is not refunded", () => {
    async function refund(o, returnedIdx, fault = "customer") {
      const returnItems = returnedIdx.map((idx) => ({ product: o.items[idx].product, name: o.items[idx].name, itemIndex: idx, quantity: o.items[idx].quantity, price: o.items[idx].price, status: "approved" }));
      await Order.updateOne({ _id: o._id }, { $set: { returnStatus: "qc_passed", returnFault: fault, returnDeliveryCommission: 25, returnItems, returnRefundAmount: 99999 } });
      await OrderReturnService.completeReturnAndRefund(await Order.findById(o._id));
      return Order.findById(o._id).lean();
    }

    it("₹100 coupon on a ₹1000 item: the wallet gets ₹900 (not ₹1000); the seller gives back ₹900; the order records both numbers", async () => {
      const o = await deliveredOrder({ discount: 100 });
      expect(o.paymentBreakdown.discountTotal).toBe(100);
      const done = await refund(o, [0]);
      expect((await wallet("CUSTOMER", customer._id)).availableBalance).toBe(900);
      expect(done.returnRefundAmount).toBe(900);
      expect(done.returnFinance).toMatchObject({ refundAmount: 900, itemValue: 1000, discountShare: 100, sellerShare: 900 });
      expect((await sellerPayout(o)).status).toBe("CANCELLED"); // the seller's whole payout was still on hold
    });

    it("no coupon: ₹1000 as before", async () => {
      const o = await deliveredOrder({ discount: 0 });
      await refund(o, [0]);
      expect((await wallet("CUSTOMER", customer._id)).availableBalance).toBe(1000);
    });

    it("partial return with a coupon: only that item's share (₹150 coupon, ₹500 item returned -> ₹450)", async () => {
      const o = await deliveredOrder({ items: [{ name: "Phone", price: 1000, quantity: 1 }, { name: "Case", price: 500, quantity: 1 }], discount: 150 });
      const done = await refund(o, [1]);
      expect((await wallet("CUSTOMER", customer._id)).availableBalance).toBe(450);
      expect(done.returnFinance).toMatchObject({ itemValue: 500, discountShare: 50, refundAmount: 450 });
      const payout = await sellerPayout(o);
      expect(payout.status).toBe("PENDING");
      expect(payout.amount).toBe(1350 - 450); // the seller's payout loses what they earned on the case (₹450)
    });

    it("approving the return already shows the right refund amount", async () => {
      const o = await deliveredOrder({ discount: 100 });
      await Order.updateOne({ _id: o._id }, { $set: { returnStatus: "return_requested", returnFault: "customer", returnItems: [{ product: o.items[0].product, name: "Phone", itemIndex: 0, quantity: 1, price: 1000, status: "requested" }] } });
      const approved = await OrderReturnService.approveReturn(o.orderId, "admin-1", "admin");
      expect(["return_approved", "return_pickup_assigned"]).toContain(approved.returnStatus);
      expect(approved.returnRefundAmount).toBe(900);
    });
  });

  /* ── 2. weight charge ── */
  describe("2. a courier weight charge that arrives after delivery is taken from the seller", () => {
    it("payout still waiting: it is made smaller (₹900 -> ₹820), and repeating the same charge changes nothing", async () => {
      const o = await deliveredOrder();
      expect((await sellerPayout(o)).amount).toBe(900);
      const res = await recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: 80, reason: "Heavier than entered" });
      expect(res.applied).toMatchObject({ delta: 80, fromPayout: 80, fromWallet: 0, owed: 0 });
      expect((await sellerPayout(o)).amount).toBe(820);
      expect((await wallet("SELLER", seller._id)).pendingBalance).toBe(820);
      expect((await Order.findById(o._id).lean()).shiprocket.weightDiscrepancyApplied).toBe(80);
      await recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: 80 });
      expect((await sellerPayout(o)).amount).toBe(820);
    });

    it("the admin changes the amount: only the difference is taken (₹80 -> ₹100 takes ₹20 more)", async () => {
      const o = await deliveredOrder();
      await recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: 80 });
      const res = await recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: 100 });
      expect(res.applied.delta).toBe(20);
      expect((await sellerPayout(o)).amount).toBe(800);
    });

    it("waived by the admin (0): the money goes back INTO the waiting payout", async () => {
      const o = await deliveredOrder();
      await recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: 80 });
      const res = await recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: 0 });
      expect(res.message).toMatch(/waived/);
      expect(res.applied).toMatchObject({ delta: -80, returned: 80 });
      expect((await sellerPayout(o)).amount).toBe(900);
      expect((await wallet("SELLER", seller._id)).pendingBalance).toBe(900);
      expect((await Order.findById(o._id).lean()).shiprocket.weightDiscrepancyApplied).toBe(0);
    });

    it("0 on an order with no charge is refused", async () => {
      const o = await deliveredOrder();
      await expect(recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: 0 })).rejects.toThrow(/positive/);
      await expect(recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: -5 })).rejects.toThrow(/positive/);
    });

    it("payout already PAID: taken from the seller's wallet", async () => {
      const o = await deliveredOrder();
      await processPayout((await sellerPayout(o))._id);
      expect((await wallet("SELLER", seller._id)).availableBalance).toBe(900);
      const res = await recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: 80 });
      expect(res.applied).toMatchObject({ fromPayout: 0, fromWallet: 80, owed: 0 });
      expect((await wallet("SELLER", seller._id)).availableBalance).toBe(820);
      const led = await LedgerEntry.find({ type: "SELLER_WEIGHT_PENALTY" }).lean();
      expect(led).toHaveLength(1);
      expect(led[0]).toMatchObject({ amount: 80, direction: "DEBIT", actorType: "SELLER" });
    });

    it("payout already paid and the wallet is short: what it holds is taken and the rest is owed (taken from the next payout)", async () => {
      const o = await deliveredOrder();
      await processPayout((await sellerPayout(o))._id);
      await Wallet.updateOne({ ownerType: "SELLER", ownerId: seller._id }, { $set: { availableBalance: 50 } });
      const res = await recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: 80 });
      expect(res.applied).toMatchObject({ fromWallet: 50, owed: 30 });
      const w = await wallet("SELLER", seller._id);
      expect(w.availableBalance).toBe(0);
      expect(w.recoverableDue).toBe(30);
      // the next order's payout pays the debt first
      const next = await deliveredOrder();
      expect((await sellerPayout(next)).amount).toBe(870);
      expect((await wallet("SELLER", seller._id)).recoverableDue).toBe(0);
    });

    it("waived after the payout was paid: the seller's wallet gets it back", async () => {
      const o = await deliveredOrder();
      await processPayout((await sellerPayout(o))._id);
      await recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: 80 });
      await recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: 0 });
      expect((await wallet("SELLER", seller._id)).availableBalance).toBe(900);
      expect(await LedgerEntry.countDocuments({ type: "SELLER_WEIGHT_PENALTY_REVERSED" })).toBe(1);
    });

    it("recorded BEFORE delivery: nothing happens yet, the payout is created already reduced, and it is not taken twice", async () => {
      const o = await deliveredOrder({ settle: false });
      const res = await recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: 80 });
      expect(res.applied.skipped).toBe(true);
      expect(await sellerPayout(o)).toBeNull();
      await fin.settleDeliveredOrder(o._id);
      expect((await sellerPayout(o)).amount).toBe(820);
      expect((await Order.findById(o._id).lean()).shiprocket.weightDiscrepancyApplied).toBe(80);
      const again = await recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: 80 });
      expect(again.applied.delta).toBe(0);
      expect((await sellerPayout(o)).amount).toBe(820);
    });

    it("a charge larger than the whole waiting payout cancels it and the remainder is owed", async () => {
      const o = await deliveredOrder();
      const res = await recordShiprocketWeightDiscrepancy(o.orderId, { discrepancyAmount: 1000 });
      expect(res.applied.fromPayout).toBe(900);
      expect(res.applied.owed).toBe(100);
      expect((await sellerPayout(o)).status).toBe("CANCELLED");
      expect((await wallet("SELLER", seller._id)).recoverableDue).toBe(100);
    });
  });

  /* ── 3. unanswered return requests ── */
  describe("3. a return request nobody answers: reminders, never an automatic approval", () => {
    async function request(hoursAgo) {
      const o = await deliveredOrder();
      await Order.updateOne({ _id: o._id }, { $set: { returnStatus: "return_requested", returnRequestedAt: new Date(Date.now() - hoursAgo * HOUR), returnItems: [{ product: o.items[0].product, name: "Phone", itemIndex: 0, quantity: 1, price: 1000, status: "requested" }] } });
      return o;
    }
    const stage = async (o) => (await Order.findById(o._id).lean()).returnRequestReminderStage;
    const status = async (o) => (await Order.findById(o._id).lean()).returnStatus;

    it("each reminder is sent once as time passes", async () => {
      const young = await request(5);
      const day = await request(25);
      const late = await request(41);
      const due = await request(49);
      const s1 = await sweepReturnRequests();
      expect(s1).toMatchObject({ checked: 4, reminded: 2, escalated: 1 });
      expect(await stage(young)).toBe(0);
      expect(await stage(day)).toBe(1);
      expect(await stage(late)).toBe(2);
      expect(await stage(due)).toBe(3);
      const s2 = await sweepReturnRequests(); // nothing new
      expect(s2).toMatchObject({ reminded: 0, escalated: 0 });
    });

    it("the admin is reminded again every day", async () => {
      const o = await request(49);
      await sweepReturnRequests();
      expect(await stage(o)).toBe(3);
      await Order.updateOne({ _id: o._id }, { $set: { returnRequestedAt: new Date(Date.now() - 73 * HOUR) } });
      expect((await sweepReturnRequests()).escalated).toBe(1);
      expect(await stage(o)).toBe(4);
    });

    it("it is NEVER approved automatically, however long it waits; the seller's payout stays on hold meanwhile", async () => {
      const o = await request(24 * 30);
      await sweepReturnRequests();
      expect(await status(o)).toBe("return_requested");
      expect((await Order.findById(o._id).lean()).settlementStatus.sellerPayout).toBe("HOLD");
    });

    it("answered requests are left alone", async () => {
      const o = await request(60);
      await Order.updateOne({ _id: o._id }, { $set: { returnStatus: "return_approved" } });
      expect((await sweepReturnRequests()).checked).toBe(0);
      expect(await stage(o)).toBe(0);
    });
  });
});
