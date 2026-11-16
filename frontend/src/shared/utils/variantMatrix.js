/**
 * Size / Color style variants (Flipkart style) - pure helpers shared by the seller/admin product
 * form and the customer product page. Mirrors backend/app/utils/variantMatrix.js.
 *
 * axes     = [{ name: "Size", values: ["M","L"], hasImages: false }, { name: "Color", values: [...], hasImages: true }]
 * variant  = { name: "L / Red", options: { Size: "L", Color: "Red" }, price, salePrice, stock, sku, images }
 */

export const MAX_OPTIONS = 3;
const clean = (v) => String(v == null ? "" : v).trim().replace(/\s+/g, " ");
const keyOf = (v) => clean(v).toLowerCase();

/** Suggested option names for the seller form. */
export const SUGGESTED_OPTIONS = ["Size", "Color", "Storage", "RAM", "Material"];

export const isMatrixProduct = (product) =>
  Array.isArray(product?.variantOptions) && product.variantOptions.length > 0;

export const variantLabel = (options, axes) =>
  (axes || []).map((a) => options?.[a.name]).filter(Boolean).join(" / ");

const isColorName = (name) => /^colou?rs?$/i.test(clean(name));

/** Photos change with Color when there is a Color option; the seller can change it. */
export function defaultImageAxis(axes) {
  const idx = (axes || []).findIndex((a) => isColorName(a.name));
  return idx; // -1 = none
}

export function cartesian(axes) {
  let combos = [{}];
  for (const axis of axes) {
    const next = [];
    for (const c of combos) for (const value of axis.values) next.push({ ...c, [axis.name]: value });
    combos = next;
  }
  return combos;
}

const comboKey = (options, axes) => axes.map((a) => keyOf(options?.[a.name])).join("|");

let idCounter = 0;
const newId = () => `v${Date.now().toString(36)}${(idCounter += 1)}`;

/**
 * Builds the variant rows for the given options. Existing rows that are still valid are kept
 * (with their price/stock/photos); rows whose option values were removed are dropped.
 * With addMissing the missing combinations are added (copying price from the first row, stock 0).
 */
export function syncVariants(axes, existing = [], { addMissing = true } = {}) {
  const valid = new Map();
  for (const v of existing) {
    const options = {};
    let ok = true;
    for (const axis of axes) {
      const found = axis.values.find((x) => keyOf(x) === keyOf(v.options?.[axis.name]));
      if (!found) { ok = false; break; }
      options[axis.name] = found;
    }
    if (ok) valid.set(comboKey(options, axes), { ...v, options, name: variantLabel(options, axes) });
  }
  const template = [...valid.values()][0] || {};
  const rows = [...valid.values()];
  if (addMissing) {
    for (const options of cartesian(axes)) {
      const k = comboKey(options, axes);
      if (valid.has(k)) continue;
      rows.push({
        id: newId(),
        name: variantLabel(options, axes),
        options,
        price: template.price ?? "",
        salePrice: template.salePrice ?? "",
        stock: 0,
        sku: "",
        images: [],
      });
    }
  }
  // order the rows like the options list (first option slowest)
  const order = new Map(cartesian(axes).map((o, i) => [comboKey(o, axes), i]));
  return rows.sort((a, b) => (order.get(comboKey(a.options, axes)) ?? 0) - (order.get(comboKey(b.options, axes)) ?? 0));
}

/** Cleans the option list the seller typed (trim, drop blanks / duplicate values). */
export function cleanAxes(axes) {
  return (axes || []).map((a) => {
    const seen = new Set();
    const values = [];
    for (const raw of a.values || []) {
      const val = clean(raw);
      if (!val || seen.has(keyOf(val))) continue;
      seen.add(keyOf(val));
      values.push(val);
    }
    return { name: clean(a.name), values, hasImages: Boolean(a.hasImages) };
  });
}

/**
 * The seller changed the options. Returns the new variant rows:
 *  - same options, a value removed   -> rows with that value are dropped
 *  - same options, a value added     -> its combinations are added (others untouched)
 *  - an option added / removed / renamed -> all combinations are rebuilt (price copied, stock 0)
 */
