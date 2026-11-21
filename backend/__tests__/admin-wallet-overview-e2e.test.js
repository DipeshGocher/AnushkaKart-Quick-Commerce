import mongoose from "mongoose";
import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import Wallet from "../app/models/wallet.js";
import Payout from "../app/models/payout.js";
import Transaction from "../app/models/transaction.js";
import Order from "../app/models/order.js";
import User from "../app/models/customer.js";
import Seller from "../app/models/seller.js";
import Delivery from "../app/models/delivery.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";

const { getAdminFinanceSummaryController } = await import("../app/controller/adminFinanceController.js");

jest.setTimeout(120000);
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);

(RUN ? describe : describe.skip)("admin Wallet page: the four plain numbers - real DB", () => {
  let seller, rider, customer;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `wallet4_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });
  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    customer = await User.create({ name: "Rahul", phone: `90000${s.slice(-5)}`, role: "user", isVerified: true });
    seller = await Seller.create({ name: "S", email: `s_${s}@example.com`, phone: `91000${s.slice(-5)}`, password: "Password@123", shopName: "Shop", pincode: "452001", isVerified: true, isActive: true, applicationStatus: "approved", location: { type: "Point", coordinates: [75.87, 22.71] } });
    rider = await Delivery.create({ name: "Ravi", phone: `92000${s.slice(-5)}`, password: "Password@123", isVerified: true, isActive: true });
  });
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  const wallet = (ownerType, ownerId, availableBalance, extra = {}) => Wallet.create({ ownerType, ownerId, availableBalance, pendingBalance: 0, cashInHand: 0, totalCredited: availableBalance, totalDebited: 0, recoverableDue: 0, status: "ACTIVE", currency: "INR", ...extra });
  const callSummary = async () => {
    let out;
    await getAdminFinanceSummaryController({}, { status() { return this; }, json(b) { out = b; return this; } });
    return out.result;
  };

  test("empty platform: all four numbers are 0", async () => {
    const r = await callSummary();
    expect(r.overview).toEqual({ platformHolds: 0, owedToPartners: 0, owedToSellers: 0, owedToRiders: 0, riderCash: 0, courierCash: 0, ourEarning: 0, ourEarningCashPending: 0 });
  });

  test("each number counts exactly what it should", async () => {
    await wallet("ADMIN", null, 1000);
    await wallet("SELLER", seller._id, 300);
    await wallet("DELIVERY_PARTNER", rider._id, 50, { cashInHand: 230 });
    const mk = (payoutType, beneficiaryId, amount, status) => Payout.create({ payoutType, beneficiaryModel: payoutType === "SELLER" ? "Seller" : "Delivery", beneficiaryId, amount, status });
    await mk("SELLER", seller._id, 180, "PENDING"); // not processed yet (also what a return-window hold looks like)
    await mk("DELIVERY_PARTNER", rider._id, 40, "PENDING");
    await mk("SELLER", seller._id, 999, "CANCELLED"); // never counts
    await mk("SELLER", seller._id, 777, "COMPLETED"); // already in the wallet, never counts twice
    const tx = (user, userModel, amount, status, meta) => Transaction.create({ user, userModel, type: "Withdrawal", amount, status, reference: `W-${Math.random()}`, ...(meta ? { meta } : {}) });
    await tx(seller._id, "Seller", -200, "Pending", { walletDebited: true }); // waiting, already out of the wallet
    await tx(rider._id, "Delivery", -25, "Processing", { walletDebited: true });
    await tx(seller._id, "Seller", -500, "Pending"); // old style request (wallet not touched): not counted
    await tx(seller._id, "Seller", -60, "Settled", { walletDebited: true }); // paid: not counted
    // cash the rider holds: collected 230, nothing handed over
    await Transaction.create({ user: rider._id, userModel: "Delivery", type: "Cash Collection", amount: 230, status: "Settled", reference: "CC-1" });
    // what the platform earned
    await Order.create({
      orderId: "ORD-W4-1", customer: customer._id, seller: seller._id, items: [{ product: new mongoose.Types.ObjectId(), name: "x", quantity: 1, price: 100 }],
      address: { name: "R", address: "x", city: "Indore", state: "MP", pincode: "452001", phone: "9876543210" },
      paymentMode: "ONLINE", paymentStatus: "PAID", status: "delivered", orderStatus: "delivered", workflowVersion: 2, workflowStatus: "DELIVERED", fulfillmentType: "LOCAL",
      paymentBreakdown: { grandTotal: 130, platformTotalEarning: 20 }, platformEarning: { net: 75 },
    });

    const r = await callSummary();
    // sellers: payout 180 + wallet 300 + waiting 200 = 680 | riders: payout 40 + wallet 50 + waiting 25 = 115
    expect(r.overview.owedToSellers).toBe(680);
    expect(r.overview.owedToRiders).toBe(115);
    expect(r.overview.owedToPartners).toBe(795);
    // platform holds: own wallet 1000 + seller wallet 300 + rider wallet 50 + waiting 200 + 25 = 1575
    expect(r.overview.platformHolds).toBe(1575);
    expect(r.overview.riderCash).toBe(230);
    expect(r.overview.ourEarning).toBe(75);
    // the difference is the platform's own free money = the old "available balance" (wallet 1000 - payouts waiting 220)
    expect(r.overview.platformHolds - r.overview.owedToPartners).toBe(r.availableBalance);
  });

  test("the old summary fields are unchanged (other screens keep working)", async () => {
    await wallet("ADMIN", null, 400);
    const r = await callSummary();
    expect(r.walletAvailableBalance).toBe(400);
    expect(r.availableBalance).toBe(400);
    expect(r).toHaveProperty("systemFloatCOD");
    expect(r).toHaveProperty("totalAdminEarning");
  });
});
