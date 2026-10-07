import React, { useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';

const RESERVED_MODULE_SLUGS = new Set(['admin', 'seller', 'delivery', 'unauthorized', 'marketplace']);

/**
 * ProductDetailPage
 * Unified bridge component: redirects any direct product URL to the single unified ProductDetailSheet.
 */
const ProductDetailPage = () => {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const headerSlug = String(params.headerSlug || '').toLowerCase();
  const productId = searchParams.get('id') || params.id || params.productSlug;

  useEffect(() => {
    if (headerSlug && RESERVED_MODULE_SLUGS.has(headerSlug)) {
      navigate(`/${headerSlug}`, { replace: true });
      return;
    }

    if (productId) {
      // Redirect with ?product query param which automatically triggers ProductDetailSheet globally
      navigate(`/?product=${encodeURIComponent(productId)}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [headerSlug, productId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default ProductDetailPage;
