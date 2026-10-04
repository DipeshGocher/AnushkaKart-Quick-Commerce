import React, { useState, useEffect, useRef } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Upload,
  Image as ImageIcon,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  CheckSquare,
  ArrowUpAZ,
  ArrowDownAZ,
  Filter,
} from "lucide-react";
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

const isAllCategory = (cat) => {
  if (!cat) return false;
  const slug = String(cat.slug || "").toLowerCase().trim();
  const name = String(cat.name || "").toLowerCase().trim();
  return slug === "all" || name === "all";
};

// Sort indicator component
const SortIndicator = ({ field, sortField, sortDir }) => {
  if (sortField !== field)
    return <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />;
  return sortDir === "asc" ? (
    <ChevronUp className="w-3.5 h-3.5 text-brand-600" />
  ) : (
    <ChevronDown className="w-3.5 h-3.5 text-brand-600" />
  );
};

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
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Sort state
  const [sortField, setSortField] = useState("sortOrder");
  const [sortDir, setSortDir] = useState("asc");

  // Image state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const imageInputRef = useRef(null);

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
    headerFontColor: "#FFFFFF",
    headerIconColor: "#000000",
  });

  useEffect(() => {
    const timer = setTimeout(() => fetchCategories(1), 400);
    return () => clearTimeout(timer);
  }, [searchTerm, pageSize, selectedCatalogType, sortField, sortDir]);

  const fetchCategories = async (requestedPage = 1) => {
    setIsLoading(true);
    try {
      const params = {
        type: "header",
        catalogType: selectedCatalogType,
        page: requestedPage,
        limit: pageSize,
      };
      if (searchTerm) params.search = searchTerm;
      const res = await adminApi.getCategories(params);
      if (res.data.success) {
        const payload = res.data.result || {};
        const list = Array.isArray(payload.items) ? payload.items : [];
        const allCats = res.data.results || [];
        let headers =
          list.length > 0 ? list : allCats.filter((c) => c.type === "header");
        headers =
          selectedCatalogType === "refurbished"
            ? headers.filter((c) => c.catalogType === "refurbished")
            : headers.filter((c) => c.catalogType !== "refurbished");

        // Client-side sort
        headers = applySortLocally(headers);

        setCategories(headers);
        setTotal(
          typeof payload.total === "number" ? payload.total : headers.length
        );
        setPage(
          typeof payload.page === "number" ? payload.page : requestedPage
        );
      }
    } catch (error) {
      toast.error("Failed to fetch header categories");
    } finally {
      setIsLoading(false);
    }
  };

  const applySortLocally = (list) => {
    return [...list].sort((a, b) => {
      let valA, valB;
      if (sortField === "name") {
        valA = (a.name || "").toLowerCase();
        valB = (b.name || "").toLowerCase();
        return sortDir === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      if (sortField === "status") {
        valA = a.status || "";
        valB = b.status || "";
        return sortDir === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      // default: sortOrder
      valA = a.sortOrder || 0;
      valB = b.sortOrder || 0;
      return sortDir === "asc" ? valA - valB : valB - valA;
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const selectable = categories.filter((c) => !isAllCategory(c));
      setSelectedItems(selectable.map((c) => c._id || c.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelect = (id) => {
    const cat = categories.find((c) => (c._id || c.id) === id);
    if (isAllCategory(cat)) return;
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    const safeItems = selectedItems.filter((id) => {
      const cat = categories.find((c) => (c._id || c.id) === id);
      return !isAllCategory(cat);
    });
    if (safeItems.length === 0) return;
    if (
      !window.confirm(
        `Delete ${safeItems.length} selected header categor${safeItems.length === 1 ? "y" : "ies"}? This cannot be undone.`
      )
    )
      return;

    setIsBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;
    for (const id of safeItems) {
      try {
        await adminApi.deleteCategory(id);
        successCount++;
      } catch {
        failCount++;
      }
    }
    setIsBulkDeleting(false);
    setSelectedItems([]);

    if (successCount > 0)
      toast.success(`Deleted ${successCount} categor${successCount === 1 ? "y" : "ies"} successfully`);
    if (failCount > 0) toast.error(`Failed to delete ${failCount} categor${failCount === 1 ? "y" : "ies"}`);
    fetchCategories(1);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
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
      const payload = { ...formData };
      if (isAllCategory(editingItem)) {
        payload.slug = "all";
        payload.status = "active";
        payload.sortOrder = 0;
      }
      Object.keys(payload).forEach((key) => {
        if (payload[key] !== null && payload[key] !== undefined) {
          dataToSend.append(key, payload[key]);
        }
      });
      if (imageFile) {
        dataToSend.append("image", imageFile);
      } else if (!imagePreview && editingItem?.image) {
        dataToSend.append("image", "");
      }

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
    if (isAllCategory(deleteTarget)) {
      toast.error('"All" category cannot be deleted');
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      return;
    }
    try {
      await adminApi.deleteCategory(deleteTarget._id || deleteTarget.id);
      toast.success("Header category deleted");
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchCategories(page);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete category");
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setImageFile(null);
    setImagePreview(null);
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
      headerFontColor: "#FFFFFF",
      headerIconColor: "#000000",
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setImageFile(null);
    // Show existing image as preview
    const existingImg = item.image?.url || item.image || null;
    setImagePreview(existingImg);
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

  const selectableCategories = categories.filter((c) => !isAllCategory(c));
  const allSelected =
    selectableCategories.length > 0 &&
    selectedItems.length === selectableCategories.length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Header Categories</h1>
          <p className="text-gray-500 mt-1">
            Manage top-level categories shown in the site header
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Header Category
        </button>
      </div>

      {/* Catalog Type Toggle */}
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
            className={
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors " +
              (selectedCatalogType === catalogType
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="border-none shadow-sm">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          {/* Bulk delete */}
          {selectedItems.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {isBulkDeleting
                ? "Deleting..."
                : `Delete Selected (${selectedItems.length})`}
            </button>
          )}

          {/* Search */}
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

          {/* Quick Sort Shortcuts */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
              <Filter className="w-3 h-3" /> Sort:
            </span>
            <button
              onClick={() => handleSort("name")}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${sortField === "name" ? "border-brand-500 bg-brand-50 text-brand-600" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
            >
              {sortField === "name" && sortDir === "asc" ? (
                <ArrowUpAZ className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownAZ className="w-3.5 h-3.5" />
              )}
              A–Z
            </button>
            <button
              onClick={() => handleSort("status")}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${sortField === "status" ? "border-brand-500 bg-brand-50 text-brand-600" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
            >
              Active/Inactive
            </button>
            <button
              onClick={() => handleSort("sortOrder")}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${sortField === "sortOrder" ? "border-brand-500 bg-brand-50 text-brand-600" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
            >
              Sort Order
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="w-12 py-3 px-4 text-left">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    checked={allSelected}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                  Icon
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">
                  Image
                </th>
                <th
                  className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    Name
                    <SortIndicator field="name" sortField={sortField} sortDir={sortDir} />
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th
                  className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                  onClick={() => handleSort("sortOrder")}
                >
                  <div className="flex items-center gap-1">
                    Order
                    <SortIndicator field="sortOrder" sortField={sortField} sortDir={sortDir} />
                  </div>
                </th>
                <th
                  className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-1">
                    Status
                    <SortIndicator field="status" sortField={sortField} sortDir={sortDir} />
                  </div>
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-4">
                      <div className="w-4 h-4 rounded bg-gray-200" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-10 h-10 rounded-lg bg-gray-200" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-12 h-12 rounded-lg bg-gray-200" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-32" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-8" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-5 bg-gray-200 rounded-full w-16" />
                    </td>
                    <td className="py-3 px-4" />
                  </tr>
                ))
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <CheckSquare className="w-10 h-10 opacity-20" />
                      <p>No header categories found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                categories.map((cat) => {
                  const catId = cat._id || cat.id;
                  const isSelected = selectedItems.includes(catId);
                  const imgUrl = cat.image?.url || cat.image || null;

                  return (
                    <tr
                      key={catId}
                      className={`transition-colors ${isSelected ? "bg-brand-50/50" : "hover:bg-gray-50/50"}`}
                    >
                      <td className="py-3 px-4">
                        {!isAllCategory(cat) ? (
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                            checked={isSelected}
                            onChange={() => handleSelect(catId)}
                          />
                        ) : null}
                      </td>
                      {/* Icon */}
                      <td className="py-3 px-4">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200">
                          <CategoryIcon
                            iconId={cat.iconId}
                            imageUrl={null}
                            alt={cat.name}
                            className="h-full w-full text-black"
                            fallbackClassName="w-5 h-5"
                          />
                        </div>
                      </td>
                      {/* Image */}
                      <td className="py-3 px-4">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={cat.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div
                            className={`items-center justify-center w-full h-full ${imgUrl ? "hidden" : "flex"}`}
                          >
                            <ImageIcon className="w-5 h-5 text-gray-300" />
                          </div>
                        </div>
                      </td>
                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {!isAllCategory(cat) && (
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ background: cat.headerColor || "#FF1E1E" }}
                            />
                          )}
                          <span className="font-semibold text-gray-900">{cat.name}</span>
                          {isAllCategory(cat) && (
                            <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full border border-slate-200">
                              System
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-sm">{cat.slug}</td>
                      <td className="py-3 px-4 text-gray-600 font-mono text-sm">
                        {cat.sortOrder || 0}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={cat.status === "active" ? "success" : "warning"}>
                          {cat.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(cat)}
                            className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {!isAllCategory(cat) && (
                            <button
                              onClick={() => {
                                setDeleteTarget(cat);
                                setIsDeleteModalOpen(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      {/* ── Add/Edit Modal ── */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden my-auto"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingItem
                    ? isAllCategory(editingItem)
                      ? 'Edit "All" Category'
                      : "Edit Header Category"
                    : "Add Header Category"}
                </h2>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div
                className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0 overscroll-contain touch-pan-y"
                tabIndex={0}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {/* Icon selector */}
                <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 py-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                    <CategoryIcon
                      iconId={formData.iconId}
                      alt={formData.name}
                      className="h-8 w-8 text-black"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsIconSelectorOpen(true)}
                    className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    {formData.iconId ? "Change Icon" : "Select Header Icon"} *
                  </button>
                  <p className="text-xs text-slate-400">
                    Font Awesome icon (shown in header nav bar)
                  </p>
                </div>

                {/* Image Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Category Image
                    <span className="text-gray-400 font-normal ml-1">
                      {isAllCategory(editingItem)
                        ? '(used for customer "For You" on /categories page)'
                        : "(for categories page & sidebar)"}
                    </span>
                  </label>
                  <div className="flex items-start gap-3">
                    {/* Preview */}
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-7 h-7 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="flex items-center gap-2 w-full justify-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                      >
                        <Upload className="w-4 h-4" />
                        {imagePreview ? "Change Image" : "Upload Image"}
                      </button>
                      {imagePreview && (
                        <button
                          type="button"
                          onClick={clearImage}
                          className="flex items-center gap-2 w-full justify-center px-4 py-2 text-sm text-red-500 hover:text-red-700 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" /> Remove image
                        </button>
                      )}
                      <p className="text-xs text-gray-400">
                        PNG, JPG or WebP · max 5 MB
                      </p>
                    </div>
                  </div>
                </div>

                {/* Header Colors */}
                {!isAllCategory(editingItem) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Header Background Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.headerColor || "#FF1E1E"}
                          onChange={(e) =>
                            setFormData({ ...formData, headerColor: e.target.value })
                          }
                          className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer bg-transparent p-0 overflow-hidden shrink-0"
                        />
                        <input
                          type="text"
                          value={formData.headerColor || "#FF1E1E"}
                          onChange={(e) =>
                            setFormData({ ...formData, headerColor: e.target.value })
                          }
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          placeholder="#FF1E1E"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Title/Text Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.headerFontColor || "#FFFFFF"}
                          onChange={(e) =>
                            setFormData({ ...formData, headerFontColor: e.target.value })
                          }
                          className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer bg-transparent p-0 overflow-hidden shrink-0"
                        />
                        <input
                          type="text"
                          value={formData.headerFontColor || "#FFFFFF"}
                          onChange={(e) =>
                            setFormData({ ...formData, headerFontColor: e.target.value })
                          }
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          placeholder="#FFFFFF"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setFormData({
                        ...formData,
                        name: newName,
                        slug: isAllCategory(editingItem) ? "all" : makeSlug(newName),
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    placeholder="e.g., Electronics"
                  />
                </div>

                {/* Slug (readonly) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Slug</label>
                    {isAllCategory(editingItem) && (
                      <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium border border-amber-200">
                        System Protected Slug
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formData.slug}
                    readOnly
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 text-sm focus:outline-none"
                    placeholder="auto-generated"
                  />
                </div>

                {/* Status & Sort Order */}
                {!isAllCategory(editingItem) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      >
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
                          setFormData({
                            ...formData,
                            sortOrder: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                        min="0"
                      />
                      <p className="text-xs text-gray-400">Lower = appears first</p>
                    </div>
                  </div>
                )}

                {/* Commission & Fees */}
                {!isAllCategory(editingItem) && (
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
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 shrink-0">
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-5 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {isSaving && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {editingItem ? "Update Category" : "Create Category"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Icon Selector Modal ── */}
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

      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
            >
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
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                  >
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
