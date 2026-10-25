import { getProductPriceInfo } from "../../core/utils/productUrl.js";

describe("Customer Price Consistency and Harmonization Tests", () => {
  test("Case 1: Product with base price and sale price (no variants)", () => {
    const product = {
      _id: "p1",
      name: "Organic Honey 500g",
      price: 500,
      salePrice: 380,
      variants: [],
    };

    const info = getProductPriceInfo(product);

    expect(info.currentPrice).toBe(380);
    expect(info.originalPrice).toBe(500);
    expect(info.hasDiscount).toBe(true);
    expect(info.discountPercent).toBe(24); // Math.round(((500 - 380) / 500) * 100) = 24%
  });

  test("Case 2: Product with regular price, zero sale price (no discount)", () => {
    const product = {
      _id: "p2",
      name: "Basmati Rice 1kg",
      price: 120,
      salePrice: 0,
      variants: [],
    };

    const info = getProductPriceInfo(product);

    expect(info.currentPrice).toBe(120);
    expect(info.originalPrice).toBe(120);
    expect(info.hasDiscount).toBe(false);
    expect(info.discountPercent).toBe(0);
  });

  test("Case 3: Product with variants overriding root prices", () => {
    const product = {
      _id: "p3",
      name: "Cotton T-Shirt",
      price: 799,
      salePrice: 699,
      variants: [
        {
          sku: "TSHIRT-RED-M",
          name: "Red - M",
          price: 999,
          salePrice: 499,
          stock: 10,
        },
      ],
    };

    const info = getProductPriceInfo(product);

    // Variant pricing takes priority for catalog card display
    expect(info.currentPrice).toBe(499);
    expect(info.originalPrice).toBe(999);
    expect(info.hasDiscount).toBe(true);
    expect(info.discountPercent).toBe(50); // (999-499)/999 = 50%
  });

  test("Case 4: Variant without discount (salePrice is 0)", () => {
    const product = {
      _id: "p4",
      name: "Olive Oil 1L",
      price: 800,
      variants: [
        {
          sku: "OIL-1L",
          name: "1L",
          price: 750,
          salePrice: 0,
          stock: 5,
        },
      ],
    };

    const info = getProductPriceInfo(product);

    expect(info.currentPrice).toBe(750);
    expect(info.originalPrice).toBe(750);
    expect(info.hasDiscount).toBe(false);
    expect(info.discountPercent).toBe(0);
  });

  test("Case 5: Multiple products with identical effective price", () => {
    const productA = {
      _id: "pa",
      name: "Item A",
      price: 300,
      salePrice: 200,
      variants: [],
    };
    const productB = {
      _id: "pb",
      name: "Item B",
      price: 200,
      salePrice: 0,
      variants: [],
    };

    const infoA = getProductPriceInfo(productA);
    const infoB = getProductPriceInfo(productB);

    // Both should evaluate to currentPrice 200
    expect(infoA.currentPrice).toBe(200);
    expect(infoB.currentPrice).toBe(200);
    expect(infoA.hasDiscount).toBe(true);
    expect(infoB.hasDiscount).toBe(false);
  });

  test("Case 6: Missing or null product returns safe fallback object", () => {
    const infoNull = getProductPriceInfo(null);
    expect(infoNull.currentPrice).toBe(0);
    expect(infoNull.originalPrice).toBe(0);
    expect(infoNull.hasDiscount).toBe(false);
    expect(infoNull.discountPercent).toBe(0);

    const infoEmpty = getProductPriceInfo({});
    expect(infoEmpty.currentPrice).toBe(0);
    expect(infoEmpty.originalPrice).toBe(0);
    expect(infoEmpty.hasDiscount).toBe(false);
    expect(infoEmpty.discountPercent).toBe(0);
  });
});
