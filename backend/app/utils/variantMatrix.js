/**
 * Variant matrix (Flipkart style): a product has up to 3 OPTIONS (e.g. Size, Color) and a list of
 * VARIANTS, one per real combination that is sold. A combination that is not in the list does not
 * exist (e.g. no "L / Red"). Each variant is still a normal variant row (own sku, price, stock),
 * so cart / order / stock code that works on variant sku needs no change.
 *
 * Options:  [{ name: "Size", values: ["M", "L"], hasImages: false }, { name: "Color", values: ["Red"], hasImages: true }]
 * Variant:  { name: "L / Red", options: { Size: "L", Color: "Red" }, price, salePrice, stock, sku, images }
 */

export const MAX_OPTIONS = 3;
export const MAX_VALUES_PER_OPTION = 30;
export const MAX_VARIANTS = 150;

const clean = (v) => String(v == null ? "" : v).trim().replace(/\s+/g, " ");
const keyOf = (v) => clean(v).toLowerCase();

export class VariantMatrixError extends Error {
  constructor(message) {
    super(message);
    this.name = "VariantMatrixError";
    this.statusCode = 400;
  }
}

/** Option list as the DB stores it, or [] when the product has no options. Throws on bad input. */
export function normalizeOptions(raw) {
  if (raw == null || raw === "") return [];
  if (!Array.isArray(raw)) throw new VariantMatrixError("Variant options are invalid.");
  if (raw.length === 0) return [];
  if (raw.length > MAX_OPTIONS) {
    throw new VariantMatrixError(`A product can have at most ${MAX_OPTIONS} options (like Size, Color).`);
  }
  const seen = new Set();
  const out = raw.map((o) => {
    const name = clean(o?.name);
    if (!name) throw new VariantMatrixError("Every option needs a name (like Size or Color).");
    if (/[.$]/.test(name)) throw new VariantMatrixError(`Option name "${name}" cannot contain "." or "$".`);
    if (seen.has(keyOf(name))) throw new VariantMatrixError(`Option "${name}" is added twice.`);
    seen.add(keyOf(name));
    const values = [];
    const vSeen = new Set();
    for (const rawValue of Array.isArray(o?.values) ? o.values : []) {
      const value = clean(rawValue);
      if (!value || vSeen.has(keyOf(value))) continue;
      vSeen.add(keyOf(value));
      values.push(value);
    }
    if (values.length === 0) throw new VariantMatrixError(`Option "${name}" needs at least one value.`);
    if (values.length > MAX_VALUES_PER_OPTION) {
      throw new VariantMatrixError(`Option "${name}" has too many values (max ${MAX_VALUES_PER_OPTION}).`);
    }
    return { name, values, hasImages: Boolean(o?.hasImages) };
  });
  // photos can change with one option only
  let imageAxes = 0;
  for (const o of out) {
    if (o.hasImages) {
      imageAxes += 1;
      if (imageAxes > 1) o.hasImages = false;
    }
  }
  return out;
}

export const variantLabel = (options, axes) =>
  axes.map((a) => options?.[a.name]).filter(Boolean).join(" / ");

/**
 * Validates the variant rows against the options and returns clean rows
 * (option value spelling fixed to the option list, name = "L / Red").
 */
