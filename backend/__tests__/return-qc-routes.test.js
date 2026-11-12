import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { jest } from "@jest/globals";

process.env.JWT_SECRET = process.env.JWT_SECRET || "return-qc-routes-test-secret";
process.env.REDIS_DISABLED = "true";

// Starts a never-ending cache cleanup timer at import time; irrelevant to routing.
jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");
const app = express();
app.use(express.json());
setupRoutes(app);

const token = (role) => jwt.sign({ id: "64b7f0f0f0f0f0f0f0f0f0f0", role }, process.env.JWT_SECRET);

describe("return QC / dispute routes are role-protected", () => {
  const dispute = ["post", "/api/orders/returns/ORD-1/dispute"];
  const resolve = ["put", "/api/orders/returns/ORD-1/dispute/resolve"];
  const qc = ["put", "/api/orders/returns/ORD-1/qc"];

  it.each([dispute, resolve, qc])("%s %s needs a login", async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(401);
  });

  it("only a customer can raise a dispute (seller/admin/rider are refused)", async () => {
    for (const role of ["seller", "admin", "delivery"]) {
      const res = await request(app).post(dispute[1]).set("Authorization", `Bearer ${token(role)}`).send({});
      expect([401, 403]).toContain(res.status);
    }
  });

  it("only an admin can resolve a dispute (customer/seller/rider are refused)", async () => {
    for (const role of ["customer", "user", "seller", "delivery"]) {
      const res = await request(app).put(resolve[1]).set("Authorization", `Bearer ${token(role)}`).send({ decision: "customer", note: "valid note here" });
      expect([401, 403]).toContain(res.status);
    }
  });

  it("a customer cannot perform QC on their own return", async () => {
    for (const role of ["customer", "user", "delivery"]) {
      const res = await request(app).put(qc[1]).set("Authorization", `Bearer ${token(role)}`).send({ qcStatus: "qc_passed" });
      expect([401, 403]).toContain(res.status);
    }
  });
});
