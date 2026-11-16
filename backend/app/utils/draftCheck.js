/**
 * A product is a DRAFT (hidden from customers) until it has a photo and a parcel size
 * (weight + length + width + height). Bulk upload creates drafts when these are missing.
 * Reasons are stored in product.draftReasons: "photo" and/or "parcel".
 */
import { parcelProblems } from "./parcelCheck.js";

export const DRAFT_REASONS = Object.freeze(["photo", "parcel"]);

const hasText = (v) => typeof v === "string" && v.trim().length > 0;

export function hasPhoto(product) {
  if (hasText(product?.mainImage)) return true;
  if (Array.isArray(product?.galleryImages) && product.galleryImages.some(hasText)) return true;
  return (product?.variants || []).some((v) => Array.isArray(v?.images) && v.images.some(hasText));
}

export function hasParcelSize(product) {
  const p = parcelProblems(product);
  return !p.weight && !p.size;
}

/** ["photo"], ["parcel"], both, or [] when the product is complete. */
export function computeDraftReasons(product) {
  const reasons = [];
  if (!hasPhoto(product)) reasons.push("photo");
  if (!hasParcelSize(product)) reasons.push("parcel");
  return reasons;
}

export const DRAFT_LABELS = Object.freeze({
  photo: "Photo needed",
  parcel: "Parcel size needed",
});

/** Message when a seller tries to publish a draft that is still incomplete. */
export function publishBlockedMessage(reasons = []) {
  const parts = reasons.map((r) => (r === "photo" ? "a product photo" : "the parcel weight and box size"));
  return `Add ${parts.join(" and ")} before publishing this product.`;
}
