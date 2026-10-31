import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { jest } from "@jest/globals";

process.env.JWT_SECRET = process.env.JWT_SECRET || "access-control-test-secret";
process.env.REDIS_DISABLED = "true";

// Handlers must never run in these tests: every request below is expected to be
// stopped by the auth middleware. Stub the controllers so a regression shows up
// as a 200 from the stub instead of touching a database.
const reached = (req, res) => res.status(200).json({ success: true, message: "handler reached" });
jest.unstable_mockModule("../app/controller/couponController.js", () => ({
  listCoupons: reached, createCoupon: reached, updateCoupon: reached,
  deleteCoupon: reached, validateCoupon: reached,
}));
jest.unstable_mockModule("../app/controller/faqController.js", () => ({
  getFAQs: reached, createFAQ: reached, updateFAQ: reached, deleteFAQ: reached,
}));

const { default: couponRoutes } = await import("../app/routes/couponRoutes.js");
const { default: faqRoutes } = await import("../app/routes/faqRoutes.js");
const { default: deliveryRoutes } = await import("../app/routes/deliveryAuth.js");

const app = express();
app.use(express.json());
app.use("/api", couponRoutes);
app.use("/api/admin/faqs", faqRoutes);
app.use("/api/public/faqs", faqRoutes);
app.use("/api/delivery", deliveryRoutes);

const token = (role) => jwt.sign({ id: "64b7f0f0f0f0f0f0f0f0f0f0", role }, process.env.JWT_SECRET);
const ID = "64b7f0f0f0f0f0f0f0f0f0f0";

describe("route access control", () => {
  describe.each([
    ["get", "/api/admin/coupons"],
    ["post", "/api/admin/coupons"],
    ["put", `/api/admin/coupons/${ID}`],
    ["delete", `/api/admin/coupons/${ID}`],
    ["post", "/api/admin/faqs"],
    ["put", `/api/admin/faqs/${ID}`],
    ["delete", `/api/admin/faqs/${ID}`],
    ["post", "/api/public/faqs"],
    ["put", `/api/public/faqs/${ID}`],
    ["delete", `/api/public/faqs/${ID}`],
  ])("%s %s is admin-only", (method, url) => {
    it("rejects anonymous callers", async () => {
      expect((await request(app)[method](url).send({})).status).toBe(401);
    });
    it("rejects customers", async () => {
      const res = await request(app)[method](url).set("Authorization", `Bearer ${token("user")}`).send({});
      expect(res.status).toBe(403);
    });
    it("lets admins through", async () => {
      const res = await request(app)[method](url).set("Authorization", `Bearer ${token("admin")}`).send({});
      expect(res.status).toBe(200);
    });
  });

  it.each([
    ["get", "/api/delivery/profile"],
    ["put", "/api/delivery/profile"],
    ["get", "/api/delivery/stats"],
    ["get", "/api/delivery/earnings"],
    ["get", "/api/delivery/withdrawals"],
    ["post", "/api/delivery/request-withdrawal"],
    ["post", "/api/delivery/location"],
    ["post", "/api/delivery/upload-document"],
    ["delete", "/api/delivery/delete-account"],
  ])("%s %s refuses non-rider tokens", async (method, url) => {
    for (const role of ["user", "seller", "warehouse"]) {
      const res = await request(app)[method](url).set("Authorization", `Bearer ${token(role)}`).send({});
      expect(res.status).toBe(403);
    }
  });

  it("keeps public reads open", async () => {
    expect((await request(app).get("/api/coupons")).status).toBe(200);
    expect((await request(app).get("/api/public/faqs")).status).toBe(200);
    expect((await request(app).get("/api/admin/faqs")).status).toBe(200);
    expect((await request(app).post("/api/coupons/validate").send({})).status).toBe(200);
  });
});
