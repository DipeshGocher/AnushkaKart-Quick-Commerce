import React, { useState, useMemo, useEffect } from "react";
import Button from "@shared/components/ui/Button";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlineArrowLeft,
  HiOutlineCube,
  HiOutlineTag,
  HiOutlineCurrencyDollar,
  HiOutlineSwatch,
  HiOutlineFolderOpen,
  HiOutlinePhoto,
  HiOutlineScale,
  HiOutlineArrowPath,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineSquaresPlus,
  HiOutlineSparkles,
  HiOutlineShieldCheck,
  HiOutlineDevicePhoneMobile,
  HiOutlineDeviceTablet,
  HiOutlineCpuChip,
  HiOutlineCheckCircle,
  HiOutlineXMark,
} from "react-icons/hi2";
import { HiOutlinePhotograph } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sellerApi } from "../services/sellerApi";

export const REFURBISHED_HIGHLIGHT_PRESETS = [
  // Quality & Testing
  { id: "qc_passed", emoji: "🛡️", name: "32-Point Quality Inspected" },
  { id: "battery_verified", emoji: "🔋", name: "Battery Health Verified (>85%)" },
  { id: "certified", emoji: "🏆", name: "Certified Refurbished" },
  { id: "serial_verified", emoji: "📜", name: "GST Invoice & Serial Verified" },

  // Warranty & Guarantee
  { id: "warranty_seller", emoji: "⭐", name: "6/12 Months Seller Warranty" },
  { id: "replacement", emoji: "🔁", name: "7-Day Hassle-Free Replacement" },

  // Accessories & Condition
  { id: "orig_acc", emoji: "⚡", name: "Original Accessories Included" },
  { id: "scratchless", emoji: "✨", name: "Superb Grade A - Scratchless" },
  { id: "unlocked", emoji: "🔓", name: "Network Unlocked / Dual SIM" },

  // Hardware & Performance
  { id: "performance", emoji: "💻", name: "Benchmark Tested & Reset" },
  { id: "display_ok", emoji: "📱", name: "Original Display Inspected" },
  { id: "water_seal", emoji: "💧", name: "Water & Dust Seal Checked" },
];

