import React, { useEffect, useState, useMemo } from "react";
import {
  HiOutlinePencilSquare,
  HiOutlinePhoto,
  HiOutlinePlus,
  HiOutlineXMark,
  HiOutlineMagnifyingGlass,
  HiOutlineCheck,
  HiOutlineArrowUp,
  HiOutlineArrowDown,
  HiOutlineSparkles,
  HiOutlineTrash,
  HiOutlineTag,
  HiOutlineBolt,
  HiOutlineTableCells,
  HiOutlineArrowPath,
  HiOutlineSun,
} from "react-icons/hi2";
import { adminApi } from "../services/adminApi";
import Card from "@shared/components/ui/Card";
import { useToast } from "@shared/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getDefaultHomeHeroBanners } from "@shared/constants/homeHeroDefaults";
import { clearAllCache } from "@/core/api/dedupe";

// Default banners for "All" page header category sections
import freshGroceryAllBanner from "@/assets/banners/fresh_grocery_all_banner.jpg";
import electronicsAllBanner from "@/assets/banners/electronics_all_banner.jpg";
import mobilesAllBanner from "@/assets/banners/mobiles_all_banner.jpg";
import beautyAllBanner from "@/assets/banners/beauty_all_banner.jpg";
import fashionAllBanner from "@/assets/banners/fashion_all_banner.jpg";
import homeAllBanner from "@/assets/banners/home_all_banner.jpg";

// Default banners for Category pages
import groceryBannerImg from "@/assets/banners/groceries_header_banner.jpg";
import electronicsBannerImg from "@/assets/banners/electronics_section_banner.jpg";
import mobilesBannerImg from "@/assets/banners/mobiles_section_banner.jpg";
import beautyBannerImg from "@/assets/banners/beauty_section_banner.jpg";
import fashionBannerImg from "@/assets/banners/fashion_section_banner.jpg";
import homeAppliancesBannerImg from "@/assets/banners/home_appliances_section_banner.jpg";

const getDefaultCategoryHeroBanner = (name = "", slug = "") => {
  const text = `${name || ""} ${slug || ""}`.toLowerCase();
  if (/grocer/i.test(text)) return groceryBannerImg;
  if (/electr/i.test(text)) return electronicsBannerImg;
  if (/mobil|phone|smartphon/i.test(text)) return mobilesBannerImg;
  if (/beaut|cosmetic|skin/i.test(text)) return beautyBannerImg;
  if (/fashion|cloth|apparel/i.test(text)) return fashionBannerImg;
  if (/home|appliance|kitchen/i.test(text)) return homeAppliancesBannerImg;
  return null;
};

const getDefaultSectionBannerForCategory = (name = "", slug = "") => {
  const text = `${name || ""} ${slug || ""}`.toLowerCase();
  if (/grocer/i.test(text)) return freshGroceryAllBanner;
  if (/electr/i.test(text)) return electronicsAllBanner;
  if (/mobil|phone|smartphon/i.test(text)) return mobilesAllBanner;
  if (/beaut|cosmetic|skin/i.test(text)) return beautyAllBanner;
  if (/fashion|cloth|apparel/i.test(text)) return fashionAllBanner;
  if (/home|appliance|kitchen/i.test(text)) return homeAllBanner;
  return null;
};

const emptyBannerItem = () => ({
  imageUrl: "",
  title: "",
  subtitle: "",
  linkType: "none",
  linkValue: "",
  isUploading: false,
});

const ensureValidHex = (val, fallback = "#ffffff") => {
  if (!val) return fallback;
  const s = String(val).trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return fallback;
};

