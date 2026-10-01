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
      <h2 className="mb-3 px-1 text-[20px] font-bold leading-tight tracking-tight text-[#1d1d1d]">Top Deals On Products</h2>

      {isLoading && products.length === 0 ? (
        <div className="grid grid-cols-2 gap-3" aria-label="Loading featured products">
          {[0, 1].map((index) => <div key={index} className="h-56 animate-pulse rounded-[18px] bg-white/70" />)}
        </div>
      ) : products.length === 0 ? (
        <p className="rounded-[18px] bg-white/75 px-4 py-6 text-center text-sm font-medium text-[#333]">Featured products will appear here.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((product) => {
            const id = product._id || product.id;
            const originalPrice = Number(product.price || product.variants?.[0]?.price) || 0;
            const salePrice = Number(product.salePrice || product.variants?.[0]?.salePrice) || 0;
            const hasDiscount = salePrice > 0 && originalPrice > salePrice;
            const currentPrice = hasDiscount ? salePrice : originalPrice;
            const image = product.mainImage || product.variants?.[0]?.images?.[0] || product.image;

            return (
              <Link key={id} to={`/product/${id}`} className="min-w-0 rounded-[18px] bg-white p-2.5 shadow-[0_3px_12px_rgba(91,66,0,0.1)] transition-transform active:scale-[0.98]">
                <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-[13px] bg-[#f5f7fb]">
                  {image ? (
                    <img src={applyCloudinaryTransform(image, 'f_auto,q_auto,w_400')} alt={product.name} loading="lazy" className="h-full w-full object-contain" />
                  ) : (
                    <ImageOff size={32} className="text-slate-400" aria-hidden="true" />
                  )}
                </span>
                <span className="mt-1.5 block truncate text-[13px] font-medium leading-tight text-slate-900">{product.name}</span>
                <span className="mt-0.5 flex items-center gap-1.5 leading-none">
                  {hasDiscount && <span className="text-[11px] sm:text-[12px] text-slate-400 line-through font-normal">{formatPrice(originalPrice)}</span>}
                  <span className="text-[13px] sm:text-[14px] font-bold text-slate-900">{formatPrice(currentPrice)}</span>
                  {hasDiscount && <span className="text-[11px] sm:text-[12px] font-bold text-[#16a34a]">{Math.round((1 - salePrice / originalPrice) * 100)}% OFF</span>}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default TopDealsOnProducts;
