import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation as useRouterLocation, useParams } from "react-router-dom";
import { slugify } from "@/core/utils/productUrl";
import { motion, useScroll, useTransform } from "framer-motion";
import { isMobileOrWebView } from "@/core/utils/deviceUtils";
import { customerApi } from "../services/customerApi";
import MainLocationHeader from "../components/shared/MainLocationHeader";
import ExperienceBannerCarousel from "../components/experience/ExperienceBannerCarousel";
import { useLocation } from "../context/LocationContext";
import { useSettings } from "@core/context/SettingsContext";
import { useAuth } from "@core/context/AuthContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { getJSON, STORAGE_KEYS } from "@core/utils/storage";
import { useTranslation } from "@core/context/LanguageContext";
import { usePageTranslation } from "@/core/hooks/usePageTranslation";
import { useDynamicTranslation } from "@/core/hooks/useDynamicTranslation";
import { ICON_COMPONENTS } from "../constants/homeConstants";
import AllCategoriesGreeting from "../components/home/AllCategoriesGreeting";
import CuratedCategoryDealsSection from "../components/home/CuratedCategoryDealsSection";
import TopDealsOnProducts from "../components/home/TopDealsOnProducts";
import HeaderCategoryProductsSection from "../components/home/HeaderCategoryProductsSection";
import NewArrivalsSection from "../components/home/NewArrivalsSection";
import quickCommerceBanner from "@/assets/quick_commerce_banner.png";
import ForYouProductsSection from "../components/home/ForYouProductsSection";
import HeaderCategoryPageView from "../components/home/HeaderCategoryPageView";
import PageSkeleton from '@/shared/components/PageSkeleton';
import { getDefaultHomeHeroBanners } from '@shared/constants/homeHeroDefaults';
import { clearAllCache, invalidateCache } from "@core/api/dedupe";

const DEFAULT_CATEGORY_THEME = {
  gradient: "linear-gradient(to bottom, var(--primary), var(--brand-400))",
  shadow: "shadow-brand-500/20",
  accent: "text-[#1A1A1A]",
};

const ALL_CATEGORY = {
  id: "all",
  _id: "all",
  name: "All",
  icon: "🌟",
  theme: DEFAULT_CATEGORY_THEME,
  headerColor: "#0b1a8e",
  headerFontColor: "#FFFFFF",
  headerIconColor: "#FFFFFF",
  banner: {
    title: "HOUSEFULL",
    subtitle: "SALE",
    floatingElements: "sparkles",
    textColor: "text-white",
  },
};

const EMPTY_HERO_CONFIG = {
  banners: { items: getDefaultHomeHeroBanners() },
  categoryIds: [],
};

const homePageDataCache = new Map();
const heroConfigMemoryCache = {};

const HOME_PAGE_PERSISTENT_CACHE_KEY = "anushkakart:home_cache:v8";

const readPersistentHomeCache = (key) => {
  try {
    const raw = localStorage.getItem(HOME_PAGE_PERSISTENT_CACHE_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw);
    if (!store || typeof store !== "object") return null;
    const entry = store[key] || store["home:no-location"] || Object.values(store)[0] || null;
    if (entry && (!entry.categories || entry.categories.length <= 1)) {
      return null;
    }
    return entry;
  } catch {
    return null;
  }
};

