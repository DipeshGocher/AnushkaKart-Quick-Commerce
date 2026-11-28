import express from "express";
import mongoose from "mongoose";
import request from "supertest";
import axios from "axios";
import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import Seller from "../app/models/seller.js";
import OtpVerification from "../app/models/otpVerification.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "seller-signup-secret";
// OTP in test mode (no SMS / email is sent) and no courier credentials (no Shiprocket call).
process.env.USE_REAL_SMS = "false";
delete process.env.SHIPROCKET_EMAIL;
delete process.env.SHIPROCKET_PASSWORD;

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");

jest.setTimeout(120000);

/**
 * REAL MongoDB test of seller registration: no OTP for the email and none for the contact number.
 * Runs only with RUN_E2E_TESTS=true and MONGO_URI_E2E (throw-away mongod; never MONGO_URI).
 */
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);

(RUN ? describe : describe.skip)("Seller signup - no OTP - real DB", () => {
  let app;
  let n = 0;

  const docs = JSON.stringify({
    tradeLicense: "https://example.com/trade-license.pdf",
    gstCertificate: "https://example.com/gst.pdf",
    idProof: "https://example.com/id-proof.pdf",
  });
  const person = () => {
    n += 1;
    return { email: `owner${Date.now()}${n}@example.com`, phone: `98765${String(Date.now()).slice(-5)}`.slice(0, 10) };
  };
  const sendOtp = (body) => request(app).post("/api/seller/verification/send-otp").send(body);
  const verifyOtp = (body) => request(app).post("/api/seller/verification/verify-otp").send(body);
  const signup = (fields) => {
    const req = request(app).post("/api/seller/signup");
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) req.field(k, v);
    return req;
  };
  const baseFields = (p, extra = {}) => ({
    name: "Seller Owner", email: p.email, phone: p.phone, password: "secret123", shopName: "Noyo Mart",
    category: "Groceries", address: "MG Road, Civil Lines", city: "Jhansi", state: "Uttar Pradesh", pincode: "284001",
    documents: docs, ...extra,
  });
  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: "5mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `seller_signup_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });
  beforeEach(async () => {
    jest.spyOn(axios, "post").mockRejectedValue(new Error("no network in this test"));
    await Seller.deleteMany({});
    await OtpVerification.deleteMany({});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  it("register straight from the form, no OTP anywhere: pending admin approval", async () => {
    const p = person();
    const res = await signup(baseFields(p));
    expect(res.status).toBe(201);
    expect(res.body.result).toMatchObject({ applicationStatus: "pending", requiresApproval: true });

    const seller = await Seller.findOne({ phone: p.phone }).lean();
    expect(seller).toMatchObject({ email: p.email, phoneVerified: false, emailVerified: false, isVerified: false, isActive: false, applicationStatus: "pending" });
    expect(await OtpVerification.countDocuments({})).toBe(0);
  });

  it("a pending seller can not log in until the admin approves", async () => {
    const p = person();
    expect((await signup(baseFields(p))).status).toBe(201);
    const login = await request(app).post("/api/seller/login").send({ emailOrPhone: p.phone, password: "secret123" });
    expect(login.status).not.toBe(200);
  });

  it("the OTP endpoints refuse everything: no SMS and no email can be sent through them", async () => {
    const p = person();
    for (const channel of ["phone", "email"]) {
      const send = await sendOtp({ channel, phone: p.phone, email: p.email });
      expect(send.status).toBe(400);
      expect(send.body.message).toMatch(/OTP is not used/i);
      expect((await verifyOtp({ channel, phone: p.phone, email: p.email, otp: "1234" })).status).toBe(400);
    }
    expect(await OtpVerification.countDocuments({})).toBe(0);
  });

  it("a wrong-looking email or phone is refused", async () => {
    const p = person();
    expect((await signup(baseFields(p, { email: "nope" }))).status).toBe(400);
    expect((await signup(baseFields(p, { phone: "12345" }))).status).toBe(400);
    expect(await Seller.countDocuments({})).toBe(0);
  });

  it("an email or phone that is already registered is refused", async () => {
    const p = person();
    expect((await signup(baseFields(p))).status).toBe(201);
    const sameEmail = await signup(baseFields({ email: p.email, phone: person().phone }));
    expect(sameEmail.status).toBe(400);
    expect(sameEmail.body.message).toMatch(/already exists/i);
    const samePhone = await signup(baseFields({ email: person().email, phone: p.phone }));
    expect(samePhone.status).toBe(400);
    expect(samePhone.body.message).toMatch(/already exists/i);
  });
});
