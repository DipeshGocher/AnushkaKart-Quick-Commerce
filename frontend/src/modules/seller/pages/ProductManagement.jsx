import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlinePlus,
  HiOutlineCube,
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlineEye,
  HiOutlinePhoto,
  HiOutlineArchiveBox,
  HiOutlineTag,
  HiOutlineScale,
  HiOutlineArrowPath,
  HiOutlineXMark,
  HiOutlineChevronRight,
  HiChevronDown,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineFolderOpen,
  HiOutlineSwatch,
  HiOutlineSquaresPlus,
} from "react-icons/hi2";
import { HiOutlinePhotograph } from "react-icons/hi";
import Modal from "@shared/components/ui/Modal";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import Pagination from "@shared/components/ui/Pagination";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";

const SellerStatusBadge = React.memo(function SellerStatusBadge({ status, stock }) {
  if (stock === 0) return <Badge variant="rose" className="text-[10px] px-2 py-0.5">Out of Stock</Badge>;
  if (status === "active") return <Badge variant="success" className="text-[10px] px-2 py-0.5">Active</Badge>;
  return <Badge variant="gray" className="text-[10px] px-2 py-0.5">Inactive</Badge>;
});

const SellerProductTableRow = React.memo(function SellerProductTableRow({ p, onEdit, onDelete, onViewVariants, skuText, isSelected, onToggleSelect }) {
  const mainImg = p.mainImage || p.variants?.[0]?.images?.[0] || p.image;
  const transformedImg = useMemo(() => {
    return mainImg ? applyCloudinaryTransform(mainImg, 'f_auto,q_auto,w_100,h_100,c_fill') : null;
  }, [mainImg]);

  return (
    <tr className="hover:bg-gray-50/50 transition-colors group border-b border-gray-100 last:border-b-0">
      <td className="w-12 px-4 py-4 text-center">
        <input
          type="checkbox"
          checked={Boolean(isSelected)}
          onChange={() => onToggleSelect(p._id || p.id)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/20 cursor-pointer accent-brand-600"
        />
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center">
            {transformedImg ? (
              <img
                src={transformedImg}
                alt={p.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transform-gpu"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <HiOutlineCube className="h-6 w-6 text-slate-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-medium text-slate-900">
                {p.name}
              </p>
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="text-sm font-medium text-slate-900">
          {skuText}
        </span>
      </td>
      <td className="px-6 py-4 text-left">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-slate-900 uppercase tracking-tight bg-slate-100 px-3 py-0.5 rounded-full w-fit">
            {p.headerId?.name || "N/A"}
          </span>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="text-sm font-medium text-slate-900">
          {p.categoryId?.name || "N/A"}
        </span>
      </td>
      <td className="px-6 py-4">
        <span className="text-sm font-medium text-slate-900">
          {p.subcategoryId?.name || "N/A"}
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        {p.variants?.length > 0 ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onViewVariants(p);
            }}
            className="flex flex-col items-center cursor-pointer hover:bg-slate-50 p-1.5 rounded-xl transition-all active:scale-95 group"
          >
            <Badge
              variant="indigo"
              className="text-xs font-medium px-3 py-0.5 group-hover:shadow-sm transition-all"
            >
              {p.variants.length} VARIANTS
            </Badge>
          </div>
        ) : (
          <span className="text-xs font-medium text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded italic">
            None
          </span>
        )}
      </td>
      <td className="px-6 py-4 text-center">
        <div className="flex flex-col items-center justify-center">
          <SellerStatusBadge status={p.status} stock={p.stock} />
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={() => onEdit(p)}
            className="p-1 hover:text-brand-600 rounded-lg transition-all text-slate-500"
            title="Edit product"
          >
            <HiOutlinePencilSquare className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(p)}
            className="p-1 hover:text-rose-600 rounded-lg transition-all text-slate-500"
            title="Delete product"
          >
            <HiOutlineTrash className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});

const ProductManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qFromUrl = searchParams.get("q") || "";

  const [products, setProducts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [summaryStats, setSummaryStats] = useState(null);

  const [searchTerm, setSearchTerm] = useState(qFromUrl);
  const [debouncedSearch, setDebouncedSearch] = useState(qFromUrl || "");

  React.useEffect(() => {
    if (qFromUrl !== searchTerm) setSearchTerm(qFromUrl);
  }, [qFromUrl]);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [viewingVariants, setViewingVariants] = useState(null);
  const [isVariantsViewModalOpen, setIsVariantsViewModalOpen] = useState(false);
  const [variantImageFiles, setVariantImageFiles] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [modalTab, setModalTab] = useState("general");

  const fetchProducts = async (requestedPage = 1) => {
    setIsLoading(true);
    try {
      const params = {
        page: requestedPage,
        limit: pageSize,
        sort: sortBy,
      };

      if (debouncedSearch && debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      if (filterCategory && filterCategory !== "all") {
        params.category = filterCategory;
      }

      if (filterStatus === "Active") {
        params.status = "active";
      } else if (filterStatus === "Low Stock") {
        params.stockStatus = "low";
      } else if (filterStatus === "Out of Stock") {
        params.stockStatus = "out";
      }

      if (priceMin !== "" && !isNaN(Number(priceMin))) {
        params.minPrice = Number(priceMin);
      }
      if (priceMax !== "" && !isNaN(Number(priceMax))) {
        params.maxPrice = Number(priceMax);
      }

      const res = await sellerApi.getProducts(params);
      if (res.data.success) {
        // Backend returns handleResponse(..., { items, page, limit, total, totalPages })
        const payload = res.data.result || {};
        const rawProducts = Array.isArray(payload.items)
          ? payload.items
          : (res.data.results || []);
        const safe = Array.isArray(rawProducts) ? rawProducts : [];
        setProducts(safe);
        if (typeof payload.total === "number") {
          setTotal(payload.total);
        } else {
          setTotal(safe.length);
        }
        if (payload.summary && typeof payload.summary === "object") {
          setSummaryStats({
            total: Number(payload.summary.total) || 0,
            active: Number(payload.summary.active) || 0,
            lowStock: Number(payload.summary.lowStock) || 0,
            outOfStock: Number(payload.summary.outOfStock) || 0,
          });
        } else {
          setSummaryStats(null);
        }
        if (typeof payload.page === "number") {
          setPage(payload.page);
        } else {
          setPage(requestedPage);
        }
      }
    } catch (error) {
      toast.error("Failed to fetch products");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await sellerApi.getCategoryTree();
      if (res.data.success) {
        const list = (res.data.results || res.data.result || [])
          .filter((h) => h.slug !== "all" && String(h.name || "").trim().toLowerCase() !== "all");
        setDbCategories(list);
      }
    } catch (error) {
      // fail silently
    }
  };

  React.useEffect(() => {
    fetchCategories();
  }, []);

  const categories = dbCategories;

  const makeSku = (name, index = 1) => {
    const prefix = String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 5) || "item";
    return `${prefix}-${String(index).padStart(3, "0")}`;
  };

  const isAutoSku = (sku, name, index = 1) =>
    String(sku || "").toLowerCase() === makeSku(name, index);

  const displaySku = (product) =>
    product.sku ||
    (Array.isArray(product.variants) && product.variants.length > 0 && product.variants[0]?.sku) ||
    makeSku(product.name, 1);

  const resolveLowStockThreshold = (product) => {
    const parsed = Number(product?.lowStockAlert);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  };

  const handleModalScrollWheel = (event) => {
    const container = event.currentTarget;
    if (container.scrollHeight <= container.clientHeight) return;
    container.scrollTop += event.deltaY;
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  React.useEffect(() => {
    if (!isProductModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isProductModalOpen]);

  // Close filter dropdown on outside click
  React.useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (event) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target)
      ) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  React.useEffect(() => {
    fetchProducts(1);
  }, [debouncedSearch, filterCategory, filterStatus, sortBy, pageSize, priceMin, priceMax]);

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
    header: "",
    subcategory: "",
    status: "active",
    isFeatured: false,
    isTopDeal: false,
    tags: "",
    weight: "",
    length: 10,
    breadth: 10,
    height: 10,
    brand: "",
    shelfLife: "",
    countryOfOrigin: "",
    fssaiLicense: "",
    mainImage: null,
    galleryImages: [],
    variants: [
      { id: Date.now(), name: "", price: "", salePrice: "", stock: "", sku: "" },
    ],
  });

  const safeProducts = useMemo(
    () => (Array.isArray(products) ? products : []),
    [products]
  );

  const filteredProducts = safeProducts;

  const stats = useMemo(
    () => ({
      total:
        summaryStats?.total ??
        (typeof total === "number" ? total : safeProducts.length),
      lowStock:
        summaryStats?.lowStock ??
        safeProducts.filter((p) => p.stock > 0 && p.stock <= resolveLowStockThreshold(p)).length,
      outOfStock:
        summaryStats?.outOfStock ??
        safeProducts.filter((p) => p.stock === 0).length,
      active:
        summaryStats?.active ??
        safeProducts.filter((p) => p.status === "active").length,
    }),
    [safeProducts, summaryStats, total],
  );

  const handleEdit = useCallback((p) => {
    openEditModal(p);
  }, []);

  const handleDelete = useCallback((p) => {
    handleDeleteClick(p);
  }, []);

  const handleViewVariants = useCallback((p) => {
    setViewingVariants(p);
    setIsVariantsViewModalOpen(true);
  }, []);

  const handleSave = async () => {
    try {
      const selectedHeader = categories.find((h) => String(h._id || h.id) === String(formData.header));
      const selectedCategory = selectedHeader?.children?.find((c) => String(c._id || c.id) === String(formData.category));
      const availableSubcategories = selectedCategory?.children || [];

      if (!formData.name || !formData.header || !formData.category) {
        toast.error("Please fill all required fields, including categories");
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

      const invalidVariant = formData.variants?.find((v) => v.salePrice && Number(v.salePrice) > Number(v.price));
      if (invalidVariant) {
        toast.error(`Sale Price cannot be greater than Price for variant: ${invalidVariant.name || 'Main Variant'}`);
        return;
      }

      const data = new FormData();
      data.append("name", formData.name);
      data.append("slug", formData.slug);
      data.append("sku", formData.sku);
      data.append("description", formData.description);
      
      // Map top-level price/stock from first variant
      data.append("price", firstVariant.price);
      data.append("salePrice", firstVariant.salePrice || 0);
      data.append("stock", firstVariant.stock);
      if (formData.header) data.append("headerId", formData.header);
      if (formData.category) data.append("categoryId", formData.category);
      if (formData.subcategory) data.append("subcategoryId", formData.subcategory);
      data.append("status", formData.status);
      data.append("isFeatured", String(formData.isFeatured));
      data.append("isTopDeal", String(formData.isTopDeal));
      data.append("brand", formData.brand);
      data.append("weight", formData.weight);
      data.append("length", formData.length || 10);
      data.append("breadth", formData.breadth || 10);
      data.append("height", formData.height || 10);
      data.append("tags", formData.tags);
      data.append("shelfLife", formData.shelfLife);
      data.append("countryOfOrigin", formData.countryOfOrigin);
      data.append("fssaiLicense", formData.fssaiLicense);
      data.append("variants", JSON.stringify(formData.variants));
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

      // Append main image file or string URL
      if (formData.mainImageFile instanceof File) {
        data.append("mainImage", formData.mainImageFile);
      } else if (typeof formData.mainImage === "string" && formData.mainImage.trim() && !formData.mainImage.startsWith("data:") && !formData.mainImage.startsWith("blob:")) {
        data.append("mainImage", formData.mainImage.trim());
      }

      // Append gallery image files
      if (Array.isArray(formData.galleryFiles) && formData.galleryFiles.length > 0) {
        formData.galleryFiles.forEach((file) => {
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

      if (editingItem) {
        const response = await sellerApi.updateProduct(editingItem._id || editingItem.id, data);
        const approvalStatus = response?.data?.result?.approvalStatus;
        if (approvalStatus === "pending") {
          toast.success("Product changes submitted for admin approval");
        } else {
          toast.success(response?.data?.message || "Product updated successfully");
        }
      } else {
        const response = await sellerApi.createProduct(data);
        const approvalStatus = response?.data?.result?.approvalStatus;
        if (approvalStatus === "pending") {
          toast.success("Product submitted for admin approval");
        } else {
          toast.success(response?.data?.message || "Product created successfully");
        }
      }

      closeProductModal();
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save product");
    }
  };

  const handleImageUpload = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const previewUrl = URL.createObjectURL(file);
      if (type === "main") {
        setFormData((prev) => ({
          ...prev,
          mainImagePreview: previewUrl,
          mainImageFile: file,
          mainImage: null,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          galleryImages: [...(prev.galleryImages || []), previewUrl],
          galleryFiles: [...(prev.galleryFiles || []), file],
        }));
      }
    }
  };

  const exportProducts = () => {
    console.log("Exporting products...");
    alert("Exporting " + safeProducts.length + " products as CSV (Simulation)");
  };

  const handleToggleSelectProduct = useCallback((id) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    if (selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map((p) => p._id || p.id).filter(Boolean));
    }
  }, [filteredProducts, selectedProductIds.length]);

  const handleBulkDelete = async () => {
    if (!selectedProductIds.length) return;
    try {
      setIsDeleting(true);
      const res = await sellerApi.bulkDeleteProducts(selectedProductIds);
      const msg = res?.data?.message || `${selectedProductIds.length} products deleted successfully`;
      toast.success(msg);
      setSelectedProductIds([]);
      setIsBulkDeleteModalOpen(false);
      fetchProducts(page);
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error(error.response?.data?.message || "Failed to delete selected products");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = (product) => {
    setItemToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await sellerApi.deleteProduct(itemToDelete._id || itemToDelete.id);
      toast.success("Product deleted successfully");
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      fetchProducts();
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  const openEditModal = async (item = null) => {
    if (item) {
      let freshItem = { ...item };
      try {
        const itemId = item._id || item.id;
        if (itemId) {
          const res = await sellerApi.getProductById(itemId);
          if (res?.data?.result) {
            freshItem = res.data.result;
          }
        }
      } catch (err) {
        // Fallback to item if fetch fails
      }

      let rawHL = freshItem.highlights || item?.highlights || [];
      if (typeof rawHL === "string") {
        try { rawHL = JSON.parse(rawHL); } catch (e) { rawHL = []; }
      }
      if (!Array.isArray(rawHL)) rawHL = [];
      const freshHighlights = [0, 1, 2, 3].map((i) => {
        const h = rawHL[i];
        if (!h) return { icon: "", label: "" };
        if (typeof h === "string") return { icon: "", label: h };
        return { icon: h.icon || h.id || "", label: h.label || h.name || h.title || "" };
      });

      let rawSpecs = freshItem.specifications || item?.specifications || [];
      if (typeof rawSpecs === "string") {
        try { rawSpecs = JSON.parse(rawSpecs); } catch (e) { rawSpecs = []; }
      }
      if (!Array.isArray(rawSpecs)) rawSpecs = [];
      const freshSpecs = rawSpecs.map((s) => ({
        key: s?.key || "",
        value: s?.value || "",
      }));

      setFormData({
        name: freshItem.name || "",
        slug: freshItem.slug || "",
        sku: freshItem.sku || "",
        description: freshItem.description || "",
        price: freshItem.price || "",
        salePrice: freshItem.salePrice || "",
        stock: freshItem.stock || "",
        lowStockAlert: freshItem.lowStockAlert || 5,
        header: freshItem.headerId?._id || freshItem.headerId || "",
        category: freshItem.categoryId?._id || freshItem.categoryId || "",
        subcategory: freshItem.subcategoryId?._id || freshItem.subcategoryId || "",
        status: freshItem.status || "active",
        isFeatured: Boolean(freshItem.isFeatured),
        isTopDeal: Boolean(freshItem.isTopDeal),
        tags: Array.isArray(freshItem.tags) ? freshItem.tags.join(", ") : freshItem.tags || "",
        weight: freshItem.weight || "",
        length: freshItem.length || 10,
        breadth: freshItem.breadth || 10,
        height: freshItem.height || 10,
        brand: freshItem.brand || "",
        shelfLife: freshItem.shelfLife || "",
        countryOfOrigin: freshItem.countryOfOrigin || "",
        fssaiLicense: freshItem.fssaiLicense || "",
        mainImage: freshItem.mainImage || null,
        mainImageFile: null,
        mainImagePreview: null,
        galleryImages: freshItem.galleryImages || [],
        galleryFiles: [],
        highlights: freshHighlights,
        specifications: freshSpecs,
        variants: (freshItem.variants && freshItem.variants.length > 0) ? freshItem.variants.map(v => ({ ...v, id: v._id || Date.now() })) : [
          {
            id: Date.now(),
            name: "",
            price: freshItem.price || "",
            salePrice: freshItem.salePrice || "",
            stock: freshItem.stock || "",
            sku: freshItem.sku || "",
          },
        ],
      });
      setEditingItem(freshItem);
    } else {
      setFormData({
        name: "",
        slug: "",
        sku: "",
        description: "",
        price: "",
        salePrice: "",
        stock: "",
        lowStockAlert: 5,
        category: "",
        header: "",
        status: "active",
        isFeatured: false,
        isTopDeal: false,
        tags: "",
        weight: "",
        brand: "",
        mainImage: null,
        mainImageFile: null,
        mainImagePreview: null,
        galleryImages: [],
        galleryFiles: [],
        highlights: [0, 1, 2, 3].map(() => ({ icon: "", label: "" })),
        specifications: [],
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
      setEditingItem(null);
    }
    setVariantImageFiles({});
    setModalTab("general");
    setIsProductModalOpen(true);
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setVariantImageFiles({});
    setEditingItem(null);
  };

  return (
    <div className="space-y-6 pb-16">

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            Product List
            <Badge
              variant="primary"
              className="text-[9px] px-1.5 py-0 font-bold tracking-wider uppercase">
              Live
            </Badge>
          </h1>
          <p className="text-gray-500 mt-1">
            Track your items, prices, and how many are left in stock.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate("/seller/products/add")}
            className="flex items-center gap-2 bg-black text-primary-foreground px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors">
            <HiOutlinePlus className="h-5 w-5" />
            Add New Product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "All Items",
            val: stats.total,
            icon: HiOutlineCube,
            color: "text-brand-600",
            bg: "bg-brand-50",
            status: "All",
          },
          {
            label: "Active Items",
            val: stats.active,
            icon: HiOutlineCheckCircle,
            color: "text-brand-600",
            bg: "bg-brand-50",
            status: "Active",
          },
          {
            label: "Low Stock",
            val: stats.lowStock,
            icon: HiOutlineExclamationCircle,
            color: "text-amber-600",
            bg: "bg-amber-50",
            status: "Low Stock",
          },
          {
            label: "Out of Stock",
            val: stats.outOfStock,
            icon: HiOutlineArchiveBox,
            color: "text-rose-600",
            bg: "bg-rose-50",
            status: "Out of Stock",
          },
        ].map((stat, i) => (
          <Card
            key={i}
            className={cn(
              "border-none shadow-sm ring-1 ring-slate-100 p-4 relative overflow-hidden group cursor-pointer",
              filterStatus === stat.status && "ring-2 ring-brand-500",
            )}
            onClick={() => setFilterStatus(stat.status)}
          >
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300", stat.bg, stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="ds-label">{stat.label}</p>
                <h4 className="ds-stat-medium">{stat.val}</h4>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbox */}

      <Card className="border-none shadow-sm ring-1 ring-slate-100 p-3 bg-white/60 backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row gap-3 items-center">
          <div className="relative flex-1 group w-full">
            <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-all" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value;
                setSearchTerm(value);
                const next = new URLSearchParams(searchParams);
                if (value) next.set("q", value);
                else next.delete("q");
                setSearchParams(next);
              }}
              placeholder="Search by name, SKU or slug..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border-none rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/5 transition-all outline-none"
            />
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-nowrap gap-2 shrink-0 w-full lg:w-auto">
            <div className="relative col-span-2 sm:col-auto sm:flex-none">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full sm:w-auto pl-3.5 pr-9 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer truncate"
              >
                <option value="all">All Categories</option>
                {categories.map((h) => (
                  <optgroup key={h._id || h.id} label={h.name}>
                    <option value={h._id || h.id}>All {h.name}</option>
                    {(h.children || []).map((c) => (
                      <option key={c._id || c.id} value={c._id || c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <HiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>

            <button
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <HiOutlineFunnel className="h-4 w-4 shrink-0" />
              <span>Filters</span>
            </button>

            <div className="relative sm:flex-none">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full sm:w-auto pl-3.5 pr-9 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer truncate"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="price-asc">Price Low-High</option>
                <option value="price-desc">Price High-Low</option>
                <option value="stock-asc">Stock Low-High</option>
                <option value="stock-desc">Stock High-Low</option>
              </select>
              <HiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </Card>


      {/* Bulk Action Bar */}
      {selectedProductIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/90 border border-amber-200 rounded-xl px-5 py-3 mb-4 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center h-6 min-w-6 px-2 text-xs font-bold bg-amber-600 text-white rounded-full">
              {selectedProductIds.length}
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {selectedProductIds.length} product{selectedProductIds.length > 1 ? "s" : ""} selected out of {filteredProducts.length}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSelectedProductIds([])}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            >
              Deselect All
            </button>
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all active:scale-95"
            >
              <HiOutlineTrash className="h-4 w-4" />
              <span>Delete Selected ({selectedProductIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Product Table */}
      <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-100">
                <th className="w-12 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = selectedProductIds.length > 0 && selectedProductIds.length < filteredProducts.length;
                      }
                    }}
                    onChange={handleToggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/20 cursor-pointer accent-brand-600"
                    title="Select all products"
                  />
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Product Code
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Header
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Subcategory
                </th>
                <th className="px-6 py-3 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Variant
                </th>
                <th className="px-6 py-3 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <HiOutlineArrowPath className="h-6 w-6 animate-spin text-brand-600" />
                      <span className="text-sm font-medium">Loading products...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <HiOutlineCube className="h-8 w-8 text-slate-400" />
                      <span className="text-sm font-medium">No products found matching your search or filters.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <SellerProductTableRow
                    key={p._id || p.id}
                    p={p}
                    isSelected={selectedProductIds.includes(p._id || p.id)}
                    onToggleSelect={handleToggleSelectProduct}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onViewVariants={handleViewVariants}
                    skuText={displaySku(p)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>


      {isFilterOpen && (
        <div
          ref={filterDropdownRef}
          className="absolute z-[9999] right-36 top-[350px] w-64 rounded-xl border border-slate-200 bg-white shadow-xl p-4 space-y-3"
        >
          <div>
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.18em] mb-1">
              Status
            </p>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-primary/10 outline-none bg-white"
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.18em] mb-1">
                Min Price
              </p>
              <input
                type="number"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="e.g. 100"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-primary/10 outline-none bg-white"
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.18em] mb-1">
                Max Price
              </p>
              <input
                type="number"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="e.g. 1000"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-primary/10 outline-none bg-white"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                setFilterCategory("all");
                setFilterStatus("All");
                setPriceMin("");
                setPriceMax("");
                setSearchTerm("");
                setSearchParams({});
              }}
              className="text-[11px] font-bold text-slate-600 hover:text-slate-700"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={Math.ceil(total / pageSize) || 1}
          total={total}
          pageSize={pageSize}
          onPageChange={(p) => fetchProducts(p)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
            fetchProducts(1);
          }}
          loading={isLoading}
        />
      </div>

      {/* Edit Modal (Copy from Admin) */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-2 sm:p-4 lg:p-12 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={closeProductModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-5xl relative z-10 bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[calc(100vh-2rem)]">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 shrink-0">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shrink-0">
                    <HiOutlineCube className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                      Edit Product
                    </h3>
                    <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 mt-0.5">
                      <Badge
                        variant="primary"
                        className="text-[7px] font-bold uppercase tracking-widest px-1 bg-brand-100 text-brand-700">
                        SELLER
                      </Badge>
                      <HiOutlineChevronRight className="h-2.5 w-2.5 text-slate-300 shrink-0" />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest truncate max-w-[110px] sm:max-w-none">
                        {formData.sku || "PENDING SKU"}
                      </span>
                      {/* Mobile-only compact Status pill */}
                      <div className="lg:hidden">
                        <select
                          value={formData.status}
                          onChange={(e) =>
                            setFormData({ ...formData, status: e.target.value })
                          }
                          className="bg-brand-50 text-[10px] font-extrabold text-brand-700 px-2 py-0.5 rounded-md border border-brand-200 outline-none cursor-pointer">
                          <option value="active">PUBLISHED</option>
                          <option value="inactive">DRAFT</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeProductModal}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600 shrink-0 ml-2">
                  <HiOutlineXMark className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
                {/* Modal Sidebar / Mobile Tab Strip */}
                <div
                  className="flex flex-row overflow-x-auto gap-1.5 p-2 sm:p-3 border-b border-slate-100 lg:border-b-0 lg:flex-col lg:w-1/4 lg:border-r lg:space-y-1 lg:p-4 lg:overflow-y-auto shrink-0 bg-slate-50/70"
                  onWheel={handleModalScrollWheel}>
                  {[
                    {
                      id: "general",
                      label: "General Info",
                      icon: HiOutlineTag,
                    },
                    {
                      id: "media",
                      label: "Images & Media",
                      icon: HiOutlinePhoto,
                    },
                    {
                      id: "variants",
                      label: "Item Variants",
                      icon: HiOutlineSwatch,
                    },
                    {
                      id: "category",
                      label: "Groups",
                      icon: HiOutlineFolderOpen,
                    },
                    {
                      id: "specifications",
                      label: "More Details",
                      icon: HiOutlineCube,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setModalTab(tab.id)}
                      className={cn(
                        "flex items-center space-x-2 px-3 py-2 sm:px-3.5 sm:py-2.5 lg:w-full lg:px-4 lg:py-3 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap shrink-0",
                        modalTab === tab.id
                          ? "bg-white text-primary shadow-sm ring-1 ring-slate-200/80"
                          : "text-slate-600 hover:bg-slate-100",
                      )}>
                      <tab.icon className="h-4 w-4 shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  ))}

                  <div className="hidden lg:block pt-8 px-4">
                    <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100">
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

                {/* Modal Content Area */}
                <div
                  className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-h-0 overscroll-contain custom-scrollbar pb-32 sm:pb-16"
                  onWheel={handleModalScrollWheel}>
                  {modalTab === "general" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
                            placeholder="e.g. Premium Basmati Rice"
                          />
                        </div>
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Web Address
                          </label>
                          <div className="flex items-center bg-slate-50 rounded-xl px-4 py-2.5">
                            <span className="text-[10px] text-slate-600 font-bold mr-1">
                              /product/
                            </span>
                            <input
                              value={formData.slug}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  slug: e.target.value,
                                })
                              }
                              className="flex-1 bg-transparent border-none text-sm text-slate-600 font-semibold outline-none"
                              placeholder="premium-basmati-rice"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          About this item
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              description: e.target.value,
                            })
                          }
                          onWheel={(e) => e.stopPropagation()}
                          onTouchMove={(e) => e.stopPropagation()}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[160px] max-h-[260px] outline-none resize-none overflow-y-auto custom-scrollbar"
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
                              setFormData({
                                ...formData,
                                brand: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
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
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-mono font-bold outline-none ring-primary/5 focus:ring-2"
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
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
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
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
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
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
                            placeholder="e.g. 100123..."
                          />
                        </div>
                      </div>

                      {/* Parcel Weight & Box Dimensions (Shiprocket Courier) */}
                      <div className="bg-slate-50/90 p-5 rounded-2xl border border-slate-200/90 space-y-4">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <HiOutlineScale className="h-4 w-4 text-primary" />
                            Parcel Weight & Box Dimensions (पार्सल का वजन और साइज़)
                          </h4>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            💡 सही वजन और बॉक्स का साइज़ भरें ताकि Shiprocket कूरियर डिलीवरी चार्ज सही रहे और कोई पेनल्टी न लगे।
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                              Product Weight (वजन)
                            </label>
                            <input
                              value={formData.weight}
                              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="e.g. 500g or 1.5 kg"
                            />
                          </div>

                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                              Length (लंबाई - cm)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={formData.length}
                              onChange={(e) => setFormData({ ...formData, length: Math.max(1, Number(e.target.value) || 10) })}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="10"
                            />
                          </div>

                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                              Width / Breadth (चौड़ाई - cm)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={formData.breadth}
                              onChange={(e) => setFormData({ ...formData, breadth: Math.max(1, Number(e.target.value) || 10) })}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="10"
                            />
                          </div>

                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                              Height (ऊंचाई - cm)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={formData.height}
                              onChange={(e) => setFormData({ ...formData, height: Math.max(1, Number(e.target.value) || 10) })}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="10"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {modalTab === "media" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 mb-1">Product Images</h4>
                        <p className="text-xs text-slate-500 font-medium">
                          Upload main product photo and gallery images. Images are stored securely in Cloudinary.
                        </p>
                      </div>

                      {/* Main Product Image Section */}
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider">
                            Main Product Image
                          </label>
                          {(formData.mainImagePreview || formData.mainImage) && (
                            <button
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  mainImage: null,
                                  mainImageFile: null,
                                  mainImagePreview: null,
                                }));
                              }}
                              className="text-xs text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <HiOutlineTrash className="h-3.5 w-3.5" /> Remove
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                          <div className="h-32 w-32 shrink-0 rounded-2xl border-2 border-dashed border-slate-200 bg-white overflow-hidden flex items-center justify-center relative p-1 shadow-sm">
                            {formData.mainImagePreview ? (
                              <img
                                src={formData.mainImagePreview}
                                alt="Main Preview"
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
                                  setFormData((prev) => ({
                                    ...prev,
                                    mainImage: e.target.value,
                                    mainImageFile: null,
                                    mainImagePreview: null,
                                  }));
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
                            <p className="text-[11px] text-slate-400">Add multiple additional photos for customers to view</p>
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
                                  setFormData((prev) => ({
                                    ...prev,
                                    galleryImages: [...(prev.galleryImages || []), ...newPreviews],
                                    galleryFiles: [...(prev.galleryFiles || []), ...newFiles],
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
                                  setFormData((prev) => ({
                                    ...prev,
                                    galleryImages: prev.galleryImages.filter((_, i) => i !== idx),
                                    galleryFiles: (prev.galleryFiles || []).filter((_, i) => i !== idx),
                                  }));
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

                  {/* Additional tabs populated as needed */}
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
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer">
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
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50">
                            <option value="">Select Category</option>
                            {categories
                              .find((h) => String(h._id || h.id) === String(formData.header))
                              ?.children?.map((c) => (
                                <option key={c._id || c.id} value={c._id || c.id}>
                                  {c.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5 flex flex-col">
                        <div className="grid grid-cols-1 gap-6">
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                              Sub-Category {(() => {
                                const hObj = categories.find((h) => String(h._id || h.id) === String(formData.header));
                                const cObj = hObj?.children?.find((c) => String(c._id || c.id) === String(formData.category));
                                const subList = cObj?.children || [];
                                return subList.length > 0 ? (
                                  <span className="text-rose-500">*</span>
                                ) : (
                                  <span className="text-slate-400 font-normal lowercase">(Optional - None available)</span>
                                );
                              })()}
                            </label>
                            <select
                              value={formData.subcategory}
                              onChange={(e) =>
                                setFormData({ ...formData, subcategory: e.target.value })
                              }
                              disabled={!formData.category}
                              className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                              {(() => {
                                const hObj = categories.find((h) => String(h._id || h.id) === String(formData.header));
                                const cObj = hObj?.children?.find((c) => String(c._id || c.id) === String(formData.category));
                                const subList = cObj?.children || [];
                                if (!formData.category) return <option value="">Select Category First</option>;
                                if (subList.length === 0) return <option value="">No Sub-Category for this Category</option>;
                                return (
                                  <>
                                    <option value="">Select Sub-Category</option>
                                    {subList.map((sc) => (
                                      <option key={sc._id || sc.id} value={sc._id || sc.id}>
                                        {sc.name}
                                      </option>
                                    ))}
                                  </>
                                );
                              })()}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}


                  {modalTab === "variants" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold">Product Variants</h4>
                        <button
                          type="button"
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
                          className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-[10px] font-bold">+ ADD</button>
                      </div>
                      <div className="space-y-3">
                        {formData.variants.map((v, i) => (
                          <div key={v.id} className="grid grid-cols-12 gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 relative group">
                            <div className="col-span-12 md:col-span-3 space-y-1 flex flex-col justify-end">
                              <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest ml-1">Variant Name</label>
                              <input value={v.name} onChange={e => {
                                const news = [...formData.variants];
                                news[i].name = e.target.value;
                                setFormData({ ...formData, variants: news });
                              }} placeholder="e.g. 1kg, 1 pack, 1 liter..." className="w-full bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none" />
                            </div>
                            <div className="col-span-6 md:col-span-2 space-y-1 flex flex-col justify-end">
                              <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest ml-1">Price</label>
                              <input type="number" min="0" value={v.price} onChange={e => {
                                const val = e.target.value;
                                if (val !== '' && Number(val) < 0) return;
                                
                                if (val !== '' && v.salePrice && Number(val) < Number(v.salePrice)) {
                                  toast.error("Regular price cannot be less than sale price");
                                  return;
                                }
                                
                                const news = [...formData.variants];
                                news[i].price = val;
                                setFormData({ ...formData, variants: news });
                              }} placeholder="Price" className="w-full bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none" />
                            </div>
                            <div className="col-span-6 md:col-span-2 space-y-1 flex flex-col justify-end">
                              <label className="text-[8px] font-bold text-brand-400 uppercase tracking-widest ml-1">Sale Price</label>
                              <input type="number" min="0" value={v.salePrice} onChange={e => {
                                const val = e.target.value;
                                if (val !== '' && Number(val) < 0) return;
                                
                                if (val !== '' && v.price && Number(val) > Number(v.price)) {
                                  toast.error("Sale price cannot be greater than regular price");
                                  return;
                                }
                                
                                const news = [...formData.variants];
                                news[i].salePrice = val;
                                setFormData({ ...formData, variants: news });
                              }} placeholder="Sale" className="w-full bg-brand-50/50 px-3 py-2 rounded-xl text-xs ring-1 ring-brand-100 text-brand-700 outline-none" />
                            </div>
                            <div className="col-span-6 md:col-span-2 space-y-1 flex flex-col justify-end">
                              <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest ml-1">Stock</label>
                              <input type="number" min="0" value={v.stock} onChange={e => {
                                const val = e.target.value;
                                if (val !== '' && Number(val) < 0) return;
                                const news = [...formData.variants];
                                news[i].stock = val;
                                setFormData({ ...formData, variants: news });
                              }} placeholder="Stock" className="w-full bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none" />
                            </div>
                            <div className="col-span-5 md:col-span-2 space-y-1 flex flex-col justify-end">
                              <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest ml-1">SKU</label>
                              <input value={v.sku} onChange={e => {
                                const news = [...formData.variants];
                                news[i].sku = e.target.value;
                                setFormData({ ...formData, variants: news });
                              }} placeholder="SKU" className="w-full bg-white px-3 py-2 rounded-xl text-[10px] ring-1 ring-slate-100 outline-none" />
                            </div>
                            <div className="col-span-1 flex justify-end flex-col pb-2">
                              <button type="button" onClick={() => {
                                const newImageFiles = { ...variantImageFiles };
                                delete newImageFiles[i];
                                
                                // Re-index variant images
                                const reindexedFiles = {};
                                Object.keys(newImageFiles).forEach(key => {
                                   const numKey = Number(key);
                                   if (numKey > i) {
                                      reindexedFiles[numKey - 1] = newImageFiles[key];
                                   } else {
                                      reindexedFiles[numKey] = newImageFiles[key];
                                   }
                                });
                                setVariantImageFiles(reindexedFiles);

                                setFormData((prev) => {
                                  const remaining = prev.variants
                                    .map((variant, idx) => ({ variant, oldIndex: idx + 1 }))
                                    .filter((item, idx) => idx !== i)
                                    .map((item, newIdx) => {
                                      const shouldAuto =
                                        !item.variant.sku ||
                                        isAutoSku(item.variant.sku, prev.name, item.oldIndex);
                                      return {
                                        ...item.variant,
                                        sku: shouldAuto ? makeSku(prev.name, newIdx + 1) : item.variant.sku,
                                      };
                                    });
                                  return { ...prev, variants: remaining };
                                });
                              }} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition-all">
                                <HiOutlineTrash className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Variant Images Row */}
                            <div className="col-span-12 mt-2 pt-3 border-t border-slate-200">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block ml-1">Variant Images (Max 5)</label>
                                <div className="flex gap-3 w-full overflow-x-auto pb-2 custom-scrollbar">
                                   {[0, 1, 2, 3, 4].map(imgIdx => {
                                      const hasFile = Boolean(variantImageFiles[i]?.[imgIdx]);
                                      const hasUrl = Boolean(v.images?.[imgIdx]);
                                      const hasImage = hasFile || hasUrl;
                                      return (
                                        <div key={imgIdx} className="relative h-16 w-16 shrink-0 rounded-xl border-2 border-dashed border-slate-200 bg-white hover:border-primary/50 overflow-hidden flex items-center justify-center transition-colors group">
                                           {hasFile ? (
                                               <img src={URL.createObjectURL(variantImageFiles[i][imgIdx])} alt="" className="h-full w-full object-cover" />
                                           ) : hasUrl ? (
                                               <img src={v.images[imgIdx]} alt="" className="h-full w-full object-cover" />
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
                                                   const newFiles = [...(variantImageFiles[i] || [])];
                                                   delete newFiles[imgIdx];
                                                   setVariantImageFiles({ ...variantImageFiles, [i]: newFiles });
                                                 }
                                                 if (hasUrl) {
                                                   setFormData((prev) => {
                                                     const updatedVariants = [...(prev.variants || [])];
                                                     if (updatedVariants[i] && Array.isArray(updatedVariants[i].images)) {
                                                       const updatedImages = [...updatedVariants[i].images];
                                                       updatedImages.splice(imgIdx, 1);
                                                       updatedVariants[i] = { ...updatedVariants[i], images: updatedImages };
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
                                                         const newFiles = [...(variantImageFiles[i] || [])];
                                                         newFiles[imgIdx] = e.target.files[0];
                                                         setVariantImageFiles({ ...variantImageFiles, [i]: newFiles });
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
                                Click &apos;Add Field&apos; above or select any quick suggestion to add attributes.
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

              {/* Modal Footer */}
              <div className="p-3.5 sm:p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2 sm:gap-3">
                <button
                  onClick={closeProductModal}
                  className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 sm:border-0 text-center">
                  CLOSE
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 sm:flex-none bg-slate-900 text-white px-5 sm:px-10 py-2.5 rounded-xl text-xs font-bold shadow-xl hover:-translate-y-0.5 transition-all text-center">
                  SAVE CHANGES
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Deletion"
        size="sm"
        footer={
          <div className="flex gap-4 justify-end w-full">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-700 transition-colors">
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-6 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95">
              Delete product
            </button>
          </div>
        }>
        <div className="px-6 py-6 flex flex-col items-center text-center space-y-5">
          <div className="h-18 w-18 md:h-20 md:w-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
            <HiOutlineTrash className="h-9 w-9 md:h-10 md:w-10" />
          </div>
          <div className="space-y-2 max-w-md">
            <h4 className="text-lg font-semibold text-slate-900">
              Are you absolutely sure?
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              This action cannot be undone. This will permanently remove{" "}
              <span className="font-semibold text-slate-900">
                {itemToDelete?.name}
              </span>{" "}
              from the catalog.
            </p>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => !isDeleting && setIsBulkDeleteModalOpen(false)}
        title="Confirm Bulk Deletion"
        size="sm"
        footer={
          <div className="flex gap-4 justify-end w-full">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setIsBulkDeleteModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <HiOutlineArrowPath className="h-4 w-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete {selectedProductIds.length} Products</span>
              )}
            </button>
          </div>
        }
      >
        <div className="px-6 py-6 flex flex-col items-center text-center space-y-5">
          <div className="h-18 w-18 md:h-20 md:w-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
            <HiOutlineTrash className="h-9 w-9 md:h-10 md:w-10" />
          </div>
          <div className="space-y-2 max-w-md">
            <h4 className="text-lg font-semibold text-slate-900">
              Delete {selectedProductIds.length} Selected Products?
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to delete these <span className="font-semibold text-slate-900">{selectedProductIds.length}</span> products?
            </p>
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 text-left">
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                🛡️ <strong>Safety Protection Active:</strong> Products with no past orders will be permanently deleted. Products associated with past customer orders will be archived and hidden to preserve customer order receipts and invoices.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Viewing Variants Modal */}
      <Modal
        isOpen={isVariantsViewModalOpen}
        onClose={() => setIsVariantsViewModalOpen(false)}
        title="Product Variants Details"
        size="lg"
      >
        <div className="py-2">
          <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="h-16 w-16 bg-white rounded-xl shadow-sm overflow-hidden flex items-center justify-center border border-slate-100">
              {viewingVariants?.mainImage || viewingVariants?.galleryImages?.[0] || viewingVariants?.image ? (
                <img src={viewingVariants.mainImage || viewingVariants.galleryImages?.[0] || viewingVariants.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <HiOutlineCube className="h-8 w-8 text-slate-200" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">{viewingVariants?.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="primary" className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5">{viewingVariants?.categoryId?.name || 'Category'}</Badge>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Master SKU: {viewingVariants?.sku || viewingVariants?._id?.slice(-6).toUpperCase() || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Variant Specification</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center">Unit Price</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center">Available Stock</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right">Variant SKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {viewingVariants?.variants?.map((v, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30 transition-all cursor-default">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-700 group-hover:text-primary transition-colors">{v.name}</span>
                        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">Variation {idx + 1}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={cn("text-xs font-bold", v.salePrice > 0 ? "text-slate-600 line-through scale-90" : "text-slate-900")}>₹{v.price}</span>
                        {v.salePrice > 0 && <span className="text-xs font-bold text-brand-600">₹{v.salePrice}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={v.stock === 0 ? "rose" : v.stock <= 10 ? "amber" : "emerald"} className="text-[10px] font-black uppercase tracking-widest px-2 shadow-sm">
                        {v.stock === 0 ? 'OUT OF STOCK' : `${v.stock} UNITS`}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-[10px] font-bold text-slate-600 font-mono tracking-tighter uppercase bg-slate-100 px-2 py-1 rounded-lg">
                        {v.sku || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setIsVariantsViewModalOpen(false)}
              className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
            >
              CLOSE VIEWER
            </button>
          </div>
        </div>
      </Modal>
    </div >
  );
};

export default ProductManagement;
