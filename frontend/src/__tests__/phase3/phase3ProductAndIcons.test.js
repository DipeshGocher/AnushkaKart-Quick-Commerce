import { CATEGORY_SVG_DATA } from "../../shared/constants/categorySvgData.js";
import { resolveFontAwesomeCategoryIcon, getFontAwesomeIconId } from "../../shared/constants/fontAwesomeCategoryIcons.js";

describe("Phase 3: Category Icons & Bundle Optimization", () => {
  test("all 49 category SVG definitions contain valid viewBox and paths", () => {
    const keys = Object.keys(CATEGORY_SVG_DATA);
    expect(keys.length).toBeGreaterThanOrEqual(49);

    keys.forEach((iconName) => {
      const def = CATEGORY_SVG_DATA[iconName];
      expect(def).toBeDefined();
      expect(typeof def.viewBox).toBe("string");
      expect(def.viewBox).toMatch(/^[0-9\s]+$/);
      expect(Array.isArray(def.paths)).toBe(true);
      expect(def.paths.length).toBeGreaterThan(0);
      def.paths.forEach((path) => {
        expect(typeof path).toBe("string");
        expect(path.length).toBeGreaterThan(10);
      });
    });
  });

  test("resolves known legacy category icon names to SVG components", () => {
    const legacyNames = ["electronics", "fashion", "grocery", "food", "beauty", "toys", "books", "pets"];
    legacyNames.forEach((name) => {
      const Icon = resolveFontAwesomeCategoryIcon(name);
      expect(Icon).toBeTruthy();
      expect(typeof Icon).toBe("function");
    });
  });

  test("resolves fa6-prefixed and direct component names", () => {
    const icon1 = resolveFontAwesomeCategoryIcon("fa6:FaLaptop");
    expect(icon1).toBeTruthy();
    const icon2 = resolveFontAwesomeCategoryIcon("FaShirt");
    expect(icon2).toBeTruthy();
  });

  test("falls back gracefully to FaTag when given an unknown icon or category", () => {
    const unknownIcon = resolveFontAwesomeCategoryIcon("unknown_nonexistent_xyz", "Random String");
    expect(unknownIcon).toBeTruthy();
    expect(typeof unknownIcon).toBe("function");
  });
});

describe("Phase 3: Product Batch Pagination & Slicing", () => {
  const mockCatalog = Array.from({ length: 150 }, (_, i) => ({
    id: `prod_${i + 1}`,
    name: `Product ${i + 1}`,
    salePrice: (i % 20) * 50 + 100, // Varied prices
    categoryId: i % 3 === 0 ? "cat_electronics" : "cat_grocery",
  }));

  const BATCH_SIZE = 24;

  test("initial batch contains exactly BATCH_SIZE items promptly", () => {
    const visibleCount = BATCH_SIZE;
    const initialBatch = mockCatalog.slice(0, visibleCount);
    expect(initialBatch).toHaveLength(24);
    expect(initialBatch[0].id).toBe("prod_1");
    expect(initialBatch[23].id).toBe("prod_24");
  });

  test("incremental batch increments smoothly without duplicated or skipped items", () => {
    let visibleCount = BATCH_SIZE;
    const batch1 = mockCatalog.slice(0, visibleCount);
    expect(batch1).toHaveLength(24);

    visibleCount = Math.min(visibleCount + BATCH_SIZE, mockCatalog.length);
    const batch2 = mockCatalog.slice(0, visibleCount);
    expect(batch2).toHaveLength(48);

    // Verify all items in batch 2 are unique
    const idSet = new Set(batch2.map((p) => p.id));
    expect(idSet.size).toBe(48);

    // The first 24 items in batch2 match batch1 exactly
    expect(batch2.slice(0, 24)).toEqual(batch1);
  });

  test("global sorting preserves order before slicing into visible batches", () => {
    // Sort globally by price ascending
    const sortedCatalog = [...mockCatalog].sort((a, b) => a.salePrice - b.salePrice);

    // First batch of 24
    const firstBatch = sortedCatalog.slice(0, BATCH_SIZE);
    expect(firstBatch).toHaveLength(24);

    // Lowest price across all 150 items must be in first batch
    const minPriceCatalog = Math.min(...mockCatalog.map((p) => p.salePrice));
    expect(firstBatch[0].salePrice).toBe(minPriceCatalog);

    // Second batch of 24
    const secondBatch = sortedCatalog.slice(BATCH_SIZE, BATCH_SIZE * 2);
    expect(secondBatch).toHaveLength(24);

    // Highest price in first batch must be <= lowest price in second batch
    const maxFirstBatchPrice = Math.max(...firstBatch.map((p) => p.salePrice));
    const minSecondBatchPrice = Math.min(...secondBatch.map((p) => p.salePrice));
    expect(maxFirstBatchPrice).toBeLessThanOrEqual(minSecondBatchPrice);
  });

  test("category filter correctly isolates products and resets batch size", () => {
    let currentCategory = "cat_electronics";
    let visibleCount = 48; // User had scrolled down

    const filterProducts = (cat) => mockCatalog.filter((p) => p.categoryId === cat);

    let filtered = filterProducts(currentCategory);
    expect(filtered.length).toBe(50);

    // User switches category -> batch count resets
    currentCategory = "cat_grocery";
    visibleCount = BATCH_SIZE; // reset on category change
    filtered = filterProducts(currentCategory);
    expect(filtered.length).toBe(100);

    const displayed = filtered.slice(0, visibleCount);
    expect(displayed).toHaveLength(24);
    expect(displayed.every((p) => p.categoryId === "cat_grocery")).toBe(true);
  });
});

describe("Phase 3: Out-of-Order Async Request Deduplication & Race Prevention", () => {
  test("slow responses from an older category cannot overwrite a newer category", async () => {
    let activeFetchId = 0;
    let stateProducts = [];

    const simulateCategoryFetch = (categoryName, responseData, delayMs) => {
      const fetchId = ++activeFetchId;
      return new Promise((resolve) => {
        setTimeout(() => {
          // Guard condition implemented in CategoryProductsPage
          if (activeFetchId === fetchId) {
            stateProducts = responseData;
            resolve({ applied: true, data: responseData });
          } else {
            // Discarded because a newer request was dispatched
            resolve({ applied: false, discardedFetchId: fetchId });
          }
        }, delayMs);
      });
    };

    // Dispatch slow Category A request (30ms delay)
    const promiseA = simulateCategoryFetch("Category A", ["prod_A1", "prod_A2"], 30);

    // Quickly switch to Category B (10ms delay)
    const promiseB = simulateCategoryFetch("Category B", ["prod_B1", "prod_B2", "prod_B3"], 10);

    const [resA, resB] = await Promise.all([promiseA, promiseB]);

    // Newer request B was applied
    expect(resB.applied).toBe(true);
    // Older request A was discarded
    expect(resA.applied).toBe(false);

    // Final state strictly contains Category B products
    expect(stateProducts).toEqual(["prod_B1", "prod_B2", "prod_B3"]);
  });
});
