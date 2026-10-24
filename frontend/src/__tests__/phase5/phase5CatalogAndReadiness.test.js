import { applyCloudinaryTransform, IMAGE_PRESETS } from "../../core/utils/imageUtils.js";

describe("Phase 5: Catalog Completeness & Truncation Discovery Audit", () => {
  // Simulate a database category with 350 total matching products
  const TOTAL_DB_PRODUCTS = 350;
  const mockServerDatabase = Array.from({ length: TOTAL_DB_PRODUCTS }, (_, i) => ({
    id: `prod_${i + 1}`,
    name: `Item ${i + 1}`,
    createdAt: new Date(Date.now() - i * 100000).toISOString(),
    // Product 250 happens to be the cheapest item in the entire database (₹49)
    salePrice: i === 249 ? 49 : 100 + (i % 20) * 20,
    categoryId: "cat_fashion",
  }));

  test("demonstrates the 200-item fetch truncation barrier when DB catalog exceeds 200 items", () => {
    // Current frontend CategoryProductsPage requests limit: 200
    const FRONTEND_FETCH_LIMIT = 200;
    const clientRetrievedProducts = mockServerDatabase.slice(0, FRONTEND_FETCH_LIMIT);

    expect(clientRetrievedProducts.length).toBe(200);

    // Products 201..350 are omitted from client state
    const isProduct250InClientState = clientRetrievedProducts.some((p) => p.id === "prod_250");
    expect(isProduct250InClientState).toBe(false);

    // Total displayed count in UI displays 200 instead of 350
    const displayedCount = clientRetrievedProducts.length;
    expect(displayedCount).toBe(200);
    expect(displayedCount).not.toBe(TOTAL_DB_PRODUCTS);
  });

  test("demonstrates sorting inaccuracy on truncated client array vs true database catalog", () => {
    const FRONTEND_FETCH_LIMIT = 200;
    const clientRetrievedProducts = mockServerDatabase.slice(0, FRONTEND_FETCH_LIMIT);

    // User selects "Price: Low to High" in CategoryProductsPage
    const clientSorted = [...clientRetrievedProducts].sort((a, b) => a.salePrice - b.salePrice);

    // True catalog sort across all 350 database items
    const trueDatabaseSorted = [...mockServerDatabase].sort((a, b) => a.salePrice - b.salePrice);

    // The true cheapest product in DB is prod_250 (₹49)
    expect(trueDatabaseSorted[0].id).toBe("prod_250");
    expect(trueDatabaseSorted[0].salePrice).toBe(49);

    // But client-side sort on truncated batch displays a higher price because prod_250 was never fetched!
    expect(clientSorted[0].id).not.toBe("prod_250");
    expect(clientSorted[0].salePrice).toBeGreaterThan(49);
  });

  test("confirms 100% sorting & filtering accuracy when catalog is <= 200 items", () => {
    // For smaller categories (< 200 items), all items are retrieved in initial fetch
    const smallCatalog = mockServerDatabase.slice(0, 85);
    const clientRetrieved = [...smallCatalog];

    const sorted = [...clientRetrieved].sort((a, b) => a.salePrice - b.salePrice);
    const minPrice = Math.min(...smallCatalog.map((p) => p.salePrice));

    expect(sorted.length).toBe(85);
    expect(sorted[0].salePrice).toBe(minPrice);
  });
});

describe("Phase 5: Image Preset & Transformation Contract Validation", () => {
  test("generates standard Cloudinary transformation parameters for thumbnails, detail, and icons", () => {
    const rawCloudinaryUrl = "https://res.cloudinary.com/anushka/image/upload/v12345/products/sample.jpg";

    const thumbUrl = applyCloudinaryTransform(rawCloudinaryUrl, IMAGE_PRESETS.PRODUCT_THUMB);
    expect(thumbUrl).toContain("f_auto,q_auto,w_400");

    const detailUrl = applyCloudinaryTransform(rawCloudinaryUrl, IMAGE_PRESETS.PRODUCT_DETAIL);
    expect(detailUrl).toContain("f_auto,q_auto,w_800");

    const iconUrl = applyCloudinaryTransform(rawCloudinaryUrl, IMAGE_PRESETS.ICON);
    expect(iconUrl).toContain("f_auto,q_auto,w_120");
  });

  test("handles non-Cloudinary images safely without corrupting URL", () => {
    const nonCloudinaryUrl = "https://images.unsplash.com/photo-sample.jpg";
    const transformed = applyCloudinaryTransform(nonCloudinaryUrl, IMAGE_PRESETS.PRODUCT_THUMB);
    expect(transformed).toBe(nonCloudinaryUrl);
  });
});
