import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import Order from "../app/models/order.js";
import Seller from "../app/models/seller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "admin-groups-secret";

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");

jest.setTimeout(120000);

/**
 * REAL MongoDB test for the admin "Active / Completed" Orders and Returns pages.
 * Runs only with RUN_E2E_TESTS=true and MONGO_URI_E2E (a throw-away local mongod; never MONGO_URI).
 */
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);

(RUN ? describe : describe.skip)("Admin Active/Completed orders and returns - real DB", () => {
  let app;
  let seller;
  const ids = {}; // label -> orderId
  let seq = 0;

  const admin = () => `Bearer ${jwt.sign({ id: String(new mongoose.Types.ObjectId()), role: "admin" }, process.env.JWT_SECRET, { expiresIn: "2h" })}`;

  async function mk(label, over = {}) {
    seq += 1;
    const o = await Order.create({
      orderId: `ORD-AG-${Date.now()}-${seq}`,
      customer: new mongoose.Types.ObjectId(),
      seller: seller._id,
      items: [{ product: new mongoose.Types.ObjectId(), name: label, quantity: 1, price: 100 }],
      address: { name: "R", address: "x", city: "Indore", state: "MP", pincode: "452001", phone: "9876543210" },
      paymentMode: "COD",
      status: "pending",
      orderStatus: "pending",
      workflowVersion: 2,
      workflowStatus: "SELLER_PENDING",
      ...over,
    });
    ids[label] = o.orderId;
    return o;
  }

  const listOrders = async (status) => {
    const res = await request(app).get("/api/orders/seller-orders").query({ status, limit: 100 }).set("Authorization", admin());
    expect(res.status).toBe(200);
    return res.body.result.items.map((o) => o.orderId);
  };
  const listReturns = async (group) => {
    const res = await request(app).get("/api/orders/seller-returns").query({ group, limit: 100 }).set("Authorization", admin());
    expect(res.status).toBe(200);
    return res.body.result.items.map((o) => o.orderId);
  };
  const labelsOf = (orderIds) => Object.keys(ids).filter((k) => orderIds.includes(ids[k])).sort();

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: "2mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `admin_groups_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });

  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    for (const k of Object.keys(ids)) delete ids[k];
    seller = await Seller.create({
      name: "S", email: `s_${Date.now()}@example.com`, phone: `91${String(Date.now()).slice(-8)}`, password: "Password@123",
      shopName: "Shop", pincode: "452001", isVerified: true, isActive: true, applicationStatus: "approved",
      location: { type: "Point", coordinates: [75.87, 22.71] },
    });
    // --- in progress
    await mk("new");
    await mk("confirmed", { status: "confirmed", orderStatus: "confirmed", workflowStatus: "SELLER_ACCEPTED" });
    await mk("packed", { status: "packed", orderStatus: "packed", workflowStatus: "PICKUP_READY" });
    await mk("onTheWay", { status: "out_for_delivery", orderStatus: "out_for_delivery", workflowStatus: "OUT_FOR_DELIVERY" });
    await mk("upiUnapproved", { paymentMode: "UPI_QR", paymentStatus: "AWAITING_VERIFICATION" });
    // --- finished
    const done = { status: "delivered", orderStatus: "delivered", workflowStatus: "DELIVERED" };
    await mk("delivered", done);
    await mk("cancelled", { status: "cancelled", orderStatus: "cancelled", workflowStatus: "CANCELLED" });
    // --- returns
    await mk("returnRejected", { ...done, returnStatus: "return_rejected" });
    await mk("returnRequested", { ...done, returnStatus: "return_requested" });
    await mk("returnInTransit", { ...done, returnStatus: "return_in_transit" });
    await mk("qcWaiting", { ...done, returnStatus: "returned" });
    await mk("qcPassedRefundPending", { ...done, returnStatus: "qc_passed" });
    await mk("qcFailedOpen", { ...done, returnStatus: "qc_failed" });
    await mk("qcFailedDispute", { ...done, returnStatus: "qc_failed", returnDispute: { status: "open" } });
    await mk("qcFailedPayoutReleased", { ...done, returnStatus: "qc_failed", returnQcPayoutReleasedAt: new Date() });
    await mk("qcFailedDisputeUpheld", { ...done, returnStatus: "qc_failed", returnDispute: { status: "upheld" } });
    await mk("refunded", { status: "returned", orderStatus: "returned", workflowStatus: "DELIVERED", returnStatus: "refund_completed" });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  describe("Orders", () => {
    it("Active Orders = everything in progress and not in a return; an unapproved UPI order is NOT in it", async () => {
      expect(labelsOf(await listOrders("active"))).toEqual(["confirmed", "new", "onTheWay", "packed"]);
    });

    it("each Active pill shows its own orders (New / Being prepared / On the way / UPI approval)", async () => {
      expect(labelsOf(await listOrders("pending"))).toEqual(["new"]);
      expect(labelsOf(await listOrders("processed"))).toEqual(["confirmed", "packed"]);
      expect(labelsOf(await listOrders("out-for-delivery"))).toEqual(["onTheWay"]);
      expect(labelsOf(await listOrders("upi-pending"))).toEqual(["upiUnapproved"]);
    });

    it("Completed Orders = delivered (no return in progress/finished) + cancelled; a rejected return goes back there", async () => {
      expect(labelsOf(await listOrders("completed"))).toEqual(["cancelled", "delivered", "returnRejected"]);
      expect(labelsOf(await listOrders("delivered"))).toEqual(["delivered", "returnRejected"]);
      expect(labelsOf(await listOrders("cancelled"))).toEqual(["cancelled"]);
    });

    it("no order is in both Active and Completed, and orders in a return are in neither", async () => {
      const active = await listOrders("active");
      const completed = await listOrders("completed");
      expect(active.filter((x) => completed.includes(x))).toEqual([]);
      const inReturn = labelsOf([...active, ...completed]).filter((l) => /^(returnRequested|returnInTransit|qcWaiting|qcPassed|qcFailed|refunded)/.test(l));
      expect(inReturn).toEqual([]);
    });

    it("every order is in exactly one place (Active, Completed, UPI approval or Returns): nothing is lost", async () => {
      const all = new Set([
        ...(await listOrders("active")),
        ...(await listOrders("completed")),
        ...(await listOrders("upi-pending")),
        ...(await listReturns("active")),
        ...(await listReturns("completed")),
      ]);
      expect(all.size).toBe(Object.keys(ids).length);
    });

    it("an unknown future status still counts as Active (never disappears)", async () => {
      await mk("weird", { status: "created", orderStatus: "created" }).catch(() => null);
      if (ids.weird) expect(labelsOf(await listOrders("active"))).toContain("weird");
    });
  });

  describe("Returns", () => {
    it("Active Returns = request, pickup, QC waiting, refund retry, and a failed QC that is still open", async () => {
      expect(labelsOf(await listReturns("active"))).toEqual([
        "qcFailedDispute", "qcFailedOpen", "qcPassedRefundPending", "qcWaiting", "returnInTransit", "returnRequested",
      ]);
    });

    it("Completed Returns = refunded, rejected, and a failed QC that is settled (payout released / dispute decided)", async () => {
      expect(labelsOf(await listReturns("completed"))).toEqual([
        "qcFailedDisputeUpheld", "qcFailedPayoutReleased", "refunded", "returnRejected",
      ]);
    });

    it("a status filter still works inside a group, and the plain list is unchanged", async () => {
      const res = await request(app).get("/api/orders/seller-returns").query({ group: "active", status: "returned", limit: 100 }).set("Authorization", admin());
      expect(labelsOf(res.body.result.items.map((o) => o.orderId))).toEqual(["qcWaiting"]);
      expect((await listReturns(undefined)).length).toBe(10);
    });

    it("returns carry the QC deadlines the page shows", async () => {
      const res = await request(app).get("/api/orders/seller-returns").query({ group: "active", limit: 100 }).set("Authorization", admin());
      const waiting = res.body.result.items.find((o) => o.orderId === ids.qcWaiting);
      expect(waiting.qc.qcDueAt).toBeTruthy();
    });
  });

  describe("sidebar badge counts", () => {
    it("counts what needs the admin right now", async () => {
      const res = await request(app).get("/api/orders/admin-nav-counts").set("Authorization", admin());
      expect(res.status).toBe(200);
      expect(res.body.result).toMatchObject({
        upiPending: 1, newOrders: 1, activeOrders: 4, activeReturns: 6,
        returnRequests: 1, qcWaiting: 1, openDisputes: 1,
        ordersNeedAction: 2, returnsNeedAction: 3,
      });
    });

    it("is admin-only", async () => {
      expect((await request(app).get("/api/orders/admin-nav-counts")).status).toBe(401);
      const seller = `Bearer ${jwt.sign({ id: String(new mongoose.Types.ObjectId()), role: "user" }, process.env.JWT_SECRET)}`;
      expect((await request(app).get("/api/orders/admin-nav-counts").set("Authorization", seller)).status).toBeGreaterThanOrEqual(401);
    });
  });
});
