import React, { useState, useEffect } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  Plus,
  Search,
  Edit,
  Trash,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../../services/adminApi";
import { toast } from "sonner";
import IconSelector from "@shared/components/IconSelector";
import CategoryIcon from "@shared/components/CategoryIcon";
import Pagination from "@shared/components/ui/Pagination";
import { getFontAwesomeIconId } from "@shared/constants/fontAwesomeCategoryIcons";

const makeSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/-+/g, "-");

const HeaderCategories = () => {
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCatalogType, setSelectedCatalogType] = useState("grocery");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    status: "active",
    type: "header",
    parentId: null,
    iconId: "",
    adminCommission: "",
    handlingFees: "",
    sortOrder: 0,
    headerColor: "#FF1E1E",
    headerFontColor: "#111111",
    headerIconColor: "#000000",
  });

  useEffect(() => {
    const timer = setTimeout(() => fetchCategories(1), 400);
    return () => clearTimeout(timer);
  }, [searchTerm, pageSize, selectedCatalogType]);

  const fetchCategories = async (requestedPage = 1) => {
    setIsLoading(true);
    try {
      const params = { type: "header", catalogType: selectedCatalogType, page: requestedPage, limit: pageSize };
      if (searchTerm) params.search = searchTerm;
      const res = await adminApi.getCategories(params);
      if (res.data.success) {
        const payload = res.data.result || {};
        const list = Array.isArray(payload.items) ? payload.items : [];
        const allCats = res.data.results || [];
        const headers = list.length > 0 ? list : allCats.filter((c) => c.type === "header");
        const catalogHeaders = selectedCatalogType === "refurbished"
          ? headers.filter((c) => c.catalogType === "refurbished")
          : headers.filter((c) => c.catalogType !== "refurbished");
        setCategories(catalogHeaders);
        setTotal(typeof payload.total === "number" ? payload.total : catalogHeaders.length);
        setPage(typeof payload.page === "number" ? payload.page : requestedPage);
      }
    } catch (error) {
      toast.error("Failed to fetch header categories");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItems(categories.map((c) => c._id || c.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelect = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter((item) => item !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedItems.length === 0) return;
    toast.info(
      `Bulk delete functionality for ${selectedItems.length} items would be triggered here.`,
    );
    setSelectedItems([]);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }
    if (!formData.iconId) {
      toast.error("Select a Font Awesome category icon");
      return;
    }

    setIsSaving(true);
    try {
      const dataToSend = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== undefined) {
          dataToSend.append(key, formData[key]);
        }
      });

      if (editingItem) {
        await adminApi.updateCategory(editingItem._id || editingItem.id, dataToSend);
        toast.success("Header category updated successfully");
      } else {
        await adminApi.createCategory(dataToSend);
        toast.success("Header category created successfully");
      }

      setIsAddModalOpen(false);
      fetchCategories(page);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save category");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await adminApi.deleteCategory(deleteTarget._id || deleteTarget.id);
      toast.success("Header category deleted");
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchCategories(page);
    } catch (error) {
      toast.error("Failed to delete category");
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      status: "active",
      type: "header",
      catalogType: selectedCatalogType,
      parentId: null,
      iconId: "",
      adminCommission: "",
      handlingFees: "",
      sortOrder: 0,
      headerColor: "#FF1E1E",
      headerFontColor: "#111111",
      headerIconColor: "#000000",
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || "",
      slug: item.slug || "",
      description: item.description || "",
      status: item.status || "active",
      type: "header",
      catalogType: item.catalogType || "grocery",
      parentId: item.parentId || null,
      iconId: String(item.iconId || "").startsWith("fa6svg:")
        ? item.iconId
        : getFontAwesomeIconId(item.iconId, item.name),
      adminCommission: item.adminCommission ?? "",
      handlingFees: item.handlingFees ?? "",
      sortOrder: item.sortOrder || 0,
      headerColor: item.headerColor || "#FF1E1E",
      headerFontColor: item.headerFontColor || "#FFFFFF",
      headerIconColor: "#000000",
    });
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Header Categories
          </h1>
          <p className="text-gray-500 mt-1">Manage top-level categories</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-black text-primary-foreground px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
          <Plus className="w-5 h-5" />
          Add New Header
        </button>
      </div>

      <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        {[
          ["grocery", "Quick Commerce"],
          ["refurbished", "E-commerce"],
        ].map(([catalogType, label]) => (
          <button
            key={catalogType}
            type="button"
            onClick={() => {
              setSelectedCatalogType(catalogType);
              setPage(1);
              setSelectedItems([]);
            }}
            className={"rounded-lg px-4 py-2 text-sm font-semibold transition-colors " + (selectedCatalogType === catalogType ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900")}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="border-none shadow-sm">
        <div className="p-4 border-b border-gray-100 flex gap-4 items-center">
          {selectedItems.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors text-sm font-medium">
              <Trash2 className="w-4 h-4" />
              Delete ({selectedItems.length})
            </button>
          )}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search header categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="w-12 py-3 px-4 text-left">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    checked={
                      selectedItems.length > 0 &&
                      categories.length > 0 &&
                      selectedItems.length === categories.length
                    }
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Icon
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Comm (%)
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Fees (₹)
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Sort Order
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-500">
                    No header categories found
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr
                    key={cat._id || cat.id}
                    className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        checked={selectedItems.includes(cat._id || cat.id)}
                        onChange={() => handleSelect(cat._id || cat.id)}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200">
                        <CategoryIcon
                          iconId={cat.iconId}
                          imageUrl={cat.image}
                          alt={cat.name}
                          className="h-full w-full text-black"
                          fallbackClassName="w-5 h-5"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {cat.name}
                    </td>
                    <td className="py-3 px-4 text-gray-500">{cat.slug}</td>
                    <td className="py-3 px-4 text-gray-500 font-medium">
                      {cat.adminCommission ?? 0}%
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-medium">
                      ₹{cat.handlingFees ?? 0}
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-medium">
                      {cat.sortOrder || 0}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          cat.status === "active" ? "success" : "warning"
                        }>
                        {cat.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(cat)}
                        className="p-1 text-gray-500 hover:text-brand-600 transition-colors">
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteTarget(cat);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-1 text-gray-500 hover:text-red-600 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100">
          <Pagination
            page={page}
            totalPages={Math.ceil(total / pageSize) || 1}
            total={total}
            pageSize={pageSize}
            onPageChange={(p) => fetchCategories(p)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            loading={isLoading}
          />
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingItem ? "Edit Header Category" : "Add Header Category"}
                </h2>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div
                className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain touch-pan-y"
                tabIndex={0}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 py-5">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-200 bg-white">
                    <CategoryIcon
                      iconId={formData.iconId}
                      alt={formData.name}
                      className="h-9 w-9 text-black"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsIconSelectorOpen(true)}
                    className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    {formData.iconId ? "Change Font Awesome Icon" : "Select Font Awesome Icon"}
                  </button>
                  <p className="text-xs text-slate-500">Font Awesome Free Classic · black</p>
                </div>

                {/* Header Color Picker */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">
                        Header Background
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.headerColor || "#FF1E1E"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            headerColor: e.target.value,
                          })
                        }
                        className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer bg-transparent p-0 overflow-hidden shrink-0"
                      />
                      <input
                        type="text"
                        value={formData.headerColor || "#FF1E1E"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            headerColor: e.target.value,
                          })
                        }
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        placeholder="#FF1E1E"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">
                        Title/Text Color
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.headerFontColor || "#FFFFFF"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            headerFontColor: e.target.value,
                          })
                        }
                        className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer bg-transparent p-0 overflow-hidden shrink-0"
                      />
                      <input
                        type="text"
                        value={formData.headerFontColor || "#FFFFFF"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            headerFontColor: e.target.value,
                          })
                        }
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        placeholder="#FFFFFF"
                      />
                    </div>
                  </div>

                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                        slug: makeSlug(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    placeholder="e.g., Electronics"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Slug
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    readOnly
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    placeholder="e.g., electronics"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Admin Commission (%)
                    </label>
                    <input
                      type="number"
                      value={formData.adminCommission}
                      onChange={(e) =>
                        setFormData({ ...formData, adminCommission: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      placeholder="0"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Handling Fees (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.handlingFees}
                      onChange={(e) =>
                        setFormData({ ...formData, handlingFees: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 shrink-0">
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-black text-primary-foreground rounded-lg hover:bg-brand-700 font-medium disabled:opacity-50 flex items-center gap-2">
                  {isSaving && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {editingItem ? "Update Header" : "Create Header"}
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
            selectedIcon={formData.iconId}
            catalogType={formData.catalogType}
            onSelect={(iconId) => {
              setFormData({ ...formData, iconId });
              setIsIconSelectorOpen(false);
            }}
            onClose={() => setIsIconSelectorOpen(false)}
          />
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
              className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Delete Category?
                </h3>
                <p className="text-gray-500 text-sm mb-6">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-gray-900">
                    {deleteTarget?.name}
                  </span>
                  ? This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HeaderCategories;
