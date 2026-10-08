import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { customerApi } from "../../services/customerApi";
import { useProductDetail } from "../../context/ProductDetailContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { cn } from "@/lib/utils";
import { getProductUrl, getProductVariantText, getProductPriceInfo } from "@/core/utils/productUrl";
import forYouIconImg from "@/assets/for_you_flipkart_icon.png";
import CategoryIcon from "@shared/components/CategoryIcon";
import ProductCard from "../shared/ProductCard";
import { useTranslation } from "@core/context/LanguageContext";
import { useDynamicTranslation } from "@/core/hooks/useDynamicTranslation";

// Helper to shuffle / interleave products across categories for a diverse "For You" feed
const shuffleArray = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const truncateCategoryName = (name, maxLength = 12) => {
  if (!name || typeof name !== "string") return "";
  const trimmed = name.trim();
  if (trimmed.length > maxLength) {
    const lower = trimmed.toLowerCase();
    const limit = lower.startsWith("home appli") ? 10 : maxLength - 1;
    return trimmed.slice(0, limit).trimEnd() + "...";
  }
  return trimmed;
};



const ForYouProductsSection = ({ categories: propCategories, latitude, longitude }) => {
  const { openProduct } = useProductDetail();
  const { language } = useTranslation();
  const { translateObject } = useDynamicTranslation();

  const [headerCategories, setHeaderCategories] = useState([]);
  const [displayHeaders, setDisplayHeaders] = useState([]);
  const [activeTab, setActiveTab] = useState("for_you");

  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const sentinelRef = useRef(null);
  const seenIdsRef = useRef(new Set());
  const tabsContainerRef = useRef(null);

  // Sync header categories from prop or fetch dynamically from database
  useEffect(() => {
    let isMounted = true;

    if (Array.isArray(propCategories) && propCategories.length > 0) {
      const headers = propCategories
        .filter(
          (c) =>
            (c.type === "header" || !c.type) &&
            c.slug?.toLowerCase() !== "all" &&
            c.name?.toLowerCase() !== "all" &&
            c.id !== "all" &&
            c._id !== "all"
        )
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      if (headers.length > 0) {
        setHeaderCategories(headers);
        setDisplayHeaders(headers);
        return;
      }
    }

    const fetchHeaders = async () => {
      try {
        const res = await customerApi.getCategories();
        if (res.data?.success) {
          const raw = res.data.results || res.data.result || [];
          const headers = raw
            .filter(
              (c) =>
                c.type === "header" &&
                c.slug?.toLowerCase() !== "all" &&
                c.name?.toLowerCase() !== "all" &&
                c.id !== "all" &&
                c._id !== "all"
            )
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

          if (isMounted) {
            setHeaderCategories(headers);
            setDisplayHeaders(headers);
          }
        }
      } catch (err) {
        console.error("Failed to load header categories in For You section:", err);
      }
    };

    fetchHeaders();
    return () => {
      isMounted = false;
    };
  }, [propCategories]);

  // If currently active category was deleted from database, fallback gracefully to "for_you"
  useEffect(() => {
    if (activeTab !== "for_you") {
      const exists = headerCategories.some(
        (c) => String(c._id || c.id) === String(activeTab)
      );
      if (!exists && headerCategories.length > 0) {
        setActiveTab("for_you");
      }
    }
  }, [headerCategories, activeTab]);

  // Translate header categories dynamically
  useEffect(() => {
    if (language === "en" || headerCategories.length === 0) {
      setDisplayHeaders(headerCategories);
      return;
    }

    let isMounted = true;
    const translateHeaders = async () => {
      try {
        const translated = await translateObject(headerCategories, ["name"]);
        if (isMounted) {
          setDisplayHeaders(translated);
        }
      } catch (err) {
        if (isMounted) setDisplayHeaders(headerCategories);
      }
    };

    translateHeaders();
    return () => {
      isMounted = false;
    };
  }, [language, headerCategories]);

  // Fetch page of products based on current active tab
  const fetchProducts = useCallback(
    async (pageNum, isInitial = false, tabId = activeTab) => {
      if (isInitial) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const params = {
          page: pageNum,
          limit: 20,
        };

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          params.lat = latitude;
          params.lng = longitude;
        }

        params.allProducts = "true";
        if (tabId !== "for_you") {
          params.headerId = tabId;
        }

        const res = await customerApi.getProducts(params);
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

        // Interleave for "For You", keep ordered for specific category
        const processedNew =
          tabId === "for_you" && isInitial ? shuffleArray(uniqueNew) : uniqueNew;

        setProducts((prev) => (isInitial ? processedNew : [...prev, ...processedNew]));
        setHasMore(pageNum < pages && newItems.length > 0);
      } catch (err) {
        console.error("Failed to load products in For You section:", err);
        setHasMore(false);
      } finally {
        if (isInitial) setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [activeTab, latitude, longitude]
  );

  // When activeTab changes, reset pagination and fetch fresh products
  useEffect(() => {
    seenIdsRef.current.clear();
    setProducts([]);
    setPage(1);
    fetchProducts(1, true, activeTab);
  }, [activeTab, fetchProducts]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || isLoading || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          setPage((prevPage) => {
            const nextPage = prevPage + 1;
            fetchProducts(nextPage, false, activeTab);
            return nextPage;
          });
        }
      },
      {
        rootMargin: "350px", // Trigger before reaching bottom for seamless continuous loading
      }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, activeTab, fetchProducts]);

  const handleTabSelect = (tabId, element) => {
    if (tabId === activeTab) return;
    setActiveTab(tabId);

    // Smoothly scroll selected tab into view
    if (element && tabsContainerRef.current) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  };

  return (
    <section className="w-full mt-2 mb-4">
      {/* Horizontal Scrollable Filter Line starting from Left ("For You" on Left + 3D Header Categories) */}
      <div className="w-full flex flex-col">
        <div
          ref={tabsContainerRef}
          className="flex items-center gap-4 overflow-x-auto no-scrollbar px-3.5 md:px-6 w-full scroll-smooth"
        >
          {/* 1. "For You" Tab (Always Placed on Left Side) */}
          <div
            onClick={(e) => handleTabSelect("for_you", e.currentTarget)}
            className="flex flex-col items-center shrink-0 cursor-pointer select-none pt-1 group"
          >
            {/* For You 3D Icon */}
            <div className="w-[64px] h-[50px] sm:w-[70px] sm:h-[54px] flex items-center justify-center">
              <img
                src={forYouIconImg}
                alt="For You"
                className={cn(
                  "w-full h-full object-contain block drop-shadow-xs transition-transform duration-200",
                  activeTab === "for_you" ? "scale-105" : "opacity-90 group-hover:opacity-100 group-hover:scale-105"
                )}
              />
            </div>

            {/* Label */}
            <span
              className={cn(
                "text-[12px] sm:text-[13px] tracking-tight mt-1 leading-tight whitespace-nowrap transition-colors",
                activeTab === "for_you"
                  ? "font-bold text-[#1f2937]"
                  : "font-medium text-slate-500 group-hover:text-slate-800"
              )}
            >
              For You
            </span>

            {/* Active Blue Bar Indicator */}
            {activeTab === "for_you" ? (
              <div className="w-[60px] sm:w-[66px] h-[3.5px] bg-[#2874f0] rounded-t-full mt-2 relative z-10 shadow-xs" />
            ) : (
              <div className="w-[60px] sm:w-[66px] h-[3.5px] bg-transparent rounded-t-full mt-2" />
            )}
          </div>

          {/* 2. Header Categories Tabs with Offwhite Pill Cards */}
          {displayHeaders.map((cat) => {
            const catId = String(cat._id || cat.id);
            const isActive = activeTab === catId;
            const displayName = truncateCategoryName(cat.name, 12);

            return (
              <div
                key={catId}
                onClick={(e) => handleTabSelect(catId, e.currentTarget)}
                className="flex flex-col items-center shrink-0 cursor-pointer select-none pt-1 group"
              >
                {/* Offwhite Category Pill Card with clear image view */}
                <div className="w-[64px] h-[50px] sm:w-[70px] sm:h-[54px] flex items-center justify-center relative">
                  <div
                    className={cn(
                      "w-[58px] h-[44px] sm:w-[64px] sm:h-[48px] rounded-[16px] flex items-center justify-center relative overflow-hidden transition-all duration-200 border select-none",
                      isActive
                        ? "bg-white border-[#2874f0] ring-2 ring-blue-500/25 shadow-xs scale-105"
                        : "bg-[#F8F9FA] border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.04)] group-hover:bg-slate-100/90 group-hover:border-slate-300 group-hover:scale-105"
                    )}
                  >
                    {/* Category Icon / Image - enlarged & sharp on offwhite background */}
                    {cat.iconImage || (cat.image && !cat.image.includes("placeholder")) ? (
                      <img
                        src={applyCloudinaryTransform(cat.iconImage || cat.image, "f_auto,q_auto,w_120")}
                        alt={cat.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        className="w-[34px] h-[34px] sm:w-[38px] sm:h-[38px] object-contain relative z-10 transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <CategoryIcon
                        iconId={cat.iconId}
                        alt={cat.name}
                        className="w-7 h-7 text-slate-700 relative z-10 transition-transform duration-200 group-hover:scale-105"
                        style={{ color: "#334155" }}
                      />
                    )}
                  </div>
                </div>

                {/* Category Label */}
                <span
                  className={cn(
                    "text-[12px] sm:text-[13px] tracking-tight mt-1 leading-tight whitespace-nowrap transition-colors",
                    isActive
                      ? "font-bold text-[#1f2937]"
                      : "font-medium text-slate-500 group-hover:text-slate-800"
                  )}
                >
                  {displayName}
                </span>

                {/* Active Blue Bar Indicator */}
                {isActive ? (
                  <div className="w-[60px] sm:w-[66px] h-[3.5px] bg-[#2874f0] rounded-t-full mt-2 relative z-10 shadow-xs" />
                ) : (
                  <div className="w-[60px] sm:w-[66px] h-[3.5px] bg-transparent rounded-t-full mt-2" />
                )}
              </div>
            );
          })}
        </div>

        {/* Full-width thin horizontal line directly under the blue bar */}
        <div className="w-full h-[1px] bg-slate-200/90 -mt-[1px] mb-4" />
      </div>

      {/* Initial Loading Skeleton */}
      {isLoading && products.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 sm:gap-x-4 md:gap-x-5 gap-y-4 sm:gap-y-6 px-3.5 sm:px-4 md:px-0">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-white flex flex-col animate-pulse">
              <div
                className="w-full rounded-[12px] bg-[#F0F0F0] mb-2.5"
                style={{ aspectRatio: "0.88" }}
              />
              <div className="h-4 w-3/4 bg-slate-100 rounded mb-2" />
              <div className="h-5 w-1/2 bg-slate-100 rounded mb-1.5" />
              <div className="h-3.5 w-2/3 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <p className="text-sm font-semibold text-slate-700">No products found in this category</p>
          <p className="text-xs text-slate-400 mt-1">Check back soon for new arrivals!</p>
        </div>
      )}

      {/* Responsive Products Grid: 2 per row on mobile, 4 to 5 per row on desktop matching Flipkart */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 sm:gap-x-4 md:gap-x-5 gap-y-4 sm:gap-y-6 px-3.5 sm:px-4 md:px-0">
          {products.map((item) => (
            <ProductCard
              key={item._id || item.id}
              product={item}
            />
          ))}
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