export function normalizeVariants(axes, rawVariants) {
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    throw new VariantMatrixError("Add at least one variant combination.");
  }
  if (rawVariants.length > MAX_VARIANTS) {
    throw new VariantMatrixError(`Too many combinations (max ${MAX_VARIANTS}).`);
  }
  const seen = new Set();
  return rawVariants.map((v) => {
    const options = {};
    for (const axis of axes) {
      const picked = clean(v?.options?.[axis.name]);
      const value = axis.values.find((x) => keyOf(x) === keyOf(picked));
      if (!value) {
        throw new VariantMatrixError(`A variant is missing a valid "${axis.name}" (got "${picked || "nothing"}").`);
      }
      options[axis.name] = value;
    }
    const label = variantLabel(options, axes);
    const comboKey = axes.map((a) => keyOf(options[a.name])).join("|");
    if (seen.has(comboKey)) throw new VariantMatrixError(`The combination "${label}" is added twice.`);
    seen.add(comboKey);

    const price = Number(v?.price);
    if (!Number.isFinite(price) || price <= 0) throw new VariantMatrixError(`Enter a price for "${label}".`);
    const salePrice = v?.salePrice === "" || v?.salePrice == null ? 0 : Number(v.salePrice);
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      throw new VariantMatrixError(`Sale price of "${label}" is not valid.`);
    }
    if (salePrice > price) {
      throw new VariantMatrixError(`Sale price of "${label}" cannot be more than its price.`);
    }
    const stock = Number(v?.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      throw new VariantMatrixError(`Stock of "${label}" must be 0 or more.`);
    }

    return { ...v, name: label, options, price, salePrice, stock };
  });
}

/**
 * Photos belong to the option flagged hasImages (usually Color). Every variant with the same value
 * of that option gets the same photos: the first member that has any (new uploads win).
 */
export function propagateGroupImages(axes, variants, newlyUploadedIdx = new Set()) {
  const axis = axes.find((a) => a.hasImages);
  if (!axis) return variants;
  const groups = new Map();
  variants.forEach((v, idx) => {
    const k = keyOf(v.options?.[axis.name]);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(idx);
  });
  for (const idxs of groups.values()) {
    const source =
      idxs.find((i) => newlyUploadedIdx.has(i) && (variants[i].images || []).length > 0) ??
      idxs.find((i) => (variants[i].images || []).length > 0);
    const images = source === undefined ? [] : [...variants[source].images];
    for (const i of idxs) variants[i] = { ...variants[i], images: [...images] };
  }
  return variants;
}

/** What the product listing needs: lowest selling price (in stock first) and the total stock. */
export function matrixSummary(variants) {
  const sell = (v) => (v.salePrice > 0 && v.salePrice < v.price ? v.salePrice : v.price);
  const inStock = variants.filter((v) => v.stock > 0);
  const pool = inStock.length ? inStock : variants;
  const cheapest = pool.reduce((a, b) => (sell(b) < sell(a) ? b : a), pool[0]);
  return {
    price: cheapest.price,
    salePrice: cheapest.salePrice > 0 && cheapest.salePrice < cheapest.price ? cheapest.salePrice : 0,
    stock: variants.reduce((s, v) => s + v.stock, 0),
  };
}

/**
 * One call for create/update. Returns null when the product has no options (old behaviour stays),
 * else { variantOptions, variants, summary }. Pass already-parsed JSON.
 */
export function buildVariantMatrix(rawOptions, rawVariants, newlyUploadedIdx) {
  const axes = normalizeOptions(rawOptions);
  if (axes.length === 0) return null;
  const rows = normalizeVariants(axes, rawVariants);
  const variants = propagateGroupImages(axes, rows, newlyUploadedIdx);
  return { variantOptions: axes, variants, summary: matrixSummary(variants) };
}

export const hasOptions = (product) =>
  Array.isArray(product?.variantOptions) && product.variantOptions.length > 0;

/** Finds the variant a cart line points at (sku, else name). */
export function findVariantBySku(product, sku) {
  const key = keyOf(sku);
  if (!key || !Array.isArray(product?.variants)) return null;
  return product.variants.find((v) => keyOf(v.sku) === key || keyOf(v.name) === key) || null;
}

/** Saved photo URLs the form sent back plus the photos uploaded just now for this variant row. */
export function mergeUploadedImages(variant, uploadedUrls = []) {
  const kept = (Array.isArray(variant?.images) ? variant.images : []).filter(
    (u) => typeof u === "string" && /^https?:/i.test(u),
  );
  return [...kept, ...uploadedUrls];
}
