import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Star, ChevronRight, ImageOff } from "lucide-react";
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

const HeaderCategoryProductsSection = ({ latitude, longitude }) => {
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { language } = useTranslation();
  const { translateObject } = useDynamicTranslation();
  const [displaySections, setDisplaySections] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const fetchHeaderProducts = async () => {
      setIsLoading(true);
      try {
        const params = { limit: 10 };
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          params.lat = latitude;
          params.lng = longitude;
        }

        const res = await customerApi.getHeaderProducts(params);
        const data = res?.data || res;
        const items = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.result)
          ? data.result
          : Array.isArray(data)
          ? data
          : [];

        if (!cancelled) {
          // Keep only sections with at least 1 product, max 10 products per section
          const valid = items
            .filter((s) => s?.products && s.products.length > 0)
            .map((s) => ({
              ...s,
              products: s.products.slice(0, 10),
            }));
          setSections(valid);
          setDisplaySections(valid);
        }
      } catch (err) {
        console.error("Failed to load header category products:", err);
        if (!cancelled) {
          setSections([]);
          setDisplaySections([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchHeaderProducts();

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  // Handle translation if language changes
  useEffect(() => {
    if (language === "en" || sections.length === 0) {
      setDisplaySections(sections);
      return;
    }

    let isMounted = true;
    const translateSections = async () => {
      try {
        const translated = await Promise.all(
          sections.map(async (sec) => {
            const txHeader = await translateObject([sec.header], ["name"]);
            const txProds = await translateObject(sec.products, ["name", "weight"]);
            return {
              ...sec,
              header: txHeader[0] || sec.header,
              products: txProds || sec.products,
            };
          })
        );
        if (isMounted) {
          setDisplaySections(translated);
        }
      } catch (err) {
        if (isMounted) setDisplaySections(sections);
      }
    };

    translateSections();
    return () => {
      isMounted = false;
    };
  }, [language, sections]);

  if (isLoading && sections.length === 0) {
    return (
      <div className="w-full py-4 space-y-6">
        {[1, 2].map((placeholderKey) => (
          <div key={placeholderKey} className="px-4">
            <div className="h-6 w-36 bg-slate-200 animate-pulse rounded-md mb-3" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map((cardKey) => (
                <div key={cardKey} className="flex flex-col">
                  <div className="aspect-square w-full rounded-[18px] bg-white p-3 shadow-xs border border-slate-100 flex items-center justify-center">
                    <div className="w-full h-full bg-slate-100 animate-pulse rounded-[12px]" />
                  </div>
                  <div className="mt-2 px-0.5 h-4 bg-slate-200/80 animate-pulse rounded-md w-3/4" />
                  <div className="mt-1 px-0.5 h-4 bg-slate-200/80 animate-pulse rounded-md w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (displaySections.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {displaySections.map((section) => {
        const header = section.header;
        const products = section.products || [];
        const headerId = header?._id || header?.id;
        const headerName = header?.name || "Category";

        return (
          <div key={headerId || headerName} className="w-full">
            {/* Flipkart-style section divider */}
            <div className="w-full h-2.5 bg-[#f1f3f6] border-y border-slate-200/80 my-3.5" />

            <section
              className="w-full pb-1"
              aria-label={headerName + ' products'}
            >
              {/* Header Category Name & See All */}
              <div className="flex items-center justify-between px-4 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-5 bg-[#2874f0] rounded-full" />
                  <h2 className="fk-section-heading">
                    {headerName}
                  </h2>
                </div>
                {headerId && (
                  <button
                    type="button"
                    onClick={() => {
                      window.scrollTo(0, 0);
                      navigate('/category/' + headerId);
                    }}
                    className="fk-view-all flex items-center gap-0.5 active:opacity-75"
                  >
                    <span>See All</span>
                    <ChevronRight size={14} className="stroke-[2.5]" />
                  </button>
                )}
              </div>

            {/* 2 Products in a row (Grid cols 2) */}
            <div className="grid grid-cols-2 gap-3 px-4">
              {products.map((product) => {
                const id = product._id || product.id;
                const originalPrice =
                  Number(product.originalPrice ?? product.price) || 0;
                const currentPrice = Number(product.price) || 0;
                const hasDiscount =
                  originalPrice > currentPrice && currentPrice > 0;
                const discountPercent = hasDiscount
                  ? Math.round((1 - currentPrice / originalPrice) * 100)
                  : 0;
                const image =
                  product.image ||
                  product.mainImage ||
                  product.variants?.[0]?.images?.[0];
                const rating =
                  Number(product.rating) > 0 ? Number(product.rating) : 5.0;

                const isPng = typeof image === 'string' && (image.toLowerCase().endsWith('.png') || image.toLowerCase().includes('.png?') || image.toLowerCase().includes('/png'));

                return (
                  <Link
                    key={id}
                    to={getProductUrl(product)}
                    className="group flex flex-col active:scale-[0.98] transition-transform"
                  >
                    {/* Clean Full Cover Image Container - NO nested div look */}
                    <div className="customer-product-clean-image relative aspect-square w-full rounded-2xl bg-[#f8f9fa] p-0 flex items-center justify-center overflow-hidden">
                      {image ? (
                        <img
                          src={applyCloudinaryTransform(
                            image,
                            "f_auto,q_auto,w_400"
                          )}
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
      })}
    </div>
  );
};

export default HeaderCategoryProductsSection;
