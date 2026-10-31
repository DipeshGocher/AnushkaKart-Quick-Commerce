import Joi from "joi";
import Setting from "../models/setting.js";
import handleResponse from "../utils/helper.js";
import { buildKey, getOrSet, getTTL, invalidate } from "../services/cacheService.js";
import { uploadToCloudinary } from "../services/mediaService.js";
import {
  DEFAULT_PRODUCT_APPROVAL_CONFIG,
  normalizeProductApprovalConfig,
} from "../services/productModerationService.js";
import { getErrorStatus } from "../utils/httpError.js";

/** Allowed keys for settings update (strip unknown keys) */
const ALLOWED_KEYS = [
  "appName",
  "supportEmail",
  "supportPhone",
  "whatsappNumber",
  "currencySymbol",
  "currencyCode",
  "timezone",
  "logoUrl",
  "faviconUrl",
  "primaryColor",
  "secondaryColor",
  "companyName",
  "taxId",
  "address",
  "facebook",
  "twitter",
  "instagram",
  "linkedin",
  "youtube",
  "playStoreLink",
  "appStoreLink",
  "metaTitle",
  "metaDescription",
  "metaKeywords",
  "keywords",
  "footerMessage",
  "footerEmoji",
  "footerDescription",
  "footerQuickLinksTitle",
  "footerQuickLinks",
  "footerCategoriesTitle",
  "footerCategoriesLinks",
  "footerContactTitle",
  "footerCopyright",
  "footerPrivacyUrl",
  "footerTermsUrl",
  "footerBgColor",
  "footerEnabled",
  "returnDeliveryCommission",
  "deliveryPricingMode",
  "pricingMode",
  "customerBaseDeliveryFee",
  "riderBasePayout",
  "baseDeliveryCharge",
  "baseDistanceCapacityKm",
  "incrementalKmSurcharge",
  "deliveryPartnerRatePerKm",
  "fleetCommissionRatePerKm",
  "fixedDeliveryFee",
  "handlingFeeStrategy",
  "codEnabled",
  "onlineEnabled",
  "lowStockAlertsEnabled",
  "productApproval",
  "categoriesBanner",
  "deliveryBadgeText",
  "deliveryBadgeImage",
  "deliveryBadgeBg",
  "deliveryBadgeEnabled",
  "bestSellingTitle",
  "bestSellingCategoryIds",
  "categoryTopDeals",
];

function flattenForMongoSet(prefix, value, target) {
  if (value === undefined) return;

  const isPlainObject =
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date);

  if (!isPlainObject) {
    target[prefix] = value;
    return;
  }

  const keys = Object.keys(value);
  if (!keys.length) {
    target[prefix] = value;
    return;
  }

  for (const key of keys) {
    flattenForMongoSet(`${prefix}.${key}`, value[key], target);
  }
}

