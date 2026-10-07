import React, { useEffect, useState } from "react";
import {
  HiOutlinePencilSquare,
  HiOutlinePhoto,
  HiOutlinePlus,
  HiOutlineXMark,
  HiOutlineMagnifyingGlass,
  HiOutlineCheck,
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
            (c.children || []).map((s) => ({ ...s, parentName: c.name, headerName: h.name }))
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
        topDealsTitle: formTopDealsTitle,
        topDealsProductIds: formTopDealsProductIds,
        topDealsBgColor: formTopDealsBgColor,
        topDealsTextColor: formTopDealsTextColor,
        topDealsProductNameColor: formTopDealsProductNameColor,
        topDealsPriceColor: formTopDealsPriceColor,
        bestSellingTitle: formBestSellingTitle,
        bestSellingCategoryIds: formBestSellingCategoryIds,
        categorySectionBanners: cleanedSectionBanners,
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

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
          Page CMS: Banners, Top Deals & Categories
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage and customize all customer-facing banners, Top Deals titles & products, and Best Selling categories for the Home page and each category page (Grocery, Electronics, Mobiles, Fashion, etc.).
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
                    Top Deals / Best Selling Section
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
                        <span className="font-bold text-slate-900">{row.customTitle || "Default"}</span>
                        {row.pageType === "header" && (
                          <span className="ml-2 text-[11px] text-slate-500">
                            ({row.dealProductCount || 0} products selected)
                          </span>
                        )}
                      </div>
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

            {/* 2. HOME PAGE: BEST SELLING CATEGORIES SECTION */}
            {editingRow.pageType === "home" && (
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-4">
                <div>
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                    2. Best Selling Categories Section
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
                    3. Category Sections Banners on "All" Page
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
          </div>
        )}
      </Modal>
    </div>
  );
}
