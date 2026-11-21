import { COLUMNS, MAX_ROWS } from "../app/services/bulkProduct/columns.js";
import { planProducts, rowsFromMatrix, publicPlan } from "../app/services/bulkProduct/plan.js";
import { commitPlan, summarizeResults } from "../app/services/bulkProduct/commit.js";
import { buildCategoryIndex } from "../app/services/bulkProduct/categories.js";
import { buildTemplateSpec, exampleRows } from "../app/services/bulkProduct/templateSpec.js";
import { cleanText, cleanParagraph, parseNumber, parseYesNo, splitList, normalizeImageUrl, normalizeUnit, toText, safeForSheet } from "../app/services/bulkProduct/cells.js";
import { isPrivateAddress } from "../app/services/bulkProduct/images.js";
import { computeDraftReasons, publishBlockedMessage } from "../app/utils/draftCheck.js";

// ---------------------------------------------------------------- helpers
const HEADERS = COLUMNS.map((c) => c.title);
const toRow = (obj) => COLUMNS.map((c) => (obj[c.key] === undefined ? null : obj[c.key]));
const sheet = (...rowObjs) => [HEADERS, ...rowObjs.map(toRow)];

const cats = [
  { _id: "h1", name: "Fashion", type: "header", status: "active", catalogType: "grocery" },
  { _id: "c1", name: "Men", type: "category", parentId: "h1", status: "active" },
  { _id: "s1", name: "Shirts", type: "subcategory", parentId: "c1", status: "active" },
  { _id: "s2", name: "Jeans", type: "subcategory", parentId: "c1", status: "active" },
  { _id: "s3", name: "Old", type: "subcategory", parentId: "c1", status: "inactive" },
  { _id: "h2", name: "Grocery", type: "header", status: "active", catalogType: "grocery" },
  { _id: "c2", name: "Staples", type: "category", parentId: "h2", status: "active" }, // no sub-categories
  { _id: "h3", name: "Refurbished", type: "header", status: "active", catalogType: "refurbished" },
  { _id: "c3", name: "Phones", type: "category", parentId: "h3", status: "active" },
];
const index = buildCategoryIndex(cats);
const ctx = (over = {}) => ({ resolveCategory: index.resolve, existingSkus: new Set(), existingNames: new Set(), ...over });
const planOf = (matrix, over) => {
  const { rows, fileErrors } = rowsFromMatrix(matrix);
  expect(fileErrors).toEqual([]);
  return planProducts(rows, ctx(over));
};

const simple = { name: "Rice 5kg", category: "Grocery > Staples", price: 650, stock: 40 };
const full = { ...simple, weight: 5, weightUnit: "kg", length: 30, breadth: 20, height: 10, image: "https://x.test/rice.jpg" };

