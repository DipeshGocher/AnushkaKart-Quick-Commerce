import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Star, ChevronRight, ImageOff } from "lucide-react";
import { customerApi } from "../../services/customerApi";
import { applyCloudinaryTransform, isPngImage } from "@/core/utils/imageUtils";
import { cn } from "@/lib/utils";
import { getProductUrl } from "@/core/utils/productUrl";
import { useTranslation } from "@core/context/LanguageContext";
import { useDynamicTranslation } from "@/core/hooks/useDynamicTranslation";
import groceryBannerImg from "@/assets/grocery_section_banner.jpg";
import electronicsBannerImg from "@/assets/banners/electronics_section_banner.jpg";
import mobilesBannerImg from "@/assets/banners/mobiles_section_banner.jpg";
import beautyBannerImg from "@/assets/banners/beauty_section_banner.jpg";
import fashionBannerImg from "@/assets/banners/fashion_section_banner.jpg";
import homeAppliancesBannerImg from "@/assets/banners/home_appliances_section_banner.jpg";

const getCategoryTheme = (headerName = "", headerSlug = "") => {
  const text = `${headerName} ${headerSlug}`.toLowerCase();

  if (/grocer/i.test(text)) {
    return {
      banner: groceryBannerImg,
      alt: "Fresh Grocery - Daily Essentials At Your Doorstep",
      color: "#16a34a", // Vibrant Green matching grocery banner
      bgGradient: "from-emerald-50 to-green-50",
      borderColor: "border-emerald-100/70",
    };
  }

  if (/electr/i.test(text)) {
    return {
      banner: electronicsBannerImg,
      alt: "Smart Electronics - Latest Tech For A Smarter Tomorrow",
      color: "#7c3aed", // Vibrant Purple matching electronics banner
      bgGradient: "from-purple-50 to-indigo-50",
      borderColor: "border-purple-100/70",
    };
  }

  if (/mobil|phone|smartphon/i.test(text)) {
    return {
      banner: mobilesBannerImg,
      alt: "Latest Mobiles - Stay Connected To A Smarter You",
      color: "#0284c7", // Electric Blue matching mobiles banner
      bgGradient: "from-sky-50 to-blue-50",
      borderColor: "border-sky-100/70",
    };
  }

  if (/beaut|cosmetic|skin/i.test(text)) {
    return {
      banner: beautyBannerImg,
      alt: "Glow Beauty - Beauty Essentials For A Brighter You",
      color: "#db2777", // Rich Pink / Magenta matching beauty banner
      bgGradient: "from-pink-50 to-rose-50",
      borderColor: "border-pink-100/70",
    };
  }

  if (/fashion|cloth|apparel/i.test(text)) {
    return {
      banner: fashionBannerImg,
      alt: "Trendy Fashion - Style For Every You",
      color: "#9333ea", // Vibrant Violet / Purple matching fashion banner
      bgGradient: "from-purple-50 to-fuchsia-50",
      borderColor: "border-purple-100/70",
    };
  }

  if (/home|appliance|kitchen/i.test(text)) {
    return {
      banner: homeAppliancesBannerImg,
      alt: "Make it Home - Everyday Essentials For A Better Living",
      color: "#d97706", // Warm Amber matching home banner
      bgGradient: "from-amber-50 to-orange-50",
      borderColor: "border-amber-100/70",
    };
  }

  return {
    banner: null,
    alt: headerName,
    color: "#2874f0",
    bgGradient: "from-blue-50 to-indigo-50",
    borderColor: "border-blue-100/70",
  };
};

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
        const params = { limit: 12 };
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
          // Keep only sections with at least 1 product, up to 12 products per section
          const valid = items
            .filter((s) => s?.products && s.products.length > 0)
            .map((s) => ({
              ...s,
              products: s.products.slice(0, 12),
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
    <div className="w-full mt-4 md:mt-5">
      {displaySections.map((section) => {
        const header = section.header;
        const products = section.products || [];
        const headerId = header?._id || header?.id;
        const headerName = header?.name || "Category";
        const theme = getCategoryTheme(headerName, header?.slug || "");
        const displayProducts = products.slice(0, 12);

        return (
          <div key={headerId || headerName} className="w-full">
            <section
              className="w-full mb-6 pt-1"
              aria-label={headerName + ' products'}
            >
              {/* Header Category Name & See All */}
              <div className="flex items-center justify-between px-4 mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-5 rounded-full transition-colors"
                    style={{ backgroundColor: theme.color }}
                  />
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
                    className="flex items-center gap-0.5 text-[13px] font-bold active:opacity-75 transition-opacity"
                    style={{ color: theme.color }}
                  >
                    <span>See All</span>
                    <ChevronRight size={14} className="stroke-[2.5]" style={{ color: theme.color }} />
                  </button>
                )}
              </div>

              {/* Category Section Banner - Helps customer identify category section */}
              {theme.banner && (
                <div className="px-4 mb-3.5">
                  <div
                    onClick={() => {
                      if (headerId) {
                        window.scrollTo(0, 0);
                        navigate('/category/' + headerId);
                      }
                    }}
                    className={`w-full overflow-hidden rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border ${theme.borderColor} bg-gradient-to-r ${theme.bgGradient} cursor-pointer active:scale-[0.99] transition-transform`}
                  >
                    <img
                      src={theme.banner}
                      alt={theme.alt}
                      className="w-full h-auto object-cover block"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}

            {/* 2 Products in a row (Grid cols 2) */}
            <div className="grid grid-cols-2 gap-3 px-4">
              {displayProducts.map((product) => {
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
                    {/* Clean Full Cover Image Container with visible off-white / grey background and border */}
                    <div className="customer-product-clean-image relative aspect-square w-full rounded-2xl bg-[#f1f3f6] border border-[#e0e3e8] p-0 flex items-center justify-center overflow-hidden shadow-2xs">
                      {image ? (
                        <img
                          src={applyCloudinaryTransform(
                            image,
                            "f_auto,q_auto,w_400"
                          )}
                          alt={product.name}
                          loading="lazy"
                          className={cn(
                            "w-full h-full transition-transform duration-300 group-hover:scale-105",
                            isPngImage(image)
                              ? "is-png-image object-contain p-1"
                              : "is-normal-image object-cover p-0"
                          )}
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