/** Joi schema for validating settings update payload */
const updateSettingsSchema = Joi.object({
  appName: Joi.string().allow("").max(200),
  supportEmail: Joi.string().email().allow("").max(200),
  supportPhone: Joi.string().allow("").pattern(/^[0-9]{10}$/).messages({
    "string.pattern.base": "Support Phone must be a valid 10-digit number",
  }),
  whatsappNumber: Joi.string().allow("").pattern(/^[0-9]{10}$/).messages({
    "string.pattern.base": "WhatsApp Number must be a valid 10-digit number",
  }),
  currencySymbol: Joi.string().allow("").max(10),
  currencyCode: Joi.string().allow("").max(10),
  timezone: Joi.string().allow("").max(100),
  logoUrl: Joi.string().allow("").max(2000),
  faviconUrl: Joi.string().allow("").max(2000),
  primaryColor: Joi.string().allow("").max(50),
  secondaryColor: Joi.string().allow("").max(50),
  companyName: Joi.string().allow("").max(200),
  taxId: Joi.string().allow("").max(15),
  address: Joi.string().allow("").max(500),
  facebook: Joi.string().allow("").max(500),
  twitter: Joi.string().allow("").max(500),
  instagram: Joi.string().allow("").max(500),
  linkedin: Joi.string().allow("").max(500),
  youtube: Joi.string().allow("").max(500),
  playStoreLink: Joi.string().allow("").max(500),
  appStoreLink: Joi.string().allow("").max(500),
  metaTitle: Joi.string().allow("").max(200),
  metaDescription: Joi.string().allow("").max(500),
  metaKeywords: Joi.string().allow("").max(1000),
  keywords: Joi.array().items(Joi.string().max(200)),
  footerMessage: Joi.string().allow("").max(200),
  footerEmoji: Joi.string().allow("").max(10),
  footerDescription: Joi.string().allow("").max(1000),
  footerQuickLinksTitle: Joi.string().allow("").max(200),
  footerQuickLinks: Joi.array().items(
    Joi.object({
      _id: Joi.any(),
      label: Joi.string().allow("").max(100),
      url: Joi.string().allow("").max(500),
    }).unknown(true)
  ).default([]),
  footerCategoriesTitle: Joi.string().allow("").max(200),
  footerCategoriesLinks: Joi.array().items(
    Joi.object({
      _id: Joi.any(),
      label: Joi.string().allow("").max(100),
      url: Joi.string().allow("").max(500),
    }).unknown(true)
  ).default([]),
  footerContactTitle: Joi.string().allow("").max(200),
  footerCopyright: Joi.string().allow("").max(500),
  footerPrivacyUrl: Joi.string().allow("").max(500),
  footerTermsUrl: Joi.string().allow("").max(500),
  footerBgColor: Joi.string().allow("").max(200),
  footerEnabled: Joi.boolean(),
  returnDeliveryCommission: Joi.number().min(0),
  deliveryPricingMode: Joi.string().valid("fixed_price", "distance_based"),
  pricingMode: Joi.string().valid("fixed_price", "distance_based"),
  customerBaseDeliveryFee: Joi.number().min(0),
  riderBasePayout: Joi.number().min(0),
  baseDeliveryCharge: Joi.number().min(0),
  baseDistanceCapacityKm: Joi.number().min(0),
  incrementalKmSurcharge: Joi.number().min(0),
  deliveryPartnerRatePerKm: Joi.number().min(0),
  fleetCommissionRatePerKm: Joi.number().min(0),
  fixedDeliveryFee: Joi.number().min(0),
  handlingFeeStrategy: Joi.string().valid(
    "highest_category_fee",
    "sum_of_category_fees",
    "max_single_fee",
    "per_item_fee",
  ),
  codEnabled: Joi.boolean(),
  onlineEnabled: Joi.boolean(),
  lowStockAlertsEnabled: Joi.boolean(),
  productApproval: Joi.object({
    _id: Joi.any(),
    sellerCreateRequiresApproval: Joi.boolean(),
    sellerEditRequiresApproval: Joi.boolean(),
  }).unknown(true),
  categoriesBanner: Joi.object({
    _id: Joi.any(),
    presetVersion: Joi.number().integer().min(0),
    image: Joi.string().allow("").max(2000),
    badgeText: Joi.string().allow("").max(100),
    title: Joi.string().allow("").max(500),
    buttonText: Joi.string().allow("").max(100),
    buttonLink: Joi.string().allow("").max(500),
    isVisible: Joi.boolean(),
    banners: Joi.array().items(
      Joi.object({
        _id: Joi.any(),
        image: Joi.string().allow("").max(2000),
        headerCategoryId: Joi.string().allow("").max(100),
        badgeText: Joi.string().allow("").max(100),
        title: Joi.string().allow("").max(500),
        buttonText: Joi.string().allow("").max(100),
        buttonLink: Joi.string().allow("").max(500),
      }).unknown(true)
    ).default([]),
  }).unknown(true),
  deliveryBadgeText: Joi.string().allow("").max(100),
  deliveryBadgeImage: Joi.string().allow("").max(2000),
  deliveryBadgeBg: Joi.string().allow("").max(500),
  deliveryBadgeEnabled: Joi.boolean(),
  bestSellingTitle: Joi.string().allow("").max(200),
  bestSellingCategoryIds: Joi.array().items(Joi.string().max(100)),
  categoryTopDeals: Joi.object().pattern(Joi.string(), Joi.object({
    title: Joi.string().allow("").max(200),
    productIds: Joi.array().items(Joi.string().max(100)),
  }).unknown(true)),
}).unknown(false);

/**
 * GET /api/settings (public)
 * Returns current platform settings for frontend (no auth required).
 * For multi-tenant: later use req.tenantId ?? null in query.
 */
