import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";

const svc = await import("../app/services/shipping/shiprocketService.js");

const ENV_KEYS = ["NODE_ENV", "SHIPROCKET_EMAIL", "SHIPROCKET_PASSWORD", "SHIPROCKET_SIMULATION"];
const saved = {};
beforeAll(() => ENV_KEYS.forEach((k) => { saved[k] = process.env[k]; }));
afterAll(() => ENV_KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }));
beforeEach(() => {
  delete process.env.SHIPROCKET_EMAIL;
  delete process.env.SHIPROCKET_PASSWORD;
  delete process.env.SHIPROCKET_SIMULATION;
  process.env.NODE_ENV = "production";
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

const courierOrder = (extra = {}) => ({
  _id: "o1", orderId: "ORD-SIM-1", fulfillmentType: "SHIPROCKET", status: "confirmed", orderStatus: "confirmed",
  paymentMode: "ONLINE", paymentStatus: "PAID", workflowVersion: 2, workflowStatus: "SELLER_ACCEPTED",
  address: { name: "R", address: "12 MG Road", city: "Pune", state: "MH", pincode: "411001", phone: "9876543210" },
  customer: "c1", seller: "s1", items: [{ product: "p1", name: "Phone", quantity: 1, price: 1000 }],
  shiprocket: { history: [] },
  save: jest.fn().mockResolvedValue(true),
  ...extra,
});

describe("courier test mode (SHIPROCKET_SIMULATION)", () => {
  describe("production server WITHOUT the switch: nothing is faked", () => {
    test("the switch is off and nothing is simulated", () => {
      expect(svc.isShiprocketSimulationAllowed()).toBe(false);
      expect(svc.isShiprocketSimulated()).toBe(false);
    });
    test("booking a courier is refused with the 'not configured' error (503)", async () => {
      await expect(svc.processShiprocketOrder(courierOrder())).rejects.toMatchObject({ statusCode: 503, message: expect.stringMatching(/credentials are not configured/) });
    });
    test("AWB, pickup, label, reverse pickup and cancel are refused too", async () => {
      const withShipment = () => courierOrder({ shiprocket: { shipmentId: "SHP1", shiprocketOrderId: "SRO1", currentStatus: "AWB_ASSIGNED", awb: null, history: [] } });
      await expect(svc.assignShiprocketAwb(withShipment())).rejects.toMatchObject({ statusCode: 503 });
      await expect(svc.requestShiprocketPickup(courierOrder({ shiprocket: { shipmentId: "SHP1", awb: "AWB1", history: [] } }))).rejects.toMatchObject({ statusCode: 503 });
      await expect(svc.getShiprocketLabel(courierOrder({ shiprocket: { shipmentId: "SHP1", awb: "AWB1", history: [] } }))).rejects.toMatchObject({ statusCode: 503 });
      await expect(svc.cancelShiprocketShipmentForOrder(withShipment())).rejects.toMatchObject({ statusCode: 503 });
    });
  });

  describe("production server WITH SHIPROCKET_SIMULATION=true: a client can test the whole flow", () => {
    beforeEach(() => { process.env.SHIPROCKET_SIMULATION = "true"; });

    test("simulation is on", () => {
      expect(svc.isShiprocketSimulationAllowed()).toBe(true);
      expect(svc.isShiprocketSimulated()).toBe(true);
    });
    test("booking creates a fake shipment that is clearly marked as simulated", async () => {
      const order = courierOrder();
      const res = await svc.processShiprocketOrder(order);
      expect(res.success).toBe(true);
      expect(order.shiprocket.simulated).toBe(true);
      expect(order.shiprocket.awb).toMatch(/^SR\d+IN$/);
      expect(order.shiprocket.currentStatus).toBe("AWB_ASSIGNED");
      expect(order.save).toHaveBeenCalled();
    });
    test("AWB assignment, pickup booking and cancel work and are marked simulated", async () => {
      const a = courierOrder({ shiprocket: { shipmentId: "SHP1", shiprocketOrderId: "SRO1", currentStatus: "AWB_ASSIGNED", awb: null, history: [] } });
      const r = await svc.assignShiprocketAwb(a);
      expect(r.simulated).toBe(true);
      expect(a.shiprocket.simulated).toBe(true);

      const p = courierOrder({ shiprocket: { shipmentId: "SHP1", awb: "SR1IN", currentStatus: "AWB_ASSIGNED", history: [] } });
      await svc.requestShiprocketPickup(p);
      expect(p.shiprocket.currentStatus).toBe("PICKUP_SCHEDULED");

      const c = courierOrder({ shiprocket: { shipmentId: "SHP1", shiprocketOrderId: "SRO1", awb: "SR1IN", currentStatus: "PICKUP_SCHEDULED", history: [] } });
      const cancelled = await svc.cancelShiprocketShipmentForOrder(c);
      expect(cancelled.cancelled).toBe(true);
      expect(c.shiprocket.currentStatus).toBe("CANCELLED");
    });
    test("a simulated return pickup is marked simulated", async () => {
      const order = courierOrder({ seller: null, status: "delivered", returnStatus: "return_approved", returnItems: [], shiprocket: { shipmentId: "SHP1", awb: "SR1IN", currentStatus: "DELIVERED", history: [] } });
      const r = await svc.createShiprocketReversePickup(order);
      expect(r.mode).toBe("SIMULATED");
      expect(order.shiprocket.simulated).toBe(true);
      expect(order.shiprocket.reverseAwb).toMatch(/^SR_RET_/);
    });
    test("with REAL credentials present the switch does nothing: nothing is faked", () => {
      process.env.SHIPROCKET_EMAIL = "api@example.com";
      process.env.SHIPROCKET_PASSWORD = "secret";
      expect(svc.isShiprocketConfigured()).toBe(true);
      expect(svc.isShiprocketSimulated()).toBe(false);
    });
    test("only the exact value 'true' turns it on", () => {
      for (const v of ["", "false", "1", "yes", "off"]) {
        process.env.SHIPROCKET_SIMULATION = v;
        expect(svc.isShiprocketSimulationAllowed()).toBe(false);
      }
      process.env.SHIPROCKET_SIMULATION = " TRUE ";
      expect(svc.isShiprocketSimulationAllowed()).toBe(true);
    });
  });

  describe("outside production (local development)", () => {
    test("simulation works without any switch, as before", async () => {
      process.env.NODE_ENV = "development";
      expect(svc.isShiprocketSimulated()).toBe(true);
      const order = courierOrder();
      await svc.processShiprocketOrder(order);
      expect(order.shiprocket.simulated).toBe(true);
    });
  });
});
