import React, { useState, useEffect, useMemo, useRef } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Pagination from "@shared/components/ui/Pagination";
import {
  Plus,
  Search,
  Edit,
  Trash,
  Trash2,
  X,
  Upload,
  Image,
  Filter,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../../services/adminApi";
import { toast } from "sonner";
import TrustBadgesManager from "../../components/categories/TrustBadgesManager";
import { invalidateCache } from "@core/api/dedupe";

const makeSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/-+/g, "-");

const SubCategories = () => {
  const [categories, setCategories] = useState([]);
  const [level2Categories, setLevel2Categories] = useState([]);
  const [headerCategories, setHeaderCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel2, setFilterLevel2] = useState("all");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    status: "active",
    type: "subcategory",
    parentId: "",
    isFeatured: false,
    trustBadges: [],
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
      const res = await adminApi.getCategories({ catalogType: "grocery" });
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
        const groceryCats = allCats.filter((c) => c.catalogType !== "refurbished");
        setCategories(groceryCats.filter((c) => c.type === "subcategory"));
        setLevel2Categories(
          groceryCats.filter(
            (c) =>
              c.type === "category" &&
              c.slug !== "all" &&
              String(c.name || "").trim().toLowerCase() !== "all"
          )
        );
        setHeaderCategories(
          groceryCats.filter(
            (c) =>
              c.type === "header" &&
              c.slug !== "all" &&
              String(c.name || "").trim().toLowerCase() !== "all"
          )
        );
      }
    } catch (error) {
      toast.error("Failed to fetch categories");
    } finally {
      setIsLoading(false);
    }
  };

  const getParentInfo = (parentId) => {
    const id = parentId?._id || parentId;
    const parent = level2Categories.find((c) => (c._id || c.id) === id);
    if (!parent) return { name: "Unknown", headerName: "Unknown" };

    const headerId = parent.parentId?._id || parent.parentId;
    const header = headerCategories.find((h) => (h._id || h.id) === headerId);

    return {
      name: parent.name,
      headerName: header ? header.name : "Unknown",
    };
  };

  const filteredCategories = useMemo(() => {
    const filtered = categories.filter((cat) => {
      const matchesSearch = cat.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesParent =
        filterLevel2 === "all" ||
        (cat.parentId && cat.parentId._id === filterLevel2) ||
        cat.parentId === filterLevel2;
      const matchesStatus = !filterStatus || cat.status === filterStatus;
      return matchesSearch && matchesParent && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      const aName = String(a.name || "").toLowerCase();
      const bName = String(b.name || "").toLowerCase();
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();

      switch (sortBy) {
        case "oldest":
          return aTime - bTime;
        case "name-asc":
          return aName.localeCompare(bName);
        case "name-desc":
          return bName.localeCompare(aName);
        case "newest":
        default:
          return bTime - aTime;
      }
    });
  }, [categories, searchTerm, filterLevel2, filterStatus, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / pageSize));

  const paginatedCategories = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredCategories.slice(startIndex, startIndex + pageSize);
  }, [filteredCategories, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterLevel2, sortBy, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const sortedParentCategoryOptions = useMemo(() => {
    return [...level2Categories]
      .map((c) => {
        const headerId = c.parentId?._id || c.parentId;
        const header = headerCategories.find(
          (h) => (h._id || h.id) === headerId,
        );
        const headerName = header ? header.name : "Unknown";

        return {
          id: c._id || c.id,
          label: `${headerName} > ${c.name}`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [level2Categories, headerCategories]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug || !formData.parentId) {
      toast.error("Name, slug and parent category are required");
      return;
    }

    setIsSaving(true);
    try {
      const data = new FormData();
      data.append("type", "subcategory");
      Object.keys(formData).forEach((key) => {
        if (key === "trustBadges") {
          data.append("trustBadges", JSON.stringify(formData.trustBadges || []));
        } else if (key !== "type") {
          data.append(key, formData[key]);
        }
      });

      if (imageFile) {
        data.append("image", imageFile);
      } else if (previewUrl && !previewUrl.startsWith("blob:")) {
        // If no new file is chosen, but we have a preview URL that isn't a local blob,
        // it means we have an existing image URL or a string.
        data.append("image", previewUrl);
      } else {
        data.append("image", "");
      }

      if (editingItem) {
        await adminApi.updateCategory(editingItem._id || editingItem.id, data);
        toast.success("Subcategory updated");
      } else {
        await adminApi.createCategory(data);
        toast.success("Subcategory created");
      }
      invalidateCache("/categories");
      setIsAddModalOpen(false);
      setEditingItem(null);
      fetchCategories();
    } catch (error) {
      console.error(error);
      toast.error(editingItem ? "Failed to update" : "Failed to create");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await adminApi.deleteCategory(deleteTarget._id || deleteTarget.id);
      invalidateCache("/categories");
      toast.success("Subcategory deleted");
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchCategories();
    } catch (error) {
      toast.error("Failed to delete subcategory");
    }
  };

  const handleToggleFeatured = async (cat) => {
    try {
      const nextFeatured = !cat.isFeatured;
      const id = cat._id || cat.id;
      setCategories((prev) =>
        prev.map((c) =>
          (c._id || c.id) === id ? { ...c, isFeatured: nextFeatured } : c
        )
      );
      await adminApi.updateCategory(id, { isFeatured: nextFeatured });
      invalidateCache("/categories");
      toast.success(nextFeatured ? "Marked as Featured in Best Selling Categories" : "Removed from Featured");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update featured status");
      fetchCategories();
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      status: "active",
      type: "subcategory",
      parentId: "",
      isFeatured: false,
      trustBadges: [],
    });
    setImageFile(null);
    setPreviewUrl(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      slug: item.slug,
      description: item.description || "",
      status: item.status,
      type: "subcategory",
      parentId: item.parentId?._id || item.parentId || "",
      isFeatured: Boolean(item.isFeatured),
    });
    const currentImage = item.image && typeof item.image === 'object' ? item.image.url : (item.image || null);
    setPreviewUrl(currentImage);
    setIsAddModalOpen(true);
  };

  const handleSelect = (id) => {
    setSelectedItems((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItems(paginatedCategories.map((c) => c._id || c.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;

    if (
      window.confirm(
        `Are you sure you want to delete ${selectedItems.length} items?`,
      )
    ) {
      try {
        await Promise.all(
          selectedItems.map((id) => adminApi.deleteCategory(id)),
        );
        toast.success("Subcategories deleted");
        setSelectedItems([]);
        fetchCategories();
      } catch (error) {
        console.error("Bulk delete error:", error);
        toast.error("Failed to delete some subcategories");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Subcategories</h1>
          <p className="text-gray-500 mt-1">
            Manage level 3 categories linked to secondary categories
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-black  text-primary-foreground px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
          <Plus className="w-5 h-5" />
          Add New Subcategory
        </button>
      </div>

      <Card className="border-none shadow-sm">
        <div className="p-4 border-b border-gray-100 flex gap-4 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search subcategories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
          <div className="flex items-center gap-2 min-w-[200px]">
            <Filter className="text-gray-400 w-5 h-5" />
            <select
              value={filterLevel2}
              onChange={(e) => setFilterLevel2(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500">
              <option value="all">All Level 2 Categories</option>
              {level2Categories.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 min-w-[140px]">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer">
              <option value="">Select Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-center gap-2 min-w-[180px]">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4 text-left">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    checked={
                      selectedItems.length > 0 &&
                      paginatedCategories.length > 0 &&
                      paginatedCategories.every((cat) =>
                        selectedItems.includes(cat._id || cat.id),
                      )
                    }
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Image
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Parent Chain
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Featured
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
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-500">
                    No subcategories found
                  </td>
                </tr>
              ) : (
                paginatedCategories.map((cat) => {
                  const parentInfo = getParentInfo(cat.parentId);
                  return (
                    <tr
                      key={cat._id || cat.id}
                      className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          checked={selectedItems.includes(cat._id || cat.id)}
                          onChange={() => handleSelect(cat._id || cat.id)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200">
                          {cat.image ? (
                            <img
                              src={typeof cat.image === 'string' ? cat.image : (cat.image.url || cat.image.secure_url || cat.image)}
                              alt={cat.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Image className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {cat.name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                            {parentInfo.headerName}
                          </span>
                          <span className="text-sm text-gray-700 font-medium pl-2.5 border-l-2 border-gray-200">
                            {parentInfo.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500">{cat.slug}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            cat.status === "active" ? "success" : "warning"
                          }>
                          {cat.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(cat)}
                          title={cat.isFeatured ? "Featured in Best Selling Categories (Click to unfeature)" : "Not featured (Click to feature)"}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                            cat.isFeatured
                              ? "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 shadow-xs"
                              : "bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200 hover:text-gray-600"
                          }`}>
                          <Star className={`w-3.5 h-3.5 ${cat.isFeatured ? "fill-amber-500 text-amber-500" : ""}`} />
                          {cat.isFeatured ? "Featured" : "No"}
                        </button>
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
                          <Trash className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filteredCategories.length}
            pageSize={pageSize}
            onPageChange={setPage}
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden my-auto">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
                <h2 className="text-base font-bold text-gray-900">
                  {editingItem ? "Edit Subcategory" : "Add Subcategory"}
                </h2>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div
                className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0"
                tabIndex={0}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {/* Image Upload */}
                <div className="flex flex-col items-center justify-center gap-1">
                  <div className="relative">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-brand-500 overflow-hidden transition-colors">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center">
                          <Image className="w-6 h-6 text-gray-400 mx-auto" />
                          <span className="text-[11px] text-gray-500 mt-0.5 block">
                            Upload
                          </span>
                        </div>
                      )}
                    </div>
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageFile(null);
                          setPreviewUrl(null);
                        }}
                        className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-md"
                        title="Remove Image">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-semibold text-gray-400">Recommended: 400 × 400 px (1:1)</span>
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setPreviewUrl(null);
                        }}
                        className="text-xs text-red-600 hover:underline font-semibold">
                        Remove Image
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
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">
                    Parent Category (Level 2) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.parentId}
                    onChange={(e) =>
                      setFormData({ ...formData, parentId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500">
                    <option value="">Select Parent Category</option>
                    {sortedParentCategoryOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">
                    Name <span className="text-red-500">*</span>
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
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    placeholder="e.g., Gaming Laptops"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">
                    Slug
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    readOnly
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-500 text-sm focus:outline-none"
                    placeholder="e.g., gaming-laptops"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-amber-200 bg-amber-50/60">
                  <div className="pr-4">
                    <label
                      htmlFor="isFeaturedCheckbox"
                      className="text-xs font-semibold text-gray-800 flex items-center gap-1.5 cursor-pointer">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      Featured Subcategory
                    </label>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Show in &quot;Best Selling Categories&quot; on customer home page
                    </p>
                  </div>
                  <input
                    id="isFeaturedCheckbox"
                    type="checkbox"
                    checked={Boolean(formData.isFeatured)}
                    onChange={(e) =>
                      setFormData({ ...formData, isFeatured: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                </div>

                <TrustBadgesManager
                  value={formData.trustBadges || []}
                  onChange={(newBadges) => setFormData({ ...formData, trustBadges: newBadges })}
                  maxBadges={3}
                />
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 shrink-0">
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50 flex items-center gap-2 transition-colors">
                  {isSaving && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {editingItem ? "Update Subcategory" : "Create Subcategory"}
                </button>
              </div>
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
              className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                  <Trash className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Delete Subcategory?
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

export default SubCategories;
