import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import Order from "../app/models/order.js";
import User from "../app/models/customer.js";
import Seller from "../app/models/seller.js";
import Category from "../app/models/category.js";
import Product from "../app/models/product.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "my-orders-reviews-secret";

jest.unstable_mockModule("../app/services/translationService.js", () => ({
  translateText: jest.fn(),
  translateBatch: jest.fn(),
  translateObject: jest.fn(),
}));

const { default: setupRoutes } = await import("../app/routes/index.js");

jest.setTimeout(120000);

/**
 * REAL MongoDB test for the My Orders page: items carry their header category (for the category
 * chips), and Rate & Review works only for delivered products. Runs only with RUN_E2E_TESTS=true and
 * MONGO_URI_E2E (a throw-away local mongod; never MONGO_URI).
 */
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);

(RUN ? describe : describe.skip)("My Orders: header categories + Rate & Review - real DB", () => {
  let app;
  let ctx;
  let seq = 0;

  const tok = (id) => `Bearer ${jwt.sign({ id: String(id), role: "user" }, process.env.JWT_SECRET, { expiresIn: "2h" })}`;

  async function seed() {
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const me = await User.create({ name: "Rahul", phone: `90000${s.slice(-5)}`, role: "user", isVerified: true });
    const other = await User.create({ name: "Other", phone: `90001${s.slice(-5)}`, role: "user", isVerified: true });
    const seller = await Seller.create({
      name: "S", email: `s_${s}@example.com`, phone: `91000${s.slice(-5)}`, password: "Password@123",
      shopName: "Shop", pincode: "452001", isVerified: true, isActive: true, applicationStatus: "approved",
      location: { type: "Point", coordinates: [75.87, 22.71] },
    });
    const mk = async (name, slug) => {
      const header = await Category.create({ name, slug: `${slug}-${s}`, type: "header", status: "active" });
      const category = await Category.create({ name: `C ${name}`, slug: `c-${slug}-${s}`, type: "category", parentId: header._id, status: "active" });
      const sub = await Category.create({ name: `S ${name}`, slug: `s-${slug}-${s}`, type: "subcategory", parentId: category._id, status: "active" });
      const product = await Product.create({
        name: `${name} item`, slug: `p-${slug}-${s}`, sku: `SKU-${slug}-${s}`, description: "x", price: 100, stock: 10, status: "active",
        headerId: header._id, categoryId: category._id, subcategoryId: sub._id, sellerId: seller._id,
      });
      return { header, product };
    };
    const grocery = await mk("Grocery", "gro");
    const mobile = await mk("Mobile", "mob");
    return { me, other, seller, grocery, mobile };
  }

  const makeOrder = (product, customer, over = {}) => {
    seq += 1;
    return Order.create({
      orderId: `ORD-MO-${Date.now()}-${seq}`,
      customer: customer._id,
      seller: ctx.seller._id,
      items: [{ product: product._id, name: product.name, quantity: 1, price: 100 }],
      address: { name: "R", address: "x", city: "Indore", state: "MP", pincode: "452001", phone: "9876543210" },
      paymentMode: "COD",
      status: "delivered",
      orderStatus: "delivered",
      workflowVersion: 2,
      workflowStatus: "DELIVERED",
      ...over,
    });
  };

  const submit = (token, productId, rating = 4, comment = "Nice phone") =>
    request(app).post("/api/reviews/submit").set("Authorization", token).field("productId", String(productId)).field("rating", String(rating)).field("comment", comment);

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: "2mb" }));
    setupRoutes(app);
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `my_orders_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });

  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    ctx = await seed();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  describe("category chips need each order line's header category", () => {
    it("my-orders returns items[].product.headerId for every order", async () => {
      await makeOrder(ctx.grocery.product, ctx.me);
      await makeOrder(ctx.mobile.product, ctx.me, { status: "pending", orderStatus: "pending", workflowStatus: "SELLER_PENDING" });
      const res = await request(app).get("/api/orders/my-orders").query({ limit: 100 }).set("Authorization", tok(ctx.me._id));
      expect(res.status).toBe(200);
      const headers = res.body.result.items.map((o) => String(o.items[0].product.headerId)).sort();
      expect(headers).toEqual([String(ctx.grocery.header._id), String(ctx.mobile.header._id)].sort());
    });

    it("a customer sees only their own orders", async () => {
      await makeOrder(ctx.grocery.product, ctx.other);
      const res = await request(app).get("/api/orders/my-orders").set("Authorization", tok(ctx.me._id));
      expect(res.body.result.items).toHaveLength(0);
    });
  });

  describe("Rate & Review", () => {
    it("a delivered product can be reviewed; the review then shows in /reviews/mine as pending", async () => {
      await makeOrder(ctx.mobile.product, ctx.me);
      const res = await submit(tok(ctx.me._id), ctx.mobile.product._id, 5);
      expect(res.status).toBe(201);
      const mine = await request(app).get("/api/reviews/mine").set("Authorization", tok(ctx.me._id));
      expect(mine.status).toBe(200);
      expect(mine.body.results).toHaveLength(1);
      expect(mine.body.results[0]).toMatchObject({ rating: 5, status: "pending" });
      expect(String(mine.body.results[0].productId)).toBe(String(ctx.mobile.product._id));
    });

    it("a product that is not delivered yet cannot be reviewed (pending, cancelled, out for delivery)", async () => {
      for (const [status, wf] of [["pending", "SELLER_PENDING"], ["cancelled", "CANCELLED"], ["out_for_delivery", "OUT_FOR_DELIVERY"]]) {
        await Order.deleteMany({});
        await makeOrder(ctx.grocery.product, ctx.me, { status, orderStatus: status, workflowStatus: wf });
        const res = await submit(tok(ctx.me._id), ctx.grocery.product._id);
        expect({ status, code: res.status }).toEqual({ status, code: 403 });
      }
      expect((await request(app).get("/api/reviews/mine").set("Authorization", tok(ctx.me._id))).body.results).toHaveLength(0);
    });

    it("someone else's delivered order does not let me review the product", async () => {
      await makeOrder(ctx.mobile.product, ctx.other);
      expect((await submit(tok(ctx.me._id), ctx.mobile.product._id)).status).toBe(403);
    });

    it("a product can be reviewed only once", async () => {
      await makeOrder(ctx.mobile.product, ctx.me);
      expect((await submit(tok(ctx.me._id), ctx.mobile.product._id)).status).toBe(201);
      const again = await submit(tok(ctx.me._id), ctx.mobile.product._id, 1, "changed my mind");
      expect(again.status).toBe(400);
    });

    it("/reviews/mine lists only my reviews and needs a login", async () => {
      await makeOrder(ctx.mobile.product, ctx.me);
      await makeOrder(ctx.mobile.product, ctx.other);
      await submit(tok(ctx.me._id), ctx.mobile.product._id, 4);
      await submit(tok(ctx.other._id), ctx.mobile.product._id, 2);
      const mine = await request(app).get("/api/reviews/mine").set("Authorization", tok(ctx.me._id));
      expect(mine.body.results).toHaveLength(1);
      expect(mine.body.results[0].rating).toBe(4);
      expect((await request(app).get("/api/reviews/mine")).status).toBe(401);
    });
  });
});