// ---------------------------------------------------------------- cells
describe("cell helpers (never throw on bad input)", () => {
  test("toText handles Excel cell objects", () => {
    expect(toText({ richText: [{ text: "a" }, { text: "b" }] })).toBe("ab");
    expect(toText({ text: "link", hyperlink: "https://x" })).toBe("link");
    expect(toText({ formula: "A1+1", result: 5 })).toBe("5");
    expect(toText(null)).toBe("");
    expect(toText(new Date("2026-01-02T00:00:00Z"))).toBe("2026-01-02");
  });
  test("cleanText strips tags and control characters", () => {
    expect(cleanText("  <b>Hello</b>   <script>x</script> world ")).toBe("Hello x world");
    expect(cleanParagraph("<p>Line 1</p>\r\n\r\n\r\n\r\nLine 2")).toBe("Line 1\n\nLine 2");
  });
  test("parseNumber is forgiving", () => {
    expect(parseNumber("₹1,299")).toBe(1299);
    expect(parseNumber(" Rs. 50 ")).toBe(50);
    expect(parseNumber(12.5)).toBe(12.5);
    expect(parseNumber("12abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber("1e5")).toBeNull();
  });
  test("yes/no, lists, units, links", () => {
    expect(parseYesNo("Yes")).toBe(true);
    expect(parseYesNo("nahi")).toBe(false);
    expect(parseYesNo("")).toBeUndefined();
    expect(parseYesNo("maybe")).toBeNull();
    expect(splitList("a, b\nA; c")).toEqual(["a", "b", "c"]);
    expect(normalizeUnit("Grams")).toBe("g");
    expect(normalizeUnit("KG")).toBe("kg");
    expect(normalizeUnit("lb")).toBeNull();
    expect(normalizeImageUrl("https://x.test/a.jpg")).toBe("https://x.test/a.jpg");
    expect(normalizeImageUrl("ftp://x/a.jpg")).toBeNull();
    expect(normalizeImageUrl("not a link")).toBeNull();
    expect(normalizeImageUrl("https://drive.google.com/file/d/ABC123/view?usp=sharing")).toBe("https://drive.google.com/uc?export=download&id=ABC123");
  });
  test("formula-looking text is made safe for sheets", () => {
    expect(safeForSheet("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(safeForSheet("@x")).toBe("'@x");
    expect(safeForSheet("plain")).toBe("plain");
  });
  test("private network addresses are refused for photo links", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "::1", "fd00::1"]) expect(isPrivateAddress(ip)).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });
});

// ---------------------------------------------------------------- reading the sheet
describe("rowsFromMatrix", () => {
  test("finds the header, skips empty rows and EXAMPLE rows", () => {
    const m = sheet({ name: "EXAMPLE - Rice", category: "x", price: 1, stock: 1 }, {}, simple, { group: "example-shirt", name: "n" });
    const { rows, fileErrors } = rowsFromMatrix(m);
    expect(fileErrors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].rowNumber).toBe(4); // Excel row number
  });
  test("a file that is not our template", () => {
    expect(rowsFromMatrix([["a", "b"], [1, 2]]).fileErrors[0]).toMatch(/fresh template/);
    expect(rowsFromMatrix(null).fileErrors).toHaveLength(1);
  });
  test("a missing required column is reported by name", () => {
    const m = [HEADERS.filter((h) => !/^Price/.test(h)), ["x"]];
    expect(rowsFromMatrix(m).fileErrors.join(" ")).toMatch(/Price/);
  });
  test("titles are matched loosely (case, star, spaces, old names)", () => {
    const m = [["product name", "CATEGORY *", " price*", "Stock", "Width"], ["Rice", "Grocery > Staples", 10, 5, 20]];
    const { rows, fileErrors } = rowsFromMatrix(m);
    expect(fileErrors).toEqual([]);
    expect(rows[0].cells.breadth).toBe(20);
  });
  test("too many rows", () => {
    const m = sheet(...Array.from({ length: MAX_ROWS + 1 }, (_, i) => ({ ...simple, name: `P${i}` })));
    expect(rowsFromMatrix(m).fileErrors[0]).toMatch(/at most/);
  });
  test("only example rows -> a friendly message", () => {
    expect(rowsFromMatrix(sheet({ name: "EXAMPLE - x" })).fileErrors[0]).toMatch(/No product rows/);
  });
});

// ---------------------------------------------------------------- categories
describe("category list", () => {
  test("lists leaf paths only and skips inactive ones", () => {
    expect(index.paths).toEqual(expect.arrayContaining(["Fashion > Men > Shirts", "Fashion > Men > Jeans", "Grocery > Staples"]));
    expect(index.paths).not.toContain("Fashion > Men > Old");
    expect(index.paths).not.toContain("Fashion > Men"); // has sub-categories
  });
  test("resolve: exact (case/space tolerant), needs sub-category, unknown, refurbished", () => {
    expect(index.resolve("fashion>men > SHIRTS").ref).toMatchObject({ headerId: "h1", categoryId: "c1", subcategoryId: "s1" });
    expect(index.resolve("Grocery > Staples").ref).toMatchObject({ headerId: "h2", categoryId: "c2", subcategoryId: null });
    expect(index.resolve("Fashion > Men").message).toMatch(/has sub-categories.*Shirts/);
    expect(index.resolve("Shirts").message).toMatch(/Did you mean "Fashion > Men > Shirts"/);
    expect(index.resolve("Nothing > Here").ok).toBe(false);
    expect(index.resolve("").ok).toBe(false);
    expect(index.resolve("Refurbished > Phones").message).toMatch(/refurbished/);
  });
});

