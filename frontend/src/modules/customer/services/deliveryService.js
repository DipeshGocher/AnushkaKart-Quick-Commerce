import { customerApi } from "./customerApi";

let cachedLocalPincodes = new Set(["284204", "284205"]);
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
      if (Array.isArray(list) && list.length > 0) {
        cachedLocalPincodes = new Set(list.map((p) => String(p).trim()));
      }
      isPincodesLoaded = true;
      return cachedLocalPincodes;
    })
    .catch((err) => {
      console.warn("[deliveryService] Failed to load local pincodes, using fallback:", err.message);
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

/**
 * Resolves whether a product is "quick_only" or "both" based on product override,
 * category setting, or perishable heuristics.
 */
export function resolveProductDeliveryMode(product) {
  if (!product) return "both";

  const pMode = product.deliveryMode;
  if (pMode === "quick_only" || pMode === "both") {
    return pMode;
  }

  // Check populated category / header
  const cat = product.categoryId || product.headerId;
  if (cat && typeof cat === "object") {
    if (cat.deliveryMode === "quick_only" || cat.deliveryMode === "both") {
      return cat.deliveryMode;
    }
  }

  // Perishable keywords heuristic fallback
  const textToCheck = `${product.name || ""} ${product.brand || ""} ${cat?.name || ""}`.toLowerCase();
  const perishableKeywords = [
    "milk", "doodh", "paneer", "dahi", "curd", "vegetable", "sabzi",
    "fruits", "bread", "dairy", "butter", "egg", "meat", "chicken"
  ];
  const isPerishable = perishableKeywords.some((kw) => textToCheck.includes(kw));
  if (isPerishable) {
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

  // Default seller origin to primary local hub if missing
  const sellerPincode = String(
    product?.sellerId?.pincode || product?.warehouseId?.pincode || "284204"
  ).trim();
  const isSellerLocal = isPincodeLocalSync(sellerPincode);

  const deliveryMode = resolveProductDeliveryMode(product);

  // 1. QUICK_ONLY (Fresh / Perishables: Milk, Sabzi, Dairy)
  if (deliveryMode === "quick_only") {
    if (!cleanCustomerPincode) {
      return {
        isDeliverable: true,
        canAddToCart: true,
        deliveryMode: "quick_only",
        fulfillmentType: "LOCAL_RIDERS",
        badge: "⚡ 12-15 Mins",
        deliveryEstimate: "12-15 mins",
        isCustomerLocal: false,
        warning: null,
      };
    }

    if (isCustomerLocal && isSellerLocal) {
      return {
        isDeliverable: true,
        canAddToCart: true,
        deliveryMode: "quick_only",
        fulfillmentType: "LOCAL_RIDERS",
        badge: "⚡ 12-15 Mins",
        deliveryEstimate: "12-15 mins",
        isCustomerLocal: true,
        warning: null,
      };
    }

    if (!isSellerLocal && isCustomerLocal) {
      return {
        isDeliverable: false,
        canAddToCart: false,
        deliveryMode: "quick_only",
        fulfillmentType: null,
        badge: "Not Deliverable",
        deliveryEstimate: null,
        isCustomerLocal: true,
        warning: "Seller is outside the local zone; fresh items cannot be shipped from outside.",
      };
    }

    // Customer is outside local pincode (e.g. Indore 452018)
    return {
      isDeliverable: false,
      canAddToCart: false,
      deliveryMode: "quick_only",
      fulfillmentType: null,
      badge: `Quick Delivery not available at ${cleanCustomerPincode}`,
      deliveryEstimate: null,
      isCustomerLocal: false,
      warning: `Quick Delivery not available at ${cleanCustomerPincode}. This item is only delivered in local areas.`,
    };
  }

  // 2. BOTH / HYBRID (Clothes, Electronics, Packed FMCG)
  if (isCustomerLocal && isSellerLocal) {
    return {
      isDeliverable: true,
      canAddToCart: true,
      deliveryMode: "both",
      fulfillmentType: "LOCAL_RIDERS",
      badge: "⚡ 12-15 Mins",
      deliveryEstimate: "12-15 mins",
      isCustomerLocal: true,
      warning: null,
    };
  }

  // Delivered via Shiprocket
  return {
    isDeliverable: true,
    canAddToCart: true,
    deliveryMode: "both",
    fulfillmentType: "SHIPROCKET",
    badge: "📦 Standard (3-4 Days)",
    deliveryEstimate: "3-4 business days",
    isCustomerLocal: isCustomerLocal,
    warning: null,
  };
}
