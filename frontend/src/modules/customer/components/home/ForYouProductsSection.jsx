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
          <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
            For You
          </h2>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/60">
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
            const targetUrl = getProductUrl(item);

            return (
              <Link
                key={id}
                to={targetUrl}
                className="group flex flex-col bg-white rounded-2xl border border-gray-100 p-2.5 hover:shadow-md transition-all active:scale-[0.98]"
              >
                {/* Off-white Image Container (matching Image 2) */}
                <div className="w-full aspect-square bg-[#f6f7f9] rounded-xl relative flex items-center justify-center p-2.5 overflow-hidden mb-2">
                  <img
                    src={applyCloudinaryTransform(item.mainImage || item.image, "f_auto,q_auto,w_400")}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Badges */}
                  {item.isFeatured && (
                    <span className="absolute top-2 left-2 bg-[#f0f0f0] text-gray-700 text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-2xs">
                      Bought Together
                    </span>
                  )}

                  {index % 3 === 0 && (
                    <span className="absolute top-2 right-2 bg-gray-200/80 text-gray-600 text-[8px] font-bold px-1 rounded">
                      AD
                    </span>
                  )}

                  {/* Rating Tag (bottom-left of image matching Image 2) */}
                  <div className="absolute bottom-1.5 left-1.5 bg-white/95 backdrop-blur-xs text-[10px] font-bold text-gray-800 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs border border-gray-100">
                    <span>4.2</span>
                    <Star size={10} className="fill-green-600 text-green-600" />
                    <span className="text-gray-400 font-normal">|</span>
                    <span className="text-gray-500 font-normal">74</span>
                  </div>
                </div>

                {/* Product Brand & Name below image */}
                <div className="flex-1 flex flex-col">
                  <p className="text-xs text-gray-800 font-medium line-clamp-2 leading-snug">
                    <span className="font-bold text-gray-900 mr-1">
                      {item.brand || "Fresh"}
                    </span>
                    {item.name}
                  </p>

                  {/* Price Row: MRP strikethrough & Selling Price */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {showMrp && (
                      <span className="text-[11px] text-gray-400 line-through">
                        ₹{originalPrice}
                      </span>
                    )}
                    <span className="text-sm font-bold text-gray-900">
                      ₹{price}
                    </span>
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