// ---------------------------------------------------------------- single products
describe("single products", () => {
  test("only the 4 must-have fields -> saved as a DRAFT (no photo, no parcel size), not an error", () => {
    const { products, summary } = planOf(sheet(simple));
    expect(products[0].status).toBe("draft");
    expect(products[0].draftReasons).toEqual(["photo", "parcel"]);
    expect(products[0].errors).toEqual([]);
    expect(summary).toMatchObject({ rows: 1, products: 1, ready: 0, draft: 1, failed: 0 });
    expect(products[0].draft.sku).toBe(""); // auto SKU at save time
  });
  test("everything filled -> ready", () => {
    const { products } = planOf(sheet(full));
    expect(products[0].status).toBe("ready");
    expect(products[0].draftReasons).toEqual([]);
    expect(products[0].draft.parcel).toEqual({ weight: "5 kg", length: 30, breadth: 20, height: 10 });
    expect(products[0].draft.variants[0].imageUrls).toEqual(["https://x.test/rice.jpg"]);
  });
  test("photo yes, parcel no -> draft with only the parcel reason; and the other way", () => {
    expect(planOf(sheet({ ...simple, image: "https://x.test/a.jpg" })).products[0].draftReasons).toEqual(["parcel"]);
    expect(planOf(sheet({ ...simple, weight: 5, weightUnit: "kg", length: 1, breadth: 1, height: 1 })).products[0].draftReasons).toEqual(["photo"]);
  });
  test("partial parcel size is a warning that names what is missing", () => {
    const p = planOf(sheet({ ...simple, image: "https://x.test/a.jpg", weight: 500, weightUnit: "g", length: 10 })).products[0];
    expect(p.status).toBe("draft");
    expect(p.warnings.map((w) => w.message).join(" ")).toMatch(/missing: Width, Height/);
  });
  test("weight forms: number + unit, text like '500 g', unit missing, bad unit, bad number", () => {
    const base = { ...simple, image: "https://x.test/a.jpg", length: 1, breadth: 1, height: 1 };
    const w = (extra) => planOf(sheet({ ...base, ...extra })).products[0];
    expect(w({ weight: 500, weightUnit: "g" }).status).toBe("ready");
    expect(w({ weight: "1.5 kg" }).status).toBe("ready");
    expect(w({ weight: 500 }).status).toBe("draft");
    expect(w({ weight: 500 }).warnings[0].message).toMatch(/Weight Unit/);
    expect(w({ weight: 500, weightUnit: "lb" }).status).toBe("draft");
    expect(w({ weight: "heavy", weightUnit: "g" }).status).toBe("draft");
  });
  test("bad optional values never crash: they are ignored with a message", () => {
    const p = planOf(sheet({ ...full, returnable: "maybe", length: "abc", spec1Name: "Fabric", image: "not a link", images: "ftp://x" })).products[0];
    expect(p.status).toBe("draft"); // bad length -> parcel incomplete, bad photo links -> no photo
    expect(p.draftReasons.sort()).toEqual(["parcel", "photo"]);
    expect(p.draft.isReturnable).toBe(true);
    expect(p.warnings.length).toBeGreaterThanOrEqual(3);
    expect(p.draft.specifications).toEqual([]); // name without value is dropped
  });
  test("optional extras are read", () => {
    const p = planOf(sheet({ ...full, brand: "India Gate", returnable: "No", spec1Name: "Type", spec1Value: "Basmati", shelfLife: "12 Months", country: "India", description: "<b>Good</b> rice" })).products[0];
    expect(p.draft).toMatchObject({ brand: "India Gate", isReturnable: false, shelfLife: "12 Months", countryOfOrigin: "India", description: "Good rice" });
    expect(p.draft.specifications).toEqual([{ key: "Type", value: "Basmati" }]);
  });
  test("the template has only fields that exist in the Add / Edit Product form (no Return Days, no Tags)", () => {
    const keys = COLUMNS.map((c) => c.key);
    expect(keys).not.toContain("returnDays");
    expect(keys).not.toContain("tags");
    expect(keys).toContain("returnable");
  });
  test("an older template that still has Return Days / Tags columns is read without any error", () => {
    const oldSheet = [[...HEADERS, "Tags", "Return Days"], [...toRow(full), "a, b", 10]];
    const r = { products: planOf(oldSheet).products };
    const p = r.products[0];
    expect(p.draft.returnWindowDays).toBeUndefined();
    expect(p.draft.tags).toBeUndefined();
  });
});

