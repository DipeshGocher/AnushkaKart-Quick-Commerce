import mongoose from "mongoose";
import { jest } from "@jest/globals";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import Category from "../app/models/category.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.REDIS_DISABLED = "true";

const { getCategories } = await import("../app/controller/categoryController.js");
const { invalidate } = await import("../app/services/cacheService.js");

jest.setTimeout(120000);
const RUN = process.env.RUN_E2E_TESTS === "true" && Boolean(process.env.MONGO_URI_E2E);

(RUN ? describe : describe.skip)("categories: an empty answer is never remembered - real DB", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_E2E, { dbName: `cat_cache_e2e_${Date.now()}`, serverSelectionTimeoutMS: 15000 });
    await Promise.all(Object.values(mongoose.models).map(async (m) => { await m.createCollection().catch(() => {}); await m.init(); }));
  });
  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    await invalidate("cache:*");
  });
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  const customerCall = async (query = { tree: "true", catalogType: "all" }) => {
    let out;
    await getCategories({ query, baseUrl: "/api/categories", originalUrl: "/api/categories", headers: {} }, { status() { return this; }, json(b) { out = b; return this; } });
    return out.results;
  };

  test("empty database first, then the real data arrives: the next request shows it at once (not after an hour)", async () => {
    expect(await customerCall()).toEqual([]); // the wrong / empty database was connected

    const header = await Category.create({ name: "Grocery", slug: "grocery", type: "header", status: "active" });
    await Category.create({ name: "Rice", slug: "rice", type: "category", parentId: header._id, status: "active" });

    const after = await customerCall();
    expect(after).toHaveLength(1);
    expect(after[0].name).toBe("Grocery");
    expect(after[0].children).toHaveLength(1);
  });

  test("a real answer is still cached (the database is not asked every time)", async () => {
    const header = await Category.create({ name: "Grocery", slug: "grocery", type: "header", status: "active" });
    await Category.create({ name: "Rice", slug: "rice", type: "category", parentId: header._id, status: "active" });
    expect(await customerCall()).toHaveLength(1);
    await Category.deleteMany({}); // removed behind the cache's back: the cached answer is served
    expect(await customerCall()).toHaveLength(1);
  });

  test("the other catalog filters behave the same", async () => {
    expect(await customerCall({ tree: "true" })).toEqual([]);
    await Category.create({ name: "Grocery", slug: "grocery", type: "header", status: "active" });
    expect(await customerCall({ tree: "true" })).toHaveLength(1);
  });
});
