import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ImageOff, Package } from "lucide-react";
import { customerApi } from "../../services/customerApi";
import { useProductDetail } from "../../context/ProductDetailContext";
import { applyCloudinaryTransform, isPngImage } from "@/core/utils/imageUtils";
import { cn } from "@/lib/utils";
import { getProductUrl, getProductVariantText, getProductPriceInfo } from "@/core/utils/productUrl";
import { useTranslation } from "@core/context/LanguageContext";
import { useDynamicTranslation } from "@/core/hooks/useDynamicTranslation";
import ExperienceBannerCarousel from "../experience/ExperienceBannerCarousel";

// Banners for "All" page header category sections
import freshGroceryAllBanner from "@/assets/banners/fresh_grocery_all_banner.jpg";
import electronicsAllBanner from "@/assets/banners/electronics_all_banner.jpg";
import mobilesAllBanner from "@/assets/banners/mobiles_all_banner.jpg";
import beautyAllBanner from "@/assets/banners/beauty_all_banner.jpg";
import fashionAllBanner from "@/assets/banners/fashion_all_banner.jpg";
import homeAllBanner from "@/assets/banners/home_all_banner.jpg";

/**
 * Dynamically computes a soft pastel gradient blending from white
 * into the pastel tint and smoothly back to white, ensuring brand consistency.
 */
const hexToPastelGradient = (hexColor) => {
  if (!hexColor || typeof hexColor !== "string") {
    return "linear-gradient(180deg, #ffffff 0%, #EEF2F6 14%, #EEF2F6 86%, #ffffff 100%)";
  }
  const cleanHex = hexColor.replace("#", "").trim();
  if (cleanHex.length !== 6 && cleanHex.length !== 3) {
    return "linear-gradient(180deg, #ffffff 0%, #EEF2F6 14%, #EEF2F6 86%, #ffffff 100%)";
  }
  const r = parseInt(cleanHex.length === 3 ? cleanHex[0] + cleanHex[0] : cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.length === 3 ? cleanHex[1] + cleanHex[1] : cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.length === 3 ? cleanHex[2] + cleanHex[2] : cleanHex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return "linear-gradient(180deg, #ffffff 0%, #EEF2F6 14%, #EEF2F6 86%, #ffffff 100%)";
  }

  // Soft pastel blend: 86% white + 14% color
  const pastelR = Math.round(255 * 0.86 + r * 0.14);
  const pastelG = Math.round(255 * 0.86 + g * 0.14);
  const pastelB = Math.round(255 * 0.86 + b * 0.14);
  const pastelRgb = `rgb(${pastelR}, ${pastelG}, ${pastelB})`;

  return `linear-gradient(180deg, #ffffff 0%, ${pastelRgb} 14%, ${pastelRgb} 86%, #ffffff 100%)`;
};

