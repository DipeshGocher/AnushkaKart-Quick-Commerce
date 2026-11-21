import mongoose from "mongoose";
import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import Order from "../app/models/order.js";
import User from "../app/models/customer.js";
import Seller from "../app/models/seller.js";
import Delivery from "../app/models/delivery.js";
import Category from "../app/models/category.js";
import Product from "../app/models/product.js";
import Wallet from "../app/models/wallet.js";
import Payout from "../app/models/payout.js";
import Transaction from "../app/models/transaction.js";
import LedgerEntry from "../app/models/ledgerEntry.js";
import StockHistory from "../app/models/stockHistory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
delete process.env.RETURN_WINDOW_MINUTES;

const { computePlatformEarning } = await import("../app/utils/platformEarning.js");
const { extractFreight } = await import("../app/utils/freight.js");
const { computeReturnMoney, buildReturnMoneyView } = await import("../app/services/order/returnMoney.js");
const fin = await import("../app/services/finance/orderFinanceService.js");
const { generateOrderPaymentBreakdown } = await import("../app/services/finance/pricingService.js");
const { default: OrderReturnService } = await import("../app/services/order/orderReturnService.js");
const { createReturnPickupRiderPayout } = await import("../app/services/finance/returnPickupPayoutService.js");
const { recordFreight } = await import("../app/services/finance/freightService.js");
const { bulkProcessPayouts } = await import("../app/services/finance/payoutService.js");
const { getAdminFinanceSummary } = await import("../app/services/finance/walletService.js");
const { default: ReturnQcService } = await import("../app/services/order/returnQcService.js");
const { applyDeliveredSettlement } = await import("../app/services/orderSettlement.js");

jest.setTimeout(120000);

/* ───────────────────────── pure ───────────────────────── */

describe("platform earning (no database)", () => {
  const base = ({ paymentBreakdown = {}, ...rest } = {}) => ({
    fulfillmentType: "LOCAL", paymentMode: "ONLINE",
    paymentBreakdown: { adminProductCommissionTotal: 100, deliveryFeeCharged: 50, handlingFeeCharged: 5, riderPayoutTotal: 32, discountTotal: 0, ...paymentBreakdown },
    ...rest,
  });

  it("local order: commission + fees - rider commission", () => {
    expect(computePlatformEarning(base()).net).toBe(123);
  });

  it("a coupon is a cost of the platform", () => {
    const e = computePlatformEarning(base({ paymentBreakdown: { discountTotal: 100 } }));
    expect(e.net).toBe(23);
    expect(e.parts.couponCost).toBe(-100);
  });

  it("courier order: the freight is a cost; an estimate (the fee charged) until the real figure is known", () => {
    const o = { fulfillmentType: "SHIPROCKET", paymentMode: "ONLINE", paymentBreakdown: { adminProductCommissionTotal: 100, deliveryFeeCharged: 60, courierDeliveryFee: 60, handlingFeeCharged: 5, riderPayoutTotal: 0 } };
    const est = computePlatformEarning(o);
    expect(est.net).toBe(105);
    expect(est.parts.freightEstimated).toBe(true);
    const real = computePlatformEarning({ ...o, shiprocket: { freightCharge: 80 } });
    expect(real.net).toBe(85);
    expect(real.parts.freightEstimated).toBe(false);
    expect(computePlatformEarning({ ...o, shiprocket: { freightCharge: 0 } }).net).toBe(165);
  });

  it("cash orders earn the same (counted at delivery); the cash still to come is shown separately", () => {
    const e = computePlatformEarning(base({ paymentMode: "COD", paymentBreakdown: { codPendingAmount: 900 } }));
    expect(e.net).toBe(123);
    expect(e.parts.cashPending).toBe(900);
  });

  it("a return: the commission and the coupon share are undone, the pickup is a cost (platform pays)", () => {
    const o = base({
      paymentBreakdown: { discountTotal: 100 },
      returnFinance: { appliedAt: new Date(), adminCommissionReversed: 100, discountShare: 100, pickupFee: 25, pickupFeePayer: "platform" },
    });
    expect(computePlatformEarning(o).net).toBe(-2); // fees 55 - rider 32 - pickup 25
  });

  it("a return that was the seller's fault: the seller pays the pickup, so it costs the platform nothing", () => {
    const o = base({ returnFinance: { appliedAt: new Date(), adminCommissionReversed: 100, discountShare: 0, pickupFee: 25, pickupFeePayer: "seller" } });
    expect(computePlatformEarning(o).net).toBe(23);
  });

  it("courier return freight: the real figure replaces the one known at refund time; only what was taken from the seller is recovered", () => {
    const o = {
      fulfillmentType: "SHIPROCKET", paymentMode: "ONLINE",
      paymentBreakdown: { adminProductCommissionTotal: 100, deliveryFeeCharged: 60, courierDeliveryFee: 60, handlingFeeCharged: 5 },
      shiprocket: { freightCharge: 60 },
      returnFinance: { appliedAt: new Date(), adminCommissionReversed: 100, discountShare: 0, pickupFee: 0, pickupFeePayer: "seller" },
      returnFreightCharge: 90, returnFreightApplied: 90,
    };
    expect(computePlatformEarning(o).net).toBe(5); // 105 - 60 ... : 100+60+5-60 = 105; -100 commission; -90 freight; +90 recovered = 5
    expect(computePlatformEarning({ ...o, returnFreightApplied: 0 }).net).toBe(-85);
  });
});

