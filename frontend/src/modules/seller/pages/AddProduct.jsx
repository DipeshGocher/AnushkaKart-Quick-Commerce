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
  HiOutlineXMark,
} from "react-icons/hi2";
import { HiOutlinePhotograph } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sellerApi } from "../services/sellerApi";

export const PRESET_HIGHLIGHT_ICONS = [
  // Organic & Food
  { id: "leaf", emoji: "🌿", name: "Natural / Organic" },
  { id: "avocado", emoji: "🥑", name: "Farm Fresh" },
  { id: "zap", emoji: "⚡", name: "High Protein" },
  { id: "sprout", emoji: "🌱", name: "Source of Fiber" },
  { id: "wheat", emoji: "🌾", name: "Whole Grain / Pure" },
  { id: "sugarfree", emoji: "🍬", name: "Sugar Free" },
  { id: "sun", emoji: "☀️", name: "Sun Dried" },
  { id: "smile", emoji: "🚫", name: "Chemical Free" },
  { id: "apple", emoji: "🍎", name: "100% Fresh Produce" },
  { id: "milk", emoji: "🥛", name: "Pure Dairy" },

  // Beauty & Personal Care
  { id: "sparkles", emoji: "✨", name: "Dermatologically Tested" },
  { id: "droplet", emoji: "💧", name: "100% Hydrating" },
  { id: "flower", emoji: "🌸", name: "Cruelty & Paraben Free" },
  { id: "lotion", emoji: "🧴", name: "UV Protection" },
  { id: "mirror", emoji: "🪞", name: "Glow & Radiance" },
  { id: "leaf2", emoji: "🍃", name: "100% Herbal" },

  // Trust & Quality
  { id: "shield", emoji: "🛡️", name: "100% Original / Authentic" },
  { id: "star", emoji: "⭐", name: "Premium Quality" },
  { id: "heart", emoji: "❤️", name: "Healthy / Low Fat" },
  { id: "trophy", emoji: "🏆", name: "Best Seller / Top Rated" },
  { id: "badge", emoji: "🏅", name: "Certified Quality" },

  // Delivery & Service
  { id: "truck", emoji: "🚚", name: "Fast Express Delivery" },
  { id: "repeat", emoji: "🔄", name: "Easy Returns / Warranty" },
  { id: "gift", emoji: "🎁", name: "Gift Pack Eligible" },

  // Electronics & Tech
  { id: "battery", emoji: "🔋", name: "Long Battery Life" },
  { id: "wireless", emoji: "📶", name: "Bluetooth / Wireless" },
  { id: "cpu", emoji: "💻", name: "High Speed Performance" },
  { id: "plug", emoji: "🔌", name: "Fast Charging" },
  { id: "snowflake", emoji: "❄️", name: "Energy Efficient" },
  { id: "volume", emoji: "🔊", name: "Premium Sound" },

  // Fashion & Apparel
  { id: "cotton", emoji: "🧵", name: "100% Pure Fabric" },
  { id: "shirt", emoji: "👕", name: "Breathable Material" },
  { id: "scissors", emoji: "✂️", name: "Custom Tailored" },
  { id: "wash", emoji: "🧼", name: "Color Fast & Washable" },

  // Sports & Fitness
  { id: "fitness", emoji: "🏋️", name: "Durable / Pro Grade" },
  { id: "fire", emoji: "🔥", name: "High Energy Boost" },
  { id: "water", emoji: "💧", name: "Sweat & Water Resistant" },

  // Monthly Kits & Packs
  { id: "box", emoji: "📦", name: "Monthly Supply" },
  { id: "family", emoji: "👨‍👩‍👧‍👦", name: "Family Pack" },
  { id: "value", emoji: "💰", name: "Best Value" },
];

