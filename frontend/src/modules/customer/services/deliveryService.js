import { customerApi } from "./customerApi";

let cachedLocalPincodes = new Set();
let isPincodesLoaded = false;
let fetchPromise = null;

/**
 * Loads the active local pincodes from the server once and caches them in memory.
 */
export async function loadLocalPincodes() {
  if (isPincodesLoaded) return cachedLocalPincodes;
  if (fetchPromise) return fetchPromise;

  fetchPromise = customerApi
    .getLocalPincodes()
    .then((res) => {
      const list = res?.data?.result?.localPincodes;
      if (Array.isArray(list)) {
        cachedLocalPincodes = new Set(list.map((p) => String(p).trim()));
      }
      isPincodesLoaded = true;
      return cachedLocalPincodes;
    })
    .catch((err) => {
      console.warn("[deliveryService] Failed to load local pincodes:", err.message);
      return cachedLocalPincodes;
    })
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}

// Eagerly trigger pre-fetch in background
if (typeof window !== "undefined") {
  loadLocalPincodes();
}

/**
 * Synchronously checks if a pincode is in the local delivery zone.
 */
export function isPincodeLocalSync(pincode) {
  if (!pincode) return false;
  const clean = String(pincode).trim();
  return cachedLocalPincodes.has(clean);
}

export {
  categoryDeliveryModeCache,
  registerCategoryDeliveryMode,
  registerCategoriesDeliveryModes,
} from "./deliveryCache";
import { categoryDeliveryModeCache } from "./deliveryCache";

/**
 * Resolves whether a product is "quick_only" or "both" based on product override,
 * category setting set by admin, or perishable heuristics.
 */
export function resolveProductDeliveryMode(product) {
  if (!product) return "both";

  // 1. Explicit product override takes precedence
  const pMode = product.deliveryMode;
  if (pMode === "quick_only" || pMode === "both") {
    return pMode;
  }

  // 2. Check candidate category / header / subcategory objects
  const candidateObjects = [
    product.headerId,
    product.header,
    product.headerCategory,
    product.categoryId,
    product.category,
    product.subcategoryId,
    product.subcategory,
  ];
  for (const cat of candidateObjects) {
    if (cat && typeof cat === "object") {
      if (cat.deliveryMode === "quick_only" || cat.deliveryMode === "both") {
        return cat.deliveryMode;
      }
    }
  }

  // 3. Check candidate IDs against category deliveryMode cache (populated from admin config)
  const candidateIds = [
    product.headerId?._id || product.headerId,
    product.categoryId?._id || product.categoryId,
    product.subcategoryId?._id || product.subcategoryId,
    product.header?._id || product.header?.id,
  ];
  for (const id of candidateIds) {
    if (id && (typeof id === "string" || typeof id === "number")) {
      const cached = categoryDeliveryModeCache.get(String(id).toLowerCase());
      if (cached === "quick_only" || cached === "both") {
        return cached;
      }
    }
  }

  // 4. Check active URL or query parameter (e.g. browsing /products?header=Grocery or /products?category=...)
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      const headerParam = (params.get("header") || "").toLowerCase();
      const catParam = (params.get("category") || "").toLowerCase();
      const path = (window.location.pathname || "").toLowerCase();
      if (
        headerParam.includes("grocery") ||
        headerParam.includes("kirana") ||
        headerParam.includes("fresh") ||
        catParam.includes("grocery") ||
        catParam.includes("kirana") ||
        path.includes("grocery")
      ) {
        return "quick_only";
      }
    } catch (_) {}
  }

  // 5. Check category slug and name for grocery
  for (const cat of candidateObjects) {
    if (cat && typeof cat === "object") {
      const slug = String(cat.slug || "").toLowerCase();
      const name = String(cat.name || "").toLowerCase();
      if (
        slug === "grocery" || slug === "kirana" || slug === "fresh" ||
        name.includes("grocery") || name.includes("kirana") || name.includes("fresh")
      ) {
        return "quick_only";
      }
    }
  }

  // 6. Check product and category text
  const textToCheck = [
    product.name,
    product.brand,
    product.headerId?.name,
    product.headerId?.slug,
    product.categoryId?.name,
    product.categoryId?.slug,
    product.subcategoryId?.name,
    typeof product.headerId === "string" ? product.headerId : "",
    typeof product.category === "string" ? product.category : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const perishableKeywords = [
    "grocery", "kirana", "milk", "doodh", "paneer", "dahi", "curd", "vegetable", "sabzi",
    "fruits", "bread", "dairy", "butter", "egg", "meat", "chicken", "oil", "flour", "atta",
    "rice", "dal", "sugar", "salt", "masala", "spices", "tea", "chai", "coffee", "biscuit",
    "namkeen", "snack"
  ];
  if (perishableKeywords.some((kw) => textToCheck.includes(kw))) {
    return "quick_only";
  }

  return "both";
}

