import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Heart, ImageOff, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform, isPngImage } from '@/core/utils/imageUtils';
import { slugify, getProductVariantText } from '@/core/utils/productUrl';
import { customerApi } from '../../services/customerApi';
import { useSettings } from '@core/context/SettingsContext';
import { useWishlist } from '../../context/WishlistContext';
import { useProductDetail } from '../../context/ProductDetailContext';
import ProductCard from '../shared/ProductCard';
import {
  getCategoryHeaderColor,
  CATEGORY_CARD_BG,
  CATEGORY_CARD_BORDER,
  CATEGORY_CARD_SELECTED_BG,
  shiftHex,
} from '../../utils/headerTheme';

// Banner assets for header categories
import groceryBannerImg from '@/assets/banners/groceries_header_banner.jpg';
import electronicsBannerImg from '@/assets/banners/electronics_section_banner.jpg';
import mobilesBannerImg from '@/assets/banners/mobiles_section_banner.jpg';
import beautyBannerImg from '@/assets/banners/beauty_section_banner.jpg';
import fashionBannerImg from '@/assets/banners/fashion_section_banner.jpg';
import homeAppliancesBannerImg from '@/assets/banners/home_appliances_section_banner.jpg';

const getCategoryBanner = (headerName = '', headerSlug = '') => {
  const text = `${headerName || ''} ${headerSlug || ''}`.toLowerCase();
  if (/grocer/i.test(text)) return groceryBannerImg;
  if (/electr/i.test(text)) return electronicsBannerImg;
  if (/mobil|phone|smartphon/i.test(text)) return mobilesBannerImg;
  if (/beaut|cosmetic|skin/i.test(text)) return beautyBannerImg;
  if (/fashion|cloth|apparel|kid/i.test(text)) return fashionBannerImg;
  if (/home|appliance|kitchen/i.test(text)) return homeAppliancesBannerImg;
  return groceryBannerImg;
};

const formatPrice = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const getTopDealsSectionTheme = (headerCategory) => {
  const text = `${headerCategory?.name || ''} ${headerCategory?.slug || ''}`.toLowerCase();

  if (/grocer/i.test(text)) {
    return {
      gradient: 'linear-gradient(135deg, #16a34a 0%, #15803d 48%, #14532d 100%)',
      pillBg: '#0f3d1e',
      pillText: '#ffffff',
      title: 'Top deals on groceries',
      badgeTitle: 'THE BIG',
      badgeRibbon: 'SUPER SAVER',
      badgeBottom: 'DAYS',
      accentColor: '#86efac',
    };
  }
  if (/beaut|skin|cosmetic/i.test(text)) {
    return {
      gradient: 'linear-gradient(135deg, #fb7185 0%, #f43f5e 48%, #e11d48 100%)',
      pillBg: '#881337',
      pillText: '#ffffff',
      title: 'Top deals on beauty',
      badgeTitle: 'GLOW',
      badgeRibbon: 'BEAUTY DEALS',
      badgeBottom: 'DAYS',
      accentColor: '#fbcfe8',
    };
  }
  if (/electr|tech/i.test(text)) {
    return {
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 48%, #1d4ed8 100%)',
      pillBg: '#1e3a8a',
      pillText: '#ffffff',
      title: 'Upcoming deals on tech',
      badgeTitle: 'THE BIG',
      badgeRibbon: 'BILLION DAYS',
      badgeBottom: 'SALE',
      accentColor: '#bfdbfe',
    };
  }
  if (/mobil|phone|smartphon/i.test(text)) {
    return {
      gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 48%, #075985 100%)',
      pillBg: '#082f49',
      pillText: '#ffffff',
      title: 'Top deals on mobiles',
      badgeTitle: 'MOBILE',
      badgeRibbon: 'MEGA FEST',
      badgeBottom: 'DAYS',
      accentColor: '#bae6fd',
    };
  }
  if (/home|appliance|kitchen/i.test(text)) {
    return {
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 48%, #b45309 100%)',
      pillBg: '#451a03',
      pillText: '#ffffff',
      title: 'Top deals on appliances',
      badgeTitle: 'HOME',
      badgeRibbon: 'SAVER DAYS',
      badgeBottom: 'FEST',
      accentColor: '#fde68a',
    };
  }
  if (/fashion|cloth|apparel/i.test(text)) {
    return {
      gradient: 'linear-gradient(135deg, #a855f7 0%, #9333ea 48%, #7e22ce 100%)',
      pillBg: '#3b0764',
      pillText: '#ffffff',
      title: 'Top deals on fashion',
      badgeTitle: 'TRENDY',
      badgeRibbon: 'FASHION FEST',
      badgeBottom: 'DAYS',
      accentColor: '#e9d5ff',
    };
  }

  // Dynamic fallback for any other custom/new category
  const base = getCategoryHeaderColor(headerCategory) || '#2563eb';
  const name = headerCategory?.name || 'products';
  return {
    gradient: `linear-gradient(135deg, ${shiftHex(base, 32)} 0%, ${base} 50%, ${shiftHex(base, -35)} 100%)`,
    pillBg: shiftHex(base, -60),
    pillText: '#ffffff',
    title: `Top deals on ${name.toLowerCase()}`,
    badgeTitle: 'SUPER',
    badgeRibbon: 'TOP DEALS',
    badgeBottom: 'DAYS',
    accentColor: shiftHex(base, 50),
  };
};

