const CLOUDINARY_REGEX = /res\.cloudinary\.com/i;
const CLOUDINARY_UPLOAD_SEGMENT_REGEX = /\/upload\/([^/]+)\//i;

/**
 * Resolves relative or localhost media URLs to current production domain automatically.
 */
export function resolveMediaUrl(url) {
  if (!url || typeof url !== "string") return url || "";
  
  // If URL contains erroneous phonepe.com/uploads/ from past uploads
  if (url.includes("phonepe.com/uploads/")) {
    const relative = url.substring(url.indexOf("/uploads/"));
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      return `http://localhost:5000${relative}`;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}${relative}`;
  }

  // If relative path: /uploads/... or uploads/...
  if (url.startsWith("/uploads/") || url.startsWith("uploads/")) {
    const cleanUrl = url.startsWith("/") ? url : `/${url}`;
    if (typeof window !== "undefined") {
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        return `http://localhost:5000${cleanUrl}`;
      }
      return `${window.location.origin}${cleanUrl}`;
    }
    return `http://localhost:5000${cleanUrl}`;
  }
  
  // If it has localhost:5000 but user is on production domain (anushkakart.in), map it to current domain
  if (url.includes("localhost:5000/uploads/") && typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {
    return url.replace(/https?:\/\/localhost:5000/i, window.location.origin);
  }
  
  return url;
}

/**
 * Standardized Cloudinary Image Presets.
 * Using stable, deterministic transform strings ensures 100% HTTP & WebView disk/memory cache reuse
 * as the user navigates between Home, Category browsers, Product Listings, Search, Cart, and Checkout.
 */
export const IMAGE_PRESETS = {
  // Small icons, avatars, subcategory circular pills (~40-60px display, 120px 2x):
  ICON: "f_auto,q_auto,w_120",
  // Square category tiles and grids (~80-120px display, 240px 2x):
  CATEGORY_TILE: "f_auto,q_auto,w_240",
  // Square category cutout with fill (greetings / round cards):
  CATEGORY_FILL: "f_auto,q_auto,w_240,h_240,c_fill",
  // Standard product card thumbnails across Home, Category Listings, Search, Cart, Checkout:
  PRODUCT_THUMB: "f_auto,q_auto,w_400",
  // Mobile product detail primary image preview & detail view (~360-420px display, 800px 2x):
  PRODUCT_DETAIL: "f_auto,q_auto,w_800",
  // High-res desktop product detail and zoom / full gallery view:
  PRODUCT_FULL: "f_auto,q_auto,w_1200",
  // Hero banners and promotional strips:
  BANNER: "f_auto,q_auto,w_1200",
};

export const PRESET_ALIASES = {
  icon: IMAGE_PRESETS.ICON,
  tile: IMAGE_PRESETS.CATEGORY_TILE,
  category: IMAGE_PRESETS.CATEGORY_TILE,
  category_fill: IMAGE_PRESETS.CATEGORY_FILL,
  thumb: IMAGE_PRESETS.PRODUCT_THUMB,
  thumbnail: IMAGE_PRESETS.PRODUCT_THUMB,
  product: IMAGE_PRESETS.PRODUCT_THUMB,
  detail: IMAGE_PRESETS.PRODUCT_DETAIL,
  full: IMAGE_PRESETS.PRODUCT_FULL,
  banner: IMAGE_PRESETS.BANNER,
};

/**
 * Appends Cloudinary optimisation transforms to a URL using standardized presets.
 * Safe to call on any URL — non-Cloudinary URLs are returned unchanged.
 */
export function applyCloudinaryTransform(rawUrl, params = IMAGE_PRESETS.PRODUCT_THUMB) {
  if (!rawUrl) return null;
  const url = resolveMediaUrl(rawUrl);
  if (!CLOUDINARY_REGEX.test(url)) return url;
  const match = url.match(CLOUDINARY_UPLOAD_SEGMENT_REGEX);
  if (!match) return url;

  // Resolve preset alias if passed (e.g. 'thumb', 'detail', 'icon', etc.)
  const resolvedParams = PRESET_ALIASES[params] || params || IMAGE_PRESETS.PRODUCT_THUMB;

  const segmentAfterUpload = match[1] || "";
  const alreadyHasTransforms =
    segmentAfterUpload.includes(",") ||
    /^[a-z]{1,4}_[^/]+$/i.test(segmentAfterUpload);

  if (alreadyHasTransforms) return url;

  // Insert transform before the segment after `/upload/` (often `v123...`).
  return url.replace(CLOUDINARY_UPLOAD_SEGMENT_REGEX, `/upload/${resolvedParams}/$1/`);
}

export function getProductThumbnailUrl(rawUrl) {
  return applyCloudinaryTransform(rawUrl, IMAGE_PRESETS.PRODUCT_THUMB);
}

export function getProductDetailImageUrl(rawUrl) {
  return applyCloudinaryTransform(rawUrl, IMAGE_PRESETS.PRODUCT_DETAIL);
}

export function getProductFullImageUrl(rawUrl) {
  return applyCloudinaryTransform(rawUrl, IMAGE_PRESETS.PRODUCT_FULL);
}

export function getCategoryTileUrl(rawUrl) {
  return applyCloudinaryTransform(rawUrl, IMAGE_PRESETS.CATEGORY_TILE);
}

export function getCategoryIconUrl(rawUrl) {
  return applyCloudinaryTransform(rawUrl, IMAGE_PRESETS.ICON);
}

export function getBannerImageUrl(rawUrl) {
  return applyCloudinaryTransform(rawUrl, IMAGE_PRESETS.BANNER);
}

export function isCloudinaryUrl(url) {
  return !!url && CLOUDINARY_REGEX.test(url);
}

export function buildCloudinarySrcSet(
  url,
  entries,
  baseParams = "f_auto,q_auto,c_fill,g_auto",
) {
  if (!isCloudinaryUrl(url) || !Array.isArray(entries) || entries.length === 0)
    return undefined;

  return entries
    .map(({ w, h }) => {
      const params = [
        baseParams,
        typeof w === "number" ? `w_${w}` : null,
        typeof h === "number" ? `h_${h}` : null,
      ]
        .filter(Boolean)
        .join(",");

      const href = applyCloudinaryTransform(url, params) || url;
      const descriptor = typeof w === "number" ? `${w}w` : "";
      return descriptor ? `${href} ${descriptor}` : href;
    })
    .join(", ");
}

/**
 * Checks whether an image is in PNG format (transparent/cutout).
 */
export function isPngImage(url) {
  if (!url || typeof url !== "string") return false;
  const clean = url.split("?")[0].toLowerCase();
  return clean.endsWith(".png") || clean.includes(".png") || clean.includes("/png");
}
