/**
 * Bulk product upload (seller): download the Excel template, check a filled file (preview) and
 * save it. The preview and the save run the same checks on the same file, so what the seller
 * saw is what gets saved.
 */
import Product from "../models/product.js";
import Category from "../models/category.js";
import { handleResponse } from "../utils/helper.js";
import { slugify } from "../utils/slugify.js";
import logger from "../services/logger.js";
import { enqueueProductIndex } from "../services/searchSyncService.js";
import { buildKey, invalidate } from "../services/cacheService.js";
import { uploadToCloudinary } from "../services/mediaService.js";
import { buildSellerApprovedModerationUpdate } from "./productController.js";
import { MAX_FILE_BYTES } from "../services/bulkProduct/columns.js";
import { buildCategoryIndex } from "../services/bulkProduct/categories.js";
import { buildTemplateSpec } from "../services/bulkProduct/templateSpec.js";
import { buildTemplateBuffer, readProductsMatrix } from "../services/bulkProduct/workbookIO.js";
import { planProducts, publicPlan, rowsFromMatrix } from "../services/bulkProduct/plan.js";
import { commitPlan, summarizeResults } from "../services/bulkProduct/commit.js";
import { autoSkuFor } from "../services/bulkProduct/skus.js";
import { fetchImage } from "../services/bulkProduct/images.js";

const XLSX_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "application/zip",
]);

const committing = new Set(); // seller ids with a save running (blocks a double click)

async function loadCategoryIndex() {
  const docs = await Category.find({}).select("_id name type parentId status catalogType").lean();
  return buildCategoryIndex(docs);
}

/** Reads the uploaded file and plans the products. Returns { plan } or sends the error and returns null. */
async function planFromRequest(req, res) {
  const file = req.file;
  if (!file || !file.buffer) {
    handleResponse(res, 400, "Please choose the Excel file to upload.");
    return null;
  }
  if (file.size > MAX_FILE_BYTES || file.buffer.length > MAX_FILE_BYTES) {
    handleResponse(res, 400, "The file is larger than 5 MB.");
    return null;
  }
  const name = String(file.originalname || "").toLowerCase();
  if (!name.endsWith(".xlsx") || (file.mimetype && !XLSX_TYPES.has(file.mimetype))) {
    handleResponse(res, 400, "Please upload the .xlsx template file.");
    return null;
  }
  // .xlsx is a zip file: it must start with "PK"
  if (file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) {
    handleResponse(res, 400, "This is not a valid .xlsx file.");
    return null;
  }

  const matrix = await readProductsMatrix(file.buffer);
  const { rows, fileErrors } = rowsFromMatrix(matrix);
  if (fileErrors.length) {
    handleResponse(res, 400, fileErrors[0], { fileErrors });
    return null;
  }

  const sellerId = req.user.id;
  const categoryIndex = await loadCategoryIndex();

  const skuCandidates = new Set();
  for (const r of rows) {
    for (const k of ["group", "sku"]) {
      const t = String(r.cells[k] == null ? "" : r.cells[k]).trim();
      if (t) skuCandidates.add(t);
    }
  }
  const [skuDocs, nameDocs] = await Promise.all([
    skuCandidates.size ? Product.find({ sku: { $in: [...skuCandidates] } }).select("sku").lean() : [],
    Product.find({ sellerId }).select("name").limit(20000).lean(),
  ]);
  const plan = planProducts(rows, {
    resolveCategory: categoryIndex.resolve,
    existingSkus: new Set(skuDocs.map((d) => String(d.sku).toLowerCase())),
    existingNames: new Set(nameDocs.map((d) => String(d.name || "").trim().toLowerCase())),
  });
  return { plan };
}

/** GET /products/bulk/template */
export const downloadTemplate = async (req, res) => {
  try {
    const { paths } = await loadCategoryIndex();
    const buffer = await buildTemplateBuffer(buildTemplateSpec({ categoryPaths: paths }));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="product-upload-template.xlsx"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);
  } catch (error) {
    logger.error("Bulk template error", { scope: "bulkProduct", error });
    return handleResponse(res, error.statusCode || 500, error.message || "Could not create the template.");
  }
};

/** POST /products/bulk/preview  (multipart, field "file") */
export const previewBulk = async (req, res) => {
  try {
    const out = await planFromRequest(req, res);
    if (!out) return undefined;
    return handleResponse(res, 200, "File checked", publicPlan(out.plan));
  } catch (error) {
    logger.error("Bulk preview error", { scope: "bulkProduct", error });
    return handleResponse(res, error.statusCode || 500, error.message || "Could not check the file.");
  }
};

async function uniqueSku(name) {
  for (let i = 0; i < 8; i += 1) {
    const sku = autoSkuFor(name);
    // eslint-disable-next-line no-await-in-loop
    if (!(await Product.exists({ sku }))) return sku;
  }
  return `${autoSkuFor(name)}-${Date.now().toString(36).toUpperCase()}`;
}

async function uniqueSlug(name) {
  const base = slugify(name) || "product";
  for (let n = 1; n <= 20; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await Product.exists({ slug }))) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** POST /products/bulk/commit  (multipart, field "file") */
export const commitBulk = async (req, res) => {
  const sellerId = String(req.user?.id || "");
  if (committing.has(sellerId)) {
    return handleResponse(res, 409, "A bulk upload is already running for your account. Please wait for it to finish.");
  }
  committing.add(sellerId);
  try {
    const out = await planFromRequest(req, res);
    if (!out) return undefined;
    const { plan } = out;

    const results = await commitPlan(plan, {
      sellerId,
      moderation: buildSellerApprovedModerationUpdate(),
      fetchImage,
      uploadImage: uploadToCloudinary,
      makeUnique: { sku: uniqueSku, slug: uniqueSlug },
      createProduct: (data) => Product.create(data),
      afterCreate: async (id) => {
        await enqueueProductIndex(id);
        await invalidate(`cache:catalog:product:${id}`);
      },
    });
    try {
      await invalidate(buildKey("catalog", "productList", "*"));
      await invalidate(buildKey("catalog", "categories", "*"));
    } catch (cacheErr) {
      logger.error("Cache invalidation error", { scope: "bulkProduct", error: cacheErr });
    }

    const pub = publicPlan(plan);
    const byKey = new Map(results.map((r) => [r.key, r]));
    return handleResponse(res, 200, "Bulk upload finished", {
      summary: { ...pub.summary, ...summarizeResults(results) },
      products: pub.products.map((p) => ({ ...p, result: byKey.get(p.key) || null })),
    });
  } catch (error) {
    logger.error("Bulk commit error", { scope: "bulkProduct", error });
    return handleResponse(res, error.statusCode || 500, error.message || "Could not save the file.");
  } finally {
    committing.delete(sellerId);
  }
};
