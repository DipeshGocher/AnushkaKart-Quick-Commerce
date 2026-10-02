import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Star, Loader2 } from "lucide-react";
import { customerApi } from "../../services/customerApi";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { getProductUrl } from "@/core/utils/productUrl";

// Helper to shuffle / interleave products across categories for a diverse "For You" feed
const shuffleArray = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const ForYouProductsSection = () => {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const sentinelRef = useRef(null);
  const seenIdsRef = useRef(new Set());

  // Fetch page of products
  const fetchProducts = useCallback(async (pageNum, isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const res = await customerApi.getProducts({
        allProducts: "true",
        page: pageNum,
        limit: 20,
      });

      const data = res.data?.result || res.data || {};
      const newItems = data.items || data.results || (Array.isArray(data) ? data : []);
      const pages = Number(data.totalPages) || 1;
      setTotalPages(pages);

      // Deduplicate products
      const uniqueNew = [];
      newItems.forEach((item) => {
        const id = String(item._id || item.id);
        if (id && !seenIdsRef.current.has(id)) {
          seenIdsRef.current.add(id);
          uniqueNew.push(item);
        }
      });

      // Randomly interleave newly fetched items for a dynamic "For You" experience
      const mixedNew = isInitial ? shuffleArray(uniqueNew) : uniqueNew;

      setProducts((prev) => (isInitial ? mixedNew : [...prev, ...mixedNew]));
      setHasMore(pageNum < pages && newItems.length > 0);
    } catch (err) {
      console.error("Failed to load 'For You' products:", err);
      setHasMore(false);
    } finally {
      if (isInitial) setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    seenIdsRef.current.clear();
    setPage(1);
    fetchProducts(1, true);
  }, [fetchProducts]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || isLoading || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          setPage((prevPage) => {
            const nextPage = prevPage + 1;
            fetchProducts(nextPage, false);
            return nextPage;
          });
        }
      },
      {
        rootMargin: "350px", // Trigger before reaching exact bottom for smooth continuous scrolling
      }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, fetchProducts]);

  return (
    <section className="w-full mt-3 mb-2">
      {/* Flipkart-style stylish separator band */}
      <div className="w-full h-2.5 bg-[#f1f3f6] border-y border-slate-200/80 mb-4" />

      {/* Heading: For You with Flipkart-style accent */}
      <div className="px-3.5 md:px-6 mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-5 bg-[#2874f0] rounded-full" />
          <h2 className="fk-section-heading">
            For You
          </h2>
        </div>
        <span className="fk-small-label bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/60">
          Suggested
        </span>
      </div>

      {/* Initial Loading Skeleton */}
      {isLoading && products.length === 0 && (
        <div className="grid grid-cols-2 gap-3 px-3.5 md:px-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-2.5 animate-pulse">
              <div className="w-full aspect-square bg-gray-100 rounded-xl mb-2" />
              <div className="h-3 w-3/4 bg-gray-100 rounded mb-1.5" />
              <div className="h-3 w-1/2 bg-gray-100 rounded mb-2" />
              <div className="h-4 w-1/3 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* 2 Products per row grid matching Image 2 */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 gap-3 px-3.5 md:px-6">
          {products.map((item, index) => {
            const id = item._id || item.id;
            const price = Number(item.salePrice || item.price || 0);
            const originalPrice = Number(item.price || item.originalPrice || 0);
            const showMrp = originalPrice > price;
            const discountPercent = showMrp && originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
            const targetUrl = getProductUrl(item);

            const imageSrc = item.mainImage || item.image || "";
            const isPng = typeof imageSrc === 'string' && (imageSrc.toLowerCase().endsWith('.png') || imageSrc.toLowerCase().includes('.png?') || imageSrc.toLowerCase().includes('/png'));

            return (
              <Link
                key={id}
                to={targetUrl}
                className="group flex flex-col transition-transform active:scale-[0.98] min-w-0"
              >
                {/* Full Cover Image Container - NO nested div look */}
                <div className="customer-product-clean-image w-full aspect-square bg-[#f8f9fa] rounded-2xl relative flex items-center justify-center p-0 overflow-hidden">
                  <img
                    src={applyCloudinaryTransform(imageSrc, "f_auto,q_auto,w_400")}
                    alt={item.name}
                    className={`h-full w-full group-hover:scale-105 transition-transform duration-300 ${
                      isPng ? 'is-png-image object-contain p-2' : 'object-cover'
                    }`}
                    loading="lazy"
                  />
                </div>

                {/* Product Name & Price below image */}
                <div className="flex-1 flex flex-col min-w-0 mt-1.5 px-0.5">
                  <h4 className="fk-product-title truncate text-[13px] font-semibold text-[#212121] leading-tight">
                    {item.name}
                  </h4>

                  {/* Price Row: Selling Price, Cut MRP (if discount), and Green % off */}
                  <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap leading-tight">
                    <span className="fk-product-price text-[13px] font-semibold text-[#212121]">
                      ₹{price}
                    </span>
                    {showMrp && (
                      <span className="fk-product-mrp text-[12px] text-slate-400 line-through font-normal">
                        ₹{originalPrice}
                      </span>
                    )}
                    {showMrp && (
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

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-6 w-full flex items-center justify-center my-3">
        {isLoadingMore && (
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
            <Loader2 size={16} className="animate-spin text-primary" />
            <span>Loading more products...</span>
          </div>
        )}
      </div>
    </section>
  );
};

export default ForYouProductsSection;