const HeaderCategoryPageView = ({
  headerCategory,
  categoryMap = {},
  subcategoryMap = {},
  currentLocation,
}) => {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScroll, setCanScroll] = useState(false);

  const { isInWishlist, toggleWishlist } = useWishlist();
  const { openProduct } = useProductDetail();
  const { settings } = useSettings();

  const [selectedMainCatId, setSelectedMainCatId] = useState('all');
  const [selectedSubCatId, setSelectedSubCatId] = useState('all');
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryHeroConfig, setCategoryHeroConfig] = useState(null);

  const headerId = String(headerCategory?._id || headerCategory?.id || '');

  // Fetch hero & top deals configuration for this category page from Admin CMS
  useEffect(() => {
    if (!headerId) return;
    let isMounted = true;
    customerApi.getHeroConfig({ pageType: 'header', headerId })
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data?.result || res?.data || res;
        setCategoryHeroConfig(data);
      })
      .catch((err) => {
        console.error('Failed to load category hero config:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [headerId]);

  // Dynamic light matching colors derived from the active header category
  const headerBaseColor = useMemo(() => {
    return getCategoryHeaderColor(headerCategory);
  }, [headerCategory]);

  const dealsTheme = useMemo(() => {
    return getTopDealsSectionTheme(headerCategory);
  }, [headerCategory]);

  // Standard clean light-grey category tile background matching reference design
  const { cardBgColor, cardBorderColor, cardSelectedBgColor, cardRingColor } = useMemo(() => {
    return {
      cardBgColor: CATEGORY_CARD_BG,
      cardBorderColor: CATEGORY_CARD_BORDER,
      cardSelectedBgColor: CATEGORY_CARD_SELECTED_BG,
      cardRingColor: 'rgba(10, 37, 64, 0.15)',
    };
  }, []);

  // Reset filter when header category changes
  useEffect(() => {
    setSelectedMainCatId('all');
    setSelectedSubCatId('all');
  }, [headerId]);

  // 1. All Main Categories for this Header (Level 1)
  const mainCategories = useMemo(() => {
    if (!headerId) return [];
    return Object.values(categoryMap)
      .filter(
        (c) =>
          c.type === 'category' &&
          String(c.parentId?._id || c.parentId || c.headerId?._id || c.headerId) === headerId
      )
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.name.localeCompare(b.name));
  }, [categoryMap, headerId]);

  // 2. Sub Categories for this Header / Selected Main Category (Level 2)
  const subCategories = useMemo(() => {
    if (!headerId) return [];
    const mainIds = new Set(mainCategories.map((m) => String(m._id || m.id)));

    // Direct match: subcategory parent is one of the main categories of this header
    const matched = Object.values(subcategoryMap)
      .filter((s) => {
        const pId = String(s.parentId?._id || s.parentId || '');
        const hId = String(s.headerId?._id || s.headerId || '');
        return mainIds.has(pId) || hId === headerId;
      })
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.name.localeCompare(b.name));

    if (matched.length > 0) return matched;

    // Fallback: check subcategories associated with products of this header
    const productSubIds = new Set(
      products.map((p) => String(p.subcategoryId?._id || p.subcategoryId || '')).filter(Boolean)
    );
    const fromProds = Object.values(subcategoryMap).filter((s) => productSubIds.has(String(s._id || s.id)));
    if (fromProds.length > 0) return fromProds;

    // Fallback: match by header keyword
    const headerWord = (headerCategory?.name || '').toLowerCase().slice(0, 4);
    return Object.values(subcategoryMap)
      .filter((s) => {
        const text = `${s.name || ''} ${s.slug || ''}`.toLowerCase();
        return text.includes(headerWord);
      })
      .slice(0, 16);
  }, [subcategoryMap, mainCategories, products, headerId, headerCategory]);

  // Fallback product image for subcategories that don't have custom icon
  const subcategoryImageFallbackMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      const subId = String(p.subcategoryId?._id || p.subcategoryId || '');
      if (subId && !map[subId]) {
        const img = p.mainImage || p.image || p.variants?.[0]?.images?.[0];
        if (img) map[subId] = img;
      }
    });
    return map;
  }, [products]);

  // STRICT REQUIREMENT: Only main categories (Level 1) are shown in "Top categories", NEVER subcategories
  const displayCategoriesList = mainCategories;

  // Track horizontal scroll progress to move the pill indicator
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 2) {
      setCanScroll(true);
      setScrollProgress(Math.min(1, Math.max(0, scrollLeft / maxScroll)));
    } else {
      setCanScroll(false);
    }
  };

  useEffect(() => {
    handleScroll();
  }, [displayCategoriesList.length]);

  // Click on a main category card navigates directly to /category/:headerSlug/:mainSlug
  const handleCategoryClick = (cat) => {
    const hSlug = headerCategory?.slug || slugify(headerCategory?.name || '');
    const mSlug = cat.slug || slugify(cat.name || '');
    if (hSlug && mSlug) {
      navigate(`/category/${hSlug}/${mSlug}`);
    }
  };

  const handleSubCategoryClick = (sub) => {
    const sSlug = sub.slug || slugify(sub.name || '');
    if (sSlug) {
      navigate(`/category/sub/${sSlug}`, {
        state: {
          subcategoryId: sub._id || sub.id,
          subcategoryName: sub.name,
          headerCategory,
        },
      });
    }
  };

  const handleTopDealsCardClick = () => {
    const el = document.getElementById('top-deals-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // 3. Fetch all products of this header category
  useEffect(() => {
    if (!headerId) return;
    let isMounted = true;

    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const params = { headerId, limit: 120, allProducts: 'true' };
        if (
          Number.isFinite(currentLocation?.latitude) &&
          Number.isFinite(currentLocation?.longitude)
        ) {
          params.lat = currentLocation.latitude;
          params.lng = currentLocation.longitude;
        }

        const res = await customerApi.getProducts(params);
        if (isMounted) {
          const data = res?.data || res;
          const rawResult = data?.result;
          const items = Array.isArray(data?.results)
            ? data.results
            : Array.isArray(rawResult?.items)
            ? rawResult.items
            : Array.isArray(rawResult?.products)
            ? rawResult.products
            : Array.isArray(rawResult)
            ? rawResult
            : Array.isArray(data?.products)
            ? data.products
            : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data)
            ? data
            : [];
          setProducts(items);
        }
      } catch (err) {
        console.error('Failed to load category products:', err);
        if (isMounted) setProducts([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchProducts();
    return () => {
      isMounted = false;
    };
  }, [headerId, currentLocation?.latitude, currentLocation?.longitude]);

  // 4. Filter products by selected main category & subcategory
  const filteredProducts = useMemo(() => {
    let list = products;

    if (selectedSubCatId !== 'all') {
      return list.filter(
        (p) =>
          String(p.subcategoryId?._id || p.subcategoryId) === String(selectedSubCatId) ||
          String(p.categoryId?._id || p.categoryId) === String(selectedSubCatId)
      );
    }

    if (selectedMainCatId !== 'all') {
      const subIds = new Set(
        Object.values(subcategoryMap)
          .filter((s) => String(s.parentId?._id || s.parentId) === String(selectedMainCatId))
          .map((s) => String(s._id || s.id))
      );
      return list.filter(
        (p) =>
          String(p.categoryId?._id || p.categoryId) === String(selectedMainCatId) ||
          subIds.has(String(p.subcategoryId?._id || p.subcategoryId))
      );
    }

    return list;
  }, [products, selectedMainCatId, selectedSubCatId, subcategoryMap]);

  const getDiscountPercent = (product) => {
    const originalPrice = Number(product.price ?? product.originalPrice) || 0;
    const currentPrice = Number(product.salePrice ?? product.price) || 0;
    if (originalPrice > currentPrice && currentPrice > 0) {
      return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    }
    return 0;
  };

  // Top Deals products for this category:
  // 1. Prioritize products explicitly configured in CMS topDealsProductIds.
  // 2. Prioritize products marked as isTopDeal (from Admin/Seller checkbox).
  // 3. Fallback to top discount products for this category.
  const topDealsProducts = useMemo(() => {
    if (!products || products.length === 0) return [];

    const configuredIds = (
      categoryHeroConfig?.topDealsProductIds?.length
        ? categoryHeroConfig.topDealsProductIds
        : settings?.categoryTopDeals?.[headerCategory?.slug]?.productIds ||
          settings?.categoryTopDeals?.[headerId]?.productIds ||
          []
    ).map(String);

    let explicitMatches = [];
    if (configuredIds.length > 0) {
      const prodMap = new Map(products.map((p) => [String(p._id || p.id), p]));
      explicitMatches = configuredIds.map((id) => prodMap.get(id)).filter(Boolean);
    }

    const marked = products.filter(
      (p) => (p.isTopDeal === true || p.isTopDeal === 'true') &&
             !explicitMatches.some((ep) => (ep._id || ep.id) === (p._id || p.id))
    );

    const discounted = products
      .filter((p) => {
        const orig = Number(p.price ?? p.originalPrice) || 0;
        const curr = Number(p.salePrice ?? p.price) || 0;
        const alreadyIn = explicitMatches.some((ep) => (ep._id || ep.id) === (p._id || p.id)) ||
                          marked.some((m) => (m._id || m.id) === (p._id || p.id));
        return !alreadyIn && orig > curr && curr > 0;
      })
      .sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a));

    const combinedList = [...explicitMatches, ...marked, ...discounted];
    if (combinedList.length >= 6) {
      return combinedList.slice(0, 16);
    }

    // Mix in remaining category products so the horizontal scrolling row always has plenty of items
    const remaining = products.filter((p) => !combinedList.some((c) => (c._id || c.id) === (p._id || p.id)));
    return [...combinedList, ...remaining].slice(0, 16);
  }, [products, categoryHeroConfig, settings?.categoryTopDeals, headerCategory, headerId]);

  // Top Deals custom title from CMS or default theme
  const topDealsTitle = useMemo(() => {
    if (categoryHeroConfig?.topDealsTitle?.trim()) {
      return categoryHeroConfig.topDealsTitle.trim();
    }
    const slugKey = headerCategory?.slug || '';
    if (settings?.categoryTopDeals?.[slugKey]?.title?.trim()) {
      return settings.categoryTopDeals[slugKey].title.trim();
    }
    if (settings?.categoryTopDeals?.[headerId]?.title?.trim()) {
      return settings.categoryTopDeals[headerId].title.trim();
    }
    return dealsTheme.title;
  }, [categoryHeroConfig, settings?.categoryTopDeals, headerCategory, headerId, dealsTheme.title]);

  // Prepare items for 2-row grid: insert Top Deals promo card at index 1 (Row 2, Col 1 matching reference image)
  const subCategoryGridItems = useMemo(() => {
    if (!subCategories || subCategories.length === 0) return [];
    const items = [...subCategories];
    if (topDealsProducts.length > 0) {
      items.splice(1, 0, {
        _id: '__top_deals_card__',
        isTopDealsPromo: true,
        name: 'Top deals',
      });
    }
    return items;
  }, [subCategories, topDealsProducts.length]);

  // Dynamic category hero banner from CMS HeroConfig, Settings, or default theme asset
  const bannerImg = useMemo(() => {
    const cmsBanner = categoryHeroConfig?.banners?.items?.find((b) => b?.imageUrl && b?.status !== 'inactive')?.imageUrl;
    if (cmsBanner) return cmsBanner;

    const settingsBanner = settings?.categoriesBanner?.banners?.find(
      (b) => String(b.headerCategoryId) === headerId && b.image
    )?.image;
    if (settingsBanner) return settingsBanner;

    return getCategoryBanner(headerCategory?.name, headerCategory?.slug);
  }, [categoryHeroConfig, settings?.categoriesBanner?.banners, headerId, headerCategory]);

  const isTwoRows = displayCategoriesList.length >= 8;

  return (
    <div className="w-full flex flex-col pb-20 select-none animate-in fade-in duration-300">
      {/* ── 1. HEADER CATEGORY BANNER (ATTACHED DIRECTLY TO HEADER LIKE REFERENCE IMAGE) ── */}
      {bannerImg && (
        <div className="w-full relative overflow-hidden select-none">
          <img
            src={bannerImg}
            alt={headerCategory?.name || 'Category Offer Banner'}
            className="w-full h-auto object-cover max-h-[480px] sm:max-h-[560px] md:max-h-[640px] shadow-2xs"
            loading="eager"
            fetchPriority="high"
          />
        </div>
      )}

      {/* ── 2. TOP CATEGORIES (PLACED DIRECTLY BELOW THE BANNER AS REQUESTED) ── */}
      {displayCategoriesList.length > 0 && (
        <section className="mt-3.5 mb-2">
          {/* Section Header */}
          <div className="px-4 pb-2.5 flex items-center justify-between">
            <h2 className="text-[17px] sm:text-[18px] font-bold text-slate-900 tracking-tight leading-none">
              Top categories
            </h2>
          </div>

          {/* Horizontal Scrollable Grid (Both rows scroll together in unified container) */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="w-full overflow-x-auto no-scrollbar scroll-smooth px-4"
          >
            <div
              className={cn(
                "grid grid-flow-col auto-cols-[calc((100vw-72px)/4.5)] sm:auto-cols-[88px] gap-x-2.5 sm:gap-x-3 pb-0.5",
                isTwoRows ? "grid-rows-2 gap-y-3 sm:gap-y-3.5" : "grid-rows-1"
              )}
            >
              {displayCategoriesList.map((cat) => {
                const catId = cat._id || cat.id;
                const isSelected =
                  String(selectedMainCatId) === String(catId) ||
                  String(selectedSubCatId) === String(catId);
                const imageSrc =
                  cat.image || cat.icon || 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png';

                return (
                  <button
                    key={catId}
                    type="button"
                    onClick={() => handleCategoryClick(cat)}
                    className="group flex flex-col items-center text-center cursor-pointer select-none active:scale-95 transition-transform"
                  >
                    {/* Big rounded square tile with soft matching category background */}
                    <div
                      className={cn(
                        'w-full aspect-square rounded-2xl flex items-center justify-center p-0 overflow-hidden transition-all duration-200 shadow-2xs group-hover:brightness-[0.97]',
                        isSelected
                          ? 'border-2 shadow-xs'
                          : 'border'
                      )}
                      style={{
                        backgroundColor: isSelected ? cardSelectedBgColor : cardBgColor,
                        borderColor: isSelected ? headerBaseColor : cardBorderColor,
                        boxShadow: isSelected ? `0 0 0 2px ${cardRingColor}` : undefined,
                      }}
                    >
                      <img
                        src={applyCloudinaryTransform(imageSrc, 'f_auto,q_auto,w_300')}
                        alt={cat.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>

                    {/* Category Name below */}
                    <span
                      className={cn(
                        'mt-1.5 text-[11px] sm:text-[12px] leading-tight font-semibold line-clamp-2 w-full text-center tracking-tight transition-colors',
                        isSelected ? 'font-bold' : 'text-[#0a2540]'
                      )}
                      style={{
                        color: isSelected ? headerBaseColor : '#0a2540',
                      }}
                    >
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Centered Scroll Progress Indicator Pill (Matching Reference Design) */}
          {canScroll && (
            <div className="w-11 h-1 bg-slate-200/90 rounded-full mx-auto mt-3 overflow-hidden relative">
              <div
                className="h-full w-4.5 bg-slate-400 rounded-full transition-all duration-75 ease-out"
                style={{
                  transform: `translateX(${scrollProgress * 26}px)`,
                }}
              />
            </div>
          )}
        </section>
      )}

      {/* ── 2.2 THIN STRAIGHT LINE & SUBCATEGORIES SECTION (2 ROWS, 5 IN ONE PAGE WITH SIDE SCROLLING) ── */}
      {subCategoryGridItems.length > 0 && (
        <section className="mt-1 mb-2">
          {/* Thin straight line (barely visible for separation as requested) */}
          <div className="mx-4 mb-3.5 h-[1px] bg-slate-200/60" />

          {/* Horizontal Scrollable Subcategories Grid (2 rows, 5 per page with side scrolling) */}
          <div className="w-full overflow-x-auto no-scrollbar scroll-smooth px-4 pb-1">
            <div className="grid grid-rows-2 grid-flow-col auto-cols-[calc((100vw-64px)/5)] sm:auto-cols-[72px] gap-x-2.5 sm:gap-x-3.5 gap-y-2.5">
              {subCategoryGridItems.map((sub) => {
                // If it is the special Top Deals promo card (placed in Row 2, Col 1 matching reference image)
                if (sub.isTopDealsPromo) {
                  return (
                    <button
                      key="__top_deals_promo__"
                      type="button"
                      onClick={handleTopDealsCardClick}
                      className="group flex flex-col items-center text-center cursor-pointer select-none active:scale-95 transition-transform"
                    >
                      {/* Solid Blue Top Deals Card with Amber Bottom Border matching reference */}
                      <div className="w-full aspect-square rounded-2xl bg-gradient-to-b from-[#2563eb] to-[#1d4ed8] border border-blue-400/40 border-b-[3.5px] border-b-[#f59e0b] shadow-2xs p-1 flex flex-col items-center justify-center text-center overflow-hidden transition-all duration-200 group-hover:scale-105">
                        <span className="text-[7.5px] sm:text-[8px] font-black text-white/90 uppercase tracking-tight leading-none">
                          MIN.
                        </span>
                        <span className="text-[16px] sm:text-[17px] font-black text-white leading-none tracking-tighter my-0.5">
                          70%
                        </span>
                        <span className="text-[8.5px] sm:text-[9px] font-extrabold text-white uppercase tracking-tight leading-none">
                          OFF
                        </span>
                      </div>
                      <span className="mt-1 text-[11px] sm:text-[11.5px] leading-tight font-semibold text-slate-800 line-clamp-1 w-full text-center tracking-tight">
                        Top deals
                      </span>
                    </button>
                  );
                }

                const subId = sub._id || sub.id;
                const imageSrc =
                  sub.image ||
                  sub.icon ||
                  subcategoryImageFallbackMap[String(subId)] ||
                  'https://cdn-icons-png.flaticon.com/128/2321/2321831.png';

                return (
                  <button
                    key={subId}
                    type="button"
                    onClick={() => handleSubCategoryClick(sub)}
                    className="group flex flex-col items-center text-center cursor-pointer select-none active:scale-95 transition-transform"
                  >
                    {/* Warm cream tile with golden bottom strip matching reference */}
                    <div className="w-full aspect-square rounded-2xl bg-[#fffdf8] border border-amber-200/50 border-b-[3.5px] border-b-[#f59e0b] shadow-2xs p-1.5 flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:scale-105">
                      <img
                        src={applyCloudinaryTransform(imageSrc, 'f_auto,q_auto,w_200')}
                        alt={sub.name}
                        loading="lazy"
                        className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                    <span className="mt-1 text-[11px] sm:text-[11.5px] leading-tight font-semibold text-slate-800 line-clamp-1 w-full text-center tracking-tight truncate">
                      {sub.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 2.5 TOP DEALS (FLIPKART STYLE CURVED CARD WITH DYNAMIC CATEGORY HEADER BACKGROUND & HORIZONTAL RIGHT SCROLL) ── */}
      {topDealsProducts.length > 0 && (
        <section id="top-deals-section" className="my-3.5 px-3 sm:px-4">
          <div
            className="w-full rounded-[24px] sm:rounded-[28px] p-3.5 sm:p-4 pt-3.5 pb-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)] relative overflow-hidden transition-all duration-300 select-none"
            style={{
              background: dealsTheme.gradient,
            }}
          >
            {/* Subtle background glow & light pattern matching Flipkart card */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-35 mix-blend-overlay"
              style={{
                backgroundImage: 'radial-gradient(circle at 85% 15%, rgba(255,255,255,0.7) 0%, transparent 45%), radial-gradient(circle at 10% 85%, rgba(255,255,255,0.3) 0%, transparent 40%)',
              }}
            />

            {/* Top row: Title */}
            <div className="relative z-10 flex items-center justify-between pb-3 px-0.5">
              <h2 className="text-[17px] sm:text-[19px] font-black text-white tracking-tight leading-tight drop-shadow-xs capitalize">
                {topDealsTitle}
              </h2>
            </div>

            {/* Horizontal scrollable row of Top Deals cards with right slide feature */}
            <div className="relative z-10 w-full overflow-x-auto no-scrollbar scroll-smooth pb-1 -mx-1 px-1">
              <div className="flex items-start gap-2.5 sm:gap-3.5">
                {topDealsProducts.map((product) => {
                  const id = product.id || product._id;
                  const originalPrice = Number(product.price ?? product.originalPrice) || 0;
                  const currentPrice = Number(product.salePrice ?? product.price) || 0;
                  const discount = getDiscountPercent(product);
                  const image =
                    product.mainImage ||
                    product.image ||
                    product.variants?.[0]?.images?.[0];
                  const isWish = isInWishlist(id);
                  const variantText = getProductVariantText(product);

                  return (
                    <div
                      key={`topdeal-${id}`}
                      onClick={() => openProduct(product)}
                      className="w-[124px] sm:w-[138px] shrink-0 flex flex-col items-center cursor-pointer select-none group"
                    >
                      {/* 1. Rounded Card Image Container */}
                      <div className="w-full aspect-square bg-white rounded-2xl p-2 sm:p-2.5 shadow-sm border border-white/35 flex items-center justify-center overflow-hidden relative group-hover:scale-[1.03] transition-transform duration-200">
                        {/* Subtle Wishlist Heart button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWishlist(product);
                          }}
                          aria-label="Wishlist"
                          className="absolute top-1.5 right-1.5 z-10 w-5.5 h-5.5 rounded-full bg-white/90 hover:bg-white shadow-2xs flex items-center justify-center active:scale-90 transition-transform"
                        >
                          <Heart
                            size={11}
                            className={isWish ? 'fill-red-500 text-red-500' : 'text-slate-400 hover:text-red-500'}
                          />
                        </button>

                        {image ? (
                          <img
                            src={applyCloudinaryTransform(image, 'f_auto,q_auto,w_300')}
                            alt={product.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <ImageOff size={26} className="text-slate-300" />
                        )}
                      </div>

                      {/* 2. Text details: Name -> Variant -> Price */}
                      <div className="w-full flex flex-col items-center mt-1.5 px-0.5 text-center">
                        {/* Product Name */}
                        <p className="m-0 p-0 text-[11.5px] sm:text-[12px] font-bold text-white leading-tight tracking-tight w-full truncate">
                          {product.name}
                        </p>

                        {/* Variant Text */}
                        {variantText && (
                          <p className="m-0 p-0 text-[9.5px] sm:text-[10px] text-white/80 font-medium truncate leading-tight w-full mt-0.5">
                            {variantText}
                          </p>
                        )}

                        {/* Price Row: Discounted Price + Strikethrough Original Price */}
                        <div className="m-0 p-0 flex items-center justify-center gap-1 mt-0.5 leading-tight flex-wrap">
                          <span className="text-[11.5px] sm:text-[12px] font-black text-white leading-tight">
                            ₹{currentPrice}
                          </span>
                          {originalPrice > currentPrice && (
                            <span className="text-[9.5px] sm:text-[10px] text-white/60 line-through font-normal leading-tight">
                              ₹{originalPrice}
                            </span>
                          )}
                          {discount > 0 && (
                            <span className="text-[9px] sm:text-[9.5px] font-black text-yellow-300 leading-tight">
                              {discount}% off
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. RECOMMENDED ITEMS TEXT (EXACT LIKE GIVEN IMAGE) ── */}
      <div id="recommended-items-section" className="px-4 pt-4 pb-2">
        <h2 className="text-[20px] font-black text-slate-900 tracking-tight leading-none">
          Recommended Items
        </h2>
        <p className="text-[13px] font-medium text-slate-500 mt-1">
          According to Your interest
        </p>
      </div>

      {/* ── 5. ALL PRODUCTS OF CATEGORY (2 IN ONE ROW) ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 px-3 pb-16">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col space-y-2">
              <div className="aspect-[4/4.5] bg-slate-200 animate-pulse rounded-2xl" />
              <div className="h-3.5 bg-slate-200 animate-pulse rounded-md w-3/4" />
              <div className="h-4 bg-slate-200 animate-pulse rounded-md w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="mx-3 my-6 p-8 bg-white rounded-2xl border border-slate-100 text-center flex flex-col items-center justify-center">
          <ImageOff size={38} className="text-slate-300 mb-2" />
          <h3 className="text-base font-bold text-slate-800">No Products Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            No products available for the selected category filters.
          </p>
          {(selectedMainCatId !== 'all' || selectedSubCatId !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSelectedMainCatId('all');
                setSelectedSubCatId('all');
              }}
              className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-full shadow-xs active:scale-95 transition-transform flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>Reset & View All {headerCategory?.name} Products</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4 pb-24">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id || product._id}
              product={product}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HeaderCategoryPageView;