// ---------------------------------------------------------------- errors
describe("row errors are specific and never crash", () => {
  const status = (obj) => planOf(sheet(obj)).products[0];
  test.each([
    [{ ...simple, name: "" }, /Product Name is empty/],
    [{ ...simple, category: "" }, /Category is empty/],
    [{ ...simple, category: "Nope > Nope" }, /not in the list/],
    [{ ...simple, price: "" }, /Price is empty/],
    [{ ...simple, price: "free" }, /not a valid number/],
    [{ ...simple, price: 0 }, /not a valid number/],
    [{ ...simple, stock: "" }, /Stock is empty/],
    [{ ...simple, stock: "ten" }, /whole number/],
    [{ ...simple, stock: 2.5 }, /whole number/],
    [{ ...simple, stock: -1 }, /whole number/],
    [{ ...simple, salePrice: 700 }, /cannot be more than Price/],
    [{ ...simple, salePrice: "x" }, /Sale Price/],
  ])("%j", (row, msg) => {
    const p = status(row);
    expect(p.status).toBe("error");
    expect(p.errors.map((e) => e.message).join(" | ")).toMatch(msg);
    expect(p.errors[0].row).toBe(2);
    expect(p.draft).toBeNull();
  });
  test("price with ₹ and commas, stock 0 and empty sale price are fine", () => {
    const p = status({ ...simple, price: "₹1,299", stock: 0, salePrice: "" });
    expect(p.status).toBe("draft");
    expect(p.price).toBe(1299);
  });
  test("one bad product does not stop the others", () => {
    const { products, summary } = planOf(sheet({ ...full, name: "A" }, { ...simple, name: "B", price: "x" }, { ...simple, name: "C" }));
    expect(products.map((p) => p.status)).toEqual(["ready", "error", "draft"]);
    expect(summary).toMatchObject({ products: 3, ready: 1, draft: 1, failed: 1 });
  });
});

// ---------------------------------------------------------------- options (size / color)
const shirt = { group: "SHIRT-01", name: "Cotton Shirt", category: "Fashion > Men > Shirts", price: 999, stock: 5 };
const vrow = (size, color, extra = {}) => ({ group: "SHIRT-01", price: 999, stock: 5, opt1Name: "Size", opt1Value: size, opt2Name: "Color", opt2Value: color, ...extra });

