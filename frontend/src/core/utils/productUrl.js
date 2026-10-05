/**
 * Production-ready SEO & Category-hierarchy URL generator for products.
 * Generates hierarchical URLs like:
 * /grocery/dairy-and-breads/eggs/fresh-farm-egg?id=65a123...
 * or /grocery/dairy-and-breads/fresh-farm-egg?id=65a123...
 */

export function slugify(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/&+/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getProductUrl(product) {
  if (!product) return '/products';

  const id = product._id || product.id || '';

  // 1. Header category slug
  const headerSlug =
    slugify(product.headerId?.slug || product.headerId?.name || product.headerSlug || product.headerName) ||
    slugify(product.catalogType === 'refurbished' ? 'refurbished' : 'grocery');

  // 2. Main category slug
  const categorySlug =
    slugify(
      product.categoryId?.slug ||
      product.categoryId?.name ||
      product.categorySlug ||
      product.categoryName ||
      (typeof product.category === 'string' ? product.category : '')
    );

  // 3. Sub category slug (if any)
  const subCategorySlug =
    slugify(
      product.subcategoryId?.slug ||
      product.subcategoryId?.name ||
      product.subcategorySlug ||
      product.subcategoryName ||
      (typeof product.subCategory === 'string' ? product.subCategory : '')
    );

  // 4. Product item slug
  const productSlug = slugify(product.slug || product.name || 'product');

  const segments = [headerSlug];

  if (categorySlug && categorySlug !== headerSlug) {
    segments.push(categorySlug);
  }

  if (subCategorySlug && subCategorySlug !== categorySlug && subCategorySlug !== headerSlug) {
    segments.push(subCategorySlug);
  }

  segments.push(productSlug);

  const basePath = '/' + segments.join('/');
  return id ? `${basePath}?id=${encodeURIComponent(id)}` : basePath;
}

/**
 * Standard product variant label extractor across all pages:
 * (e.g. 1kg, 128 GB, 500GM, 1 Piece, 1 combo, 1 pack, etc.)
 */
export function getProductVariantText(product) {
  if (!product) return "1 unit";

  // 1. Check first variant name if non-generic
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const firstVariant = variants[0];
  const variantName = String(firstVariant?.name || product.variantName || "").trim();

  if (
    variantName &&
    !/^default$/i.test(variantName) &&
    !/^standard$/i.test(variantName) &&
    !/^normal$/i.test(variantName) &&
    !/^none$/i.test(variantName)
  ) {
    return variantName;
  }

  // 2. Check weight field (e.g., "1kg", "500gm", "100g")
  const weight = String(product.weight || "").trim();
  if (weight && !/^1\s*unit$/i.test(weight)) {
    return weight;
  }

  // 3. Check unit field (e.g., "piece", "combo", "kg", "pack")
  const unit = String(product.unit || "").trim();
  if (unit) {
    return /^\d+/i.test(unit) ? unit : `1 ${unit}`;
  }

  // 4. Fallback to weight if present or "1 unit"
  if (weight) {
    return weight;
  }

  return "1 unit";
}

/**
 * Standard price info extractor across all pages:
 * - currentPrice (selling price)
 * - originalPrice (MRP)
 * - hasDiscount (true only if originalPrice > currentPrice > 0)
 * - discountPercent
 */
export function getProductPriceInfo(product) {
  if (!product) {
    return { currentPrice: 0, originalPrice: 0, hasDiscount: false, discountPercent: 0 };
  }

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const v = variants[0];
  const vSalePrice = Number(v?.salePrice || 0);
  const vPrice = Number(v?.price || 0);

  let currentPrice = Number(product.price || 0);
  let originalPrice = Number(product.originalPrice ?? product.price ?? 0);

  // If variant has active pricing
  if (vSalePrice > 0 && vPrice > vSalePrice) {
    currentPrice = vSalePrice;
    originalPrice = vPrice;
  } else if (vPrice > 0 && (!currentPrice || currentPrice === 0)) {
    currentPrice = vPrice;
    originalPrice = vPrice;
  } else if (originalPrice === 0 && currentPrice > 0) {
    originalPrice = currentPrice;
  }

  const hasDiscount = originalPrice > currentPrice && currentPrice > 0;
  const discountPercent = hasDiscount
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : 0;

  return {
    currentPrice,
    originalPrice,
    hasDiscount,
    discountPercent,
  };
}
