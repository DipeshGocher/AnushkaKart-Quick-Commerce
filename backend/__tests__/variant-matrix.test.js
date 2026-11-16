import {
  normalizeOptions,
  normalizeVariants,
  buildVariantMatrix,
  propagateGroupImages,
  matrixSummary,
  hasOptions,
  findVariantBySku,
} from "../app/utils/variantMatrix.js";

const opts = [
  { name: "Size", values: ["M", "L", "XL"] },
  { name: "Color", values: ["Red", "Blue"], hasImages: true },
];
const row = (size, color, extra = {}) => ({ options: { Size: size, Color: color }, price: 999, salePrice: 799, stock: 5, ...extra });

describe("normalizeOptions", () => {
  test("empty / missing means a classic product", () => {
    expect(normalizeOptions(undefined)).toEqual([]);
    expect(normalizeOptions([])).toEqual([]);
    expect(normalizeOptions("")).toEqual([]);
  });
  test("trims, drops blanks and duplicate values (case-insensitive)", () => {
    const [o] = normalizeOptions([{ name: " Size ", values: ["M", " m ", "", "L"] }]);
    expect(o).toEqual({ name: "Size", values: ["M", "L"], hasImages: false });
  });
  test("max 3 options, unique names, needs values, no dots", () => {
    expect(() => normalizeOptions([1, 2, 3, 4].map((i) => ({ name: "O" + i, values: ["a"] })))).toThrow(/at most 3/);
    expect(() => normalizeOptions([{ name: "Size", values: ["a"] }, { name: "size", values: ["b"] }])).toThrow(/twice/);
    expect(() => normalizeOptions([{ name: "Size", values: [] }])).toThrow(/at least one value/);
    expect(() => normalizeOptions([{ name: "S.ize", values: ["a"] }])).toThrow(/cannot contain/);
    expect(() => normalizeOptions([{ name: "", values: ["a"] }])).toThrow(/needs a name/);
  });
  test("only one option can carry the photos", () => {
    const out = normalizeOptions([{ name: "A", values: ["x"], hasImages: true }, { name: "B", values: ["y"], hasImages: true }]);
    expect(out.map((o) => o.hasImages)).toEqual([true, false]);
  });
});

describe("normalizeVariants", () => {
  const axes = normalizeOptions(opts);
  test("names the variant from its options and fixes value spelling", () => {
    const [v] = normalizeVariants(axes, [row("l", "RED")]);
    expect(v.name).toBe("L / Red");
    expect(v.options).toEqual({ Size: "L", Color: "Red" });
  });
  test("a combination that is not listed simply does not exist (L/Red missing is fine)", () => {
    const out = normalizeVariants(axes, [row("XL", "Red"), row("M", "Red"), row("L", "Blue")]);
    expect(out.map((v) => v.name)).toEqual(["XL / Red", "M / Red", "L / Blue"]);
  });
  test("rejects unknown option value, missing option, duplicate combination", () => {
    expect(() => normalizeVariants(axes, [row("XXXL", "Red")])).toThrow(/valid "Size"/);
    expect(() => normalizeVariants(axes, [{ options: { Size: "M" }, price: 1, stock: 1 }])).toThrow(/valid "Color"/);
    expect(() => normalizeVariants(axes, [row("M", "Red"), row("m", "red")])).toThrow(/added twice/);
  });
  test("price, sale price and stock rules", () => {
    expect(() => normalizeVariants(axes, [row("M", "Red", { price: "" })])).toThrow(/Enter a price/);
    expect(() => normalizeVariants(axes, [row("M", "Red", { salePrice: 5000 })])).toThrow(/cannot be more/);
    expect(() => normalizeVariants(axes, [row("M", "Red", { stock: -1 })])).toThrow(/Stock/);
    expect(() => normalizeVariants(axes, [row("M", "Red", { stock: 1.5 })])).toThrow(/Stock/);
    expect(normalizeVariants(axes, [row("M", "Red", { stock: 0, salePrice: "" })])[0].stock).toBe(0); // sold out is allowed
    expect(() => normalizeVariants(axes, [])).toThrow(/at least one/);
  });
});

