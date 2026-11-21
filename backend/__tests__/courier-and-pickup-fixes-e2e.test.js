import mongoose from "mongoose";
import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import Order from "../app/models/order.js";
import User from "../app/models/customer.js";
import Seller from "../app/models/seller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
delete process.env.SHIPROCKET_EMAIL;
delete process.env.SHIPROCKET_PASSWORD;

const { getOrderAutoCancelJobHandler } = await import("../app/jobs/orderAutoCancelJob.js");
const { sweepStuckReturnPickups, MAX_REBOOK_ATTEMPTS, REBOOK_GAP_MS } = await import("../app/services/order/returnPickupRecoveryService.js");
const { updateShiprocketReverseStatus } = await import("../app/services/shipping/shiprocketService.js");
const { processReturnPickupTimeoutJob } = await import("../app/services/orderWorkflowService.js");

jest.setTimeout(120000);
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);
const HOUR = 3600 * 1000;
const MIN = 60 * 1000;

(RUN ? describe : describe.skip)("courier orders are never auto-cancelled; return pickup failures are not rejections - real DB", () => {
  let customer, seller, seq = 0;
  const autoCancel = getOrderAutoCancelJobHandler();
  const reload = (o) => Order.findById(o._id).lean();

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `courier_fix_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });
  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    customer = await User.create({ name: "Rahul", phone: `90000${s.slice(-5)}`, role: "user", isVerified: true });
    seller = await Seller.create({ name: "S", email: `s_${s}@example.com`, phone: `91000${s.slice(-5)}`, password: "Password@123", shopName: "Shop", pincode: "452001", isVerified: true, isActive: true, applicationStatus: "approved", location: { type: "Point", coordinates: [75.87, 22.71] } });
  });
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  async function order(extra = {}) {
    seq += 1;
    return Order.create({
      orderId: `ORD-CP-${Date.now()}-${seq}`, customer: customer._id, seller: seller._id,
      items: [{ product: new mongoose.Types.ObjectId(), name: "Phone", quantity: 1, price: 1000 }],
      address: { name: "R", address: "x", city: "Pune", state: "MH", pincode: "411001", phone: "9876543210" },
      paymentMode: "COD", paymentStatus: "CREATED", status: "packed", orderStatus: "packed",
      workflowVersion: 2, workflowStatus: "PICKUP_READY", fulfillmentType: "LOCAL", ...extra,
    });
  }
  const ago = (ms) => new Date(Date.now() - ms);

  describe("1. courier (Shiprocket) orders are never cancelled by the stale-order job", () => {
    it("a courier parcel that has been on the road for 10 days stays exactly as it is", async () => {
      const o = await order({ fulfillmentType: "SHIPROCKET", status: "out_for_delivery", orderStatus: "out_for_delivery", workflowStatus: "OUT_FOR_DELIVERY", outForDeliveryAt: ago(9 * 24 * HOUR) });
      await Order.collection.updateOne({ _id: o._id }, { $set: { createdAt: ago(10 * 24 * HOUR) } });
      const packed = await order({ fulfillmentType: "SHIPROCKET" });
      await Order.collection.updateOne({ _id: packed._id }, { $set: { createdAt: ago(5 * 24 * HOUR) } });
      await autoCancel();
      expect((await reload(o)).status).toBe("out_for_delivery");
      expect((await reload(packed)).status).toBe("packed");
    });

    it("local orders are still cleaned up (unfulfilled > 24h; out for delivery > 12h)", async () => {
      const stuckLocal = await order({ status: "confirmed", orderStatus: "confirmed", workflowStatus: "SELLER_ACCEPTED" });
      await Order.collection.updateOne({ _id: stuckLocal._id }, { $set: { createdAt: ago(30 * HOUR) } });
      const outLocal = await order({ status: "out_for_delivery", orderStatus: "out_for_delivery", workflowStatus: "OUT_FOR_DELIVERY", outForDeliveryAt: ago(13 * HOUR) });
      const fresh = await order({ status: "confirmed", orderStatus: "confirmed", workflowStatus: "SELLER_ACCEPTED" });
      await autoCancel();
      expect((await reload(stuckLocal)).status).toBe("cancelled");
      expect((await reload(outLocal)).status).toBe("cancelled");
      expect((await reload(fresh)).status).toBe("confirmed");
    });
  });

  describe("2. the courier cancels the return pickup: the return is NOT rejected", () => {
    async function courierReturn(extra = {}) {
      return order({
        fulfillmentType: "SHIPROCKET", status: "delivered", orderStatus: "delivered", workflowStatus: "DELIVERED", deliveredAt: ago(HOUR),
        returnStatus: "return_pickup_assigned", returnReason: "Changed my mind", returnFault: "customer",
        returnItems: [{ product: new mongoose.Types.ObjectId(), name: "Phone", itemIndex: 0, quantity: 1, price: 1000, status: "approved" }],
        shiprocket: { reverseAwb: "SR_RET_111", reverseShipmentId: "SHP_RET_111", reverseCourierName: "Delhivery", reverseStatus: "REVERSE_PICKUP_SCHEDULED", history: [] },
        ...extra,
      });
    }

    it("reverse pickup cancelled by the courier -> back to 'approved', old booking cleared, never 'rejected'", async () => {
      const o = await courierReturn();
      const res = await updateShiprocketReverseStatus(o.orderId, { status: "REVERSE_CANCELLED", remarks: "Courier could not reach the customer" });
      expect(res.returnStatus).toBe("return_approved");
      const after = await reload(o);
      expect(after.returnStatus).toBe("return_approved");
      expect(after.returnRejectedReason || "").toBe("");
      expect(after.shiprocket.reverseAwb).toBeNull();
      expect(after.shiprocket.reverseStatus).toBe("REVERSE_CANCELLED");
      expect(after.returnPickupStuckAt).toBeTruthy();
      expect(after.returnPickupRecoveryAttempts).toBe(0);
    });

    it("the return can still be refunded afterwards (it was never closed): a new pickup is booked and the flow continues", async () => {
      const o = await courierReturn();
      await updateShiprocketReverseStatus(o.orderId, { status: "CANCELLED" });
      await Order.updateOne({ _id: o._id }, { $set: { returnPickupStuckAt: ago(15 * MIN) } });
      const s = await sweepStuckReturnPickups();
      expect(s.rebooked).toBe(1);
      const after = await reload(o);
      expect(after.returnStatus).toBe("return_pickup_assigned");
      expect(after.shiprocket.reverseAwb).toMatch(/^SR_RET_/);
      expect(after.returnPickupRecoveryAttempts).toBe(1);
    });

    it("other courier statuses still move the return along as before", async () => {
      const o = await courierReturn();
      const res = await updateShiprocketReverseStatus(o.orderId, { status: "PICKED_UP" });
      expect(res.returnStatus).toBe("return_in_transit");
    });
  });

  describe("4. an approved return whose pickup never started is retried and the admin is alerted", () => {
    const approvedCourier = (extra = {}) => order({
      fulfillmentType: "SHIPROCKET", status: "delivered", orderStatus: "delivered", workflowStatus: "DELIVERED",
      returnStatus: "return_approved", returnItems: [{ product: new mongoose.Types.ObjectId(), name: "Phone", itemIndex: 0, quantity: 1, price: 1000, status: "approved" }], ...extra,
    });

    it("first sweep only starts the clock; the booking is retried after 10 minutes", async () => {
      const o = await approvedCourier();
      const s1 = await sweepStuckReturnPickups();
      expect(s1.rebooked).toBe(0);
      expect((await reload(o)).returnPickupStuckAt).toBeTruthy();
      expect((await reload(o)).returnStatus).toBe("return_approved");
      await Order.updateOne({ _id: o._id }, { $set: { returnPickupStuckAt: ago(REBOOK_GAP_MS + MIN) } });
      expect((await sweepStuckReturnPickups()).rebooked).toBe(1);
      expect((await reload(o)).returnStatus).toBe("return_pickup_assigned");
    });

    it("after the maximum number of attempts the admin is alerted once, then again only after 24 hours", async () => {
      const o = await approvedCourier({ returnPickupStuckAt: ago(2 * HOUR), returnPickupRecoveryAttempts: MAX_REBOOK_ATTEMPTS, returnPickupRecoveryAt: ago(HOUR) });
      expect((await sweepStuckReturnPickups()).alerted).toBe(1);
      const first = (await reload(o)).returnPickupAlertedAt;
      expect(first).toBeTruthy();
      expect((await sweepStuckReturnPickups()).alerted).toBe(0);
      await Order.updateOne({ _id: o._id }, { $set: { returnPickupAlertedAt: ago(25 * HOUR) } });
      expect((await sweepStuckReturnPickups()).alerted).toBe(1);
      expect((await reload(o)).returnStatus).toBe("return_approved"); // never closed or rejected by the sweep
    });

    it("a return that already has a courier pickup is left alone", async () => {
      const o = await approvedCourier({ shiprocket: { reverseAwb: "SR_RET_9", history: [] }, returnPickupStuckAt: ago(5 * HOUR) });
      const s = await sweepStuckReturnPickups();
      expect(s).toMatchObject({ rebooked: 0, alerted: 0 });
      expect((await reload(o)).returnPickupAlertedAt).toBeNull();
    });

    it("local return with no delivery partner: told after 2 hours, again every 12 hours", async () => {
      const o = await order({ status: "delivered", orderStatus: "delivered", workflowStatus: "DELIVERED", returnStatus: "return_approved", returnPickupStuckAt: ago(30 * MIN) });
      expect((await sweepStuckReturnPickups()).alerted).toBe(0);
      await Order.updateOne({ _id: o._id }, { $set: { returnPickupStuckAt: ago(3 * HOUR) } });
      expect((await sweepStuckReturnPickups()).alerted).toBe(1);
      expect((await sweepStuckReturnPickups()).alerted).toBe(0);
      await Order.updateOne({ _id: o._id }, { $set: { returnPickupAlertedAt: ago(13 * HOUR) } });
      expect((await sweepStuckReturnPickups()).alerted).toBe(1);
    });

    it("returns in any other state are not touched", async () => {
      await order({ status: "delivered", returnStatus: "return_requested" });
      await order({ status: "delivered", returnStatus: "return_in_transit" });
      expect((await sweepStuckReturnPickups()).checked).toBe(0);
    });
  });

  describe("3. no delivery partner accepted the return pickup: the return stays approved (never 'rejected')", () => {
    it("after the last search round: status approved, no rejection text, the alert clock is set", async () => {
      const o = await order({
        status: "delivered", orderStatus: "delivered", workflowStatus: "DELIVERED",
        returnStatus: "return_pickup_assigned", returnDeliveryBoy: null,
        returnSearchExpiresAt: ago(MIN), returnSearchMeta: { attempt: 99, radiusMeters: 5000 },
      });
      await processReturnPickupTimeoutJob({ orderId: o.orderId, attempt: 99 });
      const after = await reload(o);
      expect(after.returnStatus).toBe("return_approved");
      expect(after.returnRejectedReason || "").toBe("");
      expect(after.returnPickupStuckAt).toBeTruthy();
      expect(after.returnPickupAlertedAt).toBeTruthy();
    });
  });
});
