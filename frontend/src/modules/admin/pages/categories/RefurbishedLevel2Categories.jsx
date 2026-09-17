import React, { useState, useEffect, useMemo, useRef } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Pagination from "@shared/components/ui/Pagination";
import {
  Plus,
  Search,
  Edit,
  Trash,
  X,
  Upload,
  Filter,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  Grid
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../../services/adminApi";
import { toast } from "sonner";
import { MOBILE_BRAND_LOGOS, getBrandSvgDataUri } from "@shared/constants/mobileBrandLogos";

const makeSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/-+/g, "-");

const RefurbishedLevel2Categories = () => {
  const [categories, setCategories] = useState([]);
  const [headerCategories, setHeaderCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterHeader, setFilterHeader] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Logo selection mode state
  const [imageSourceMode, setImageSourceMode] = useState("logo"); // "logo" | "upload"
  const [selectedLogoId, setSelectedLogoId] = useState(null);
  const [logoSearchTerm, setLogoSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    status: "active",
    type: "category",
    catalogType: "refurbished",
    parentId: "",
    sortOrder: 0,
  });

  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getCategories({ catalogType: "refurbished" });
      if (res.data.success) {
        const payload = res.data.result;
        const results = res.data.results;
        const allCats = Array.isArray(results)
          ? results
          : Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.items)
              ? payload.items
              : [];
        const refurbishedOnly = allCats.filter((c) => c.catalogType === "refurbished");
        setCategories(refurbishedOnly.filter((c) => c.type === "category"));
        setHeaderCategories(refurbishedOnly.filter((c) => c.type === "header"));
      }
    } catch (error) {
      toast.error("Failed to fetch refurbished brands");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesSearch = cat.name.toLowerCase().includes(searchTerm.toLowerCase());
      const parentIdStr = typeof cat.parentId === "object" ? cat.parentId?._id : cat.parentId;
      const matchesHeader = filterHeader === "all" || parentIdStr === filterHeader;
      return matchesSearch && matchesHeader;
    });
  }, [categories, searchTerm, filterHeader]);

  // Filtered preset brand logos for logo selector
  const filteredBrandLogos = useMemo(() => {
    if (!logoSearchTerm.trim()) return MOBILE_BRAND_LOGOS;
    const term = logoSearchTerm.toLowerCase().trim();
    return MOBILE_BRAND_LOGOS.filter(
      (b) => b.name.toLowerCase().includes(term) || b.id.includes(term)
    );
  }, [logoSearchTerm]);

  const handleOpenAddModal = (cat = null) => {
    setImageSearchTerm("");
    setLogoSearchTerm("");
    setImageSourceMode("logo");

    if (cat) {
      setEditingItem(cat);
      const parentIdStr = typeof cat.parentId === "object" ? cat.parentId?._id : cat.parentId || "";
      setFormData({
        name: cat.name || "",
        slug: cat.slug || "",
        description: cat.description || "",
        status: cat.status || "active",
        type: "category",
        catalogType: "refurbished",
        parentId: parentIdStr,
        sortOrder: cat.sortOrder || 0,
      });
      setPreviewUrl(cat.image || null);

      // Check if image matches one of preset brand logos
      const matchingBrand = MOBILE_BRAND_LOGOS.find(
        (b) => b.name.toLowerCase() === (cat.name || "").toLowerCase()
      );
      if (matchingBrand) {
        setSelectedLogoId(matchingBrand.id);
      } else {
        setSelectedLogoId(null);
      }
    } else {
      setEditingItem(null);
      setFormData({
        name: "",
        slug: "",
        description: "",
        status: "active",
        type: "category",
        catalogType: "refurbished",
        parentId: headerCategories[0]?._id || "",
        sortOrder: 0,
      });
      setPreviewUrl(null);
      setSelectedLogoId(null);
    }
    setImageFile(null);
    setIsAddModalOpen(true);
  };

  const handleSelectBrandLogo = (brand) => {
    setSelectedLogoId(brand.id);
    const dataUri = getBrandSvgDataUri(brand.svg);
    setPreviewUrl(dataUri);
    setImageFile(null);

    // Auto-fill category name & slug if not manually typed or replacing default
    setFormData((prev) => {
      const isBlank = !prev.name.trim();
      return {
        ...prev,
        name: isBlank ? brand.name : prev.name,
        slug: isBlank ? brand.slug : prev.slug || makeSlug(prev.name),
      };
    });

    toast.success(`Selected ${brand.name} logo!`);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image file size should not exceed 5MB");
        return;
      }
      setImageFile(file);
      setSelectedLogoId(null);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const setImageSearchTerm = (val) => {
    setLogoSearchTerm(val);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Please enter brand name");
      return;
    }
    if (!formData.parentId) {
      toast.error("Please select Parent Header Category");
      return;
    }

    setIsSaving(true);
    try {
      const data = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== undefined) {
          data.append(key, formData[key]);
        }
      });
      data.set("catalogType", "refurbished");
      data.set("type", "category");

      if (imageFile) {
        data.append("image", imageFile);
      } else if (previewUrl) {
        data.append("image", previewUrl);
      }

      let res;
      if (editingItem) {
        res = await adminApi.updateCategory(editingItem._id || editingItem.id, data);
      } else {
        res = await adminApi.createCategory(data);
      }

      if (res.data.success) {
        toast.success(
          editingItem
            ? "Refurbished Brand updated successfully"
            : "Refurbished Brand created successfully"
        );
        setIsAddModalOpen(false);
        fetchCategories();
      } else {
        toast.error(res.data.message || "Failed to save");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error saving refurbished brand");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await adminApi.deleteCategory(deleteTarget._id || deleteTarget.id);
      if (res.data.success) {
        toast.success("Refurbished Brand deleted successfully");
        setIsDeleteModalOpen(false);
        setDeleteTarget(null);
        fetchCategories();
      } else {
        toast.error(res.data.message || "Failed to delete");
      }
    } catch (error) {
      toast.error("Error deleting category");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-purple-700/40">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Brands & Main Categories
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Refurbished Brands (Main Categories)
          </h1>
          <p className="text-sm text-purple-200/80 mt-1 max-w-xl">
            Manage electronic mobile brands (Apple, Samsung, Realme, Oppo, Vivo, Xiaomi, OnePlus, Google Pixel, etc.) mapped under each Device Type.
          </p>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-purple-500/20 transition shrink-0"
        >
          <Plus className="w-5 h-5" /> Add Category
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search brands..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterHeader}
              onChange={(e) => setFilterHeader(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Device Types</option>
              {headerCategories.map((h) => (
                <option key={h._id || h.id} value={h._id || h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          Total Brands: <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredCategories.length}</span>
        </div>
      </div>

      {/* Brands Table */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading refurbished brands...</div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            No refurbished brands found. Click "Add Category" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                <tr>
                  <th className="py-3.5 px-4">Brand Logo & Name</th>
                  <th className="py-3.5 px-4">Parent Device Type</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Sort Order</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCategories.map((cat) => {
                  const parentHeader = typeof cat.parentId === "object"
                    ? cat.parentId
                    : headerCategories.find((h) => (h._id || h.id) === cat.parentId);
                  return (
                    <tr
                      key={cat._id || cat.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 p-1.5 shadow-xs">
                            {cat.image ? (
                              <img src={cat.image} alt={cat.name} className="w-full h-full object-contain" />
                            ) : (
                              <span className="font-bold text-purple-600 text-sm">{cat.name?.slice(0, 2).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white block">
                              {cat.name}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              {cat.slug}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                          {parentHeader?.name || "Unassigned"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={cat.status === "active" ? "success" : "secondary"}>
                          {cat.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {cat.sortOrder || 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenAddModal(cat)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget(cat);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Category Modal with Integrated Brand Logo Picker */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden text-gray-800 border border-slate-100"
            >
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-gray-100 flex justify-between items-center shrink-0 bg-slate-50/80">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">
                    {editingItem ? "Edit Refurbished Category / Brand" : "Add Refurbished Category / Brand"}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Select a mobile brand logo or upload a custom image
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200/50 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Scrollable Body */}
              <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
                {/* Mode Selector Tabs: Choose Brand Logo vs Upload Custom File */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                      Brand Logo Option
                    </label>
                    <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setImageSourceMode("logo")}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                          imageSourceMode === "logo"
                            ? "bg-purple-600 text-white shadow-sm font-bold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Grid className="w-3.5 h-3.5" /> Choose Logo
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageSourceMode("upload")}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                          imageSourceMode === "upload"
                            ? "bg-purple-600 text-white shadow-sm font-bold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" /> Upload Image
                      </button>
                    </div>
                  </div>

                  {/* Selected Preview Box */}
                  <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-2 shrink-0 shadow-sm relative">
                      {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-xs text-slate-400 font-semibold text-center">No Logo</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-800 block">
                        {selectedLogoId
                          ? `${MOBILE_BRAND_LOGOS.find((b) => b.id === selectedLogoId)?.name} Logo Selected`
                          : previewUrl
                          ? "Custom Logo Selected"
                          : "Select a brand logo below"}
                      </span>
                      <p className="text-[11.5px] text-slate-500 truncate mt-0.5">
                        {previewUrl ? "Logo will be displayed on brand cards and filters" : "Click any mobile brand below to select"}
                      </p>
                    </div>
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewUrl(null);
                          setImageFile(null);
                          setSelectedLogoId(null);
                        }}
                        className="px-2.5 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg border border-rose-200 hover:bg-rose-100 transition"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Mode 1: Integrated Mobile Brand Logos Grid */}
                  {imageSourceMode === "logo" && (
                    <div className="space-y-2.5 pt-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search mobile brand logo (e.g. Apple, Samsung, Realme, Oppo, Vivo)..."
                          value={logoSearchTerm}
                          onChange={(e) => setLogoSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1.5 bg-slate-50/50 rounded-xl border border-slate-200/60">
                        {filteredBrandLogos.map((brand) => {
                          const isSelected = selectedLogoId === brand.id;
                          return (
                            <div
                              key={brand.id}
                              onClick={() => handleSelectBrandLogo(brand)}
                              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-purple-50 border-purple-500 ring-2 ring-purple-500/30 shadow-md scale-102"
                                  : "bg-white hover:bg-purple-50/40 border-slate-200 text-slate-700 hover:border-purple-300"
                              }`}
                            >
                              <div
                                className="w-12 h-10 flex items-center justify-center p-1"
                                dangerouslySetInnerHTML={{ __html: brand.svg }}
                              />
                              <span className="text-[11.5px] font-bold text-center line-clamp-1">
                                {brand.name}
                              </span>
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-purple-600 absolute top-1.5 right-1.5" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Mode 2: Custom File Upload Box */}
                  {imageSourceMode === "upload" && (
                    <div className="flex flex-col items-center justify-center py-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 hover:border-purple-500 transition cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-8 h-8 text-slate-400 mb-1" />
                      <span className="text-xs font-semibold text-slate-700">
                        Click to select image file from computer
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">
                        PNG, JPG, SVG or WEBP (Max 5MB)
                      </span>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleImageChange}
                        accept="image/*"
                      />
                    </div>
                  )}
                </div>

                {/* Parent Header Category Dropdown */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Parent Header Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 bg-white font-medium"
                  >
                    <option value="">Select Header Category (e.g. Mobile, Laptop)</option>
                    {headerCategories.map((h) => (
                      <option key={h._id || h.id} value={h._id || h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Brand Name Input */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Brand Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                        slug: makeSlug(e.target.value),
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 font-semibold text-gray-900"
                    placeholder="e.g. Apple, Samsung, Realme, Oppo, Vivo, Xiaomi"
                  />
                </div>

                {/* Slug Input */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-mono text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    placeholder="e.g. apple"
                  />
                </div>

                {/* Sort Order & Status Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 bg-white"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50 shadow-md shadow-purple-600/20"
                  >
                    {isSaving ? "Saving..." : editingItem ? "Update Brand" : "Create Brand"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center border border-slate-200"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <Trash className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">
                Delete Refurbished Brand?
              </h3>
              <p className="text-sm text-slate-500 mt-2 mb-6">
                Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>?
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20 transition"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RefurbishedLevel2Categories;