describe("photos follow the Color option", () => {
  const axes = normalizeOptions(opts);
  test("every size of a colour gets that colour's photos; new uploads win", () => {
    const rows = normalizeVariants(axes, [
      row("M", "Red", { images: ["red1.jpg", "red2.jpg"] }),
      row("L", "Red", { images: [] }),
      row("M", "Blue", { images: ["old-blue.jpg"] }),
      row("L", "Blue", { images: ["new-blue.jpg"] }),
    ]);
    const out = propagateGroupImages(axes, rows, new Set([3]));
    expect(out[1].images).toEqual(["red1.jpg", "red2.jpg"]);
    expect(out[2].images).toEqual(["new-blue.jpg"]);
    expect(out[3].images).toEqual(["new-blue.jpg"]);
  });
  test("no photo option means photos are left alone", () => {
    const a = normalizeOptions([{ name: "Size", values: ["M"] }]);
    const rows = normalizeVariants(a, [{ options: { Size: "M" }, price: 1, stock: 1, images: ["x.jpg"] }]);
    expect(propagateGroupImages(a, rows)[0].images).toEqual(["x.jpg"]);
  });
});

describe("buildVariantMatrix + summary", () => {
  test("returns null for classic products (old behaviour untouched)", () => {
    expect(buildVariantMatrix([], [{ name: "500g", price: 10, stock: 1 }])).toBeNull();
  });
  test("price = cheapest in-stock selling price, stock = total", () => {
    const built = buildVariantMatrix(opts, [
      row("M", "Red", { price: 500, salePrice: 0, stock: 0 }), // cheapest but sold out
      row("L", "Red", { price: 900, salePrice: 700, stock: 2 }),
      row("XL", "Red", { price: 1200, salePrice: 0, stock: 3 }),
    ]);
    expect(built.summary).toEqual({ price: 900, salePrice: 700, stock: 5 });
  });
  test("all sold out still gives a price", () => {
    expect(matrixSummary([{ price: 300, salePrice: 0, stock: 0 }, { price: 200, salePrice: 0, stock: 0 }]).price).toBe(200);
  });
});

describe("lookups", () => {
  const p = { variantOptions: [{ name: "Size", values: ["M"] }], variants: [{ sku: "SH-M", name: "M" }] };
  test("hasOptions / findVariantBySku", () => {
    expect(hasOptions(p)).toBe(true);
    expect(hasOptions({ variants: [{ name: "500g" }] })).toBe(false);
    expect(findVariantBySku(p, " sh-m ").name).toBe("M");
    expect(findVariantBySku(p, "nope")).toBeNull();
    expect(findVariantBySku(p, "")).toBeNull();
  });
});

import { mergeUploadedImages } from "../app/utils/variantMatrix.js";

describe("photo upload chain (what the controller does)", () => {
  test("old saved photos + new uploads on the colour's first row, then copied to every size", () => {
    const axes = normalizeOptions(opts);
    const rows = [
      row("M", "Red", { images: ["https://c/red-old.jpg", "blob:junk"] }),
      row("L", "Red", { images: ["https://c/red-old.jpg"] }),
      row("M", "Blue"),
      row("L", "Blue"),
    ];
    const uploads = { 0: ["https://c/red-new.jpg"], 2: ["https://c/blue-new.jpg"] };
    const merged = rows.map((v, i) => ({ ...v, images: uploads[i] ? mergeUploadedImages(v, uploads[i]) : v.images || [] }));
    const built = buildVariantMatrix(axes, merged, new Set([0, 2]));
    expect(built.variants[0].images).toEqual(["https://c/red-old.jpg", "https://c/red-new.jpg"]);
    expect(built.variants[1].images).toEqual(["https://c/red-old.jpg", "https://c/red-new.jpg"]); // L / Red follows M / Red
    expect(built.variants[2].images).toEqual(["https://c/blue-new.jpg"]);
    expect(built.variants[3].images).toEqual(["https://c/blue-new.jpg"]);
  });
  test("removing a saved photo in the form removes it for the whole colour", () => {
    const axes = normalizeOptions(opts);
    const rows = [row("M", "Red", { images: ["https://c/a.jpg"] }), row("L", "Red", { images: [] })];
    const built = buildVariantMatrix(axes, rows);
    expect(built.variants[1].images).toEqual(["https://c/a.jpg"]); // copied
    const afterRemove = [row("M", "Red", { images: [] }), row("L", "Red", { images: [] })];
    expect(buildVariantMatrix(axes, afterRemove).variants.every((v) => v.images.length === 0)).toBe(true);
  });
});
