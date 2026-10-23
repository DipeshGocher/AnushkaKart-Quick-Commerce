import Category from "../models/category.js";
import Seller from "../models/seller.js";
import Warehouse from "../models/warehouse.js";
import { buildKey, getOrSet, getTTL, invalidate } from "./cacheService.js";

/**
 * Resolve a category name by ID (cache-backed, 1-hour TTL).
 * @param {string|ObjectId} id
 * @returns {Promise<string|null>}
 */
export async function resolveCategoryName(id) {
  if (!id) return null;
  const key = buildKey("catalog", "categoryName", String(id));
  const cat = await getOrSet(
    key,
    () => Category.findById(id).select("name").lean(),
    getTTL("categoryName"),
  );
  return cat?.name ?? null;
}

/**
 * Resolve a seller shop name by ID (cache-backed, 1-hour TTL).
 * @param {string|ObjectId} id
 * @returns {Promise<string|null>}
 */
export async function resolveSellerName(id) {
  if (!id) return null;
  const key = buildKey("catalog", "sellerName", String(id));
  const seller = await getOrSet(
    key,
    () => Seller.findById(id).select("shopName").lean(),
    getTTL("categoryName"), // same 1-hour TTL
  );
  return seller?.shopName ?? null;
}

/**
 * Resolve a warehouse name by ID (cache-backed, 1-hour TTL).
 * @param {string|ObjectId} id
 * @returns {Promise<string|null>}
 */
export async function resolveWarehouseName(id) {
  if (!id) return null;
  const key = buildKey("catalog", "warehouseName", String(id));
  const warehouse = await getOrSet(
    key,
    () => Warehouse.findById(id).select("name").lean(),
    getTTL("categoryName"), // same 1-hour TTL
  );
  return warehouse?.name ?? null;
}

/**
 * Invalidate the cached category name for a given ID.
 * @param {string|ObjectId} id
 */
export async function invalidateCategoryName(id) {
  await Promise.all([
    invalidate(buildKey("catalog", "categoryName", String(id))),
    invalidate(buildKey("catalog", "categoryMeta", String(id))),
  ]);
}

/**
 * Invalidate the cached seller name for a given ID.
 * @param {string|ObjectId} id
 */
export async function invalidateSellerName(id) {
  await Promise.all([
    invalidate(buildKey("catalog", "sellerName", String(id))),
    invalidate(buildKey("catalog", "sellerMeta", String(id))),
  ]);
}

/**
 * Resolve category metadata (name, slug, deliveryMode, catalogType) by ID (cache-backed).
 * @param {string|ObjectId} id
 * @returns {Promise<Object|null>}
 */
export async function resolveCategoryMeta(id) {
  if (!id) return null;
  const key = buildKey("catalog", "categoryMeta", String(id));
  const cat = await getOrSet(
    key,
    () => Category.findById(id).select("name slug deliveryMode catalogType").lean(),
    getTTL("categoryName"),
  );
  if (!cat) return null;
  const slug = String(cat.slug || "").toLowerCase();
  const name = String(cat.name || "").toLowerCase();
  const isGrocery = slug === "grocery" || slug === "kirana" || slug === "fresh" || name.includes("grocery") || name.includes("kirana");
  const defaultMode = isGrocery ? "quick_only" : "both";

  return {
    name: cat.name ?? null,
    slug: cat.slug ?? null,
    deliveryMode: cat.deliveryMode || defaultMode,
    catalogType: cat.catalogType ?? null,
  };
}

/**
 * Resolve seller metadata (shopName, pincode, city, state) by ID (cache-backed).
 * @param {string|ObjectId} id
 * @returns {Promise<Object|null>}
 */
export async function resolveSellerMeta(id) {
  if (!id) return null;
  const key = buildKey("catalog", "sellerMeta", String(id));
  const seller = await getOrSet(
    key,
    () => Seller.findById(id).select("shopName pincode city state").lean(),
    getTTL("categoryName"),
  );
  return seller
    ? {
        shopName: seller.shopName ?? null,
        pincode: seller.pincode ?? null,
        city: seller.city ?? null,
        state: seller.state ?? null,
      }
    : null;
}

/**
 * Resolve warehouse metadata (name, pincode, city, state) by ID (cache-backed).
 * @param {string|ObjectId} id
 * @returns {Promise<Object|null>}
 */
export async function resolveWarehouseMeta(id) {
  if (!id) return null;
  const key = buildKey("catalog", "warehouseMeta", String(id));
  const warehouse = await getOrSet(
    key,
    () => Warehouse.findById(id).select("name pincode city state").lean(),
    getTTL("categoryName"),
  );
  return warehouse
    ? {
        name: warehouse.name ?? null,
        pincode: warehouse.pincode ?? null,
        city: warehouse.city ?? null,
        state: warehouse.state ?? null,
      }
    : null;
}