describe("courier freight from Shiprocket's answers", () => {
  it("finds the charge under the usual names and ignores junk", () => {
    expect(extractFreight({ freight_charges: 87.5 })).toBe(87.5);
    expect(extractFreight({ response: { data: { freight_charge: "92" } } })).toBe(92);
    expect(extractFreight({ data: { rate: 70 } })).toBe(70);
    expect(extractFreight({ freight_charges: -5 })).toBeNull();
    expect(extractFreight({ freight_charges: "abc" })).toBeNull();
    expect(extractFreight({})).toBeNull();
    expect(extractFreight(null)).toBeNull();
  });
});

describe("return money for a courier return (no database)", () => {
  const courier = (over = {}) => ({
    fulfillmentType: "SHIPROCKET", paymentMode: "ONLINE", returnFault: "seller", returnDeliveryCommission: 25,
    items: [{ product: "p1", quantity: 1, price: 1000 }],
    paymentBreakdown: { productSubtotal: 1000, sellerPayoutTotal: 900, adminProductCommissionTotal: 100, lineItems: [{ productId: "p1", quantity: 1, itemSubtotal: 1000, sellerPayout: 900, adminProductCommission: 100 }] },
    financeFlags: { adminEarningCredited: true },
    returnItems: [{ product: "p1", itemIndex: 0, quantity: 1, price: 1000 }],
    ...over,
  });
  it("the flat ₹25 is NOT used: freight unknown means 0 for now and 'pending'", () => {
    const m = computeReturnMoney(courier());
    expect(m.pickupFee).toBe(0);
    expect(m.freightPending).toBe(true);
    expect(m.sellerCharged).toBe(900);
    expect(buildReturnMoneyView(courier({ returnStatus: "returned" }), { role: "admin" }).freightPending).toBe(true);
  });
  it("with the real freight known, the seller pays it when it was their fault, the platform otherwise", () => {
    expect(computeReturnMoney(courier({ returnFreightCharge: 90 }))).toMatchObject({ pickupFee: 90, pickupFeePayer: "seller", sellerCharged: 990, freightPending: false });
    expect(computeReturnMoney(courier({ returnFreightCharge: 90, returnFault: "customer" }))).toMatchObject({ pickupFee: 90, pickupFeePayer: "platform", sellerCharged: 900 });
  });
  it("a local return still uses the rider's commission", () => {
    expect(computeReturnMoney(courier({ fulfillmentType: "LOCAL" })).pickupFee).toBe(25);
  });
});

