import mongoose from "mongoose";
import Product from "../models/product.js";
import Category from "../models/category.js";
import Order from "../models/order.js";
import Review from "../models/review.js";
import HeroConfig from "../models/heroConfig.js";
import { handleResponse } from "../utils/helper.js";
import https from "https";

// Helper function to translate input search terms to English dynamically
function translateToEnglish(text) {
  return new Promise((resolve) => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed[0] && parsed[0][0] && parsed[0][0][0]) {
            resolve(parsed[0][0][0].trim());
            return;
          }
        } catch (e) {
          // ignore
        }
        resolve(text);
      });
    }).on('error', (err) => {
      logger.error("Translation helper error in products search: " + err.message);
      resolve(text);
    });
  });
}

const SYNONYMS = {
  "lentil": ["dal", "pulse", "pulses"],
  "lentils": ["dal", "pulse", "pulses"],
  "pulse": ["dal", "lentil", "lentils"],
  "pulses": ["dal", "lentil", "lentils"],
  "dal": ["lentil", "lentils", "pulse", "pulses"],
  "oil": ["tel", "oil"],
  "tel": ["oil", "tel"],
  "flour": ["atta", "flour"],
  "atta": ["flour", "atta", "wheat flour"],
  "potato": ["aloo", "potato", "potatoes"],
  "potatoes": ["aloo", "potato", "potatoes"],
  "aloo": ["potato", "potatoes", "aloo"],
  "onion": ["pyaz", "onion", "onions"],
  "onions": ["pyaz", "onion", "onions"],
  "pyaz": ["onion", "onions", "pyaz"],
  "tomato": ["tamatar", "tomato", "tomatoes"],
  "tomatoes": ["tamatar", "tomato", "tomatoes"],
  "tamatar": ["tomato", "tomatoes", "tamatar"],
  "ginger": ["adrak", "ginger"],
  "adrak": ["ginger", "adrak"],
  "garlic": ["lahsun", "garlic"],
  "lahsun": ["garlic", "lahsun"],
  "rice": ["chawal", "rice"],
  "chawal": ["rice", "chawal"],
  "milk": ["doodh", "milk"],
  "doodh": ["milk", "doodh"],
  "cottage cheese": ["paneer", "cottage cheese"],
  "paneer": ["cottage cheese", "paneer"],
  "blessings": ["aashirvaad", "aashirwad", "blessings"],
  "blessing": ["aashirvaad", "aashirwad", "blessing"],
  "bless": ["aashirvaad", "aashirwad", "bless"],
  "aashirvaad": ["blessings", "blessing", "aashirwad", "aashirvaad"],
  "aashirwad": ["blessings", "blessing", "aashirvaad", "aashirwad"]
};

function buildSearchRegexWithSynonyms(word) {
  const normalized = word.toLowerCase().trim();
  const list = [word];
  if (SYNONYMS[normalized]) {
    list.push(...SYNONYMS[normalized]);
  }
  const escapedList = list.map(item => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = escapedList.length > 1 ? `(${escapedList.join("|")})` : escapedList[0];
  return {
    $regex: pattern,
    $options: "i"
  };
}

import { slugify } from "../utils/slugify.js";
import getPagination from "../utils/pagination.js";
import {
  parseCustomerCoordinates,
  getNearbySellerIdsForCustomer,
} from "../services/customerVisibilityService.js";
import {
  enqueueProductIndex,
  enqueueProductRemoval,
} from "../services/searchSyncService.js";
import { buildKey, getOrSet, getTTL, invalidate } from "../services/cacheService.js";
import { uploadToCloudinary } from "../services/mediaService.js";
import logger from "../services/logger.js";
import { resolveCategoryName, resolveSellerName, resolveWarehouseName } from "../services/entityNameCache.js";
import {
  PRODUCT_APPROVAL_STATUS,
  getProductApprovalConfig,
  getApprovedOrLegacyFilter,
  buildApprovalStatusFilter,
  normalizeProductModerationFields,
  sanitizeApprovalNote,
  resolveProductApprovalStatus,
} from "../services/productModerationService.js";
import { buildSearchRegex } from "../utils/regex.js";

// Phase 3 P3-5: when search term is reasonably specific and the env flag
// is enabled, prefer Mongo's `name + tags` text index over case-insensitive
// regex. Default OFF — keeps existing substring-search semantics so the
// behavior of the customer-facing search bar is unchanged unless explicitly
// opted in by ops.
function isProductTextSearchEnabled() {
  return (
    String(process.env.PRODUCT_SEARCH_USE_TEXT || "false").toLowerCase() === "true"
  );
}

function buildProductListKey(queryParams) {
  const sorted = Object.keys(queryParams)
    .sort()
    .reduce((acc, k) => {
      acc[k] = String(queryParams[k] ?? "").trim().toLowerCase();
      return acc;
    }, {});
  return buildKey("catalog", "productList", JSON.stringify(sorted));
}

function isCustomerVisibilityRequest(req) {
  const role = String(req.user?.role || "").toLowerCase();
  // Admin and seller should not be subject to location filtering
  return !role || (role !== "admin" && role !== "seller" && role !== "delivery");
}

function parseSellerIdFilters({ sellerId, sellerIds }) {
  if (typeof sellerIds === "string" && sellerIds.trim()) {
    return sellerIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map(String);
  }

  if (sellerId) {
    return [String(sellerId)];
  }

  return [];
}

function makeProductSku(name, index = 1) {
  const prefix = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5) || "item";
  return `${prefix}-${String(index).padStart(3, "0")}`;
}

function parseJsonIfString(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  // NOTE: "data:" base64 URLs are intentionally NOT accepted here.
  // All images must be uploaded to Cloudinary and stored as https:// URLs.
  if (normalized.startsWith("/") || normalized.startsWith("uploads/")) return normalized;
  if (!/^https?:\/\//i.test(normalized)) return "";
  return normalized;
}

function parseImageList(input) {
  const candidate = parseJsonIfString(input);
  if (Array.isArray(candidate)) {
    return candidate.map((item) => normalizeUrl(item)).filter(Boolean);
  }
  if (typeof candidate === "string" && candidate.includes(",")) {
    return candidate
      .split(",")
      .map((item) => normalizeUrl(item))
      .filter(Boolean);
  }
  const single = normalizeUrl(candidate);
  return single ? [single] : [];
}

function applyMediaFields(productData) {
  const explicitMainImage = normalizeUrl(productData.mainImage || productData.mainImageUrl);
  const galleryImages = parseImageList(productData.galleryImages);
  const genericImages = parseImageList(productData.images);

  const mergedGallery = [...galleryImages, ...genericImages].filter(Boolean);
  if (explicitMainImage) {
    productData.mainImage = explicitMainImage;
  } else if (mergedGallery.length > 0) {
    productData.mainImage = mergedGallery[0];
    mergedGallery.shift();
  } else {
    delete productData.mainImage;
  }

  if (mergedGallery.length > 0) {
    productData.galleryImages = mergedGallery;
  } else if (!Array.isArray(productData.galleryImages)) {
    productData.galleryImages = [];
  }
}

const RESTRICTED_MODERATION_FIELDS = [
  "approvalStatus",
  "approvalRequestedAt",
  "approvalReviewedAt",
  "approvalReviewedBy",
  "approvalNote",
  "lastSubmittedByRole",
];

function stripRestrictedModerationFields(payload = {}) {
  for (const field of RESTRICTED_MODERATION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      delete payload[field];
    }
  }
}

function normalizeProductDocumentModeration(product) {
  if (!product) return product;
  return normalizeProductModerationFields(product);
}

function normalizeProductListModeration(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => normalizeProductDocumentModeration(item));
}

function buildSellerPendingModerationUpdate() {
  return {
    approvalStatus: PRODUCT_APPROVAL_STATUS.PENDING,
    approvalRequestedAt: new Date(),
    approvalReviewedAt: null,
    approvalReviewedBy: null,
    approvalNote: "",
    lastSubmittedByRole: "seller",
  };
}

