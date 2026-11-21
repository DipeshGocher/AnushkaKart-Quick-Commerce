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
import LedgerEntry from "../app/models/ledgerEntry.js";
import Transaction from "../app/models/transaction.js";
import LocalPincode from "../app/models/localPincode.js";
import CustomerWithdrawal from "../app/models/customerWithdrawal.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "wallet-withdrawal-secret";

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");
const { creditWallet } = await import("../app/services/finance/walletService.js");
const { default: OrderReturnService } = await import("../app/services/order/orderReturnService.js");
const fin = await import("../app/services/finance/orderFinanceService.js");
const { invalidatePlatformRulesCache } = await import("../app/services/platformRulesService.js");
const { invalidate } = await import("../app/services/cacheService.js");

jest.setTimeout(120000);

/**
 * REAL MongoDB test of "wallet money can only be withdrawn to the customer's bank / UPI":
 * refund -> wallet -> withdrawal request -> admin pays or rejects.
 * Runs only with RUN_E2E_TESTS=true and MONGO_URI_E2E = a throw-away replica set.
 */
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);

const BANK = { method: "bank", holderName: "Rahul Verma", bankName: "State Bank of India", accountNumber: "123456789012", ifsc: "SBIN0001234" };
const UPI = { method: "upi", upiId: "rahul@oksbi" };