/* ───────────────────────── real database ───────────────────────── */

const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);

(RUN ? describe : describe.skip)("the five fixes - real DB", () => {
  let customer, seller, rider, header, category, subcategory, seq = 0;
  const settings = {
    customerPricingType: "distance", customerBaseDistance: 2, customerBaseCharge: 30, customerExtraPerKm: 10,
    riderEarningType: "distance", riderBaseDistance: 2, riderBaseEarning: 20, riderExtraPerKm: 6,
  };
  const wallet = (type, id = null) => Wallet.findOne({ ownerType: type, ownerId: id }).lean();
  const reload = (o) => Order.findById(o._id).lean();
  const sellerPayout = (o) => Payout.findOne({ relatedOrderIds: o._id, payoutType: "SELLER" }).lean();
  const setAdminWallet = (availableBalance) => Wallet.findOneAndUpdate({ ownerType: "ADMIN", ownerId: null }, { $set: { availableBalance } }, { upsert: true, new: true });

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `five_fixes_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });
  beforeEach(async () => {
    // importing the app re-reads .env, which may carry old return-window variables: use the built-in 4 hours
    delete process.env.RETURN_WINDOW_MINUTES;
    delete process.env.LOCAL_RETURN_WINDOW_MINUTES;
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    customer = await User.create({ name: "Rahul", phone: `90000${s.slice(-5)}`, role: "user", isVerified: true });
    seller = await Seller.create({ name: "S", email: `s_${s}@example.com`, phone: `91000${s.slice(-5)}`, password: "Password@123", shopName: "Shop", pincode: "452001", isVerified: true, isActive: true, applicationStatus: "approved", location: { type: "Point", coordinates: [75.87, 22.71] } });
    rider = await Delivery.create({ name: "Ravi", phone: `92000${s.slice(-5)}`, password: "Password@123", isVerified: true, isActive: true });
    header = await Category.create({ name: "Electronics", slug: `el-${s}`, type: "header", adminCommissionType: "percentage", adminCommissionValue: 10, adminCommission: 10, handlingFeeType: "fixed", handlingFeeValue: 5, handlingFees: 5 });
    category = await Category.create({ name: `C ${s}`, slug: `c-${s}`, type: "category", parentId: header._id, status: "active" });
    subcategory = await Category.create({ name: `S ${s}`, slug: `s-${s}`, type: "subcategory", parentId: category._id, status: "active" });
  });
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  async function product(stock = 10) {
    seq += 1;
    return Product.create({
      name: `Phone ${seq}`, slug: `phone-${Date.now()}-${seq}`, sku: `SKU-${Date.now()}-${seq}`, description: "x", price: 1000, salePrice: 1000, stock,
      headerId: header._id, categoryId: category._id, subcategoryId: subcategory._id, sellerId: seller._id, status: "active",
    });
  }

  /** A paid, delivered order priced by the real pricing code. */
  async function delivered({ paymentMode = "ONLINE", fulfillment = "LOCAL", discount = 0, withRider = true, prod = null } = {}) {
    seq += 1;
    const p = prod || (await product(10));
    const breakdown = await generateOrderPaymentBreakdown({
      preHydratedItems: [{ productId: String(p._id), productName: p.name, quantity: 1, price: 1000, headerCategoryId: String(header._id), sellerId: String(seller._id) }],
      distanceKm: 4, discountTotal: discount, deliverySettings: settings, handlingFeeStrategy: "highest_category_fee",
      fulfillmentType: fulfillment, courierDeliveryFee: fulfillment === "SHIPROCKET" ? 60 : null,
    });
    const o = await Order.create({
      orderId: `ORD-5F-${Date.now()}-${seq}`, customer: customer._id, seller: seller._id,
      items: [{ product: p._id, name: p.name, quantity: 1, price: 1000 }],
      address: { name: "R", address: "x", city: "Indore", state: "MP", pincode: "452001", phone: "9876543210" },
      paymentMode, paymentStatus: "CREATED", status: "out_for_delivery", orderStatus: "out_for_delivery",
      workflowVersion: 2, workflowStatus: "OUT_FOR_DELIVERY", fulfillmentType: fulfillment,
      ...(withRider && fulfillment === "LOCAL" ? { deliveryBoy: rider._id, deliveryPartner: rider._id } : {}),
      deliveredAt: new Date(Date.now() - 3600 * 1000),
    });
    fin.freezeFinancialSnapshot(o, breakdown);
    await o.save();
    if (paymentMode === "ONLINE") await fin.handleOnlineOrderFinance(o._id, { transactionId: "pay_x" });
    await applyDeliveredSettlement(await Order.findById(o._id), o.orderId);
    return reload(o);
  }

  /* ── 2. return pickup commission as a payout ── */
  describe("2. the rider's return pickup commission is a payout (ledger, once)", () => {
    async function pickedUp() {
      const o = await delivered();
      await Order.updateOne({ _id: o._id }, { $set: { returnStatus: "return_in_transit", returnDeliveryBoy: rider._id, returnDeliveryCommission: 25, returnFault: "customer", returnItems: [{ product: o.items[0].product, name: "Phone", itemIndex: 0, quantity: 1, price: 1000, status: "approved" }] } });
      return reload(o);
    }

    it("creates one pending payout (separate from the delivery payout), a ledger row, an earnings row, and the flag", async () => {
      const o = await pickedUp();
      const p = await createReturnPickupRiderPayout(o);
      expect(p).toMatchObject({ payoutType: "DELIVERY_PARTNER", amount: 25, status: "PENDING" });
      const all = await Payout.find({ relatedOrderIds: o._id, payoutType: "DELIVERY_PARTNER" }).lean();
      expect(all).toHaveLength(2); // the delivery commission and this one
      expect(all.map((x) => x.metadata.flow).sort()).toEqual(["order_delivered", "return_pickup"]);
      expect(await LedgerEntry.countDocuments({ orderId: o._id, type: "RIDER_PAYOUT_PENDING", amount: 25 })).toBe(1);
      expect(await Transaction.countDocuments({ reference: `RET-PICK-${o.orderId}` })).toBe(1);
      expect((await reload(o)).financeFlags.returnPickupCommissionPaid).toBe(true);
      // NOT credited straight to the wallet
      expect((await wallet("DELIVERY_PARTNER", rider._id)).availableBalance).toBe(0);
    });

    it("calling it again (a retry, a crash and restart) never pays twice", async () => {
      const o = await pickedUp();
      await createReturnPickupRiderPayout(o);
      await createReturnPickupRiderPayout(await reload(o));
      await createReturnPickupRiderPayout(await reload(o));
      expect(await Payout.countDocuments({ relatedOrderIds: o._id, "metadata.flow": "return_pickup" })).toBe(1);
      expect(await Transaction.countDocuments({ reference: `RET-PICK-${o.orderId}` })).toBe(1);
      expect((await wallet("DELIVERY_PARTNER", rider._id)).pendingBalance).toBe(32 + 25);
    });

    it("the payout job pays it into the rider's wallet and the admin wallet goes down", async () => {
      await setAdminWallet(100000);
      const o = await pickedUp();
      await createReturnPickupRiderPayout(o);
      await bulkProcessPayouts({ limit: 50 });
      expect((await wallet("DELIVERY_PARTNER", rider._id)).availableBalance).toBe(32 + 25);
      expect((await wallet("ADMIN")).availableBalance).toBe(100000 + 1055 - 57); // payment captured +1055, two payouts out
    });

    it("the refund step is the safety net: it creates the payout only if it was not created at pickup, and never credits the wallet directly", async () => {
      const o = await pickedUp();
      await OrderReturnService.completeReturnAndRefund((await Order.findByIdAndUpdate(o._id, { $set: { returnStatus: "qc_passed", returnRefundAmount: 1000 } }, { new: true })));
      expect(await Payout.countDocuments({ relatedOrderIds: o._id, "metadata.flow": "return_pickup" })).toBe(1);
      expect((await wallet("DELIVERY_PARTNER", rider._id)).availableBalance).toBe(0);
    });

    it("nothing is created without a rider or a commission (courier returns)", async () => {
      const o = await pickedUp();
      expect(await createReturnPickupRiderPayout({ ...o, returnDeliveryBoy: null })).toBeNull();
      expect(await createReturnPickupRiderPayout({ ...o, returnDeliveryCommission: 0 })).toBeNull();
      expect(await Payout.countDocuments({ "metadata.flow": "return_pickup" })).toBe(0);
    });
  });

  /* ── 1. courier return freight ── */
  describe("1. a courier return: the REAL freight, not a flat ₹25", () => {
    async function courierReturn({ fault = "seller", freight = null } = {}) {
      const o = await delivered({ fulfillment: "SHIPROCKET", withRider: false });
      const set = { returnStatus: "qc_passed", returnFault: fault, returnDeliveryCommission: 25, returnRefundAmount: 1000, returnItems: [{ product: o.items[0].product, name: "Phone", itemIndex: 0, quantity: 1, price: 1000, status: "approved" }] };
      if (freight !== null) set.returnFreightCharge = freight;
      await Order.updateOne({ _id: o._id }, { $set: set });
      await OrderReturnService.completeReturnAndRefund(await Order.findById(o._id));
      return reload(o);
    }

    it("seller's fault, freight NOT known at refund time: the seller is not charged ₹25; it is charged later when the freight is recorded", async () => {
      await setAdminWallet(100000);
      const o = await courierReturn({ fault: "seller" });
      expect(o.returnFinance).toMatchObject({ pickupFee: 0, pickupFeePayer: "seller", sellerCharged: 900 });
      expect((await sellerPayout(o)).status).toBe("CANCELLED"); // the whole payout was still on hold
      const rec = await recordFreight(o.orderId, { type: "reverse", amount: 90 });
      expect(rec.applied).toMatchObject({ delta: 90, owed: 90 }); // the payout is gone and the wallet is empty: the seller owes it
      const after = await reload(o);
      expect(after).toMatchObject({ returnFreightCharge: 90, returnFreightApplied: 90, returnFreightSource: "admin" });
      expect(after.returnFinance.pickupFee).toBe(90);
      expect(after.returnFinance.sellerCharged).toBe(990);
      expect((await wallet("SELLER", seller._id)).recoverableDue).toBe(90);
      expect(await LedgerEntry.countDocuments({ type: "RETURN_RECOVERY_DUE", orderId: o._id })).toBeGreaterThanOrEqual(1);
    });

    it("recording the same freight again does nothing; a lower figure gives the difference back", async () => {
      await setAdminWallet(100000);
      const o = await courierReturn({ fault: "seller" });
      await recordFreight(o.orderId, { type: "reverse", amount: 90 });
      const again = await recordFreight(o.orderId, { type: "reverse", amount: 90 });
      expect(again.applied.delta).toBe(0);
      expect((await wallet("SELLER", seller._id)).recoverableDue).toBe(90);
      const lower = await recordFreight(o.orderId, { type: "reverse", amount: 70 });
      expect(lower.applied).toMatchObject({ delta: -20, returned: 20 });
      expect((await wallet("SELLER", seller._id)).availableBalance).toBe(20);
      expect(await LedgerEntry.countDocuments({ type: "SELLER_RETURN_FREIGHT_REVERSED" })).toBe(1);
    });

    it("freight known BEFORE the refund: the seller pays it at the refund", async () => {
      const o = await courierReturn({ fault: "seller", freight: 90 });
      expect(o.returnFinance).toMatchObject({ pickupFee: 90, pickupFeePayer: "seller", sellerCharged: 990 });
      expect(o.returnFreightApplied).toBe(90);
    });

    it("customer's fault: the platform pays the freight, the seller is never charged for it", async () => {
      const o = await courierReturn({ fault: "customer" });
      expect(o.returnFinance.pickupFeePayer).toBe("platform");
      const rec = await recordFreight(o.orderId, { type: "reverse", amount: 90 });
      expect(rec.applied.skipped).toBe(true);
      expect((await wallet("SELLER", seller._id))?.recoverableDue || 0).toBe(0);
      expect((await reload(o)).platformEarning.parts.returnPickupCost).toBe(-90);
    });

    it("the seller's payout is reduced (not cancelled) when the return was a partial one and the payout is still waiting", async () => {
      // two-item order: only one item returned, so a payout remains
      const p1 = await product(); const p2 = await product();
      seq += 1;
      const breakdown = await generateOrderPaymentBreakdown({
        preHydratedItems: [
          { productId: String(p1._id), productName: "A", quantity: 1, price: 1000, headerCategoryId: String(header._id), sellerId: String(seller._id) },
          { productId: String(p2._id), productName: "B", quantity: 1, price: 500, headerCategoryId: String(header._id), sellerId: String(seller._id) },
        ],
        distanceKm: 4, deliverySettings: settings, handlingFeeStrategy: "highest_category_fee", fulfillmentType: "SHIPROCKET", courierDeliveryFee: 60,
      });
      const o = await Order.create({
        orderId: `ORD-5F-P-${Date.now()}`, customer: customer._id, seller: seller._id,
        items: [{ product: p1._id, name: "A", quantity: 1, price: 1000 }, { product: p2._id, name: "B", quantity: 1, price: 500 }],
        address: { name: "R", address: "x", city: "Pune", state: "MH", pincode: "411001", phone: "9876543210" },
        paymentMode: "ONLINE", status: "out_for_delivery", orderStatus: "out_for_delivery", workflowVersion: 2, workflowStatus: "OUT_FOR_DELIVERY", fulfillmentType: "SHIPROCKET",
      });
      fin.freezeFinancialSnapshot(o, breakdown);
      await o.save();
      await fin.handleOnlineOrderFinance(o._id, { transactionId: "pay_p" });
      await applyDeliveredSettlement(await Order.findById(o._id), o.orderId);
      await Order.updateOne({ _id: o._id }, { $set: { returnStatus: "qc_passed", returnFault: "seller", returnItems: [{ product: p2._id, name: "B", itemIndex: 1, quantity: 1, price: 500, status: "approved" }], returnRefundAmount: 500 } });
      await OrderReturnService.completeReturnAndRefund(await Order.findById(o._id));
      const before = (await sellerPayout(o)).amount; // 1350 - 450
      expect(before).toBe(900);
      const rec = await recordFreight(o.orderId, { type: "reverse", amount: 80 });
      expect(rec.applied).toMatchObject({ fromPayout: 80, fromWallet: 0, owed: 0 });
      expect((await sellerPayout(o)).amount).toBe(820);
    });

    it("bad input and wrong orders are refused", async () => {
      const o = await courierReturn({ fault: "seller" });
      await expect(recordFreight(o.orderId, { type: "reverse", amount: -1 })).rejects.toThrow(/freight amount/);
      await expect(recordFreight(o.orderId, { type: "reverse", amount: "abc" })).rejects.toThrow(/freight amount/);
      await expect(recordFreight(o.orderId, { type: "sideways", amount: 5 })).rejects.toThrow(/forward/);
      await expect(recordFreight("ORD-NOPE", { type: "reverse", amount: 5 })).rejects.toThrow(/not found/);
      const local = await delivered();
      await expect(recordFreight(local.orderId, { type: "reverse", amount: 5 })).rejects.toThrow(/not a courier/);
    });
  });

  /* ── 3. platform earning ── */
  describe("3. the platform's earning is what it really earns", () => {
    it("local online order: stored at delivery; a coupon order earns ₹100 less", async () => {
      const plain = await delivered();
      expect(plain.platformEarning.net).toBe(123);
      const coupon = await delivered({ discount: 100 });
      expect(coupon.platformEarning.net).toBe(23);
    });

    it("courier order: the delivery fee is not pure profit; recording the real freight corrects it", async () => {
      const o = await delivered({ fulfillment: "SHIPROCKET", withRider: false });
      expect(o.platformEarning.net).toBe(105);
      expect(o.platformEarning.parts.freightEstimated).toBe(true);
      const rec = await recordFreight(o.orderId, { type: "forward", amount: 80 });
      expect(rec.earning.net).toBe(85);
      expect((await reload(o)).platformEarning).toMatchObject({ net: 85 });
      expect((await reload(o)).shiprocket.freightCharge).toBe(80);
    });

    it("cash order: the earning is counted at delivery (ledger row marked cash-pending), same figure as online", async () => {
      const o = await delivered({ paymentMode: "COD" });
      expect(o.platformEarning.net).toBe(123);
      expect(o.financeFlags.adminEarningBooked).toBe(true);
      const led = await LedgerEntry.find({ orderId: o._id, type: "ADMIN_EARNING_CREDITED" }).lean();
      expect(led).toHaveLength(1);
      expect(led[0].metadata).toMatchObject({ cashPending: true });
    });

    it("a refunded return updates it: commission and coupon share undone, the pickup a cost", async () => {
      const o = await delivered({ discount: 100 });
      expect(o.platformEarning.net).toBe(23);
      await Order.updateOne({ _id: o._id }, { $set: { returnStatus: "qc_passed", returnFault: "customer", returnDeliveryCommission: 25, returnItems: [{ product: o.items[0].product, name: "Phone", itemIndex: 0, quantity: 1, price: 1000, status: "approved" }] } });
      await OrderReturnService.completeReturnAndRefund(await Order.findById(o._id));
      const after = await reload(o);
      expect(after.status).toBe("returned");
      expect(after.platformEarning.net).toBe(-2);
      expect((await wallet("CUSTOMER", customer._id)).availableBalance).toBe(900);
    });

    it("the admin report adds up the NET earning (delivered and returned orders), and shows the cash still to come", async () => {
      await delivered(); // 123
      await delivered({ discount: 100 }); // 23
      const returned = await delivered({ discount: 100 }); // 23 -> -2 after the return
      await Order.updateOne({ _id: returned._id }, { $set: { returnStatus: "qc_passed", returnFault: "customer", returnDeliveryCommission: 25, returnItems: [{ product: returned.items[0].product, name: "Phone", itemIndex: 0, quantity: 1, price: 1000, status: "approved" }] } });
      await OrderReturnService.completeReturnAndRefund(await Order.findById(returned._id));
      const cod = await delivered({ paymentMode: "COD" }); // 123, cash still with the rider
      expect(cod.paymentBreakdown.codPendingAmount).toBeGreaterThan(0);
      const summary = await getAdminFinanceSummary();
      expect(summary.totalAdminEarning).toBe(123 + 23 - 2 + 123);
      expect(summary.adminEarningCashPending).toBe(123);
    });

    it("an old order without the stored figure falls back to the old number", async () => {
      const o = await delivered();
      await Order.updateOne({ _id: o._id }, { $unset: { platformEarning: 1 } });
      const summary = await getAdminFinanceSummary();
      expect(summary.totalAdminEarning).toBe(o.paymentBreakdown.platformTotalEarning);
    });
  });

  /* ── 5. damaged goods ── */
  describe("5. returned items are added back to stock only when they are fine", () => {
    async function returned(stock = 10) {
      const p = await product(stock);
      const o = await delivered({ prod: p });
      await Order.updateOne({ _id: o._id }, { $set: { returnStatus: "returned", returnFault: "customer", returnDeliveryCommission: 25, returnItems: [{ product: p._id, name: p.name, itemIndex: 0, quantity: 1, price: 1000, status: "approved" }], returnRefundAmount: 1000 } });
      return { p, o: await reload(o) };
    }
    const stockOf = async (p) => (await Product.findById(p._id).lean()).stock;
    const actor = () => ({ id: String(seller._id), role: "seller" });

    it("fine: stock goes back up and a Restock row is written", async () => {
      const { p, o } = await returned();
      await ReturnQcService.completeQc({ orderId: o.orderId, actor: actor(), qcStatus: "qc_passed", restock: true });
      expect(await stockOf(p)).toBe(11);
      expect(await StockHistory.countDocuments({ order: o._id, type: "Restock" })).toBe(1);
      expect((await reload(o)).returnQcRestock).toBe(true);
    });

    it("damaged: the customer is still refunded, stock does NOT change, a 'Damaged Return' row is written", async () => {
      const { p, o } = await returned();
      await ReturnQcService.completeQc({ orderId: o.orderId, actor: actor(), qcStatus: "qc_passed", restock: false });
      expect(await stockOf(p)).toBe(10);
      expect(await StockHistory.countDocuments({ order: o._id, type: "Restock" })).toBe(0);
      expect(await StockHistory.countDocuments({ order: o._id, type: "Damaged Return" })).toBe(1);
      expect((await reload(o)).returnStatus).toBe("refund_completed");
      expect((await wallet("CUSTOMER", customer._id)).availableBalance).toBe(1000);
    });

    it("no answer given (an older app): restocked as before", async () => {
      const { p, o } = await returned();
      await ReturnQcService.completeQc({ orderId: o.orderId, actor: actor(), qcStatus: "qc_passed" });
      expect(await stockOf(p)).toBe(11);
    });

    it("auto-pass (nobody did the QC): refunded, NOT restocked", async () => {
      const { p, o } = await returned();
      await ReturnQcService.completeQc({ orderId: o.orderId, actor: { role: "system" }, qcStatus: "qc_passed" });
      expect(await stockOf(p)).toBe(10);
      expect(await StockHistory.countDocuments({ order: o._id, type: "Damaged Return" })).toBe(1);
      expect((await reload(o)).returnQcAutoPassed).toBe(true);
      expect((await wallet("CUSTOMER", customer._id)).availableBalance).toBe(1000);
    });

    it("the admin sides with the customer after a failed QC: refunded, not restocked", async () => {
      const { p, o } = await returned();
      await ReturnQcService.completeQc({ orderId: o.orderId, actor: actor(), qcStatus: "qc_failed", note: "The screen is cracked, customer broke it", evidenceImages: ["https://example.com/a.jpg"] });
      await ReturnQcService.raiseDispute({ customerId: String(customer._id), orderId: o.orderId, reason: "It was fine when I sent it back", images: [] });
      await ReturnQcService.resolveDispute({ adminId: String(new mongoose.Types.ObjectId()), orderId: o.orderId, decision: "customer", note: "Customer is right" });
      expect(await stockOf(p)).toBe(10);
      expect((await reload(o)).returnStatus).toBe("refund_completed");
    });

    it("a failed QC never restocks or refunds", async () => {
      const { p, o } = await returned();
      await ReturnQcService.completeQc({ orderId: o.orderId, actor: actor(), qcStatus: "qc_failed", note: "The screen is cracked, customer broke it", evidenceImages: ["https://example.com/a.jpg"] });
      expect(await stockOf(p)).toBe(10);
      expect((await reload(o)).returnStatus).toBe("qc_failed");
    });
  });
});
