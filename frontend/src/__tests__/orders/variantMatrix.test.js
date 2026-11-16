import {
  cartesian, syncVariants, validateMatrix, imageGroups, groupFilesToFields, variantsForSubmit,
  matchingVariants, optionValueStates, resolveVariant, defaultVariant, pickVariantAfterTap, variantPhotos,
  isMatrixProduct, defaultImageAxis,
} from "../../shared/utils/variantMatrix.js";

const axes = [
  { name: "Size", values: ["M", "L", "XL"], hasImages: false },
  { name: "Color", values: ["Red", "Blue"], hasImages: true },
];
const v = (size, color, stock = 5, extra = {}) => ({ options: { Size: size, Color: color }, name: `${size} / ${color}`, price: 999, salePrice: 799, stock, sku: `SH-${size}-${color}`, images: [], ...extra });

// L has only Red-in-stock... shirt: M(Red,Blue) L(Red) XL(Blue sold out, Red)
const product = {
  variantOptions: axes,
  variants: [v("M", "Red"), v("M", "Blue"), v("L", "Red"), v("XL", "Red"), v("XL", "Blue", 0)],
};

describe("seller side", () => {
  test("cartesian", () => {
    expect(cartesian(axes)).toHaveLength(6);
    expect(cartesian([{ name: "A", values: ["1", "2"] }])).toEqual([{ A: "1" }, { A: "2" }]);
  });
  test("syncVariants adds missing combinations (stock 0, price copied) and keeps the filled ones", () => {
    const existing = [{ ...v("M", "Red", 7, { price: 1500 }), id: "a" }];
    const rows = syncVariants(axes, existing);
    expect(rows).toHaveLength(6);
    const kept = rows.find((r) => r.id === "a");
    expect(kept.stock).toBe(7);
    const added = rows.find((r) => r.name === "L / Blue");
    expect(added.stock).toBe(0);
    expect(added.price).toBe(1500);
  });
  test("syncVariants drops rows whose value was removed and can skip adding", () => {
    const rows = syncVariants([{ name: "Size", values: ["M"] }, axes[1]], product.variants, { addMissing: false });
    expect(rows.map((r) => r.name)).toEqual(["M / Red", "M / Blue"]);
  });
  test("validateMatrix", () => {
    expect(validateMatrix(axes, product.variants)).toBeNull();
    expect(validateMatrix(axes, [])).toMatch(/combinations appear/);
    expect(validateMatrix(axes, [v("M", "Red", 1, { price: "" })])).toMatch(/price/);
    expect(validateMatrix(axes, [v("M", "Red", ""), ])).toMatch(/stock/i);
    expect(validateMatrix(axes, [v("M", "Red", 1, { salePrice: 5000 })])).toMatch(/cannot be more/);
    expect(validateMatrix(axes, [v("M", "Red"), v("m", "red")])).toMatch(/twice/);
    expect(validateMatrix([{ name: "", values: ["a"] }], [])).toMatch(/needs a name/);
    expect(validateMatrix([{ name: "Size", values: [] }], [])).toMatch(/at least one value/);
  });
  test("a sold-out (0) combination is valid", () => {
    expect(validateMatrix(axes, [v("M", "Red", 0)])).toBeNull();
  });
  test("photos: one upload per colour goes on the colour's first row", () => {
    const groups = imageGroups(axes, product.variants);
    expect(groups.map((g) => g.value)).toEqual(["Red", "Blue"]);
    const f1 = { name: "r.jpg" }, f2 = { name: "b.jpg" };
    const fields = groupFilesToFields(axes, product.variants, { Red: [f1], Blue: [f2] });
    expect(fields).toEqual([
      { field: "variantImage_0_0", file: f1 }, // first Red row = index 0
      { field: "variantImage_1_0", file: f2 }, // first Blue row = index 1
    ]);
  });
  test("variantsForSubmit keeps only saved urls", () => {
    const out = variantsForSubmit(axes, [v("M", "Red", 1, { images: ["https://x/a.jpg", "blob:zzz"] })]);
    expect(out[0].images).toEqual(["https://x/a.jpg"]);
    expect(out[0].name).toBe("M / Red");
  });
  test("defaultImageAxis picks Color", () => {
    expect(defaultImageAxis(axes)).toBe(1);
    expect(defaultImageAxis([{ name: "Size", values: ["M"] }])).toBe(-1);
  });
});