export function applyAxesChange(oldAxes, newAxes, rows) {
  const oldNames = (oldAxes || []).map((a) => keyOf(a.name)).join("|");
  const newNames = newAxes.map((a) => keyOf(a.name)).join("|");
  if (oldNames !== newNames || !rows.length) {
    const template = rows[0] || {};
    return syncVariants(newAxes, [], { addMissing: true }).map((r) => ({
      ...r,
      price: template.price ?? r.price,
      salePrice: template.salePrice ?? r.salePrice,
    }));
  }
  const kept = syncVariants(newAxes, rows, { addMissing: false });
  const isNew = (axis) => {
    const old = (oldAxes || []).find((o) => keyOf(o.name) === keyOf(axis.name));
    const oldSet = new Set((old?.values || []).map(keyOf));
    return (value) => !oldSet.has(keyOf(value));
  };
  const checks = newAxes.map((a) => ({ name: a.name, isNew: isNew(a) }));
  const have = new Set(kept.map((r) => comboKey(r.options, newAxes)));
  const template = kept[0] || rows[0] || {};
  const extra = [];
  for (const options of cartesian(newAxes)) {
    if (have.has(comboKey(options, newAxes))) continue;
    if (!checks.some((c) => c.isNew(options[c.name]))) continue; // only combinations that use a new value
    extra.push({
      id: newId(), name: variantLabel(options, newAxes), options,
      price: template.price ?? "", salePrice: template.salePrice ?? "", stock: 0, sku: "", images: [],
    });
  }
  return syncVariants(newAxes, [...kept, ...extra], { addMissing: false });
}

/** Returns an error message for the seller form, or null when everything is fine. */
export function validateMatrix(axes, variants) {
  if (!axes.length) return null;
  if (axes.length > MAX_OPTIONS) return `At most ${MAX_OPTIONS} options are allowed.`;
  const names = new Set();
  for (const a of axes) {
    if (!clean(a.name)) return "Every option needs a name (like Size or Color).";
    if (/[.$]/.test(a.name)) return `Option name "${a.name}" cannot contain "." or "$".`;
    if (names.has(keyOf(a.name))) return `Option "${a.name}" is added twice.`;
    names.add(keyOf(a.name));
    if (!a.values.length) return `Option "${a.name}" needs at least one value.`;
  }
  if (!variants.length) return "Add the values of your options so the combinations appear.";
  const seen = new Set();
  for (const v of variants) {
    const stale = axes.some((a) => !a.values.some((x) => keyOf(x) === keyOf(v.options?.[a.name])));
    if (stale) return "The combinations do not match your options. Remove the option and add it again.";
    const label = v.name || variantLabel(v.options, axes);
    const k = comboKey(v.options, axes);
    if (seen.has(k)) return `"${label}" is added twice.`;
    seen.add(k);
    const price = Number(v.price);
    if (!Number.isFinite(price) || price <= 0) return `Enter a price for "${label}".`;
    if (v.salePrice !== "" && v.salePrice != null && Number(v.salePrice) > price) {
      return `Sale price of "${label}" cannot be more than its price.`;
    }
    const stock = Number(v.stock);
    if (v.stock === "" || !Number.isInteger(stock) || stock < 0) return `Enter stock (0 or more) for "${label}".`;
  }
  return null;
}

/** The option that carries the photos, or null. */
export const imageAxisOf = (axes) => (axes || []).find((a) => a.hasImages) || null;

/** Groups variants by the value of the photo option: [{ value, indexes: [rowIndex...] }] */
export function imageGroups(axes, variants) {
  const axis = imageAxisOf(axes);
  if (!axis) return [];
  const map = new Map();
  variants.forEach((v, i) => {
    const value = v.options?.[axis.name];
    if (!map.has(keyOf(value))) map.set(keyOf(value), { value, indexes: [] });
    map.get(keyOf(value)).indexes.push(i);
  });
  return [...map.values()];
}

/**
 * Form data helpers: the photos of each colour are uploaded once, on the first row of the colour
 * (backend copies them to the other rows). groupFiles = { [colourValue]: File[] }.
 * Returns [{ field: "variantImage_<rowIndex>_<n>", file }].
 */
export function groupFilesToFields(axes, variants, groupFiles = {}) {
  const out = [];
  for (const g of imageGroups(axes, variants)) {
    const files = groupFiles[g.value] || [];
    files.forEach((file, n) => out.push({ field: `variantImage_${g.indexes[0]}_${n}`, file }));
  }
  return out;
}

