import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Search, ShoppingCart, ArrowUpDown, SlidersHorizontal, X, Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

import ProductCard from '../components/shared/ProductCard';
import FlipkartCatalogCard from '../components/shared/FlipkartCatalogCard';
import ProductDetailSheet from '../components/shared/ProductDetailSheet';
import { useProductDetail } from '../context/ProductDetailContext';
import { customerApi } from '../services/customerApi';
import MiniCart from '../components/shared/MiniCart';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { useSettings } from '@core/context/SettingsContext';
import Lottie from 'lottie-react';

const SORT_OPTIONS = [
    { id: 'default', label: 'Relevance' },
    { id: 'price_asc', label: 'Price – Low to High' },
    { id: 'price_desc', label: 'Price – High to Low' },
    { id: 'discount', label: 'Discount' },
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
    const { groceryCartCount } = useCart();
    const { openProduct } = useProductDetail();
    const initialSubcategoryId = location.state?.activeSubcategoryId || 'all';

    const [selectedSubCategory, setSelectedSubCategory] = useState(initialSubcategoryId);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [sortBy, setSortBy] = useState('default');
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const [category, setCategory] = useState(null);
    const [subCategories, setSubCategories] = useState([{ id: 'all', name: 'All', icon: '' }]);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [noServiceData, setNoServiceData] = useState(null);

    const sidebarRef = useRef(null);
    const searchInputRef = useRef(null);
    const productGridRef = useRef(null);

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

            // 1. Fetch category tree to resolve hierarchy and subcategories
            const catRes = await customerApi.getCategories({ tree: true });
            const tree = catRes.data?.results || catRes.data?.result || [];

            let targetCategory = null;
            let targetSubCategory = null;
            let matchedLevel = 'unknown'; // 'header' | 'category' | 'subcategory'

            if (isAllCategory) {
                targetCategory = { _id: 'all', name: "All Products", children: [] };
                matchedLevel = 'all';
            } else {
                // Walk the tree to find the matching category at any level
                for (const header of tree) {
                    if (matchCategoryItem(header, catId)) {
                        targetCategory = header;
                        matchedLevel = 'header';
                        break;
                    }
                    for (const cat of (header.children || [])) {
                        if (matchCategoryItem(cat, catId)) {
                            targetCategory = cat;
                            matchedLevel = 'category';
                            break;
                        }
                        for (const sub of (cat.children || [])) {
                            if (matchCategoryItem(sub, catId)) {
                                targetCategory = cat;
                                targetSubCategory = sub;
                                matchedLevel = 'subcategory';
                                break;
                            }
                        }
                        if (targetCategory) break;
                    }
                    if (targetCategory) break;
                }
            }

            // Fallback if not found in tree
            if (!targetCategory && !isAllCategory) {
                targetCategory = { _id: catId, name: catId, children: [] };
                matchedLevel = 'category'; // assume category level
            }

            setCategory({ id: targetCategory?._id || catId, name: targetCategory?.name || catId });

            // Build subcategories for the sidebar
            if (isAllCategory) {
                const allSubs = [];
                tree.forEach(header => {
                    (header.children || []).forEach(c => {
                        allSubs.push({
                            id: c._id,
                            name: c.name,
                            icon: c.image || '',
                            children: c.children || []
                        });
                    });
                });
                setSubCategories([{ id: 'all', name: 'All', icon: targetCategory?.image || '' }, ...allSubs]);
            } else if (targetCategory) {
                const subs = (targetCategory.children || []).map(s => ({
                    id: s._id,
                    name: s.name,
                    icon: s.image || s.icon || '',
                    children: s.children || []
                }));
                setSubCategories([{ id: 'all', name: 'All', icon: targetCategory.image || '' }, ...subs]);
            }

            if (targetSubCategory) {
                setSelectedSubCategory(targetSubCategory._id);
            }

            // 2. Build product API params — use the RIGHT parameter based on hierarchy level
            const productParams = { limit: 200 };
            if (targetCategory?._id && targetCategory._id !== 'all') {
                if (matchedLevel === 'header') {
                    // Header level → use headerId param so backend fetches all children
                    productParams.headerId = targetCategory._id;
                } else {
                    // Category or subcategory level → use categoryId
                    productParams.categoryId = targetCategory._id;
                }
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

                // Build a set of valid IDs (targetCategory + all its children at every level + parent)
                const validCategoryIds = new Set();
                if (targetCategory && targetCategory._id !== 'all') {
                    validCategoryIds.add(String(targetCategory._id));
                    if (targetCategory.parentId) validCategoryIds.add(String(targetCategory.parentId));
                    (targetCategory.children || []).forEach(sub => {
                        validCategoryIds.add(String(sub._id));
                        (sub.children || []).forEach(child => validCategoryIds.add(String(child._id)));
                    });
                }

                const categoryProducts = formattedProds.filter(p => {
                    // "All" mode — show everything
                    if (!targetCategory || targetCategory._id === 'all') return true;

                    // Extract all category references from the product
                    const prodCatId = String(p.categoryId?._id || p.categoryId || '');
                    const prodSubId = String(p.subcategoryId?._id || p.subcategoryId || '');
                    const prodHeadId = String(p.headerId?._id || p.headerId || '');

                    // Match against valid IDs (category + all subcategories + header + parent)
                    if (validCategoryIds.has(prodCatId) || validCategoryIds.has(prodSubId) || validCategoryIds.has(prodHeadId)) {
                        return true;
                    }

                    // Name-based fuzzy match as fallback
                    const targetCatNameNorm = normalizeText(targetCategory.name);
                    const prodCatName = normalizeText(p.categoryId?.name || '');
                    const prodHeadName = normalizeText(p.headerId?.name || '');
                    const prodSubName = normalizeText(p.subcategoryId?.name || '');
                    if (targetCatNameNorm && (
                        prodCatName === targetCatNameNorm ||
                        prodCatName.includes(targetCatNameNorm) ||
                        targetCatNameNorm.includes(prodCatName) ||
                        prodSubName === targetCatNameNorm ||
                        prodSubName.includes(targetCatNameNorm) ||
                        targetCatNameNorm.includes(prodSubName) ||
                        prodHeadName === targetCatNameNorm ||
                        prodHeadName.includes(targetCatNameNorm) ||
                        targetCatNameNorm.includes(prodHeadName)
                    )) {
                        return true;
                    }

                    return false;
                });

                // Set products (use filtered products, or fallback to formattedProds if API already filtered)
                setProducts(categoryProducts.length > 0 ? categoryProducts : formattedProds);
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
    }, [catId, location.state?.activeSubcategoryId, currentLocation?.latitude, currentLocation?.longitude]);

    // Scroll horizontal subcategory active item into view
    useEffect(() => {
        if (sidebarRef.current) {
            const activeEl = sidebarRef.current.querySelector('[data-active="true"]');
            if (activeEl) {
                activeEl.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedSubCategory]);

    // Scroll product grid to top when subcategory changes
    useEffect(() => {
        if (productGridRef.current) {
            productGridRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [selectedSubCategory]);

    const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);

    // Filter and Sort Logic
    const filteredAndSortedProducts = useMemo(() => {
        let result = [...safeProducts];

        // 1. Subcategory Filter (Left Sidebar)
        if (selectedSubCategory !== 'all') {
            const matchedSub = subCategories.find(s => s.id === selectedSubCategory);
            const matchedSubNameNorm = matchedSub ? normalizeText(matchedSub.name) : '';

            // Collect all child IDs of the selected subcategory for broader matching
            const matchedChildIds = new Set([selectedSubCategory]);
            if (matchedSub?.children) {
                matchedSub.children.forEach(child => {
                    matchedChildIds.add(String(child._id || child.id || ''));
                });
            }

            result = result.filter(p => {
                const subId = String(p.subcategoryId?._id || p.subcategoryId || p.subCategory || '');
                const catIdObj = String(p.categoryId?._id || p.categoryId || '');
                const headId = String(p.headerId?._id || p.headerId || '');

                // Direct ID match at any level
                if (matchedChildIds.has(subId) || matchedChildIds.has(catIdObj) || catIdObj === selectedSubCategory || subId === selectedSubCategory) {
                    return true;
                }

                // Name-based fallback
                const prodSubName = normalizeText(p.subcategoryId?.name || '');
                const prodCatName = normalizeText(p.categoryId?.name || '');
                if (matchedSubNameNorm && (
                    prodSubName === matchedSubNameNorm ||
                    prodSubName.includes(matchedSubNameNorm) ||
                    prodCatName === matchedSubNameNorm ||
                    prodCatName.includes(matchedSubNameNorm)
                )) {
                    return true;
                }
                return false;
            });
        }

        // 2. Search Query Filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(p =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.description || '').toLowerCase().includes(q) ||
                (p.weight || '').toLowerCase().includes(q)
            );
        }

        // 3. Sorting
        if (sortBy === 'price_asc') {
            result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        } else if (sortBy === 'price_desc') {
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
    }, [safeProducts, selectedSubCategory, searchQuery, sortBy]);

    const handleSubCategoryClick = useCallback((subId) => {
        setSelectedSubCategory(subId);
    }, []);

    return (
        <div className="fk-category-page">
            {/* ── Flipkart-style Blue Header ── */}
            <header className="fk-category-header">
                <div className="fk-header-top">
                    <button
                        onClick={() => navigate(-1)}
                        className="fk-header-back"
                        aria-label="Go back"
                    >
                        <ChevronLeft size={24} strokeWidth={2.5} />
                    </button>

                    <div className="fk-search-bar">
                        <Search size={18} className="fk-search-icon" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setIsSearchFocused(false)}
                            placeholder="Search for products"
                            className="fk-search-input"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="fk-search-clear"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => navigate('/cart')}
                        className="fk-header-cart"
                        aria-label="Open cart"
                    >
                        <ShoppingCart size={24} strokeWidth={2} />
                        {groceryCartCount > 0 && (
                            <span className="fk-cart-badge">{groceryCartCount}</span>
                        )}
                    </button>
                </div>
            </header>

            {/* ── Top Horizontal Round Subcategories Row ── */}
            {subCategories && subCategories.length > 0 && (
                <div className="fk-subcat-section">
                    <div ref={sidebarRef} className="fk-subcat-scroll">
                        {subCategories.map((sub) => {
                            const isActive = selectedSubCategory === sub.id;
                            return (
                                <button
                                    key={sub.id}
                                    type="button"
                                    data-active={isActive}
                                    onClick={() => handleSubCategoryClick(sub.id)}
                                    className={cn(
                                        "fk-subcat-btn",
                                        isActive && "fk-subcat-btn--active"
                                    )}
                                >
                                    <div className={cn(
                                        "fk-subcat-round",
                                        isActive && "fk-subcat-round--active"
                                    )}>
                                        {sub.icon ? (
                                            <img
                                                src={applyCloudinaryTransform(sub.icon, 'f_auto,q_auto,w_120')}
                                                alt={sub.name}
                                                className="fk-subcat-img"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <span className="fk-subcat-placeholder">
                                                {sub.name === 'All' ? 'All' : sub.name.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <span className={cn(
                                        "fk-subcat-name",
                                        isActive && "fk-subcat-name--active"
                                    )}>
                                        {sub.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Sort & Filter Bar ── */}
            <div className="fk-sort-filter-bar">
                <button
                    onClick={() => {
                        setIsSortOpen(!isSortOpen);
                        setIsFilterOpen(false);
                    }}
                    className={cn(
                        "fk-sf-button",
                        sortBy !== 'default' && "fk-sf-button--active"
                    )}
                >
                    <ArrowUpDown size={14} />
                    <span>Sort</span>
                </button>

                <div className="fk-sf-divider" />

                <button
                    onClick={() => {
                        setIsFilterOpen(!isFilterOpen);
                        setIsSortOpen(false);
                    }}
                    className="fk-sf-button"
                >
                    <SlidersHorizontal size={14} />
                    <span>Filter</span>
                </button>
            </div>

            {/* Sort Dropdown */}
            <AnimatePresence>
                {isSortOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fk-overlay"
                            onClick={() => setIsSortOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15 }}
                            className="fk-sort-dropdown"
                        >
                            <div className="fk-sort-title">SORT BY</div>
                            {SORT_OPTIONS.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => {
                                        setSortBy(opt.id);
                                        setIsSortOpen(false);
                                    }}
                                    className={cn(
                                        "fk-sort-option",
                                        sortBy === opt.id && "fk-sort-option--active"
                                    )}
                                >
                                    <span>{opt.label}</span>
                                    {sortBy === opt.id && (
                                        <Check size={16} className="fk-sort-check" />
                                    )}
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Products Grid */}
            <div ref={productGridRef} className="fk-products-grid-container">
                {isLoading ? (
                    <div className="fk-skeleton-grid">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="fk-skeleton-card">
                                <div className="fk-skeleton-image" />
                                <div className="fk-skeleton-lines">
                                    <div className="fk-skeleton-line fk-skeleton-line--long" />
                                    <div className="fk-skeleton-line fk-skeleton-line--medium" />
                                    <div className="fk-skeleton-line fk-skeleton-line--short" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredAndSortedProducts.length === 0 ? (
                    <div className="fk-empty-state">
                        <div className="fk-empty-lottie">
                            {noServiceData ? (
                                <Lottie animationData={noServiceData} loop={true} />
                            ) : (
                                <div className="fk-empty-circle" />
                            )}
                        </div>
                        <h3 className="fk-empty-title">No Products Found</h3>
                        <p className="fk-empty-desc">
                            No items match your selected filters in this category.
                        </p>
                        <button
                            onClick={() => {
                                setSelectedSubCategory('all');
                                setSearchQuery('');
                                setSortBy('default');
                            }}
                            className="fk-empty-reset"
                        >
                            Reset Filters
                        </button>
                    </div>
                ) : (
                    <div className="fk-products-grid grid grid-cols-3 gap-1.5 p-1.5 pb-16 w-full max-w-full">
                        {filteredAndSortedProducts.map((product) => (
                            <FlipkartCatalogCard
                                key={product.id || product._id}
                                product={product}
                                onProductClick={openProduct}
                            />
                        ))}
                    </div>
                )}
            </div>

            <MiniCart />
            <ProductDetailSheet />

            {/* ── Scoped Styles ── */}
            <style dangerouslySetInnerHTML={{
                __html: `
                /* ─── Page Container (Locked to viewport between header & bottom nav) ─── */
                .fk-category-page {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));
                    display: flex;
                    flex-direction: column;
                    background: #ffffff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    -webkit-font-smoothing: antialiased;
                    overflow: hidden;
                    z-index: 40;
                }
                @media (min-width: 768px) {
                    .fk-category-page {
                        bottom: 0;
                    }
                }

                /* ─── Skyblue Header ─── */
                .fk-category-header {
                    flex-shrink: 0;
                    height: 56px;
                    z-index: 20;
                    background: #0ea5e9;
                    box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25);
                }

                .fk-header-top {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 12px;
                    height: 56px;
                }

                .fk-header-back {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    color: #fff;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    flex-shrink: 0;
                    transition: background 0.15s;
                }
                .fk-header-back:active {
                    background: rgba(255,255,255,0.15);
                }

                /* ─── Search Bar (Rounded, White) ─── */
                .fk-search-bar {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    background: #fff;
                    border-radius: 24px;
                    padding: 0 14px;
                    height: 38px;
                    gap: 8px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
                }

                .fk-search-icon {
                    color: #878787;
                    flex-shrink: 0;
                }

                .fk-search-input {
                    flex: 1;
                    border: none;
                    outline: none;
                    background: transparent;
                    font-size: 14px;
                    color: #212121;
                    font-weight: 400;
                    min-width: 0;
                }
                .fk-search-input::placeholder {
                    color: #878787;
                    font-weight: 400;
                }

                .fk-search-clear {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #878787;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 2px;
                }

                /* ─── Cart Icon ─── */
                .fk-header-cart {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    color: #fff;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    flex-shrink: 0;
                    border-radius: 50%;
                    transition: background 0.15s;
                }
                .fk-header-cart:active {
                    background: rgba(255,255,255,0.15);
                }

                .fk-cart-badge {
                    position: absolute;
                    top: 2px;
                    right: 1px;
                    min-width: 18px;
                    height: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #ff6161;
                    color: #fff;
                    font-size: 10px;
                    font-weight: 700;
                    border-radius: 9px;
                    padding: 0 4px;
                    line-height: 1;
                    border: 1.5px solid #2874f0;
                }

                /* ─── Horizontal Subcategories Row (Round shape above products) ─── */
                .fk-subcat-section {
                    flex-shrink: 0;
                    width: 100%;
                    background: #ffffff;
                    border-bottom: 1px solid #f1f3f6;
                    padding: 8px 0 6px;
                    z-index: 15;
                }

                .fk-subcat-scroll {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    overflow-x: auto;
                    overflow-y: hidden;
                    padding: 0 12px;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    -webkit-overflow-scrolling: touch;
                    scroll-behavior: smooth;
                }
                .fk-subcat-scroll::-webkit-scrollbar {
                    display: none;
                }

                .fk-subcat-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 60px;
                    min-width: 60px;
                    gap: 4px;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    padding: 2px 0;
                    outline: none;
                    transition: transform 0.15s ease;
                    -webkit-tap-highlight-color: transparent;
                }
                .fk-subcat-btn:active {
                    transform: scale(0.95);
                }

                .fk-subcat-round {
                    width: 52px;
                    height: 52px;
                    border-radius: 50%;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #eff5ff;
                    border: 1.5px solid #dbeafe;
                    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.05);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    flex-shrink: 0;
                }
                .fk-subcat-round--active {
                    border-color: #2874f0;
                    background: #e0edfd;
                    box-shadow: 0 0 0 2px rgba(40, 116, 240, 0.25);
                    transform: translateY(-1px);
                }

                .fk-subcat-img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    padding: 4px;
                    mix-blend-mode: multiply;
                }

                .fk-subcat-placeholder {
                    font-size: 13px;
                    font-weight: 700;
                    color: #2874f0;
                    line-height: 1;
                }

                .fk-subcat-name {
                    font-size: 10.5px;
                    font-weight: 500;
                    color: #4b5563;
                    text-align: center;
                    line-height: 1.2;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    word-break: break-word;
                    max-width: 60px;
                    transition: color 0.15s;
                }
                .fk-subcat-name--active {
                    color: #2874f0;
                    font-weight: 700;
                }

                /* ─── Sort & Filter Bar ─── */
                .fk-sort-filter-bar {
                    display: flex;
                    align-items: center;
                    background: #fff;
                    border-bottom: 1px solid #e0e0e0;
                    height: 44px;
                    min-height: 44px;
                    flex-shrink: 0;
                    z-index: 10;
                }

                .fk-sf-button {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    height: 100%;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    color: #212121;
                    transition: color 0.15s;
                }
                .fk-sf-button:active {
                    background: #f5f5f5;
                }
                .fk-sf-button--active {
                    color: #2874f0;
                }

                .fk-sf-divider {
                    width: 1px;
                    height: 24px;
                    background: #e0e0e0;
                    flex-shrink: 0;
                }

                /* ─── Sort Dropdown ─── */
                .fk-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 50;
                    background: rgba(0,0,0,0.25);
                }

                .fk-sort-dropdown {
                    position: absolute;
                    top: 44px;
                    left: 0;
                    right: 0;
                    background: #fff;
                    z-index: 60;
                    border-bottom: 1px solid #e0e0e0;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
                }

                .fk-sort-title {
                    padding: 12px 16px 8px;
                    font-size: 11px;
                    font-weight: 700;
                    color: #878787;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #f0f0f0;
                }

                .fk-sort-option {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #212121;
                    background: none;
                    border: none;
                    border-bottom: 1px solid #f5f5f5;
                    cursor: pointer;
                    text-align: left;
                    transition: background 0.1s;
                }
                .fk-sort-option:last-child {
                    border-bottom: none;
                }
                .fk-sort-option:active {
                    background: #f5f5f5;
                }
                .fk-sort-option--active {
                    color: #2874f0;
                    font-weight: 600;
                    background: #f5f9ff;
                }

                .fk-sort-check {
                    color: #2874f0;
                    flex-shrink: 0;
                }

                /* ─── Products Grid Area (Independently scrollable) ─── */
                .fk-products-grid-container {
                    flex: 1;
                    min-height: 0;
                    height: 100%;
                    max-height: 100%;
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding: 0;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    overscroll-behavior-y: contain;
                    -webkit-overflow-scrolling: touch;
                    touch-action: pan-y;
                    background: #ffffff;
                }
                .fk-products-grid-container::-webkit-scrollbar {
                    display: none;
                }

                .fk-products-grid {
                    display: grid !important;
                    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                    gap: 8px 6px !important;
                    padding: 8px 6px 40px !important;
                    background: #ffffff !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                }

                /* ─── Skeleton Loading (3 columns) ─── */
                .fk-skeleton-grid {
                    display: grid !important;
                    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                    gap: 8px 6px !important;
                    padding: 8px 6px 40px !important;
                    background: #ffffff !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                }

                .fk-skeleton-card {
                    background: #fff;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
                }

                .fk-skeleton-image {
                    width: 100%;
                    aspect-ratio: 1;
                    background: linear-gradient(110deg, #f0f0f0 25%, #e0e0e0 37%, #f0f0f0 63%);
                    background-size: 200% 100%;
                    animation: fk-shimmer 1.4s ease infinite;
                }

                .fk-skeleton-lines {
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .fk-skeleton-line {
                    height: 10px;
                    border-radius: 4px;
                    background: linear-gradient(110deg, #f0f0f0 25%, #e0e0e0 37%, #f0f0f0 63%);
                    background-size: 200% 100%;
                    animation: fk-shimmer 1.4s ease infinite;
                }
                .fk-skeleton-line--long { width: 90%; }
                .fk-skeleton-line--medium { width: 65%; }
                .fk-skeleton-line--short { width: 40%; }

                @keyframes fk-shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }

                /* ─── Empty State ─── */
                .fk-empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 40px 24px;
                    min-height: 60vh;
                }

                .fk-empty-lottie {
                    width: 160px;
                    height: 160px;
                    margin-bottom: 16px;
                }

                .fk-empty-circle {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background: #f0f0f0;
                }

                .fk-empty-title {
                    font-size: 17px;
                    font-weight: 700;
                    color: #212121;
                    margin-bottom: 4px;
                }

                .fk-empty-desc {
                    font-size: 13px;
                    color: #878787;
                    max-width: 260px;
                    margin-bottom: 20px;
                    line-height: 1.4;
                }

                .fk-empty-reset {
                    padding: 10px 28px;
                    border-radius: 4px;
                    background: #2874f0;
                    color: #fff;
                    font-size: 14px;
                    font-weight: 600;
                    border: none;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(40,116,240,0.25);
                    transition: background 0.15s;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .fk-empty-reset:active {
                    background: #1a5dc8;
                }

                /* ─── Responsive ─── */
                @media (min-width: 640px) {
                    .fk-subcat-btn {
                        width: 68px;
                        min-width: 68px;
                    }
                    .fk-subcat-round {
                        width: 58px;
                        height: 58px;
                    }
                    .fk-subcat-name {
                        font-size: 11px;
                        max-width: 68px;
                    }
                    .fk-products-grid, .fk-skeleton-grid {
                        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                        gap: 10px 8px !important;
                        padding: 10px 8px 40px !important;
                    }
                }

                @media (min-width: 768px) {
                    .fk-products-grid, .fk-skeleton-grid {
                        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                        gap: 12px 10px !important;
                        padding: 12px 10px 40px !important;
                    }
                }

                @media (min-width: 1024px) {
                    .fk-subcat-btn {
                        width: 74px;
                        min-width: 74px;
                    }
                    .fk-subcat-round {
                        width: 62px;
                        height: 62px;
                    }
                    .fk-products-grid, .fk-skeleton-grid {
                        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
                        gap: 16px 12px !important;
                        padding: 16px 14px 40px !important;
                    }
                }
                `}} />
        </div>
    );
};

export default CategoryProductsPage;
