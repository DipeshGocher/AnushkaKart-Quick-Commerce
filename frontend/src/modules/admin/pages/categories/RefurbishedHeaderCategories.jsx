import React, { useState, useEffect, useRef } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  Plus,
  Search,
  Edit,
  Trash,
  X,
  Upload,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../../services/adminApi";
import { toast } from "sonner";
import IconSelector from "@shared/components/IconSelector";
import Pagination from "@shared/components/ui/Pagination";
import { getIconSvg } from "@shared/constants/categoryIcons";

const makeSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/-+/g, "-");

const iconComponents = {
  electronics: "📱",
  fashion: "👕",
  home: "🏠",
  food: "🍔",
  sports: "⚽",
  books: "📚",
  beauty: "💄",
  toys: "🧸",
  automotive: "🚗",
  pets: "🐾",
  health: "💊",
  garden: "🌱",
  office: "💼",
  music: "🎵",
  jewelry: "💎",
  baby: "🍼",
  tools: "🔧",
  luggage: "🧳",
  art: "🎨",
  grocery: "🛒",
  beverages: "🥤",
  dairy: "🥛",
  bakery: "🥐",
  snacks: "🍿",
  meat: "🥩",
  cleaning: "🧹",
  stationery: "✏️",
  festival: "🎉",
};

