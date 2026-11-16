/**
 * Pure helpers for the customer's My Orders page (kept out of the component so they can be tested).
 */
import { getLegacyStatusFromOrder } from "./orderStatus.js";

const idOf = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return String(v._id || v.id || "");
  return String(v);
};

/** Product id of one order line (the API populates `items[].product`; older rows hold the bare id). */
export const itemProductId = (item) => idOf(item?.product) || idOf(item?.productId);

/** Header-category id of one order line, "" when unknown. */
export const itemHeaderId = (item) => idOf(item?.product?.headerId) || idOf(item?.headerId);

/** Every header-category id an order touches (an order can mix categories). */
export function orderHeaderIds(order) {
  const ids = new Set();
  for (const item of order?.items || []) {
    const h = itemHeaderId(item);
    if (h) ids.add(h);
  }
  return [...ids];
}

/** True when the order should show under this header-category chip ("all" / empty shows everything). */
export function matchesHeader(order, headerId) {
  if (!headerId || headerId === "all") return true;
  return orderHeaderIds(order).includes(String(headerId));
}

/**
 * Header categories for the filter chips: only real header categories, in the admin's order,
 * skipping a header called "All" (the page has its own All chip). Whatever the admin adds or
 * removes shows up / disappears because this is rebuilt from the live category list.
 */
export function headerChips(categories) {
  const list = (Array.isArray(categories) ? categories : [])
    .filter((c) => c && c.type === "header" && c.name && (c._id || c.id))
    .filter((c) => String(c.name).trim().toLowerCase() !== "all" && String(c.slug || "").toLowerCase() !== "all")
    .filter((c) => !c.status || String(c.status).toLowerCase() === "active");
  return list
    .map((c, i) => ({ id: String(c._id || c.id), label: String(c.name).trim(), sort: Number.isFinite(Number(c.sortOrder)) ? Number(c.sortOrder) : 0, i }))
    .sort((a, b) => a.sort - b.sort || a.i - b.i)
    .map(({ id, label }) => ({ id, label }));
}

/**
 * Rate & Review is offered only for DELIVERED orders (not cancelled, pending, shipped...) and not once
 * a return/refund has started on them.
 */
export function canRateOrder(order) {
  if (!order) return false;
  if (getLegacyStatusFromOrder(order) !== "delivered") return false;
  const rs = order.returnStatus;
  if (rs && rs !== "none") return false;
  if (order.status === "refunded" || order.isRefunded) return false;
  return true;
}

/** The order lines a customer can rate: delivered orders only, each product once. */
export function ratableItems(order) {
  if (!canRateOrder(order)) return [];
  const seen = new Set();
  const out = [];
  for (const item of order.items || []) {
    const pid = itemProductId(item);
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    out.push({ ...item, productId: pid });
  }
  return out;
}