describe("products with options", () => {
  test("rows with the same group become ONE product with a combination per row", () => {
    const m = sheet(
      { ...shirt, ...vrow("M", "Red", { image: "https://x.test/red.jpg", weight: 300, weightUnit: "g", length: 30, breadth: 25, height: 4 }) },
      vrow("M", "Blue", { image: "https://x.test/blue.jpg" }),
      vrow("L", "Red"), // same colour: shares the red photo
    );
    const { products } = planOf(m);
    expect(products).toHaveLength(1);
    const p = products[0];
    expect(p.status).toBe("ready");
    expect(p.hasOptions).toBe(true);
    expect(p.variantCount).toBe(3);
    expect(p.rows).toEqual([2, 3, 4]);
    expect(p.stock).toBe(15);
    expect(p.draft.axes.map((a) => [a.name, a.values])).toEqual([["Size", ["M", "L"]], ["Color", ["Red", "Blue"]]]);
    expect(p.draft.sku).toBe("SHIRT-01"); // the group is the product code
    expect(p.warnings).toEqual([]); // every colour has a photo on some row
  });
  test("only one option (Size)", () => {
    const { products } = planOf(sheet(
      { group: "JEANS", name: "Jeans", category: "Fashion > Men > Jeans", price: 1299, stock: 3, opt1Name: "Size", opt1Value: "30" },
      { group: "JEANS", price: 1299, stock: 4, opt1Name: "Size", opt1Value: "32" },
    ));
    expect(products[0].variantCount).toBe(2);
    expect(products[0].draft.axes).toHaveLength(1);
    expect(products[0].status).toBe("draft");
  });
  test("a colour without any photo link is a warning, not a blocker", () => {
    const m = sheet({ ...shirt, ...vrow("M", "Red", { image: "https://x.test/red.jpg", weight: 1, weightUnit: "kg", length: 1, breadth: 1, height: 1 }) }, vrow("M", "Blue"));
    const p = planOf(m).products[0];
    expect(p.status).toBe("ready");
    expect(p.warnings.map((w) => w.message).join(" ")).toMatch(/No photo link for Color: Blue/);
  });
  test("errors: option value empty, duplicate combination, group without options, value without name", () => {
    expect(planOf(sheet({ ...shirt, ...vrow("M", "Red") }, vrow("L", ""))).products[0].errors.map((e) => e.message).join(" ")).toMatch(/Color is empty on this row/);
    expect(planOf(sheet({ ...shirt, ...vrow("M", "Red") }, vrow("m", "red"))).products[0].errors.map((e) => e.message).join(" ")).toMatch(/added twice/);
    expect(planOf(sheet({ ...shirt }, { group: "SHIRT-01", price: 1, stock: 1 })).products[0].errors.map((e) => e.message).join(" ")).toMatch(/no Option is given/);
    expect(planOf(sheet({ ...shirt, opt1Value: "M" })).products[0].errors.map((e) => e.message).join(" ")).toMatch(/Option 1 Name is empty/);
  });
  test("a bad price on ONE combination fails the whole product (no half products)", () => {
    const p = planOf(sheet({ ...shirt, ...vrow("M", "Red") }, vrow("L", "Red", { price: "x" }))).products[0];
    expect(p.status).toBe("error");
    expect(p.errors[0].row).toBe(3);
  });
  test("options typed without a group are saved as one product with one combination (with a note)", () => {
    const p = planOf(sheet({ name: "Mug", category: "Grocery > Staples", price: 5, stock: 1, opt1Name: "Size", opt1Value: "L" })).products[0];
    expect(p.hasOptions).toBe(true);
    expect(p.warnings[0].message).toMatch(/no Product Group/);
  });
});

// ---------------------------------------------------------------- SKUs and duplicates
describe("SKU and duplicate protection", () => {
  test("a SKU that already exists is refused (file uploaded before)", () => {
    const p = planOf(sheet({ ...simple, sku: "RICE-5KG" }), { existingSkus: new Set(["rice-5kg"]) }).products[0];
    expect(p.status).toBe("error");
    expect(p.errors[0].message).toMatch(/already exists.*uploaded before/);
  });
  test("an existing Product Group is refused too", () => {
    const p = planOf(sheet({ ...shirt, ...vrow("M", "Red") }), { existingSkus: new Set(["shirt-01"]) }).products[0];
    expect(p.errors[0].message).toMatch(/Product Group "SHIRT-01" already exists/);
  });
  test("the same SKU twice in the file", () => {
    const { products } = planOf(sheet({ ...simple, name: "A", sku: "X1" }, { ...simple, name: "B", sku: "x1" }));
    expect(products[0].status).toBe("draft");
    expect(products[1].status).toBe("error");
    expect(products[1].errors[0].message).toMatch(/used twice/);
  });
  test("same name as an existing product is only a warning", () => {
    const p = planOf(sheet(simple), { existingNames: new Set(["rice 5kg"]) }).products[0];
    expect(p.status).toBe("draft");
    expect(p.warnings[0].message).toMatch(/already have a product named/);
  });
});

// ---------------------------------------------------------------- preview shape
describe("publicPlan", () => {
  test("never exposes the internal draft payload", () => {
    const pub = publicPlan(planOf(sheet(full)));
    expect(pub.products[0].draft).toBeUndefined();
    expect(pub.products[0]).toMatchObject({ name: "Rice 5kg", status: "ready", category: "Grocery > Staples" });
  });
});

// ---------------------------------------------------------------- saving
const makeDeps = (over = {}) => {
  const created = [];
  let n = 0;
  return {
    created,
    deps: {
      sellerId: "seller1",
      moderation: { approvalStatus: "approved" },
      fetchImage: async (u) => {
        if (u.includes("broken")) throw new Error("The link answered with an error (404).");
        return { buffer: Buffer.from("x"), mimeType: "image/jpeg" };
      },
      uploadImage: async (_b, _f) => `https://cdn.test/${(n += 1)}.jpg`,
      makeUnique: { sku: async (name) => `AUTO-${name.slice(0, 3).toUpperCase()}`, slug: async (name) => name.toLowerCase().replace(/\s+/g, "-") },
      createProduct: async (data) => { created.push(data); return { _id: `id${created.length}` }; },
      afterCreate: async () => {},
      ...over,
    },
  };
};