const AddRefurbishedProduct = () => {
  const navigate = useNavigate();
  const [modalTab, setModalTab] = useState("refurbished");
  const [isSaving, setIsSaving] = useState(false);
  const [variantImageFiles, setVariantImageFiles] = useState({});
  const [mainImageFile, setMainImageFile] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [mainImagePreview, setMainImagePreview] = useState(null);

  useEffect(() => {
    return () => {
      if (mainImagePreview && mainImagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(mainImagePreview);
      }
    };
  }, [mainImagePreview]);

  const handleImageUpload = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const previewUrl = URL.createObjectURL(file);
      if (type === "main") {
        if (mainImagePreview && mainImagePreview.startsWith("blob:")) {
          URL.revokeObjectURL(mainImagePreview);
        }
        setMainImageFile(file);
        setMainImagePreview(previewUrl);
        setFormData((prev) => ({ ...prev, mainImage: null }));
      } else {
        setGalleryFiles((prev) => [...prev, file]);
        setFormData((prev) => ({
          ...prev,
          galleryImages: [...(prev.galleryImages || []), previewUrl],
        }));
      }
    }
  };

  const makeSku = (name, index = 1) => {
    const prefix =
      String(name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 5) || "item";
    return `ref-${prefix}-${String(index).padStart(3, "0")}`;
  };

  const isAutoSku = (sku, name, index = 1) =>
    String(sku || "").toLowerCase() === makeSku(name, index);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    sku: "",
    description: "",
    price: "",
    salePrice: "",
    stock: "1",
    lowStockAlert: 1,
    category: "",
    subcategory: "",
    header: "",
    status: "active",
    tags: "refurbished, secondhand, mobile, electronics",
    weight: "0.5kg",
    brand: "",
    shelfLife: "",
    countryOfOrigin: "India",
    fssaiLicense: "",
    mainImage: null,
    galleryImages: [],
    highlights: [
      { icon: "qc_passed", label: "32-Point Quality Inspected" },
      { icon: "battery_verified", label: "Battery Health Verified (>85%)" },
      { icon: "warranty_seller", label: "Seller Warranty Included" },
      { icon: "orig_acc", label: "Original Accessories Included" },
    ],
    conditionType: "refurbished",
    refurbishedDetails: {
      grade: "Grade A (Superb)",
      batteryHealth: 92,
      warrantyMonths: 6,
      imeiNumber: "",
      qcPassed: true,
      boxItems: ["Charger", "Original Box", "USB Cable"],
    },
    variants: [
      {
        id: Date.now(),
        name: "Standard Package",
        price: "",
        salePrice: "",
        stock: "1",
        sku: "",
      },
    ],
  });

  const [dbCategories, setDbCategories] = useState([]);
  const [isLoadingCats, setIsLoadingCats] = useState(true);

  useEffect(() => {
    setFormData((prev) => {
      if (!prev.name) return prev;

      const nextSku =
        !prev.sku || isAutoSku(prev.sku, prev.name, 1)
          ? makeSku(prev.name, 1)
          : prev.sku;

      const nextVariants = prev.variants.map((variant, idx) => {
        const variantIndex = idx + 1;
        const shouldAuto =
          !variant.sku || isAutoSku(variant.sku, prev.name, variantIndex);
        return shouldAuto
          ? { ...variant, sku: makeSku(prev.name, variantIndex) }
          : variant;
      });

      const changed =
        nextSku !== prev.sku ||
        nextVariants.some((variant, idx) => variant !== prev.variants[idx]);

      return changed ? { ...prev, sku: nextSku, variants: nextVariants } : prev;
    });
  }, [formData.name]);

  React.useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await sellerApi.getCategoryTree({ catalogType: "refurbished" });
        if (res.data.success) {
          setDbCategories(res.data.results || res.data.result || []);
        }
      } catch (error) {
        toast.error("Failed to load categories");
      } finally {
        setIsLoadingCats(false);
      }
    };
    fetchCats();
  }, []);

  const categories = dbCategories;

  const selectedHeader = useMemo(() => {
    return categories.find((h) => String(h._id || h.id || "") === String(formData.header || ""));
  }, [categories, formData.header]);

  const availableCategories = useMemo(() => {
    return selectedHeader?.children || [];
  }, [selectedHeader]);

  const selectedCategory = useMemo(() => {
    return availableCategories.find((c) => String(c._id || c.id || "") === String(formData.category || ""));
  }, [availableCategories, formData.category]);

  const availableSubcategories = useMemo(() => {
    return selectedCategory?.children || selectedCategory?.subcategories || [];
  }, [selectedCategory]);

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Please enter Device/Product Title (e.g., iPhone 13 Pro Max - 128GB)");
      return;
    }

    if (!formData.header || !formData.category) {
      toast.error("Please select Device Type and Brand");
      return;
    }

    const firstVariant = formData.variants[0] || {};
    if (!firstVariant.price || !firstVariant.stock) {
      toast.error("Device variant must have price and stock");
      return;
    }

    setIsSaving(true);
    try {
      const data = new FormData();

      data.append("name", formData.name);
      data.append("slug", formData.slug);
      data.append("sku", formData.sku);
      data.append("description", formData.description);
      data.append("tags", formData.tags);
      data.append("weight", formData.weight);
      data.append("brand", formData.brand);
      data.append("countryOfOrigin", formData.countryOfOrigin);
      data.append("status", formData.status);

      data.append("price", firstVariant.price);
      data.append("salePrice", firstVariant.salePrice || 0);
      data.append("stock", firstVariant.stock);

      if (formData.header) data.append("headerId", formData.header);
      if (formData.category) data.append("categoryId", formData.category);
      if (formData.subcategory) data.append("subcategoryId", formData.subcategory);

      // Main image
      if (mainImageFile instanceof File) {
        data.append("mainImage", mainImageFile);
      } else if (typeof formData.mainImage === "string" && formData.mainImage.trim() && !formData.mainImage.startsWith("data:")) {
        data.append("mainImage", formData.mainImage.trim());
      }

      // Gallery images
      if (galleryFiles.length > 0) {
        galleryFiles.forEach((file) => {
          if (file instanceof File) data.append("galleryImages", file);
        });
      }
      if (Array.isArray(formData.galleryImages) && formData.galleryImages.length > 0) {
        const existingUrls = formData.galleryImages.filter(
          (img) => typeof img === "string" && img.startsWith("http") && !img.startsWith("blob:") && !img.startsWith("data:")
        );
        if (existingUrls.length > 0) {
          data.append("galleryImages", JSON.stringify(existingUrls));
        }
      }

      data.append("variants", JSON.stringify(formData.variants));

      Object.keys(variantImageFiles).forEach((vIndex) => {
        const filesArray = variantImageFiles[vIndex];
        if (Array.isArray(filesArray)) {
           filesArray.forEach((file, imgIndex) => {
              if (file) {
                 data.append(`variantImage_${vIndex}_${imgIndex}`, file);
              }
           });
        } else if (filesArray instanceof File || (filesArray && typeof filesArray === 'object' && filesArray.name)) {
           data.append(`variantImage_${vIndex}_0`, filesArray);
        }
      });

      const cleanedHighlights = (formData.highlights || [])
        .filter((h) => h && ((typeof h.label === "string" && h.label.trim().length > 0) || (typeof h.icon === "string" && h.icon.trim().length > 0)))
        .map((h) => ({
          icon: typeof h.icon === "string" ? h.icon.trim() : "",
          label: typeof h.label === "string" ? h.label.trim() : "",
        }));
      data.append("highlights", JSON.stringify(cleanedHighlights));

      data.append("conditionType", "refurbished");
      data.append("refurbishedDetails", JSON.stringify(formData.refurbishedDetails || {}));

      const response = await sellerApi.createProduct(data);
      const approvalStatus = response?.data?.result?.approvalStatus;
      if (approvalStatus === "pending") {
        toast.success("Refurbished product submitted for admin approval");
      } else {
        toast.success("Refurbished product published successfully!");
      }
      navigate("/seller/products");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save refurbished product");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <Button
          variant="ghost"
          className="pl-0 hover:bg-transparent hover:text-orange-600"
          onClick={() => navigate(-1)}>
          <HiOutlineArrowLeft className="mr-2 h-5 w-5" />
          Back to Products
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="min-w-[170px] bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black hover:brightness-110 shadow-md">
            {isSaving ? (
              <>
                <HiOutlineArrowPath className="mr-2 h-5 w-5 animate-spin" />
                Publishing...
              </>
            ) : (
              "Save Refurbished Device"
            )}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-orange-100">
        {/* Sidebar Tabs */}
        <div className="md:w-64 bg-amber-50/30 border-r border-orange-100 p-4 space-y-1 overflow-y-auto">
          {[
            { id: "refurbished", label: "Refurbished Specs", icon: HiOutlineDevicePhoneMobile },
            { id: "general", label: "General & Title", icon: HiOutlineTag },
            { id: "media", label: "Device Media", icon: HiOutlinePhoto },
            { id: "variants", label: "Storage & Variants", icon: HiOutlineSwatch },
            { id: "category", label: "Category & Brand", icon: HiOutlineFolderOpen },
            { id: "highlights", label: "Quality Highlights", icon: HiOutlineSparkles },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setModalTab(tab.id)}
              className={cn(
                "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left",
                modalTab === tab.id
                  ? "bg-white text-orange-600 shadow-md ring-1 ring-orange-200"
                  : "text-slate-600 hover:bg-orange-50",
              )}>
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}

          <div className="pt-8 px-4">
            <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
              <p className="text-[9px] font-bold text-orange-600 uppercase tracking-widest mb-1">
                Product Condition
              </p>
              <div className="text-xs font-black text-orange-700 flex items-center gap-1.5">
                <span>✓</span> Refurbished / 2nd Hand
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {modalTab === "refurbished" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 p-5 rounded-2xl border border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Refurbished & Second-Hand Specifications</h3>
                    <p className="text-xs text-slate-500 font-medium">Specify device condition grade, battery health %, seller warranty and included box items</p>
                  </div>
                  <div className="bg-orange-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-black shadow-xs">
                    ✓ Refurbished Active
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Device Grade <span className="text-rose-500">*</span></label>
                    <select
                      value={formData.refurbishedDetails?.grade || 'Grade A (Superb)'}
                      onChange={(e) => setFormData({
                        ...formData,
                        conditionType: 'refurbished',
                        refurbishedDetails: { ...(formData.refurbishedDetails || {}), grade: e.target.value }
                      })}
                      className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-xs font-bold outline-none ring-orange-500/10 focus:ring-2"
                    >
                      <option value="Grade A (Superb)">Grade A (Superb) - Scratchless, pristine like-new condition</option>
                      <option value="Grade B (Good)">Grade B (Good) - Minor cosmetic scuffs, 100% functional</option>
                      <option value="Grade C (Fair)">Grade C (Fair) - Visible scratches, fully tested & working</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Battery Health (%)</label>
                    <input
                      type="number"
                      min="50"
                      max="100"
                      value={formData.refurbishedDetails?.batteryHealth ?? 92}
                      onChange={(e) => setFormData({
                        ...formData,
                        refurbishedDetails: { ...(formData.refurbishedDetails || {}), batteryHealth: Number(e.target.value) }
                      })}
                      className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-xs font-bold outline-none"
                      placeholder="e.g. 92"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Seller Warranty (Months)</label>
                    <select
                      value={formData.refurbishedDetails?.warrantyMonths ?? 6}
                      onChange={(e) => setFormData({
                        ...formData,
                        refurbishedDetails: { ...(formData.refurbishedDetails || {}), warrantyMonths: Number(e.target.value) }
                      })}
                      className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-xs font-bold outline-none"
                    >
                      <option value={0}>No Warranty</option>
                      <option value={3}>3 Months Warranty</option>
                      <option value={6}>6 Months Warranty</option>
                      <option value={12}>12 Months Warranty</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">IMEI / Serial Number (Optional)</label>
                    <input
                      type="text"
                      value={formData.refurbishedDetails?.imeiNumber || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        refurbishedDetails: { ...(formData.refurbishedDetails || {}), imeiNumber: e.target.value }
                      })}
                      className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-xs font-bold outline-none"
                      placeholder="15-digit IMEI or Device Serial Number"
                    />
                  </div>
                </div>

                {/* Box items */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Box Contents (Included Accessories)</label>
                  <div className="flex flex-wrap gap-2">
                    {['Charger', 'Original Box', 'USB Cable', 'Bill / Invoice', 'Earphones', 'SIM Ejector Tool', 'Laptop Power Adapter', 'Stylus / Pen'].map((boxItem) => {
                      const currentBoxItems = formData.refurbishedDetails?.boxItems || [];
                      const isChecked = currentBoxItems.includes(boxItem);
                      return (
                        <button
                          key={boxItem}
                          type="button"
                          onClick={() => {
                            const updated = isChecked
                              ? currentBoxItems.filter((i) => i !== boxItem)
                              : [...currentBoxItems, boxItem];
                            setFormData({
                              ...formData,
                              refurbishedDetails: { ...(formData.refurbishedDetails || {}), boxItems: updated }
                            });
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                            isChecked
                              ? "bg-orange-500 border-orange-600 text-white shadow-xs"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          {isChecked ? '✓ ' : '+ '}{boxItem}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {modalTab === "general" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Device / Product Title <span className="text-rose-500">*</span>
                </label>
                <input
                  value={formData.name}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      name: nextName,
                      sku:
                        !prev.sku || isAutoSku(prev.sku, prev.name, 1)
                          ? makeSku(nextName, 1)
                          : prev.sku,
                      variants: prev.variants.map((variant, idx) => {
                        const variantIndex = idx + 1;
                        const shouldAuto =
                          !variant.sku ||
                          isAutoSku(variant.sku, prev.name, variantIndex);
                        return shouldAuto
                          ? { ...variant, sku: makeSku(nextName, variantIndex) }
                          : variant;
                      }),
                    }));
                  }}
                  className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-orange-500/10 focus:ring-2 transition-all"
                  placeholder="e.g. Apple iPhone 13 (128GB) - Midnight Black"
                />
              </div>

              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Device Description & Condition Notes
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[140px] outline-none transition-all resize-none"
                  placeholder="Describe device condition, screen clarity, body status and operational readiness..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Brand Name
                  </label>
                  <input
                    value={formData.brand}
                    onChange={(e) =>
                      setFormData({ ...formData, brand: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none"
                    placeholder="e.g. Apple, Samsung, Dell, Lenovo"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    SKU / Reference ID
                  </label>
                  <input
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-mono font-bold outline-none"
                    placeholder="AUTO-GENERATED"
                  />
                </div>
              </div>
            </div>
          )}

          {modalTab === "media" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">Device Images & Gallery</h4>
                <p className="text-xs text-slate-500 font-medium">
                  Upload photos of the device (front, back, screen on, accessories). Uploaded images are stored in Cloudinary.
                </p>
              </div>

              {/* Main Product Image Section */}
              <div className="bg-amber-50/40 p-5 rounded-2xl border border-orange-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider">
                    Main Device Photo
                  </label>
                  {(mainImagePreview || formData.mainImage) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (mainImagePreview && mainImagePreview.startsWith("blob:")) {
                          URL.revokeObjectURL(mainImagePreview);
                        }
                        setMainImageFile(null);
                        setMainImagePreview(null);
                        setFormData({ ...formData, mainImage: null });
                      }}
                      className="text-xs text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <HiOutlineTrash className="h-3.5 w-3.5" /> Remove
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                  <div className="h-32 w-32 shrink-0 rounded-2xl border-2 border-dashed border-orange-200 bg-white overflow-hidden flex items-center justify-center relative p-1 shadow-sm">
                    {mainImagePreview ? (
                      <img
                        src={mainImagePreview}
                        alt="Device Preview"
                        className="w-full h-full object-contain"
                      />
                    ) : formData.mainImage ? (
                      <img
                        src={formData.mainImage}
                        alt="Device"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <HiOutlinePhoto className="h-8 w-8 mx-auto text-slate-300" />
                        <span className="text-[10px] font-bold">No Photo</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3 w-full">
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        id="refurbished-main-image"
                        onChange={(e) => handleImageUpload(e, "main")}
                        className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-600 file:text-white hover:file:bg-orange-700 cursor-pointer"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">PNG, JPG, WEBP up to 10MB</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Or enter direct image URL
                      </label>
                      <input
                        type="text"
                        value={typeof formData.mainImage === "string" ? formData.mainImage : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (mainImagePreview && mainImagePreview.startsWith("blob:")) {
                            URL.revokeObjectURL(mainImagePreview);
                          }
                          setMainImageFile(null);
                          setMainImagePreview(null);
                          setFormData({ ...formData, mainImage: val });
                        }}
                        placeholder="https://res.cloudinary.com/..."
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-orange-500/10"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Gallery Images Section */}
              <div className="bg-amber-50/40 p-5 rounded-2xl border border-orange-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider block">
                      Device Angles & Accessories
                    </label>
                    <p className="text-[11px] text-slate-400">Add photos of back, sides, bill/box, charger</p>
                  </div>
                  <label className="cursor-pointer bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                    <HiOutlinePlus className="h-4 w-4" />
                    <span>Upload Images</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const newFiles = Array.from(e.target.files);
                          const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
                          setGalleryFiles((prev) => [...prev, ...newFiles]);
                          setFormData((prev) => ({
                            ...prev,
                            galleryImages: [...(prev.galleryImages || []), ...newPreviews],
                          }));
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2">
                  {(formData.galleryImages || []).map((imgUrl, idx) => (
                    <div key={idx} className="relative h-24 rounded-xl border border-orange-200/80 bg-white overflow-hidden p-1 group shadow-xs">
                      <img
                        src={imgUrl}
                        alt={`Device Gallery ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (imgUrl.startsWith("blob:")) {
                            URL.revokeObjectURL(imgUrl);
                          }
                          setFormData((prev) => ({
                            ...prev,
                            galleryImages: prev.galleryImages.filter((_, i) => i !== idx),
                          }));
                          setGalleryFiles((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        aria-label="Remove image"
                      >
                        <HiOutlineXMark className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {(!formData.galleryImages || formData.galleryImages.length === 0) && (
                    <div className="col-span-full py-6 text-center text-slate-400 text-xs font-medium border-2 border-dashed border-orange-200 rounded-xl">
                      No additional photos uploaded yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {modalTab === "variants" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Storage & Color Variants
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">
                    Configure device prices, stock quantity and color options.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      variants: [
                        ...prev.variants,
                        {
                          id: Date.now(),
                          name: "",
                          price: "",
                          salePrice: "",
                          stock: "1",
                          sku: makeSku(prev.name, prev.variants.length + 1),
                        },
                      ],
                    }))
                  }
                  className="flex items-center space-x-2 px-3 py-1.5 bg-orange-500/10 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-500/20 transition-all">
                  <HiOutlineSquaresPlus className="h-4 w-4" />
                  <span>ADD VARIANT</span>
                </button>
              </div>

              <div className="space-y-3">
                {(formData.variants || []).map((variant, index) => (
                  <div key={variant.id} className="grid grid-cols-12 gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 relative group">
                    <div className="col-span-12 md:col-span-3 space-y-1 flex flex-col justify-end">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Variant Name
                      </label>
                      <input
                        value={variant.name}
                        onChange={(e) => {
                          setFormData((prev) => {
                            const newVariants = [...prev.variants];
                            newVariants[index].name = e.target.value;
                            return { ...prev, variants: newVariants };
                          });
                        }}
                        placeholder="e.g. 128GB Space Gray"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-semibold outline-none"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1 flex flex-col justify-end">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Original Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={variant.price}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newVariants = [...formData.variants];
                          newVariants[index].price = val;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="79900"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1 flex flex-col justify-end">
                      <label className="text-[8px] font-bold text-orange-600 uppercase tracking-widest ml-1">
                        Refurbished Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={variant.salePrice}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newVariants = [...formData.variants];
                          newVariants[index].salePrice = val;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="38990"
                        className="w-full px-3 py-2 bg-orange-50 ring-1 ring-orange-200 border-none rounded-xl text-xs font-bold text-orange-700 outline-none"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1 flex flex-col justify-end">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Quantity Stock
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={variant.stock}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newVariants = [...formData.variants];
                          newVariants[index].stock = val;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="1"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="col-span-5 md:col-span-2 space-y-1 flex flex-col justify-end">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        SKU Code
                      </label>
                      <input
                        value={variant.sku}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].sku = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder={makeSku(formData.name, index + 1)}
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-mono font-bold outline-none"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end pb-1 flex-col">
                      <button
                        onClick={() => {
                          if (formData.variants.length > 1) {
                            const remaining = formData.variants.filter((_, idx) => idx !== index);
                            setFormData({ ...formData, variants: remaining });
                          }
                        }}
                        className={`p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors ${formData.variants.length === 1 ? "opacity-50 cursor-not-allowed" : ""}`}>
                        <HiOutlineTrash className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Variant Images Row */}
                    <div className="col-span-12 mt-2 pt-3 border-t border-slate-200">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block ml-1">Device Photos (Max 5)</label>
                      <div className="flex gap-3 w-full overflow-x-auto pb-2 custom-scrollbar">
                        {[0, 1, 2, 3, 4].map(imgIdx => (
                          <div key={imgIdx} className="relative h-16 w-16 shrink-0 rounded-xl border-2 border-dashed border-slate-200 bg-white hover:border-orange-500/50 overflow-hidden cursor-pointer flex items-center justify-center transition-colors">
                            {variantImageFiles[index]?.[imgIdx] ? (
                              <img src={URL.createObjectURL(variantImageFiles[index][imgIdx])} alt="" className="h-full w-full object-cover" />
                            ) : variant.images?.[imgIdx] ? (
                              <img src={variant.images[imgIdx]} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <HiOutlinePhotograph className="h-5 w-5 text-slate-300" />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={e => {
                                if (e.target.files?.[0]) {
                                  const newFiles = [...(variantImageFiles[index] || [])];
                                  newFiles[imgIdx] = e.target.files[0];
                                  setVariantImageFiles({ ...variantImageFiles, [index]: newFiles });
                                }
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modalTab === "category" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Device Type (Header) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.header}
                    onChange={(e) =>
                      setFormData({ ...formData, header: e.target.value, category: "", subcategory: "" })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer">
                    <option value="">Select Device Type (e.g. Mobiles, Laptops)</option>
                    {categories.map((h) => (
                      <option key={h._id || h.id} value={h._id || h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Brand (Main Category) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value, subcategory: "" })
                    }
                    disabled={!formData.header}
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50">
                    <option value="">Select Brand (e.g. Apple, Samsung, Dell)</option>
                    {availableCategories.map((c) => (
                      <option key={c._id || c.id} value={c._id || c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Sub-Category {availableSubcategories.length > 0 ? (
                      <span className="text-rose-500">*</span>
                    ) : (
                      <span className="text-slate-400 font-normal lowercase">(Optional - None available)</span>
                    )}
                  </label>
                  <select
                    value={formData.subcategory}
                    onChange={(e) =>
                      setFormData({ ...formData, subcategory: e.target.value })
                    }
                    disabled={!formData.category}
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50">
                    {!formData.category ? (
                      <option value="">Select Category First</option>
                    ) : availableSubcategories.length === 0 ? (
                      <option value="">No Sub-Category for this Category</option>
                    ) : (
                      <>
                        <option value="">Select Sub-Category</option>
                        {availableSubcategories.map((sc) => (
                          <option key={sc._id || sc.id} value={sc._id || sc.id}>
                            {sc.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>
          )}

          {modalTab === "highlights" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Second-Hand Device Highlight Badges
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Select inspection highlights and quality assurances to display on product detail cards.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[0, 1, 2, 3].map((slotIdx) => {
                  const currentHighlight = formData.highlights?.[slotIdx] || { icon: "", label: "" };
                  const selectedPreset = REFURBISHED_HIGHLIGHT_PRESETS.find((i) => i.id === currentHighlight.icon);
                  return (
                    <div key={slotIdx} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Highlight #{slotIdx + 1}
                        </span>
                        <span className="text-xl">
                          {selectedPreset?.emoji || "✨"}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-white rounded-xl border border-slate-200">
                        {REFURBISHED_HIGHLIGHT_PRESETS.map((ic) => {
                          const isSelected = currentHighlight.icon === ic.id;
                          return (
                            <button
                              key={ic.id}
                              type="button"
                              onClick={() => {
                                const nextHL = [...(formData.highlights || [])];
                                if (isSelected) {
                                  nextHL[slotIdx] = { icon: "", label: "" };
                                } else {
                                  nextHL[slotIdx] = { icon: ic.id, label: ic.name };
                                }
                                setFormData({ ...formData, highlights: nextHL });
                              }}
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border",
                                isSelected
                                  ? "bg-orange-500 border-orange-600 text-white shadow-xs"
                                  : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                              )}
                            >
                              <span>{ic.emoji}</span>
                              <span className="text-[10px]">{ic.name}</span>
                            </button>
                          );
                        })}
                      </div>

                      <input
                        type="text"
                        value={currentHighlight.label}
                        onChange={(e) => {
                          const nextHL = [...(formData.highlights || [])];
                          nextHL[slotIdx] = { ...currentHighlight, label: e.target.value };
                          setFormData({ ...formData, highlights: nextHL });
                        }}
                        placeholder="e.g. 32-Point Quality Inspected"
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddRefurbishedProduct;