/**
 * Evaluates delivery eligibility for a product and customer pincode.
 *
 * @param {Object} product
 * @param {string|number} customerPincode
 * @returns {Object} evaluation
 */
export function evaluateProductDelivery(product, customerPincode) {
  const cleanCustomerPincode = customerPincode ? String(customerPincode).trim() : "";
  const isCustomerLocal = Boolean(cleanCustomerPincode && isPincodeLocalSync(cleanCustomerPincode));

  // Determine seller origin pincode
  const sellerPincode = String(
    product?.sellerId?.pincode || product?.warehouseId?.pincode || ""
  ).trim();
  const isSellerLocal = Boolean(sellerPincode && isPincodeLocalSync(sellerPincode));

  const deliveryMode = resolveProductDeliveryMode(product);

  const createBadge = (type, label) => ({
    type,
    label,
    toString() {
      return label;
    },
  });

  // ── Mode 1: Quick Delivery Only ──
  if (deliveryMode === "quick_only") {
    // If BOTH customer and seller are within local delivery pincodes
    if (isCustomerLocal && isSellerLocal) {
      return {
        isDeliverable: true,
        canAddToCart: true,
        deliveryMode: "quick_only",
        fulfillmentType: "LOCAL_RIDERS",
        badge: null,
        deliveryEstimate: "15-20 mins",
        isCustomerLocal: true,
        isSellerLocal: true,
        warning: null,
      };
    }

    // Customer has not selected or entered a pincode yet
    if (!cleanCustomerPincode) {
      return {
        isDeliverable: false,
        canAddToCart: false,
        deliveryMode: "quick_only",
        fulfillmentType: null,
        badge: null,
        deliveryEstimate: null,
        isCustomerLocal: false,
        isSellerLocal,
        warning: "Please select a delivery location to check availability",
      };
    }

    // Customer is outside local delivery zone
    if (!isCustomerLocal) {
      return {
        isDeliverable: false,
        canAddToCart: false,
        deliveryMode: "quick_only",
        fulfillmentType: null,
        badge: createBadge("unserviceable", "❌ OUT OF ZONE"),
        deliveryEstimate: null,
        isCustomerLocal: false,
        isSellerLocal,
        warning: `Quick delivery is not available at pincode ${cleanCustomerPincode}. Fresh grocery items are only delivered in local areas.`,
      };
    }

    // Customer is local, but seller is outside local delivery zone (e.g., Indore)
    return {
      isDeliverable: false,
      canAddToCart: false,
      deliveryMode: "quick_only",
      fulfillmentType: null,
      badge: createBadge("unserviceable", "❌ OUT OF ZONE"),
      deliveryEstimate: null,
      isCustomerLocal: true,
      isSellerLocal: false,
      warning: "This grocery item is stocked outside the local delivery zone and cannot be delivered.",
    };
  }

  // ── Mode 2: Both (Local 15-min riders if both local, else Shiprocket 3-4 days courier) ──
  if (isCustomerLocal && isSellerLocal) {
    return {
      isDeliverable: true,
      canAddToCart: true,
      deliveryMode: "both",
      fulfillmentType: "LOCAL_RIDERS",
      badge: null,
      deliveryEstimate: "15-20 mins",
      isCustomerLocal: true,
      isSellerLocal: true,
      warning: null,
    };
  }

  // Fallback to Pan-India Shiprocket courier (No badge on product cards as requested)
  return {
    isDeliverable: true,
    canAddToCart: true,
    deliveryMode: "both",
    fulfillmentType: "SHIPROCKET",
    badge: null,
    deliveryEstimate: "3-4 business days",
    isCustomerLocal,
    isSellerLocal,
    warning: null,
  };
}

