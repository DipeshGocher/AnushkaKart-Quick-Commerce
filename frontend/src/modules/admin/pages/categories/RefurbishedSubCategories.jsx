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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../../services/adminApi";
import { toast } from "sonner";

const makeSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/-+/g, "-");

const RefurbishedSubCategories = () => {
  const [subCategories, setSubCategories] = useState([]);
  const [level2Categories, setLevel2Categories] = useState([]);
  const [headerCategories, setHeaderCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterHeader, setFilterHeader] = useState("all");
  const [filterLevel2, setFilterLevel2] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    status: "active",
    type: "subcategory",
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
        setSubCategories(refurbishedOnly.filter((c) => c.type === "subcategory"));
        setLevel2Categories(refurbishedOnly.filter((c) => c.type === "category"));
        setHeaderCategories(refurbishedOnly.filter((c) => c.type === "header"));
      }
    } catch (error) {
      toast.error("Failed to fetch refurbished series");
    } finally {
      setIsLoading(false);
    }
  };

  const availableBrandsForHeader = useMemo(() => {
    if (filterHeader === "all") return level2Categories;
    return level2Categories.filter((cat) => {
      const parentIdStr = typeof cat.parentId === "object" ? cat.parentId?._id : cat.parentId;
      return parentIdStr === filterHeader;
    });
  }, [level2Categories, filterHeader]);

  const filteredSubCategories = useMemo(() => {
    return subCategories.filter((sub) => {
      const matchesSearch = sub.name.toLowerCase().includes(searchTerm.toLowerCase());
      const parentBrandId = typeof sub.parentId === "object" ? sub.parentId?._id : sub.parentId;
      const matchesBrand = filterLevel2 === "all" || parentBrandId === filterLevel2;
      
      let matchesHeader = true;
      if (filterHeader !== "all") {
        const brandObj = level2Categories.find((b) => (b._id || b.id) === parentBrandId);
        const headerId = typeof brandObj?.parentId === "object" ? brandObj.parentId?._id : brandObj?.parentId;
        matchesHeader = headerId === filterHeader;
      }

      return matchesSearch && matchesBrand && matchesHeader;
    });
  }, [subCategories, level2Categories, searchTerm, filterHeader, filterLevel2]);

  const handleOpenAddModal = (sub = null) => {
    if (sub) {
      setEditingItem(sub);
      const parentIdStr = typeof sub.parentId === "object" ? sub.parentId?._id : sub.parentId || "";
      setFormData({
        name: sub.name || "",
        slug: sub.slug || "",
        description: sub.description || "",
        status: sub.status || "active",
        type: "subcategory",
        catalogType: "refurbished",
        parentId: parentIdStr,
        sortOrder: sub.sortOrder || 0,
      });
      setPreviewUrl(sub.image || null);
    } else {
      setEditingItem(null);
      setFormData({
        name: "",
        slug: "",
        description: "",
        status: "active",
        type: "subcategory",
        catalogType: "refurbished",
        parentId: level2Categories[0]?._id || "",
        sortOrder: 0,
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
      toast.error("Please enter series/model name");
      return;
    }
    if (!formData.parentId) {
      toast.error("Please select parent brand");
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
      data.set("type", "subcategory");

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
            ? "Refurbished Series updated successfully"
            : "Refurbished Series created successfully"
        );
        setIsAddModalOpen(false);
        fetchCategories();
      } else {
        toast.error(res.data.message || "Failed to save");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error saving refurbished series");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await adminApi.deleteCategory(deleteTarget._id || deleteTarget.id);
      if (res.data.success) {
        toast.success("Refurbished Series deleted successfully");
        setIsDeleteModalOpen(false);
        setDeleteTarget(null);
        fetchCategories();
      } else {
        toast.error(res.data.message || "Failed to delete");
      }
    } catch (error) {
      toast.error("Error deleting series");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-blue-700/40">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Series & Sub-Categories
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Refurbished Series (Level 3)
          </h1>
          <p className="text-sm text-blue-200/80 mt-1 max-w-xl">
            Manage model series like iPhone 15 Series, Galaxy S Series, ThinkPad Series under each Brand.
          </p>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-blue-500/20 transition shrink-0"
        >
          <Plus className="w-5 h-5" /> Add Refurbished Series
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search series..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterHeader}
              onChange={(e) => {
                setFilterHeader(e.target.value);
                setFilterLevel2("all");
              }}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Device Types</option>
              {headerCategories.map((h) => (
                <option key={h._id || h.id} value={h._id || h.id}>
                  {h.name}
                </option>
              ))}
            </select>

            <select
              value={filterLevel2}
              onChange={(e) => setFilterLevel2(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Brands</option>
              {availableBrandsForHeader.map((b) => (
                <option key={b._id || b.id} value={b._id || b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          Total Series: <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredSubCategories.length}</span>
        </div>
      </div>

      {/* Series Table */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading refurbished series...</div>
        ) : filteredSubCategories.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            No refurbished series found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                <tr>
                  <th className="py-3.5 px-4">Series / Sub-Category</th>
                  <th className="py-3.5 px-4">Parent Brand</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Sort Order</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSubCategories.map((sub) => {
                  const parentBrand = typeof sub.parentId === "object"
                    ? sub.parentId
                    : level2Categories.find((b) => (b._id || b.id) === sub.parentId);
                  return (
                    <tr
                      key={sub._id || sub.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                            {sub.image ? (
                              <img src={sub.image} alt={sub.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-bold text-blue-600 text-xs">{sub.name?.slice(0, 3).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white block">
                              {sub.name}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              {sub.slug}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                          {parentBrand?.name || "Unassigned"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={sub.status === "active" ? "success" : "secondary"}>
                          {sub.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {sub.sortOrder || 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenAddModal(sub)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget(sub);
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

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                  {editingItem ? "Edit Refurbished Series" : "Add Refurbished Series"}
                </h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Parent Brand *
                  </label>
                  <select
                    required
                    value={formData.parentId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, parentId: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Parent Brand --</option>
                    {level2Categories.map((b) => (
                      <option key={b._id || b.id} value={b._id || b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Series / Model Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., iPhone 15 Series, ThinkPad T Series"
                    value={formData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        name,
                        slug: editingItem ? prev.slug : makeSlug(name),
                      }));
                    }}
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    placeholder="iphone-15-series"
                    value={formData.slug}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData((prev) => ({ ...prev, sortOrder: Number(e.target.value) }))}
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Series Image
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:border-blue-500 transition"
                    >
                      <Upload className="w-4 h-4" /> Upload Series Image
                    </button>
                    {previewUrl && (
                      <div className="w-12 h-12 rounded-xl border overflow-hidden relative group">
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setPreviewUrl(null);
                          }}
                          className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : editingItem ? "Update" : "Create"}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center border border-slate-200 dark:border-slate-800"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <Trash className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                Delete Refurbished Series?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">
                Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>?
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
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

export default RefurbishedSubCategories;
