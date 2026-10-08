import React, { useEffect, useState } from "react";
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
} from "react-icons/hi2";
import { adminApi } from "../services/adminApi";
import Card from "@shared/components/ui/Card";
import Modal from "@shared/components/ui/Modal";
import { useToast } from "@shared/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getDefaultHomeHeroBanners, MIN_HOME_HERO_BANNERS } from "@shared/constants/homeHeroDefaults";

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

export default function HeroCategoriesPerPage() {
  const { showToast } = useToast();
  const [headers, setHeaders] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [allSubcategories, setAllSubcategories] = useState([]);
  const [pageData, setPageData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
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

  // Curated Category Deals states (Men's grooming deals layout)
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
  const [formGreetingBgColor, setFormGreetingBgColor] = useState("linear-gradient(135deg, #ffe078 0%, #ffeb9c 50%, #fff2bc 100%)");
  const [formGreetingCardBgColor, setFormGreetingCardBgColor] = useState("#ffffff");
  const [formGreetingCardNameBgColor, setFormGreetingCardNameBgColor] = useState("#2563eb");
  const [formGreetingCardNameTextColor, setFormGreetingCardNameTextColor] = useState("#FFFFFF");
  const [formGreetingCategoryIds, setFormGreetingCategoryIds] = useState([]);
  const [greetingCatSearchQuery, setGreetingCatSearchQuery] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const treeRes = await adminApi.getCategoryTree();
        const tree = treeRes.data?.results || treeRes.data?.result || [];
        const rawHeaders = Array.isArray(tree) ? tree : [];
        const headerList = rawHeaders.filter(
          (h) => (h.name?.trim().toLowerCase() !== "all") && (h.slug?.trim().toLowerCase() !== "all")
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
            label: "Home (All)",
            pageType: "home",
            headerId: null,
            bannerCount: homeBanners.length > 0 ? homeBanners.length : getDefaultHomeHeroBanners().length,
            categoryCount: homeCatIds.length,
            customTitle: homeResult.bestSellingTitle || "Best Selling Categories",
            curatedTitle: homeResult.curatedDeals?.title || "Top Category Deals",
            curatedCount: (homeResult.curatedDeals?.items || []).length,
            curatedEnabled: homeResult.curatedDeals?.enabled !== false,
            greetingTitle: homeResult.greetingSection?.title || "Good Afternoon, {name}! ☀️",
            greetingCount: (homeResult.greetingSection?.categoryIds || []).length,
            greetingEnabled: homeResult.greetingSection?.enabled !== false,
          },
        ];

        const validHeaderList = headerList;

        await Promise.all(
          validHeaderList.map(async (h) => {
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
              customTitle: result.topDealsTitle || `Top deals on ${h.name || 'category'}`,
              dealProductCount: (result.topDealsProductIds || []).length,
              curatedTitle: result.curatedDeals?.title || (/beaut/i.test(h.name) ? "Men's grooming deals" : `Deals on ${h.name}`),
              curatedCount: (result.curatedDeals?.items || []).length,
              curatedEnabled: result.curatedDeals?.enabled !== false,
            });
          })
        );

        if (!cancelled) setPageData(rows);
      } catch (e) {
        if (!cancelled) console.error(e);
        showToast("Failed to load hero config", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [showToast]);

  const openEdit = async (row) => {
    setEditingRow(row);
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
    setFormGreetingBgColor("linear-gradient(135deg, #ffe078 0%, #ffeb9c 50%, #fff2bc 100%)");
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
            ? getDefaultHomeHeroBanners().map((banner) => ({ ...banner, isUploading: false }))
            : items.map((b) => ({ ...b, isUploading: false }))
        );
      } else {
        // Category page: strictly single banner
        if (items.length > 0) {
          setFormBanners([{ ...items[0], isUploading: false, isDefault: false }]);
        } else {
          const defBanner = getDefaultCategoryHeroBanner(row.label, row.label);
          setFormBanners([
            defBanner
              ? { imageUrl: defBanner, title: row.label, isUploading: false, isDefault: true }
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
        setFormGreetingBgColor(greeting.bgColor || "linear-gradient(135deg, #ffe078 0%, #ffeb9c 50%, #fff2bc 100%)");
        setFormGreetingCardBgColor(greeting.cardBgColor || "#ffffff");
        setFormGreetingCardNameBgColor(greeting.cardNameBgColor || "#2563eb");
        setFormGreetingCardNameTextColor(greeting.cardNameTextColor || "#FFFFFF");
        setFormGreetingCategoryIds(
          Array.isArray(greeting.categoryIds)
            ? greeting.categoryIds.map((c) => String(c?._id || c))
            : []
        );

        setFormBestSellingTitle(result.bestSellingTitle || "Best Selling Categories");
        setFormBestSellingCategoryIds(
          Array.isArray(result.bestSellingCategoryIds)
            ? result.bestSellingCategoryIds.map((c) => String(c?._id || c))
            : []
        );

        // Populate Home category section banners for all active header categories (single banner per section)
        const savedSections = Array.isArray(result.categorySectionBanners)
          ? result.categorySectionBanners
          : [];
        const validHeaders = headers.filter(
          (h) => (h.name?.trim().toLowerCase() !== "all") && (h.slug?.trim().toLowerCase() !== "all")
        );

        const initialSections = validHeaders.map((h) => {
          const found = savedSections.find((s) => String(s.headerId) === String(h._id));
          if (found && Array.isArray(found.banners) && found.banners.length > 0) {
            return {
              headerId: h._id,
              headerName: h.name,
              banners: [{ ...found.banners[0], isUploading: false, isDefault: false }],
            };
          }
          const defBanner = getDefaultSectionBannerForCategory(h.name, h.slug);
          return {
            headerId: h._id,
            headerName: h.name,
            banners: [
              defBanner
                ? { imageUrl: defBanner, title: h.name, isUploading: false, isDefault: true }
                : emptyBannerItem(),
            ],
          };
        });
        setFormSectionBanners(initialSections);
      } else {
        setFormTopDealsTitle(result.topDealsTitle || `Top deals on ${row.label}`);
        setFormTopDealsProductIds(
          Array.isArray(result.topDealsProductIds)
            ? result.topDealsProductIds.map((p) => String(p?._id || p))
            : []
        );
        setFormTopDealsBgColor(result.topDealsBgColor || "");
        setFormTopDealsTextColor(result.topDealsTextColor || "");
        setFormTopDealsProductNameColor(result.topDealsProductNameColor || "");
        setFormTopDealsPriceColor(result.topDealsPriceColor || "");

        // Fetch products for this category to allow picking top deal products
        setProductsLoading(true);
        try {
          const prodRes = await adminApi.getProducts({
            headerId: row.headerId,
            limit: 150,
            allProducts: "true",
          });
          const raw = prodRes.data?.result || prodRes.data;
          const list = Array.isArray(prodRes.data?.results)
            ? prodRes.data.results
            : Array.isArray(raw?.items)
            ? raw.items
            : Array.isArray(raw?.products)
            ? raw.products
            : Array.isArray(raw)
            ? raw
            : [];
          setCategoryProducts(list);
        } catch (prodErr) {
          console.error("Failed to load products for category:", prodErr);
          setCategoryProducts([]);
        } finally {
          setProductsLoading(false);
        }
      }

      // Populate Curated Category Deals (Men's grooming deals style)
      const curated = result.curatedDeals || {};
      setFormCuratedDealsEnabled(curated.enabled !== false);
      setFormCuratedDealsTitle(
        curated.title ||
        (row.pageType === "home"
          ? "Top Category Deals"
          : /beaut/i.test(row.label)
          ? "Men's grooming deals"
          : /grocer/i.test(row.label)
          ? "Daily Grocery Deals"
          : /electr/i.test(row.label)
          ? "Electronics Mega Deals"
          : /mobil/i.test(row.label)
          ? "Smartphones & Deals"
          : /fashion/i.test(row.label)
          ? "Fashion & Lifestyle Deals"
          : /home/i.test(row.label)
          ? "Home & Kitchen Deals"
          : /med/i.test(row.label)
          ? "Health & Wellness Deals"
          : `Deals on ${row.label}`)
      );
      setFormCuratedTopBgColor(curated.cardTopBgColor || "#FAF8F5");
      setFormCuratedBottomBgColor(
        curated.cardBottomBgColor ||
        (row.pageType === "home"
          ? "#2563eb"
          : /grocer/i.test(row.label)
          ? "#059669"
          : /electr/i.test(row.label)
          ? "#1e3a8a"
          : /beaut/i.test(row.label)
          ? "#2563eb"
          : /fashion/i.test(row.label)
          ? "#7c3aed"
          : /home/i.test(row.label)
          ? "#0f766e"
          : /med/i.test(row.label)
          ? "#0d9488"
          : "#2563eb")
      );
      setFormCuratedTextColor(curated.cardTextColor || "#FFFFFF");

      const initialCuratedItems = Array.isArray(curated.items)
        ? curated.items.map((it) => {
            const cat = it.categoryId;
            return {
              categoryId: String(cat?._id || cat || ""),
              title: it.title || cat?.name || "",
              offerText: it.offerText || "Min. 50% Off",
              imageUrl: it.imageUrl || cat?.image || cat?.icon || "",
              slug: cat?.slug || "",
            };
          })
        : [];
      setFormCuratedItems(initialCuratedItems);
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch page configuration", "error");
    }
    setModalOpen(true);
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
      updateBannerItem(idx, { imageUrl: url, isUploading: false });
      showToast("Banner image uploaded", "success");
    } catch (e) {
      console.error(e);
      updateBannerItem(idx, { isUploading: false });
      showToast("Failed to upload banner image", "error");
    }
  };

  // Section Banner handlers for Home ("All") category sections (strictly single banner per section)
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

  const toggleCategory = (catId) => {
    setFormCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const toggleTopDealProduct = (prodId) => {
    const idStr = String(prodId);
    setFormTopDealsProductIds((prev) =>
      prev.includes(idStr) ? prev.filter((id) => id !== idStr) : [...prev, idStr]
    );
  };

  const toggleBestSellingSubcategory = (subId) => {
    const idStr = String(subId);
    setFormBestSellingCategoryIds((prev) =>
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

    // For Home: all valid banners; For category pages: only 1 banner
    const rawBanners = editingRow.pageType === "home" ? formBanners : formBanners.slice(0, 1);
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
      const cleanedSectionBanners = editingRow.pageType === "home"
        ? formSectionBanners.map((sec) => {
            const b = sec.banners?.[0];
            const hasCustom = b && b.imageUrl && !b.isDefault;
            return {
              headerId: sec.headerId,
              headerName: sec.headerName,
              banners: hasCustom
                ? [{
                    imageUrl: b.imageUrl,
                    title: b.title || sec.headerName,
                    subtitle: b.subtitle || "",
                    linkType: b.linkType || "header",
                    linkValue: b.linkValue || String(sec.headerId),
                    status: b.status || "active",
                  }]
                : [],
            };
          }).filter((sec) => sec.banners.length > 0)
        : [];

      await adminApi.setHeroConfig({
        pageType: editingRow.pageType,
        headerId: editingRow.headerId || undefined,
        banners: { items },
        categoryIds: formCategoryIds,
        greetingSection: editingRow.pageType === "home" ? {
          enabled: formGreetingEnabled,
          title: formGreetingTitle.trim(),
          titleColor: formGreetingTitleColor.trim() || "#242424",
          bgColor: formGreetingBgColor.trim() || "linear-gradient(135deg, #ffe078 0%, #ffeb9c 50%, #fff2bc 100%)",
          cardBgColor: formGreetingCardBgColor.trim() || "#ffffff",
          cardNameBgColor: formGreetingCardNameBgColor.trim() || "#2563eb",
          cardNameTextColor: formGreetingCardNameTextColor.trim() || "#FFFFFF",
          categoryIds: formGreetingCategoryIds,
        } : undefined,
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
          cardTopBgColor: formCuratedTopBgColor.trim() || "#FAF8F5",
          cardBottomBgColor: formCuratedBottomBgColor.trim(),
          cardTextColor: formCuratedTextColor.trim() || "#FFFFFF",
          items: formCuratedItems.map((it, idx) => ({
            categoryId: it.categoryId || null,
            title: it.title?.trim() || "",
            offerText: it.offerText?.trim() || "Min. 50% Off",
            imageUrl: it.imageUrl?.trim() || "",
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
                productNameColor: formTopDealsProductNameColor,
                priceColor: formTopDealsPriceColor,
              },
            },
          });
        } catch (_) {}
      }

      showToast("Page CMS configuration saved successfully", "success");
      setPageData((prev) =>
        prev.map((p) =>
          p.id === editingRow.id
            ? {
                ...p,
                bannerCount: items.length,
                categoryCount: formCategoryIds.length,
                customTitle: editingRow.pageType === "home" ? formBestSellingTitle : formTopDealsTitle,
                dealProductCount: formTopDealsProductIds.length,
                curatedTitle: formCuratedDealsTitle.trim() || (editingRow.pageType === "home" ? "Top Category Deals" : `Deals on ${editingRow.label}`),
                curatedCount: formCuratedItems.length,
                curatedEnabled: formCuratedDealsEnabled,
                greetingTitle: formGreetingTitle.trim() || "Good Afternoon, {name}! ☀️",
                greetingCount: formGreetingCategoryIds.length,
                greetingEnabled: formGreetingEnabled,
              }
            : p
        )
      );
      setModalOpen(false);
      setEditingRow(null);
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

  const filteredSubcategories = allSubcategories.filter((s) => {
    if (!subcatSearchQuery.trim()) return true;
    const q = subcatSearchQuery.toLowerCase();
    return (
      (s.name || "").toLowerCase().includes(q) ||
      (s.parentName || "").toLowerCase().includes(q) ||
      (s.headerName || "").toLowerCase().includes(q)
    );
  });

  // Scoped subcategories for curated deals:
  // On "home" (All page), allow selecting any subcategory in the whole catalog.
  // On category pages (e.g. Grocery, Electronics, etc.), strictly allow ONLY subcategories of that category!
  const scopedAvailableSubcategories = (allSubcategories || []).filter((s) => {
    if (!editingRow) return false;
    if (editingRow.pageType === "home") {
      return true;
    }
    const matchesHeaderId = s.headerId && String(s.headerId) === String(editingRow.headerId);
    const matchesHeaderName = (s.headerName || "").toLowerCase().trim() === (editingRow.label || "").toLowerCase().trim();
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

  const filteredGreetingCategories = (allCategories || []).filter((c) => {
    if (!greetingCatSearchQuery.trim()) return true;
    const q = greetingCatSearchQuery.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.headerName || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
          Page CMS: Banners, Top Deals & Categories
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage and customize all customer-facing banners, Top Deals titles & products, Best Selling categories, and Curated Deal Cards (wave layout) for the Home page and each category page.
        </p>
      </div>

      <Card className="p-4 md:p-6 border border-slate-100 bg-white rounded-xl shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-bold">Loading…</div>
        ) : (
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
                    Curated Deals (Cards)
                  </th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Top Deals / Best Selling
                  </th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
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
                          {row.bannerCount > 0 ? "1 banner (Single)" : "Default banner"}
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-xs text-slate-600">
                      <div>
                        <span className="font-bold text-slate-900 block">{row.curatedTitle || "Deals Showcase"}</span>
                        <span className="text-[11px] text-slate-500">
                          {row.curatedCount > 0 ? `${row.curatedCount} cards configured` : "Default category deals"}
                          {!row.curatedEnabled && " (Disabled)"}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 text-xs text-slate-600">
                      {row.pageType === "home" ? (
                        <div>
                          <span className="font-bold text-slate-900 block">{row.customTitle || "Best Selling"}</span>
                          <span className="text-[11px] text-amber-700 font-semibold block mt-0.5">
                            Greeting: {row.greetingTitle || "Good Afternoon, {name}! ☀️"} ({row.greetingCount > 0 ? `${row.greetingCount} cats` : "All"})
                            {!row.greetingEnabled && " (Disabled)"}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="font-bold text-slate-900">{row.customTitle || "Default"}</span>
                          <span className="ml-2 text-[11px] text-slate-500">
                            ({row.dealProductCount || 0} products selected)
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-4">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer shadow-xs"
                      >
                        <HiOutlinePencilSquare className="w-3.5 h-3.5" />
                        Edit Page CMS
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingRow ? `Edit Page CMS — ${editingRow.label}` : "Edit Page CMS"}
        size="xl"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {saving ? "Saving Changes…" : "Save Changes"}
            </button>
          </div>
        }
      >
        {editingRow && (
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
            {/* 1. BANNERS SECTION */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                    {editingRow.pageType === "home"
                      ? "1. Hero Banners (All Page Carousel)"
                      : `1. Hero Banner (${editingRow.label})`}
                  </label>
                  <p className="text-[11px] text-slate-500">
                    {editingRow.pageType === "home"
                      ? "Main top carousel banners for 'All' (Home) page (multiple banners supported)."
                      : `Top banner image displayed when visiting the ${editingRow.label} category page (single banner only).`}
                  </p>
                </div>
                {editingRow.pageType === "home" && (
                  <button
                    type="button"
                    onClick={addBannerItem}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 text-primary hover:bg-primary/5 cursor-pointer shadow-xs"
                  >
                    <HiOutlinePlus className="h-3.5 w-3.5" />
                    Add banner
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {formBanners.map((item, idx) => (
                  <Card key={idx} className="p-3 bg-white border-slate-200 shadow-xs">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-16 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title || `Banner ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <HiOutlinePhoto className="h-7 w-7 text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              id={`hero-banner-file-${idx}`}
                              onChange={(e) => handleBannerFileChange(idx, e.target.files?.[0])}
                            />
                            <div className="flex items-center gap-2">
                              <label
                                htmlFor={`hero-banner-file-${idx}`}
                                className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-slate-200 shadow-2xs"
                              >
                                {item.isUploading ? "Uploading…" : item.imageUrl ? "Replace Image" : "Upload Image"}
                              </label>
                              {editingRow.pageType !== "home" && !item.isDefault && getDefaultCategoryHeroBanner(editingRow.label, editingRow.label) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const def = getDefaultCategoryHeroBanner(editingRow.label, editingRow.label);
                                    updateBannerItem(idx, { imageUrl: def, isDefault: true });
                                  }}
                                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-600 transition-colors cursor-pointer"
                                  title="Restore default category banner"
                                >
                                  Reset to Default
                                </button>
                              )}
                              <span className="text-[10px] font-semibold text-slate-400">
                                {editingRow.pageType !== "home" && item.isDefault
                                  ? "(Current Default Banner)"
                                  : "(Recommended 1920 × 500 px or high-res)"}
                              </span>
                            </div>
                            <input
                              value={item.imageUrl || ""}
                              onChange={(e) => updateBannerItem(idx, { imageUrl: e.target.value, isDefault: false })}
                              className="w-full px-3 py-1.5 bg-slate-50 rounded-xl text-xs font-medium border border-slate-200 outline-none focus:border-primary"
                              placeholder="Or paste banner image URL..."
                            />
                          </div>
                        </div>
                      </div>
                      {editingRow.pageType === "home" && formBanners.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBannerItem(idx)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                          title="Remove banner"
                        >
                          <HiOutlineXMark className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* 2. HOME PAGE: GREETING & CATEGORIES SECTION ("GOOD AFTERNOON") */}
            {editingRow.pageType === "home" && (
              <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-black text-amber-900 uppercase tracking-wider block">
                        2. Greeting & Categories Section ("Good Afternoon")
                      </label>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200/70 text-amber-900">
                        Furnishing Deals Card Layout
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-700/80 mt-0.5">
                      Configure heading, background color/gradient, Furnishing Deals style cards (image on top, solid colored label on bottom), text colors, and which main categories are displayed.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formGreetingEnabled}
                      onChange={(e) => setFormGreetingEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300"
                    />
                    <span className="text-xs font-bold text-slate-700">Section Active</span>
                  </label>
                </div>

                {formGreetingEnabled && (
                  <div className="space-y-4">
                    {/* 1. Heading & Heading Text Color */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
                          <span>Section Heading / Greeting Title</span>
                          <span className="text-[9.5px] font-semibold text-primary lowercase">
                            tip: {"{name}"} inserts user's first name
                          </span>
                        </label>
                        <input
                          type="text"
                          value={formGreetingTitle}
                          onChange={(e) => setFormGreetingTitle(e.target.value)}
                          placeholder="E.g. Good Afternoon, {name}! ☀️"
                          className="w-full px-3.5 py-2 bg-white rounded-xl text-xs font-bold text-slate-900 border border-slate-200 outline-none focus:border-primary shadow-2xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                          Heading Text Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formGreetingTitleColor?.startsWith("#") ? formGreetingTitleColor : "#242424"}
                            onChange={(e) => setFormGreetingTitleColor(e.target.value)}
                            className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            value={formGreetingTitleColor}
                            onChange={(e) => setFormGreetingTitleColor(e.target.value)}
                            placeholder="#242424"
                            className="w-full px-2.5 py-2 bg-white rounded-xl text-xs font-bold border border-slate-200 outline-none focus:border-primary shadow-2xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2. Container Background Color / Presets */}
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider block">
                            Section Container Background
                          </label>
                          <p className="text-[10px] text-slate-500">
                            Solid hex color or modern CSS gradient for the greeting container.
                          </p>
                        </div>
                        {/* Presets */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-400 mr-1">Presets:</span>
                          {[
                            { name: "Sunshine Yellow", value: "linear-gradient(135deg, #ffe078 0%, #ffeb9c 50%, #fff2bc 100%)", bg: "#ffe078" },
                            { name: "Soft Cream", value: "#FEF9C3", bg: "#FEF9C3" },
                            { name: "Sky Blue", value: "linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)", bg: "#dbeafe" },
                            { name: "Mint Fresh", value: "linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)", bg: "#d1fae5" },
                            { name: "Lavender", value: "linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)", bg: "#ede9fe" },
                            { name: "Sunset Peach", value: "linear-gradient(135deg, #ffe4e6 0%, #fff1f2 100%)", bg: "#ffe4e6" },
                            { name: "Minimal White", value: "#ffffff", bg: "#ffffff" },
                          ].map((preset) => (
                            <button
                              key={preset.name}
                              type="button"
                              onClick={() => setFormGreetingBgColor(preset.value)}
                              className="w-5 h-5 rounded-full border border-black/15 shadow-2xs transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                              style={{ background: preset.bg }}
                              title={preset.name}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formGreetingBgColor?.startsWith("#") ? formGreetingBgColor : "#ffeb9c"}
                          onChange={(e) => setFormGreetingBgColor(e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          value={formGreetingBgColor}
                          onChange={(e) => setFormGreetingBgColor(e.target.value)}
                          placeholder="linear-gradient(...) or #ffeb9c"
                          className="flex-1 px-3 py-1.5 bg-slate-50 rounded-xl text-xs font-semibold border border-slate-200 outline-none focus:border-primary shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* 3. Card Styling (Furnishing Deals style) & Miniature Live Preview */}
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 space-y-3">
                      <div>
                        <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider block">
                          Card Styling (Image + Solid Name Strip)
                        </label>
                        <p className="text-[10px] text-slate-500">
                          Furnishing deals layout: image on top, colored solid bar with category name below.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Card Image Box BG */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                            Card Top Image BG
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={formGreetingCardBgColor?.startsWith("#") ? formGreetingCardBgColor : "#ffffff"}
                              onChange={(e) => setFormGreetingCardBgColor(e.target.value)}
                              className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer shrink-0"
                            />
                            <input
                              type="text"
                              value={formGreetingCardBgColor}
                              onChange={(e) => setFormGreetingCardBgColor(e.target.value)}
                              placeholder="#ffffff"
                              className="flex-1 px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs font-semibold border border-slate-200 outline-none focus:border-primary"
                            />
                          </div>
                        </div>

                        {/* Card Name Bar BG */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                              Name Bar BG Color
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={formGreetingCardNameBgColor?.startsWith("#") ? formGreetingCardNameBgColor : "#2563eb"}
                              onChange={(e) => setFormGreetingCardNameBgColor(e.target.value)}
                              className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer shrink-0"
                            />
                            <input
                              type="text"
                              value={formGreetingCardNameBgColor}
                              onChange={(e) => setFormGreetingCardNameBgColor(e.target.value)}
                              placeholder="#2563eb"
                              className="flex-1 px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs font-semibold border border-slate-200 outline-none focus:border-primary"
                            />
                          </div>
                          {/* Quick Color swatches */}
                          <div className="flex items-center gap-1 pt-1">
                            {[
                              { name: "Royal Blue", hex: "#2563eb" },
                              { name: "Indigo", hex: "#4338ca" },
                              { name: "Emerald", hex: "#059669" },
                              { name: "Crimson", hex: "#dc2626" },
                              { name: "Purple", hex: "#7c3aed" },
                              { name: "Slate", hex: "#1e293b" },
                            ].map((c) => (
                              <button
                                key={c.hex}
                                type="button"
                                onClick={() => setFormGreetingCardNameBgColor(c.hex)}
                                className="w-4 h-4 rounded-full border border-black/10 cursor-pointer hover:scale-110 transition-transform"
                                style={{ backgroundColor: c.hex }}
                                title={c.name}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Card Name Text Color */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                            Name Bar Text Color
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={formGreetingCardNameTextColor?.startsWith("#") ? formGreetingCardNameTextColor : "#FFFFFF"}
                              onChange={(e) => setFormGreetingCardNameTextColor(e.target.value)}
                              className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer shrink-0"
                            />
                            <input
                              type="text"
                              value={formGreetingCardNameTextColor}
                              onChange={(e) => setFormGreetingCardNameTextColor(e.target.value)}
                              placeholder="#FFFFFF"
                              className="flex-1 px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs font-semibold border border-slate-200 outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Mini Live Preview */}
                      <div
                        className="mt-3 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between overflow-hidden shadow-2xs"
                        style={{ background: formGreetingBgColor || "linear-gradient(135deg, #ffe078 0%, #ffeb9c 50%, #fff2bc 100%)" }}
                      >
                        <div className="space-y-1 max-w-[60%]">
                          <span
                            className="text-sm font-bold block truncate"
                            style={{ color: formGreetingTitleColor || "#242424" }}
                          >
                            {(formGreetingTitle || "Good Afternoon, {name}! ☀️").replace(/\{name\}/gi, "Rahul")}
                          </span>
                          <span className="text-[10px] text-slate-600 font-semibold block">
                            Mini Live Preview (Exact customer look)
                          </span>
                        </div>

                        {/* Preview Card */}
                        <div
                          className="w-24 rounded-xl overflow-hidden shadow-sm border border-black/5"
                          style={{ backgroundColor: formGreetingCardBgColor || "#ffffff" }}
                        >
                          <div
                            className="h-16 w-full flex items-center justify-center p-1.5"
                            style={{ backgroundColor: formGreetingCardBgColor || "#ffffff" }}
                          >
                            <img
                              src="https://cdn-icons-png.flaticon.com/128/3082/3082060.png"
                              alt="Sample"
                              className="h-12 w-12 object-contain"
                            />
                          </div>
                          <div
                            className="w-full py-1 px-1 flex items-center justify-center text-center"
                            style={{ backgroundColor: formGreetingCardNameBgColor || "#2563eb" }}
                          >
                            <span
                              className="text-[11px] font-bold truncate block w-full"
                              style={{ color: formGreetingCardNameTextColor || "#FFFFFF" }}
                            >
                              Blankets
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4. Main Categories Selection */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                            Main Categories to Display ({formGreetingCategoryIds.length} selected)
                          </label>
                          <span className="text-[10px] text-slate-400">
                            Pick specifically which main categories appear in this greeting carousel.
                          </span>
                        </div>
                        {formGreetingCategoryIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFormGreetingCategoryIds([])}
                            className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                          >
                            Clear selection (show all default)
                          </button>
                        )}
                      </div>

                      {/* Selected Categories Re-ordering / removal */}
                      {formGreetingCategoryIds.length > 0 && (
                        <div className="space-y-1.5 p-2 bg-slate-50/80 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-1 block">
                            Selected Order (Drag / Reorder with arrows):
                          </span>
                          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
                            {formGreetingCategoryIds.map((cid, idx) => {
                              const foundCat = allCategories.find((c) => String(c._id) === String(cid));
                              const name = foundCat?.name || "Category";
                              return (
                                <div
                                  key={cid}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs font-bold text-slate-800"
                                >
                                  <span>{name}</span>
                                  <div className="flex items-center gap-0.5 ml-1">
                                    <button
                                      type="button"
                                      onClick={() => moveGreetingCategory(idx, -1)}
                                      disabled={idx === 0}
                                      className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                                      title="Move earlier"
                                    >
                                      <HiOutlineArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveGreetingCategory(idx, 1)}
                                      disabled={idx === formGreetingCategoryIds.length - 1}
                                      className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                                      title="Move later"
                                    >
                                      <HiOutlineArrowDown className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleGreetingCategory(cid)}
                                      className="p-0.5 text-rose-400 hover:text-rose-600 cursor-pointer"
                                      title="Remove"
                                    >
                                      <HiOutlineXMark className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Search and Picker for All Categories */}
                      <div className="relative">
                        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={greetingCatSearchQuery}
                          onChange={(e) => setGreetingCatSearchQuery(e.target.value)}
                          placeholder="Search categories (e.g. Aata, Dairy, Furnishing, Men's)..."
                          className="w-full pl-8 pr-3 py-1.5 bg-white rounded-xl text-xs border border-slate-200 outline-none focus:border-primary shadow-2xs"
                        />
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                        {filteredGreetingCategories.map((c) => {
                          const isSelected = formGreetingCategoryIds.includes(String(c._id));
                          return (
                            <button
                              key={c._id}
                              type="button"
                              onClick={() => toggleGreetingCategory(c._id)}
                              className={cn(
                                "px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer",
                                isSelected
                                  ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                              )}
                            >
                              {isSelected && <HiOutlineCheck className="w-3 h-3" />}
                              {c.name}
                              <span className="text-[9px] opacity-70">({c.headerName})</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        If no categories are selected here, the section automatically shows all active main categories.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. HOME PAGE: BEST SELLING CATEGORIES SECTION */}
            {editingRow.pageType === "home" && (
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-4">
                <div>
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                    3. Best Selling Categories Section
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Configure the title and choose which categories or subcategories appear in this horizontal strip on the Home page.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Section Title
                  </label>
                  <input
                    type="text"
                    value={formBestSellingTitle}
                    onChange={(e) => setFormBestSellingTitle(e.target.value)}
                    placeholder="E.g. Best Selling Categories, Trending Categories..."
                    className="w-full px-3.5 py-2 bg-white rounded-xl text-xs font-bold text-slate-900 border border-slate-200 outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Categories to display ({formBestSellingCategoryIds.length} selected)
                    </label>
                    {formBestSellingCategoryIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormBestSellingCategoryIds([])}
                        className="text-[10px] font-bold text-rose-500 hover:underline"
                      >
                        Clear selection (use defaults)
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={subcatSearchQuery}
                      onChange={(e) => setSubcatSearchQuery(e.target.value)}
                      placeholder="Search subcategories..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white rounded-xl text-xs border border-slate-200 outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                    {filteredSubcategories.map((s) => {
                      const isSelected = formBestSellingCategoryIds.includes(String(s._id));
                      return (
                        <button
                          key={s._id}
                          type="button"
                          onClick={() => toggleBestSellingSubcategory(s._id)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          {isSelected && <HiOutlineCheck className="w-3 h-3" />}
                          {s.name}
                          <span className="text-[9px] opacity-70">({s.parentName || s.headerName})</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    If no categories are selected here, the section automatically showcases subcategories marked as 'Featured' or active items.
                  </p>
                </div>
              </div>
            )}

            {/* 3. HOME PAGE: CATEGORY SECTIONS BANNERS ("ALL" PAGE) */}
            {editingRow.pageType === "home" && (
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-4">
                <div>
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                    4. Category Sections Banners on "All" Page
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Customize the single banner displayed inside each category section (Grocery, Home Appliances, Fashion, etc.) on the Home ("All") page.
                  </p>
                </div>

                <div className="space-y-3.5">
                  {formSectionBanners.map((sec, secIdx) => {
                    const bItem = sec.banners?.[0] || emptyBannerItem();
                    return (
                      <Card key={sec.headerId || secIdx} className="p-3.5 bg-white border-slate-200/90 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                            <h4 className="text-xs font-bold text-slate-900">
                              {sec.headerName} <span className="text-[11px] font-semibold text-slate-400">Section Banner (Single)</span>
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                          <div className="w-24 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                            {bItem.imageUrl ? (
                              <img
                                src={bItem.imageUrl}
                                alt={bItem.title || sec.headerName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <HiOutlinePhoto className="h-7 w-7 text-slate-300" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 space-y-1.5">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              id={`sec-banner-file-${secIdx}`}
                              onChange={(e) => handleSectionBannerFileChange(secIdx, e.target.files?.[0])}
                            />
                            <div className="flex items-center gap-2">
                              <label
                                htmlFor={`sec-banner-file-${secIdx}`}
                                className="inline-block px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-slate-50 shadow-2xs"
                              >
                                {bItem.isUploading ? "Uploading…" : bItem.imageUrl ? "Replace Image" : "Upload Image"}
                              </label>
                              {!bItem.isDefault && getDefaultSectionBannerForCategory(sec.headerName) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const defBanner = getDefaultSectionBannerForCategory(sec.headerName);
                                    updateSectionBannerItem(secIdx, {
                                      imageUrl: defBanner,
                                      isDefault: true,
                                    });
                                  }}
                                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-600 transition-colors cursor-pointer"
                                  title="Restore original pre-configured banner"
                                >
                                  Reset to Default
                                </button>
                              )}
                              <span className="text-[10px] text-slate-400 font-medium">
                                {bItem.isDefault ? "(Current Default Banner)" : "(Recommended 1200 × 500 px)"}
                              </span>
                            </div>
                            <input
                              value={bItem.imageUrl || ""}
                              onChange={(e) => updateSectionBannerItem(secIdx, { imageUrl: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white rounded-xl text-xs font-medium border border-slate-200 outline-none focus:border-primary shadow-2xs"
                              placeholder="Or paste image URL..."
                            />
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. CATEGORY PAGES: TOP DEALS SECTION TITLE & PRODUCTS */}
            {editingRow.pageType === "header" && (
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-4">
                <div>
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                    2. Top Deals Section ({editingRow.label})
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Customize the title and pick which specific products are highlighted inside the Top Deals card for {editingRow.label}.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Top Deals Title
                  </label>
                  <input
                    type="text"
                    value={formTopDealsTitle}
                    onChange={(e) => setFormTopDealsTitle(e.target.value)}
                    placeholder={`E.g. Top deals on ${editingRow.label}, Mega Savings...`}
                    className="w-full px-3.5 py-2 bg-white rounded-xl text-xs font-bold text-slate-900 border border-slate-200 outline-none focus:border-primary"
                  />
                </div>

                {/* Colors & Appearance Customization */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider block">
                        Top Deals Colors & Styling
                      </label>
                      <p className="text-[10px] text-slate-500">
                        Customize card background color and text colors so it doesn't look too dark.
                      </p>
                    </div>
                    {(formTopDealsBgColor || formTopDealsTextColor || formTopDealsProductNameColor || formTopDealsPriceColor) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormTopDealsBgColor("");
                          setFormTopDealsTextColor("");
                          setFormTopDealsProductNameColor("");
                          setFormTopDealsPriceColor("");
                        }}
                        className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                      >
                        Reset to default colors
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1. Div / Background Color */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        Card Background Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formTopDealsBgColor && formTopDealsBgColor.startsWith("#") ? formTopDealsBgColor : "#1e293b"}
                          onChange={(e) => setFormTopDealsBgColor(e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer shrink-0"
                          title="Pick background color"
                        />
                        <input
                          type="text"
                          value={formTopDealsBgColor}
                          onChange={(e) => setFormTopDealsBgColor(e.target.value)}
                          placeholder="Default (or hex e.g. #2563eb)"
                          className="flex-1 px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs font-semibold border border-slate-200 outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    {/* 2. Heading Text Color */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        Heading Title Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formTopDealsTextColor && formTopDealsTextColor.startsWith("#") ? formTopDealsTextColor : "#ffffff"}
                          onChange={(e) => setFormTopDealsTextColor(e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer shrink-0"
                          title="Pick title color"
                        />
                        <input
                          type="text"
                          value={formTopDealsTextColor}
                          onChange={(e) => setFormTopDealsTextColor(e.target.value)}
                          placeholder="Default (#ffffff)"
                          className="flex-1 px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs font-semibold border border-slate-200 outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    {/* 3. Product Name Color */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        Product Name Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formTopDealsProductNameColor && formTopDealsProductNameColor.startsWith("#") ? formTopDealsProductNameColor : "#ffffff"}
                          onChange={(e) => setFormTopDealsProductNameColor(e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer shrink-0"
                          title="Pick product name color"
                        />
                        <input
                          type="text"
                          value={formTopDealsProductNameColor}
                          onChange={(e) => setFormTopDealsProductNameColor(e.target.value)}
                          placeholder="Default (#ffffff)"
                          className="flex-1 px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs font-semibold border border-slate-200 outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    {/* 4. Price Color */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        Price Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formTopDealsPriceColor && formTopDealsPriceColor.startsWith("#") ? formTopDealsPriceColor : "#ffffff"}
                          onChange={(e) => setFormTopDealsPriceColor(e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer shrink-0"
                          title="Pick price color"
                        />
                        <input
                          type="text"
                          value={formTopDealsPriceColor}
                          onChange={(e) => setFormTopDealsPriceColor(e.target.value)}
                          placeholder="Default (#ffffff)"
                          className="flex-1 px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs font-semibold border border-slate-200 outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live Mini Preview */}
                  <div
                    className="p-3 rounded-xl border border-white/20 transition-all flex items-center justify-between shadow-2xs"
                    style={{
                      background: formTopDealsBgColor || "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                    }}
                  >
                    <div className="space-y-1">
                      <span
                        className="text-xs font-bold block"
                        style={{ color: formTopDealsTextColor || "#ffffff" }}
                      >
                        {formTopDealsTitle || `Top deals on ${editingRow.label}`} (Preview)
                      </span>
                      <span
                        className="text-[11px] font-semibold block"
                        style={{ color: formTopDealsProductNameColor || "#ffffff" }}
                      >
                        Sample Product Name
                      </span>
                      <span
                        className="text-[11px] font-black block"
                        style={{ color: formTopDealsPriceColor || "#ffffff" }}
                      >
                        ₹499
                      </span>
                    </div>
                    <div className="px-2.5 py-1 rounded-lg bg-white/10 text-[10px] font-bold text-white/80">
                      Live Color Preview
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Featured Products in Top Deals ({formTopDealsProductIds.length} selected)
                    </label>
                    {formTopDealsProductIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormTopDealsProductIds([])}
                        className="text-[10px] font-bold text-rose-500 hover:underline"
                      >
                        Clear selection (use defaults)
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      placeholder="Search products by name or brand..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white rounded-xl text-xs border border-slate-200 outline-none focus:border-primary"
                    />
                  </div>

                  {productsLoading ? (
                    <div className="py-6 text-center text-xs text-slate-400">Loading products…</div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">No products found in this category.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                      {filteredProducts.map((p) => {
                        const pid = String(p._id || p.id);
                        const isSelected = formTopDealsProductIds.includes(pid);
                        const img = p.mainImage || p.image || p.variants?.[0]?.images?.[0];
                        const price = p.salePrice || p.price;

                        return (
                          <div
                            key={pid}
                            onClick={() => toggleTopDealProduct(pid)}
                            className={cn(
                              "flex items-center gap-2.5 p-2 rounded-xl border text-left cursor-pointer transition-all",
                              isSelected
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-slate-200 bg-slate-50/50 hover:bg-slate-100"
                            )}
                          >
                            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {img ? (
                                <img src={img} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <HiOutlinePhoto className="w-5 h-5 text-slate-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                              <p className="text-[10px] text-slate-500 font-medium">₹{price} {p.brand ? `• ${p.brand}` : ""}</p>
                            </div>
                            <div className={cn(
                              "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                              isSelected ? "bg-primary border-primary text-white" : "border-slate-300 bg-white"
                            )}>
                              {isSelected && <HiOutlineCheck className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400">
                    If no products are manually picked, the store automatically features products with highest discounts and items marked as Top Deals.
                  </p>
                </div>
              </div>
            )}

            {/* 5. CURATED CATEGORY DEALS (IMAGE & WAVE LAYOUT CARDS MATCHING REFERENCE SCREENSHOT) */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                      {editingRow.pageType === "home" ? "5. Curated Deals Section (All Page)" : `3. Curated Deals Section (${editingRow.label})`}
                    </label>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                      <HiOutlineSparkles className="w-3 h-3 text-amber-600" />
                      Wave Layout
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Off-white top with large transparent PNG, curved wave with sparkles, and custom bottom color with subcategory and % Off text.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formCuratedDealsEnabled}
                    onChange={(e) => setFormCuratedDealsEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-700">Section Active</span>
                </label>
              </div>

              {formCuratedDealsEnabled && (
                <div className="space-y-4">
                  {/* 1. Section Title */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Section Heading / Title
                    </label>
                    <input
                      type="text"
                      value={formCuratedDealsTitle}
                      onChange={(e) => setFormCuratedDealsTitle(e.target.value)}
                      placeholder="E.g. Men's grooming deals, Daily Grocery Deals, Electronics Mega Deals..."
                      className="w-full px-3.5 py-2 bg-white rounded-xl text-xs font-bold text-slate-900 border border-slate-200 outline-none focus:border-primary shadow-2xs"
                    />
                  </div>

                  {/* 2. Color Customization & Live Preview */}
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider block">
                          Card Colors & Wave Styling
                        </label>
                        <p className="text-[10px] text-slate-500">
                          Adjust card top off-white color and bottom wave color according to page (e.g. green for grocery, dark blue for electronics).
                        </p>
                      </div>
                      {/* Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400 mr-1">Presets:</span>
                        {[
                          { name: "Green (Grocery)", hex: "#059669" },
                          { name: "Dark Blue (Electronics)", hex: "#1e3a8a" },
                          { name: "Royal Blue (Beauty/Deals)", hex: "#2563eb" },
                          { name: "Purple (Fashion)", hex: "#7c3aed" },
                          { name: "Teal (Home)", hex: "#0f766e" },
                          { name: "Medical (Pharma)", hex: "#0d9488" },
                        ].map((preset) => (
                          <button
                            key={preset.hex}
                            type="button"
                            onClick={() => setFormCuratedBottomBgColor(preset.hex)}
                            className="w-5 h-5 rounded-full border border-black/10 shadow-2xs transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                            style={{ backgroundColor: preset.hex }}
                            title={preset.name}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Card Top Color (Off-white) */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                          Card Top Color (Off-white)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formCuratedTopBgColor?.startsWith("#") ? formCuratedTopBgColor : "#FAF8F5"}
                            onChange={(e) => setFormCuratedTopBgColor(e.target.value)}
                            className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            value={formCuratedTopBgColor}
                            onChange={(e) => setFormCuratedTopBgColor(e.target.value)}
                            placeholder="#FAF8F5"
                            className="flex-1 px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs font-semibold border border-slate-200 outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      {/* Card Bottom Wave Color */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                          Card Bottom Color (Below Wave)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formCuratedBottomBgColor?.startsWith("#") ? formCuratedBottomBgColor : "#2563eb"}
                            onChange={(e) => setFormCuratedBottomBgColor(e.target.value)}
                            className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            value={formCuratedBottomBgColor}
                            onChange={(e) => setFormCuratedBottomBgColor(e.target.value)}
                            placeholder="#2563eb or #059669..."
                            className="flex-1 px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs font-semibold border border-slate-200 outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      {/* Text Color */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                          Text Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formCuratedTextColor?.startsWith("#") ? formCuratedTextColor : "#FFFFFF"}
                            onChange={(e) => setFormCuratedTextColor(e.target.value)}
                            className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            value={formCuratedTextColor}
                            onChange={(e) => setFormCuratedTextColor(e.target.value)}
                            placeholder="#FFFFFF"
                            className="flex-1 px-2.5 py-1.5 bg-slate-50 rounded-lg text-xs font-semibold border border-slate-200 outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Live Miniature Card Preview matching prompt image */}
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-4">
                      <div className="text-[10px] font-bold text-slate-400">Live Preview:</div>
                      <div className="w-[124px] rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-white flex flex-col shrink-0">
                        <div
                          className="h-[84px] flex items-center justify-center p-2 relative"
                          style={{ backgroundColor: formCuratedTopBgColor || "#FAF8F5" }}
                        >
                          <span className="text-[10px] font-black text-slate-400">Large PNG</span>
                        </div>
                        <div className="relative -mt-4 w-full pointer-events-none overflow-hidden">
                          <svg viewBox="0 0 160 28" preserveAspectRatio="none" className="w-full h-5 block">
                            <path d="M0 16 C35 22 75 24 110 12 C130 5 145 2 160 1 L160 28 L0 28 Z" fill={formCuratedBottomBgColor || "#2563eb"} />
                          </svg>
                          <div className="absolute right-2 top-0.5 flex items-center gap-0.5">
                            <span className="text-[9px] text-white">✨</span>
                          </div>
                        </div>
                        <div
                          className="px-1.5 pb-2 pt-0.5 text-center flex flex-col items-center -mt-[1px]"
                          style={{ backgroundColor: formCuratedBottomBgColor || "#2563eb" }}
                        >
                          <span className="text-[9.5px] font-medium leading-tight truncate w-full" style={{ color: formCuratedTextColor || "#FFFFFF" }}>
                            Grooming kits
                          </span>
                          <span className="text-[10.5px] font-black leading-tight mt-0.5" style={{ color: formCuratedTextColor || "#FFFFFF" }}>
                            Min. 50% Off
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        Live preview of the layout matching reference screenshot: offwhite container with large PNG, wave with sparkles, and customizable background color below with discount.
                      </div>
                    </div>
                  </div>

                  {/* 3. Selected Curated Deal Cards */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                        Selected Cards ({formCuratedItems.length} items configured)
                      </label>
                      {formCuratedItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormCuratedItems([])}
                          className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                        >
                          Clear all (use defaults)
                        </button>
                      )}
                    </div>

                    {formCuratedItems.length === 0 ? (
                      <div className="p-4 rounded-xl bg-white border border-dashed border-slate-200 text-center">
                        <p className="text-xs font-semibold text-slate-500">
                          No custom cards added yet.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Pick subcategories below to customize which cards show here, or leave empty to automatically display popular category deals.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200">
                        {formCuratedItems.map((item, idx) => (
                          <div
                            key={item.categoryId || idx}
                            className="flex items-center gap-3 p-2 rounded-lg bg-slate-50/80 border border-slate-200/80"
                          >
                            {/* Thumbnail */}
                            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-contain p-1" />
                              ) : (
                                <HiOutlinePhoto className="w-5 h-5 text-slate-300" />
                              )}
                            </div>

                            {/* Subcategory Name & Title Input */}
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => updateCuratedItemTitle(idx, e.target.value)}
                                placeholder="Card Title..."
                                className="w-full px-2 py-1 bg-white rounded-md text-xs font-bold text-slate-900 border border-slate-200 outline-none focus:border-primary"
                              />
                            </div>

                            {/* Offer Text Input (e.g. Min. 50% Off) */}
                            <div className="w-32 shrink-0">
                              <input
                                type="text"
                                value={item.offerText}
                                onChange={(e) => updateCuratedItemOffer(idx, e.target.value)}
                                placeholder="Min. 50% Off"
                                className="w-full px-2 py-1 bg-white rounded-md text-xs font-extrabold text-blue-600 border border-slate-200 outline-none focus:border-primary text-center"
                              />
                            </div>

                            {/* Reorder & Remove Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveCuratedItem(idx, -1)}
                                disabled={idx === 0}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                                title="Move up"
                              >
                                <HiOutlineArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveCuratedItem(idx, 1)}
                                disabled={idx === formCuratedItems.length - 1}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                                title="Move down"
                              >
                                <HiOutlineArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeCuratedItem(idx)}
                                className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer ml-1"
                                title="Remove card"
                              >
                                <HiOutlineTrash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 4. Add Subcategories Selector (Properly Scoped!) */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                          Add Subcategories to Deals
                        </label>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {editingRow.pageType === "home"
                            ? "✨ Any subcategory across the entire catalog can be selected for 'All' page."
                            : `🔒 Scoped to ${editingRow.label} subcategories only.`}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">
                        {filteredScopedSubcategories.length} available
                      </span>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={curatedSearchQuery}
                        onChange={(e) => setCuratedSearchQuery(e.target.value)}
                        placeholder="Search subcategory by name..."
                        className="w-full pl-8 pr-3 py-1.5 bg-white rounded-xl text-xs border border-slate-200 outline-none focus:border-primary shadow-2xs"
                      />
                    </div>

                    {/* Available Subcategories List */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                      {filteredScopedSubcategories.map((sub) => {
                        const subId = String(sub._id || sub.id);
                        const isAdded = formCuratedItems.some((it) => String(it.categoryId) === subId);
                        const img = sub.image || sub.icon;

                        return (
                          <div
                            key={subId}
                            onClick={() => !isAdded && addCuratedItem(sub)}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-xl border text-left transition-all",
                              isAdded
                                ? "border-emerald-200 bg-emerald-50/50 opacity-60 cursor-default"
                                : "border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-primary/50 cursor-pointer"
                            )}
                          >
                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {img ? (
                                <img src={img} alt={sub.name} className="w-full h-full object-contain p-0.5" />
                              ) : (
                                <HiOutlinePhoto className="w-4 h-4 text-slate-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">{sub.name}</p>
                              <p className="text-[9.5px] text-slate-400 truncate">{sub.headerName || editingRow.label}</p>
                            </div>
                            {isAdded ? (
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                                Added
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="p-1 rounded-md text-primary hover:bg-primary/10 transition-colors"
                              >
                                <HiOutlinePlus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
