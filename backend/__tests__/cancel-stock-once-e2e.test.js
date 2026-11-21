import mongoose from "mongoose";
import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import Order from "../app/models/order.js";
import User from "../app/models/customer.js";
import Seller from "../app/models/seller.js";
import Product from "../app/models/product.js";
import Category from "../app/models/category.js";
import StockHistory from "../app/models/stockHistory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";
delete process.env.SHIPROCKET_EMAIL;
delete process.env.SHIPROCKET_PASSWORD;

const { updateOrderStatus } = await import("../app/controller/orderController.js");

jest.setTimeout(120000);
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);

(RUN ? describe : describe.skip)("a cancelled order gives its stock back exactly ONCE (admin cancel through updateOrderStatus) - real DB", () => {
  let customer, seller, header, category, sub;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `cancel_stock_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });
  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    const s = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    customer = await User.create({ name: "Rahul", phone: `90000${s.slice(-5)}`, role: "user", isVerified: true });
    seller = await Seller.create({ name: "S", email: `s_${s}@example.com`, phone: `91000${s.slice(-5)}`, password: "Password@123", shopName: "Shop", pincode: "452001", isVerified: true, isActive: true, applicationStatus: "approved", location: { type: "Point", coordinates: [75.87, 22.71] } });
    header = await Category.create({ name: `H ${s}`, slug: `h-${s}`, type: "header", status: "active" });
    category = await Category.create({ name: `C ${s}`, slug: `c-${s}`, type: "category", parentId: header._id, status: "active" });
    sub = await Category.create({ name: `S ${s}`, slug: `s-${s}`, type: "subcategory", parentId: category._id, status: "active" });
  });
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  const product = (extra = {}) => Product.create({
    name: "Shirt", slug: `shirt-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, sku: `SK-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, description: "x", price: 500, salePrice: 500,
    stock: 10, headerId: header._id, categoryId: category._id, subcategoryId: sub._id, sellerId: seller._id, status: "active", ...extra,
  });
  const order = (p, quantity, extra = {}) => Order.create({
    orderId: `ORD-CS-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, customer: customer._id, seller: seller._id,
    items: [{ product: p._id, name: "Shirt", quantity, price: 500, ...(extra.item || {}) }],
    address: { name: "R", address: "x", city: "Indore", state: "MP", pincode: "452001", phone: "9876543210" },
    paymentMode: "COD", paymentStatus: "CREATED", status: "confirmed", orderStatus: "confirmed",
    workflowVersion: 2, workflowStatus: "SELLER_ACCEPTED", fulfillmentType: "LOCAL",
    stockReservation: { status: "COMMITTED" },
  });
  const cancelAsAdmin = async (o) => {
    let out = {};
    const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
    await updateOrderStatus({ params: { orderId: o.orderId }, body: { status: "cancelled", reason: "Customer asked" }, user: { id: new mongoose.Types.ObjectId().toString(), role: "admin" } }, res);
    return out;
  };

  test("plain product: 3 pieces were sold, cancel gives back exactly 3 (not 6)", async () => {
    const p = await product({ stock: 7 }); // 10 - 3 sold
    const o = await order(p, 3);
    const r = await cancelAsAdmin(o);
    expect(r.status).toBe(200);
    expect((await Product.findById(p._id).lean()).stock).toBe(10);
    expect((await Order.findById(o._id).lean()).stockReservation.status).toBe("RELEASED");
  });

  test("a second cancel call changes nothing more", async () => {
    const p = await product({ stock: 7 });
    const o = await order(p, 3);
    await cancelAsAdmin(o);
    await cancelAsAdmin(o);
    expect((await Product.findById(p._id).lean()).stock).toBe(10);
    expect(await StockHistory.countDocuments({ order: o._id })).toBe(1);
  });

  test("size/colour product: the variant's own stock comes back too, once", async () => {
    const p = await product({
      stock: 8,
      variants: [{ sku: "SH-M", price: 500, stock: 3, attributes: [{ name: "Size", value: "M" }] }, { sku: "SH-L", price: 500, stock: 5, attributes: [{ name: "Size", value: "L" }] }],
    });
    const o = await order(p, 2, { item: { variantSlot: "SH-M" } });
    const r = await cancelAsAdmin(o);
    expect(r.status).toBe(200);
    const after = await Product.findById(p._id).lean();
    expect(after.stock).toBe(10);
    expect(after.variants.find((v) => v.sku === "SH-M").stock).toBe(5);
    expect(after.variants.find((v) => v.sku === "SH-L").stock).toBe(5);
  });
});