function buildSellerApprovedModerationUpdate() {
  return {
    approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
    approvalRequestedAt: null,
    approvalReviewedAt: null,
    approvalReviewedBy: null,
    approvalNote: "",
    lastSubmittedByRole: "seller",
  };
}

function buildAdminApprovedModerationUpdate(adminId, note = "") {
  return {
    approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
    approvalRequestedAt: null,
    approvalReviewedAt: new Date(),
    approvalReviewedBy: adminId || null,
    approvalNote: sanitizeApprovalNote(note),
    lastSubmittedByRole: "admin",
  };
}

function buildAdminRejectedModerationUpdate(adminId, note = "") {
  return {
    approvalStatus: PRODUCT_APPROVAL_STATUS.REJECTED,
    approvalRequestedAt: null,
    approvalReviewedAt: new Date(),
    approvalReviewedBy: adminId || null,
    approvalNote: sanitizeApprovalNote(note),
    lastSubmittedByRole: "admin",
  };
}

/* ===============================
   GET ALL PRODUCTS (Public/Admin)
================================ */
export const getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      subcategory,
      header,
      status,
      approvalStatus,
      sellerId,
      featured,
      newArrivals,
      categoryId,
      subcategoryId,
      headerId,
      categoryIds,
      sellerIds,
      sort,
      lat,
      lng,
      conditionType,
      brand,
      topDeal,
      isTopDeal,
    } = req.query;
    const enforceRadius = isCustomerVisibilityRequest(req);

    const query = {};
    if (conditionType && conditionType !== "all") {
      query.conditionType = conditionType;
    } else if (!conditionType) {
      // Exclude refurbished products from default home page/shop catalog feeds
      query.conditionType = { $ne: "refurbished" };
    }

    if (brand && brand !== "all") {
      const brandStr = String(brand).trim();
      if (brandStr) {
        const brandRegex = new RegExp(brandStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        query.$or = [
          { brand: brandRegex },
          { name: brandRegex },
          { tags: brandRegex }
        ];
      }
    }
    if (search) {
      const term = String(search).trim();
      if (term) {
        let extractedMaxPrice = null;
        let extractedMinPrice = null;
        let cleanedTerm = term;

        const underMatch = term.match(/(?:under|below|less\s+than|upto|sub)\s*(\d+(?:\.\d+)?)/i);
        if (underMatch) {
          extractedMaxPrice = Number(underMatch[1]);
          cleanedTerm = cleanedTerm.replace(underMatch[0], "").trim();
        }

        const aboveMatch = term.match(/(?:above|over|more\s+than)\s*(\d+(?:\.\d+)?)/i);
        if (aboveMatch) {
          extractedMinPrice = Number(aboveMatch[1]);
          cleanedTerm = cleanedTerm.replace(aboveMatch[0], "").trim();
        }

        const rangeMatch = term.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/i);
        if (rangeMatch) {
          extractedMinPrice = Number(rangeMatch[1]);
          extractedMaxPrice = Number(rangeMatch[2]);
          cleanedTerm = cleanedTerm.replace(rangeMatch[0], "").trim();
        }

        if (extractedMaxPrice != null || extractedMinPrice != null) {
          const priceFilter = {};
          if (extractedMaxPrice != null) priceFilter.$lte = extractedMaxPrice;
          if (extractedMinPrice != null) priceFilter.$gte = extractedMinPrice;
          query.$and = query.$and || [];
          query.$and.push({
            $or: [{ price: priceFilter }, { salePrice: priceFilter }]
          });
        }

        const searchRegexForCat = new RegExp(
          (cleanedTerm || term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i"
        );
        let matchedCategoryIds = [];
        try {
          const matchedCats = await Category.find({
            name: searchRegexForCat,
            status: "active"
          }).select("_id parentId type").lean();
          if (matchedCats.length > 0) {
            matchedCategoryIds = matchedCats.map((c) => c._id);
            const subCats = await Category.find({
              parentId: { $in: matchedCategoryIds },
              status: "active"
            }).select("_id").lean();
            if (subCats.length > 0) {
              matchedCategoryIds = matchedCategoryIds.concat(subCats.map((s) => s._id));
            }
          }
        } catch (catErr) {
          console.error("Error matching categories for search:", catErr);
        }

        const effectiveTerm = cleanedTerm || term;
        const englishTerm = await translateToEnglish(effectiveTerm);
        const originalWords = effectiveTerm.split(/\s+/).filter(Boolean);
        const englishWords = englishTerm.split(/\s+/).filter(Boolean);
        const orClauses = [];

        const buildFieldOr = (regex) => [
          { name: regex },
          { brand: regex },
          { tags: regex },
          { description: regex },
          ...(matchedCategoryIds.length > 0
            ? [
                { categoryId: { $in: matchedCategoryIds } },
                { subcategoryId: { $in: matchedCategoryIds } },
                { headerId: { $in: matchedCategoryIds } }
              ]
            : [])
        ];

        if (originalWords.length > 0) {
          orClauses.push({
            $and: originalWords.map((word) => {
              const regex = buildSearchRegexWithSynonyms(word);
              return { $or: buildFieldOr(regex) };
            })
          });
        }

        if (englishWords.length > 0 && englishTerm.toLowerCase() !== effectiveTerm.toLowerCase()) {
          orClauses.push({
            $and: englishWords.map((word) => {
              const regex = buildSearchRegexWithSynonyms(word);
              return { $or: buildFieldOr(regex) };
            })
          });
        }

        if (matchedCategoryIds.length > 0) {
          orClauses.push({
            $or: [
              { categoryId: { $in: matchedCategoryIds } },
              { subcategoryId: { $in: matchedCategoryIds } },
              { headerId: { $in: matchedCategoryIds } }
            ]
          });
        }

        if (orClauses.length > 1) {
          query.$and = query.$and || [];
          query.$and.push({ $or: orClauses });
        } else if (orClauses.length === 1) {
          query.$and = query.$and || [];
          query.$and.push(orClauses[0]);
        }
      }
    }

    // Support both field names for flexibility (backward compatibility)
    const finalHeaderId = header || headerId;
    const finalCategoryId = category || categoryId;
    const finalSubcategoryId = subcategory || subcategoryId;

    if (finalHeaderId && finalHeaderId !== "all") {
      try {
        const childCats = await Category.find({ parentId: finalHeaderId, type: "category" }).select("_id").lean();
        const childCatIds = childCats.map((c) => c._id);
        const subCats = childCatIds.length > 0
          ? await Category.find({ parentId: { $in: childCatIds }, type: "subcategory" }).select("_id").lean()
          : [];
        const subCatIds = subCats.map((s) => s._id);

        const headerOrClauses = [
          { headerId: finalHeaderId },
          ...(childCatIds.length > 0 ? [{ categoryId: { $in: childCatIds } }] : []),
          ...(subCatIds.length > 0 ? [{ subcategoryId: { $in: subCatIds } }] : []),
        ];

        if (query.$or) {
          query.$and = query.$and || [];
          query.$and.push({ $or: query.$or });
          query.$and.push({ $or: headerOrClauses });
          delete query.$or;
        } else {
          query.$or = headerOrClauses;
        }
      } catch (err) {
        query.headerId = finalHeaderId;
      }
    }
    if (finalCategoryId && finalCategoryId !== "all") {
      try {
        const catDoc = await Category.findById(finalCategoryId).select("type parentId").lean();
        if (catDoc?.type === "header") {
          const childCats = await Category.find({ parentId: finalCategoryId, type: "category" }).select("_id").lean();
          const childCatIds = childCats.map((c) => c._id);
          const subCats = childCatIds.length > 0
            ? await Category.find({ parentId: { $in: childCatIds }, type: "subcategory" }).select("_id").lean()
            : [];
          const subCatIds = subCats.map((s) => s._id);
          const catOrClauses = [
            { headerId: finalCategoryId },
            ...(childCatIds.length > 0 ? [{ categoryId: { $in: childCatIds } }] : []),
            ...(subCatIds.length > 0 ? [{ subcategoryId: { $in: subCatIds } }] : []),
          ];
          if (query.$or) {
            query.$and = query.$and || [];
            query.$and.push({ $or: query.$or });
            query.$and.push({ $or: catOrClauses });
            delete query.$or;
          } else {
            query.$or = catOrClauses;
          }
        } else if (catDoc?.type === "subcategory") {
          const catOr = [
            { subcategoryId: finalCategoryId },
            { categoryId: finalCategoryId }
          ];
          if (query.$or) {
            query.$and = query.$and || [];
            query.$and.push({ $or: query.$or });
            query.$and.push({ $or: catOr });
            delete query.$or;
          } else {
            query.$or = catOr;
          }
        } else {
          const subCats = await Category.find({ parentId: finalCategoryId }).select("_id").lean();
          const subCatIds = subCats.map((s) => s._id);
          const catOrClauses = [
            { categoryId: finalCategoryId },
            ...(subCatIds.length > 0 ? [{ subcategoryId: { $in: subCatIds } }] : []),
          ];
          if (query.$or) {
            query.$and = query.$and || [];
            query.$and.push({ $or: query.$or });
            query.$and.push({ $or: catOrClauses });
            delete query.$or;
          } else {
            query.$or = catOrClauses;
          }
        }
      } catch (err) {
        query.categoryId = finalCategoryId;
      }
    }
    if (finalSubcategoryId && finalSubcategoryId !== "all") {
      const subOr = [
        { subcategoryId: finalSubcategoryId },
        { categoryId: finalSubcategoryId }
      ];
      if (query.$or) {
        query.$and = query.$and || [];
        query.$and.push({ $or: query.$or });
        query.$and.push({ $or: subOr });
        delete query.$or;
      } else {
        query.$or = subOr;
      }
    }

    const requestedSellerIds = parseSellerIdFilters({ sellerId, sellerIds });
    const coords = parseCustomerCoordinates({ lat, lng });
    
    // For refurbished products, do not restrict by tight quick-commerce location radius
    // For general products, fallback to default coordinates if lat/lng are missing rather than returning 400 error
    const effectiveLat = coords.valid ? coords.lat : 22.7196;
    const effectiveLng = coords.valid ? coords.lng : 75.8577;

    // Featured products are curated for the home page and should not disappear
    // from Top Deals solely because their seller is outside the local radius.
    const isCuratedHomeFeed = featured === "true" || newArrivals === "true" || Boolean(search) || req.query.allProducts === "true" || req.query.random === "true";
    const shouldApplyLocationFilter =
      enforceRadius && conditionType !== "refurbished" && !isCuratedHomeFeed;
    if (shouldApplyLocationFilter) {
      const nearbySellerIds = await getNearbySellerIdsForCustomer(
        effectiveLat,
        effectiveLng,
      );

      const nearbySet = new Set(nearbySellerIds.map(String));
      const finalSellerIds = requestedSellerIds.length
        ? requestedSellerIds.filter((id) => nearbySet.has(String(id)))
        : nearbySellerIds;

      const mixedSellerIds = [
        ...finalSellerIds.map(String),
        ...finalSellerIds.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id)),
      ];

      if (requestedSellerIds.length > 0) {
        // If specific sellers were requested but none are nearby, return empty
        if (!finalSellerIds.length) {
          return handleResponse(res, 200, "No products available in your area", {
            items: [],
            page: 1,
            limit: 24,
            total: 0,
            totalPages: 1,
          });
        }
        if (query.$or) {
          query.$and = query.$and || [];
          query.$and.push({ $or: query.$or });
          delete query.$or;
          query.$and.push({
            $or: [
              { sellerId: { $in: mixedSellerIds } },
              { warehouseId: { $in: mixedSellerIds } }
            ]
          });
        } else {
          query.$or = [
            { sellerId: { $in: mixedSellerIds } },
            { warehouseId: { $in: mixedSellerIds } }
          ];
        }
      } else {
        // Nearby sellers + warehouses only (fallback to all if no nearby found)
        if (finalSellerIds.length > 0) {
          if (query.$or) {
            query.$and = query.$and || [];
            query.$and.push({ $or: query.$or });
            delete query.$or;
            query.$and.push({
              $or: [
                { sellerId: { $in: mixedSellerIds } },
                { warehouseId: { $in: mixedSellerIds } },
              ]
            });
          } else {
            query.$or = [
              { sellerId: { $in: mixedSellerIds } },
              { warehouseId: { $in: mixedSellerIds } },
            ];
          }
        }
      }
    }

    if (categoryIds && typeof categoryIds === "string") {
      const ids = categoryIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id && id !== "all");
      if (ids.length) query.categoryId = { $in: ids };
    }
    // Multiple sellers: sellerIds=id1,id2 (or single sellerId)
    if (!enforceRadius && !query.sellerId) {
      if (sellerIds && typeof sellerIds === "string") {
        const ids = sellerIds
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id && id !== "all");
        if (ids.length) query.sellerId = { $in: ids };
      } else if (sellerId) {
        query.sellerId = sellerId;
      }
    }

    if (featured !== undefined) query.isFeatured = featured === "true";
    if (topDeal !== undefined) query.isTopDeal = topDeal === "true";
    if (isTopDeal !== undefined) query.isTopDeal = isTopDeal === "true";

    let finalQuery = { ...query };
    if (enforceRadius) {
      finalQuery.status = "active";
      finalQuery = { $and: [finalQuery, getApprovedOrLegacyFilter()] };
    } else {
      if (status && status !== "all") {
        finalQuery.status = status;
      }
      if (approvalStatus && String(approvalStatus).trim().toLowerCase() !== "all") {
        const moderationFilter = buildApprovalStatusFilter(approvalStatus);
        if (Object.keys(moderationFilter).length > 0) {
          finalQuery = { $and: [finalQuery, moderationFilter] };
        }
      }
    }

    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 24,
      maxLimit: 1000,
    });

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "name-asc": { name: 1, createdAt: -1 },
      "name-desc": { name: -1, createdAt: -1 },
      "price-asc": { price: 1, createdAt: -1 },
      "price-desc": { price: -1, createdAt: -1 },
      "stock-asc": { stock: 1, createdAt: -1 },
      "stock-desc": { stock: -1, createdAt: -1 },
    };
    const sortQuery = sortMap[String(sort || "newest").toLowerCase()] || sortMap.newest;

    const fetchFn = async () => {
      const [rawProducts, total] = await Promise.all([
        Product.find(finalQuery)
          .select(
            "name slug description sku price salePrice stock brand weight shelfLife countryOfOrigin fssaiLicense mainImage galleryImages headerId categoryId subcategoryId sellerId warehouseId status approvalStatus approvalRequestedAt approvalReviewedAt approvalReviewedBy approvalNote lastSubmittedByRole isFeatured isTopDeal variants highlights conditionType refurbishedDetails createdAt",
          )
          // No .populate() — names resolved via cache-backed entityNameCache
          .sort(sortQuery)
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(finalQuery),
      ]);

      // Collect unique category IDs (headerId, categoryId, subcategoryId) and seller IDs
      const categoryIdSet = new Set();
      const sellerIdSet = new Set();
      const warehouseIdSet = new Set();
      for (const p of rawProducts) {
        if (p.headerId) categoryIdSet.add(String(p.headerId));
        if (p.categoryId) categoryIdSet.add(String(p.categoryId));
        if (p.subcategoryId) categoryIdSet.add(String(p.subcategoryId));
        if (p.sellerId) sellerIdSet.add(String(p.sellerId));
        if (p.warehouseId) warehouseIdSet.add(String(p.warehouseId));
      }

      // Resolve names in parallel via cache-backed service
      const [categoryEntries, sellerEntries, warehouseEntries] = await Promise.all([
        Promise.all(
          [...categoryIdSet].map(async (id) => [id, await resolveCategoryName(id)]),
        ),
        Promise.all(
          [...sellerIdSet].map(async (id) => [id, await resolveSellerName(id)]),
        ),
        Promise.all(
          [...warehouseIdSet].map(async (id) => [id, await resolveWarehouseName(id)]),
        ),
      ]);

      const nameMap = Object.fromEntries([...categoryEntries, ...sellerEntries, ...warehouseEntries]);

      // Enrich products to match the shape previously returned by .populate()
      const products = rawProducts.map((p) => ({
        ...p,
        headerId: p.headerId
          ? { _id: p.headerId, name: nameMap[String(p.headerId)] ?? null }
          : null,
        categoryId: p.categoryId
          ? { _id: p.categoryId, name: nameMap[String(p.categoryId)] ?? null }
          : null,
        subcategoryId: p.subcategoryId
          ? { _id: p.subcategoryId, name: nameMap[String(p.subcategoryId)] ?? null }
          : null,
        sellerId: p.sellerId
          ? { _id: p.sellerId, shopName: nameMap[String(p.sellerId)] ?? null }
          : null,
        warehouseId: p.warehouseId
          ? { _id: p.warehouseId, name: nameMap[String(p.warehouseId)] ?? null }
          : null,
      }));

      return {
        items: normalizeProductListModeration(products),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      };
    };

    const role = String(req.user?.role || "").toLowerCase();
    const shouldCache = (!role || (role !== "admin" && role !== "seller")) && conditionType !== "refurbished";

    const result = shouldCache
      ? await getOrSet(buildProductListKey(req.query), fetchFn, getTTL("productList"))
      : await fetchFn();

    return handleResponse(res, 200, "Products fetched successfully", result);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SELLER PRODUCTS