/**
 * Adds business days (skipping Sundays) to a given base date.
 * E.g., if today is Sunday 25 Oct, adding 4 business days skips Sunday:
 * Mon (1), Tue (2), Wed (3), Thu (4) -> Thu, 29 Oct.
 *
 * @param {Date|string|number} [startDate=new Date()]
 * @param {number} [businessDays=4]
 * @returns {Date}
 */
export function addBusinessDays(startDate = new Date(), businessDays = 4) {
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  let added = 0;
  while (added < businessDays) {
    date.setDate(date.getDate() + 1);
    // 0 is Sunday - skip it
    if (date.getDay() !== 0) {
      added++;
    }
  }
  return date;
}

/**
 * Formats a Date object into a readable string like "Thu, 29 Oct".
 *
 * @param {Date|string|number} date
 * @returns {string} e.g. "Thu, 29 Oct"
 */
export function formatDeliveryDate(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayName = days[d.getDay()];
  const dayNum = d.getDate();
  const monthName = months[d.getMonth()];
  return `${dayName}, ${dayNum} ${monthName}`;
}

/**
 * Returns dynamic calendar date for courier delivery fallback (Option 1).
 * E.g. "Thu, 29 Oct"
 *
 * @param {Date|string|number} [baseDate=new Date()]
 * @param {number} [businessDays=4]
 * @returns {string} e.g. "Thu, 29 Oct"
 */
export function getCourierDeliveryDateText(baseDate = new Date(), businessDays = 4) {
  const targetDate = addBusinessDays(baseDate, businessDays);
  return formatDeliveryDate(targetDate);
}

/**
 * Resolves the delivery estimation for an individual item during checkout or order tracking.
 * - For Quick Commerce (Local): returns "20-25 mins" (or raw mins) with isQuick=true.
 * - For Courier (Shiprocket): calculates dynamic business calendar date (e.g. "Thu, 29 Oct") with isQuick=false.
 *
 * @param {Object} item - cart or order item
 * @param {Object} [options]
 * @param {Object} [options.itemDecision] - result from useDeliveryDecision getItem(item)
 * @param {Object} [options.previewItem] - matching item from pricingPreview
 * @param {string} [options.destinationPincode] - customer destination pincode
 * @param {string} [options.defaultFulfillment] - fallback fulfillment ("LOCAL" or "SHIPROCKET")
 * @param {Date|string|number} [options.baseDate] - base date to calculate from (defaults to now)
 * @returns {Object} { isQuick, fulfillmentType, estimateText, badgeText, fullText }
 */
export function resolveItemDeliveryInfo(item, {
  itemDecision = null,
  previewItem = null,
  destinationPincode = "",
  defaultFulfillment = "LOCAL",
  baseDate = new Date(),
} = {}) {
  // Determine effective fulfillment type
  const fulfillmentType =
    item?.fulfillmentType ||
    itemDecision?.fulfillmentType ||
    previewItem?.itemFulfillmentType ||
    (destinationPincode ? evaluateProductDelivery(item, destinationPincode)?.fulfillmentType : null) ||
    defaultFulfillment;

  const isQuick =
    fulfillmentType === "LOCAL" ||
    fulfillmentType === "LOCAL_RIDERS" ||
    fulfillmentType === "quick_only";

  if (isQuick) {
    const rawEstimate =
      itemDecision?.deliveryEstimate ||
      previewItem?.itemDeliveryEstimate ||
      (destinationPincode ? evaluateProductDelivery(item, destinationPincode)?.deliveryEstimate : null) ||
      "20-25 mins";

    let estimateText = "20-25 mins";
    if (
      typeof rawEstimate === "string" &&
      (rawEstimate.toLowerCase().includes("min") || rawEstimate.toLowerCase().includes("m"))
    ) {
      estimateText = rawEstimate;
    }

    return {
      isQuick: true,
      fulfillmentType: "LOCAL_RIDERS",
      estimateText,
      badgeText: "Quick Commerce",
      fullText: `Delivery in ${estimateText}`,
    };
  }

  // Courier / Shiprocket
  let courierDate = "";
  if (itemDecision?.etd || previewItem?.etd) {
    courierDate = itemDecision?.etd || previewItem?.etd;
  }

  if (!courierDate) {
    courierDate = getCourierDeliveryDateText(baseDate, 4);
  }

  return {
    isQuick: false,
    fulfillmentType: "SHIPROCKET",
    estimateText: courierDate,
    badgeText: "Standard Courier",
    fullText: `Delivery by ${courierDate}`,
  };
}

