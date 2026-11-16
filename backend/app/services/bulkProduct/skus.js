import crypto from "crypto";

const rand = (n) => crypto.randomBytes(8).toString("hex").toUpperCase().slice(0, n);

/** "Cotton Shirt" -> "COTTO-7F3A9K" (letters of the name + a random part). */
export function autoSkuFor(name) {
  const prefix = String(name || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5) || "ITEM";
  return `${prefix}-${rand(6)}`;
}

/** SKU of the n-th combination when the seller left it empty: SHIRT-01-001 */
export const composeVariantSku = (productSku, n) => `${productSku}-${String(n).padStart(3, "0")}`;