export default function HeroCategoriesPerPage() {
  const { showToast } = useToast();
  const [headers, setHeaders] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [allSubcategories, setAllSubcategories] = useState([]);
  const [pageData, setPageData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active page selector ('home' or headerId)
  const [selectedPageId, setSelectedPageId] = useState("home");
  const [activeTab, setActiveTab] = useState("heroBanners");
  const [editingRow, setEditingRow] = useState(null);

  // Form states
  const [formBanners, setFormBanners] = useState([emptyBannerItem()]);
  const [formCategoryIds, setFormCategoryIds] = useState([]);

  // Custom Top Deals & Best Selling states
  const [formTopDealsTitle, setFormTopDealsTitle] = useState("");
  const [formTopDealsProductIds, setFormTopDealsProductIds] = useState([]);
  const [formTopDealsBgColor, setFormTopDealsBgColor] = useState("");
  const [formTopDealsTextColor, setFormTopDealsTextColor] = useState("");
  const [formTopDealsProductNameColor, setFormTopDealsProductNameColor] = useState("");
  const [formTopDealsPriceColor, setFormTopDealsPriceColor] = useState("");
  const [formBestSellingTitle, setFormBestSellingTitle] = useState("Best Selling Categories");
  const [formBestSellingCategoryIds, setFormBestSellingCategoryIds] = useState([]);

  // Custom Category Sections Banners for Home ("All") page
  const [formSectionBanners, setFormSectionBanners] = useState([]);

  // Products available for category top deals selection
  const [categoryProducts, setCategoryProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [subcatSearchQuery, setSubcatSearchQuery] = useState("");

  // Curated Category Deals states
  const [formCuratedDealsEnabled, setFormCuratedDealsEnabled] = useState(true);
  const [formCuratedDealsTitle, setFormCuratedDealsTitle] = useState("");
  const [formCuratedTopBgColor, setFormCuratedTopBgColor] = useState("#FAF8F5");
  const [formCuratedBottomBgColor, setFormCuratedBottomBgColor] = useState("");
  const [formCuratedTextColor, setFormCuratedTextColor] = useState("#FFFFFF");
  const [formCuratedItems, setFormCuratedItems] = useState([]);
  const [curatedSearchQuery, setCuratedSearchQuery] = useState("");

  // Greeting Section states ("Good afternoon..." on "All" page)
  const [formGreetingEnabled, setFormGreetingEnabled] = useState(true);
  const [formGreetingTitle, setFormGreetingTitle] = useState("Good Afternoon, {name}! ☀️");
  const [formGreetingTitleColor, setFormGreetingTitleColor] = useState("#242424");
  const [formGreetingBgColor, setFormGreetingBgColor] = useState(
    "linear-gradient(135deg, #ffe078 0%, #ffeb9c 50%, #fff2bc 100%)"
  );
  const [formGreetingCardBgColor, setFormGreetingCardBgColor] = useState("#ffffff");
  const [formGreetingCardNameBgColor, setFormGreetingCardNameBgColor] = useState("#2563eb");
  const [formGreetingCardNameTextColor, setFormGreetingCardNameTextColor] = useState("#FFFFFF");
  const [formGreetingCategoryIds, setFormGreetingCategoryIds] = useState([]);
  const [greetingCatSearchQuery, setGreetingCatSearchQuery] = useState("");
  const [extraCategoryInfo, setExtraCategoryInfo] = useState({});

  const [saving, setSaving] = useState(false);

  // 1. Initial Load: Fetch category tree & all configs
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const treeRes = await adminApi.getCategoryTree();
        const tree = treeRes.data?.results || treeRes.data?.result || [];
        const rawHeaders = Array.isArray(tree) ? tree : [];
        const headerList = rawHeaders.filter(
          (h) =>
            h.name?.trim().toLowerCase() !== "all" &&
            h.slug?.trim().toLowerCase() !== "all"
        );
        if (cancelled) return;
        setHeaders(headerList);

        const flatCategories = headerList.flatMap((h) =>
          (h.children || []).map((c) => ({ ...c, headerName: h.name }))
        );
        setAllCategories(flatCategories);

        const flatSubs = headerList.flatMap((h) =>
          (h.children || []).flatMap((c) =>
            (c.children || []).map((s) => ({
              ...s,
              parentName: c.name,
              parentId: c._id,
              headerName: h.name,
              headerId: h._id,
            }))
          )
        );
        setAllSubcategories(flatSubs);

        const homeRes = await adminApi.getHeroConfig({ pageType: "home" });
        const homeResult = homeRes.data?.result || homeRes.data || {};
        const homeBanners = homeResult.banners?.items || [];
        const homeCatIds = homeResult.categoryIds || [];

        const rows = [
          {
            id: "home",
            label: "Home Page (All)",
            pageType: "home",
            headerId: null,
            bannerCount:
              homeBanners.length > 0
                ? homeBanners.length
                : getDefaultHomeHeroBanners().length,
            categoryCount: homeCatIds.length,
            customTitle: homeResult.bestSellingTitle || "Best Selling Categories",
            curatedTitle: homeResult.curatedDeals?.title || "Top Category Deals",
            curatedCount: (homeResult.curatedDeals?.items || []).length,
            curatedEnabled: homeResult.curatedDeals?.enabled !== false,
            greetingTitle:
              homeResult.greetingSection?.title || "Good Afternoon, {name}! ☀️",
            greetingCount: (homeResult.greetingSection?.categoryIds || []).length,
            greetingEnabled: homeResult.greetingSection?.enabled !== false,
          },
        ];

        await Promise.all(
          headerList.map(async (h) => {
            const res = await adminApi.getHeroConfig({
              pageType: "header",
              headerId: h._id,
            });
            if (cancelled) return;
            const result = res.data?.result || res.data || {};
            const items = result.banners?.items || [];
            const catIds = result.categoryIds || [];
            rows.push({
              id: h._id,
              label: h.name || "Unnamed",
              pageType: "header",
              headerId: h._id,
              bannerCount: items.length,
              categoryCount: catIds.length,
              customTitle: result.topDealsTitle || `Top deals on ${h.name || "category"}`,
              dealProductCount: (result.topDealsProductIds || []).length,
              curatedTitle:
                result.curatedDeals?.title ||
                (/beaut/i.test(h.name)
                  ? "Men's grooming deals"
                  : `Deals on ${h.name}`),
              curatedCount: (result.curatedDeals?.items || []).length,
              curatedEnabled: result.curatedDeals?.enabled !== false,
            });
          })
        );

        if (!cancelled) {
          setPageData(rows);
          // Set initial page as 'home'
          const homeRow = rows[0];
          setEditingRow(homeRow);
          loadConfigIntoState(homeRow, headerList);
        }
      } catch (e) {
        if (!cancelled) console.error(e);
        showToast("Failed to load hero config", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // Load configuration for selected page
  const loadConfigIntoState = async (row, availableHeaders = headers) => {
    setFormCategoryIds([]);
    setFormBanners([emptyBannerItem()]);
    setFormTopDealsTitle("");
    setFormTopDealsProductIds([]);
    setFormTopDealsBgColor("");
    setFormTopDealsTextColor("");
    setFormTopDealsProductNameColor("");
    setFormTopDealsPriceColor("");
    setFormBestSellingTitle("Best Selling Categories");
    setFormBestSellingCategoryIds([]);
    setCategoryProducts([]);
    setProductSearchQuery("");
    setSubcatSearchQuery("");
    setFormCuratedDealsEnabled(true);
    setFormCuratedDealsTitle("");
    setFormCuratedTopBgColor("#FAF8F5");
    setFormCuratedBottomBgColor("");
    setFormCuratedTextColor("#FFFFFF");
    setFormCuratedItems([]);
    setCuratedSearchQuery("");
    setFormGreetingEnabled(true);
    setFormGreetingTitle("Good Afternoon, {name}! ☀️");
    setFormGreetingTitleColor("#242424");
    setFormGreetingBgColor(
      "linear-gradient(135deg, #ffe078 0%, #ffeb9c 50%, #fff2bc 100%)"
    );
    setFormGreetingCardBgColor("#ffffff");
    setFormGreetingCardNameBgColor("#2563eb");
    setFormGreetingCardNameTextColor("#FFFFFF");
    setFormGreetingCategoryIds([]);
    setGreetingCatSearchQuery("");

    try {
      const res = await adminApi.getHeroConfig({
        pageType: row.pageType,
        headerId: row.headerId || undefined,
      });
      const result = res.data?.result || res.data || {};
      const items = result.banners?.items || [];
      const catIds = result.categoryIds || [];

      if (row.pageType === "home") {
        setFormBanners(
          items.length === 0
            ? getDefaultHomeHeroBanners().map((banner) => ({
                ...banner,
                isUploading: false,
              }))
            : items.map((b) => ({ ...b, isUploading: false }))
        );
      } else {
        if (items.length > 0) {
          setFormBanners([{ ...items[0], isUploading: false, isDefault: false }]);
        } else {
          const defBanner = getDefaultCategoryHeroBanner(row.label, row.label);
          setFormBanners([
            defBanner
              ? {
                  imageUrl: defBanner,
                  title: row.label,
                  isUploading: false,
                  isDefault: true,
                }
              : emptyBannerItem(),
          ]);
        }
      }
      setFormCategoryIds(Array.isArray(catIds) ? catIds : []);

      if (row.pageType === "home") {
        const greeting = result.greetingSection || {};
        setFormGreetingEnabled(greeting.enabled !== false);
        setFormGreetingTitle(greeting.title || "Good Afternoon, {name}! ☀️");
        setFormGreetingTitleColor(greeting.titleColor || "#242424");
        setFormGreetingBgColor(
          greeting.bgColor ||
            "linear-gradient(135deg, #ffe078 0%, #ffeb9c 50%, #fff2bc 100%)"
        );
        setFormGreetingCardBgColor(greeting.cardBgColor || "#ffffff");
        setFormGreetingCardNameBgColor(greeting.cardNameBgColor || "#2563eb");
        setFormGreetingCardNameTextColor(
          greeting.cardNameTextColor || "#FFFFFF"
        );
        const extraMap = {};
        if (Array.isArray(greeting.categoryIds)) {
          greeting.categoryIds.forEach((c) => {
            if (c && typeof c === "object" && (c._id || c.id)) {
              extraMap[String(c._id || c.id)] = c;
            }
          });
        }
        setExtraCategoryInfo(extraMap);
        setFormGreetingCategoryIds(
          Array.isArray(greeting.categoryIds)
            ? greeting.categoryIds.map((c) => String(c?._id || c))
            : []
        );

        setFormBestSellingTitle(
          result.bestSellingTitle || "Best Selling Categories"
        );
        setFormBestSellingCategoryIds(
          Array.isArray(result.bestSellingCategoryIds)
            ? result.bestSellingCategoryIds.map((c) => String(c?._id || c))
            : []
        );

        const savedSections = Array.isArray(result.categorySectionBanners)
          ? result.categorySectionBanners
          : [];
        const validHeaders = availableHeaders.filter(
          (h) =>
            h.name?.trim().toLowerCase() !== "all" &&
            h.slug?.trim().toLowerCase() !== "all"
        );

        const initialSections = validHeaders.map((h) => {
          const found = savedSections.find(
            (s) => String(s.headerId) === String(h._id)
          );
          if (found && Array.isArray(found.banners) && found.banners.length > 0) {
            return {
              headerId: h._id,
              headerName: h.name,
              banners: [
                { ...found.banners[0], isUploading: false, isDefault: false },
              ],
            };
          }
          const defBanner = getDefaultSectionBannerForCategory(h.name, h.slug);
          return {
            headerId: h._id,
            headerName: h.name,
            banners: [
              defBanner
                ? {
                    imageUrl: defBanner,
                    title: h.name,
                    isUploading: false,
                    isDefault: true,
                  }
                : emptyBannerItem(),
            ],
          };
        });
        setFormSectionBanners(initialSections);
      } else {
        setFormTopDealsTitle(
          result.topDealsTitle || `Top deals on ${row.label}`
        );
        setFormTopDealsProductIds(
          Array.isArray(result.topDealsProductIds)
            ? result.topDealsProductIds.map((p) => String(p?._id || p))
            : []
        );
        setFormTopDealsBgColor(result.topDealsBgColor || "");
        setFormTopDealsTextColor(result.topDealsTextColor || "");
        setFormTopDealsProductNameColor(result.topDealsProductNameColor || "");
        setFormTopDealsPriceColor(result.topDealsPriceColor || "");

        // Fetch products for category top deals selection
        setProductsLoading(true);
        try {
          const prodRes = await adminApi.getProducts({
            headerId: row.headerId,
            limit: 150,
            allProducts: "true",
          });
          const fetchedProducts =
            prodRes.data?.results ||
            prodRes.data?.result?.items ||
            prodRes.data?.result ||
            [];
          setCategoryProducts(
            Array.isArray(fetchedProducts) ? fetchedProducts : []
          );
        } catch (err) {
          console.error("Failed to fetch category products:", err);
        } finally {
          setProductsLoading(false);
        }
      }

      // Curated Deals Section
      const curated = result.curatedDeals || {};
      setFormCuratedDealsEnabled(curated.enabled !== false);
      setFormCuratedDealsTitle(
        curated.title ||
          (row.pageType === "home"
            ? "Top Category Deals"
            : `Deals on ${row.label}`)
      );
      setFormCuratedTopBgColor(curated.cardTopBgColor || "#FAF8F5");
      setFormCuratedBottomBgColor(curated.cardBottomBgColor || "");
      setFormCuratedTextColor(curated.cardTextColor || "#FFFFFF");
      setFormCuratedItems(
        Array.isArray(curated.items)
          ? curated.items.map((it) => ({
              categoryId: it.categoryId?._id || it.categoryId || null,
              title: it.title || "",
              offerText: it.offerText || "Min. 50% Off",
              imageUrl: it.imageUrl || "",
              slug: it.slug || "",
              linkValue: it.linkValue || "",
            }))
          : []
      );
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch page configuration", "error");
    }
  };

  // Switch active page via dropdown
  const handlePageSelect = (pageId) => {
    setSelectedPageId(pageId);
    const row = pageData.find((r) => String(r.id) === String(pageId));
    if (row) {
      setEditingRow(row);
      loadConfigIntoState(row);
      // Reset active tab if current tab is not applicable to target page
      if (row.pageType !== "home" && (activeTab === "greetingCategories" || activeTab === "sectionBanners")) {
        setActiveTab("heroBanners");
      }
    }
  };

  const updateBannerItem = (idx, changes) => {
    setFormBanners((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...changes };
      return next;
    });
  };

  const addBannerItem = () => {
    setFormBanners((prev) => [...prev, emptyBannerItem()]);
  };

  const removeBannerItem = (idx) => {
    setFormBanners((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleBannerFileChange = async (idx, file) => {
    if (!file) return;
    updateBannerItem(idx, { isUploading: true });
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await adminApi.uploadExperienceBanner(fd);
      const url = res.data?.result?.url || res.data?.url;
      if (!url) throw new Error("Upload failed");
      updateBannerItem(idx, { imageUrl: url, isUploading: false, isDefault: false });
      showToast("Banner image uploaded", "success");
    } catch (e) {
      console.error(e);
      updateBannerItem(idx, { isUploading: false });
      showToast("Failed to upload banner image", "error");
    }
  };

  const updateSectionBannerItem = (secIdx, changes) => {
    setFormSectionBanners((prev) => {
      const next = [...prev];
      const sec = { ...next[secIdx] };
      const current = sec.banners?.[0] || emptyBannerItem();
      sec.banners = [{ ...current, ...changes, isDefault: false }];
      next[secIdx] = sec;
      return next;
    });
  };

  const handleSectionBannerFileChange = async (secIdx, file) => {
    if (!file) return;
    updateSectionBannerItem(secIdx, { isUploading: true });
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await adminApi.uploadExperienceBanner(fd);
      const url = res.data?.result?.url || res.data?.url;
      if (!url) throw new Error("Upload failed");
      updateSectionBannerItem(secIdx, { imageUrl: url, isUploading: false, isDefault: false });
      showToast("Section banner image uploaded successfully", "success");
    } catch (e) {
      console.error(e);
      updateSectionBannerItem(secIdx, { isUploading: false });
      showToast("Failed to upload section banner image", "error");
    }
  };

  const toggleTopDealProduct = (prodId) => {
    const idStr = String(prodId);
    setFormTopDealsProductIds((prev) =>
      prev.includes(idStr) ? prev.filter((id) => id !== idStr) : [...prev, idStr]
    );
  };

  const toggleGreetingCategory = (catId) => {
    const idStr = String(catId);
    setFormGreetingCategoryIds((prev) =>
      prev.includes(idStr) ? prev.filter((id) => id !== idStr) : [...prev, idStr]
    );
  };

  const moveGreetingCategory = (idx, direction) => {
    setFormGreetingCategoryIds((prev) => {
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const addCuratedItem = (sub) => {
    const subId = String(sub._id || sub.id);
    if (formCuratedItems.some((it) => String(it.categoryId) === subId)) return;
    setFormCuratedItems((prev) => [
      ...prev,
      {
        categoryId: subId,
        title: sub.name,
        offerText: "Min. 50% Off",
        imageUrl: sub.image || sub.icon || "",
        slug: sub.slug || "",
      },
    ]);
  };

  const removeCuratedItem = (idx) => {
    setFormCuratedItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveCuratedItem = (idx, direction) => {
    setFormCuratedItems((prev) => {
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const updateCuratedItemOffer = (idx, offerText) => {
    setFormCuratedItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], offerText };
      return copy;
    });
  };

  const updateCuratedItemTitle = (idx, title) => {
    setFormCuratedItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], title };
      return copy;
    });
  };

  const handleSave = async () => {
    if (!editingRow) return;

    const rawBanners =
      editingRow.pageType === "home" ? formBanners : formBanners.slice(0, 1);
    const items = rawBanners
      .filter((b) => b && b.imageUrl && !b.isDefault)
      .map((b) => ({
        imageUrl: b.imageUrl,
        title: b.title || "",
        subtitle: b.subtitle || "",
        linkType: b.linkType || "none",
        linkValue: b.linkValue || "",
        status: b.status || "active",
      }));

    setSaving(true);
    try {
      const cleanedSectionBanners =
        editingRow.pageType === "home"
          ? formSectionBanners
              .map((sec) => {
                const b = sec.banners?.[0];
                const hasCustom = b && b.imageUrl && !b.isDefault;
                return {
                  headerId: sec.headerId,
                  headerName: sec.headerName,
                  banners: hasCustom
                    ? [
                        {
                          imageUrl: b.imageUrl,
                          title: b.title || sec.headerName,
                          subtitle: b.subtitle || "",
                          linkType: b.linkType || "header",
                          linkValue: b.linkValue || String(sec.headerId),
                          status: b.status || "active",
                        },
                      ]
                    : [],
                };
              })
              .filter((sec) => sec.banners.length > 0)
          : [];

      await adminApi.setHeroConfig({
        pageType: editingRow.pageType,
        headerId: editingRow.headerId || undefined,
        banners: { items },
        categoryIds: formCategoryIds,
        greetingSection:
          editingRow.pageType === "home"
            ? {
                enabled: formGreetingEnabled,
                title: formGreetingTitle.trim(),
                titleColor: formGreetingTitleColor.trim() || "#242424",
                bgColor:
                  formGreetingBgColor.trim() ||
                  "linear-gradient(135deg, #ffe078 0%, #ffeb9c 50%, #fff2bc 100%)",
                cardBgColor: formGreetingCardBgColor.trim() || "#ffffff",
                cardNameBgColor: formGreetingCardNameBgColor.trim() || "#2563eb",
                cardNameTextColor:
                  formGreetingCardNameTextColor.trim() || "#FFFFFF",
                categoryIds: formGreetingCategoryIds,
              }
            : undefined,
        topDealsTitle: formTopDealsTitle,
        topDealsProductIds: formTopDealsProductIds,
        topDealsBgColor: formTopDealsBgColor,
        topDealsTextColor: formTopDealsTextColor,
        topDealsProductNameColor: formTopDealsProductNameColor,
        topDealsPriceColor: formTopDealsPriceColor,
        bestSellingTitle: formBestSellingTitle,
        bestSellingCategoryIds: formBestSellingCategoryIds,
        categorySectionBanners: cleanedSectionBanners,
        curatedDeals: {
          enabled: formCuratedDealsEnabled,
          title: formCuratedDealsTitle.trim(),
          cardTopBgColor: formCuratedTopBgColor?.trim() || "#FAF8F5",
          cardBottomBgColor:
            formCuratedBottomBgColor?.trim() ||
            (editingRow.pageType === "home" ? "#1e3a8a" : ""),
          cardTextColor: formCuratedTextColor?.trim() || "#FFFFFF",
          items: formCuratedItems.map((it, idx) => ({
            categoryId: (typeof it.categoryId === "object" ? it.categoryId?._id : it.categoryId) || null,
            title: it.title?.trim() || "",
            offerText: it.offerText?.trim() || "Min. 50% Off",
            imageUrl: it.imageUrl?.trim() || "",
            linkValue: it.linkValue?.trim() || "",
            sortOrder: idx,
          })),
        },
      });

      // Synchronize with platform settings for full dual compatibility
      if (editingRow.pageType === "home") {
        try {
          await adminApi.updateSettings({
            bestSellingTitle: formBestSellingTitle,
            bestSellingCategoryIds: formBestSellingCategoryIds,
          });
        } catch (_) {}
      } else if (editingRow.pageType === "header" && editingRow.headerId) {
        try {
          await adminApi.updateSettings({
            categoryTopDeals: {
              [editingRow.headerId]: {
                title: formTopDealsTitle,
                productIds: formTopDealsProductIds,
                bgColor: formTopDealsBgColor,
                textColor: formTopDealsTextColor,
              },
            },
          });
        } catch (_) {}
      }

      try {
        clearAllCache();
        localStorage.removeItem("anushkakart:home_cache:v6");
        sessionStorage.removeItem("anushkakart:header_products_cache:v2");
        localStorage.setItem("anushkakart:cms_version", String(Date.now()));
        window.dispatchEvent(new CustomEvent("anushkakart:cms_updated"));
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("anushkakart_cms");
          bc.postMessage({ type: "cms_updated", timestamp: Date.now() });
          bc.close();
        }
      } catch (_) {}

      showToast(`${editingRow.label} CMS updated successfully`, "success");

      // Update local pageData row summary
      setPageData((prev) =>
        prev.map((p) =>
          p.id === editingRow.id
            ? {
                ...p,
                bannerCount:
                  editingRow.pageType === "home"
                    ? items.length > 0
                      ? items.length
                      : getDefaultHomeHeroBanners().length
                    : items.length,
                customTitle:
                  editingRow.pageType === "home"
                    ? formBestSellingTitle
                    : formTopDealsTitle,
                dealProductCount: formTopDealsProductIds.length,
                curatedTitle: formCuratedDealsTitle.trim() || "Category Deals",
                curatedCount: formCuratedItems.length,
                curatedEnabled: formCuratedDealsEnabled,
                greetingTitle:
                  formGreetingTitle.trim() || "Good Afternoon, {name}! ☀️",
                greetingCount: formGreetingCategoryIds.length,
                greetingEnabled: formGreetingEnabled,
              }
            : p
        )
      );
    } catch (e) {
      console.error(e);
      showToast(e.response?.data?.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = categoryProducts.filter((p) => {
    if (!productSearchQuery.trim()) return true;
    const q = productSearchQuery.toLowerCase();
    return (
      (p.name || "").toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q) ||
      (p.brand || "").toLowerCase().includes(q)
    );
  });

  const categoryNameMap = useMemo(() => {
    const map = new Map();
    (headers || []).forEach((h) => {
      map.set(String(h._id || h.id), { ...h, type: "header" });
    });
    (allCategories || []).forEach((c) => {
      map.set(String(c._id || c.id), { ...c, type: "category" });
    });
    (allSubcategories || []).forEach((s) => {
      map.set(String(s._id || s.id), { ...s, type: "subcategory" });
    });
    return map;
  }, [headers, allCategories, allSubcategories]);

  const allSelectableGreetingItems = useMemo(() => {
    const list = [];
    const seen = new Set();

    (allCategories || []).forEach((c) => {
      const idStr = String(c._id || c.id);
      if (!seen.has(idStr)) {
        seen.add(idStr);
        list.push({
          _id: idStr,
          name: c.name,
          image: c.image || c.icon,
          group: c.headerName ? `Main in ${c.headerName}` : "Main Category",
          type: "category",
        });
      }
    });

    (allSubcategories || []).forEach((s) => {
      const idStr = String(s._id || s.id);
      if (!seen.has(idStr)) {
        seen.add(idStr);
        list.push({
          _id: idStr,
          name: s.name,
          image: s.image || s.icon,
          group: s.parentName ? `${s.headerName} › ${s.parentName}` : s.headerName || "Subcategory",
          type: "subcategory",
        });
      }
    });

    return list;
  }, [allCategories, allSubcategories]);

  const filteredGreetingCategories = useMemo(() => {
    if (!greetingCatSearchQuery.trim()) return allSelectableGreetingItems;
    const q = greetingCatSearchQuery.toLowerCase();
    return allSelectableGreetingItems.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.group || "").toLowerCase().includes(q)
    );
  }, [allSelectableGreetingItems, greetingCatSearchQuery]);

  const scopedAvailableSubcategories = (allSubcategories || []).filter((s) => {
    if (!editingRow) return false;
    if (editingRow.pageType === "home") return true;
    const matchesHeaderId =
      s.headerId && String(s.headerId) === String(editingRow.headerId);
    const matchesHeaderName =
      (s.headerName || "").toLowerCase().trim() ===
      (editingRow.label || "").toLowerCase().trim();
    return matchesHeaderId || matchesHeaderName;
  });

  const filteredScopedSubcategories = scopedAvailableSubcategories.filter((s) => {
    if (!curatedSearchQuery.trim()) return true;
    const q = curatedSearchQuery.toLowerCase();
    return (
      (s.name || "").toLowerCase().includes(q) ||
      (s.parentName || "").toLowerCase().includes(q) ||
      (s.headerName || "").toLowerCase().includes(q)
    );
  });

  // Dynamic tabs definition based on active page
  const tabs = useMemo(() => {
    if (!editingRow || editingRow.pageType === "home") {
      return [
        {
          id: "heroBanners",
          label: "Hero Carousel Banners",
          icon: HiOutlinePhoto,
          count: formBanners.filter((b) => b && b.imageUrl).length,
        },
        {
          id: "greetingCategories",
          label: "Greeting Categories",
          icon: HiOutlineSun,
          count: formGreetingCategoryIds.length,
        },
        {
          id: "curatedDeals",
          label: "Curated Deals (Cards)",
          icon: HiOutlineSparkles,
          count: formCuratedItems.length,
        },
        {
          id: "sectionBanners",
          label: "Category Section Banners",
          icon: HiOutlineTag,
          count: formSectionBanners.filter((s) => s.banners?.[0]?.imageUrl).length,
        },
        {
          id: "overviewTable",
          label: "Pages Overview",
          icon: HiOutlineTableCells,
          count: null,
        },
      ];
    } else {
      return [
        {
          id: "heroBanners",
          label: "Category Hero Banner",
          icon: HiOutlinePhoto,
          count: formBanners[0]?.imageUrl ? 1 : 0,
        },
        {
          id: "topDeals",
          label: "Top Deals on Products",
          icon: HiOutlineBolt,
          count: formTopDealsProductIds.length,
        },
        {
          id: "curatedDeals",
          label: "Curated Category Deals",
          icon: HiOutlineSparkles,
          count: formCuratedItems.length,
        },
        {
          id: "overviewTable",
          label: "Pages Overview",
          icon: HiOutlineTableCells,
          count: null,
        },
      ];
    }
  }, [
    editingRow,
    formBanners,
    formGreetingCategoryIds,
    formCuratedItems,
    formSectionBanners,
    formTopDealsProductIds,
  ]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <HiOutlineArrowPath className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-500">
            Loading Hero & Page Banners Studio...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* ── 1. PAGE HEADER CARD ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <HiOutlinePhoto className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Hero & Page Banners Studio
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Customize banners, top deals products, greeting categories, and curated deal cards for Home and individual category pages.
              </p>
            </div>
          </div>
        </div>

        {/* Global Save Button */}
        {activeTab !== "overviewTable" && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
          >
            {saving ? (
              <>
                <HiOutlineArrowPath className="h-4 w-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <HiOutlineCheck className="h-4 w-4 stroke-[2.5]" />
                <span>Save Configuration</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* ── 2. HEADER CATEGORY (PAGE) SELECTOR CARD (MATCHING BESTSELLERS IMAGE) ── */}
      <Card className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 max-w-md">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>Header Category (Page)</span>
            </label>
            <select
              value={selectedPageId}
              onChange={(e) => handlePageSelect(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer transition-colors shadow-2xs"
            >
              <option value="home">Home Page (All)</option>
              {headers.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name} Category Page
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 font-medium">
              Select which tab/page this config applies to.
            </p>
          </div>

          {editingRow && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs font-semibold text-indigo-900">
              <span className="font-bold text-indigo-700">{editingRow.label}</span>
              <span className="text-indigo-400">•</span>
              <span>
                {editingRow.pageType === "home"
                  ? `${formBanners.length} carousel banners`
                  : formBanners[0]?.imageUrl
                  ? "Custom banner active"
                  : "Default banner"}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* ── 3. MAIN TABS NAVIGATION (MATCHING LAYOUT & BRANDING IMAGE) ── */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/60 max-w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                isActive
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/40"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  isActive ? "text-indigo-600" : "text-slate-400"
                )}
              />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                    isActive
                      ? "bg-indigo-50 text-indigo-600"
                      : "bg-slate-200 text-slate-600"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── 4. TAB 1: HERO BANNERS ── */}
      {activeTab === "heroBanners" && editingRow && (
        <Card className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-slate-900">
                {editingRow.pageType === "home"
                  ? "Hero Banners (Carousel)"
                  : `Hero Banner (${editingRow.label})`}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {editingRow.pageType === "home"
                  ? "Main top carousel banners for 'All' (Home) page (multiple banners supported, auto-sliding)."
                  : `Top banner image displayed when visiting the ${editingRow.label} category page (single banner only).`}
              </p>
            </div>
            {editingRow.pageType === "home" && (
              <button
                type="button"
                onClick={addBannerItem}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer shadow-2xs self-start"
              >
                <HiOutlinePlus className="h-4 w-4" />
                <span>Add Banner</span>
              </button>
            )}
          </div>

          <div className="space-y-4">
            {formBanners.map((item, idx) => (
              <div
                key={idx}
                className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl relative group hover:border-slate-300 transition-all"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
                  {/* Banner Image Preview / Thumbnail */}
                  <div className="w-full md:w-56 h-28 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs relative">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title || `Banner ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-300">
                        <HiOutlinePhoto className="h-8 w-8" />
                        <span className="text-[10px] font-bold mt-1">No Image</span>
                      </div>
                    )}
                    {item.isUploading && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
                        <HiOutlineArrowPath className="h-6 w-6 text-indigo-600 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Actions & Inputs */}
                  <div className="flex-1 min-w-0 space-y-3 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`hero-banner-file-${idx}`}
                        onChange={(e) =>
                          handleBannerFileChange(idx, e.target.files?.[0])
                        }
                      />
                      <label
                        htmlFor={`hero-banner-file-${idx}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer hover:bg-indigo-700 shadow-2xs active:scale-95 transition-all"
                      >
                        {item.imageUrl ? "Replace Image" : "Upload Banner"}
                      </label>
                      {editingRow.pageType !== "home" &&
                        !item.isDefault &&
                        getDefaultCategoryHeroBanner(editingRow.label, editingRow.label) && (
                          <button
                            type="button"
                            onClick={() => {
                              const def = getDefaultCategoryHeroBanner(
                                editingRow.label,
                                editingRow.label
                              );
                              updateBannerItem(idx, {
                                imageUrl: def,
                                isDefault: true,
                              });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                          >
                            Reset to Default
                          </button>
                        )}
                      <span className="text-[11px] font-medium text-slate-400">
                        {editingRow.pageType !== "home" && item.isDefault
                          ? "(Default Category Banner)"
                          : "Recommended 1920 × 500 px or high-res"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <input
                        value={item.imageUrl || ""}
                        onChange={(e) =>
                          updateBannerItem(idx, {
                            imageUrl: e.target.value,
                            isDefault: false,
                          })
                        }
                        className="w-full px-3 py-2 bg-white rounded-xl text-xs font-medium border border-slate-200 outline-none focus:border-indigo-500"
                        placeholder="Image URL (or click Upload Banner above)"
                      />
                      <input
                        value={item.linkValue || ""}
                        onChange={(e) =>
                          updateBannerItem(idx, { linkValue: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white rounded-xl text-xs font-medium border border-slate-200 outline-none focus:border-indigo-500"
                        placeholder="Banner link (e.g. /category/electronics)"
                      />
                    </div>
                  </div>

                  {/* Remove Button for Carousel items */}
                  {editingRow.pageType === "home" && formBanners.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBannerItem(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer self-start md:self-center"
                      title="Remove banner"
                    >
                      <HiOutlineTrash className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Save Action Bar */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Save changes to update banners on {editingRow.label}.
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
            >
              {saving ? (
                <>
                  <HiOutlineArrowPath className="h-4 w-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <HiOutlineCheck className="h-4 w-4 stroke-[2.5]" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </Card>
      )}

      {/* ── 5. TAB 2 (HOME ONLY): GREETING & CATEGORIES SECTION ── */}
      {activeTab === "greetingCategories" && editingRow?.pageType === "home" && (
        <Card className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">
                  Greeting & Featured Categories
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700">
                  Home Section
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage customer greeting title, card colors, and featured categories displayed below the hero carousel.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs font-bold text-slate-700">
                {formGreetingEnabled ? "Section Active" : "Section Hidden"}
              </span>
              <input
                type="checkbox"
                checked={formGreetingEnabled}
                onChange={(e) => setFormGreetingEnabled(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Greeting Config Inputs */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Greeting Title <span className="text-slate-400 font-normal">(Use {"{name}"} for customer name)</span>
              </label>
              <input
                value={formGreetingTitle}
                onChange={(e) => setFormGreetingTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-500"
                placeholder="Good Afternoon, {name}! ☀️"
              />
            </div>

            {/* 3 Color Pickers: Top BG, Bottom Name Bar BG, Name Bar Text Color */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* 1. Card Top Image BG */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Card Top Image BG
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Upper Card</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formGreetingCardBgColor || "#ffffff"}
                    onChange={(e) => setFormGreetingCardBgColor(e.target.value)}
                    className="w-9 h-9 rounded-xl border border-slate-300 p-0.5 cursor-pointer bg-white flex-shrink-0"
                  />
                  <input
                    value={formGreetingCardBgColor}
                    onChange={(e) => setFormGreetingCardBgColor(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-500"
                    placeholder="#ffffff"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {["#ffffff", "#dfece5", "#f1f5f9", "#fef3c7", "#ede9fe", "#fee2e2"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormGreetingCardBgColor(c)}
                      className={cn(
                        "w-5 h-5 rounded-full border border-slate-300 transition-transform hover:scale-110",
                        formGreetingCardBgColor === c && "ring-2 ring-indigo-500 ring-offset-1"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* 2. Name Bar BG Color (Bottom) */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Card Bottom Strip Color
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bottom Bar</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formGreetingCardNameBgColor || "#2563eb"}
                    onChange={(e) => setFormGreetingCardNameBgColor(e.target.value)}
                    className="w-9 h-9 rounded-xl border border-slate-300 p-0.5 cursor-pointer bg-white flex-shrink-0"
                  />
                  <input
                    value={formGreetingCardNameBgColor}
                    onChange={(e) => setFormGreetingCardNameBgColor(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-500"
                    placeholder="#2563eb"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {["#2563eb", "#3dae54", "#dc2626", "#7c3aed", "#0f172a", "#d97706"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormGreetingCardNameBgColor(c)}
                      className={cn(
                        "w-5 h-5 rounded-full border border-slate-300 transition-transform hover:scale-110",
                        formGreetingCardNameBgColor === c && "ring-2 ring-indigo-500 ring-offset-1"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* 3. Name Bar Text Color */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Card Text Color
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Font Color</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={ensureValidHex(formGreetingCardNameTextColor, "#ffffff")}
                    onChange={(e) => setFormGreetingCardNameTextColor(e.target.value.toLowerCase())}
                    className="w-9 h-9 rounded-xl border border-slate-300 p-0.5 cursor-pointer bg-white flex-shrink-0"
                  />
                  <input
                    value={formGreetingCardNameTextColor}
                    onChange={(e) => setFormGreetingCardNameTextColor(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-500"
                    placeholder="#ffffff"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {["#ffffff", "#000000", "#334155", "#fef08a", "#bbf7d0", "#fecaca"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormGreetingCardNameTextColor(c)}
                      className={cn(
                        "w-5 h-5 rounded-full border border-slate-300 transition-transform hover:scale-110",
                        ensureValidHex(formGreetingCardNameTextColor) === c && "ring-2 ring-indigo-500 ring-offset-1"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Mini Live Preview (Exact customer look) */}
            <div className="p-3.5 sm:p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                  Welcome to Anushka Connect, Rahul! ☀️
                </span>
                <span className="text-[11px] text-emerald-700/90 font-medium block mt-0.5">
                  Mini Live Preview (Exact customer look with your selected colors)
                </span>
              </div>
              <div className="flex-shrink-0 flex items-center gap-3 self-center sm:self-auto">
                <div
                  className="w-24 rounded-xl overflow-hidden shadow-sm border border-black/5 flex flex-col"
                  style={{ backgroundColor: formGreetingCardBgColor || "#ffffff" }}
                >
                  <div
                    className="w-full h-12 flex items-center justify-center p-1"
                    style={{ backgroundColor: formGreetingCardBgColor || "#ffffff" }}
                  >
                    <span className="text-xl">🧸</span>
                  </div>
                  <div
                    className="w-full py-1.5 px-1.5 flex items-center justify-center text-center transition-colors"
                    style={{ backgroundColor: formGreetingCardNameBgColor || "#2563eb" }}
                  >
                    <span
                      className="text-[10px] font-bold tracking-tight truncate w-full"
                      style={{ color: formGreetingCardNameTextColor || "#ffffff" }}
                    >
                      Sample Category
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reordering Row for Selected Categories */}
          {formGreetingCategoryIds.length > 0 && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                Selected Categories Display Order ({formGreetingCategoryIds.length} categories active):
              </span>
              <div className="flex flex-wrap gap-2">
                {formGreetingCategoryIds.map((catId, idx) => {
                  const cat =
                    categoryNameMap.get(String(catId)) ||
                    extraCategoryInfo[String(catId)];
                  const catName = cat?.name || "Category";
                  const catImg = cat?.image || cat?.icon;
                  return (
                    <div
                      key={catId}
                      className="flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-xl text-xs font-bold shadow-2xs border transition-all"
                      style={{
                        backgroundColor: formGreetingCardNameBgColor || "#2563eb",
                        color: formGreetingCardNameTextColor || "#ffffff",
                        borderColor: "rgba(0,0,0,0.12)",
                      }}
                    >
                      {catImg && (
                        <img
                          src={catImg}
                          alt={catName}
                          className="w-4 h-4 object-contain rounded-sm"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                      <span className="truncate max-w-[160px]">{catName}</span>
                      <div className="flex items-center gap-0.5 ml-1 border-l border-white/30 pl-1.5">
                        <button
                          type="button"
                          onClick={() => moveGreetingCategory(idx, -1)}
                          disabled={idx === 0}
                          className="p-0.5 hover:opacity-75 disabled:opacity-30 cursor-pointer"
                          style={{ color: formGreetingCardNameTextColor || "#ffffff" }}
                          title="Move Left"
                        >
                          <HiOutlineArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveGreetingCategory(idx, 1)}
                          disabled={idx === formGreetingCategoryIds.length - 1}
                          className="p-0.5 hover:opacity-75 disabled:opacity-30 cursor-pointer"
                          style={{ color: formGreetingCardNameTextColor || "#ffffff" }}
                          title="Move Right"
                        >
                          <HiOutlineArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleGreetingCategory(catId)}
                          className="p-0.5 hover:opacity-75 ml-0.5 cursor-pointer"
                          style={{ color: formGreetingCardNameTextColor || "#ffffff" }}
                          title="Remove"
                        >
                          <HiOutlineXMark className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 3-COLUMN SELECTABLE CATEGORY CARDS GRID (MATCHING IMAGE 1 BESTSELLERS) ── */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Select Categories to Display
              </label>
              <div className="relative w-full sm:w-64">
                <HiOutlineMagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={greetingCatSearchQuery}
                  onChange={(e) => setGreetingCatSearchQuery(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[400px] overflow-y-auto pr-1">
              {filteredGreetingCategories.map((cat) => {
                const idStr = String(cat._id);
                const isSelected = formGreetingCategoryIds.includes(idStr);
                return (
                  <label
                    key={cat._id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none",
                      isSelected
                        ? "bg-indigo-50/50 border-indigo-400 shadow-2xs ring-1 ring-indigo-400/20"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleGreetingCategory(idStr)}
                      className="w-4 h-4 text-indigo-600 rounded cursor-pointer shrink-0"
                    />
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      <img
                        src={cat.image || "https://cdn-icons-png.flaticon.com/128/2321/2321831.png"}
                        alt={cat.name}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "https://cdn-icons-png.flaticon.com/128/2321/2321831.png";
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-900 block truncate">
                        {cat.name}
                      </span>
                      {cat.group && (
                        <span className="text-[10px] text-slate-400 font-medium truncate block">
                          {cat.group}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Bottom Save Action Bar */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Save your changes to update greeting and categories immediately.
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
            >
              {saving ? (
                <>
                  <HiOutlineArrowPath className="h-4 w-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <HiOutlineCheck className="h-4 w-4 stroke-[2.5]" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </Card>
      )}

      {/* ── 6. TAB 2 (CATEGORY ONLY): TOP DEALS ON PRODUCTS ── */}
      {activeTab === "topDeals" && editingRow?.pageType !== "home" && (
        <Card className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-black text-slate-900">
              Top Deals Section ({editingRow.label})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize the Top Deals title, background banner colors, and pick the featured products for this category page.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Section Heading
              </label>
              <input
                value={formTopDealsTitle}
                onChange={(e) => setFormTopDealsTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-500"
                placeholder={`Top deals on ${editingRow.label}`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* 1. Section Background Color / Gradient */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Banner Background Color
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Banner BG</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={ensureValidHex(formTopDealsBgColor, "#2563eb")}
                    onChange={(e) => setFormTopDealsBgColor(e.target.value.toLowerCase())}
                    className="w-9 h-9 rounded-xl border border-slate-300 p-0.5 cursor-pointer bg-white flex-shrink-0"
                  />
                  <input
                    value={formTopDealsBgColor}
                    onChange={(e) => setFormTopDealsBgColor(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-500"
                    placeholder="#2563eb or linear-gradient(...)"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {["#2563eb", "#059669", "#dc2626", "#7c3aed", "#0f172a", "#d97706"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormTopDealsBgColor(c)}
                      className={cn(
                        "w-5 h-5 rounded-full border border-slate-300 transition-transform hover:scale-110",
                        formTopDealsBgColor === c && "ring-2 ring-indigo-500 ring-offset-1"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* 2. Title & Card Text Color */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Banner Text Color
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Text Color</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={ensureValidHex(formTopDealsTextColor, "#ffffff")}
                    onChange={(e) => setFormTopDealsTextColor(e.target.value.toLowerCase())}
                    className="w-9 h-9 rounded-xl border border-slate-300 p-0.5 cursor-pointer bg-white flex-shrink-0"
                  />
                  <input
                    value={formTopDealsTextColor}
                    onChange={(e) => setFormTopDealsTextColor(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-500"
                    placeholder="#ffffff"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {["#ffffff", "#0f172a", "#fef08a", "#bbf7d0", "#fecaca", "#ede9fe"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormTopDealsTextColor(c)}
                      className={cn(
                        "w-5 h-5 rounded-full border border-slate-300 transition-transform hover:scale-110",
                        formTopDealsTextColor === c && "ring-2 ring-indigo-500 ring-offset-1"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Mini Live Preview */}
            <div
              className="p-3.5 sm:p-4 rounded-2xl border border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-all"
              style={{
                background: formTopDealsBgColor || "#2563eb",
              }}
            >
              <div>
                <span
                  className="text-sm font-extrabold block drop-shadow-xs"
                  style={{ color: formTopDealsTextColor || "#ffffff" }}
                >
                  {formTopDealsTitle || `Top deals on ${editingRow.label}`}
                </span>
                <span
                  className="text-[11px] font-medium opacity-90 block mt-0.5"
                  style={{ color: formTopDealsTextColor || "#ffffff" }}
                >
                  Customer view with your selected background & text color
                </span>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2 self-center sm:self-auto bg-white/10 p-2 rounded-xl backdrop-blur-xs border border-white/20">
                <span className="text-xs font-bold text-white">🛍️ Featured Deals Slider</span>
              </div>
            </div>
          </div>

          {/* ── 3-COLUMN SELECTABLE PRODUCTS CARDS GRID (MATCHING IMAGE 1) ── */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Select Featured Products ({formTopDealsProductIds.length} selected)
                </label>
                <p className="text-[11px] text-slate-400">
                  Click on any product to toggle its inclusion in the Top Deals slider.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <HiOutlineMagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {productsLoading ? (
              <div className="py-8 text-center text-slate-400 font-bold text-xs">
                Loading products for {editingRow.label}...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No products found matching your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[440px] overflow-y-auto pr-1">
                {filteredProducts.map((p) => {
                  const idStr = String(p._id || p.id);
                  const isSelected = formTopDealsProductIds.includes(idStr);
                  const img =
                    p.mainImage ||
                    p.image ||
                    p.variants?.[0]?.images?.[0] ||
                    "";
                  return (
                    <label
                      key={idStr}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none",
                        isSelected
                          ? "bg-indigo-50/50 border-indigo-400 shadow-2xs ring-1 ring-indigo-400/20"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTopDealProduct(idStr)}
                        className="w-4 h-4 text-indigo-600 rounded cursor-pointer shrink-0"
                      />
                      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {img ? (
                          <img
                            src={img}
                            alt={p.name}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <HiOutlinePhoto className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-slate-900 block truncate">
                          {p.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mt-0.5">
                          <span className="text-emerald-600 font-bold">
                            ₹{p.salePrice || p.price}
                          </span>
                          {p.originalPrice > (p.salePrice || p.price) && (
                            <span className="line-through text-slate-400 text-[10px]">
                              ₹{p.originalPrice}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Save Action Bar */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Save your changes to update top deals on {editingRow.label}.
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
            >
              {saving ? (
                <>
                  <HiOutlineArrowPath className="h-4 w-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <HiOutlineCheck className="h-4 w-4 stroke-[2.5]" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </Card>
      )}

      {/* ── 7. TAB 3: CURATED CATEGORY DEALS (CARDS) ── */}
      {activeTab === "curatedDeals" && editingRow && (
        <Card className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Curated Deals Cards
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Displays promotional deal cards with custom offer badges (e.g. &quot;Min. 50% Off&quot;).
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs font-bold text-slate-700">
                {formCuratedDealsEnabled ? "Section Active" : "Section Hidden"}
              </span>
              <input
                type="checkbox"
                checked={formCuratedDealsEnabled}
                onChange={(e) => setFormCuratedDealsEnabled(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
            </label>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Section Heading
              </label>
              <input
                value={formCuratedDealsTitle}
                onChange={(e) => setFormCuratedDealsTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-500"
                placeholder="Top Category Deals"
              />
            </div>

            {/* 3 Color Pickers: Top Container BG, Bottom Wave Color, Text Color */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* 1. Card Top Container BG */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Card Upper Color
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Top Box</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={ensureValidHex(formCuratedTopBgColor, "#FAF8F5")}
                    onChange={(e) => setFormCuratedTopBgColor(e.target.value.toLowerCase())}
                    className="w-9 h-9 rounded-xl border border-slate-300 p-0.5 cursor-pointer bg-white flex-shrink-0"
                  />
                  <input
                    value={formCuratedTopBgColor}
                    onChange={(e) => setFormCuratedTopBgColor(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-500"
                    placeholder="#FAF8F5"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {["#FAF8F5", "#ffffff", "#f1f5f9", "#fef3c7", "#ede9fe", "#e0f2fe"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormCuratedTopBgColor(c)}
                      className={cn(
                        "w-5 h-5 rounded-full border border-slate-300 transition-transform hover:scale-110",
                        formCuratedTopBgColor === c && "ring-2 ring-indigo-500 ring-offset-1"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* 2. Card Bottom Wave Color */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Card Lower Wave Color
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bottom Wave</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={ensureValidHex(formCuratedBottomBgColor, "#1e3a8a")}
                    onChange={(e) => setFormCuratedBottomBgColor(e.target.value.toLowerCase())}
                    className="w-9 h-9 rounded-xl border border-slate-300 p-0.5 cursor-pointer bg-white flex-shrink-0"
                  />
                  <input
                    value={formCuratedBottomBgColor}
                    onChange={(e) => setFormCuratedBottomBgColor(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-500"
                    placeholder="#1e3a8a or empty for auto"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {["#1e3a8a", "#0f766e", "#b91c1c", "#6b21a8", "#0f172a", "#c2410c"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormCuratedBottomBgColor(c)}
                      className={cn(
                        "w-5 h-5 rounded-full border border-slate-300 transition-transform hover:scale-110",
                        formCuratedBottomBgColor === c && "ring-2 ring-indigo-500 ring-offset-1"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* 3. Card Text Color */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Text Color
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Font Color</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={ensureValidHex(formCuratedTextColor, "#ffffff")}
                    onChange={(e) => setFormCuratedTextColor(e.target.value.toLowerCase())}
                    className="w-9 h-9 rounded-xl border border-slate-300 p-0.5 cursor-pointer bg-white flex-shrink-0"
                  />
                  <input
                    value={formCuratedTextColor}
                    onChange={(e) => setFormCuratedTextColor(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-indigo-500"
                    placeholder="#ffffff"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {["#ffffff", "#000000", "#fef08a", "#bbf7d0", "#fecaca", "#0f172a"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormCuratedTextColor(c)}
                      className={cn(
                        "w-5 h-5 rounded-full border border-slate-300 transition-transform hover:scale-110",
                        ensureValidHex(formCuratedTextColor) === c && "ring-2 ring-indigo-500 ring-offset-1"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Mini Live Preview of Wave Card */}
            <div className="p-3.5 sm:p-4 bg-slate-100/70 rounded-2xl border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  ✨ Curated Deal Wave Card Preview
                </span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                  Live preview with your custom upper container, bottom wave color, and text styling
                </span>
              </div>
              <div className="flex-shrink-0 flex items-center gap-3 self-center sm:self-auto">
                {/* Wave Card Sample */}
                <div className="w-28 rounded-2xl overflow-hidden shadow-sm border border-slate-200/80 flex flex-col">
                  {/* Upper Image Box */}
                  <div
                    className="w-full h-14 p-1.5 flex items-center justify-center relative"
                    style={{ backgroundColor: formCuratedTopBgColor || "#FAF8F5" }}
                  >
                    <span className="text-2xl">⚡</span>
                  </div>
                  {/* Wave SVG */}
                  <div className="relative -mt-3 w-full overflow-hidden z-10 leading-none">
                    <svg viewBox="0 0 160 28" preserveAspectRatio="none" className="w-full h-3.5 block">
                      <path
                        d="M0 16 C35 22 75 24 110 12 C130 5 145 2 160 1 L160 28 L0 28 Z"
                        fill={formCuratedBottomBgColor || "#1e3a8a"}
                      />
                    </svg>
                  </div>
                  {/* Bottom Text Area */}
                  <div
                    className="w-full px-1 pb-1.5 pt-0.5 flex flex-col items-center justify-center text-center -mt-[1px]"
                    style={{ backgroundColor: formCuratedBottomBgColor || "#1e3a8a" }}
                  >
                    <span
                      className="text-[9px] font-medium leading-tight truncate w-full"
                      style={{ color: formCuratedTextColor || "#FFFFFF" }}
                    >
                      Deal Category
                    </span>
                    <span
                      className="text-[10px] font-extrabold tracking-tight leading-tight w-full"
                      style={{ color: formCuratedTextColor || "#FFFFFF" }}
                    >
                      Min. 50% Off
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Configured Deals Cards */}
          {formCuratedItems.length > 0 && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 block">
                Configured Deal Cards ({formCuratedItems.length} cards):
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {formCuratedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 relative group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <HiOutlinePhoto className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <input
                        value={item.title}
                        onChange={(e) =>
                          updateCuratedItemTitle(idx, e.target.value)
                        }
                        className="w-full px-2 py-1 bg-white rounded-lg text-xs font-bold border border-slate-200 outline-none"
                        placeholder="Card title..."
                      />
                      <input
                        value={item.offerText}
                        onChange={(e) =>
                          updateCuratedItemOffer(idx, e.target.value)
                        }
                        className="w-full px-2 py-1 bg-white rounded-lg text-xs font-semibold text-amber-700 border border-slate-200 outline-none"
                        placeholder="Offer text (e.g. Min. 50% Off)"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveCuratedItem(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 cursor-pointer"
                      >
                        <HiOutlineArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveCuratedItem(idx, 1)}
                        disabled={idx === formCuratedItems.length - 1}
                        className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 cursor-pointer"
                      >
                        <HiOutlineArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCuratedItem(idx)}
                        className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="Remove deal card"
                      >
                        <HiOutlineTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 3-COLUMN SELECTABLE SUBCATEGORIES GRID (MATCHING IMAGE 1) ── */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Add Subcategory Cards to Curated Deals
              </label>
              <div className="relative w-full sm:w-64">
                <HiOutlineMagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={curatedSearchQuery}
                  onChange={(e) => setCuratedSearchQuery(e.target.value)}
                  placeholder="Search subcategories..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
              {filteredScopedSubcategories.map((sub) => {
                const subId = String(sub._id || sub.id);
                const isAdded = formCuratedItems.some(
                  (it) => String(it.categoryId) === subId
                );
                return (
                  <div
                    key={subId}
                    onClick={() => !isAdded && addCuratedItem(sub)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none",
                      isAdded
                        ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                        : "bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 shadow-2xs"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      <img
                        src={sub.image || sub.icon || "https://cdn-icons-png.flaticon.com/128/2321/2321831.png"}
                        alt={sub.name}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "https://cdn-icons-png.flaticon.com/128/2321/2321831.png";
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-900 block truncate">
                        {sub.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium truncate block">
                        {sub.parentName}
                      </span>
                    </div>
                    <div className="shrink-0">
                      {isAdded ? (
                        <span className="text-[10px] font-black text-slate-400 bg-slate-200 px-2 py-0.5 rounded-md">
                          Added
                        </span>
                      ) : (
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                          <HiOutlinePlus className="w-3 h-3" /> Add
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Save Action Bar */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Save changes to update curated deals on {editingRow.label}.
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
            >
              {saving ? (
                <>
                  <HiOutlineArrowPath className="h-4 w-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <HiOutlineCheck className="h-4 w-4 stroke-[2.5]" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </Card>
      )}

      {/* ── 8. TAB 4 (HOME ONLY): CATEGORY SECTION BANNERS ── */}
      {activeTab === "sectionBanners" && editingRow?.pageType === "home" && (
        <Card className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-black text-slate-900">
              Category Section Banners (Home Page)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure promotional banners for each category section displayed on the main home page (Fresh Groceries, Electronics Fest, etc.).
            </p>
          </div>

          <div className="space-y-4">
            {formSectionBanners.map((sec, secIdx) => {
              const banner = sec.banners?.[0] || emptyBannerItem();
              return (
                <div
                  key={sec.headerId}
                  className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl relative"
                >
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/60">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <HiOutlineTag className="h-4 w-4 text-indigo-600" />
                      {sec.headerName} Section Banner
                    </span>
                    {banner.imageUrl && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {banner.isDefault ? "Default Banner" : "Custom Banner"}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
                    <div className="w-full md:w-56 h-28 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs relative">
                      {banner.imageUrl ? (
                        <img
                          src={banner.imageUrl}
                          alt={banner.title || sec.headerName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <HiOutlinePhoto className="h-8 w-8 text-slate-300" />
                      )}
                      {banner.isUploading && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
                          <HiOutlineArrowPath className="h-6 w-6 text-indigo-600 animate-spin" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-3 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id={`section-banner-file-${secIdx}`}
                          onChange={(e) =>
                            handleSectionBannerFileChange(
                              secIdx,
                              e.target.files?.[0]
                            )
                          }
                        />
                        <label
                          htmlFor={`section-banner-file-${secIdx}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer hover:bg-indigo-700 shadow-2xs active:scale-95 transition-all"
                        >
                          {banner.imageUrl ? "Replace Image" : "Upload Banner"}
                        </label>
                        {!banner.isDefault && (
                          <button
                            type="button"
                            onClick={() => {
                              const def = getDefaultSectionBannerForCategory(
                                sec.headerName,
                                sec.headerName
                              );
                              updateSectionBannerItem(secIdx, {
                                imageUrl: def,
                                isDefault: true,
                              });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                          >
                            Reset to Default
                          </button>
                        )}
                        <span className="text-[11px] font-medium text-slate-400">
                          Recommended 1200 × 300 px
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        <input
                          value={banner.imageUrl || ""}
                          onChange={(e) =>
                            updateSectionBannerItem(secIdx, {
                              imageUrl: e.target.value,
                              isDefault: false,
                            })
                          }
                          className="w-full px-3 py-2 bg-white rounded-xl text-xs font-medium border border-slate-200 outline-none focus:border-indigo-500"
                          placeholder="Image URL (or click Upload Banner above)"
                        />
                        <input
                          value={banner.linkValue || ""}
                          onChange={(e) =>
                            updateSectionBannerItem(secIdx, {
                              linkValue: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-white rounded-xl text-xs font-medium border border-slate-200 outline-none focus:border-indigo-500"
                          placeholder={`Banner link (e.g. /category/${sec.headerId})`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Save Action Bar */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Save your changes to update category section banners on Home.
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
            >
              {saving ? (
                <>
                  <HiOutlineArrowPath className="h-4 w-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <HiOutlineCheck className="h-4 w-4 stroke-[2.5]" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </Card>
      )}

      {/* ── 9. TAB 5: PAGES OVERVIEW TABLE ── */}
      {activeTab === "overviewTable" && (
        <Card className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-black text-slate-900">
              Pages Summary & Configuration Status
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click &quot;Configure Page&quot; on any page row to quickly switch to its settings.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Page
                  </th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Banners
                  </th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Curated Deals
                  </th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Top Deals / Greeting
                  </th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-slate-50 hover:bg-slate-50/60 transition-colors",
                      String(selectedPageId) === String(row.id) && "bg-indigo-50/30"
                    )}
                  >
                    <td className="py-4 text-sm font-bold text-slate-900">
                      {row.label}
                    </td>
                    <td className="py-4 text-xs font-semibold text-slate-600">
                      {row.pageType === "home" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-50 text-blue-700">
                          {row.bannerCount} banner{row.bannerCount !== 1 ? "s" : ""} (Carousel)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700">
                          {row.bannerCount > 0 ? "1 banner (Custom)" : "Default banner"}
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-xs text-slate-600">
                      <div>
                        <span className="font-bold text-slate-900 block">
                          {row.curatedTitle || "Deals Showcase"}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {row.curatedCount > 0
                            ? `${row.curatedCount} cards active`
                            : "Default category deals"}
                          {!row.curatedEnabled && " (Disabled)"}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 text-xs text-slate-600">
                      {row.pageType === "home" ? (
                        <div>
                          <span className="font-bold text-slate-900 block">
                            Greeting: {row.greetingCount > 0 ? `${row.greetingCount} categories` : "All"}
                          </span>
                          {!row.greetingEnabled && (
                            <span className="text-[10px] text-rose-500 font-bold">
                              Greeting Hidden
                            </span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="font-bold text-slate-900">
                            {row.customTitle || "Default"}
                          </span>
                          <span className="ml-2 text-[11px] text-slate-500">
                            ({row.dealProductCount || 0} products)
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          handlePageSelect(row.id);
                          setActiveTab("heroBanners");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all cursor-pointer shadow-2xs"
                      >
                        <HiOutlinePencilSquare className="w-3.5 h-3.5" />
                        Configure Page
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