================================ */
export const getSellerProducts = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { stockStatus, sort, approvalStatus } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 20,
      maxLimit: 500,
    });

    const role = String(req.user?.role || "").toLowerCase();
    const baseSellerQuery = role === "warehouse" ? { warehouseId: sellerId } : { sellerId };
    const query = { ...baseSellerQuery };
    if (stockStatus === "in") {
      query.stock = { $gt: 0 };
    } else if (stockStatus === "out") {
      query.stock = 0;
    }

    if (approvalStatus && String(approvalStatus).trim().toLowerCase() !== "all") {
      const approvalFilter = buildApprovalStatusFilter(approvalStatus);
      if (Object.keys(approvalFilter).length > 0) {
        Object.assign(query, approvalFilter);
      }
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "name-asc": { name: 1, createdAt: -1 },
      "name-desc": { name: -1, createdAt: -1 },
      "price-asc": { price: 1, createdAt: -1 },
      "price-desc": { price: -1, createdAt: -1 },
      "stock-asc": { stock: 1, createdAt: -1 },
      "stock-desc": { stock: -1, createdAt: -1 },
    };
    const sortQuery = sortMap[String(sort || "newest").toLowerCase()] || sortMap.newest;

    const [
      products,
      total,
      totalAll,
      activeCount,
      lowStockCount,
      outOfStockCount,
      pendingCount,
      approvedCount,
      rejectedCount,
    ] = await Promise.all([
      Product.find(query)
        .select(
          "name slug description sku price salePrice stock lowStockAlert brand weight shelfLife countryOfOrigin fssaiLicense mainImage galleryImages headerId categoryId subcategoryId sellerId warehouseId status approvalStatus approvalRequestedAt approvalReviewedAt approvalReviewedBy approvalNote lastSubmittedByRole isFeatured isTopDeal variants highlights conditionType refurbishedDetails createdAt",
        )
        .populate("headerId", "name slug")
        .populate("categoryId", "name slug")
        .populate("subcategoryId", "name slug")
        .populate("sellerId", "shopName")
        .populate("warehouseId", "name")
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
      Product.countDocuments(baseSellerQuery),
      Product.countDocuments({ ...baseSellerQuery, status: "active" }),
      Product.countDocuments({
        ...baseSellerQuery,
        $expr: {
          $and: [
            {
              $gt: [
                {
                  $convert: {
                    input: "$stock",
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
                0,
              ],
            },
            {
              $lte: [
                {
                  $convert: {
                    input: "$stock",
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
                {
                  $let: {
                    vars: {
                      rawThreshold: {
                        $convert: {
                          input: "$lowStockAlert",
                          to: "double",
                          onError: 0,
                          onNull: 0,
                        },
                      },
                    },
                    in: {
                      $cond: [{ $gt: ["$$rawThreshold", 0] }, "$$rawThreshold", 5],
                    },
                  },
                },
              ],
            },
          ],
        },
      }),
      Product.countDocuments({ ...baseSellerQuery, stock: 0 }),
      Product.countDocuments({
        ...baseSellerQuery,
        approvalStatus: PRODUCT_APPROVAL_STATUS.PENDING,
      }),
      Product.countDocuments({
        ...baseSellerQuery,
        $and: [
          { ...baseSellerQuery },
          buildApprovalStatusFilter(PRODUCT_APPROVAL_STATUS.APPROVED),
        ],
      }),
      Product.countDocuments({
        ...baseSellerQuery,
        approvalStatus: PRODUCT_APPROVAL_STATUS.REJECTED,
      }),
    ]);

    return handleResponse(res, 200, "Seller products fetched", {
      items: normalizeProductListModeration(products),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      summary: {
        total: totalAll,
        active: activeCount,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   CREATE PRODUCT
================================ */
export const createProduct = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const productData = { ...req.body };
    stripRestrictedModerationFields(productData);

    if (role === "admin") {
      if (!productData.sellerId) {
        return handleResponse(res, 400, "sellerId is required for admin-created products");
      }
    } else if (role === "warehouse") {
      productData.warehouseId = req.user.id;
    } else {
      productData.sellerId = req.user.id;
    }

    // Handle multipart files (mainImage, image, galleryImages, and variantImage_*)
    const files = req.files || [];
    const variantImagesMap = {};
    let uploadedMainImage = null;
    const uploadedGalleryImages = [];

    if (files.length > 0) {
      for (const file of files) {
        try {
          if (file.fieldname.startsWith("variantImage_")) {
            // expected format: variantImage_{variantIndex}_{imageIndex} or variantImage_{variantIndex}
            const parts = file.fieldname.split("_");
            const vIndex = parts[1];
            
            const url = await uploadToCloudinary(file.buffer, "products/variants", {
              mimeType: file.mimetype,
              resourceType: "image",
              originalName: file.originalname,
            });
            
            if (!variantImagesMap[vIndex]) {
              variantImagesMap[vIndex] = [];
            }
            variantImagesMap[vIndex].push(url);
          } else if (file.fieldname === "mainImage" || file.fieldname === "image" || file.fieldname === "mainImageFile") {
            uploadedMainImage = await uploadToCloudinary(file.buffer, "products", {
              mimeType: file.mimetype,
              resourceType: "image",
              originalName: file.originalname,
            });
          } else if (file.fieldname === "galleryImages" || file.fieldname.startsWith("galleryImage_") || file.fieldname === "galleryFiles") {
            const url = await uploadToCloudinary(file.buffer, "products/gallery", {
              mimeType: file.mimetype,
              resourceType: "image",
              originalName: file.originalname,
            });
            uploadedGalleryImages.push(url);
          }
        } catch (err) {
          logger.error("Cloudinary upload failed", {
            scope: "createProduct",
            error: err,
          });
        }
      }
    }

    if (uploadedMainImage) {
      productData.mainImage = uploadedMainImage;
    }
    if (uploadedGalleryImages.length > 0) {
      productData.galleryImages = [
        ...(Array.isArray(productData.galleryImages) ? productData.galleryImages : []),
        ...uploadedGalleryImages,
      ];
    }

    // Parse JSON fields if they come as strings from FormData
    if (typeof productData.variants === "string") {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        logger.error("Failed to parse variants JSON", {
          scope: "createProduct",
          error: e,
        });
        productData.variants = [];
      }
    }

    if (Array.isArray(productData.variants)) {
      productData.variants = productData.variants.map((v, idx) => {
        if (variantImagesMap[idx] && variantImagesMap[idx].length > 0) {
          v.images = variantImagesMap[idx];
        } else if (typeof v.image === "string" && v.image && (!v.images || v.images.length === 0)) {
          v.images = [v.image];
        } else if (!Array.isArray(v.images)) {
          v.images = [];
        }

        // Auto-populate product-level mainImage and galleryImages from the first variant if not explicitly uploaded
        if (idx === 0 && v.images.length > 0 && !productData.mainImage) {
          productData.mainImage = v.images[0];
          if (v.images.length > 1 && (!productData.galleryImages || productData.galleryImages.length === 0)) {
            productData.galleryImages = v.images.slice(1);
          }
        }
        return v;
      });
    }

    if (typeof productData.tags === "string" && productData.tags.startsWith("[")) {
      try {
        productData.tags = JSON.parse(productData.tags);
      } catch (e) {
        // Not JSON, keep as is
      }
    }
    if (typeof productData.highlights === "string") {
      try {
        productData.highlights = JSON.parse(productData.highlights);
      } catch (e) {
        // Not JSON
      }
    }
    if (typeof productData.refurbishedDetails === "string") {
      try {
        productData.refurbishedDetails = JSON.parse(productData.refurbishedDetails);
      } catch (e) {
        // Not JSON
      }
    }
    if (typeof productData.specifications === "string") {
      try {
        productData.specifications = JSON.parse(productData.specifications);
      } catch (e) {
        // Not JSON
      }
    }
    if (Array.isArray(productData.specifications)) {
      productData.specifications = productData.specifications
        .filter((item) => item && (item.key || item.value))
        .map((item) => ({
          key: String(item.key || "").trim(),
          value: String(item.value || "").trim(),
        }));
    } else if (productData.specifications && typeof productData.specifications === "object") {
      productData.specifications = Object.entries(productData.specifications).map(([k, v]) => ({
        key: String(k || "").trim(),
        value: String(v || "").trim(),
      }));
    }

    if (typeof productData.dynamicAttributes === "string") {
      try {
        productData.dynamicAttributes = JSON.parse(productData.dynamicAttributes);
      } catch (e) {
        // Not JSON
      }
    }
    if (Array.isArray(productData.dynamicAttributes)) {
      productData.dynamicAttributes = productData.dynamicAttributes
        .filter((item) => item && (item.name || item.value))
        .map((item) => ({
          attributeId: item.attributeId || null,
          name: String(item.name || "").trim(),
          value: String(item.value || "").trim(),
        }));
    }

    if (!productData.name) {
      return handleResponse(res, 400, "Product name is required");
    }

    // Auto-generate slug
    if (!productData.slug || productData.slug.trim() === "") {
      productData.slug = slugify(productData.name);
    } else {
      productData.slug = slugify(productData.slug);
    }

    productData.description =
      typeof productData.description === "string"
        ? productData.description.trim()
        : productData.description || "";

    // Normalize subcategoryId: if empty/invalid ObjectId, set to null so Mongoose schema accepts it
    if (!productData.subcategoryId || !mongoose.Types.ObjectId.isValid(String(productData.subcategoryId))) {
      productData.subcategoryId = null;
    } else {
      productData.subcategoryId = new mongoose.Types.ObjectId(String(productData.subcategoryId));
      if (!productData.categoryId || !productData.headerId) {
        const subCat = await Category.findById(productData.subcategoryId).select("parentId type").lean();
        if (subCat && subCat.parentId) {
          if (!productData.categoryId) productData.categoryId = subCat.parentId;
          if (!productData.headerId) {
            const parentCat = await Category.findById(subCat.parentId).select("parentId type").lean();
            if (parentCat && parentCat.parentId) {
              productData.headerId = parentCat.parentId;
            }
          }
        }
      }
    }

    if (productData.categoryId && mongoose.Types.ObjectId.isValid(String(productData.categoryId))) {
      productData.categoryId = new mongoose.Types.ObjectId(String(productData.categoryId));
      if (!productData.headerId) {
        const cat = await Category.findById(productData.categoryId).select("parentId type").lean();
        if (cat && cat.parentId) {
          productData.headerId = cat.parentId;
        }
      }
    }
    if (productData.headerId && mongoose.Types.ObjectId.isValid(String(productData.headerId))) {
      productData.headerId = new mongoose.Types.ObjectId(String(productData.headerId));
    }
    if (productData.sellerId && mongoose.Types.ObjectId.isValid(String(productData.sellerId))) {
      productData.sellerId = new mongoose.Types.ObjectId(String(productData.sellerId));
    }
    if (productData.warehouseId && mongoose.Types.ObjectId.isValid(String(productData.warehouseId))) {
      productData.warehouseId = new mongoose.Types.ObjectId(String(productData.warehouseId));
    }

    // Auto-generate product SKU if missing
    if (!productData.sku || String(productData.sku).trim() === "") {
      productData.sku = makeProductSku(productData.name, 1);
    }

    applyMediaFields(productData);

    // Handle tags if string
    if (typeof productData.tags === "string") {
      productData.tags = productData.tags.split(",").map((tag) => tag.trim());
    }

    if (Array.isArray(productData.variants)) {
      productData.variants = productData.variants.map((variant, idx) => ({
        ...variant,
        sku:
          variant?.sku && String(variant.sku).trim()
            ? variant.sku
            : makeProductSku(productData.name, idx + 1),
      }));
    }

    let moderationUpdate = {};
    let successMessage = "Product created successfully";

    if (role === "admin") {
      moderationUpdate = buildAdminApprovedModerationUpdate(req.user?.id || null);
    } else {
      const approvalConfig = await getProductApprovalConfig();
      if (approvalConfig.sellerCreateRequiresApproval) {
        moderationUpdate = buildSellerPendingModerationUpdate();
        successMessage = "Product submitted for admin approval";
      } else {
        moderationUpdate = buildSellerApprovedModerationUpdate();
      }
    }
    Object.assign(productData, moderationUpdate);

    const product = await Product.create(productData);

    if (product && product._id) {
      // Enqueue search indexing asynchronously
      await enqueueProductIndex(product._id.toString());
      await invalidate(`cache:catalog:product:${product._id.toString()}`);
    }

    try {
      await invalidate(buildKey("catalog", "productList", "*"));
      await invalidate(buildKey("catalog", "categories", "*"));
      await invalidate("cache:offersections:public:*");
    } catch (cacheErr) {
      logger.error("Cache invalidation error", {
        scope: "createProduct",
        error: cacheErr,
      });
    }

    return handleResponse(
      res,
      201,
      successMessage,
      normalizeProductDocumentModeration(product?.toObject?.() || product),
    );
  } catch (error) {
    logger.error("Create Product Error", { scope: "createProduct", error });
    if (error.code === 11000) {
      return handleResponse(res, 400, "Slug or SKU already exists");
    }
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPDATE PRODUCT
================================ */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;
    const role = String(req.user.role || "").toLowerCase();
    const productData = { ...req.body };
    stripRestrictedModerationFields(productData);
    if (Object.prototype.hasOwnProperty.call(productData, "sellerId")) {
      delete productData.sellerId;
    }

    // Admin bypasses sellerId check
    const query = role === "admin" ? { _id: id } : role === "warehouse" ? { _id: id, warehouseId: sellerId } : { _id: id, sellerId };
    const product = await Product.findOne(query);

    if (!product) {
      return handleResponse(res, 404, "Product not found or unauthorized");
    }

    // Handle multipart files (mainImage, image, galleryImages, and variantImage_*)
    const files = req.files || [];
    const variantImagesMap = {};
    let uploadedMainImage = null;
    const uploadedGalleryImages = [];

    if (files.length > 0) {
      for (const file of files) {
        try {
          if (file.fieldname.startsWith("variantImage_")) {
            // expected format: variantImage_{variantIndex}_{imageIndex} or variantImage_{variantIndex}
            const parts = file.fieldname.split("_");
            const vIndex = parts[1];
            
            const url = await uploadToCloudinary(file.buffer, "products/variants", {
              mimeType: file.mimetype,
              resourceType: "image",
              originalName: file.originalname,
            });
            
            if (!variantImagesMap[vIndex]) {
              variantImagesMap[vIndex] = [];
            }
            variantImagesMap[vIndex].push(url);
          } else if (file.fieldname === "mainImage" || file.fieldname === "image" || file.fieldname === "mainImageFile") {
            uploadedMainImage = await uploadToCloudinary(file.buffer, "products", {
              mimeType: file.mimetype,
              resourceType: "image",
              originalName: file.originalname,
            });
          } else if (file.fieldname === "galleryImages" || file.fieldname.startsWith("galleryImage_") || file.fieldname === "galleryFiles") {
            const url = await uploadToCloudinary(file.buffer, "products/gallery", {
              mimeType: file.mimetype,
              resourceType: "image",
              originalName: file.originalname,
            });
            uploadedGalleryImages.push(url);
          }
        } catch (err) {
          logger.error("Cloudinary upload failed during update", {
            scope: "updateProduct",
            error: err,
          });
        }
      }
    }

    if (uploadedMainImage) {
      productData.mainImage = uploadedMainImage;
    }
    if (uploadedGalleryImages.length > 0) {
      productData.galleryImages = [
        ...(Array.isArray(productData.galleryImages) ? productData.galleryImages : (product.galleryImages || [])),
        ...uploadedGalleryImages,
      ];
    }

    // Parse JSON fields
    if (typeof productData.variants === "string") {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        logger.error("Failed to parse variants JSON during update", {
          scope: "updateProduct",
          error: e,
        });
        productData.variants = product.variants || [];
      }
    }

    if (Array.isArray(productData.variants)) {
      productData.variants = productData.variants.map((v, idx) => {
        // If new images were uploaded for this variant, update them
        if (variantImagesMap[idx] && variantImagesMap[idx].length > 0) {
          v.images = variantImagesMap[idx];
        } else if (typeof v.image === "string" && v.image && (!v.images || v.images.length === 0)) {
          v.images = [v.image];
        } else if (!Array.isArray(v.images)) {
          // preserve existing variant images if available
          v.images = product.variants?.[idx]?.images || [];
        }
        
        // Auto-populate product-level mainImage and galleryImages from first variant if not already present
        if (idx === 0 && Array.isArray(v.images) && v.images.length > 0 && !productData.mainImage) {
          productData.mainImage = v.images[0];
          if (v.images.length > 1 && (!productData.galleryImages || productData.galleryImages.length === 0)) {
            productData.galleryImages = v.images.slice(1);
          }
        }
        
        return v;
      });
    }

    if (typeof productData.tags === "string" && productData.tags.startsWith("[")) {
      try {
        productData.tags = JSON.parse(productData.tags);
      } catch (e) {
        // Not JSON, keep as is
      }
    }
    if (typeof productData.highlights === "string") {
      try {
        productData.highlights = JSON.parse(productData.highlights);
      } catch (e) {
        // Not JSON
      }
    }
    if (typeof productData.refurbishedDetails === "string") {
      try {
        productData.refurbishedDetails = JSON.parse(productData.refurbishedDetails);
      } catch (e) {
        // Not JSON
      }
    }
    if (typeof productData.specifications === "string") {
      try {
        productData.specifications = JSON.parse(productData.specifications);
      } catch (e) {
        // Not JSON
      }
    }
    if (Array.isArray(productData.specifications)) {
      productData.specifications = productData.specifications
        .filter((item) => item && (item.key || item.value))
        .map((item) => ({
          key: String(item.key || "").trim(),
          value: String(item.value || "").trim(),
        }));
    } else if (productData.specifications && typeof productData.specifications === "object") {
      productData.specifications = Object.entries(productData.specifications).map(([k, v]) => ({
        key: String(k || "").trim(),
        value: String(v || "").trim(),
      }));
    }

    if (typeof productData.dynamicAttributes === "string") {
      try {
        productData.dynamicAttributes = JSON.parse(productData.dynamicAttributes);
      } catch (e) {
        // Not JSON
      }
    }
    if (Array.isArray(productData.dynamicAttributes)) {
      productData.dynamicAttributes = productData.dynamicAttributes
        .filter((item) => item && (item.name || item.value))
        .map((item) => ({
          attributeId: item.attributeId || null,
          name: String(item.name || "").trim(),
          value: String(item.value || "").trim(),
        }));
    }

    if (productData.name) {
      if (!productData.slug || productData.slug.trim() === "") {
        productData.slug = slugify(productData.name);
      } else {
        productData.slug = slugify(productData.slug);
      }
    }

    if (productData.description !== undefined) {
      productData.description =
        typeof productData.description === "string"
          ? productData.description.trim()
          : productData.description || "";
    }

    // Normalize subcategoryId: if provided but empty/invalid ObjectId, set to null
    if (productData.subcategoryId !== undefined) {
      if (!productData.subcategoryId || !mongoose.Types.ObjectId.isValid(String(productData.subcategoryId))) {
        productData.subcategoryId = null;
      } else {
        productData.subcategoryId = new mongoose.Types.ObjectId(String(productData.subcategoryId));
        if (!productData.categoryId) {
          const subCat = await Category.findById(productData.subcategoryId).select("parentId type").lean();
          if (subCat && subCat.parentId) {
            productData.categoryId = subCat.parentId;
            if (!productData.headerId) {
              const parentCat = await Category.findById(subCat.parentId).select("parentId type").lean();
              if (parentCat && parentCat.parentId) {
                productData.headerId = parentCat.parentId;
              }
            }
          }
        }
      }
    }

    if (productData.categoryId && mongoose.Types.ObjectId.isValid(String(productData.categoryId))) {
      productData.categoryId = new mongoose.Types.ObjectId(String(productData.categoryId));
      if (!productData.headerId) {
        const cat = await Category.findById(productData.categoryId).select("parentId type").lean();
        if (cat && cat.parentId) {
          productData.headerId = cat.parentId;
        }
      }
    }
    if (productData.headerId && mongoose.Types.ObjectId.isValid(String(productData.headerId))) {
      productData.headerId = new mongoose.Types.ObjectId(String(productData.headerId));
    }

    const skuBaseName = productData.name || product.name;
    if (!productData.sku || String(productData.sku).trim() === "") {
      productData.sku = product.sku || makeProductSku(skuBaseName, 1);
    }
    if (productData.mainImage === undefined && product.mainImage) {
      productData.mainImage = product.mainImage;
    }

    applyMediaFields(productData);

    if (typeof productData.tags === "string") {
      productData.tags = productData.tags.split(",").map((tag) => tag.trim());
    }

    if (typeof productData.variants === "string") {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        // keep existing if invalid?
      }
    }

    if (Array.isArray(productData.variants)) {
      productData.variants = productData.variants.map((variant, idx) => ({
        ...variant,
        sku:
          variant?.sku && String(variant.sku).trim()
            ? variant.sku
            : makeProductSku(skuBaseName, idx + 1),
      }));
    }

    let moderationUpdate = {};
    let successMessage = "Product updated successfully";

    if (role === "admin") {
      moderationUpdate = buildAdminApprovedModerationUpdate(req.user?.id || null);
    } else {
      const approvalConfig = await getProductApprovalConfig();
      if (approvalConfig.sellerEditRequiresApproval) {
        moderationUpdate = buildSellerPendingModerationUpdate();
        successMessage = "Product changes submitted for admin approval";
      } else {
        moderationUpdate = buildSellerApprovedModerationUpdate();
      }
    }
    Object.assign(productData, moderationUpdate);

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: productData },
      { new: true, runValidators: true },
    );

    // Enqueue search indexing asynchronously
    await enqueueProductIndex(id);
    await invalidate(buildKey("catalog", "product", id));

    try {
      await invalidate(buildKey("catalog", "productList", "*"));
      await invalidate(buildKey("catalog", "categories", "*"));
      await invalidate("cache:offersections:public:*");
    } catch (cacheErr) {
      logger.error("Cache invalidation error", {
        scope: "updateProduct",
        error: cacheErr,
      });
    }

    return handleResponse(
      res,
      200,
      successMessage,
      normalizeProductDocumentModeration(updatedProduct?.toObject?.() || updatedProduct),
    );
  } catch (error) {
    logger.error("Update Product Error", { scope: "updateProduct", error });
    if (error.name === "ValidationError") {
      return handleResponse(
        res,
        400,
        Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      );
    }
    if (error.name === "CastError") {
      return handleResponse(res, 400, `Invalid ${error.path}: ${error.value}`);
    }
    if (error.code === 11000) {
      return handleResponse(res, 400, "Slug or SKU already exists");
    }
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   DELETE PRODUCT
================================ */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;
    const role = req.user.role;

    const query = role === "admin" ? { _id: id } : role === "warehouse" ? { _id: id, warehouseId: sellerId } : { _id: id, sellerId };
    const product = await Product.findOneAndDelete(query);

    if (!product) {
      return handleResponse(res, 404, "Product not found or unauthorized");
    }

    // Enqueue search index removal asynchronously
    await enqueueProductRemoval(id);
    await invalidate(`cache:catalog:product:${id}`);

    try {
      await invalidate(buildKey("catalog", "productList", "*"));
      await invalidate(buildKey("catalog", "categories", "*"));
      await invalidate("cache:offersections:public:*");
    } catch (cacheErr) {
      logger.error("Cache invalidation error", {
        scope: "deleteProduct",
        error: cacheErr,
      });
    }

    return handleResponse(res, 200, "Product deleted successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SINGLE PRODUCT
================================ */
export const getProductById = async (req, res) => {
  try {
    const targetId = req.query.id || req.params.id;
    const id = targetId;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const enforceRadius = isCustomerVisibilityRequest(req);

    let nearbySellerSet = null;
    const coords = parseCustomerCoordinates(req.query || {});
    if (enforceRadius && coords.valid) {
      const nearbySellerIds = await getNearbySellerIdsForCustomer(
        coords.lat,
        coords.lng,
      );
      nearbySellerSet = new Set(nearbySellerIds.map(String));
    }

    const cacheKey = buildKey("catalog", "product", id);
    const product = await getOrSet(
      cacheKey,
      async () => {
        const query = isObjectId ? { _id: id } : { slug: id };
        return Product.findOne(query)
          .select(
            "name slug description sku price salePrice stock lowStockAlert brand weight shelfLife countryOfOrigin fssaiLicense mainImage galleryImages headerId categoryId subcategoryId sellerId warehouseId isMonthlyKit status approvalStatus approvalRequestedAt approvalReviewedAt approvalReviewedBy approvalNote lastSubmittedByRole isFeatured isTopDeal variants highlights specifications dynamicAttributes createdAt",
          )
          .populate("headerId", "name slug")
          .populate("categoryId", "name slug")
          .populate("subcategoryId", "name slug")
          .populate("sellerId", "shopName")
          .populate("warehouseId", "name")
          .lean();
      },
      getTTL("product"),
    );

    if (!product) {
      return handleResponse(res, 404, "Product not found");
    }

    if (enforceRadius) {
      const approvalState = resolveProductApprovalStatus(product);
      if (product.status !== "active" || approvalState !== PRODUCT_APPROVAL_STATUS.APPROVED) {
        return handleResponse(res, 404, "Product not found");
      }
    }

    if (enforceRadius) {
      let sellerIdForProduct = product?.sellerId?._id
        ? String(product.sellerId._id)
        : product?.sellerId
          ? String(product.sellerId)
          : null;
      let warehouseIdForProduct = product?.warehouseId?._id
        ? String(product.warehouseId._id)
        : product?.warehouseId
          ? String(product.warehouseId)
          : null;

      if (
        (!sellerIdForProduct || sellerIdForProduct === "null") &&
        (!warehouseIdForProduct || warehouseIdForProduct === "null")
      ) {
        const rawProduct = await Product.findOne(isObjectId ? { _id: id } : { slug: id })
          .select("sellerId warehouseId")
          .lean();
        if (rawProduct?.sellerId) sellerIdForProduct = String(rawProduct.sellerId);
        if (rawProduct?.warehouseId) warehouseIdForProduct = String(rawProduct.warehouseId);
      }

      const fulfillmentId = sellerIdForProduct || warehouseIdForProduct;
      if (req.query.allProducts !== "true" && coords.valid && nearbySellerSet && (!fulfillmentId || !nearbySellerSet.has(String(fulfillmentId)))) {
        return handleResponse(res, 404, "Product not available in your area");
      }
    }

    const payload = normalizeProductDocumentModeration(product);

    if (req.user) {
      const userId = req.user.id;
      const purchase = await Order.findOne({
        customer: userId,
        "items.product": product._id,
        $or: [
          { orderStatus: { $regex: /^delivered$/i } },
          { status: { $regex: /^delivered$/i } }
        ]
      });
      payload.hasPurchased = !!purchase;

      const existingReview = await Review.findOne({
        userId,
        productId: id
      });
      payload.hasReviewed = !!existingReview;
    }

    return handleResponse(
      res,
      200,
      "Product details fetched",
      payload,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   ADMIN MODERATION LIST
================================ */
export const getModerationProducts = async (req, res) => {
  try {
    const {
      approvalStatus = "all",
      status = "all",
      search = "",
      sellerId,
      category,
      categoryId,
      subcategory,
      subcategoryId,
      header,
      headerId,
      sort = "newest",
    } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 500,
    });

    const baseQuery = {};
    if (status && status !== "all") {
      baseQuery.status = status;
    }
    if (sellerId && sellerId !== "all") {
      baseQuery.sellerId = sellerId;
    }

    const finalHeaderId = header || headerId;
    const finalCategoryId = category || categoryId;
    const finalSubcategoryId = subcategory || subcategoryId;
    if (finalHeaderId && finalHeaderId !== "all") {
      baseQuery.headerId = finalHeaderId;
    }
    if (finalCategoryId && finalCategoryId !== "all") {
      baseQuery.categoryId = finalCategoryId;
    }
    if (finalSubcategoryId && finalSubcategoryId !== "all") {
      baseQuery.subcategoryId = finalSubcategoryId;
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      if (isProductTextSearchEnabled() && term.length >= 3) {
        baseQuery.$text = { $search: term };
      } else {
        // P3-5: same substring semantics, now safely escaped.
        const safe = buildSearchRegex(term, { anchored: false });
        baseQuery.$or = [
          { name: safe },
          { slug: safe },
          { sku: safe },
        ];
      }
    }

    let moderatedQuery = { ...baseQuery };
    const approvalFilter = buildApprovalStatusFilter(approvalStatus);
    if (Object.keys(approvalFilter).length > 0) {
      moderatedQuery = { $and: [moderatedQuery, approvalFilter] };
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "name-asc": { name: 1, createdAt: -1 },
      "name-desc": { name: -1, createdAt: -1 },
      "price-asc": { price: 1, createdAt: -1 },
      "price-desc": { price: -1, createdAt: -1 },
    };
    const sortQuery = sortMap[String(sort || "newest").toLowerCase()] || sortMap.newest;

    const [items, total, allCount, pendingCount, approvedCount, rejectedCount] =
      await Promise.all([
        Product.find(moderatedQuery)
          .select(
            "name slug description sku price salePrice stock lowStockAlert brand weight shelfLife countryOfOrigin fssaiLicense mainImage galleryImages headerId categoryId subcategoryId sellerId status approvalStatus approvalRequestedAt approvalReviewedAt approvalReviewedBy approvalNote lastSubmittedByRole isFeatured isTopDeal variants highlights createdAt",
          )
          .populate("headerId", "name")
          .populate("categoryId", "name")
          .populate("subcategoryId", "name")
          .populate("sellerId", "shopName name")
          .populate("warehouseId", "name")
          .populate("approvalReviewedBy", "name email")
          .sort(sortQuery)
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(moderatedQuery),
        Product.countDocuments(baseQuery),
        Product.countDocuments({
          ...baseQuery,
          approvalStatus: PRODUCT_APPROVAL_STATUS.PENDING,
        }),
        Product.countDocuments({
          $and: [
            { ...baseQuery },
            buildApprovalStatusFilter(PRODUCT_APPROVAL_STATUS.APPROVED),
          ],
        }),
        Product.countDocuments({
          ...baseQuery,
          approvalStatus: PRODUCT_APPROVAL_STATUS.REJECTED,
        }),
      ]);

    return handleResponse(res, 200, "Moderation products fetched", {
      items: normalizeProductListModeration(items),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      counts: {
        all: allCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   ADMIN MODERATION ACTIONS
================================ */
export const approveProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const note = req.body?.approvalNote ?? req.body?.note ?? "";
    const moderationUpdate = buildAdminApprovedModerationUpdate(
      req.user?.id || null,
      note,
    );

    const updated = await Product.findByIdAndUpdate(
      id,
      { $set: moderationUpdate },
      { new: true, runValidators: true },
    )
      .populate("headerId", "name")
      .populate("categoryId", "name")
      .populate("subcategoryId", "name")
      .populate("sellerId", "shopName name")
      .populate("warehouseId", "name")
      .populate("approvalReviewedBy", "name email");

    if (!updated) {
      return handleResponse(res, 404, "Product not found");
    }

    await enqueueProductIndex(id);
    await invalidate(buildKey("catalog", "product", id));
    await invalidate(buildKey("catalog", "productList", "*"));
    await invalidate("cache:offersections:public:*");

    return handleResponse(
      res,
      200,
      "Product approved successfully",
      normalizeProductDocumentModeration(updated?.toObject?.() || updated),
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const rejectProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const note = req.body?.approvalNote ?? req.body?.note ?? "";
    const moderationUpdate = buildAdminRejectedModerationUpdate(
      req.user?.id || null,
      note,
    );

    const updated = await Product.findByIdAndUpdate(
      id,
      { $set: moderationUpdate },
      { new: true, runValidators: true },
    )
      .populate("headerId", "name")
      .populate("categoryId", "name")
      .populate("subcategoryId", "name")
      .populate("sellerId", "shopName name")
      .populate("warehouseId", "name")
      .populate("approvalReviewedBy", "name email");

    if (!updated) {
      return handleResponse(res, 404, "Product not found");
    }

    await enqueueProductIndex(id);
    await invalidate(buildKey("catalog", "product", id));
    await invalidate(buildKey("catalog", "productList", "*"));
    await invalidate("cache:offersections:public:*");

    return handleResponse(
      res,
      200,
      "Product rejected successfully",
      normalizeProductDocumentModeration(updated?.toObject?.() || updated),
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ================================================================
   GET PRODUCTS BY ALL HEADER CATEGORIES (For Home "All" Tab)
   Returns line-wise header categories with up to max products each
================================================================ */
export const getHeaderProducts = async (req, res) => {
  try {
    const limit = Math.min(Math.max(1, parseInt(req.query.limit || "10", 10)), 20);
    const { lat, lng } = req.query;

    const headers = await Category.find({ type: "header", status: "active" })
      .sort({ sortOrder: 1, name: 1, _id: 1 })
      .lean();

    const filteredHeaders = headers.filter(
      (h) => (h.slug?.toLowerCase() !== "all") && (h.name?.toLowerCase() !== "all")
    );

    if (!filteredHeaders.length) {
      return handleResponse(res, 200, "No header categories found", []);
    }

    const enforceRadius = isCustomerVisibilityRequest(req);
    const coords = parseCustomerCoordinates({ lat, lng });
    const effectiveLat = coords.valid ? coords.lat : 22.7196;
    const effectiveLng = coords.valid ? coords.lng : 75.8577;

    const [homeHeroConfig, heroConfigs, nearbySellerIds] = await Promise.all([
      HeroConfig.findOne({ pageType: "home", headerId: null }).lean().catch(() => null),
      HeroConfig.find({
        pageType: "header",
        headerId: { $in: filteredHeaders.map((h) => h._id) },
      }).lean().catch(() => []),
      enforceRadius
        ? getNearbySellerIdsForCustomer(effectiveLat, effectiveLng).catch(() => null)
        : Promise.resolve(null),
    ]);

    const bannerByHeaderId = new Map();
    const bannersByHeaderId = new Map();

    // 1. First populate from header configs (if any, strictly single banner)
    (heroConfigs || []).forEach((hc) => {
      if (hc.headerId) {
        const activeItems = (hc.banners?.items || []).filter(
          (b) => b.status !== "inactive" && b.imageUrl
        );
        if (activeItems.length > 0) {
          bannerByHeaderId.set(hc.headerId.toString(), activeItems[0].imageUrl);
          bannersByHeaderId.set(hc.headerId.toString(), [activeItems[0]]);
        }
      }
    });

    // 2. Override with homeHeroConfig categorySectionBanners specifically configured for "All" page (single banner)
    (homeHeroConfig?.categorySectionBanners || []).forEach((cs) => {
      if (cs.headerId) {
        const activeItems = (cs.banners || []).filter(
          (b) => b.status !== "inactive" && b.imageUrl
        );
        if (activeItems.length > 0) {
          bannerByHeaderId.set(cs.headerId.toString(), activeItems[0].imageUrl);
          bannersByHeaderId.set(cs.headerId.toString(), [activeItems[0]]);
        }
      }
    });

    let sellerFilter = null;
    if (enforceRadius && nearbySellerIds && nearbySellerIds.length > 0) {
      sellerFilter = {
        $or: [
          { sellerId: { $in: nearbySellerIds } },
          { warehouseId: { $in: nearbySellerIds } }
        ]
      };
    }

    const results = await Promise.all(
      filteredHeaders.map(async (header) => {
        try {
          const childCats = await Category.find({ parentId: header._id, type: "category" }).select("_id").lean();
          const childCatIds = childCats.map((c) => c._id);
          const subCats = childCatIds.length > 0
            ? await Category.find({ parentId: { $in: childCatIds }, type: "subcategory" }).select("_id").lean()
            : [];
          const subCatIds = subCats.map((s) => s._id);

          const categoryOrClauses = [
            { headerId: header._id },
            ...(childCatIds.length > 0 ? [{ categoryId: { $in: childCatIds } }] : []),
            ...(subCatIds.length > 0 ? [{ subcategoryId: { $in: subCatIds } }] : []),
          ];

          const prodQuery = {
            status: "active",
            approvalStatus: { $ne: "rejected" },
            conditionType: { $ne: "refurbished" },
            $or: categoryOrClauses,
          };

          if (sellerFilter) {
            prodQuery.$and = [sellerFilter];
          }

          let items = await Product.find(prodQuery)
            .select("_id name slug price salePrice mainImage variants rating ratingsCount weight unit brand isFeatured isTopDeal")
            .sort({ isFeatured: -1, createdAt: -1 })
            .limit(limit)
            .lean();

          if ((!items || items.length === 0) && sellerFilter) {
            delete prodQuery.$and;
            items = await Product.find(prodQuery)
              .select("_id name slug price salePrice mainImage variants rating ratingsCount weight unit brand isFeatured isTopDeal")
              .sort({ isFeatured: -1, createdAt: -1 })
              .limit(limit)
              .lean();
          }

          const cmsBanners = bannersByHeaderId.get(header._id.toString()) || [];
          const cmsBanner = bannerByHeaderId.get(header._id.toString()) || header.banner || null;

          return {
            header: {
              _id: header._id,
              name: header.name,
              slug: header.slug,
              image: header.image || null,
              banner: cmsBanner,
              banners: cmsBanners,
              iconId: header.iconId || null,
              headerColor: header.headerColor || null,
              headerFontColor: header.headerFontColor || null,
              sortOrder: header.sortOrder ?? 0,
            },
            products: (items || []).map((p) => {
              const firstVar = p.variants?.[0];
              const vSalePrice = Number(firstVar?.salePrice || 0);
              const vPrice = Number(firstVar?.price || 0);
              const hasVarDiscount = vSalePrice > 0 && vPrice > vSalePrice;

              return {
                ...p,
                id: p._id,
                image: p.mainImage || (p.variants?.[0]?.images?.[0]) || "",
                price: hasVarDiscount ? vSalePrice : (p.salePrice || p.price),
                originalPrice: hasVarDiscount ? vPrice : (p.price || p.salePrice),
                weight: p.weight || "1 unit",
                rating: p.rating || 5.0,
              };
            }),
          };
        } catch (catErr) {
          return null;
        }
      })
    );

    const validSections = results.filter(Boolean);
    return handleResponse(res, 200, "Header products fetched successfully", validSections);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

