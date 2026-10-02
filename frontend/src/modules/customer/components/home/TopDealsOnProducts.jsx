import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import { customerApi } from '../../services/customerApi';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

const formatPrice = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const getItems = (response) => {
  const data = response?.data || response;
  const result = data?.result;
  return Array.isArray(data?.results) ? data.results : Array.isArray(result?.items) ? result.items : Array.isArray(result) ? result : [];
};

const TopDealsOnProducts = ({ latitude, longitude }) => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchFeaturedProducts = async () => {
      setIsLoading(true);
      try {
        const params = { featured: 'true', conditionType: 'all', limit: 100, page: 1 };
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          params.lat = latitude;
          params.lng = longitude;
        }

        const firstResponse = await customerApi.getProducts(params);
        const firstItems = getItems(firstResponse);
        if (!cancelled) setProducts(firstItems);

        const firstResult = firstResponse?.data?.result || {};
        const totalPages = Math.max(1, Number(firstResult.totalPages) || 1);
        if (totalPages > 1) {
          const remainingResponses = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, index) =>
              customerApi.getProducts({ ...params, page: index + 2 })
            )
          );
          if (!cancelled) {
            const allItems = [firstItems, ...remainingResponses.map(getItems)].flat();
            setProducts(Array.from(new Map(allItems.map((product) => [String(product._id || product.id), product])).values()));
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load featured products:', error);
          setProducts([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchFeaturedProducts();
    return () => { cancelled = true; };
  }, [latitude, longitude]);

  return (
    <section className="mx-4 mt-4 rounded-[24px] bg-[#ffd21f] px-3 py-4 shadow-[0_8px_22px_rgba(173,126,0,0.12)]" aria-label="Top Deals On Products">
      <h2 className="fk-section-heading mb-3 px-1">Top Deals On Products</h2>

      {isLoading && products.length === 0 ? (
        <div className="grid grid-cols-3 gap-2.5" aria-label="Loading featured products">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col gap-2">
              <div className="aspect-square animate-pulse rounded-[16px] bg-white/70" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-white/50" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-white/50" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="fk-body rounded-[18px] bg-white/75 px-4 py-6 text-center text-[#333]">Featured products will appear here.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {products.map((product) => {
            const id = product._id || product.id;
            const originalPrice = Number(product.price || product.variants?.[0]?.price) || 0;
            const salePrice = Number(product.salePrice || product.variants?.[0]?.salePrice) || 0;
            const hasDiscount = salePrice > 0 && originalPrice > salePrice;
            const currentPrice = hasDiscount ? salePrice : originalPrice;
            const image = product.mainImage || product.variants?.[0]?.images?.[0] || product.image;
            const isPng = typeof image === 'string' && (image.toLowerCase().endsWith('.png') || image.toLowerCase().includes('.png?') || image.toLowerCase().includes('/png'));
            const discountPercent = hasDiscount && originalPrice > 0 ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;

            return (
              <Link
                key={id}
                to={`/product/${id}`}
                className="group flex flex-col min-w-0 transition-transform active:scale-[0.98]"
              >
                {/* Image Card Box - Full Card Cover Image with NO inner padding */}
                <div className="customer-product-clean-image relative aspect-square w-full rounded-2xl bg-[#f8f9fa] p-0 flex items-center justify-center overflow-hidden">
                  {image ? (
                    <img
                      src={applyCloudinaryTransform(image, 'f_auto,q_auto,w_300')}
                      alt={product.name}
                      loading="lazy"
                      className={`h-full w-full transition-transform duration-200 group-hover:scale-105 ${
                        isPng ? 'is-png-image object-contain p-2' : 'object-cover'
                      }`}
                    />
                  ) : (
                    <ImageOff size={28} className="text-slate-400" aria-hidden="true" />
                  )}
                </div>

                {/* Details OUTSIDE the Image Card Box: Only Product Name & Price */}
                <div className="mt-1.5 flex flex-col px-0.5 min-w-0">
                  {/* Product Name (Single line with ellipsis) */}
                  <h4 className="fk-product-title truncate text-[13px] font-semibold text-[#212121] leading-tight group-hover:text-[#2874f0]">
                    {product.name}
                  </h4>

                  {/* Price Row: Selling Price, Cut MRP (if discount), and Green % off */}
                  <div className="mt-0.5 flex items-baseline gap-1.5 flex-wrap leading-tight">
                    <span className="fk-product-price text-[13px] font-semibold text-[#212121]">
                      {formatPrice(currentPrice)}
                    </span>
                    {hasDiscount && (
                      <span className="fk-product-mrp text-[12px] text-slate-400 line-through font-normal">
                        {formatPrice(originalPrice)}
                      </span>
                    )}
                    {hasDiscount && (
                      <span className="fk-product-discount text-[12px] font-semibold text-[#388e3c]">
                        {discountPercent}% off
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default TopDealsOnProducts;
