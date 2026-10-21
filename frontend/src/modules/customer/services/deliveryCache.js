// Cache for category delivery modes configured by Admin in Admin Panel
export const categoryDeliveryModeCache = new Map();

/**
 * Register deliveryMode for categories/headers fetched from backend
 */
export function registerCategoryDeliveryMode(categoryIdOrSlug, deliveryMode) {
  if (!categoryIdOrSlug || !deliveryMode) return;
  categoryDeliveryModeCache.set(String(categoryIdOrSlug).toLowerCase(), deliveryMode);
}

export function registerCategoriesDeliveryModes(categories) {
  if (!Array.isArray(categories)) return;
  for (const cat of categories) {
    if (!cat) continue;
    const mode =
      cat.deliveryMode === "quick_only" || cat.deliveryMode === "both"
        ? cat.deliveryMode
        : null;
    if (mode) {
      if (cat._id) categoryDeliveryModeCache.set(String(cat._id).toLowerCase(), mode);
      if (cat.id) categoryDeliveryModeCache.set(String(cat.id).toLowerCase(), mode);
      if (cat.slug) categoryDeliveryModeCache.set(String(cat.slug).toLowerCase(), mode);
    }
    if (Array.isArray(cat.children)) {
      registerCategoriesDeliveryModes(cat.children);
    }
  }
}