const getHeaderCategoryConfig = (headerName = "", headerSlug = "", headerColor = "", cmsBanner = null) => {
  const text = `${headerName} ${headerSlug}`.toLowerCase();

  // 1. Grocery - Dedicated "All" page Fresh Grocery banner & matching fresh green gradient
  if (/grocer/i.test(text)) {
    return {
      color: "#15803d",
      bgGradient: "linear-gradient(180deg, #ffffff 0%, #dcfce7 12%, #d0f7dc 50%, #dcfce7 88%, #ffffff 100%)",
      banner: freshGroceryAllBanner,
      bannerAlt: "Fresh Grocery - Daily Essentials At Your Doorstep",
    };
  }
  // 2. Electronics
  if (/electr/i.test(text)) {
    return {
      color: "#7c3aed",
      bgGradient: "linear-gradient(180deg, #ffffff 0%, #E9D4FD 14%, #E9D4FD 86%, #ffffff 100%)",
      banner: electronicsAllBanner,
      bannerAlt: "Smart Electronics - Latest Tech For A Smarter Tomorrow",
    };
  }
  // 3. Mobile
  if (/mobil|phone|smartphon/i.test(text)) {
    return {
      color: "#0284c7",
      bgGradient: "linear-gradient(180deg, #ffffff 0%, #D6EEFE 14%, #D6EEFE 86%, #ffffff 100%)",
      banner: mobilesAllBanner,
      bannerAlt: "Latest Mobiles - Stay Connected To A Smarter You",
    };
  }
  // 4. Beauty & Skin
  if (/beaut|cosmetic|skin/i.test(text)) {
    return {
      color: "#db2777",
      bgGradient: "linear-gradient(180deg, #ffffff 0%, #FCD9E0 14%, #FCD9E0 86%, #ffffff 100%)",
      banner: beautyAllBanner,
      bannerAlt: "Glow Beauty - Beauty Essentials For A Brighter You",
    };
  }
  // 5. Fashion
  if (/fashion|cloth|apparel/i.test(text)) {
    return {
      color: "#9333ea",
      bgGradient: "linear-gradient(180deg, #ffffff 0%, #EBD8FA 14%, #EBD8FA 86%, #ffffff 100%)",
      banner: fashionAllBanner,
      bannerAlt: "Trendy Fashion - Style For Every You",
    };
  }
  // 6. Home Appliances / Kitchen
  if (/home|appliance|kitchen/i.test(text)) {
    return {
      color: "#d97706",
      bgGradient: "linear-gradient(180deg, #ffffff 0%, #F4ECE1 14%, #F4ECE1 86%, #ffffff 100%)",
      banner: homeAllBanner,
      bannerAlt: "Make it Home - Everyday Essentials For A Better Living",
    };
  }

  // Dynamic config for any future category created via Admin Panel
  const dynamicColor = headerColor || "#2563eb";
  return {
    color: dynamicColor,
    bgGradient: hexToPastelGradient(dynamicColor),
    banner: cmsBanner || null,
    bannerAlt: headerName,
  };
};

const formatPrice = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const HEADER_PRODUCTS_CACHE_KEY = "anushkakart:header_products_cache:v2";

