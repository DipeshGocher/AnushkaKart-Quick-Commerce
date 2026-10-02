import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Star, ImageOff } from "lucide-react";
import { customerApi } from "../../services/customerApi";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { getProductUrl } from "@/core/utils/productUrl";
import { useTranslation } from "@core/context/LanguageContext";
import { useDynamicTranslation } from "@/core/hooks/useDynamicTranslation";

const formatPrice = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const getItems = (response) => {
  const data = response?.data || response;
  const result = data?.result;
  return Array.isArray(data?.results)
    ? data.results
    : Array.isArray(result?.items)
    ? result.items
    : Array.isArray(result)
    ? result
    : [];
};

const NewArrivalsSection = ({ latitude, longitude }) => {
  const [products, setProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { language } = useTranslation();
  const { translateObject } = useDynamicTranslation();

  useEffect(() => {
    let cancelled = false;

    const fetchNewArrivals = async () => {
      setIsLoading(true);
      try {
        const params = {
          newArrivals: "true",
          sort: "newest",
          conditionType: "all",
          limit: 20,
          page: 1,
        };
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          params.lat = latitude;
          params.lng = longitude;
        }

        const res = await customerApi.getProducts(params);
        const rawItems = getItems(res);

        if (!cancelled) {
          const formatted = rawItems.slice(0, 20).map((p) => ({
            ...p,
            id: p._id || p.id,
            image: p.mainImage || p.variants?.[0]?.images?.[0] || p.image || "",
            price: Number(p.salePrice || p.price) || 0,
            originalPrice: Number(p.price || p.variants?.[0]?.price) || 0,
            rating: Number(p.rating) > 0 ? Number(p.rating) : 5.0,
          }));
          setProducts(formatted);
          setDisplayProducts(formatted);
        }
      } catch (error) {
        console.error("Failed to load new arrivals:", error);
        if (!cancelled) {
          setProducts([]);
          setDisplayProducts([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchNewArrivals();

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  useEffect(() => {
    if (language === "en" || products.length === 0) {
      setDisplayProducts(products);
      return;
    }

    let isMounted = true;
    const translateProducts = async () => {
      try {
        const translated = await translateObject(products, ["name", "weight"]);
        if (isMounted) {
          setDisplayProducts(translated);
        }
      } catch (err) {
        if (isMounted) setDisplayProducts(products);
      }
    };

    translateProducts();
    return () => {
      isMounted = false;
    };
  }, [language, products]);

  if (isLoading && products.length === 0) {
    return (
      <section
        className="mx-4 mt-6 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#ffd5df] via-[#ffe4eb] to-[#fff0f4] py-5 px-3.5 shadow-[0_8px_25px_rgba(244,114,182,0.15)] border border-pink-200/60"
        aria-label="Loading New Arrivals"
      >
        <div className="flex items-center gap-2 px-1 mb-4">
          <div className="h-6 w-36 bg-pink-200/70 animate-pulse rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col">
              <div className="aspect-square w-full rounded-[18px] bg-white/90 p-3 shadow-xs border border-white flex items-center justify-center">
                <div className="w-full h-full bg-pink-50 animate-pulse rounded-[12px]" />
              </div>
              <div className="mt-2 px-0.5 h-4 bg-pink-200/60 animate-pulse rounded-md w-3/4" />
              <div className="mt-1 px-0.5 h-4 bg-pink-200/60 animate-pulse rounded-md w-1/2" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (displayProducts.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="w-full h-2.5 bg-[#f1f3f6] border-y border-slate-200/80 my-3.5" />
      <section
        className="mx-4 mt-1 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#ffd5df] via-[#ffe4eb] to-[#fff0f4] py-5 px-3.5 shadow-[0_8px_25px_rgba(244,114,182,0.15)] border border-pink-200/60"
        aria-label="New Arrivals"
      >
      {/* Header with New Icon */}
      <h2 className="fk-section-heading flex items-center gap-2 px-1">
        <span>New Arrivals</span>
        <Sparkles
          size={22}
          className="shrink-0 text-[#ec4899]"
          fill="#f472b6"
          strokeWidth={1.8}
          aria-label="New Arrivals Icon"
        />
      </h2>

      {/* Vertical 2-in-a-row Grid (Top-to-down, NOT sliding) */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {displayProducts.map((product) => {
          const id = product.id || product._id;
          const originalPrice = Number(product.originalPrice) || 0;
          const currentPrice = Number(product.price) || 0;
          const hasDiscount = originalPrice > currentPrice && currentPrice > 0;
          const discountPercent = hasDiscount
            ? Math.round((1 - currentPrice / originalPrice) * 100)
            : 0;
          const image = product.image;
          const isPng = typeof image === 'string' && (image.toLowerCase().endsWith('.png') || image.toLowerCase().includes('.png?') || image.toLowerCase().includes('/png'));
          const rating = Number(product.rating) > 0 ? Number(product.rating) : 5.0;

          return (
            <Link
              key={id}
              to={getProductUrl(product)}
              className="group flex flex-col active:scale-[0.98] transition-transform min-w-0"
            >
              {/* Full Cover Image Container - NO nested div look */}
              <div className="customer-product-clean-image relative aspect-square w-full rounded-2xl bg-[#f8f9fa] p-0 flex items-center justify-center overflow-hidden">
                {image ? (
                  <img
                    src={applyCloudinaryTransform(image, "f_auto,q_auto,w_400")}
                    alt={product.name}
                    loading="lazy"
                    className={`w-full h-full group-hover:scale-105 transition-transform duration-300 ${
                      isPng ? 'is-png-image object-contain p-2' : 'object-cover'
                    }`}
                  />
                ) : (
                  <ImageOff
                    size={28}
                    className="text-slate-300"
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Product Name (Single line with ellipsis) */}
              <h4 className="fk-product-title truncate text-[13px] font-semibold text-[#212121] leading-tight mt-1.5 px-0.5 group-hover:text-[#2874f0] transition-colors">
                {product.name}
              </h4>

              {/* Price Row: Selling Price, Cut MRP (if discount), and Green % off */}
              <div className="mt-0.5 px-0.5 flex items-baseline gap-1.5 leading-tight flex-wrap">
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
            </Link>
          );
        })}
      </div>
    </section>
    </div>
  );
};

export default NewArrivalsSection;
