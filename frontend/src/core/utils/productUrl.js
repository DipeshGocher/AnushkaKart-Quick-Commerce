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
