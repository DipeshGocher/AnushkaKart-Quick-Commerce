/**
 * Bulk product upload: turns the rows of the Excel file into products (pure, no database, never throws
 * on bad data). Everything a seller can get wrong becomes a message on the row, not a crash.
 *
 * Status of every product:
 *   ready  everything needed is there
 *   draft  can be saved but stays hidden: it has no photo and/or no parcel size
 *   error  cannot be saved; the messages say what to fix
 */

import { buildVariantMatrix, VariantMatrixError } from "../../utils/variantMatrix.js";
import { parseWeightKg } from "../../utils/parcelCheck.js";
import {
  COLUMNS,
  MAX_IMAGES_PER_PRODUCT,
  MAX_ROWS,
  REQUIRED_KEYS,
  isExampleText,
  keyForTitle,
  normalizeTitle,
} from "./columns.js";
import {
  cleanParagraph,
  cleanText,
  normalizeImageUrl,
  normalizeUnit,
  parseNumber,
  parseYesNo,
  splitList,
  toText,
} from "./cells.js";

const isBlank = (v) => toText(v).trim() === "";
const low = (v) => cleanText(v).toLowerCase();

/**
 * matrix = array of rows, each an array of cell values (what the Excel reader returns for the
 * "Products" sheet). Finds the header row, maps columns, returns { rows, fileErrors }.
 */