const RefurbishedHeaderCategories = () => {
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    status: "active",
    type: "header",
    catalogType: "refurbished",
    parentId: null,
    iconId: "smartphone",
    adminCommission: "",
    handlingFees: "",
    sortOrder: 0,
    headerColor: "#4F46E5",
    headerFontColor: "#FFFFFF",
    headerIconColor: "#111111",
  });

  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => fetchCategories(1), 400);
    return () => clearTimeout(timer);
  }, [searchTerm, pageSize]);

  const fetchCategories = async (requestedPage = 1) => {
    setIsLoading(true);
    try {
      const params = {
        type: "header",
        catalogType: "refurbished",
        page: requestedPage,
        limit: pageSize,
      };
      if (searchTerm) params.search = searchTerm;
      const res = await adminApi.getCategories(params);
      if (res.data.success) {
        const payload = res.data.result || {};
        const items = Array.isArray(payload.items)
          ? payload.items
          : Array.isArray(payload)
            ? payload
            : Array.isArray(res.data.results)
              ? res.data.results
              : [];
        const refurbishedHeaders = items.filter(
          (c) => c.type === "header" && c.catalogType === "refurbished"
        );
        setCategories(refurbishedHeaders);
        setTotal(typeof payload.total === "number" ? payload.total : refurbishedHeaders.length);
        setPage(typeof payload.page === "number" ? payload.page : requestedPage);
      }
    } catch (error) {
      toast.error("Failed to fetch refurbished device types");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = (cat = null) => {
    if (cat) {
      setEditingItem(cat);
      setFormData({
        name: cat.name || "",
        slug: cat.slug || "",
        description: cat.description || "",
        status: cat.status || "active",
        type: "header",
        catalogType: "refurbished",
        parentId: null,
        iconId: cat.iconId || "smartphone",
        adminCommission: cat.adminCommission !== undefined ? cat.adminCommission : "",
        handlingFees: cat.handlingFees !== undefined ? cat.handlingFees : "",
        sortOrder: cat.sortOrder || 0,
        headerColor: cat.headerColor || "#4F46E5",
        headerFontColor: cat.headerFontColor || "#FFFFFF",
        headerIconColor: cat.headerIconColor || "#111111",
      });
      setPreviewUrl(cat.image || null);
    } else {
      setEditingItem(null);
      setFormData({
        name: "",
        slug: "",
        description: "",
        status: "active",
        type: "header",
        catalogType: "refurbished",
        parentId: null,
        iconId: "smartphone",
        adminCommission: "",
        handlingFees: "",
        sortOrder: 0,
        headerColor: "#4F46E5",
        headerFontColor: "#FFFFFF",
        headerIconColor: "#111111",
      });
      setPreviewUrl(null);
    }
    setImageFile(null);
    setIsAddModalOpen(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image file size should not exceed 5MB");
        return;
      }
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Please enter a device name");
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
      data.set("type", "header");

      if (imageFile) {
        data.append("image", imageFile);
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
            ? "Refurbished Device Type updated successfully"
            : "Refurbished Device Type created successfully"
        );
        setIsAddModalOpen(false);
        fetchCategories(page);
      } else {
        toast.error(res.data.message || "Failed to save");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error saving refurbished device type");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await adminApi.deleteCategory(deleteTarget._id || deleteTarget.id);
      if (res.data.success) {
        toast.success("Refurbished Device Type deleted successfully");
        setIsDeleteModalOpen(false);
        setDeleteTarget(null);
        fetchCategories(page);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-indigo-700/40">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Refurbished Catalog
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Refurbished Device Types (Headers)
          </h1>
          <p className="text-sm text-indigo-200/80 mt-1 max-w-xl">
            Manage electronic device categories like Mobile, Laptop, Tablet, Smartwatch, Audio & Gadgets.
          </p>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition duration-200 shrink-0"
        >
          <Plus className="w-5 h-5" /> Add Header Category
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search device types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          Total Device Types: <span className="font-semibold text-slate-800 dark:text-slate-200">{total}</span>
        </div>
      </div>

      {/* Categories Table */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading refurbished device types...</div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            No refurbished device types found. Click "Add Header Category" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                <tr>
                  <th className="py-3.5 px-4">Device Type</th>
                  <th className="py-3.5 px-4">Slug</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Sort Order</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {categories.map((cat) => (
                  <tr
                    key={cat._id || cat.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                          {cat.image ? (
                            <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                          ) : cat.iconId && getIconSvg(cat.iconId) ? (
                            <div
                              className="w-6 h-6 text-indigo-500 flex items-center justify-center fill-indigo-500"
                              dangerouslySetInnerHTML={{ __html: getIconSvg(cat.iconId) }}
                            />
                          ) : (
                            <Smartphone className="w-5 h-5 text-indigo-500" />
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {cat.name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {cat.description || "Refurbished Device Type"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {cat.slug}
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
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteTarget(cat);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Delete"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > pageSize && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / pageSize)}
              onPageChange={(p) => fetchCategories(p)}
            />
          </div>
        )}
      </Card>

      {/* Add Header Category Modal - Matches Screenshot 2 Exactly */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden text-gray-800"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingItem ? "Edit Header Category" : "Add Header Category"}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Form Scrollable Body */}
              <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                {/* Top Icon / Image Selection */}
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-6">
                    {/* SVG Icon Circle */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-200 flex items-center justify-center relative shadow-sm">
                        {formData.iconId && iconComponents[formData.iconId] ? (
                          <div className="text-4xl flex items-center justify-center">
                            {iconComponents[formData.iconId]}
                          </div>
                        ) : formData.iconId && getIconSvg(formData.iconId) ? (
                          <div
                            className="w-12 h-12 text-rose-500"
                            dangerouslySetInnerHTML={{
                              __html: getIconSvg(formData.iconId),
                            }}
                          />
                        ) : (
                          <Sparkles className="w-10 h-10 text-rose-400" />
                        )}
                        {formData.iconId && (
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, iconId: "" }))}
                            className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow-md"
                            title="Remove Icon"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsIconSelectorOpen(true)}
                        className="px-4 py-1.5 text-xs font-bold bg-black text-white rounded-lg hover:bg-gray-800 transition"
                      >
                        {formData.iconId ? "Change Icon" : "Select Icon"}
                      </button>
                    </div>

                    {/* OR Divider */}
                    <span className="text-xs font-bold text-gray-400">OR</span>

                    {/* Custom Image Upload Circle */}
                    <div className="flex flex-col items-center gap-2">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-24 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-indigo-500 overflow-hidden transition relative"
                      >
                        {previewUrl ? (
                          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center">
                            <Upload className="w-7 h-7 text-gray-400 mx-auto" />
                            <span className="text-[11px] text-gray-500 mt-1 block">Upload</span>
                          </div>
                        )}
                        {previewUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImageFile(null);
                              setPreviewUrl(null);
                            }}
                            className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow-md"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleImageChange}
                        accept="image/*"
                      />
                      <span className="text-xs font-semibold text-gray-600">Custom Image</span>
                    </div>
                  </div>

                  <p className="text-[11.5px] text-gray-500 text-center">
                    Choose an SVG icon or upload a custom image
                    <br />
                    <span className="font-semibold text-gray-500">
                      Recommended Size: 400 × 400 px (Ratio 1:1)
                    </span>
                  </p>
                </div>

                {/* Header Colors */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Header Background
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.headerColor || "#FF1E1E"}
                        onChange={(e) => setFormData({ ...formData, headerColor: e.target.value })}
                        className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer p-0 bg-transparent shrink-0"
                      />
                      <input
                        type="text"
                        value={formData.headerColor || "#FF1E1E"}
                        onChange={(e) => setFormData({ ...formData, headerColor: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Title/Text Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.headerFontColor || "#111111"}
                        onChange={(e) => setFormData({ ...formData, headerFontColor: e.target.value })}
                        className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer p-0 bg-transparent shrink-0"
                      />
                      <input
                        type="text"
                        value={formData.headerFontColor || "#111111"}
                        onChange={(e) => setFormData({ ...formData, headerFontColor: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Active Tab / Icon Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.headerIconColor || "#111111"}
                      onChange={(e) => setFormData({ ...formData, headerIconColor: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer p-0 bg-transparent shrink-0"
                    />
                    <input
                      type="text"
                      value={formData.headerIconColor || "#111111"}
                      onChange={(e) => setFormData({ ...formData, headerIconColor: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Device Name (Header) *
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
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    placeholder="e.g., Mobiles, Laptops, Tablets, Smartwatches"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Slug
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs font-mono text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    placeholder="e.g., mobiles"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Lower numbers appear first</p>
                </div>

                {/* Finance Commission */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Admin Commission (%)
                    </label>
                    <input
                      type="number"
                      value={formData.adminCommission}
                      onChange={(e) => setFormData({ ...formData, adminCommission: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Handling Fees (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.handlingFees}
                      onChange={(e) => setFormData({ ...formData, handlingFees: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Footer buttons */}
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
                    className="px-5 py-2.5 bg-black text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 shadow-md"
                  >
                    {isSaving ? "Saving..." : editingItem ? "Update Header" : "Create Header"}
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
                Delete Refurbished Device Type?
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

      {/* Icon Selector Modal */}
      <AnimatePresence>
        {isIconSelectorOpen && (
          <IconSelector
            electronicsOnly={true}
            selectedIcon={formData.iconId}
            onSelect={(iconId) => {
              setFormData((prev) => ({ ...prev, iconId }));
              setIsIconSelectorOpen(false);
            }}
            onClose={() => setIsIconSelectorOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RefurbishedHeaderCategories;
