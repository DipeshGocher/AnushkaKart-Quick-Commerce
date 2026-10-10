import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { customerApi } from "../../services/customerApi";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { slugify } from "@/core/utils/productUrl";

// Default theme configuration per category if not customized in CMS
const DEFAULT_CATEGORY_THEMES = {
  grocery: {
    title: "Daily Grocery Deals",
    bottomBgColor: "#059669", // Rich Emerald Green
  },
  electronics: {
    title: "Electronics Mega Deals",
    bottomBgColor: "#1e3a8a", // Dark Navy Blue
  },
  mobiles: {
    title: "Smartphones & Deals",
    bottomBgColor: "#2563eb", // Royal Blue
  },
  beauty: {
    title: "Men's grooming deals", // Exact title matching screenshot
    bottomBgColor: "#2563eb", // Royal Blue matching screenshot
  },
  fashion: {
    title: "Fashion & Lifestyle Deals",
    bottomBgColor: "#7c3aed", // Vibrant Purple
  },
  home: {
    title: "Home & Kitchen Deals",
    bottomBgColor: "#0f766e", // Deep Teal
  },
  medicine: {
    title: "Health & Wellness Deals",
    bottomBgColor: "#0d9488", // Medical Teal
  },
  all: {
    title: "Top Category Deals",
    bottomBgColor: "#2563eb", // Flipkart Royal Blue
  },
};

const resolveTheme = (headerName = "", headerSlug = "") => {
  const text = `${headerName || ""} ${headerSlug || ""}`.toLowerCase();
  if (/grocer/i.test(text)) return DEFAULT_CATEGORY_THEMES.grocery;
  if (/electr/i.test(text)) return DEFAULT_CATEGORY_THEMES.electronics;
  if (/mobil|phone|smartphon/i.test(text)) return DEFAULT_CATEGORY_THEMES.mobiles;
  if (/beaut|groom|cosmetic|skin/i.test(text)) return DEFAULT_CATEGORY_THEMES.beauty;
  if (/fashion|cloth|apparel/i.test(text)) return DEFAULT_CATEGORY_THEMES.fashion;
  if (/home|appliance|kitchen/i.test(text)) return DEFAULT_CATEGORY_THEMES.home;
  if (/med|health|pharma/i.test(text)) return DEFAULT_CATEGORY_THEMES.medicine;
  return DEFAULT_CATEGORY_THEMES.all;
};

const DEFAULT_OFFERS = [
  "Min. 50% Off",
  "Min. 30% Off",
  "Min. 40% Off",
  "Up to 60% Off",
  "Min. 35% Off",
  "Up to 70% Off",
  "Min. 45% Off",
  "Min. 25% Off",
];

export default function CuratedCategoryDealsSection({
  pageType = "home",
  headerId = null,
  headerCategory = null,
  heroConfig = null,
  subCategories = null,
}) {
  const navigate = useNavigate();
  const scrollContainerRef = useRef(null);

  const [loadedConfig, setLoadedConfig] = useState(heroConfig);
  const [loading, setLoading] = useState(!heroConfig);
  const [allFallbackSubcategories, setAllFallbackSubcategories] = useState([]);

  // Fetch heroConfig if not provided directly by parent
  useEffect(() => {
    if (heroConfig) {
      setLoadedConfig(heroConfig);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const fetchConfig = async () => {
      try {
        const params = { pageType };
        if (pageType === "header" && headerId) {
          params.headerId = headerId;
        }
        const res = await customerApi.getHeroConfig(params);
        if (isMounted) {
          const cfg = res.data?.result || res.data || null;
          setLoadedConfig(cfg);
        }
      } catch (err) {
        console.error("Failed to load hero config for curated deals:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, [heroConfig, pageType, headerId]);

  const [fallbackRetry, setFallbackRetry] = useState(0);

  // If on "home" (All) page and no curated items set, fetch subcategories across all categories for rich initial experience
  useEffect(() => {
    if (pageType !== "home") return;
    if (loadedConfig?.curatedDeals?.items?.length > 0) return;

    let isMounted = true;
    customerApi
      .getCategories({ type: "subcategory", limit: 20 })
      .then((res) => {
        if (!isMounted) return;
        const list = res.data?.results || res.data?.result || res.data || [];
        const items = Array.isArray(list) ? list : [];
        setAllFallbackSubcategories(items);
        if (items.length === 0 && fallbackRetry < 2) {
          setTimeout(() => {
            if (isMounted) setFallbackRetry((prev) => prev + 1);
          }, 3000);
        }
      })
      .catch(() => {
        if (isMounted && fallbackRetry < 2) {
          setTimeout(() => {
            if (isMounted) setFallbackRetry((prev) => prev + 1);
          }, 3000);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [pageType, loadedConfig?.curatedDeals?.items?.length, fallbackRetry]);

  const defaultTheme = useMemo(() => {
    if (pageType === "home") return DEFAULT_CATEGORY_THEMES.all;
    return resolveTheme(headerCategory?.name, headerCategory?.slug);
  }, [pageType, headerCategory]);

  const curatedData = loadedConfig?.curatedDeals;

  // If section is explicitly disabled by admin in CMS, return null
  if (curatedData && curatedData.enabled === false) {
    return null;
  }

  // Determine section heading
  const sectionTitle =
    curatedData?.title?.trim() ||
    defaultTheme.title ||
    "Curated Deals";

  // Card colors
  const cardTopBgColor = curatedData?.cardTopBgColor?.trim() || "#FAF8F5";
  const cardBottomBgColor =
    curatedData?.cardBottomBgColor?.trim() ||
    defaultTheme.bottomBgColor ||
    "#2563eb";
  const cardTextColor = curatedData?.cardTextColor?.trim() || "#FFFFFF";

  // Resolve items to render
  const items = useMemo(() => {
    // 1. If CMS curated items exist and are not empty
    if (Array.isArray(curatedData?.items) && curatedData.items.length > 0) {
      return curatedData.items.map((item, idx) => {
        const cat = item.categoryId;
        const name = item.title?.trim() || cat?.name || "Special Deal";
        const image =
          item.imageUrl?.trim() ||
          cat?.image ||
          cat?.icon ||
          "";
        const offer = item.offerText?.trim() || DEFAULT_OFFERS[idx % DEFAULT_OFFERS.length];
        return {
          id: cat?._id || `deal-${idx}`,
          slug: cat?.slug || "",
          name,
          image,
          offerText: offer,
          rawCategory: cat,
          linkValue: item.linkValue || "",
        };
      });
    }

    // 2. Fallback for Header Category page: use subCategories of this category
    if (pageType === "header" && Array.isArray(subCategories) && subCategories.length > 0) {
      return subCategories
        .filter((s) => !s.isTopDealsPromo)
        .slice(0, 10)
        .map((sub, idx) => ({
          id: sub._id || sub.id,
          slug: sub.slug || "",
          name: sub.name,
          image: sub.image || sub.icon || "",
          offerText: DEFAULT_OFFERS[idx % DEFAULT_OFFERS.length],
          rawCategory: sub,
        }));
    }

    // 3. Fallback for Home page: use fetched platform subcategories
    if (pageType === "home" && allFallbackSubcategories.length > 0) {
      return allFallbackSubcategories.slice(0, 10).map((sub, idx) => ({
        id: sub._id || sub.id,
        slug: sub.slug || "",
        name: sub.name,
        image: sub.image || sub.icon || "",
        offerText: DEFAULT_OFFERS[idx % DEFAULT_OFFERS.length],
        rawCategory: sub,
      }));
    }

    return [];
  }, [curatedData?.items, pageType, subCategories, allFallbackSubcategories]);

  if (!items || items.length === 0) {
    return null;
  }

  const handleCardClick = (item) => {
    if (item.linkValue) {
      if (item.linkValue.startsWith("http")) {
        window.open(item.linkValue, "_blank");
      } else {
        navigate(item.linkValue);
      }
      return;
    }

    const cat = item.rawCategory || item;

    // 1. If cat is explicitly a main category (type === 'category')
    if (cat?.type === "category") {
      const mainCat = cat;
      const headerCat =
        (typeof mainCat.parentId === "object" ? mainCat.parentId : null) || headerCategory;
      const hSlug = headerCat?.slug || slugify(headerCat?.name || "");
      const mSlug = mainCat.slug || slugify(mainCat.name || item.name || "");
      if (hSlug && mSlug) {
        navigate(`/category/${hSlug}/${mSlug}`, {
          state: {
            activeMainCategoryId: mainCat._id || mainCat.id || item.id,
            mainCategorySlug: mSlug,
            mainCategoryName: mainCat.name || item.name,
            headerSlug: hSlug,
            headerName: headerCat?.name,
          },
        });
        return;
      }
    }

    // 2. If cat is a subcategory (type === 'subcategory' or has parentId)
    const subCat = cat;
    const mainCat =
      cat?.parentId && typeof cat.parentId === "object" ? cat.parentId : null;
    const headerCat =
      (mainCat?.parentId && typeof mainCat.parentId === "object"
        ? mainCat.parentId
        : null) || headerCategory;

    const hSlug = headerCat?.slug || slugify(headerCat?.name || "");
    const mSlug = mainCat?.slug || slugify(mainCat?.name || "");
    const sSlug = item.slug || subCat?.slug || slugify(subCat?.name || item.name || "");

    if (hSlug && mSlug && sSlug) {
      navigate(`/category/${hSlug}/${mSlug}?sub=${sSlug}`, {
        state: {
          activeSubcategoryId: subCat?._id || subCat?.id || item.id,
          subCategorySlug: sSlug,
          subCategoryName: subCat?.name || item.name,
          activeMainCategoryId: mainCat?._id || mainCat?.id,
          mainCategorySlug: mSlug,
          mainCategoryName: mainCat?.name,
          headerSlug: hSlug,
          headerName: headerCat?.name,
        },
      });
      return;
    }

    // Fallback: /category/sub/:subCategory (CategoryProductsPage will resolve full hierarchy from allCategoriesTree)
    if (sSlug) {
      navigate(`/category/sub/${sSlug}`, {
        state: {
          subcategoryId: item.id || subCat?._id,
          subcategoryName: item.name || subCat?.name,
          headerCategory,
        },
      });
    } else if (item.id) {
      navigate(`/category/sub/${item.id}`);
    }
  };

  return (
    <section className="w-full my-3 sm:my-4 select-none">
      {/* ── Section Header ── */}
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 mb-2.5 flex items-center justify-between">
        <h2 className="text-[17px] sm:text-[18px] md:text-[19px] font-bold text-slate-900 tracking-tight leading-snug">
          {sectionTitle}
        </h2>
      </div>

      {/* ── Horizontal Scrolling Carousel of Cards ── */}
      <div className="w-full max-w-none px-0 sm:px-4 md:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto no-scrollbar gap-3 sm:gap-3.5 px-4 sm:px-6 lg:px-0 pb-2 pt-0.5 scroll-smooth snap-x snap-mandatory"
        >
          {items.map((item, idx) => {
            const transformedImage = item.image
              ? applyCloudinaryTransform(item.image, "f_auto,q_auto,w_360")
              : "https://cdn-icons-png.flaticon.com/128/2321/2321831.png";

            return (
              <div
                key={item.id || idx}
                onClick={() => handleCardClick(item)}
                className="w-[142px] sm:w-[155px] flex-shrink-0 snap-start flex flex-col rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-slate-100/90 bg-white cursor-pointer select-none transition-all duration-200 active:scale-97 hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)] group"
              >
                {/* 1. Off-white Top Container with Large Transparent PNG Image */}
                <div
                  className="w-full h-[142px] sm:h-[155px] p-2.5 flex items-center justify-center relative overflow-hidden transition-colors"
                  style={{ backgroundColor: cardTopBgColor }}
                >
                  <img
                    src={transformedImage}
                    alt={item.name}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src =
                        "https://cdn-icons-png.flaticon.com/128/2321/2321831.png";
                    }}
                    className="max-h-[116px] sm:max-h-[126px] max-w-full w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                  />
                </div>

                {/* 2. Wave Divider with Magic Sparkles on Right Rise */}
                <div className="relative -mt-6 w-full pointer-events-none select-none overflow-hidden z-10">
                  <svg
                    viewBox="0 0 160 28"
                    preserveAspectRatio="none"
                    className="w-full h-7 block"
                  >
                    <path
                      d="M0 16 C35 22 75 24 110 12 C130 5 145 2 160 1 L160 28 L0 28 Z"
                      fill={cardBottomBgColor}
                    />
                  </svg>

                  {/* Magic Twinkle Sparkle Stars (✨) matching reference screenshot */}
                  <div className="absolute right-3.5 top-1 flex items-center gap-0.5">
                    {/* Primary Twinkle Star */}
                    <svg
                      viewBox="0 0 24 24"
                      className="w-3.5 h-3.5 text-white/95 fill-current drop-shadow-[0_0_3px_rgba(255,255,255,0.95)] animate-pulse"
                    >
                      <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
                    </svg>
                    {/* Secondary Twinkle Star */}
                    <svg
                      viewBox="0 0 24 24"
                      className="w-2 h-2 text-white/80 fill-current -mt-1.5 ml-0.5"
                    >
                      <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
                    </svg>
                  </div>
                </div>

                {/* 3. Bottom Colored Section with Category Name & Bold Offer Text */}
                <div
                  className="w-full px-2.5 pb-2.5 pt-0.5 flex flex-col items-center justify-center text-center -mt-[1px] min-h-[56px] sm:min-h-[60px]"
                  style={{ backgroundColor: cardBottomBgColor }}
                >
                  {/* Category / Subcategory Title */}
                  <span
                    className="text-[12.5px] sm:text-[13px] font-medium leading-tight line-clamp-1 w-full text-center tracking-tight"
                    style={{ color: cardTextColor }}
                  >
                    {item.name}
                  </span>

                  {/* Offer Text (e.g. Min. 50% Off) */}
                  <span
                    className="text-[13.5px] sm:text-[14.5px] font-extrabold tracking-tight leading-tight mt-0.5 w-full text-center drop-shadow-xs"
                    style={{ color: cardTextColor }}
                  >
                    {item.offerText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
