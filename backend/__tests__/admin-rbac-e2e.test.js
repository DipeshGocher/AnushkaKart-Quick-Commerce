import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { jest } from "@jest/globals";

process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "admin-rbac-secret";

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");
const { default: Admin } = await import("../app/models/admin.js");
const { default: Ticket } = await import("../app/models/ticket.js");

jest.setTimeout(120000);

/**
 * REAL MongoDB test for admin panel role-based access (roles, staff logins, page access).
 * Runs only with RUN_E2E_TESTS=true and MONGO_URI_E2E (a throw-away local mongod; never MONGO_URI).
 * It empties every collection of its own database first, so it must never point at real data.
 */
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);

const MAIN_EMAIL = "owner@example.com";
const MAIN_PASSWORD = "OwnerPass@12345";
const STAFF_PASSWORD = "StaffPass@12345";

(RUN ? describe : describe.skip)("Admin role-based access - real DB", () => {
  let app;
  let mainToken;
  let mainId;

  const bearer = (token) => `Bearer ${token}`;
  const asMain = () => bearer(mainToken);

  async function login(email, password) {
    return request(app).post("/api/admin/login").send({ email, password });
  }

  async function makeRole(body) {
    const res = await request(app).post("/api/admin/staff/roles").set("Authorization", asMain()).send(body);
    expect(res.status).toBe(201);
    return res.body.result;
  }

  async function makeStaff(roleId, email, extra = {}) {
    const res = await request(app)
      .post("/api/admin/staff/members")
      .set("Authorization", asMain())
      .send({ name: "Staff Person", email, password: STAFF_PASSWORD, roleId, ...extra });
    expect(res.status).toBe(201);
    return res.body.result;
  }

  async function staffToken(email) {
    const res = await login(email, STAFF_PASSWORD);
    expect(res.status).toBe(200);
    return res.body.result.token;
  }

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: "2mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, {
      dbName: `admin_rbac_e2e_${Date.now()}`,
      serverSelectionTimeoutMS: 15000,
    });
    await Promise.all(
      Object.values(mongoose.models).map(async (m) => {
        await m.createCollection().catch(() => {});
        await m.init();
      }),
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    const main = await Admin.create({ name: "Owner", email: MAIN_EMAIL, password: MAIN_PASSWORD, role: "admin" });
    mainId = String(main._id);
    const res = await login(MAIN_EMAIL, MAIN_PASSWORD);
    expect(res.status).toBe(200);
    mainToken = res.body.result.token;
  });

  it("the main admin keeps full access and sees every page", async () => {
    const login200 = await login(MAIN_EMAIL, MAIN_PASSWORD);
    expect(login200.body.result.access.isMainAdmin).toBe(true);
    expect(jwt.decode(login200.body.result.token).rid).toBeUndefined();

    const me = await request(app).get("/api/admin/access").set("Authorization", asMain());
    expect(me.status).toBe(200);
    expect(me.body.result.isMainAdmin).toBe(true);
    expect(me.body.result.permissions).toContain("wallet");
    expect(me.body.result.permissions).toContain("support_tickets");

    const modules = await request(app).get("/api/admin/staff/modules").set("Authorization", asMain());
    expect(modules.status).toBe(200);
    expect(modules.body.result.modules.length).toBeGreaterThan(20);

    expect((await request(app).get("/api/admin/wallet-data").set("Authorization", asMain())).status).not.toBe(403);
  });

  it("an old main-admin token (no role claim) keeps working", async () => {
    const legacy = jwt.sign({ id: mainId, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const res = await request(app).get("/api/admin/staff/roles").set("Authorization", bearer(legacy));
    expect(res.status).toBe(200);
  });

  describe("defining roles", () => {
    it("creates a role from the pages the client ticks", async () => {
      const role = await makeRole({
        name: "Support Employee",
        description: "Answers customers",
        permissions: ["support_tickets", "reviews"],
        accessType: "write",
      });
      expect(role.permissions).toEqual(["support_tickets", "reviews"]);
      expect(role.memberCount).toBe(0);

      const list = await request(app).get("/api/admin/staff/roles").set("Authorization", asMain());
      expect(list.body.result.items.map((r) => r.name)).toEqual(["Support Employee"]);
    });

    it("refuses an empty page list, unknown pages, and a duplicate name (any letter case)", async () => {
      const send = (body) => request(app).post("/api/admin/staff/roles").set("Authorization", asMain()).send(body);
      expect((await send({ name: "Empty", permissions: [] })).status).toBe(400);
      expect((await send({ name: "Fake", permissions: ["hack_everything"] })).status).toBe(400);
      expect((await send({ name: "X", permissions: ["wallet"] })).status).toBe(400); // name too short
      await makeRole({ name: "Manager", permissions: ["wallet"] });
      const dup = await send({ name: "  manager ", permissions: ["orders"] });
      expect(dup.status).toBe(409);
    });

    it("edits a role and the staff on it get the change on their next click (no new login)", async () => {
      const role = await makeRole({ name: "Support Employee", permissions: ["support_tickets"] });
      await makeStaff(role.id, "emp@example.com");
      const token = await staffToken("emp@example.com");

      expect((await request(app).get("/api/admin/wallet-data").set("Authorization", bearer(token))).status).toBe(403);

      const edit = await request(app)
        .put(`/api/admin/staff/roles/${role.id}`)
        .set("Authorization", asMain())
        .send({ permissions: ["support_tickets", "wallet"] });
      expect(edit.status).toBe(200);
      expect(edit.body.result.memberCount).toBe(1);

      expect((await request(app).get("/api/admin/wallet-data").set("Authorization", bearer(token))).status).not.toBe(403);
      const access = await request(app).get("/api/admin/access").set("Authorization", bearer(token));
      expect(access.body.result.permissions).toEqual(["support_tickets", "wallet"]);
    });

    it("cannot delete a role while staff still use it", async () => {
      const role = await makeRole({ name: "Manager", permissions: ["wallet"] });
      const staff = await makeStaff(role.id, "mgr@example.com");

      const blocked = await request(app).delete(`/api/admin/staff/roles/${role.id}`).set("Authorization", asMain());
      expect(blocked.status).toBe(409);

      const del = await request(app).delete(`/api/admin/staff/members/${staff.id}`).set("Authorization", asMain());
      expect(del.status).toBe(200);
      const ok = await request(app).delete(`/api/admin/staff/roles/${role.id}`).set("Authorization", asMain());
      expect(ok.status).toBe(200);
    });
  });

  describe("creating staff logins", () => {
    it("creates a login that can sign in at the normal admin login", async () => {
      const role = await makeRole({ name: "Manager", permissions: ["wallet", "withdrawals"] });
      const staff = await makeStaff(role.id, "Mgr@Example.com", { phone: "9876501234" });
      expect(staff.email).toBe("mgr@example.com");
      expect(staff.password).toBeUndefined();
      expect(staff.role.name).toBe("Manager");

      const res = await login("mgr@example.com", STAFF_PASSWORD);
      expect(res.status).toBe(200);
      expect(res.body.result.access).toMatchObject({
        isMainAdmin: false,
        roleName: "Manager",
        permissions: ["wallet", "withdrawals"],
      });
      expect(res.body.result.admin.password).toBeUndefined();
      expect(jwt.decode(res.body.result.token).rid).toBe(role.id);
    });

    it("refuses a weak password, a duplicate email, an unknown role and an inactive role", async () => {
      const role = await makeRole({ name: "Manager", permissions: ["wallet"] });
      const post = (body) => request(app).post("/api/admin/staff/members").set("Authorization", asMain()).send(body);
      const base = { name: "Person", email: "p@example.com", password: STAFF_PASSWORD, roleId: role.id };

      expect((await post({ ...base, password: "short" })).status).toBe(400);
      expect((await post({ ...base, roleId: String(new mongoose.Types.ObjectId()) })).status).toBe(400);
      expect((await post({ ...base, roleId: "not-an-id" })).status).toBe(400);
      expect((await post(base)).status).toBe(201);
      expect((await post(base)).status).toBe(409);
      expect((await post({ ...base, email: MAIN_EMAIL })).status).toBe(409);

      await request(app).put(`/api/admin/staff/roles/${role.id}`).set("Authorization", asMain()).send({ isActive: false });
      expect((await post({ ...base, email: "other@example.com" })).status).toBe(400);
    });

    it("lists only the staff logins made here, not the main admin accounts", async () => {
      const empty = await request(app).get("/api/admin/staff/members").set("Authorization", asMain());
      expect(empty.body.result.items).toEqual([]);

      const role = await makeRole({ name: "Manager", permissions: ["wallet"] });
      await makeStaff(role.id, "mgr@example.com");
      const list = await request(app).get("/api/admin/staff/members").set("Authorization", asMain());
      expect(list.status).toBe(200);
      const rows = list.body.result.items;
      expect(rows.map((r) => r.email)).toEqual(["mgr@example.com"]);
      expect(rows.some((r) => r.email === MAIN_EMAIL)).toBe(false);
      expect(rows[0].role.name).toBe("Manager");
      expect(JSON.stringify(rows)).not.toMatch(/password/i);
    });

    it("never lets the staff API touch a main admin account", async () => {
      const edit = await request(app)
        .put(`/api/admin/staff/members/${mainId}`)
        .set("Authorization", asMain())
        .send({ isActive: false });
      expect(edit.status).toBe(403);
      const del = await request(app).delete(`/api/admin/staff/members/${mainId}`).set("Authorization", asMain());
      expect(del.status).toBe(403);
      expect((await login(MAIN_EMAIL, MAIN_PASSWORD)).status).toBe(200);
    });
  });

  describe("a support employee (Help Tickets only)", () => {
    let token;
    let ticketId;

    beforeEach(async () => {
      const role = await makeRole({ name: "Support Employee", permissions: ["support_tickets"] });
      await makeStaff(role.id, "support@example.com");
      token = await staffToken("support@example.com");
      const ticket = await Ticket.create({
        userId: new mongoose.Types.ObjectId(),
        userType: "User",
        subject: "Where is my order",
        description: "Please help",
        messages: [{ sender: "Customer", senderType: "User", text: "Please help" }],
      });
      ticketId = String(ticket._id);
    });

    const call = (method, url, body) => {
      const req = request(app)[method](url).set("Authorization", bearer(token));
      return body ? req.send(body) : req;
    };

    it("can see and work the tickets", async () => {
      const list = await call("get", "/api/tickets/admin/all");
      expect(list.status).toBe(200);
      expect(list.body.result.items).toHaveLength(1);

      const status = await call("patch", `/api/tickets/admin/status/${ticketId}`, { status: "processing" });
      expect(status.status).toBe(200);

      const reply = await call("post", `/api/tickets/reply/${ticketId}`, { text: "Checking now", isAdmin: true });
      expect(reply.status).toBe(200);
    });

    it("can open its own profile and the menu endpoint, and change its own password", async () => {
      expect((await call("get", "/api/admin/profile")).status).toBe(200);
      expect((await call("get", "/api/admin/access")).body.result.permissions).toEqual(["support_tickets"]);
      const wrong = await call("put", "/api/admin/profile/password", { currentPassword: "WrongPass@123", newPassword: "NewStaffPass@123" });
      expect(wrong.status).toBe(400); // refused for the wrong current password, not for access
    });

    it("is refused (403) on money, orders, customers, sellers, settings and staff pages", async () => {
      const denied = [
        ["get", "/api/admin/wallet-data"],
        ["get", "/api/admin/finance/summary"],
        ["put", "/api/admin/withdrawals/abc"],
        ["post", "/api/admin/settle-cash"],
        ["get", "/api/admin/users"],
        ["get", "/api/admin/sellers/active"],
        ["get", "/api/orders/seller-orders"],
        ["put", "/api/orders/status/ORD1"],
        ["put", "/api/settings"],
        ["get", "/api/employees"],
        ["get", "/api/admin/coupons"],
        ["get", "/api/emi/admin/quotes"],
        ["post", "/api/notifications/broadcast"],
        ["post", "/api/notifications/BROADCAST"],
        ["get", "/api/Admin/Wallet-Data"],
        ["get", "/api/admin/wallet-data/?x=1"],
        ["get", "/api/admin/staff/roles"],
        ["post", "/api/admin/staff/roles"],
        ["post", "/api/admin/staff/members"],
        ["put", `/api/admin/staff/members/${mainId}`],
        ["delete", `/api/admin/staff/members/${mainId}`],
        // a real route with no access rule (a customer route): staff are denied by default
        ["get", "/api/orders/my-orders"],
        ["post", "/api/tickets/create"],
      ];
      for (const [method, url] of denied) {
        const res = await call(method, url, method === "get" || method === "delete" ? undefined : {});
        expect([method, url, res.status]).toEqual([method, url, 403]);
      }
      // Express does not route a double slash at all (404) - the handler never runs, so it is never an opening.
      const odd = await call("get", "/api/admin//wallet-data");
      expect([403, 404]).toContain(odd.status);
    });

    it("cannot make itself a bigger role", async () => {
      const bigRole = await makeRole({ name: "Everything", permissions: ["wallet", "orders", "customers"] });
      const members = await request(app).get("/api/admin/staff/members").set("Authorization", asMain());
      const me = members.body.result.items.find((r) => r.email === "support@example.com");
      const res = await call("put", `/api/admin/staff/members/${me.id}`, { roleId: bigRole.id });
      expect(res.status).toBe(403);
      expect((await call("get", "/api/admin/wallet-data")).status).toBe(403);
    });

    it("loses everything the moment the main admin switches the login off, and gets it back when switched on", async () => {
      const members = await request(app).get("/api/admin/staff/members").set("Authorization", asMain());
      const me = members.body.result.items.find((r) => r.email === "support@example.com");

      const off = await request(app).put(`/api/admin/staff/members/${me.id}`).set("Authorization", asMain()).send({ isActive: false });
      expect(off.status).toBe(200);
      expect((await call("get", "/api/tickets/admin/all")).status).toBe(403);
      expect((await call("get", "/api/admin/profile")).status).toBe(403);
      expect((await login("support@example.com", STAFF_PASSWORD)).status).toBe(403);

      await request(app).put(`/api/admin/staff/members/${me.id}`).set("Authorization", asMain()).send({ isActive: true });
      expect((await call("get", "/api/tickets/admin/all")).status).toBe(200);
      expect((await login("support@example.com", STAFF_PASSWORD)).status).toBe(200);
    });

    it("loses access when its role is switched off", async () => {
      const roles = await request(app).get("/api/admin/staff/roles").set("Authorization", asMain());
      const role = roles.body.result.items.find((r) => r.name === "Support Employee");
      await request(app).put(`/api/admin/staff/roles/${role.id}`).set("Authorization", asMain()).send({ isActive: false });
      expect((await call("get", "/api/tickets/admin/all")).status).toBe(403);
      expect((await login("support@example.com", STAFF_PASSWORD)).status).toBe(403);
    });

    it("is signed out (401) once the login is deleted", async () => {
      const members = await request(app).get("/api/admin/staff/members").set("Authorization", asMain());
      const me = members.body.result.items.find((r) => r.email === "support@example.com");
      await request(app).delete(`/api/admin/staff/members/${me.id}`).set("Authorization", asMain());
      expect((await call("get", "/api/tickets/admin/all")).status).toBe(401);
    });

    it("password reset by the main admin works and the old password stops working", async () => {
      const members = await request(app).get("/api/admin/staff/members").set("Authorization", asMain());
      const me = members.body.result.items.find((r) => r.email === "support@example.com");
      const weak = await request(app).put(`/api/admin/staff/members/${me.id}`).set("Authorization", asMain()).send({ password: "weak" });
      expect(weak.status).toBe(400);
      const ok = await request(app).put(`/api/admin/staff/members/${me.id}`).set("Authorization", asMain()).send({ password: "BrandNewPass@123" });
      expect(ok.status).toBe(200);
      expect((await login("support@example.com", STAFF_PASSWORD)).status).toBe(401);
      expect((await login("support@example.com", "BrandNewPass@123")).status).toBe(200);
    });
  });

  describe("a manager (money pages)", () => {
    it("can use the money pages and nothing else", async () => {
      const role = await makeRole({ name: "Manager", permissions: ["wallet", "withdrawals", "cash_collection"] });
      await makeStaff(role.id, "manager@example.com");
      const token = await staffToken("manager@example.com");
      const get = (url) => request(app).get(url).set("Authorization", bearer(token));

      expect((await get("/api/admin/wallet-data")).status).not.toBe(403);
      expect((await get("/api/admin/seller-withdrawals")).status).not.toBe(403);
      expect((await get("/api/admin/customer-withdrawals")).status).not.toBe(403);
      expect((await get("/api/admin/cash-history")).status).not.toBe(403);

      expect((await get("/api/tickets/admin/all")).status).toBe(403);
      expect((await get("/api/admin/users")).status).toBe(403);
      expect((await get("/api/orders/seller-orders")).status).toBe(403);
      expect((await get("/api/admin/staff/roles")).status).toBe(403);
    });
  });

  describe("a view-only role", () => {
    it("can look at its pages but every change is refused", async () => {
      const role = await makeRole({ name: "Order Viewer", permissions: ["orders"], accessType: "read" });
      await makeStaff(role.id, "viewer@example.com");
      const token = await staffToken("viewer@example.com");

      const list = await request(app).get("/api/orders/seller-orders").set("Authorization", bearer(token));
      expect(list.status).toBe(200);

      const change = await request(app).put("/api/orders/status/ORD-NOPE").set("Authorization", bearer(token)).send({ status: "confirmed" });
      expect(change.status).toBe(403);
      expect(change.body.message).toMatch(/view-only/i);

      const approve = await request(app).post("/api/orders/ORD-NOPE/payment/approve-upi").set("Authorization", bearer(token)).send({});
      expect(approve.status).toBe(403);
    });
  });

  describe("other logins are not affected", () => {
    it("a seller or customer token is still refused on admin routes, and a forged staff token is refused", async () => {
      const seller = jwt.sign({ id: String(new mongoose.Types.ObjectId()), role: "seller" }, process.env.JWT_SECRET);
      const customer = jwt.sign({ id: String(new mongoose.Types.ObjectId()), role: "user" }, process.env.JWT_SECRET);
      expect((await request(app).get("/api/admin/staff/roles").set("Authorization", bearer(seller))).status).toBe(403);
      expect((await request(app).get("/api/admin/staff/roles").set("Authorization", bearer(customer))).status).toBe(403);

      const ghost = jwt.sign({ id: String(new mongoose.Types.ObjectId()), role: "admin", rid: String(new mongoose.Types.ObjectId()) }, process.env.JWT_SECRET);
      expect((await request(app).get("/api/tickets/admin/all").set("Authorization", bearer(ghost))).status).toBe(401);

      const unsigned = jwt.sign({ id: mainId, role: "admin" }, "some-other-secret");
      expect((await request(app).get("/api/admin/staff/roles").set("Authorization", bearer(unsigned))).status).toBe(401);
    });
  });
});
