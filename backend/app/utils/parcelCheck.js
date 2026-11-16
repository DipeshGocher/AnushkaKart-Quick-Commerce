/**
 * Parcel size checks for courier (Shiprocket) orders. Courier charges by the bigger of the real
 * weight and the box volume ((L x W x H) / 5000), so a missing or wrong weight / box size can end
 * in a weight penalty that is cut from the seller payout.
 */

const WEIGHT_RE = /^(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|grams?)$/;

/** "500g", "1.5 kg" -> kilograms, or null when the text is empty or not a clear weight. */
export function parseWeightKg(text) {
  const match = String(text || "").trim().toLowerCase().match(WEIGHT_RE);
  if (!match) return null;
  const value = Number(match[1]);
  if (!(value > 0)) return null;
  return match[2].startsWith("k") ? value : value / 1000;
}

const validSide = (n) => Number.isFinite(Number(n)) && Number(n) > 0;

/** { weight: true } when the weight is unusable, { size: true } when any box side is missing. */
export function parcelProblems(product) {
  return {
    weight: parseWeightKg(product?.weight) === null,
    size: !(validSide(product?.length) && validSide(product?.breadth) && validSide(product?.height)),
  };
}

const FINISHED = new Set(["delivered", "cancelled", "returned"]);

/**
 * Adds order.parcelIssues = [{ name, weight, size }] to open courier orders (items need their
 * product populated with weight / length / breadth / height). Returns the same array.
 */
export function attachParcelIssues(orders) {
  for (const order of orders || []) {
    if (!order || order.fulfillmentType !== "SHIPROCKET" || FINISHED.has(String(order.status || "").toLowerCase())) continue;
    const issues = [];
    for (const item of order.items || []) {
      const product = item?.product;
      if (!product || typeof product !== "object") continue; // not populated
      const p = parcelProblems(product);
      if (p.weight || p.size) issues.push({ name: item.name || product.name || "Product", ...p });
    }
    if (issues.length) order.parcelIssues = issues;
  }
  return orders;
}