export function rowsFromMatrix(matrix) {
  const fileErrors = [];
  const grid = Array.isArray(matrix) ? matrix : [];
  // header = first row (within the first 5) that contains a "Product Name" column
  let headerIdx = -1;
  for (let i = 0; i < Math.min(grid.length, 5); i += 1) {
    if ((grid[i] || []).some((c) => normalizeTitle(toText(c)) === "product name")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    return { rows: [], fileErrors: ['The "Products" sheet does not look like our template. Please download a fresh template and copy your data into it.'] };
  }
  const colToKey = new Map();
  (grid[headerIdx] || []).forEach((cell, c) => {
    const key = keyForTitle(toText(cell));
    if (key && ![...colToKey.values()].includes(key)) colToKey.set(c, key);
  });
  const present = new Set(colToKey.values());
  for (const key of REQUIRED_KEYS) {
    if (!present.has(key)) {
      const title = COLUMNS.find((c) => c.key === key).title;
      fileErrors.push(`The column "${title}" is missing. Please download a fresh template.`);
    }
  }
  if (fileErrors.length) return { rows: [], fileErrors };

  const rows = [];
  for (let i = headerIdx + 1; i < grid.length; i += 1) {
    const cells = {};
    let any = false;
    for (const [c, key] of colToKey) {
      const v = (grid[i] || [])[c];
      cells[key] = v;
      if (!isBlank(v)) any = true;
    }
    if (!any) continue; // empty row
    if (isExampleText(cells.name) || isExampleText(cells.group)) continue; // template example rows
    rows.push({ rowNumber: i + 1, cells });
  }
  if (rows.length > MAX_ROWS) {
    fileErrors.push(`This file has ${rows.length} rows. Please upload at most ${MAX_ROWS} rows at a time.`);
    return { rows: [], fileErrors };
  }
  if (rows.length === 0) fileErrors.push("No product rows found. Fill the Products sheet (the grey EXAMPLE rows are ignored).");
  return { rows, fileErrors };
}

const colorName = (name) => /^colou?rs?$/i.test(String(name || "").trim());

/**
 * ctx = {
 *   resolveCategory(text) -> { ok:true, ref:{headerId,categoryId,subcategoryId,path,catalogType} } | { ok:false, message },
 *   existingSkus: Set<string>   lower-case SKUs already used in the catalogue
 *   existingNames: Set<string>  lower-case product names of this seller
 * }
 */
export function planProducts(rows, ctx) {
  const resolveCategory = ctx?.resolveCategory || (() => ({ ok: false, message: "Category list not available." }));
  const existingSkus = ctx?.existingSkus || new Set();
  const existingNames = ctx?.existingNames || new Set();

  // ---- group the rows: same Product Group = one product with options; no group = one product per row
  const groups = [];
  const byGroup = new Map();
  for (const row of rows) {
    const g = cleanText(row.cells.group, 60);
    if (g) {
      const k = g.toLowerCase();
      if (!byGroup.has(k)) {
        const grp = { key: g, grouped: true, rows: [] };
        byGroup.set(k, grp);
        groups.push(grp);
      }
      byGroup.get(k).rows.push(row);
    } else {
      groups.push({ key: `row-${row.rowNumber}`, grouped: false, rows: [row] });
    }
  }

  const seenSkusInFile = new Map(); // lower sku -> first product name
  const seenNamesInFile = new Set();
  const products = groups.map((g) => planOne(g, { resolveCategory, existingSkus, existingNames, seenSkusInFile, seenNamesInFile }));

  const summary = {
    rows: rows.length,
    products: products.length,
    ready: products.filter((p) => p.status === "ready").length,
    draft: products.filter((p) => p.status === "draft").length,
    failed: products.filter((p) => p.status === "error").length,
  };
  return { products, summary };
}

function planOne(group, ctx) {
  const { rows } = group;
  const { resolveCategory } = ctx;
  const errors = [];
  const warnings = [];
  const err = (row, field, message) => errors.push({ row, field, message });
  const warn = (row, message) => warnings.push({ row, message });
  const firstRow = rows[0].rowNumber;
  const firstOf = (key) => {
    for (const r of rows) if (!isBlank(r.cells[key])) return r;
    return null;
  };

  // ---- name + category (product level)
  const nameRow = firstOf("name");
  const name = nameRow ? cleanText(nameRow.cells.name, 200) : "";
  if (!name) err(firstRow, "name", "Product Name is empty.");
  for (const r of rows) {
    if (nameRow && r !== nameRow && !isBlank(r.cells.name) && low(r.cells.name) !== low(nameRow.cells.name)) {
      warn(r.rowNumber, `Product Name differs from row ${nameRow.rowNumber}; "${name}" is used for the whole product.`);
      break;
    }
  }

  let categoryRef = null;
  let categoryText = "";
  const catRow = firstOf("category");
  if (!catRow) {
    err(firstRow, "category", "Category is empty. Pick one from the dropdown.");
  } else {
    categoryText = cleanText(catRow.cells.category, 300);
    const res = resolveCategory(categoryText);
    if (!res.ok) err(catRow.rowNumber, "category", res.message);
    else categoryRef = res.ref;
  }

  // ---- options (Size / Color ...)
  const axisNames = [];
  for (const i of [1, 2]) {
    let n = "";
    for (const r of rows) {
      const t = cleanText(r.cells[`opt${i}Name`], 40);
      if (t) { n = t; break; }
    }
    if (n) axisNames.push({ slot: i, name: n });
    else if (rows.some((r) => !isBlank(r.cells[`opt${i}Value`]))) {
      err(firstRow, `opt${i}Name`, `Option ${i} Value is filled but Option ${i} Name is empty.`);
    }
  }
  const hasOptions = axisNames.length > 0;
  if (!hasOptions && rows.length > 1) {
    err(rows[1].rowNumber, "group", `Rows share the Product Group "${group.key}" but no Option is given. Fill Option 1 Name/Value, or remove the group.`);
  }
  if (hasOptions && !group.grouped) {
    warn(firstRow, "Options are filled but there is no Product Group, so this row is saved as one product with a single combination.");
  }
  for (const r of rows) {
    for (const a of axisNames) {
      const given = cleanText(r.cells[`opt${a.slot}Name`], 40);
      if (given && given.toLowerCase() !== a.name.toLowerCase()) {
        warn(r.rowNumber, `Option ${a.slot} Name "${given}" differs from "${a.name}"; "${a.name}" is used.`);
      }
    }
  }

  // ---- every row: price, stock, sale price, sku, option values, photos
  const variantRows = [];
  const photoWarned = new Set();
  for (const r of rows) {
    const c = r.cells;
    let rowOk = true;

    const price = parseNumber(c.price);
    if (isBlank(c.price)) { err(r.rowNumber, "price", "Price is empty."); rowOk = false; }
    else if (price === null || !(price > 0)) { err(r.rowNumber, "price", `Price "${toText(c.price)}" is not a valid number. Write numbers only, like 999.`); rowOk = false; }

    const stockNum = parseNumber(c.stock);
    if (isBlank(c.stock)) { err(r.rowNumber, "stock", "Stock is empty. Write 0 if you have none."); rowOk = false; }
    else if (stockNum === null || !Number.isInteger(stockNum) || stockNum < 0) { err(r.rowNumber, "stock", `Stock "${toText(c.stock)}" must be a whole number, 0 or more.`); rowOk = false; }

    let salePrice = 0;
    if (!isBlank(c.salePrice)) {
      const sp = parseNumber(c.salePrice);
      if (sp === null || sp < 0) { err(r.rowNumber, "salePrice", `Sale Price "${toText(c.salePrice)}" is not a valid number.`); rowOk = false; }
      else if (price !== null && sp > price) { err(r.rowNumber, "salePrice", "Sale Price cannot be more than Price."); rowOk = false; }
      else salePrice = sp;
    }

    const options = {};
    for (const a of axisNames) {
      const v = cleanText(c[`opt${a.slot}Value`], 40);
      if (!v) { err(r.rowNumber, `opt${a.slot}Value`, `${a.name} is empty on this row.`); rowOk = false; }
      else options[a.name] = v;
    }

    const sku = cleanText(c.sku, 40);
    const urls = [];
    for (const raw of [c.image, ...splitList(c.images, { max: 10, itemMax: 600 })]) {
      if (isBlank(raw)) continue;
      const u = normalizeImageUrl(raw);
      if (!u) {
        if (!photoWarned.has(r.rowNumber)) { warn(r.rowNumber, "A photo link is not a valid web link (it must start with http:// or https://). It is ignored."); photoWarned.add(r.rowNumber); }
      } else if (!urls.includes(u)) urls.push(u);
    }
    variantRows.push({ rowNumber: r.rowNumber, ok: rowOk, options, price, salePrice, stock: stockNum, sku, imageUrls: urls.slice(0, MAX_IMAGES_PER_PRODUCT) });
  }

  // ---- SKU checks
  const productSkuGiven = hasOptions ? cleanText(group.grouped ? group.key : "", 40) : variantRows[0]?.sku || "";
  const skuNoteName = name || group.key;
  const checkSku = (sku, row, what) => {
    if (!sku) return;
    const k = sku.toLowerCase();
    if (ctx.seenSkusInFile.has(k)) err(row, "sku", `${what} "${sku}" is used twice in this file (also in "${ctx.seenSkusInFile.get(k)}").`);
    else ctx.seenSkusInFile.set(k, skuNoteName);
  };
  if (productSkuGiven) {
    const k = productSkuGiven.toLowerCase();
    if (ctx.existingSkus.has(k)) err(firstRow, "sku", `${hasOptions ? "Product Group" : "SKU"} "${productSkuGiven}" already exists in your products. Was this file uploaded before?`);
    else checkSku(productSkuGiven, firstRow, hasOptions ? "Product Group" : "SKU");
  }
  if (hasOptions) for (const v of variantRows) {
    if (v.sku && v.sku.toLowerCase() !== productSkuGiven.toLowerCase()) checkSku(v.sku, v.rowNumber, "SKU");
  }

  // ---- combinations must be unique + valid (reuses the same rules as the product form)
  let matrixSummary = null;
  if (hasOptions && errors.length === 0) {
    const axes = axisNames.map((a) => ({ name: a.name, values: [...new Set(variantRows.map((v) => v.options[a.name]))], hasImages: false }));
    const colorAxis = axes.find((a) => colorName(a.name));
    if (colorAxis) colorAxis.hasImages = true;
    try {
      const built = buildVariantMatrix(
        axes,
        variantRows.map((v) => ({ options: v.options, price: v.price, salePrice: v.salePrice, stock: v.stock, sku: v.sku, images: [] })),
      );
      matrixSummary = built.summary;
    } catch (e) {
      if (e instanceof VariantMatrixError) err(firstRow, "options", e.message);
      else err(firstRow, "options", "The options could not be read.");
    }
  }

  // ---- parcel size (all optional, but a missing / wrong one makes the product a draft)
  const parcel = readParcel(rows, warn);

  // ---- photos
  const allUrls = [...new Set(variantRows.flatMap((v) => v.imageUrls))];
  const draftReasons = [];
  if (allUrls.length === 0) draftReasons.push("photo");
  else if (hasOptions) {
    const colorSlot = axisNames.find((a) => colorName(a.name));
    if (colorSlot) {
      // colours that have no photo link on ANY of their rows (one link per colour is enough)
      const withPhoto = new Set(variantRows.filter((v) => v.imageUrls.length > 0).map((v) => String(v.options[colorSlot.name]).toLowerCase()));
      const missing = [...new Set(variantRows.map((v) => v.options[colorSlot.name]))].filter((c) => !withPhoto.has(String(c).toLowerCase()));
      if (missing.length) warn(firstRow, `No photo link for ${colorSlot.name}: ${missing.join(", ")}. Customers will see the product's other photos for it.`);
    }
  }
  if (!parcel.complete) draftReasons.push("parcel");

  // ---- the optional extras
  const description = cleanParagraph(firstOf("description")?.cells.description ?? "", 5000);
  const brand = cleanText(firstOf("brand")?.cells.brand ?? "", 100);
  let isReturnable = true;
  const retRow = firstOf("returnable");
  if (retRow) {
    const yn = parseYesNo(retRow.cells.returnable);
    if (yn === null) warn(retRow.rowNumber, `Returnable "${toText(retRow.cells.returnable)}" is not Yes or No. Yes is used.`);
    else if (yn === false) isReturnable = false;
  }
  const specifications = [];
  for (const i of [1, 2, 3]) {
    const r = rows.find((x) => !isBlank(x.cells[`spec${i}Name`]) || !isBlank(x.cells[`spec${i}Value`]));
    if (!r) continue;
    const key = cleanText(r.cells[`spec${i}Name`], 60);
    const value = cleanText(r.cells[`spec${i}Value`], 200);
    if (key && value) specifications.push({ key, value });
    else warn(r.rowNumber, `Detail ${i} needs both a Name and a Value. It is ignored.`);
  }
  const shelfLife = cleanText(firstOf("shelfLife")?.cells.shelfLife ?? "", 60);
  const countryOfOrigin = cleanText(firstOf("country")?.cells.country ?? "", 60);
  const fssaiLicense = cleanText(firstOf("fssai")?.cells.fssai ?? "", 40);

  // ---- name duplicates (a warning only)
  if (name) {
    const k = name.toLowerCase();
    if (ctx.existingNames.has(k)) warn(firstRow, `You already have a product named "${name}". A new one will be added.`);
    if (ctx.seenNamesInFile.has(k)) warn(firstRow, `"${name}" appears again in this file as a separate product.`);
    ctx.seenNamesInFile.add(k);
  }

  const status = errors.length ? "error" : draftReasons.length ? "draft" : "ready";
  const prices = variantRows.map((v) => v.price).filter((p) => p != null);
  return {
    key: group.key,
    name: name || "(no name)",
    rows: rows.map((r) => r.rowNumber),
    category: categoryRef?.path || categoryText,
    hasOptions,
    variantCount: variantRows.length,
    price: matrixSummary ? matrixSummary.price : (prices[0] ?? null),
    stock: variantRows.reduce((s, v) => s + (Number.isInteger(v.stock) ? v.stock : 0), 0),
    status,
    draftReasons: status === "error" ? [] : draftReasons,
    errors,
    warnings,
    // internal: what commit needs (never sent to the browser)
    draft: status === "error" ? null : {
      name,
      categoryRef,
      sku: productSkuGiven,
      axes: hasOptions ? axisNames.map((a) => ({ name: a.name, values: [...new Set(variantRows.map((v) => v.options[a.name]))], hasImages: false })) : [],
      variants: variantRows,
      parcel: parcel.complete ? parcel.value : parcel.partial,
      description, brand, isReturnable, specifications, shelfLife, countryOfOrigin, fssaiLicense,
    },
  };
}

/** Weight + box size of a product: the first filled value of each column across its rows. */
function readParcel(rows, warn) {
  const pick = (key) => {
    for (const r of rows) if (!isBlank(r.cells[key])) return r;
    return null;
  };
  const out = { weight: "", length: null, breadth: null, height: null };
  const wRow = pick("weight");
  if (wRow) {
    const raw = wRow.cells.weight;
    const unit = normalizeUnit(pick("weightUnit")?.cells.weightUnit);
    const asNumber = parseNumber(raw);
    let text = "";
    if (asNumber !== null && unit) text = `${asNumber} ${unit}`;
    else if (asNumber !== null && !isBlank(pick("weightUnit")?.cells.weightUnit ?? "")) {
      warn(wRow.rowNumber, `Weight Unit "${toText(pick("weightUnit").cells.weightUnit)}" is not g or kg. The weight is ignored.`);
    } else if (asNumber !== null) {
      warn(wRow.rowNumber, "Weight is filled but Weight Unit (g or kg) is empty. The weight is ignored.");
    } else if (parseWeightKg(toText(raw)) !== null) {
      text = toText(raw).trim();
    } else {
      warn(wRow.rowNumber, `Weight "${toText(raw)}" is not a number. The weight is ignored.`);
    }
    if (text && parseWeightKg(text) !== null) out.weight = text;
  }
  const dimLabels = { length: "Length", breadth: "Width", height: "Height" };
  for (const key of ["length", "breadth", "height"]) {
    const r = pick(key);
    if (!r) continue;
    const n = parseNumber(r.cells[key]);
    if (n === null || !(n > 0)) warn(r.rowNumber, `${dimLabels[key]} "${toText(r.cells[key])}" is not a valid number. It is ignored.`);
    else out[key] = n;
  }
  const complete = parseWeightKg(out.weight) !== null && out.length > 0 && out.breadth > 0 && out.height > 0;
  const anyGiven = Boolean(out.weight) || out.length || out.breadth || out.height;
  if (!complete && anyGiven) {
    const missing = [];
    if (parseWeightKg(out.weight) === null) missing.push("Weight");
    if (!(out.length > 0)) missing.push("Length");
    if (!(out.breadth > 0)) missing.push("Width");
    if (!(out.height > 0)) missing.push("Height");
    warn(rows[0].rowNumber, `Parcel size is incomplete (missing: ${missing.join(", ")}). The product is saved as a draft until you add it.`);
  }
  return {
    complete,
    value: complete ? { weight: out.weight, length: out.length, breadth: out.breadth, height: out.height } : null,
    partial: { weight: out.weight || "", length: out.length || undefined, breadth: out.breadth || undefined, height: out.height || undefined },
  };
}

/** What the browser gets: the plan without the internal draft payloads. */
export function publicPlan(plan) {
  return {
    summary: plan.summary,
    products: plan.products.map(({ draft, ...rest }) => rest),
  };
}
