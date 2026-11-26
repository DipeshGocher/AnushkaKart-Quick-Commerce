import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { jest } from "@jest/globals";
import { ADMIN_API_CALLS } from "./helpers/adminApiCalls.js";

process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "admin-rbac-regression-secret";

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");
const { default: Admin } = await import("../app/models/admin.js");
const { MODULE_KEYS, decideAdminAccess } = await import("../app/config/adminAccess.js");

jest.setTimeout(300000);

/**
 * Regression sweep for admin role-based access, on a REAL throw-away MongoDB.
 *   1. The main admin (old-style token and a fresh login token) is never refused by the new access check.
 *   2. A staff login that has EVERY page works like the main admin everywhere except Staff & Roles.
 *   3. Restricted roles are allowed/refused exactly as the rule table says, on the real server.
 *   4. Customer / seller / delivery logins are unaffected.
 * Runs only with RUN_E2E_TESTS=true and MONGO_URI_E2E; it empties its own database first.
 */
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);

const PASSWORD = "OwnerPass@12345";
const STAFF_PASSWORD = "StaffPass@12345";
const RBAC_MESSAGES = /do not have access|view-only|switched off|Only the main admin|Unable to verify admin access/i;

(RUN ? describe : describe.skip)("Admin role-based access - regression sweep (real DB)", () => {
  let app;
  let mainId;
  let legacyToken; // token shaped like every token issued before roles existed
  let loginToken; // token from the real login
  let seq = 0;

  const send = (method, url, token) => {
    const req = request(app)[method.toLowerCase()](url).set("Authorization", `Bearer ${token}`);
    return method === "GET" || method === "DELETE" ? req : req.send({});
  };

  async function login(email, password) {
    return request(app).post("/api/admin/login").send({ email, password });
  }

  async function staffTokenFor(permissions, accessType = "write") {
    seq += 1;
    const role = await request(app)
      .post("/api/admin/staff/roles")
      .set("Authorization", `Bearer ${loginToken}`)
      .send({ name: `Role ${seq}`, permissions, accessType });
    expect(role.status).toBe(201);
    const email = `staff${seq}@example.com`;
    const staff = await request(app)
      .post("/api/admin/staff/members")
      .set("Authorization", `Bearer ${loginToken}`)
      .send({ name: `Staff ${seq}`, email, password: STAFF_PASSWORD, roleId: role.body.result.id });
    expect(staff.status).toBe(201);
    const res = await login(email, STAFF_PASSWORD);
    expect(res.status).toBe(200);
    return res.body.result.token;
  }

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: "2mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, {
      dbName: `admin_rbac_regression_${Date.now()}`,
      serverSelectionTimeoutMS: 15000,
    });
    await Promise.all(
      Object.values(mongoose.models).map(async (m) => {
        await m.createCollection().catch(() => {});
        await m.init();
      }),
    );
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    const main = await Admin.create({ name: "Owner", email: "owner@example.com", password: PASSWORD, role: "admin" });
    mainId = String(main._id);
    legacyToken = jwt.sign({ id: mainId, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "2h" });
    const res = await login("owner@example.com", PASSWORD);
    expect(res.status).toBe(200);
    loginToken = res.body.result.token;
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("covers a meaningful number of admin calls", () => {
    expect(ADMIN_API_CALLS.length).toBeGreaterThan(70);
  });

  it("the main admin is never refused by the access check (old-style token and login token)", async () => {
    const problems = [];
    for (const [method, url] of ADMIN_API_CALLS) {
      for (const token of [legacyToken, loginToken]) {
        const res = await send(method, url, token);
        const refusedByRbac = res.status === 401 || (res.status === 403 && RBAC_MESSAGES.test(res.body?.message || ""));
        if (refusedByRbac || res.body?.message === "Unable to verify admin access") {
          problems.push(`${method} ${url} -> ${res.status} ${res.body?.message}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("a staff login with every page works like the main admin on every admin call", async () => {
    const token = await staffTokenFor(MODULE_KEYS);
    const problems = [];
    for (const [method, url] of ADMIN_API_CALLS) {
      const main = await send(method, url, loginToken);
      const staff = await send(method, url, token);
      if (staff.status === 401 || (staff.status === 403 && RBAC_MESSAGES.test(staff.body?.message || ""))) {
        problems.push(`${method} ${url} -> staff ${staff.status} ${staff.body?.message}`);
      } else if (staff.status !== main.status) {
        problems.push(`${method} ${url} -> main ${main.status} but staff ${staff.status}`);
      }
    }
    expect(problems).toEqual([]);

    // ...but still not Staff & Roles
    expect((await send("GET", "/api/admin/staff/roles", token)).status).toBe(403);
    expect((await send("POST", "/api/admin/staff/members", token)).status).toBe(403);
  });

  describe.each([
    ["Help Tickets only", ["support_tickets"], "write"],
    ["money pages", ["wallet", "withdrawals", "cash_collection", "billing"], "write"],
    ["Orders, view only", ["orders"], "read"],
  ])("restricted role: %s", (_label, permissions, accessType) => {
    it("the real server allows and refuses exactly what the rule table says", async () => {
      const token = await staffTokenFor(permissions, accessType);
      const access = { isSuper: false, permissions, accessType };
      const problems = [];
      for (const [method, url] of ADMIN_API_CALLS) {
        const expected = decideAdminAccess(access, method, url).allowed;
        const res = await send(method, url, token);
        const refused = res.status === 403 && RBAC_MESSAGES.test(res.body?.message || "");
        if (expected && (refused || res.status === 401)) problems.push(`should be ALLOWED: ${method} ${url} -> ${res.status} ${res.body?.message}`);
        if (!expected && !refused) {
          // Some GETs are public pages with no login check at all (categories, FAQs). If a visitor with no
          // token gets the same answer, it is public data and there is nothing to refuse.
          const visitor = await request(app).get(url);
          const isPublicRead = method === "GET" && visitor.status === res.status && visitor.status !== 401 && visitor.status !== 403;
          if (!isPublicRead) problems.push(`should be REFUSED: ${method} ${url} -> ${res.status}`);
        }
      }
      expect(problems).toEqual([]);
    });
  });

  describe("other logins are untouched", () => {
    const tok = (role) => jwt.sign({ id: String(new mongoose.Types.ObjectId()), role }, process.env.JWT_SECRET, { expiresIn: "1h" });

    it("customer: own endpoints still work, admin ones still refused", async () => {
      const customer = tok("user");
      expect((await send("GET", "/api/orders/my-orders", customer)).status).toBe(200);
      for (const [method, url] of [
        ["GET", "/api/admin/wallet-data"],
        ["GET", "/api/tickets/admin/all"],
        ["GET", "/api/admin/staff/roles"],
        ["GET", "/api/admin/access"],
      ]) {
        expect([method, url, (await send(method, url, customer)).status]).toEqual([method, url, 403]);
      }
    });

    it("seller and delivery: admin endpoints refused, no 500 from the new check", async () => {
      for (const role of ["seller", "delivery"]) {
        const t = tok(role);
        for (const [method, url] of [
          ["GET", "/api/admin/wallet-data"],
          ["GET", "/api/admin/access"],
          ["GET", "/api/admin/staff/members"],
        ]) {
          expect([role, method, url, (await send(method, url, t)).status]).toEqual([role, method, url, 403]);
        }
      }
    });

    it("missing / garbage / wrongly signed tokens are still 401", async () => {
      expect((await request(app).get("/api/admin/wallet-data")).status).toBe(401);
      expect((await send("GET", "/api/admin/wallet-data", "not.a.token")).status).toBe(401);
      expect((await send("GET", "/api/admin/wallet-data", jwt.sign({ id: mainId, role: "admin" }, "other-secret"))).status).toBe(401);
      expect((await send("GET", "/api/orders/my-orders", jwt.sign({ id: mainId, role: "user" }, "other-secret"))).status).toBe(401);
    });

    it("an expired main-admin token is still 401", async () => {
      const expired = jwt.sign({ id: mainId, role: "admin" }, process.env.JWT_SECRET, { expiresIn: -10 });
      expect((await send("GET", "/api/admin/wallet-data", expired)).status).toBe(401);
    });

    it("public pages work with no token at all", async () => {
      for (const url of ["/api/settings", "/api/categories", "/api/products", "/api/public/faqs", "/api/legal", "/api/health"]) {
        const res = await request(app).get(url);
        expect([url, res.status < 500 && res.status !== 401 && res.status !== 403]).toEqual([url, true]);
      }
    });
  });
});
