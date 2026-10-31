import React, { useState, useEffect, useMemo } from "react";
import {
  Store,
  Upload,
  Plus,
  Trash2,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  Loader2,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  ShoppingBag,
  Search,
  RefreshCw,
} from "lucide-react";
import { adminUsersApi } from "../services/api/usersApi";
import { adminContentApi } from "../services/api/contentApi";
import { toast } from "sonner";

const MAX_BANNERS = 3;

export default function StoreBannerManager() {
  const [sellers, setSellers] = useState([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [banners, setBanners] = useState([]);
  const [loadingBanners, setLoadingBanners] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(null);

  // Fetch all sellers for dropdown
  const loadSellers = async () => {
    setLoadingSellers(true);
    try {
      const res = await adminUsersApi.getSellers();
      const raw =
        res.data?.results ||
        res.data?.result ||
        res.data?.data ||
        (Array.isArray(res.data) ? res.data : []);
      const sellerList = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
        ? raw.items
        : [];
      setSellers(sellerList);
      if (sellerList.length > 0) {
        setSelectedSellerId((prev) => {
          // If previous selection still exists in the list, keep it; otherwise default to first
          const exists = sellerList.some((s) => s._id === prev);
          return exists ? prev : sellerList[0]._id;
        });
      }
    } catch (err) {
      console.error("Failed to load sellers:", err);
      toast.error("Failed to load sellers list");
    } finally {
      setLoadingSellers(false);
    }
  };

  useEffect(() => {
    loadSellers();
  }, []);

  // Filter sellers by search query
  const filteredSellers = useMemo(() => {
    if (!searchQuery.trim()) return sellers;
    const q = searchQuery.toLowerCase().trim();
    return sellers.filter(
      (s) =>
        (s.shopName && s.shopName.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.slug && s.slug.toLowerCase().includes(q))
    );
  }, [sellers, searchQuery]);

  // When selected seller changes, load seller details and their store banners
  useEffect(() => {
    if (!selectedSellerId) {
      setSelectedSeller(null);
      setBanners([]);
      return;
    }

    const sellerObj = sellers.find((s) => s._id === selectedSellerId);
    setSelectedSeller(sellerObj || null);

    async function loadBanners() {
      setLoadingBanners(true);
      try {
        const res = await adminUsersApi.getSellerStoreBanners(selectedSellerId);
        const data =
          res.data?.result ||
          res.data?.results ||
          res.data?.data ||
          res.data ||
          {};
        const bannerList = Array.isArray(data.storeBanners)
          ? data.storeBanners
          : [];
        setBanners(bannerList);
      } catch (err) {
        console.error("Failed to fetch seller banners:", err);
        setBanners([]);
      } finally {
        setLoadingBanners(false);
      }
    }

    loadBanners();
  }, [selectedSellerId, sellers]);

  // Add new banner item (up to 3)
  const handleAddBanner = () => {
    if (banners.length >= MAX_BANNERS) {
      toast.error(`Maximum ${MAX_BANNERS} banners allowed per store`);
      return;
    }
    setBanners([
      ...banners,
      {
        imageUrl: "",
        title: "",
        linkUrl: "",
      },
    ]);
  };

  // Update banner property
  const handleUpdateBanner = (index, field, value) => {
    setBanners((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Remove banner
  const handleRemoveBanner = (index) => {
    setBanners((prev) => prev.filter((_, i) => i !== index));
  };

  // Re-order banners
  const handleMoveBanner = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= banners.length) return;
    setBanners((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  };

  // Handle image file upload for a banner
  const handleFileUpload = async (index, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file");
      return;
    }

    setUploadingIndex(index);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await adminContentApi.uploadExperienceBanner(formData);
      const uploadedUrl =
        res.data?.result?.url || res.data?.url || res.data?.data?.url;
      if (!uploadedUrl) {
        throw new Error("No image URL returned from server");
      }
      handleUpdateBanner(index, "imageUrl", uploadedUrl);
      toast.success("Banner image uploaded successfully!");
    } catch (err) {
      console.error("Banner upload failed:", err);
      toast.error(
        err.response?.data?.message || err.message || "Failed to upload banner image"
      );
    } finally {
      setUploadingIndex(null);
    }
  };

  // Save banners to backend
  const handleSave = async () => {
    if (!selectedSellerId) {
      toast.error("Please select a seller first");
      return;
    }

    // Filter valid banners with imageUrl
    const validBanners = banners.filter(
      (b) => b.imageUrl && b.imageUrl.trim()
    );

    setSaving(true);
    try {
      const res = await adminUsersApi.updateSellerStoreBanners(
        selectedSellerId,
        {
          storeBanners: validBanners,
        }
      );
      const data =
        res.data?.result ||
        res.data?.results ||
        res.data?.data ||
        res.data ||
        {};
      setBanners(
        Array.isArray(data.storeBanners) ? data.storeBanners : validBanners
      );
      toast.success(
        `Store banners saved successfully for ${
          selectedSeller?.shopName || selectedSeller?.name || "seller"
        }!`
      );
    } catch (err) {
      console.error("Save banners failed:", err);
      toast.error(
        err.response?.data?.message || err.message || "Failed to save store banners"
      );
    } finally {
      setSaving(false);
    }
  };

  const storeSlugOrId =
    selectedSeller?.slug || selectedSeller?._id || selectedSellerId;
  const storeUrl = `/store/${storeSlugOrId}`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto font-outfit">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Store size={22} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Seller Store Banners
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configure up to 3 showcase banners for any seller&apos;s visit store page. Any newly registered seller automatically appears in the dropdown.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadSellers}
            disabled={loadingSellers}
            title="Refresh Sellers"
            className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all shadow-xs"
          >
            <RefreshCw
              size={16}
              className={loadingSellers ? "animate-spin" : ""}
            />
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !selectedSellerId}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            <span>Save Store Banners</span>
          </button>
        </div>
      </div>

      {/* Seller Selector & Info Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
            <span>Select Seller / Shop</span>
            <span className="text-[11px] font-normal normal-case text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {sellers.length} {sellers.length === 1 ? "seller" : "sellers"} registered
            </span>
          </label>

          {/* Quick search input */}
          <div className="relative w-48 sm:w-64">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Filter by shop or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            {loadingSellers ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <span>Loading registered sellers...</span>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedSellerId}
                  onChange={(e) => setSelectedSellerId(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-xs min-h-[48px]"
                >
                  {filteredSellers.length === 0 ? (
                    <option value="" disabled>
                      No sellers match &quot;{searchQuery}&quot;
                    </option>
                  ) : (
                    filteredSellers.map((s) => {
                      const displayName = s.shopName
                        ? `${s.shopName} — ${s.name || s.email || s.phone}`
                        : `${s.name || "Seller"} (${s.email || s.phone || "No contact"})`;
                      return (
                        <option
                          key={s._id}
                          value={s._id}
                          className="text-slate-900 bg-white py-2"
                        >
                          {displayName}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
            )}
          </div>

          {selectedSeller && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {(selectedSeller.shopName || selectedSeller.name || "S")[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-slate-900">
                      {selectedSeller.shopName || selectedSeller.name}
                    </span>
                    <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </div>
                  <div className="text-slate-500 flex items-center gap-2 mt-0.5">
                    {selectedSeller.email && <span>{selectedSeller.email}</span>}
                    {selectedSeller.phone && <span>• {selectedSeller.phone}</span>}
                  </div>
                </div>
              </div>

              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium text-xs shadow-xs"
              >
                <span>Visit Store</span>
                <ExternalLink size={13} />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Banner Configuration & Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Banner Form (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Showcase Banners</span>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                    {banners.length}/{MAX_BANNERS}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  If 0 banners are set, the store page consumes no space and shows products immediately. If 1 banner is set, it renders as a hero banner. If 2 or 3 are set, they appear before products.
                </p>
              </div>

              {banners.length < MAX_BANNERS && (
                <button
                  type="button"
                  onClick={handleAddBanner}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-semibold transition-colors shrink-0"
                >
                  <Plus size={14} />
                  <span>Add Banner</span>
                </button>
              )}
            </div>

            {loadingBanners ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 size={24} className="animate-spin text-blue-600" />
                <span className="text-xs">Loading banners for this seller...</span>
              </div>
            ) : banners.length === 0 ? (
              <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs border border-slate-100 text-slate-400">
                  <ImageIcon size={22} />
                </div>
                <h3 className="text-sm font-semibold text-slate-700">No Banners Configured</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  This seller will display their products immediately below the store header without any empty space. Click below to add a promotional banner.
                </p>
                <button
                  type="button"
                  onClick={handleAddBanner}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Plus size={14} />
                  <span>Add Banner 1</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {banners.map((banner, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 relative hover:border-slate-300 transition-colors shadow-xs"
                  >
                    {/* Banner header controls */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shadow-xs">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {idx === 0 ? "Banner 1 (Primary / Hero)" : `Banner ${idx + 1}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveBanner(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 rounded hover:bg-slate-200/50"
                          title="Move Up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveBanner(idx, 1)}
                          disabled={idx === banners.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 rounded hover:bg-slate-200/50"
                          title="Move Down"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveBanner(idx)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded ml-1 transition-colors"
                          title="Remove Banner"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Image URL & File Upload */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                          Banner Image URL *
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="https://example.com/banner.jpg"
                            value={banner.imageUrl || ""}
                            onChange={(e) =>
                              handleUpdateBanner(idx, "imageUrl", e.target.value)
                            }
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg shadow-xs transition-colors shrink-0">
                            {uploadingIndex === idx ? (
                              <Loader2 size={14} className="animate-spin text-blue-600" />
                            ) : (
                              <Upload size={14} />
                            )}
                            <span>{uploadingIndex === idx ? "Uploading..." : "Upload"}</span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingIndex === idx}
                              className="hidden"
                              onChange={(e) =>
                                handleFileUpload(idx, e.target.files?.[0])
                              }
                            />
                          </label>
                        </div>
                      </div>

                      {/* Image Preview thumbnail if available */}
                      {banner.imageUrl && (
                        <div className="relative w-full h-28 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-inner">
                          <img
                            src={banner.imageUrl}
                            alt={`Banner ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src =
                                "https://placehold.co/600x200?text=Invalid+Image+URL";
                            }}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                            Banner Title (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Festive Special Deals"
                            value={banner.title || ""}
                            onChange={(e) =>
                              handleUpdateBanner(idx, "title", e.target.value)
                            }
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                            Click Redirect Link (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. /search?category=audio"
                            value={banner.linkUrl || ""}
                            onChange={(e) =>
                              handleUpdateBanner(idx, "linkUrl", e.target.value)
                            }
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Live Customer Store Page Mockup (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm sticky top-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-sm">
                <Eye size={16} className="text-blue-600" />
                <span>Store Page Live Preview</span>
              </div>
              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                Mobile View
              </span>
            </div>

            {/* Simulated Mobile Mockup */}
            <div className="w-full max-w-[340px] mx-auto border-4 border-slate-800 rounded-[28px] overflow-hidden bg-slate-50 shadow-md">
              {/* Fake status bar */}
              <div className="bg-slate-900 text-white text-[10px] px-4 py-1 flex items-center justify-between">
                <span>9:12</span>
                <div className="flex items-center gap-1">
                  <span>5G</span>
                  <span>91%</span>
                </div>
              </div>

              {/* Store Header */}
              <div className="bg-white px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-slate-700 font-bold text-sm">←</div>
                  <span className="font-bold text-xs text-slate-900 truncate max-w-[140px]">
                    {selectedSeller?.shopName || selectedSeller?.name || "Store Name"} Store
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-xs">🔍</span>
                  <div className="relative">
                    <ShoppingBag size={14} />
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-bold w-3 h-3 rounded-full flex items-center justify-center">
                      2
                    </span>
                  </div>
                </div>
              </div>

              {/* Store Identity Badge */}
              <div className="bg-white p-3 border-b border-slate-100 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                  {(selectedSeller?.shopName || selectedSeller?.name || "S")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {selectedSeller?.shopName || selectedSeller?.name || "Shop Name"}
                    </span>
                    <CheckCircle2 size={12} className="text-blue-500 shrink-0" />
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate">
                    Verified Partner Seller
                  </span>
                </div>
              </div>

              {/* Banners Preview in Mobile */}
              {banners.filter((b) => b.imageUrl).length > 0 ? (
                <div className="p-2 space-y-1.5 bg-slate-100/60">
                  {banners
                    .filter((b) => b.imageUrl)
                    .map((banner, idx) => (
                      <div
                        key={idx}
                        className="w-full h-24 rounded-lg overflow-hidden bg-slate-200 shadow-xs border border-slate-200/60"
                      >
                        <img
                          src={banner.imageUrl}
                          alt={banner.title || `Banner ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-2 text-center text-[10px] text-slate-400 bg-slate-50 italic">
                  [No banners — products start directly here]
                </div>
              )}

              {/* Product Grid Sample (2 columns) */}
              <div className="p-2">
                <div className="text-[11px] font-bold text-slate-700 mb-1.5 px-0.5">
                  Products ({selectedSeller?.shopName || selectedSeller?.name || "Store"})
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 shadow-xs"
                    >
                      <div className="w-full h-16 bg-slate-100 rounded flex items-center justify-center text-slate-300 text-[10px]">
                        Item {item}
                      </div>
                      <div className="mt-1 font-semibold text-[10px] text-slate-800 truncate">
                        Product Sample {item}
                      </div>
                      <div className="text-[10px] font-bold text-slate-900">₹499</div>
                    </div>
                  ))}
                </div>

                {/* View More Button Demo */}
                <div className="mt-2 text-center">
                  <div className="w-full py-1.5 bg-[#FFC200] hover:bg-[#e6b000] text-slate-900 font-bold text-[10px] rounded shadow-xs">
                    View more
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