export const getPublicSettings = async (req, res) => {
  try {
    const tenantId = req.tenantId ?? null;
    const filter = tenantId
      ? { tenantId }
      : { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] };
    const cacheKey = buildKey("platform", "settings", tenantId ? String(tenantId) : "default");

    let settings = await getOrSet(
      cacheKey,
      async () => {
        const existing = await Setting.findOne(filter)
          .select(
            "appName supportEmail supportPhone whatsappNumber currencySymbol currencyCode timezone logoUrl faviconUrl primaryColor secondaryColor address facebook twitter instagram linkedin youtube playStoreLink appStoreLink footerMessage footerEmoji footerDescription footerQuickLinksTitle footerQuickLinks footerCategoriesTitle footerCategoriesLinks footerContactTitle footerCopyright footerPrivacyUrl footerTermsUrl footerBgColor footerEnabled returnDeliveryCommission deliveryPricingMode pricingMode customerBaseDeliveryFee riderBasePayout baseDeliveryCharge baseDistanceCapacityKm incrementalKmSurcharge deliveryPartnerRatePerKm fleetCommissionRatePerKm fixedDeliveryFee handlingFeeStrategy codEnabled onlineEnabled lowStockAlertsEnabled productApproval categoriesBanner deliveryBadgeText deliveryBadgeImage deliveryBadgeBg deliveryBadgeEnabled bestSellingTitle bestSellingCategoryIds categoryTopDeals createdAt",
          )
          .lean();
        return existing || null;
      },
      getTTL("settings"),
    );

    if (!settings) {
      const created = await Setting.create({ tenantId });
      settings = created.toObject();
      await invalidate("cache:platform:settings:*");
    }

    if (settings) {
      if (!settings.primaryColor || settings.primaryColor === "#0ea5e9" || settings.primaryColor === "#00AEEF" || settings.primaryColor === "#0284c7" || settings.primaryColor === "#E60067") {
        settings.primaryColor = "#FF5722";
      }
      if (!settings.secondaryColor || settings.secondaryColor === "#64748b" || settings.secondaryColor === "#FF3366") {
        settings.secondaryColor = "#0047AB";
      }
    }

    if (!settings.whatsappNumber) {
        settings.whatsappNumber = "8209224481";
      }
      settings.productApproval = normalizeProductApprovalConfig(settings || {});

    return handleResponse(res, 200, "Settings fetched successfully", settings);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

/**
 * PUT /api/settings (admin only)
 * Updates platform settings. Uses upsert. Validates payload with Joi.
 */
export const updateSettings = async (req, res) => {
  try {
    const raw = req.body || {};
    const payload = {};
    for (const key of ALLOWED_KEYS) {
      if (Object.prototype.hasOwnProperty.call(raw, key)) {
        payload[key] = raw[key];
      }
    }

    if (typeof payload.supportPhone === "string" && payload.supportPhone.trim()) {
      const cleanDigits = payload.supportPhone.replace(/\D/g, "");
      payload.supportPhone = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
    }

    if (typeof payload.whatsappNumber === "string" && payload.whatsappNumber.trim()) {
      const cleanDigits = payload.whatsappNumber.replace(/\D/g, "");
      payload.whatsappNumber = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
    }

    const { error, value } = updateSettingsSchema.validate(payload, {
      stripUnknown: true,
    });
    if (error) {
      return handleResponse(
        res,
        400,
        error.details.map((d) => d.message).join("; "),
      );
    }
    const tenantId = req.tenantId ?? null;
    const filter = tenantId
      ? { tenantId }
      : { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] };
    const toSet = {};
    const directSetKeys = new Set([
      "categoriesBanner",
      "productApproval",
      "footerQuickLinks",
      "footerCategoriesLinks",
      "categoryTopDeals"
    ]);

    for (const [key, v] of Object.entries(value)) {
      if (v === undefined) continue;
      if (directSetKeys.has(key)) {
        toSet[key] = v;
      } else {
        flattenForMongoSet(key, v, toSet);
      }
    }
    // Permanently lock system currency to Indian Rupee (₹ INR)
    toSet.currencySymbol = "₹";
    toSet.currencyCode = "INR";
    if (Object.keys(toSet).length === 0) {
      const current = await Setting.findOne(filter).lean();
      const result = current || {};
      result.productApproval = normalizeProductApprovalConfig(result);
      return handleResponse(res, 200, "Settings unchanged", result);
    }

    const settings = await Setting.findOneAndUpdate(
      filter,
      { $set: toSet },
      { new: true, upsert: true },
    );
    await invalidate("cache:platform:settings:*");

    const result = settings?.toObject?.() || settings || {};
    if (!result.productApproval) {
      result.productApproval = { ...DEFAULT_PRODUCT_APPROVAL_CONFIG };
    } else {
      result.productApproval = normalizeProductApprovalConfig(result);
    }

    return handleResponse(res, 200, "Settings updated successfully", result);
  } catch (err) {
    return handleResponse(res, getErrorStatus(err), err.message);
  }
};

/**
 * POST /api/settings/upload (admin only)
 * Uploads logo or favicon image to Cloudinary. Returns the public URL.
 * Request: multipart/form-data with field "image". Optional query ?type=logo|favicon for folder naming.
 */
export const uploadSettingsImage = async (req, res) => {
  try {
    const type = (req.query.type || "logo").toLowerCase();
    if (type !== "logo" && type !== "favicon" && type !== "categoriesbanner" && type !== "deliverybadge") {
      return handleResponse(res, 400, "type must be logo, favicon, categoriesbanner, or deliverybadge");
    }

    if (req.file) {
      const isVideo = String(req.file.mimetype || "").trim().toLowerCase().startsWith("video/");
      const url = await uploadToCloudinary(req.file.buffer, "settings", {
        mimeType: req.file.mimetype,
        resourceType: isVideo ? "video" : "image",
      });
      await invalidate("cache:platform:settings:*");
      return handleResponse(res, 200, isVideo ? "Video uploaded" : "Image uploaded", { url, type });
    }

    const providedUrl = String(req.body?.url || req.body?.imageUrl || "").trim();
    if (!providedUrl || !/^https?:\/\//i.test(providedUrl)) {
      return handleResponse(res, 400, "A valid image URL is required");
    }

    await invalidate("cache:platform:settings:*");
    return handleResponse(res, 200, "Image URL accepted", { url: providedUrl, type });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};
