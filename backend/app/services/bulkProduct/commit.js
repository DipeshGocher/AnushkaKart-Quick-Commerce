/**
 * Bulk product upload: saves the products of a plan. One product at a time, so a failure in one
 * product never stops the others.
 */
import { buildVariantMatrix } from "../../utils/variantMatrix.js";
import { computeDraftReasons } from "../../utils/draftCheck.js";
import { composeVariantSku } from "./skus.js";

const IMAGE_CONCURRENCY = 4;

/** Runs fn over items with a small parallel limit; results keep the order of items. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * deps = {
 *   sellerId, moderation,
 *   fetchImage(url) -> { buffer, mimeType },
 *   uploadImage(buffer, folder, opts) -> url,
 *   makeUnique: { sku(name), slug(name) }        async, database backed
 *   createProduct(data) -> { _id },
 *   afterCreate(id)                              search index + cache
 * }
 * Returns [{ key, name, status: "created" | "created_draft" | "failed" | "skipped", productId, message, warnings }]
 */
export async function commitPlan(plan, deps) {
  const results = [];
  const imageCache = new Map(); // source url -> uploaded url | null

  const resolveImages = async (urls, warnings) => {
    const todo = [...new Set(urls)].filter((u) => !imageCache.has(u));
    await mapLimit(todo, IMAGE_CONCURRENCY, async (u) => {
      try {
        const { buffer, mimeType } = await deps.fetchImage(u);
        const uploaded = await deps.uploadImage(buffer, "products", { mimeType, resourceType: "image" });
        if (!uploaded) throw new Error("Upload failed.");
        imageCache.set(u, uploaded);
      } catch (e) {
        imageCache.set(u, null);
        const shown = u.length > 60 ? `${u.slice(0, 57)}...` : u;
        warnings.push({ row: null, message: `Photo ${shown} could not be used: ${e?.message || "download failed"}` });
      }
    });
    return urls.map((u) => imageCache.get(u)).filter(Boolean);
  };

  for (const p of plan.products) {
    if (p.status === "error" || !p.draft) {
      results.push({ key: p.key, name: p.name, status: "skipped", message: "Not saved: fix the errors and upload again.", warnings: [] });
      continue;
    }
    const warnings = [];
    try {
      const d = p.draft;
      const sku = d.sku || (await deps.makeUnique.sku(d.name));
      const slug = await deps.makeUnique.slug(d.name);

      let data;
      if (d.axes.length === 0) {
        // single product
        const v = d.variants[0];
        const photos = await resolveImages(v.imageUrls, warnings);
        data = {
          price: v.price,
          salePrice: v.salePrice || 0,
          stock: v.stock,
          mainImage: photos[0],
          galleryImages: photos.slice(1),
          variants: [{ name: "", price: v.price, salePrice: v.salePrice || 0, stock: v.stock, sku, images: [] }],
          variantOptions: [],
        };
      } else {
        // product with options: photos belong to the Color option (every size of a colour shares them)
        const withPhotos = [];
        for (const v of d.variants) withPhotos.push({ ...v, images: await resolveImages(v.imageUrls, warnings) });
        const axes = d.axes.map((a) => ({ ...a, hasImages: /^colou?rs?$/i.test(a.name) }));
        const built = buildVariantMatrix(
          axes,
          withPhotos.map((v, i) => ({
            options: v.options,
            price: v.price,
            salePrice: v.salePrice,
            stock: v.stock,
            images: v.images,
            sku: v.sku || composeVariantSku(sku, i + 1),
          })),
        );
        const firstWithPhoto = built.variants.find((v) => v.images && v.images.length);
        data = {
          price: built.summary.price,
          salePrice: built.summary.salePrice,
          stock: built.summary.stock,
          mainImage: firstWithPhoto ? firstWithPhoto.images[0] : undefined,
          galleryImages: [],
          variants: built.variants,
          variantOptions: built.variantOptions,
        };
      }

      const parcel = d.parcel || {};
      const doc = {
        name: d.name,
        slug,
        sku,
        description: d.description,
        brand: d.brand || undefined,
        specifications: d.specifications,
        isReturnable: d.isReturnable,
        shelfLife: d.shelfLife || undefined,
        countryOfOrigin: d.countryOfOrigin || undefined,
        fssaiLicense: d.fssaiLicense || undefined,
        weight: parcel.weight || undefined,
        length: parcel.length,
        breadth: parcel.breadth,
        height: parcel.height,
        headerId: d.categoryRef.headerId,
        categoryId: d.categoryRef.categoryId,
        subcategoryId: d.categoryRef.subcategoryId || null,
        sellerId: deps.sellerId,
        ...data,
        ...deps.moderation,
      };
      if (!doc.mainImage) delete doc.mainImage;

      const reasons = computeDraftReasons(doc);
      doc.draftReasons = reasons;
      doc.status = reasons.length ? "inactive" : "active";

      const created = await deps.createProduct(doc);
      try {
        await deps.afterCreate(String(created._id));
      } catch {
        // search indexing is retried by its queue; the product itself is saved
      }
      results.push({
        key: p.key,
        name: p.name,
        status: reasons.length ? "created_draft" : "created",
        productId: String(created._id),
        draftReasons: reasons,
        warnings,
      });
    } catch (e) {
      results.push({
        key: p.key,
        name: p.name,
        status: "failed",
        message: e?.code === 11000 ? "A product with this SKU or web address already exists." : e?.message || "Could not save this product.",
        warnings,
      });
    }
  }
  return results;
}

export const summarizeResults = (results) => ({
  created: results.filter((r) => r.status === "created").length,
  drafts: results.filter((r) => r.status === "created_draft").length,
  failed: results.filter((r) => r.status === "failed" || r.status === "skipped").length,
});
