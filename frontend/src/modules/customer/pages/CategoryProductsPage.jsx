import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Search, SlidersHorizontal, ArrowUpDown, X, Check, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

import ProductCard from '../components/shared/ProductCard';
import ProductDetailSheet from '../components/shared/ProductDetailSheet';
import { useProductDetail } from '../context/ProductDetailContext';
import { customerApi } from '../services/customerApi';
import MiniCart from '../components/shared/MiniCart';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { useSettings } from '@core/context/SettingsContext';
import Lottie from 'lottie-react';

const SORT_OPTIONS = [
    { id: 'price_desc', label: 'Price: High to Low' },
    { id: 'discount', label: 'Discount: High to Low' },
    { id: 'name', label: 'Name: A to Z' }
];

const normalizeText = (str) =>
    String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

const matchCategoryItem = (item, catIdStr) => {
    if (!item || !catIdStr) return false;
    const target = normalizeText(catIdStr);
    const itemId = String(item._id || '').toLowerCase().trim();
    const itemName = normalizeText(item.name);
    return itemId === target || itemName === target || itemId === catIdStr.toLowerCase().trim();
};

const CategoryProductsPage = () => {
    const { categoryName: catId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentLocation } = useAppLocation();
    const { settings } = useSettings();
    const initialSubcategoryId = location.state?.activeSubcategoryId || 'all';

    const [selectedSubCategory, setSelectedSubCategory] = useState(initialSubcategoryId);
    const [selectedTag, setSelectedTag] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [sortBy, setSortBy] = useState('default');
    const [isSortOpen, setIsSortOpen] = useState(false);

    const [category, setCategory] = useState(null);
    const [subCategories, setSubCategories] = useState([{ id: 'all', name: 'All', icon: 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png' }]);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [noServiceData, setNoServiceData] = useState(null);

    // Load fallback Lottie
    useEffect(() => {
        import('@/assets/lottie/animation.json')
            .then((m) => setNoServiceData(m.default))
            .catch(() => {});
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const hasValidLocation =
                Number.isFinite(currentLocation?.latitude) &&
                Number.isFinite(currentLocation?.longitude);

            const isAllCategory = !catId || catId === 'all' || catId.toLowerCase() === 'all';

            // 1. Fetch category tree first to resolve actual Category _id and subcategories
            const catRes = await customerApi.getCategories({ tree: true });
            const tree = catRes.data?.results || catRes.data?.result || [];

            let targetCategory = null;
            let targetSubCategory = null;

            if (isAllCategory) {
                targetCategory = { _id: 'all', name: "All Products", children: [] };
            } else {
                for (const header of tree) {
                    if (matchCategoryItem(header, catId)) {
                        targetCategory = header;
                        break;
                    }
                    for (const cat of (header.children || [])) {
                        if (matchCategoryItem(cat, catId)) {
                            targetCategory = cat;
                            break;
                        }
                        for (const sub of (cat.children || [])) {
                            if (matchCategoryItem(sub, catId)) {
                                targetCategory = cat;
                                targetSubCategory = sub;
                                break;
                            }
                        }
                        if (targetCategory) break;
                    }
                    if (targetCategory) break;
                }
            }

            // Fallback category header if not found in tree
            if (!targetCategory && !isAllCategory) {
                targetCategory = { _id: catId, name: catId, children: [] };
            }

            setCategory({ id: targetCategory?._id || catId, name: targetCategory?.name || catId });

            // Extract ONLY subcategories belonging to this targetCategory
            if (isAllCategory) {
                const allSubs = [];
                tree.forEach(header => {
                    (header.children || []).forEach(c => {
                        allSubs.push({
                            id: c._id,
                            name: c.name,
                            icon: c.image || 'https://cdn-icons-png.flaticon.com/128/2321/2321801.png',
                            children: c.children || []
                        });
                    });
                });
                setSubCategories([{ id: 'all', name: 'All', icon: 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png' }, ...allSubs]);
            } else if (targetCategory) {
                const subs = (targetCategory.children || []).map(s => ({
                    id: s._id,
                    name: s.name,
                    icon: s.image || s.icon || 'https://cdn-icons-png.flaticon.com/128/2321/2321801.png',
                    children: s.children || []
                }));
                setSubCategories([{ id: 'all', name: 'All', icon: targetCategory.image || 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png' }, ...subs]);
            }

            if (targetSubCategory) {
                setSelectedSubCategory(targetSubCategory._id);
            }

            // 2. Build product API params with resolved categoryId
            const productParams = { limit: 200 };
            if (targetCategory?._id && targetCategory._id !== 'all') {
                productParams.categoryId = targetCategory._id;
            }
            if (hasValidLocation) {
                productParams.lat = currentLocation.latitude;
                productParams.lng = currentLocation.longitude;
            }

            const prodRes = await customerApi.getProducts(productParams);

            if (prodRes.data?.success) {
                const rawResult = prodRes.data.result;
                const dbProds = Array.isArray(prodRes.data.results)
                    ? prodRes.data.results
                    : Array.isArray(rawResult?.items)
                    ? rawResult.items
                    : Array.isArray(rawResult)
                    ? rawResult
                    : [];

                const formattedProds = dbProds.map(p => ({
                    ...p,
                    id: p._id,
                    image:
                      p.mainImage ||
                      (p.variants?.[0]?.images?.[0]) ||
                      p.image ||
                      "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400",
                    price: p.salePrice || p.price,
                    originalPrice: p.price,
                    weight: p.weight || "1 unit",
                    deliveryTime: "8-15 mins"
                }));

                // Strict category filtering: Only keep products that belong to targetCategory
                const validCategoryIds = new Set();
                if (targetCategory && targetCategory._id !== 'all') {
                    validCategoryIds.add(String(targetCategory._id));
                    (targetCategory.children || []).forEach(sub => {
                        validCategoryIds.add(String(sub._id));
                        (sub.children || []).forEach(child => validCategoryIds.add(String(child._id)));
                    });
                }

                const targetCatNameNorm = targetCategory ? normalizeText(targetCategory.name) : '';

                const categoryProducts = formattedProds.filter(p => {
                    if (!targetCategory || targetCategory._id === 'all') return true;

                    const prodCatId = String(p.categoryId?._id || p.categoryId || '');
                    const prodSubId = String(p.subcategoryId?._id || p.subcategoryId || '');
                    const prodHeadId = String(p.headerCategoryId?._id || p.headerCategoryId || '');

                    if (validCategoryIds.has(prodCatId) || validCategoryIds.has(prodSubId) || validCategoryIds.has(prodHeadId)) {
                        return true;
                    }

                    const prodCatName = normalizeText(p.categoryName || p.categoryId?.name || p.headerCategoryName || '');
                    if (prodCatName && targetCatNameNorm && (prodCatName === targetCatNameNorm || prodCatName.includes(targetCatNameNorm) || targetCatNameNorm.includes(prodCatName))) {
                        return true;
                    }

                    return false;
                });

                setProducts(categoryProducts);
            } else {
                setProducts([]);
            }
        } catch (error) {
            console.error("Error fetching category data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        setSelectedSubCategory(location.state?.activeSubcategoryId || 'all');
        setSelectedTag('all');
    }, [catId, location.state?.activeSubcategoryId, currentLocation?.latitude, currentLocation?.longitude]);

    const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);

    // Extract quick tags for top filter bar based on selected subcategory or products in current category
    const availableTags = useMemo(() => {
        const tagsSet = new Set();
        
        const matchedSub = subCategories.find(s => s.id === selectedSubCategory);
        if (matchedSub && Array.isArray(matchedSub.children) && matchedSub.children.length > 0) {
            matchedSub.children.forEach(c => tagsSet.add(c.name));
        } else {
            const activeProds = safeProducts.filter(p => {
                if (selectedSubCategory === 'all') return true;
                const subId = String(p.subcategoryId?._id || p.subcategoryId || '');
                return subId === selectedSubCategory;
            });

            activeProds.forEach(p => {
                const words = (p.name || '').split(/[\s,/-]+/);
                words.forEach(w => {
                    const clean = w.replace(/[^a-zA-Z]/g, '');
                    if (clean.length > 3 && !['with', 'pack', 'fresh', 'best', 'super', 'item', 'unit', 'gram', 'packet'].includes(clean.toLowerCase())) {
                        tagsSet.add(clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase());
                    }
                });
            });
        }
        return Array.from(tagsSet).slice(0, 10);
    }, [subCategories, selectedSubCategory, safeProducts]);

    // Filter and Sort Logic
    const filteredAndSortedProducts = useMemo(() => {
        let result = [...safeProducts];

        // 1. Subcategory Filter (Left Sidebar)
        if (selectedSubCategory !== 'all') {
            const matchedSub = subCategories.find(s => s.id === selectedSubCategory);
            const matchedSubNameNorm = matchedSub ? normalizeText(matchedSub.name) : '';

            result = result.filter(p => {
                const subId = String(p.subcategoryId?._id || p.subcategoryId || p.subCategory || '');
                const catIdObj = String(p.categoryId?._id || p.categoryId || '');
                if (subId === selectedSubCategory || catIdObj === selectedSubCategory) return true;

                const prodSubName = normalizeText(p.subcategoryName || p.subcategoryId?.name || '');
                if (prodSubName && matchedSubNameNorm && (prodSubName === matchedSubNameNorm || prodSubName.includes(matchedSubNameNorm))) {
                    return true;
                }
                return false;
            });
        }

        // 2. Tag Filter (Top Horizontal Pills)
        if (selectedTag !== 'all') {
            const tagLower = selectedTag.toLowerCase();
            result = result.filter(p => 
                (p.name || '').toLowerCase().includes(tagLower) ||
                (p.tags && p.tags.some(t => t.toLowerCase().includes(tagLower)))
            );
        }

        // 3. Search Query Filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(p =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.description || '').toLowerCase().includes(q) ||
                (p.weight || '').toLowerCase().includes(q)
            );
        }

        // 4. Sorting
        if (sortBy === 'price_desc') {
            result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
        } else if (sortBy === 'discount') {
            const getDiscount = (p) => {
                if (p.originalPrice > p.price) {
                    return ((p.originalPrice - p.price) / p.originalPrice) * 100;
                }
                return 0;
            };
            result.sort((a, b) => getDiscount(b) - getDiscount(a));
        } else if (sortBy === 'name') {
            result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }

        return result;
    }, [safeProducts, selectedSubCategory, selectedTag, searchQuery, sortBy]);

    return (
        <div className="bg-[#f8fafc] min-h-screen w-full flex flex-col font-sans select-none overflow-hidden">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white border-b border-slate-200/80 h-14 px-3 sm:px-4 flex items-center justify-between shadow-2xs">
                {isSearchOpen ? (
                    <div className="flex items-center gap-2 w-full animate-in fade-in duration-200">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search products in this category..."
                                className="w-full pl-9 pr-8 py-1.5 rounded-full bg-slate-100 text-xs sm:text-sm font-bold text-slate-800 outline-none border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                setIsSearchOpen(false);
                                setSearchQuery('');
                            }}
                            className="text-xs font-black text-slate-600 hover:text-slate-900 px-2 py-1"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2.5 min-w-0">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors flex items-center justify-center shrink-0"
                            >
                                <ChevronLeft size={22} className="text-slate-800" />
                            </button>
                            <div className="flex flex-col min-w-0">
                                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight truncate">
                                    {category?.name || catId}
                                </h1>
                                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">
                                    {filteredAndSortedProducts.length} products
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                className="p-2 text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                                title="Search"
                            >
                                <Search size={20} />
                            </button>
                        </div>
                    </>
                )}
            </header>

            {/* Main Body (Split into Left Subcategories Sidebar + Right Products Grid) */}
            <div className="flex-1 flex overflow-hidden h-[calc(100vh-3.5rem)]">
                {/* Left Sidebar: Subcategories (Blinkit Style) */}
                <aside className="w-20 sm:w-24 md:w-28 bg-slate-50/80 border-r border-slate-200/80 flex flex-col shrink-0 overflow-y-auto hide-scrollbar py-1 select-none">
                    {subCategories.map((sub) => {
                        const isActive = selectedSubCategory === sub.id;
                        return (
                            <button
                                key={sub.id}
                                onClick={() => {
                                    setSelectedSubCategory(sub.id);
                                    setSelectedTag('all');
                                }}
                                className={cn(
                                    "w-full py-2.5 px-1 flex flex-col items-center gap-1.5 transition-all relative cursor-pointer group",
                                    isActive
                                        ? "bg-white text-emerald-800 font-extrabold shadow-2xs"
                                        : "text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-100/60"
                                )}
                            >
                                {/* Active Indicator Bar on Left Edge */}
                                {isActive && (
                                    <motion.span 
                                        layoutId="activeSubCategoryBar"
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-9 bg-emerald-500 rounded-r-full" 
                                    />
                                )}

                                {/* Icon Circle */}
                                <div className={cn(
                                    "w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center p-1 transition-all overflow-hidden shrink-0",
                                    isActive
                                        ? "bg-emerald-50/90 border-2 border-emerald-500 shadow-xs scale-105"
                                        : "bg-white border border-slate-200/90 group-hover:border-slate-300"
                                )}>
                                    <img
                                        src={sub.icon}
                                        alt={sub.name}
                                        className="w-full h-full object-contain mix-blend-multiply"
                                        onError={(e) => { e.target.src = "https://cdn-icons-png.flaticon.com/128/2321/2321801.png"; }}
                                    />
                                </div>

                                {/* Title */}
                                <span className="text-[10px] sm:text-[11px] text-center leading-tight line-clamp-2 px-1 tracking-tight">
                                    {sub.name}
                                </span>
                            </button>
                        );
                    })}
                </aside>

                {/* Right Content Panel: Top Filter/Sort Pills + Product Grid */}
                <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
                    {/* Top Filter & Sort Bar */}
                    <div className="bg-white border-b border-slate-100 px-3 py-2 flex items-center gap-2 overflow-x-auto hide-scrollbar shrink-0 z-20">
                        {/* Sort Dropdown Button */}
                        <div className="relative shrink-0">
                            <button
                                onClick={() => setIsSortOpen(!isSortOpen)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap shadow-2xs",
                                    sortBy !== 'default'
                                        ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                )}
                            >
                                <ArrowUpDown size={13} className="shrink-0" />
                                <span>{SORT_OPTIONS.find(s => s.id === sortBy)?.label || 'Sort'}</span>
                            </button>

                            {/* Sort Popover Modal */}
                            {isSortOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)} />
                                    <div className="absolute left-0 mt-2 w-48 bg-white rounded-2xl border border-slate-200 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                                        <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                            Sort Products By
                                        </div>
                                        {SORT_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() => {
                                                    setSortBy(opt.id);
                                                    setIsSortOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 text-xs font-bold transition-colors flex items-center justify-between",
                                                    sortBy === opt.id
                                                        ? "bg-emerald-50 text-emerald-700"
                                                        : "text-slate-700 hover:bg-slate-50"
                                                )}
                                            >
                                                <span>{opt.label}</span>
                                                {sortBy === opt.id && <Check size={14} className="text-emerald-600" />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Level-2 / Quick Tag Filters */}
                        <button
                            onClick={() => setSelectedTag('all')}
                            className={cn(
                                "px-3 py-1.5 rounded-full border text-xs font-extrabold whitespace-nowrap transition-all shrink-0 cursor-pointer shadow-2xs",
                                selectedTag === 'all'
                                    ? "bg-slate-900 border-slate-900 text-white"
                                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            )}
                        >
                            All
                        </button>

                        {availableTags.map((tag) => (
                            <button
                                key={tag}
                                onClick={() => setSelectedTag(selectedTag === tag ? 'all' : tag)}
                                className={cn(
                                    "px-3 py-1.5 rounded-full border text-xs font-extrabold whitespace-nowrap transition-all shrink-0 cursor-pointer shadow-2xs",
                                    selectedTag === tag
                                        ? "bg-emerald-600 border-emerald-600 text-white"
                                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                )}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>

                    {/* Products Grid Area */}
                    <div className="flex-1 overflow-y-auto p-2.5 sm:p-3.5 bg-slate-50/50">
                        {isLoading ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="h-64 rounded-2xl bg-slate-200/60 animate-pulse" />
                                ))}
                            </div>
                        ) : filteredAndSortedProducts.length === 0 ? (
                            <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                                <div className="w-48 h-48 mb-4">
                                    {noServiceData ? (
                                        <Lottie animationData={noServiceData} loop={true} />
                                    ) : (
                                        <div className="w-48 h-48 bg-slate-100 rounded-full" />
                                    )}
                                </div>
                                <h3 className="text-lg font-black text-slate-800 mb-1">
                                    No Products Found
                                </h3>
                                <p className="text-xs text-slate-500 font-semibold max-w-xs mb-4">
                                    No items match your selected filters or search query in this category.
                                </p>
                                <button
                                    onClick={() => {
                                        setSelectedSubCategory('all');
                                        setSelectedTag('all');
                                        setSearchQuery('');
                                        setSortBy('default');
                                    }}
                                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-600/20"
                                >
                                    Reset Filters
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3 pb-24">
                                {filteredAndSortedProducts.map((product) => (
                                    <ProductCard key={product.id || product._id} product={product} layout="grid" />
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <MiniCart />
            <ProductDetailSheet />

            <style dangerouslySetInnerHTML={{
                __html: `
                    .hide-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                    .hide-scrollbar {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `}} />
        </div>
    );
};

export default CategoryProductsPage;