const readHeaderProductsCache = () => {
  try {
    const raw = sessionStorage.getItem(HEADER_PRODUCTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeHeaderProductsCache = (data) => {
  try {
    if (!data) return;
    sessionStorage.setItem(HEADER_PRODUCTS_CACHE_KEY, JSON.stringify(data));
  } catch {}
};

let memoryHeaderProductsCache = null;

const HeaderCategoryProductsSection = ({ latitude, longitude }) => {
  const { openProduct } = useProductDetail();
  const cachedInitial = memoryHeaderProductsCache || readHeaderProductsCache() || [];
  const [sections, setSections] = useState(cachedInitial);
  const [isLoading, setIsLoading] = useState(() => !cachedInitial || cachedInitial.length === 0);
  const navigate = useNavigate();
  const { language } = useTranslation();
  const { translateObject } = useDynamicTranslation();
  const [displaySections, setDisplaySections] = useState(cachedInitial);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchHeaderProducts = async () => {
      if (!cachedInitial || cachedInitial.length === 0) {
        setIsLoading(true);
      }
      try {
        const params = { limit: 16 };
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
          // Keep all active header sections in order (without filtering out empty ones)
          const valid = items
            .filter((s) => s?.header)
            .map((s) => ({
              ...s,
              products: Array.isArray(s.products) ? s.products.slice(0, 16) : [],
            }));
          if (valid.length > 0) {
            memoryHeaderProductsCache = valid;
            writeHeaderProductsCache(valid);
          } else if (retryCount < 2) {
            setTimeout(() => {
              if (!cancelled) setRetryCount((prev) => prev + 1);
            }, 3000);
          }
          setSections(valid);
          setDisplaySections(valid);
        }
      } catch (err) {
        console.error("Failed to load header category products:", err);
        if (!cancelled) {
          setSections([]);
          setDisplaySections([]);
          if (retryCount < 2) {
            setTimeout(() => {
              if (!cancelled) setRetryCount((prev) => prev + 1);
            }, 3000);
          }
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
  }, [latitude, longitude, retryCount]);

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
            const headerName = sec.header?.name || "";
            const translatedHeaderName = await translateObject(
              headerName,
              language
            );

            const translatedProducts = await Promise.all(
              (sec.products || []).map(async (p) => {
                const name = await translateObject(p.name, language);
                return { ...p, name: name || p.name };
              })
            );

            return {
              ...sec,
              header: {
                ...sec.header,
                name: translatedHeaderName || headerName,
              },
              products: translatedProducts,
            };
          })
        );

        if (isMounted) {
          setDisplaySections(translated);
        }
      } catch (e) {
        if (isMounted) {
          setDisplaySections(sections);
        }
      }
    };

    translateSections();

    return () => {
      isMounted = false;
    };
  }, [language, sections, translateObject]);

  if (isLoading && sections.length === 0) {
    return (
      <div className="w-full mt-4 space-y-6">
        {[0, 1].map((idx) => (
          <div key={idx} className="w-full py-6 px-4">
            <div className="flex items-center mb-3.5">
              <div className="h-5 w-32 bg-slate-200/80 rounded animate-pulse" />
            </div>
            <div className="w-full h-32 rounded-2xl bg-slate-200/70 animate-pulse mb-3" />
            <div className="flex gap-3 overflow-hidden">
              {[0, 1, 2, 3].map((pIdx) => (
                <div
                  key={pIdx}
                  className="w-[140px] shrink-0 h-44 bg-white rounded-2xl animate-pulse"
                />
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
    <div className="w-full mt-2">
      {displaySections.map((section) => {
        const header = section.header;
        const products = section.products || [];
        const headerId = header?._id || header?.id;
        const headerName = header?.name || "Category";
        const config = getHeaderCategoryConfig(
          headerName,
          header?.slug || "",
          header?.headerColor || "",
          header?.banner || null
        );
        const displayProducts = products.slice(0, 16);

        // Compute active single banner for this section (strictly single banner on All page)
        const activeCmsBanners = (Array.isArray(header?.banners) ? header.banners : []).filter(
          (b) => b && b.imageUrl && b.status !== "inactive"
        );
        let sectionBanners = [];
        if (activeCmsBanners.length > 0) {
          sectionBanners = [
            {
              ...activeCmsBanners[0],
              linkType: activeCmsBanners[0].linkType || "header",
              linkValue: activeCmsBanners[0].linkValue || headerId,
            },
          ];
        } else if (header?.banner) {
          sectionBanners = [
            {
              imageUrl: header.banner,
              title: headerName,
              linkType: "header",
              linkValue: headerId,
            },
          ];
        } else if (config.banner) {
          sectionBanners = [
            {
              imageUrl: config.banner,
              title: config.bannerAlt || headerName,
              linkType: "header",
              linkValue: headerId,
            },
          ];
        }

        return (
          <div key={headerId || headerName} className="w-full">
            <section
              className="w-full py-7 my-2 transition-colors select-none"
              style={{
                background: config.bgGradient,
              }}
              aria-label={headerName + " products"}
            >
              <div className="max-w-7xl mx-auto">
                {/* Header Category Name (Select all / See All button removed as requested) */}
                <div className="flex items-center gap-2 px-4 mb-3">
                  <div
                    className="w-1.5 h-5 rounded-full transition-colors"
                    style={{ backgroundColor: config.color }}
                  />
                  <h2 className="fk-section-heading">{headerName}</h2>
                </div>

                {/* Category Banner (Single banner per section on All page) */}
                {sectionBanners.length > 0 ? (
                  <div className="px-0 md:px-4 mb-3.5">
                    <ExperienceBannerCarousel
                      items={sectionBanners.slice(0, 1)}
                      fullWidth
                      edgeToEdge={false}
                      peekNext={false}
                      stretchSingle={true}
                      isSectionBanner={true}
                      autoPlayInterval={0}
                      showDots={false}
                      showContentOverlay={false}
                    />
                  </div>
                ) : (
                  /* Banner Unavailable Placeholder Div (allows setting banner from Admin CMS) */
                  <div className="px-4 mb-3.5">
                    <div
                      onClick={() => {
                        if (headerId) {
                          window.scrollTo(0, 0);
                          navigate("/category/" + headerId);
                        }
                      }}
                      className="group relative w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-300/80 bg-white/70 backdrop-blur-sm shadow-[0_4px_16px_rgba(0,0,0,0.03)] cursor-pointer hover:border-slate-400/80 hover:bg-white/90 transition-all p-5 flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left min-h-[105px] active:scale-[0.99]"
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105"
                        style={{
                          backgroundColor: `${config.color}15`,
                          color: config.color,
                        }}
                      >
                        <ImageOff size={22} className="stroke-[2]" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                          <span className="text-[14px] font-bold text-slate-800">
                            Banner Unavailable
                          </span>
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${config.color}18`,
                              color: config.color,
                            }}
                          >
                            {headerName}
                          </span>
                        </div>
                        <p className="text-[12px] font-medium text-slate-500 mt-0.5">
                          Set promotional banner from Admin CMS
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Products Row or Placeholder for empty products */}
                {displayProducts.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory px-4 pb-2">
                    {displayProducts.map((product) => {
                      const id = product._id || product.id;
                      const { currentPrice, originalPrice, hasDiscount, discountPercent } =
                        getProductPriceInfo(product);
                      const variantText = getProductVariantText(product);
                      const image =
                        product.image ||
                        product.mainImage ||
                        product.variants?.[0]?.images?.[0];

                      return (
                        <div
                          key={id}
                          onClick={() => openProduct(product)}
                          className="group flex flex-col bg-white rounded-2xl p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-white hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all active:scale-[0.98] w-[140px] min-w-[140px] sm:w-[160px] sm:min-w-[160px] shrink-0 snap-start cursor-pointer"
                        >
                          {/* Clean Full Cover Image Container */}
                          <div className="customer-product-clean-image relative aspect-square w-full rounded-xl bg-[#f8f9fa] overflow-hidden">
                            {image ? (
                              <img
                                src={applyCloudinaryTransform(
                                  image,
                                  "f_auto,q_auto,w_400"
                                )}
                                alt={product.name}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.classList.add("opacity-40");
                                }}
                                className="w-full h-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <ImageOff
                                size={28}
                                className="text-slate-300"
                                aria-hidden="true"
                              />
                            )}
                          </div>

                          {/* Product Text Hierarchy (No gaps between name, variant, and price) */}
                          <div className="flex flex-col mt-1.5 px-0.5 min-w-0">
                            {/* 1. Product Name */}
                            <h4 className="fk-product-title truncate text-[13px] font-semibold text-[#212121] leading-tight group-hover:text-blue-600 transition-colors">
                              {product.name}
                            </h4>

                            {/* 2. Variant (e.g. 1kg, 128 GB, 500GM, 1 Piece, 1 combo etc.) */}
                            <p className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5 truncate">
                              {variantText}
                            </p>

                            {/* 3. Price: Discount price, original price with cross line (if discount), else only original price */}
                            <div className="mt-0.5 flex items-baseline gap-1.5 leading-tight flex-wrap">
                              {hasDiscount ? (
                                <>
                                  <span className="fk-product-price text-[13px] font-bold text-[#212121]">
                                    {formatPrice(currentPrice)}
                                  </span>
                                  <span className="fk-product-mrp text-[11px] text-slate-400 line-through font-normal">
                                    {formatPrice(originalPrice)}
                                  </span>
                                  <span className="fk-product-discount text-[11px] font-bold text-[#16a34a]">
                                    {discountPercent}% off
                                  </span>
                                </>
                              ) : (
                                <span className="fk-product-price text-[13px] font-bold text-[#212121]">
                                  {formatPrice(originalPrice || currentPrice)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Placeholder when no products are in category yet (auto-populates when products added) */
                  <div className="mx-4 mb-2 py-6 px-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-dashed border-slate-200/90 text-center flex flex-col items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mb-0.5"
                      style={{
                        backgroundColor: `${config.color}14`,
                        color: config.color,
                      }}
                    >
                      <Package size={20} className="stroke-[2]" />
                    </div>
                    <p className="text-[13px] font-semibold text-slate-700">
                      No products added yet in {headerName}
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      Products added to this category will automatically start appearing here
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
};

export default HeaderCategoryProductsSection;