describe("commitPlan", () => {
  test("ready single product: active, photo uploaded, one default variant, parcel saved", async () => {
    const { deps, created } = makeDeps();
    const res = await commitPlan(planOf(sheet({ ...full, image: "https://x.test/a.jpg", images: "https://x.test/b.jpg" })), deps);
    expect(res[0]).toMatchObject({ status: "created", draftReasons: [] });
    const doc = created[0];
    expect(doc).toMatchObject({ status: "active", name: "Rice 5kg", sku: "AUTO-RIC", slug: "rice-5kg", weight: "5 kg", length: 30, sellerId: "seller1", approvalStatus: "approved", headerId: "h2", categoryId: "c2", subcategoryId: null });
    expect(doc.mainImage).toMatch(/cdn\.test/);
    expect(doc.galleryImages).toHaveLength(1);
    expect(doc.variants).toEqual([{ name: "", price: 650, salePrice: 0, stock: 40, sku: "AUTO-RIC", images: [] }]);
    expect(doc.draftReasons).toEqual([]);
  });
  test("draft: inactive + reasons stored", async () => {
    const { deps, created } = makeDeps();
    const res = await commitPlan(planOf(sheet(simple)), deps);
    expect(res[0]).toMatchObject({ status: "created_draft", draftReasons: ["photo", "parcel"] });
    expect(created[0]).toMatchObject({ status: "inactive", draftReasons: ["photo", "parcel"] });
    expect(created[0].mainImage).toBeUndefined();
  });
  test("a photo that cannot be downloaded makes a draft with a message, the product is still saved", async () => {
    const { deps, created } = makeDeps();
    const res = await commitPlan(planOf(sheet({ ...full, image: "https://x.test/broken.jpg" })), deps);
    expect(res[0].status).toBe("created_draft");
    expect(res[0].draftReasons).toEqual(["photo"]);
    expect(res[0].warnings[0].message).toMatch(/could not be used.*404/);
    expect(created).toHaveLength(1);
  });
  test("the same photo link on many rows is downloaded once", async () => {
    let fetches = 0;
    const { deps } = makeDeps({ fetchImage: async () => { fetches += 1; return { buffer: Buffer.from("x"), mimeType: "image/png" }; } });
    await commitPlan(planOf(sheet(
      { ...shirt, ...vrow("M", "Red", { image: "https://x.test/red.jpg" }) },
      vrow("L", "Red", { image: "https://x.test/red.jpg" }),
    )), deps);
    expect(fetches).toBe(1);
  });
  test("options product: combinations, colour photos shared, listing price and total stock", async () => {
    const { deps, created } = makeDeps();
    const m = sheet(
      { ...shirt, ...vrow("M", "Red", { price: 1000, salePrice: 800, stock: 4, image: "https://x.test/red.jpg", weight: 300, weightUnit: "g", length: 30, breadth: 25, height: 4 }) },
      vrow("M", "Blue", { price: 900, stock: 0, image: "https://x.test/blue.jpg" }),
      vrow("L", "Red", { price: 1100, stock: 6 }),
    );
    const res = await commitPlan(planOf(m), deps);
    expect(res[0].status).toBe("created");
    const doc = created[0];
    expect(doc.variantOptions.map((o) => [o.name, o.hasImages])).toEqual([["Size", false], ["Color", true]]);
    expect(doc.variants.map((v) => v.name)).toEqual(["M / Red", "M / Blue", "L / Red"]);
    expect(doc.variants.map((v) => v.sku)).toEqual(["SHIRT-01-001", "SHIRT-01-002", "SHIRT-01-003"]);
    expect(doc.variants[2].images).toEqual(doc.variants[0].images); // L / Red shares the Red photo
    expect(doc.variants[1].images).not.toEqual(doc.variants[0].images);
    expect(doc).toMatchObject({ stock: 10, price: 1000, salePrice: 800, sku: "SHIRT-01", status: "active" });
    expect(doc.mainImage).toBe(doc.variants[0].images[0]);
  });
  test("errors are skipped, the others are saved; one failing save does not stop the rest", async () => {
    let calls = 0;
    const { deps, created } = makeDeps({
      createProduct: async (data) => {
        calls += 1;
        if (calls === 1) { const e = new Error("dup"); e.code = 11000; throw e; }
        created.push(data);
        return { _id: `id${calls}` };
      },
    });
    const plan = planOf(sheet({ ...full, name: "A" }, { ...simple, name: "B", price: "x" }, { ...full, name: "C" }));
    const res = await commitPlan(plan, deps);
    expect(res.map((r) => r.status)).toEqual(["failed", "skipped", "created"]);
    expect(res[0].message).toMatch(/already exists/);
    expect(summarizeResults(res)).toEqual({ created: 1, drafts: 0, failed: 2 });
  });
  test("a crash while preparing one product is reported on that product only", async () => {
    const { deps } = makeDeps({ makeUnique: { sku: async () => { throw new Error("db down"); }, slug: async () => "s" } });
    const res = await commitPlan(planOf(sheet(simple)), deps);
    expect(res[0]).toMatchObject({ status: "failed", message: "db down" });
  });
});

