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
  const [formBestSellingTitle, setFormBestSellingTitle] = useState("Best Selling Categories");
  const [formBestSellingCategoryIds, setFormBestSellingCategoryIds] = useState([]);

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
        const headerList = Array.isArray(tree) ? tree : [];
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

      setFormBanners(
        row.pageType === "home" && items.length === 0
          ? getDefaultHomeHeroBanners().map((banner) => ({ ...banner, isUploading: false }))
          : items.length
          ? items.map((b) => ({ ...b, isUploading: false }))
          : [emptyBannerItem()]
      );
      setFormCategoryIds(Array.isArray(catIds) ? catIds : []);

      if (row.pageType === "home") {
        setFormBestSellingTitle(result.bestSellingTitle || "Best Selling Categories");
        setFormBestSellingCategoryIds(
          Array.isArray(result.bestSellingCategoryIds)
            ? result.bestSellingCategoryIds.map((c) => String(c?._id || c))
            : []
        );
      } else {
        setFormTopDealsTitle(result.topDealsTitle || `Top deals on ${row.label}`);
        setFormTopDealsProductIds(
          Array.isArray(result.topDealsProductIds)
            ? result.topDealsProductIds.map((p) => String(p?._id || p))
            : []
        );

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
    const items = formBanners.filter((b) => b.imageUrl).map((b) => ({
      imageUrl: b.imageUrl,
      title: b.title || "",
      subtitle: b.subtitle || "",
      linkType: b.linkType || "none",
      linkValue: b.linkValue || "",
      status: b.status || "active",
    }));

    if (!editingRow) return;
    setSaving(true);
    try {
      await adminApi.setHeroConfig({
        pageType: editingRow.pageType,
        headerId: editingRow.headerId || undefined,
        banners: { items },
        categoryIds: formCategoryIds,
        topDealsTitle: formTopDealsTitle,
        topDealsProductIds: formTopDealsProductIds,
        bestSellingTitle: formBestSellingTitle,
        bestSellingCategoryIds: formBestSellingCategoryIds,
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-50 text-blue-700">
                        {row.bannerCount} banner{row.bannerCount !== 1 ? "s" : ""}
                      </span>
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
                    1. Hero Banners ({editingRow.label})
                  </label>
                  <p className="text-[11px] text-slate-500">
                    {editingRow.pageType === "home"
                      ? "Main top carousel banners for 'All' (Home) page."
                      : `Top banner image displayed when visiting the ${editingRow.label} category page.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addBannerItem}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 text-primary hover:bg-primary/5 cursor-pointer shadow-xs"
                >
                  <HiOutlinePlus className="h-3.5 w-3.5" />
                  Add banner
                </button>
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
                              <span className="text-[10px] font-semibold text-slate-400">(Recommended 1920 × 500 px or high-res)</span>
                            </div>
                            <input
                              value={item.imageUrl || ""}
                              onChange={(e) => updateBannerItem(idx, { imageUrl: e.target.value })}
                              className="w-full px-3 py-1.5 bg-slate-50 rounded-xl text-xs font-medium border border-slate-200 outline-none focus:border-primary"
                              placeholder="Or paste banner image URL..."
                            />
                          </div>
                        </div>
                      </div>
                      {formBanners.length > 1 && (
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