const writePersistentHomeCache = (key, data) => {
  try {
    if (!data || !data.categories || data.categories.length <= 1) return;
    const raw = localStorage.getItem(HOME_PAGE_PERSISTENT_CACHE_KEY);
    const store = raw ? JSON.parse(raw) : {};
    store[key] = {
      categories: data.categories,
      activeCategory: data.activeCategory,
      categoryMap: data.categoryMap,
      subcategoryMap: data.subcategoryMap,
      formattedHeaders: data.formattedHeaders,
      heroConfig: data.heroConfig,
    };
    const keys = Object.keys(store);
    if (keys.length > 3) {
      delete store[keys[0]];
    }
    localStorage.setItem(HOME_PAGE_PERSISTENT_CACHE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
};

const getHomePageDataCacheKey = (location) => {
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "home:no-location";
  return `home:${lat.toFixed(5)}:${lng.toFixed(5)}`;
};

const homeStaticTexts = [
  "Subcategories",
  "View All",
  "No subcategories found.",
  "Latest in",
  "Search"
];

const getCachedHomePageData = (location) => {
  const key = getHomePageDataCacheKey(location);
  const inMemory = homePageDataCache.get(key);
  if (inMemory) return inMemory;
  const persisted = readPersistentHomeCache(key);
  if (persisted) {
    homePageDataCache.set(key, persisted);
    return persisted;
  }
  return null;
};

const Home = () => {
  const { headerSlug } = useParams();
  const { scrollY } = useScroll();
  const { user } = useAuth();
  const { currentLocation } = useLocation();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const cachedHomePageData = getCachedHomePageData(currentLocation);

  const { language } = useTranslation();
  const { getTranslatedText } = usePageTranslation(homeStaticTexts);
  const { translateObject } = useDynamicTranslation();

  const heroRef = useRef(null);
  const [heroVisible, setHeroVisible] = useState(true);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setHeroVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), { rootMargin: "0px" });
    const el = heroRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [categories, setCategories] = useState(() => cachedHomePageData?.categories || [ALL_CATEGORY]);
  const [activeCategory, setActiveCategory] = useState(() => cachedHomePageData?.activeCategory || ALL_CATEGORY);
  const [isLoading, setIsLoading] = useState(() => !cachedHomePageData);
  const [heroConfig, setHeroConfig] = useState(() => cachedHomePageData?.heroConfig || heroConfigMemoryCache.__home__ || EMPTY_HERO_CONFIG);
  const [categoryMap, setCategoryMap] = useState(() => cachedHomePageData?.categoryMap || {});
  const [subcategoryMap, setSubcategoryMap] = useState(() => cachedHomePageData?.subcategoryMap || {});

  const [displayCategories, setDisplayCategories] = useState(categories);
  const [displayCategoryMap, setDisplayCategoryMap] = useState(categoryMap);
  const [displaySubcategoryMap, setDisplaySubcategoryMap] = useState(subcategoryMap);

  // Synchronize activeCategory with URL route :headerSlug
  useEffect(() => {
    if (!categories || categories.length <= 1) return;

    if (!headerSlug || headerSlug.toLowerCase() === 'all') {
      const allCat = categories.find((c) => c._id === 'all' || c.id === 'all' || c.slug === 'all') || ALL_CATEGORY;
      setActiveCategory((prev) => {
        if (String(prev?._id || prev?.id) === String(allCat._id || allCat.id)) return prev;
        return allCat;
      });
      return;
    }

    const targetSlug = slugify(headerSlug);
    const matchedCategory = categories.find((c) => {
      const catSlug = slugify(c.slug || c.name || '');
      return catSlug === targetSlug;
    });

    if (matchedCategory) {
      setActiveCategory((prev) => {
        if (
          String(prev?._id || prev?.id) === String(matchedCategory._id || matchedCategory.id) &&
          prev?.headerColor === matchedCategory?.headerColor &&
          prev?.headerFontColor === matchedCategory?.headerFontColor
        ) {
          return prev;
        }
        return matchedCategory;
      });
    }
  }, [headerSlug, categories]);

  // Reset activeCategory to "All" when Home tab is clicked in BottomNav
  useEffect(() => {
    const handleResetHome = () => {
      const allCat = categories.find((c) => c._id === 'all' || c.id === 'all') || ALL_CATEGORY;
      setActiveCategory(allCat);
      if (headerSlug) {
        navigate('/', { replace: false });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('anushkakart:reset-home-category', handleResetHome);
    return () => {
      window.removeEventListener('anushkakart:reset-home-category', handleResetHome);
    };
  }, [categories, headerSlug, navigate]);

  // Also reset to "All" when navigated from another page with state.resetToAll
  useEffect(() => {
    if (routerLocation.state?.resetToAll) {
      const allCat = categories.find((c) => c._id === 'all' || c.id === 'all') || ALL_CATEGORY;
      setActiveCategory(allCat);
      if (headerSlug) {
        navigate('/', { replace: false });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [routerLocation.state, categories, headerSlug, navigate]);

  useEffect(() => {
    if (language === "en") {
      setDisplayCategories(categories);
      setDisplayCategoryMap(categoryMap);
      setDisplaySubcategoryMap(subcategoryMap);
      return;
    }

    let isMounted = true;
    const translateHomeContent = async () => {
      try {
        const txCategories = await translateObject(categories, ["name"]);

        const catArray = Object.values(categoryMap);
        const txCatArray = await translateObject(catArray, ["name"]);
        const txCatMap = {};
        txCatArray.forEach((c) => { txCatMap[c._id] = c; });

        const subArray = Object.values(subcategoryMap);
        const txSubArray = await translateObject(subArray, ["name"]);
        const txSubcatMap = {};
        txSubArray.forEach((s) => { txSubcatMap[s._id] = s; });

        if (isMounted) {
          setDisplayCategories(txCategories);
          setDisplayCategoryMap(txCatMap);
          setDisplaySubcategoryMap(txSubcatMap);
        }
      } catch (err) {
        console.error("Translation of home content failed:", err);
      }
    };

    translateHomeContent();
    return () => {
      isMounted = false;
    };
  }, [language, categories, categoryMap, subcategoryMap]);

  const applyHomePageData = (data, { cacheKey, persist = true } = {}) => {
    if (!data) return;
    setCategoryMap(data.categoryMap || {});
    setSubcategoryMap(data.subcategoryMap || {});
    setCategories(data.categories || [ALL_CATEGORY]);
    if (data.heroConfig) setHeroConfig(data.heroConfig);
    setActiveCategory((prev) => {
      if (headerSlug && headerSlug.toLowerCase() !== 'all') {
        const targetSlug = slugify(headerSlug);
        const matchFromUrl = (data.categories || []).find((c) => slugify(c.slug || c.name || '') === targetSlug);
        if (matchFromUrl) return matchFromUrl;
      }
      const parsed = getJSON(STORAGE_KEYS.EXPERIENCE_RETURN, null, { storage: "session" });
      if (parsed?.headerId) {
        const match = (data.formattedHeaders || []).find((h) => h._id === parsed.headerId);
        if (match) return match;
      }
      if (!prev || prev._id === "all") return data.activeCategory || data.categories?.[0] || ALL_CATEGORY;
      return (data.categories || []).find((cat) => cat._id === prev._id) || data.activeCategory || prev;
    });
    if (persist && cacheKey) {
      homePageDataCache.set(cacheKey, data);
      writePersistentHomeCache(cacheKey, data);
    }
  };

  const fetchData = async ({ forceRefresh = false } = {}) => {
    const cacheKey = getHomePageDataCacheKey(currentLocation);
    const cached = getCachedHomePageData(currentLocation);

    // Instant SWR: Render cached UI immediately (<100ms) on reload/return visit
    if (cached && !forceRefresh) {
      applyHomePageData(cached, { cacheKey, persist: false });
      setIsLoading(false);
    } else if (!cached) {
      setIsLoading(true);
    }

    try {
      // Fast endpoints for Hero config & Categories in parallel
      const [heroRes, catRes] = await Promise.all([
        customerApi.getHeroConfig({ pageType: "home" }).catch(() => null),
        customerApi.getCategories().catch(() => null),
      ]);

      const partialHomeData = {
        categories: [ALL_CATEGORY],
        activeCategory: ALL_CATEGORY,
        categoryMap: cached?.categoryMap || {},
        subcategoryMap: cached?.subcategoryMap || {},
        formattedHeaders: cached?.formattedHeaders || [],
        heroConfig: heroConfigMemoryCache.__home__ || EMPTY_HERO_CONFIG,
      };

      if (heroRes?.data?.success && heroRes.data?.result) {
        partialHomeData.heroConfig = heroRes.data.result;
        heroConfigMemoryCache.__home__ = heroRes.data.result;
        setHeroConfig(heroRes.data.result);
      }

      if (catRes?.data?.success) {
        const dbCats = catRes.data.results || catRes.data.result || [];
        const catMap = {};
        const subMap = {};
        dbCats.forEach((c) => { if (c.type === "category") catMap[c._id] = c; else if (c.type === "subcategory") subMap[c._id] = c; });
        partialHomeData.categoryMap = catMap;
        partialHomeData.subcategoryMap = subMap;
        const formattedHeaders = dbCats.filter((cat) => cat.type === "header").map((cat) => {
          const catName = cat.name;
          const IconComp = (cat.iconId && ICON_COMPONENTS[cat.iconId]) || cat.icon || "✨";
          const imageIcon = cat.iconImage || cat.iconUrl || null;
          return {
            ...cat,
            id: cat._id,
            icon: imageIcon || IconComp,
            theme: DEFAULT_CATEGORY_THEME,
            banner: { title: catName.toUpperCase(), subtitle: "TOP PICKS", textColor: "text-white" },
          };
        });
        partialHomeData.formattedHeaders = formattedHeaders;
        const allHeaderFromAdmin = formattedHeaders.find((h) => (h.slug?.toLowerCase() === "all") || (h.name?.toLowerCase() === "all"));
        const masterHeaderColor = allHeaderFromAdmin?.headerColor || ALL_CATEGORY.headerColor || "#0b1a8e";
        const mergedAllCategory = allHeaderFromAdmin ? { 
          ...ALL_CATEGORY, 
          name: allHeaderFromAdmin.name || ALL_CATEGORY.name,
          image: allHeaderFromAdmin.image || null,
          headerColor: masterHeaderColor, 
          headerFontColor: "#FFFFFF", 
          headerIconColor: "#FFFFFF", 
          icon: allHeaderFromAdmin.icon || ALL_CATEGORY.icon,
          iconId: allHeaderFromAdmin.iconId || null,
        } : { ...ALL_CATEGORY, headerColor: masterHeaderColor };

        // All category headers inherit the masterHeaderColor from "All" category
        const syncedHeaders = formattedHeaders.map((cat) => ({
          ...cat,
          headerColor: masterHeaderColor,
          headerFontColor: "#FFFFFF",
          headerIconColor: "#FFFFFF",
        }));

        partialHomeData.categories = [mergedAllCategory, ...syncedHeaders.filter((h) => !((h.slug?.toLowerCase() === "all") || (h.name?.toLowerCase() === "all")))];
        partialHomeData.activeCategory = mergedAllCategory;

        setCategories(partialHomeData.categories);
        setActiveCategory((currentActive) => {
          if (!currentActive || currentActive._id === "all" || currentActive.id === "all" || currentActive.slug === "all") {
            return mergedAllCategory;
          }
          const fresh = partialHomeData.categories.find(
            (c) => String(c._id || c.id) === String(currentActive._id || currentActive.id)
          );
          return fresh ? { ...fresh, headerColor: masterHeaderColor, headerFontColor: "#FFFFFF", headerIconColor: "#FFFFFF" } : currentActive;
        });
        setCategoryMap(catMap);
        setSubcategoryMap(subMap);
      }

      setIsLoading(false);
      applyHomePageData(partialHomeData, { cacheKey, persist: true });
    } catch (error) {
      console.error("Error fetching home data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [currentLocation?.latitude, currentLocation?.longitude]);

  // Auto-retry if initial fetch happened while backend was still starting up (only "All" category present)
  useEffect(() => {
    if (categories.length <= 1 && !isLoading) {
      const timer = setTimeout(() => {
        fetchData({ forceRefresh: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [categories.length, isLoading]);
  const heroConfigCache = useRef(heroConfigMemoryCache);

  useEffect(() => {
    const fetchHeroConfig = async (force = false) => {
      try {
        const isHeader = activeCategory && activeCategory._id !== "all";
        const cacheKey = isHeader ? activeCategory._id : "__home__";
        if (!force) {
          if (heroConfigCache.current[cacheKey]) {
            setHeroConfig(heroConfigCache.current[cacheKey]);
            return;
          } else if (!isHeader && heroConfigMemoryCache.__home__) {
            setHeroConfig(heroConfigMemoryCache.__home__);
            return;
          }
        }
        let payload = null;
        if (isHeader) {
          const res = await customerApi.getHeroConfig(
            { pageType: "header", headerId: activeCategory._id },
            { forceRefresh: force }
          );
          if (res.data?.success && res.data?.result) payload = res.data.result;
        }
        if (!payload || (payload.banners?.items?.length === 0 && !payload.categoryIds?.length)) {
          const homeRes = await customerApi.getHeroConfig(
            { pageType: "home" },
            { forceRefresh: force }
          );
          if (homeRes.data?.success && homeRes.data?.result) payload = homeRes.data.result;
        }
        const resolved = payload
          ? {
              ...payload,
              banners: payload.banners || { items: [] },
              categoryIds: payload.categoryIds || [],
            }
          : { banners: { items: [] }, categoryIds: [] };
        heroConfigCache.current[cacheKey] = resolved;
        if (!isHeader) {
          heroConfigMemoryCache.__home__ = resolved;
        }
        if (cacheKey === "__home__") {
          const homeCacheKey = getHomePageDataCacheKey(currentLocation);
          const cachedHomeData = homePageDataCache.get(homeCacheKey);
          if (cachedHomeData) homePageDataCache.set(homeCacheKey, { ...cachedHomeData, heroConfig: resolved });
        }
        setHeroConfig(resolved);
      } catch (e) {
        setHeroConfig(EMPTY_HERO_CONFIG);
      }
    };
    fetchHeroConfig();

    const handleCmsUpdate = () => {
      clearAllCache();
      invalidateCache("/experience/hero");
      delete heroConfigMemoryCache.__home__;
      heroConfigCache.current = {};
      homePageDataCache.clear();
      try {
        localStorage.removeItem(HOME_PAGE_PERSISTENT_CACHE_KEY);
      } catch (_) {}
      fetchHeroConfig(true);
      fetchData({ forceRefresh: true });
    };

    const handleStorageEvent = (e) => {
      if (e.key === "anushkakart:cms_version" || e.key === HOME_PAGE_PERSISTENT_CACHE_KEY) {
        handleCmsUpdate();
      }
    };

    window.addEventListener("anushkakart:cms_updated", handleCmsUpdate);
    window.addEventListener("storage", handleStorageEvent);

    let bc = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel("anushkakart_cms");
        bc.onmessage = (msg) => {
          if (msg.data?.type === "cms_updated") {
            handleCmsUpdate();
          }
        };
      } catch (_) {}
    }

    return () => {
      window.removeEventListener("anushkakart:cms_updated", handleCmsUpdate);
      window.removeEventListener("storage", handleStorageEvent);
      if (bc) {
        try { bc.close(); } catch (_) {}
      }
    };
  }, [activeCategory, currentLocation?.latitude, currentLocation?.longitude]);

  useEffect(() => {
    const firstUrl = heroConfig?.banners?.items?.[0]?.imageUrl;
    if (!firstUrl) return;
    const link = document.createElement("link");
    link.rel = "preload"; link.as = "image"; link.href = applyCloudinaryTransform(firstUrl, "f_auto,q_auto,c_scale,w_824");
    link.setAttribute("fetchpriority", "high"); document.head.appendChild(link);
    return () => { if (link.parentNode) link.parentNode.removeChild(link); };
  }, [heroConfig?.banners?.items?.[0]?.imageUrl]);

  const isAllCategorySelected = !activeCategory || activeCategory._id === "all" || activeCategory.id === "all";
  const firstName = String(user?.firstName || user?.name || '').trim().split(/\s+/)[0] || 'Guest';
  const allMainCategories = useMemo(() => {
    const headerOrder = new Map(displayCategories.map((header, index) => [String(header._id || header.id), index]));
    return Object.values(displayCategoryMap)
      .filter((category) => category.type === 'category')
      .sort((first, second) => {
        const firstParent = String(first.parentId?._id || first.parentId || first.headerId?._id || first.headerId || '');
        const secondParent = String(second.parentId?._id || second.parentId || second.headerId?._id || second.headerId || '');
        return (headerOrder.get(firstParent) ?? Number.MAX_SAFE_INTEGER) - (headerOrder.get(secondParent) ?? Number.MAX_SAFE_INTEGER)
          || Number(first.sortOrder || 0) - Number(second.sortOrder || 0)
          || first.name.localeCompare(second.name);
      })
      .map((category) => ({ id: category._id || category.id, name: category.name, image: category.image || category.iconImage || '' }));
  }, [displayCategories, displayCategoryMap]);

  const isMobile = useMemo(() => isMobileOrWebView(), []);
  const opacity = useTransform(scrollY, (heroVisible && !isMobile) ? [0, 300] : [0, 0], [1, 0.6]);
  const y = useTransform(scrollY, (heroVisible && !isMobile) ? [0, 300] : [0, 0], [0, 0]);
  const scale = useTransform(scrollY, (heroVisible && !isMobile) ? [0, 300] : [0, 0], [1, 0.95]);
  const pointerEvents = useTransform(scrollY, (heroVisible && !isMobile) ? [0, 100] : [0, 0], ["auto", "none"]);

  const handleCategorySelect = (cat) => {
    const isAll = !cat || cat.id === "all" || cat._id === "all" || cat.slug === "all" || (cat.name && cat.name.toLowerCase() === "all");
    if (isAll) {
      setActiveCategory(ALL_CATEGORY);
      if (headerSlug) {
        navigate('/', { replace: false });
      }
    } else {
      setActiveCategory(cat);
      const catSlug = slugify(cat.slug || cat.name);
      if (catSlug && catSlug !== headerSlug) {
        navigate(`/${catSlug}`, { replace: false });
      }
    }
    if (window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div
      className="min-h-screen bg-white pt-[calc(194px+env(safe-area-inset-top,0px))] sm:pt-[calc(200px+env(safe-area-inset-top,0px))] md:pt-[168px]"
    >
      <MainLocationHeader 
        categories={displayCategories} 
        activeCategory={activeCategory} 
        onCategorySelect={handleCategorySelect}
      />

      {isLoading && !cachedHomePageData && categories.length <= 1 ? (
        <PageSkeleton variant="home-content" />
      ) : (
        <div className="w-full transition-opacity duration-150">
        {isAllCategorySelected && (() => {
          const configuredBanners = (heroConfig.banners?.items || []).filter(
            (b) => b && b.imageUrl && b.status !== "inactive"
          );
          const homeBanners = configuredBanners.length > 0
            ? configuredBanners
            : getDefaultHomeHeroBanners();
          if (homeBanners.length === 0) return null;

          return (
            <motion.div ref={heroRef} className="block will-change-transform pt-0" style={isMobile ? { opacity: 1 } : { opacity, y, scale, pointerEvents }}>
              <div className="w-full min-w-0 max-w-none px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 2xl:px-16 mt-1.5 sm:mt-2 md:mt-4 mb-1 relative z-20 overflow-hidden">
                <ExperienceBannerCarousel
                  section={{ title: "" }}
                  items={homeBanners}
                  fullWidth
                  edgeToEdge={false}
                  peekNext={true}
                  autoPlayInterval={2500}
                  showDots={true}
                  showContentOverlay={false}
                />
              </div>
            </motion.div>
          );
        })()}

        {isAllCategorySelected && (
          <AllCategoriesGreeting
            categories={allMainCategories}
            firstName={firstName}
            greetingConfig={heroConfig?.greetingSection}
          />
        )}
        {isAllCategorySelected && (
          <CuratedCategoryDealsSection
            pageType="home"
            heroConfig={heroConfig}
            subCategories={Object.values(displaySubcategoryMap || {})}
          />
        )}
        {isAllCategorySelected && (
          <TopDealsOnProducts
            latitude={currentLocation?.latitude}
            longitude={currentLocation?.longitude}
            subcategoryMap={displaySubcategoryMap}
            categoryMap={displayCategoryMap}
          />
        )}
        {isAllCategorySelected && <HeaderCategoryProductsSection latitude={currentLocation?.latitude} longitude={currentLocation?.longitude} heroConfig={heroConfig} />}
        {isAllCategorySelected && (
          <div className="w-full max-w-none px-0 sm:px-4 md:px-6 lg:px-8 xl:px-12 2xl:px-16">
            <NewArrivalsSection latitude={currentLocation?.latitude} longitude={currentLocation?.longitude} />
          </div>
        )}

        {isAllCategorySelected && (() => {
          const bannerConfig = settings?.categoriesBanner;
          if (bannerConfig?.isVisible === false) return null;

          const banners = bannerConfig?.banners || [];
          // Look for banner specifically targeted for 'all' / empty
          const allBanner = banners.find((b) => {
            if (!b || !b.image) return false;
            const target = String(b.headerCategoryId || '').trim().toLowerCase();
            return !target || target === 'all';
          });

          const bannerImg = allBanner?.image || quickCommerceBanner;
          const bannerLink = allBanner?.buttonLink || allBanner?.link || "/category/all";

          const handleBannerClick = () => {
            if (!bannerLink) return;
            if (bannerLink.startsWith('http://') || bannerLink.startsWith('https://')) {
              window.open(bannerLink, '_blank', 'noopener,noreferrer');
            } else {
              window.scrollTo({ top: 0, behavior: "smooth" });
              navigate(bannerLink);
            }
          };

          return (
            <div className="w-full max-w-none px-2.5 sm:px-4 md:px-6 my-2 sm:my-2.5">
              <div
                className="w-full max-w-[1000px] mx-auto overflow-hidden rounded-xl md:rounded-2xl shadow-sm border border-slate-100/80 bg-white cursor-pointer hover:opacity-95 transition-all"
                onClick={handleBannerClick}
              >
                <img
                  src={bannerImg}
                  alt={allBanner?.title || "Anushka Store Quick Commerce - Daily Essentials Delivered in Minutes"}
                  className="w-full h-auto max-h-[220px] object-cover block"
                  loading="lazy"
                />
              </div>
            </div>
          );
        })()}

        {isAllCategorySelected && (
          <div className="w-full max-w-none px-0 sm:px-4 md:px-6 lg:px-8 xl:px-12 2xl:px-16">
            <ForYouProductsSection
              categories={displayCategories}
              latitude={currentLocation?.latitude}
              longitude={currentLocation?.longitude}
            />
          </div>
        )}

        {!isAllCategorySelected && (
          <div className="w-full max-w-none px-0 sm:px-4 md:px-6 lg:px-8 xl:px-12 2xl:px-16">
            <HeaderCategoryPageView
              headerCategory={activeCategory}
              categoryMap={displayCategoryMap}
              subcategoryMap={displaySubcategoryMap}
              currentLocation={currentLocation}
            />
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default Home;