// ---------------------------------------------------------------- the template content
describe("template content", () => {
  const spec = buildTemplateSpec({ categoryPaths: index.paths });
  test("example rows cover single, size+color and size-only products, all marked EXAMPLE and ignored on upload", () => {
    const ex = exampleRows(index.paths);
    expect(ex.every((r) => /^example/i.test(r.name || r.group))).toBe(true);
    expect(ex[0].opt1Name).toBeUndefined(); // single product
    expect(ex.filter((r) => r.group === "EXAMPLE-SHIRT")).toHaveLength(3);
    expect(ex.filter((r) => r.group === "EXAMPLE-SHIRT").every((r) => r.opt2Name === "Color")).toBe(true);
    expect(ex.filter((r) => r.group === "EXAMPLE-JEANS").every((r) => r.opt1Name === "Size" && !r.opt2Name)).toBe(true);
    // none of them is picked up by the reader
    const m = [HEADERS, ...ex.map(toRow)];
    expect(rowsFromMatrix(m).rows).toHaveLength(0);
  });
  test("examples use real categories from the list", () => {
    expect(index.paths).toContain(spec.examples[0].category);
  });
  test("instructions explain the important things", () => {
    const text = spec.readme.map((l) => l.text || (l.rows || []).map((r) => r.join(" ")).join(" ")).join("\n");
    for (const needle of [/Product Name/, /Category/, /Price/, /Stock/, /DRAFT/, /parcel size/i, /Product Group/, /one row for each combination/i, /Google Drive/, /\.xlsx/]) {
      expect(text).toMatch(needle);
    }
  });
  test("exactly the four must-have columns are marked required", () => {
    expect(COLUMNS.filter((c) => c.required).map((c) => c.key)).toEqual(["name", "category", "price", "stock"]);
    expect(COLUMNS.filter((c) => c.required).every((c) => c.title.endsWith("*"))).toBe(true);
  });
});

// ---------------------------------------------------------------- draft rules (also used when the seller publishes)
describe("draft rules", () => {
  const complete = { mainImage: "https://x/a.jpg", weight: "500 g", length: 10, breadth: 10, height: 10, variants: [] };
  test("computeDraftReasons", () => {
    expect(computeDraftReasons(complete)).toEqual([]);
    expect(computeDraftReasons({ ...complete, mainImage: "" })).toEqual(["photo"]);
    expect(computeDraftReasons({ ...complete, mainImage: "", variants: [{ images: ["https://x/v.jpg"] }] })).toEqual([]); // a variant photo counts
    expect(computeDraftReasons({ ...complete, weight: "" })).toEqual(["parcel"]);
    expect(computeDraftReasons({ ...complete, height: undefined })).toEqual(["parcel"]);
    expect(computeDraftReasons({})).toEqual(["photo", "parcel"]);
  });
  test("publish message", () => {
    expect(publishBlockedMessage(["photo", "parcel"])).toBe("Add a product photo and the parcel weight and box size before publishing this product.");
    expect(publishBlockedMessage(["parcel"])).toMatch(/parcel weight and box size/);
  });
});
