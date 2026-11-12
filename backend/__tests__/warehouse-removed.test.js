import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { jest } from "@jest/globals";

process.env.JWT_SECRET = process.env.JWT_SECRET || "warehouse-removed-test-secret";
process.env.REDIS_DISABLED = "true";

// This module starts a never-ending cache-cleanup timer at import time, which
// would keep jest alive after the tests finish. Not relevant to routing.
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

/** Every concrete route path + mount point registered on the real app. */
function collectPaths(stack, prefix = "", out = []) {
  for (const layer of stack || []) {
    if (layer.route) {
      out.push(`${prefix}${layer.route.path}`);
    } else if (layer.handle?.stack) {
      const mount = layer.regexp?.source || "";
      out.push(`MOUNT ${mount}`);
      collectPaths(layer.handle.stack, prefix, out);
    }
  }
  return out;
}

describe("warehouse feature is fully removed", () => {
  it("registers no route or mount that mentions a warehouse", () => {
    const paths = collectPaths(app._router?.stack ?? app.router?.stack);
    expect(paths.length).toBeGreaterThan(50); // we really walked the whole app
    expect(paths.filter((p) => /warehouse/i.test(p))).toEqual([]);
  });

  it.each([
    ["post", "/api/warehouse/login"],
    ["post", "/api/warehouse/signup"],
    ["get", "/api/warehouse/nearby"],
    ["get", "/api/warehouse/stats"],
    ["get", "/api/admin/warehouses/active"],
    ["get", "/api/admin/warehouses/pending"],
    ["get", "/api/admin/warehouse-withdrawals"],
    ["get", "/api/admin/warehouse-queue/all"],
    ["get", "/api/delivery/warehouse/queue"],
    ["post", "/api/delivery/warehouse/checkin"],
  ])("%s %s is gone (404 even for an admin token)", async (method, url) => {
    const res = await request(app)[method](url).set("Authorization", `Bearer ${token("admin")}`).send({});
    expect(res.status).toBe(404);
  });

  it("a leftover warehouse-role token cannot use seller/admin/rider APIs", async () => {
    const t = token("warehouse");
    for (const [method, url] of [
      ["get", "/api/orders/seller-orders"],
      ["put", "/api/orders/status/ORD-1"],
      ["get", "/api/products/seller/me"],
      ["post", "/api/products/adjust-stock"],
      ["post", "/api/shipping/shiprocket/process/ORD-1"],
      ["get", "/api/delivery/profile"],
    ]) {
      const res = await request(app)[method](url).set("Authorization", `Bearer ${t}`).send({});
      expect([401, 403]).toContain(res.status);
    }
  });

  it("the rest of the API is still mounted (auth, not 404)", async () => {
    for (const url of ["/api/orders/seller-orders", "/api/delivery/profile", "/api/admin/dashboard"]) {
      const res = await request(app).get(url);
      expect(res.status).toBe(401);
    }
  });
});