/** Variant rows as sent to the server (builds the label, keeps only saved photo URLs). */
export function variantsForSubmit(axes, variants) {
  return variants.map((v) => ({
    ...v,
    name: variantLabel(v.options, axes),
    images: (v.images || []).filter((u) => typeof u === "string" && /^https?:/i.test(u)),
  }));
}

// ----------------------------------------------------------------- customer side

const sameValue = (a, b) => keyOf(a) === keyOf(b);

/** Variants that match the chosen values (axes not chosen yet are ignored). */
export function matchingVariants(product, selection = {}) {
  const axes = product?.variantOptions || [];
  return (product?.variants || []).filter((v) =>
    axes.every((a) => selection[a.name] == null || sameValue(v.options?.[a.name], selection[a.name])),
  );
}

/**
 * For every value of one option, can it be bought together with what is chosen in the OTHER options?
 *   exists  = such a combination is sold
 *   inStock = and it has stock
 */
export function optionValueStates(product, axisName, selection = {}) {
  const axis = (product?.variantOptions || []).find((a) => a.name === axisName);
  if (!axis) return [];
  const others = { ...selection };
  delete others[axisName];
  return axis.values.map((value) => {
    const list = matchingVariants(product, { ...others, [axisName]: value });
    return {
      value,
      exists: list.length > 0,
      inStock: list.some((v) => Number(v.stock) > 0),
      selected: sameValue(selection[axisName], value),
    };
  });
}

export const variantInStock = (v) => Number(v?.stock) > 0;

/** The variant for a full selection, or null. */
export function resolveVariant(product, selection = {}) {
  const axes = product?.variantOptions || [];
  if (!axes.every((a) => selection[a.name] != null)) return null;
  return matchingVariants(product, selection)[0] || null;
}

/** First variant to show: the first one that is in stock (else the first). */
export function defaultVariant(product) {
  const list = product?.variants || [];
  return list.find(variantInStock) || list[0] || null;
}

/**
 * The customer taps a value. Keep the other choices when that combination is sold and in stock,
 * otherwise jump to the closest sold combination (same new value, most other choices kept,
 * in stock first) so the customer never lands on "unavailable".
 */
export function pickVariantAfterTap(product, currentSelection, axisName, value) {
  const axes = product?.variantOptions || [];
  const candidates = (product?.variants || []).filter((v) => sameValue(v.options?.[axisName], value));
  if (!candidates.length) return null;
  const score = (v) =>
    axes.reduce((n, a) => (a.name !== axisName && sameValue(v.options?.[a.name], currentSelection?.[a.name]) ? n + 1 : n), 0);
  // prefer in stock, then the one that keeps the most of the customer's other choices
  const inStock = candidates.filter(variantInStock);
  const pool = inStock.length ? inStock : candidates;
  const best = [...pool].sort((a, b) => score(b) - score(a))[0];
  return best;
}

/** Photos for the selected variant (its colour photos), falling back to product images. */
export function variantPhotos(product, variant) {
  const own = (variant?.images || []).filter(Boolean);
  if (own.length) return own;
  return [product?.mainImage, ...(product?.galleryImages || [])].filter(Boolean);
}

/**
 * Everything a product form needs at submit time.
 *   formData.useOptions  - the seller chose Size/Color style options
 *   returns { error, optionsJson, variants, files }  (files = [{ field, file }] to append to FormData)
 */
export function matrixSubmitParts(formData, groupFiles = {}) {
  if (!formData.useOptions) {
    // simple variants: make sure no leftover option data is saved
    return {
      error: null,
      optionsJson: "[]",
      variants: (formData.variants || []).map((v) => {
        const rest = { ...v };
        delete rest.options;
        return rest;
      }),
      files: [],
    };
  }
  const axes = cleanAxes(formData.variantOptions);
  const error = axes.length
    ? validateMatrix(axes, formData.variants || [])
    : "Tap an option like Size or Color and add its values, or switch to simple variants.";
  return {
    error,
    optionsJson: JSON.stringify(axes),
    variants: error ? [] : variantsForSubmit(axes, formData.variants),
    files: error ? [] : groupFilesToFields(axes, formData.variants, groupFiles),
  };
}

/** Form state for opening a saved product. */
export const optionsStateFromProduct = (item) => ({
  useOptions: Array.isArray(item?.variantOptions) && item.variantOptions.length > 0,
  variantOptions: Array.isArray(item?.variantOptions) ? item.variantOptions.map((a) => ({ ...a, values: [...(a.values || [])] })) : [],
});