const AddProduct = () => {
  const navigate = useNavigate();
  const [modalTab, setModalTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  const [variantImageFiles, setVariantImageFiles] = useState({});
  // Separate state for actual File objects (used in FormData submission)
  const [mainImageFile, setMainImageFile] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  // Object URL for local preview - must be revoked when changed
  const [mainImagePreview, setMainImagePreview] = useState(null);

  const makeSku = (name, index = 1) => {
    const prefix =
      String(name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 5) || "item";
    return `${prefix}-${String(index).padStart(3, "0")}`;
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
    stock: "",
    lowStockAlert: 5,
    category: "",
    subcategory: "",
    header: "",
    status: "active",
    isFeatured: false,
    isTopDeal: false,
    tags: "",
    weight: "",
    brand: "",
    shelfLife: "",
    countryOfOrigin: "",
    fssaiLicense: "",
    mainImage: null,   // Cloudinary URL string (for existing/URL-input images)
    galleryImages: [], // Array of Cloudinary URL strings (existing images)
    highlights: [
      { icon: "", label: "" },
      { icon: "", label: "" },
      { icon: "", label: "" },
      { icon: "", label: "" },
    ],
    specifications: [],
    conditionType: "new",
    variants: [
      {
        id: Date.now(),
        name: "",
        price: "",
        salePrice: "",
        stock: "",
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
        const res = await sellerApi.getCategoryTree();
        if (res.data.success) {
          const list = (res.data.results || res.data.result || [])
            .filter((h) => h.slug !== "all" && String(h.name || "").trim().toLowerCase() !== "all");
          setDbCategories(list);
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
    // Validate required fields
    if (!formData.name) {
      toast.error("Please fill in the Product Title");
      return;
    }

    if (!formData.header || !formData.category) {
      toast.error("Please select Main Group and Specific Category");
      return;
    }

    if (availableSubcategories.length > 0 && !formData.subcategory) {
      toast.error("Please select a Sub-Category");
      return;
    }

    const firstVariant = formData.variants[0] || {};
    if (!firstVariant.price || !firstVariant.stock) {
      toast.error("Main variant must have price and stock");
      return;
    }

    // Validate variants price vs salePrice
    const invalidVariant = formData.variants.find((v) => v.salePrice && Number(v.salePrice) > Number(v.price));
    if (invalidVariant) {
      toast.error(`Sale Price cannot be greater than Price for variant: ${invalidVariant.name || 'Main Variant'}`);
      return;
    }
    setIsSaving(true);
    try {
      const data = new FormData();

      // Basic fields
      data.append("name", formData.name);
      data.append("slug", formData.slug);
      data.append("sku", formData.sku);
      data.append("description", formData.description);
      data.append("tags", formData.tags);
      data.append("weight", formData.weight);
      data.append("brand", formData.brand);
      data.append("shelfLife", formData.shelfLife);
      data.append("countryOfOrigin", formData.countryOfOrigin);
      data.append("fssaiLicense", formData.fssaiLicense);
      data.append("status", formData.status);
      data.append("isFeatured", String(formData.isFeatured));
      data.append("isTopDeal", String(formData.isTopDeal));

      // Map top-level price/stock from first variant for indexing/listing
      data.append("price", firstVariant.price);
      data.append("salePrice", firstVariant.salePrice || 0);
      data.append("stock", firstVariant.stock);

      // Category IDs
      if (formData.header) data.append("headerId", formData.header);
      if (formData.category) data.append("categoryId", formData.category);
      if (formData.subcategory) data.append("subcategoryId", formData.subcategory);

      // Main image: send the actual File object if one was selected, otherwise send URL string
      if (mainImageFile instanceof File) {
        data.append("mainImage", mainImageFile);
      } else if (typeof formData.mainImage === "string" && formData.mainImage.trim() && !formData.mainImage.startsWith("data:")) {
        data.append("mainImage", formData.mainImage.trim());
      }

      // Gallery images: send actual File objects for newly selected files
      if (galleryFiles.length > 0) {
        galleryFiles.forEach((file) => {
          if (file instanceof File) data.append("galleryImages", file);
        });
      }
      // Also send any existing gallery URLs (not files)
      if (Array.isArray(formData.galleryImages) && formData.galleryImages.length > 0) {
        const existingUrls = formData.galleryImages.filter(
          (img) => typeof img === "string" && img.startsWith("http") && !img.startsWith("data:")
        );
        if (existingUrls.length > 0) {
          data.append("galleryImages", JSON.stringify(existingUrls));
        }
      }

      // Variants
      data.append("variants", JSON.stringify(formData.variants));

      // Append variant image files
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

      // Highlights
      const cleanedHighlights = (formData.highlights || [])
        .filter((h) => h && ((typeof h.label === "string" && h.label.trim().length > 0) || (typeof h.icon === "string" && h.icon.trim().length > 0)))
        .map((h) => ({
          icon: typeof h.icon === "string" ? h.icon.trim() : "",
          label: typeof h.label === "string" ? h.label.trim() : "",
        }));
      data.append("highlights", JSON.stringify(cleanedHighlights));

      // Specifications
      const cleanedSpecs = (formData.specifications || [])
        .filter((s) => s && (String(s.key || "").trim() || String(s.value || "").trim()))
        .map((s) => ({
          key: String(s.key || "").trim(),
          value: String(s.value || "").trim(),
        }));
      data.append("specifications", JSON.stringify(cleanedSpecs));

      data.append("conditionType", formData.conditionType || "new");

      const response = await sellerApi.createProduct(data);
      toast.success(response?.data?.message || "Product published successfully!");
      navigate("/seller/products");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const previewUrl = URL.createObjectURL(file);
      if (type === "main") {
        // Revoke previous object URL to avoid memory leak
        if (mainImagePreview && mainImagePreview.startsWith("blob:")) {
          URL.revokeObjectURL(mainImagePreview);
        }
        setMainImageFile(file);
        setMainImagePreview(previewUrl);
        // Keep mainImage as null so we know it's a new file (not a URL string)
        setFormData({ ...formData, mainImage: null });
      } else {
        setGalleryFiles((prev) => [...prev, file]);
        setFormData({
          ...formData,
          galleryImages: [...formData.galleryImages, previewUrl],
        });
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <Button
          variant="ghost"
          className="pl-0 hover:bg-transparent hover:text-primary-600"
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
            className="min-w-[140px]">
            {isSaving ? (
              <>
                <HiOutlineArrowPath className="mr-2 h-5 w-5 animate-spin" />
                Publishing...
              </>
            ) : (
              "Save & Publish"
            )}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-slate-100">
        {/* Sidebar Tabs */}
        <div className="md:w-64 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1 overflow-y-auto">
          {[
            { id: "general", label: "General Info", icon: HiOutlineTag },
            { id: "media", label: "Images & Media", icon: HiOutlinePhoto },
            { id: "variants", label: "Item Variants", icon: HiOutlineSwatch },
            { id: "category", label: "Groups", icon: HiOutlineFolderOpen },
            { id: "specifications", label: "More Details", icon: HiOutlineCube },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setModalTab(tab.id)}
              className={cn(
                "w-full flex items-center space-x-3 px-4 py-3 rounded-md text-xs font-bold transition-all text-left",
                modalTab === tab.id
                  ? "bg-white text-primary shadow-sm ring-1 ring-slate-100"
                  : "text-slate-600 hover:bg-slate-100",
              )}>
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}

          <div className="pt-8 px-4">
            <div className="p-4 bg-brand-50 rounded-md border border-brand-100">
              <p className="text-[9px] font-bold text-brand-600 uppercase tracking-widest mb-1">
                Status
              </p>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="w-full bg-transparent border-none text-xs font-bold text-brand-700 outline-none p-0 cursor-pointer focus:ring-0">
                <option value="active">PUBLISHED</option>
                <option value="inactive">DRAFT</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {modalTab === "general" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Product Title
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
                  className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                  placeholder="e.g. Premium Basmati Rice"
                />
              </div>
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  About this item
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[160px] max-h-[260px] outline-none transition-all focus:ring-2 focus:ring-primary/5 resize-none overflow-y-auto custom-scrollbar"
                  placeholder="Describe the item here..."
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
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                    placeholder="e.g. Amul"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Product Code
                  </label>
                  <input
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-mono font-bold outline-none ring-primary/5 focus:ring-2 transition-all"
                    placeholder="AUTO-GENERATED"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Shelf Life
                  </label>
                  <input
                    value={formData.shelfLife}
                    onChange={(e) => setFormData({ ...formData, shelfLife: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                    placeholder="e.g. 3 Days, 6 Months"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Country of Origin
                  </label>
                  <input
                    value={formData.countryOfOrigin}
                    onChange={(e) => setFormData({ ...formData, countryOfOrigin: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                    placeholder="e.g. India"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    FSSAI License
                  </label>
                  <input
                    value={formData.fssaiLicense}
                    onChange={(e) => setFormData({ ...formData, fssaiLicense: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                    placeholder="e.g. 100123..."
                  />
                </div>
              </div>
            </div>
          )}

          {modalTab === "media" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">Product Images</h4>
                <p className="text-xs text-slate-500 font-medium">
                  Upload product photos. Images are automatically saved to your Cloudinary storage.
                </p>
              </div>

              {/* Main Product Image Section */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider">
                    Main Product Image
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
                  <div className="h-32 w-32 shrink-0 rounded-2xl border-2 border-dashed border-slate-200 bg-white overflow-hidden flex items-center justify-center relative p-1 shadow-sm">
                    {mainImagePreview ? (
                      <img
                        src={mainImagePreview}
                        alt="Main Product Preview"
                        className="w-full h-full object-contain"
                      />
                    ) : formData.mainImage ? (
                      <img
                        src={formData.mainImage}
                        alt="Main Product"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <HiOutlinePhoto className="h-8 w-8 mx-auto text-slate-300" />
                        <span className="text-[10px] font-bold">No Image</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3 w-full">
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        id="main-image-upload"
                        onChange={(e) => handleImageUpload(e, "main")}
                        className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
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
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Gallery Images Section */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider block">
                      Gallery Images
                    </label>
                    <p className="text-[11px] text-slate-400">Add multiple additional images for customers to view</p>
                  </div>
                  <label className="cursor-pointer bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
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
                    <div key={idx} className="relative h-24 rounded-xl border border-slate-200 bg-white overflow-hidden p-1 group shadow-xs">
                      <img
                        src={imgUrl}
                        alt={`Gallery ${idx + 1}`}
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
                    <div className="col-span-full py-6 text-center text-slate-400 text-xs font-medium border-2 border-dashed border-slate-200 rounded-xl">
                      No gallery images uploaded yet
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
                    Product Variants
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">
                    Add different sizes, colors or weights.
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
                          stock: "",
                          sku: makeSku(prev.name, prev.variants.length + 1),
                        },
                      ],
                    }))
                  }
                  className="flex items-center space-x-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-bold hover:bg-primary/20 transition-all">
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
                            return {
                              ...prev,
                              variants: newVariants,
                            };
                          });
                        }}
                        placeholder="e.g. 1kg, 1 pack, 1 liter..."
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1 flex flex-col justify-end">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Price
                      </label>
                      <input
                        type="number"
                        min="0"
                        onKeyDown={(e) => {
                          if (['-', '+', 'e', 'E'].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        value={variant.price}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== '' && Number(val) < 0) return;

                          if (val !== '' && variant.salePrice && Number(val) < Number(variant.salePrice)) {
                            toast.error("Regular price cannot be less than sale price");
                            return;
                          }

                          const newVariants = [...formData.variants];
                          newVariants[index].price = val;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="500"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1 flex flex-col justify-end">
                      <label className="text-[8px] font-bold text-brand-500 uppercase tracking-widest ml-1">
                        Sale
                      </label>
                      <input
                        type="number"
                        min="0"
                        onKeyDown={(e) => {
                          if (['-', '+', 'e', 'E'].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        value={variant.salePrice}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== '' && Number(val) < 0) return;

                          if (val !== '' && variant.price && Number(val) > Number(variant.price)) {
                            toast.error("Sale price cannot be greater than regular price");
                            return;
                          }

                          const newVariants = [...formData.variants];
                          newVariants[index].salePrice = val;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="450"
                        className="w-full px-3 py-2 bg-brand-50 ring-1 ring-brand-100 border-none rounded-xl text-xs font-bold text-brand-700 outline-none focus:ring-2 focus:ring-brand-200"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1 flex flex-col justify-end">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Stock
                      </label>
                      <input
                        type="number"
                        min="0"
                        onKeyDown={(e) => {
                          if (['-', '+', 'e', 'E'].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        value={variant.stock}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== '' && Number(val) < 0) return;
                          const newVariants = [...formData.variants];
                          newVariants[index].stock = val;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="10"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="col-span-5 md:col-span-2 space-y-1 flex flex-col justify-end">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Product Code
                      </label>
                      <input
                        value={variant.sku}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].sku = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder={makeSku(formData.name, index + 1)}
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end pb-1 flex-col pb-2">
                      <button
                        onClick={() => {
                          if (formData.variants.length > 1) {
                            setFormData((prev) => {
                              const remaining = prev.variants
                                .map((variant, idx) => ({ variant, oldIndex: idx + 1 }))
                                .filter((item) => item.oldIndex !== index + 1)
                                .map((item, newIdx) => {
                                  const shouldAuto =
                                    !item.variant.sku ||
                                    isAutoSku(item.variant.sku, prev.name, item.oldIndex);
                                  return {
                                    ...item.variant,
                                    sku: shouldAuto ? makeSku(prev.name, newIdx + 1) : item.variant.sku,
                                  };
                                });

                              const newFiles = { ...variantImageFiles };
                              delete newFiles[index];
                              
                              // Re-index variant images
                              const reindexedFiles = {};
                              Object.keys(newFiles).forEach(key => {
                                 const numKey = Number(key);
                                 if (numKey > index) {
                                    reindexedFiles[numKey - 1] = newFiles[key];
                                 } else {
                                    reindexedFiles[numKey] = newFiles[key];
                                 }
                              });
                              setVariantImageFiles(reindexedFiles);

                              return { ...prev, variants: remaining };
                            });
                          }
                        }}
                        className={`p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors ${formData.variants.length === 1 ? "opacity-50 cursor-not-allowed" : ""
                          }`}>
                        <HiOutlineTrash className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Variant Images Row */}
                    <div className="col-span-12 mt-2 pt-3 border-t border-slate-200">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block ml-1">Variant Images (Max 5)</label>
                        <div className="flex gap-3 w-full overflow-x-auto pb-2 custom-scrollbar">
                           {[0, 1, 2, 3, 4].map(imgIdx => {
                              const hasFile = Boolean(variantImageFiles[index]?.[imgIdx]);
                              const hasUrl = Boolean(variant.images?.[imgIdx]);
                              const hasImage = hasFile || hasUrl;
                              return (
                                <div key={imgIdx} className="relative h-16 w-16 shrink-0 rounded-xl border-2 border-dashed border-slate-200 bg-white hover:border-primary/50 overflow-hidden flex items-center justify-center transition-colors group">
                                   {hasFile ? (
                                       <img src={URL.createObjectURL(variantImageFiles[index][imgIdx])} alt="" className="h-full w-full object-cover" />
                                   ) : hasUrl ? (
                                       <img src={variant.images[imgIdx]} alt="" className="h-full w-full object-cover" />
                                   ) : (
                                       <HiOutlinePhotograph className="h-5 w-5 text-slate-300" />
                                   )}

                                   {hasImage && (
                                     <button
                                       type="button"
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         e.preventDefault();
                                         if (hasFile) {
                                           const newFiles = [...(variantImageFiles[index] || [])];
                                           delete newFiles[imgIdx];
                                           setVariantImageFiles({ ...variantImageFiles, [index]: newFiles });
                                         }
                                         if (hasUrl) {
                                           setFormData((prev) => {
                                             const updatedVariants = [...(prev.variants || [])];
                                             if (updatedVariants[index] && Array.isArray(updatedVariants[index].images)) {
                                               const updatedImages = [...updatedVariants[index].images];
                                               updatedImages.splice(imgIdx, 1);
                                               updatedVariants[index] = { ...updatedVariants[index], images: updatedImages };
                                             }
                                             return { ...prev, variants: updatedVariants };
                                           });
                                         }
                                       }}
                                       className="absolute top-1 right-1 z-20 p-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full shadow-md transition-all cursor-pointer"
                                       title="Remove image"
                                     >
                                       <HiOutlineXMark className="w-3 h-3" />
                                     </button>
                                   )}

                                   {!hasImage && (
                                     <input
                                         type="file"
                                         accept="image/*"
                                         className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                         onChange={e => {
                                             if (e.target.files?.[0]) {
                                                 const newFiles = [...(variantImageFiles[index] || [])];
                                                 newFiles[imgIdx] = e.target.files[0];
                                                 setVariantImageFiles({ ...variantImageFiles, [index]: newFiles });
                                             }
                                         }}
                                     />
                                   )}
                                </div>
                              );
                           })}
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
                    Main Group <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.header}
                    onChange={(e) =>
                      setFormData({ ...formData, header: e.target.value, category: "", subcategory: "" })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all">
                    <option value="">Select Main Group</option>
                    {categories.map((h) => (
                      <option key={h._id || h.id} value={h._id || h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Specific Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value, subcategory: "" })
                    }
                    disabled={!formData.header}
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <option value="">Select Category</option>
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
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
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



          {modalTab === "specifications" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">More Details</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Add custom fields according to your product (e.g., Brand, Model Name, Tea Form, Shelf Life, etc.)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      specifications: [...(prev.specifications || []), { key: "", value: "" }],
                    }));
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-sm hover:bg-primary/90 transition-all self-start"
                >
                  <HiOutlinePlus className="w-4 h-4" />
                  <span>Add Field</span>
                </button>
              </div>

              {/* Quick suggestion tags */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Quick Add Suggestions:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Brand",
                    "Model Name",
                    "Type",
                    "Quantity",
                    "Pack Of",
                    "Tea Form",
                    "Container Type",
                    "Maximum Shelf Life",
                    "FSSAI Number",
                    "Usage Instructions",
                    "Nutrient Content",
                    "Ingredients",
                    "Additives",
                    "Net Quantity",
                    "Country of Origin",
                    "Weight",
                  ].map((suggestedKey) => {
                    const alreadyExists = (formData.specifications || []).some(
                      (s) => String(s.key || "").trim().toLowerCase() === suggestedKey.toLowerCase()
                    );
                    return (
                      <button
                        key={suggestedKey}
                        type="button"
                        disabled={alreadyExists}
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            specifications: [
                              ...(prev.specifications || []),
                              { key: suggestedKey, value: "" },
                            ],
                          }));
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-medium transition-all border",
                          alreadyExists
                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                            : "bg-slate-50 hover:bg-primary/10 hover:border-primary/30 text-slate-700 border-slate-200"
                        )}
                      >
                        + {suggestedKey}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Specifications List */}
              <div className="space-y-3">
                {(!formData.specifications || formData.specifications.length === 0) ? (
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <HiOutlineCube className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">No details added yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Click 'Add Field' above or select any quick suggestion to add attributes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          specifications: [{ key: "", value: "" }],
                        }));
                      }}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all"
                    >
                      Add First Detail
                    </button>
                  </div>
                ) : (
                  formData.specifications.map((spec, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl hover:border-slate-300 transition-all"
                    >
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Field Name / Title
                        </label>
                        <input
                          type="text"
                          value={spec.key}
                          onChange={(e) => {
                            const next = [...(formData.specifications || [])];
                            next[index] = { ...next[index], key: e.target.value };
                            setFormData({ ...formData, specifications: next });
                          }}
                          placeholder="e.g. Brand, Model Name, Type"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/10"
                        />
                      </div>

                      <div className="flex-[1.5]">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Value
                        </label>
                        <input
                          type="text"
                          value={spec.value}
                          onChange={(e) => {
                            const next = [...(formData.specifications || [])];
                            next[index] = { ...next[index], value: e.target.value };
                            setFormData({ ...formData, specifications: next });
                          }}
                          placeholder="e.g. Tata Tea Premium, 1.5 kg, Pouch"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/10"
                        />
                      </div>

                      <div className="pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            const next = (formData.specifications || []).filter((_, i) => i !== index);
                            setFormData({ ...formData, specifications: next });
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Remove field"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddProduct;