describe("customer side (L has only Red, XL/Blue is sold out)", () => {
  test("isMatrixProduct", () => {
    expect(isMatrixProduct(product)).toBe(true);
    expect(isMatrixProduct({ variants: [{ name: "500g" }] })).toBe(false);
  });
  test("colours available for the chosen size", () => {
    const st = optionValueStates(product, "Color", { Size: "L" });
    expect(st.find((s) => s.value === "Red")).toMatchObject({ exists: true, inStock: true });
    expect(st.find((s) => s.value === "Blue")).toMatchObject({ exists: false, inStock: false });
  });
  test("sold-out combination exists but is not in stock", () => {
    const st = optionValueStates(product, "Color", { Size: "XL" });
    expect(st.find((s) => s.value === "Blue")).toMatchObject({ exists: true, inStock: false });
  });
  test("sizes available for the chosen colour (Blue has M and a sold-out XL, no L)", () => {
    const st = optionValueStates(product, "Size", { Color: "Blue" });
    expect(st.map((s) => [s.value, s.exists, s.inStock])).toEqual([["M", true, true], ["L", false, false], ["XL", true, false]]);
  });
  test("resolveVariant needs every option", () => {
    expect(resolveVariant(product, { Size: "L" })).toBeNull();
    expect(resolveVariant(product, { Size: "L", Color: "Red" }).sku).toBe("SH-L-Red");
    expect(resolveVariant(product, { Size: "L", Color: "Blue" })).toBeNull();
  });
  test("default = first in-stock variant", () => {
    expect(defaultVariant({ variants: [v("M", "Red", 0), v("L", "Red", 3)] }).name).toBe("L / Red");
    expect(defaultVariant({ variants: [v("M", "Red", 0)] }).name).toBe("M / Red");
  });
  test("tapping a colour that the current size does not have jumps to the closest sold combination", () => {
    const picked = pickVariantAfterTap(product, { Size: "L", Color: "Red" }, "Color", "Blue");
    expect(picked.options.Color).toBe("Blue");
    expect(picked.stock).toBeGreaterThan(0); // in stock preferred (M / Blue), not the sold-out XL / Blue
    expect(picked.options.Size).toBe("M");
  });
  test("tapping keeps the other choice when that combination exists", () => {
    const picked = pickVariantAfterTap(product, { Size: "M", Color: "Red" }, "Color", "Blue");
    expect(picked.name).toBe("M / Blue");
  });
  test("matchingVariants / photos fallback", () => {
    expect(matchingVariants(product, { Size: "M" })).toHaveLength(2);
    expect(variantPhotos({ mainImage: "m.jpg", galleryImages: ["g.jpg"] }, { images: [] })).toEqual(["m.jpg", "g.jpg"]);
    expect(variantPhotos({ mainImage: "m.jpg" }, { images: ["c.jpg"] })).toEqual(["c.jpg"]);
  });
});

import { applyAxesChange, cleanAxes } from "../../shared/utils/variantMatrix.js";

describe("changing the options", () => {
  const base = [v("M", "Red", 4), v("M", "Blue", 6), v("L", "Red", 2)].map((r, i) => ({ ...r, id: "r" + i }));
  const ax = [{ name: "Size", values: ["M", "L"] }, { name: "Color", values: ["Red", "Blue"], hasImages: true }];

  test("adding a value adds only its combinations, other rows (and the removed L / Blue) stay as they are", () => {
    const next = [ax[0], { ...ax[1], values: ["Red", "Blue", "Green"] }];
    const rows = applyAxesChange(ax, next, base);
    expect(rows.map((r) => r.name).sort()).toEqual(["L / Green", "L / Red", "M / Blue", "M / Green", "M / Red"]);
    expect(rows.find((r) => r.name === "M / Red").stock).toBe(4); // untouched
    expect(rows.find((r) => r.name === "L / Green").stock).toBe(0);
  });
  test("removing a value drops its rows", () => {
    const rows = applyAxesChange(ax, [ax[0], { ...ax[1], values: ["Red"] }], base);
    expect(rows.map((r) => r.name).sort()).toEqual(["L / Red", "M / Red"]);
  });
  test("adding a new option rebuilds every combination", () => {
    const rows = applyAxesChange(ax, [...ax, { name: "Storage", values: ["64GB", "128GB"] }], base);
    expect(rows).toHaveLength(8);
    expect(rows.every((r) => r.stock === 0)).toBe(true);
  });
  test("first time: no rows yet -> full set", () => {
    expect(applyAxesChange([], ax, [])).toHaveLength(4);
  });
  test("stale rows are caught by validate", () => {
    expect(validateMatrix([{ name: "Size", values: ["M"] }, ax[1]], [v("L", "Red")])).toMatch(/do not match your options/);
  });
  test("cleanAxes", () => {
    expect(cleanAxes([{ name: " Size ", values: ["M", "m", " L "], hasImages: 0 }])).toEqual([{ name: "Size", values: ["M", "L"], hasImages: false }]);
  });
});

import { matrixSubmitParts } from "../../shared/utils/variantMatrix.js";

describe("matrixSubmitParts with live options", () => {
  test("options switched on but nothing chosen -> clear message instead of saving a broken product", () => {
    const r = matrixSubmitParts({ useOptions: true, variantOptions: [], variants: [{ name: "Default", price: 10, stock: 1 }] });
    expect(r.error).toMatch(/Tap an option/);
  });
  test("an option with no value yet is refused", () => {
    const r = matrixSubmitParts({ useOptions: true, variantOptions: [{ name: "Size", values: [] }], variants: [] });
    expect(r.error).toMatch(/needs at least one value/);
  });
});