(RUN ? describe : describe.skip)("Customer wallet: withdraw refund money to bank / UPI - real DB", () => {
  let app;
  let ctx;

  const token = (id, role) => jwt.sign({ id: String(id), role }, process.env.JWT_SECRET, { expiresIn: "2h" });
  const auth = (t) => `Bearer ${t}`;

  async function makeCustomer(tag) {
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}${tag}`;
    const customer = await User.create({ name: `Customer ${tag}`, phone: `9${s.replace(/\D/g, "").slice(-9)}`, role: "user", isVerified: true });
    return { customer, t: token(customer._id, "user") };
  }

  async function seed() {
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const { customer, t } = await makeCustomer("A");
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
    return { customer, seller, header, product, ct: t, at: token(new mongoose.Types.ObjectId(), "admin") };
  }

  const address = { type: "Home", name: "C", address: "RNT Marg, Indore", city: "Indore", pincode: "452001", phone: "9999999999", location: { lat: 22.72, lng: 75.88 } };

  // ----- helpers -----
  const give = (amount, customerId = ctx.customer._id, ref = `R-${Math.random()}`) =>
    creditWallet({
      ownerType: "CUSTOMER", ownerId: customerId, amount, bucket: "available",
      ledgerType: "WALLET_REFUND", ledgerReference: ref, idempotencyKey: `T-${ref}`,
    });
  const wallet = (customerId = ctx.customer._id) => Wallet.findOne({ ownerType: "CUSTOMER", ownerId: customerId }).lean();
  const mirror = async (customerId = ctx.customer._id) => (await User.findById(customerId).lean()).walletBalance;
  const adminWallet = () => Wallet.findOne({ ownerType: "ADMIN", ownerId: null }).lean();
  const setAdminWallet = (availableBalance) =>
    Wallet.findOneAndUpdate({ ownerType: "ADMIN", ownerId: null }, { $set: { availableBalance } }, { upsert: true, new: true });
  const myWallet = (t = ctx.ct) => request(app).get("/api/customer/wallet").set("Authorization", auth(t));
  const saveAccount = (body, t = ctx.ct) => request(app).put("/api/customer/wallet/account").set("Authorization", auth(t)).send(body);
  const withdraw = (body, t = ctx.ct) => request(app).post("/api/customer/wallet/withdraw").set("Authorization", auth(t)).send(body);
  const adminList = (q = "", t = ctx.at) => request(app).get(`/api/admin/customer-withdrawals${q}`).set("Authorization", auth(t));
  const adminPay = (id, body, t = ctx.at) => request(app).put(`/api/admin/customer-withdrawals/${id}/pay`).set("Authorization", auth(t)).send(body);
  const adminReject = (id, body, t = ctx.at) => request(app).put(`/api/admin/customer-withdrawals/${id}/reject`).set("Authorization", auth(t)).send(body);
  const ledgerOf = (type, extra = {}) => LedgerEntry.find({ type, ...extra }).lean();
  const place = (mode, extra = {}) =>
    request(app).post("/api/orders").set("Authorization", auth(ctx.ct))
      .send({ items: [{ product: String(ctx.product._id), quantity: 1, price: 100 }], address, paymentMode: mode, timeSlot: "now", ...extra });

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: "5mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `wallet_withdraw_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });
  beforeEach(async () => {
    delete process.env.RETURN_WINDOW_MINUTES;
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

  describe("the wallet page data", () => {
    it("a new customer: ₹0, nothing in process, no account saved, ₹1 minimum", async () => {
      const res = await myWallet();
      expect(res.status).toBe(200);
      expect(res.body.result).toMatchObject({ balance: 0, inProcess: 0, minWithdrawal: 1, account: null, history: [] });
    });

    it("only the customer's own app can call it", async () => {
      expect((await request(app).get("/api/customer/wallet")).status).toBe(401);
      expect((await myWallet(ctx.at)).status).toBe(403);
      expect((await myWallet(token(ctx.seller._id, "seller"))).status).toBe(403);
    });

    it("a refund shows up in the history and in the balance", async () => {
      await give(750);
      await Transaction.create({ user: ctx.customer._id, userModel: "User", type: "Refund", amount: 750, status: "Settled", reference: "REF-WALLET-X" });
      const res = await myWallet();
      expect(res.body.result.balance).toBe(750);
      expect(res.body.result.history).toHaveLength(1);
      expect(res.body.result.history[0]).toMatchObject({ kind: "refund", type: "credit", title: "Refund", amount: 750, status: "completed" });
    });
  });

  describe("saving the bank account / UPI", () => {
    it("bad details are refused and nothing is saved", async () => {
      for (const body of [
        { ...BANK, ifsc: "WRONG" },
        { ...BANK, accountNumber: "123" },
        { ...BANK, holderName: "" },
        { method: "upi", upiId: "nobank" },
        { method: "wallet" },
      ]) {
        expect((await saveAccount(body)).status).toBe(400);
      }
      expect((await myWallet()).body.result.account).toBeNull();
    });

    it("a bank account is saved; the customer sees only the last 4 digits; the profile never leaks it; the database holds it encrypted", async () => {
      const res = await saveAccount(BANK);
      expect(res.status).toBe(200);
      expect(res.body.result.account).toMatchObject({ method: "bank", holderName: "Rahul Verma", bankName: "State Bank of India", accountMasked: "XXXXXX9012", ifsc: "SBIN0001234" });
      const page = await myWallet();
      expect(page.body.result.account.accountMasked).toBe("XXXXXX9012");
      expect(JSON.stringify(page.body)).not.toContain("123456789012");

      const profile = await request(app).get("/api/customer/profile").set("Authorization", auth(ctx.ct));
      expect(profile.status).toBe(200);
      expect(JSON.stringify(profile.body)).not.toMatch(/payoutAccount|accountNumberEnc|123456789012/);

      const raw = await User.findById(ctx.customer._id).select("+payoutAccount").lean();
      expect(raw.payoutAccount.accountNumberEnc).toMatch(/^v1:/);
      expect(JSON.stringify(raw.payoutAccount)).not.toContain("123456789012");
    });

    it("saving a UPI id replaces the bank account", async () => {
      await saveAccount(BANK);
      await saveAccount(UPI);
      expect((await myWallet()).body.result.account).toMatchObject({ method: "upi", upiId: "rahul@oksbi" });
    });
  });

  describe("asking to withdraw", () => {
    it("needs an account first", async () => {
      await give(500);
      const res = await withdraw({ amount: 100 });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Add your bank account or UPI ID first/);
      expect((await wallet()).availableBalance).toBe(500);
    });

    it("refuses bad amounts and leaves the wallet untouched", async () => {
      await give(500);
      await saveAccount(BANK);
      for (const amount of [0, 0.5, -5, 1.234, "abc", "", null, 500.01, 99999]) {
        const res = await withdraw({ amount });
        expect(res.status).toBe(400);
      }
      expect(await CustomerWithdrawal.countDocuments({})).toBe(0);
      expect((await wallet()).availableBalance).toBe(500);
      expect(await mirror()).toBe(500);
    });

    it("₹1 is allowed: the wallet goes down by exactly ₹1 and a pending request is created", async () => {
      await give(500);
      await saveAccount(BANK);
      const res = await withdraw({ amount: 1 });
      expect(res.status).toBe(201);
      expect(res.body.result.withdrawal).toMatchObject({ amount: 1, status: "pending", method: "bank" });
      expect(res.body.result.balance).toBe(499);
      expect((await wallet()).availableBalance).toBe(499);
      expect(await mirror()).toBe(499);
      const w = await CustomerWithdrawal.findOne({}).lean();
      expect(w.status).toBe("pending");
      expect(w.account.accountNumberEnc).toMatch(/^v1:/);
      expect(w.account.accountLast4).toBe("9012");
      const led = await ledgerOf("WITHDRAWAL");
      expect(led).toHaveLength(1);
      expect(led[0]).toMatchObject({ amount: 1, direction: "DEBIT", actorType: "CUSTOMER" });
    });

    it("the wallet page then shows the money as 'in process' and the request in the history", async () => {
      await give(500);
      await saveAccount(UPI);
      await withdraw({ amount: 120.5 });
      const page = (await myWallet()).body.result;
      expect(page.balance).toBe(379.5);
      expect(page.inProcess).toBe(120.5);
      expect(page.inProcessCount).toBe(1);
      expect(page.history[0]).toMatchObject({ kind: "withdrawal", type: "debit", amount: 120.5, status: "pending", title: "Withdraw to UPI" });
    });

    it("the account can be sent together with the request, and is saved for next time", async () => {
      await give(300);
      const res = await withdraw({ amount: 100, account: BANK });
      expect(res.status).toBe(201);
      expect((await myWallet()).body.result.account.accountMasked).toBe("XXXXXX9012");
      const second = await withdraw({ amount: 50 }); // no account sent: the saved one is used
      expect(second.status).toBe(201);
      expect(second.body.result.withdrawal.account.accountMasked).toBe("XXXXXX9012");
    });

    it("a bad account in the request is refused before any money moves", async () => {
      await give(300);
      const res = await withdraw({ amount: 100, account: { ...BANK, ifsc: "X" } });
      expect(res.status).toBe(400);
      expect((await wallet()).availableBalance).toBe(300);
      expect(await CustomerWithdrawal.countDocuments({})).toBe(0);
    });

    it("the whole balance can be withdrawn; asking for more afterwards is refused", async () => {
      await give(500);
      await saveAccount(BANK);
      expect((await withdraw({ amount: 500 })).status).toBe(201);
      expect((await wallet()).availableBalance).toBe(0);
      const again = await withdraw({ amount: 1 });
      expect(again.status).toBe(400);
      expect(again.body.message).toMatch(/only have ₹0/);
      expect(await CustomerWithdrawal.countDocuments({})).toBe(1);
    });

    it("two requests at the same moment for the whole balance: exactly one is accepted, the money is taken once", async () => {
      await give(500);
      await saveAccount(BANK);
      const results = await Promise.all([withdraw({ amount: 500 }), withdraw({ amount: 500 }), withdraw({ amount: 500 })]);
      const ok = results.filter((r) => r.status === 201);
      expect(ok).toHaveLength(1);
      expect(results.filter((r) => r.status === 400)).toHaveLength(2);
      expect(await CustomerWithdrawal.countDocuments({})).toBe(1);
      expect((await wallet()).availableBalance).toBe(0);
      expect(await mirror()).toBe(0);
      expect(await ledgerOf("WITHDRAWAL")).toHaveLength(1);
    });

    it("an older customer whose balance only exists on the profile (no wallet record yet) can still withdraw it", async () => {
      await User.updateOne({ _id: ctx.customer._id }, { $set: { walletBalance: 400 } });
      expect(await wallet()).toBeNull();
      await saveAccount(BANK);
      const page = (await myWallet()).body.result;
      expect(page.balance).toBe(400);
      const res = await withdraw({ amount: 400 });
      expect(res.status).toBe(201);
      expect((await wallet()).availableBalance).toBe(0);
      expect(await mirror()).toBe(0);
    });

    it("a blocked customer cannot withdraw", async () => {
      await give(100);
      await saveAccount(BANK);
      await User.updateOne({ _id: ctx.customer._id }, { $set: { isActive: false } });
      const res = await withdraw({ amount: 10 });
      expect(res.status).toBe(403);
      expect((await wallet()).availableBalance).toBe(100);
    });

    it("customers cannot see or touch each other's money", async () => {
      await give(500);
      await saveAccount(BANK);
      const other = await makeCustomer("B");
      expect((await myWallet(other.t)).body.result.balance).toBe(0);
      const res = await withdraw({ amount: 10, account: BANK }, other.t);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/only have ₹0/);
      expect((await wallet()).availableBalance).toBe(500);
    });
  });

  describe("the admin pays", () => {
    async function pendingRequest(amount = 200, account = BANK) {
      await give(Math.max(amount, 500), ctx.customer._id, `seed-${Math.random()}`);
      await saveAccount(account);
      const res = await withdraw({ amount });
      return res.body.result.withdrawal.id;
    }

    it("only an admin can list or act", async () => {
      const id = await pendingRequest();
      expect((await adminList("", ctx.ct)).status).toBe(403);
      expect((await adminPay(id, { reference: "UTR12345" }, ctx.ct)).status).toBe(403);
      expect((await adminReject(id, { reason: "no reason" }, ctx.ct)).status).toBe(403);
      expect((await request(app).get("/api/admin/customer-withdrawals")).status).toBe(401);
    });

    it("the list shows the customer, the amount and the FULL bank details; stats and filters work", async () => {
      const id = await pendingRequest(200, BANK);
      const res = await adminList("?status=pending");
      expect(res.status).toBe(200);
      expect(res.body.result.items).toHaveLength(1);
      const row = res.body.result.items[0];
      expect(row).toMatchObject({ id, status: "pending", amount: 200, method: "bank" });
      expect(row.customer).toMatchObject({ name: "Customer A", phone: ctx.customer.phone });
      expect(row.account).toMatchObject({ holderName: "Rahul Verma", bankName: "State Bank of India", accountNumber: "123456789012", ifsc: "SBIN0001234" });
      expect(res.body.result.stats).toMatchObject({ pendingCount: 1, pendingAmount: 200, paidCount: 0 });
      expect((await adminList("?status=paid")).body.result.items).toHaveLength(0);
      expect((await adminList(`?search=${ctx.customer.phone}`)).body.result.items).toHaveLength(1);
      expect((await adminList("?search=Nobody")).body.result.items).toHaveLength(0);
    });

    it("a UPI request shows the UPI id", async () => {
      await pendingRequest(100, UPI);
      const row = (await adminList()).body.result.items[0];
      expect(row.method).toBe("upi");
      expect(row.account).toMatchObject({ upiId: "rahul@oksbi" });
    });

    it("needs a transfer reference", async () => {
      const id = await pendingRequest();
      for (const reference of [undefined, "", "   ", "abc"]) {
        const res = await adminPay(id, { reference });
        expect(res.status).toBe(400);
      }
      expect((await CustomerWithdrawal.findById(id).lean()).status).toBe("pending");
    });

    it("paying: status paid, the admin wallet and ledger show the money leaving, the customer is NOT credited again", async () => {
      await setAdminWallet(1000);
      const id = await pendingRequest(200);
      const res = await adminPay(id, { reference: "UTR-998877" });
      expect(res.status).toBe(200);
      expect(res.body.result).toMatchObject({ status: "paid", reference: "UTR-998877", amount: 200 });
      const w = await CustomerWithdrawal.findById(id).lean();
      expect(w).toMatchObject({ status: "paid", reference: "UTR-998877", adminWalletDebited: 200 });
      expect(w.processedAt).toBeTruthy();
      expect((await adminWallet()).availableBalance).toBe(800);
      const led = await ledgerOf("CUSTOMER_WITHDRAWAL_PAID");
      expect(led).toHaveLength(1);
      expect(led[0]).toMatchObject({ amount: 200, direction: "DEBIT", actorType: "ADMIN", reference: "UTR-998877" });
      expect(led[0].metadata).toMatchObject({ adminWalletDebited: 200, notCoveredByAdminWallet: 0 });
      // the customer's wallet stays down by the withdrawn amount
      expect((await wallet()).availableBalance).toBe(300);
      expect(await mirror()).toBe(300);
      // what the customer sees
      const item = (await myWallet()).body.result.history.find((h) => h.kind === "withdrawal");
      expect(item).toMatchObject({ status: "paid", reference: "UTR-998877", amount: 200 });
      expect((await myWallet()).body.result.inProcess).toBe(0);
    });

    it("the admin wallet holds less than the payout: the payment is still recorded in full (the wallet never goes below zero)", async () => {
      await setAdminWallet(50);
      const id = await pendingRequest(200);
      const res = await adminPay(id, { reference: "UTR-LOW-1" });
      expect(res.status).toBe(200);
      expect((await adminWallet()).availableBalance).toBe(0);
      const led = (await ledgerOf("CUSTOMER_WITHDRAWAL_PAID"))[0];
      expect(led.amount).toBe(200);
      expect(led.metadata).toMatchObject({ adminWalletDebited: 50, notCoveredByAdminWallet: 150 });
      expect((await CustomerWithdrawal.findById(id).lean()).adminWalletDebited).toBe(50);
    });

    it("paying twice, or paying a rejected request, is refused and nothing is booked twice", async () => {
      await setAdminWallet(1000);
      const id = await pendingRequest(200);
      expect((await adminPay(id, { reference: "UTR-ONCE" })).status).toBe(200);
      const again = await adminPay(id, { reference: "UTR-TWICE" });
      expect(again.status).toBe(409);
      expect(again.body.message).toMatch(/already paid or rejected/);
      expect((await adminReject(id, { reason: "too late now" })).status).toBe(409);
      expect(await ledgerOf("CUSTOMER_WITHDRAWAL_PAID")).toHaveLength(1);
      expect((await adminWallet()).availableBalance).toBe(800);
      expect((await CustomerWithdrawal.findById(id).lean()).reference).toBe("UTR-ONCE");
    });

    it("unknown or malformed request ids", async () => {
      expect((await adminPay(String(new mongoose.Types.ObjectId()), { reference: "UTR12345" })).status).toBe(404);
      expect((await adminPay("not-an-id", { reference: "UTR12345" })).status).toBe(404);
      expect((await adminReject(String(new mongoose.Types.ObjectId()), { reason: "something" })).status).toBe(404);
    });
  });

  describe("the admin rejects", () => {
    async function pendingRequest(amount = 200) {
      await give(500);
      await saveAccount(BANK);
      return (await withdraw({ amount })).body.result.withdrawal.id;
    }

    it("needs a reason", async () => {
      const id = await pendingRequest();
      for (const reason of [undefined, "", "no", "    "]) {
        expect((await adminReject(id, { reason })).status).toBe(400);
      }
      expect((await CustomerWithdrawal.findById(id).lean()).status).toBe("pending");
    });

    it("the money goes back into the wallet (and the profile balance), the ledger says why, the customer sees the reason", async () => {
      const id = await pendingRequest(200);
      expect((await wallet()).availableBalance).toBe(300);
      const res = await adminReject(id, { reason: "Account name does not match" });
      expect(res.status).toBe(200);
      expect(res.body.result).toMatchObject({ status: "rejected", rejectionReason: "Account name does not match" });
      expect((await wallet()).availableBalance).toBe(500);
      expect(await mirror()).toBe(500);
      const led = await ledgerOf("CUSTOMER_WITHDRAWAL_REJECTED");
      expect(led).toHaveLength(1);
      expect(led[0]).toMatchObject({ amount: 200, direction: "CREDIT", actorType: "CUSTOMER" });
      const page = (await myWallet()).body.result;
      expect(page.balance).toBe(500);
      expect(page.inProcess).toBe(0);
      expect(page.history.find((h) => h.kind === "withdrawal")).toMatchObject({ status: "rejected", reason: "Account name does not match" });
      // nothing left the admin wallet
      expect(await ledgerOf("CUSTOMER_WITHDRAWAL_PAID")).toHaveLength(0);
    });

    it("rejecting twice does not return the money twice; the customer can ask again with a corrected account", async () => {
      const id = await pendingRequest(200);
      expect((await adminReject(id, { reason: "Wrong IFSC code" })).status).toBe(200);
      expect((await adminReject(id, { reason: "Wrong IFSC code" })).status).toBe(409);
      expect((await wallet()).availableBalance).toBe(500);
      const retry = await withdraw({ amount: 200, account: { ...BANK, ifsc: "HDFC0000123", bankName: "HDFC Bank" } });
      expect(retry.status).toBe(201);
      expect((await wallet()).availableBalance).toBe(300);
    });

    it("pay and reject at the same moment: exactly one wins and the money adds up", async () => {
      await setAdminWallet(1000);
      const id = await pendingRequest(200);
      const [p, r] = await Promise.all([adminPay(id, { reference: "UTR-RACE-1" }), adminReject(id, { reason: "Raced with the payment" })]);
      expect([p.status, r.status].sort()).toEqual([200, 409]);
      const w = await CustomerWithdrawal.findById(id).lean();
      if (w.status === "paid") {
        expect((await wallet()).availableBalance).toBe(300);
        expect(await ledgerOf("CUSTOMER_WITHDRAWAL_REJECTED")).toHaveLength(0);
      } else {
        expect((await wallet()).availableBalance).toBe(500);
        expect(await ledgerOf("CUSTOMER_WITHDRAWAL_PAID")).toHaveLength(0);
        expect((await adminWallet()).availableBalance).toBe(1000);
      }
    });
  });

  describe("the wallet cannot be spent at checkout", () => {
    it("an order that tries to use wallet money is refused, nothing is reserved, the wallet is untouched", async () => {
      await give(500);
      const before = (await Product.findById(ctx.product._id).lean()).stock;
      const res = await place("COD", { walletAmount: 50 });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Wallet money cannot be used to pay for an order/);
      expect(await Order.countDocuments({})).toBe(0);
      expect((await Product.findById(ctx.product._id).lean()).stock).toBe(before);
      expect((await wallet()).availableBalance).toBe(500);
      expect(await mirror()).toBe(500);
    });

    it("a normal order (no wallet) still works for a customer who has refund money", async () => {
      await give(500);
      const res = await place("COD", { walletAmount: 0 });
      expect(res.status).toBe(201);
      expect((await wallet()).availableBalance).toBe(500);
    });
  });

  describe("every kind of refund lands in the same wallet and can be withdrawn", () => {
    it("a paid UPI QR order that the customer cancels: refunded in full, shows in the history, withdrawable, paid by the admin", async () => {
      const placed = await place("UPI_QR");
      expect(placed.status).toBe(201);
      const orderId = placed.body.result.order.orderId;
      const total = placed.body.result.order.paymentBreakdown.grandTotal;
      const submit = await request(app).post(`/api/orders/${orderId}/payment/submit-utr`).set("Authorization", auth(ctx.ct)).send({ utrNumber: "402938491029" });
      expect(submit.status).toBe(200);
      const approve = await request(app).post(`/api/orders/${orderId}/payment/approve-upi`).set("Authorization", auth(ctx.at)).send({});
      expect(approve.status).toBe(200);
      expect((await adminWallet()).availableBalance).toBe(total); // the platform holds the customer's money

      const cancel = await request(app).put(`/api/orders/cancel/${orderId}`).set("Authorization", auth(ctx.ct)).send({ reason: "Changed my mind" });
      expect(cancel.status).toBe(200);

      expect((await wallet()).availableBalance).toBe(total);
      expect(await mirror()).toBe(total);
      expect((await Order.findOne({ orderId }).lean()).paymentStatus).toBe("REFUNDED");
      const page = (await myWallet()).body.result;
      expect(page.balance).toBe(total);
      expect(page.history[0]).toMatchObject({ kind: "refund", type: "credit", amount: total, orderId });
      expect(await ledgerOf("WALLET_REFUND", { actorType: "CUSTOMER" })).toHaveLength(1);

      // withdraw it all, the admin pays it
      await saveAccount(UPI);
      const w = await withdraw({ amount: total });
      expect(w.status).toBe(201);
      expect((await adminPay(w.body.result.withdrawal.id, { reference: "UTR-CANCEL-1" })).status).toBe(200);
      expect((await wallet()).availableBalance).toBe(0);
      expect((await adminWallet()).availableBalance).toBe(0); // total came in, total went out
    });

    it("cancelling a second time never refunds twice", async () => {
      const placed = await place("UPI_QR");
      const orderId = placed.body.result.order.orderId;
      const total = placed.body.result.order.paymentBreakdown.grandTotal;
      await request(app).post(`/api/orders/${orderId}/payment/submit-utr`).set("Authorization", auth(ctx.ct)).send({ utrNumber: "402938491029" });
      await request(app).post(`/api/orders/${orderId}/payment/approve-upi`).set("Authorization", auth(ctx.at)).send({});
      await request(app).put(`/api/orders/cancel/${orderId}`).set("Authorization", auth(ctx.ct)).send({ reason: "x" });
      const order = await Order.findOne({ orderId });
      await fin.reverseOrderFinanceOnCancellation(order._id, { reason: "second attempt" });
      expect((await wallet()).availableBalance).toBe(total);
      expect(await ledgerOf("WALLET_REFUND", { actorType: "CUSTOMER" })).toHaveLength(1);
    });

    it("an UPI QR order that was never paid has nothing to refund", async () => {
      const placed = await place("UPI_QR");
      const orderId = placed.body.result.order.orderId;
      await request(app).put(`/api/orders/cancel/${orderId}`).set("Authorization", auth(ctx.ct)).send({ reason: "x" });
      expect(await wallet()).toBeNull();
    });

    it("an online-paid order cancelled: refunded to the wallet and the admin wallet is not touched", async () => {
      const placed = await place("ONLINE");
      expect(placed.status).toBe(201);
      const order = await Order.findOne({ orderId: placed.body.result.order.orderId });
      await fin.handleOnlineOrderFinance(order._id, { transactionId: "pay_cancel_1" });
      const total = order.paymentBreakdown.grandTotal;
      const adminBefore = (await adminWallet()).availableBalance;
      await fin.reverseOrderFinanceOnCancellation(order._id, { reason: "Seller could not deliver" });
      expect((await wallet()).availableBalance).toBe(total);
      expect((await adminWallet()).availableBalance).toBe(adminBefore);
    });

    it("an accepted return: the customer's wallet gets the item price, it shows in the history, withdraw it, the admin pays", async () => {
      const productId = new mongoose.Types.ObjectId();
      const o = await Order.create({
        orderId: `ORD-WR-${Date.now()}`, customer: ctx.customer._id, seller: ctx.seller._id,
        items: [{ product: productId, name: "Phone", quantity: 1, price: 1000 }],
        address: { name: "R", address: "x", city: "Indore", state: "MP", pincode: "452001", phone: "9876543210" },
        paymentMode: "ONLINE", status: "delivered", orderStatus: "delivered", workflowVersion: 2, workflowStatus: "DELIVERED",
        deliveredAt: new Date(Date.now() - 3600 * 1000),
        paymentBreakdown: {
          productSubtotal: 1000, sellerPayoutTotal: 900, adminProductCommissionTotal: 100, platformTotalEarning: 120, grandTotal: 1080,
          lineItems: [{ productId, productName: "Phone", quantity: 1, itemSubtotal: 1000, sellerPayout: 900, adminProductCommission: 100 }],
        },
        financeFlags: { adminEarningCredited: true, deliveredSettlementApplied: true },
        settlementStatus: { sellerPayout: "NOT_APPLICABLE", adminEarningCredited: true },
        returnStatus: "qc_passed", returnReason: "test", returnFault: "customer", returnDeliveryCommission: 25, returnRefundAmount: 1000,
        returnItems: [{ product: productId, name: "Phone", itemIndex: 0, quantity: 1, price: 1000, status: "approved" }],
      });
      await OrderReturnService.completeReturnAndRefund(o);
      expect((await wallet()).availableBalance).toBe(1000);
      const page = (await myWallet()).body.result;
      expect(page.history[0]).toMatchObject({ kind: "refund", type: "credit", amount: 1000, orderId: o.orderId });

      await saveAccount(BANK);
      await setAdminWallet(1080);
      const w = await withdraw({ amount: 1000 });
      expect(w.status).toBe(201);
      expect((await adminPay(w.body.result.withdrawal.id, { reference: "UTR-RETURN-1" })).status).toBe(200);
      expect((await wallet()).availableBalance).toBe(0);
      expect((await adminWallet()).availableBalance).toBe(80);
      const final = (await myWallet()).body.result;
      expect(final.history.map((h) => `${h.kind}:${h.status}`)).toEqual(expect.arrayContaining(["refund:completed", "withdrawal:paid"]));
      expect(final.balance).toBe(0);
      expect(final.inProcess).toBe(0);
    });
  });
});
