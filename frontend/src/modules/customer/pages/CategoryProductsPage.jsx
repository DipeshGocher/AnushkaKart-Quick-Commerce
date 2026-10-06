import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, ShoppingCart, Star, Heart, ImageOff, RotateCcw, LayoutGrid, ShoppingBag, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform, isPngImage } from '@/core/utils/imageUtils';
import { getProductUrl, slugify, getProductVariantText } from '@/core/utils/productUrl';
import CategoryIcon from '@shared/components/CategoryIcon';
import ProductDetailSheet from '../components/shared/ProductDetailSheet';
import { useProductDetail } from '../context/ProductDetailContext';
import { customerApi } from '../services/customerApi';
import MiniCart from '../components/shared/MiniCart';
import ProductCard from '../components/shared/ProductCard';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { useSettings } from '@core/context/SettingsContext';

const normalizeCategoryParam = (val = '') => {
  if (!val) return '';
  return decodeURIComponent(String(val))
    .toLowerCase()
    .trim()
    .replace(/&+/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const matchesCategory = (categoryObj, paramVal) => {
  if (!categoryObj || !paramVal) return false;
  const target = normalizeCategoryParam(paramVal);
  if (!target) return false;

  const bySlug = normalizeCategoryParam(categoryObj.slug);
  const byName = normalizeCategoryParam(categoryObj.name);
  const bySlugifiedName = normalizeCategoryParam(slugify(categoryObj.name));
  const rawId = String(categoryObj._id || categoryObj.id || '').toLowerCase();
  const rawParam = decodeURIComponent(String(paramVal)).toLowerCase().trim();

  if (
    target === bySlug ||
    target === byName ||
    target === bySlugifiedName ||
    rawParam === rawId ||
    target.replace(/-and-/g, '-') === bySlug.replace(/-and-/g, '-') ||
    target.replace(/-and-/g, '-') === byName.replace(/-and-/g, '-')
  ) {
    return true;
  }

  // Substring matching for terms like 'dal' in 'dal-pulses'
  if (target.length >= 3 && (bySlug.includes(target) || byName.includes(target) || target.includes(bySlug))) {
    return true;
  }

  return false;
};

const formatPrice = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const CategoryProductsPage = () => {
  const {
    headerCategory: routeHeaderParam,
    mainCategory: routeMainParam,
    subCategory: routeSubParam,
    categoryName: routeLegacyParam,
  } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentLocation } = useAppLocation();
  const { settings } = useSettings();
  const { cartCount } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { openProduct } = useProductDetail();

  // State
  const [allCategoriesTree, setAllCategoriesTree] = useState([]);
  const [headerCategories, setHeaderCategories] = useState([]);
  const [activeHeader, setActiveHeader] = useState(null);
  const [mainCategories, setMainCategories] = useState([]);
  const [selectedMainCatId, setSelectedMainCatId] = useState('all');
  const [selectedSubCatId, setSelectedSubCatId] = useState('all');
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(true);

  const selectedSubCatRef = useRef(null);

  // 1. Initial Load: Fetch category tree
  useEffect(() => {
    let isMounted = true;
    const fetchTree = async () => {
      try {
        setIsLoading(true);
        const res = await customerApi.getCategories({ tree: true });
        const tree = res?.data?.results || res?.data?.result || res?.data?.data || [];
        if (!isMounted) return;

        setAllCategoriesTree(tree);

        // Header categories are top-level or items with type === 'header'
        const headers = tree.filter(
          (c) => c.type === 'header' || (!c.parentId && c.slug !== 'all' && c.name?.toLowerCase() !== 'all')
        );
        setHeaderCategories(headers);
      } catch (err) {
        console.error('Failed to load category tree:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchTree();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Resolve Active Header, Main Category, and Subcategory
  useEffect(() => {
    if (!allCategoriesTree.length) return;

    let matchedHeader = null;
    let preselectedMain = 'all';
    let preselectedSub = 'all';

    const headerTarget = routeHeaderParam || (!routeMainParam ? routeLegacyParam : null);

    if (headerTarget) {
      matchedHeader = allCategoriesTree.find((h) => matchesCategory(h, headerTarget));
    }

    // If not found yet and legacyParam exists, check if legacyParam matches a category or subcategory
    if (!matchedHeader && routeLegacyParam) {
      for (const header of allCategoriesTree) {
        if (matchesCategory(header, routeLegacyParam)) {
          matchedHeader = header;
          break;
        }
        for (const cat of header.children || []) {
          if (matchesCategory(cat, routeLegacyParam)) {
            matchedHeader = header;
            preselectedMain = cat._id || cat.id;
            break;
          }
          for (const sub of cat.children || []) {
            if (matchesCategory(sub, routeLegacyParam)) {
              matchedHeader = header;
              preselectedMain = cat._id || cat.id;
              preselectedSub = sub._id || sub.id;
              break;
            }
          }
          if (matchedHeader) break;
        }
        if (matchedHeader) break;
      }
    }

    // Default to first header if not found
    if (!matchedHeader && headerCategories.length > 0) {
      matchedHeader = headerCategories[0];
    }

    if (matchedHeader) {
      setActiveHeader(matchedHeader);
      const children = matchedHeader.children || [];
      setMainCategories(children);

      // Resolve Main Category ID
      let activeMainId = 'all';
      if (routeMainParam) {
        const foundMain = children.find((mc) => matchesCategory(mc, routeMainParam));
        if (foundMain) {
          activeMainId = foundMain._id || foundMain.id;
        }
      } else if (location.state?.activeMainCategoryId) {
        activeMainId = location.state.activeMainCategoryId;
      } else if (preselectedMain !== 'all') {
        activeMainId = preselectedMain;
      } else if (children.length > 0) {
        activeMainId = children[0]._id || children[0].id;
      }
      setSelectedMainCatId(activeMainId);

      // Resolve Subcategory ID
      const querySub = searchParams.get('sub') || routeSubParam || location.state?.subCategorySlug || null;
      let activeSubId = 'all';

      if (querySub || location.state?.activeSubcategoryId || preselectedSub !== 'all') {
        const candidate = querySub || location.state?.activeSubcategoryId || preselectedSub;
        const activeMain = children.find((mc) => String(mc._id || mc.id) === String(activeMainId));
        const subList = activeMain?.children?.length
          ? activeMain.children
          : children.flatMap((mc) => mc.children || []);

        const foundSub = subList.find(
          (s) =>
            matchesCategory(s, candidate) ||
            String(s._id || s.id).toLowerCase() === String(candidate).toLowerCase()
        );
        if (foundSub) {
          activeSubId = foundSub._id || foundSub.id;
        } else if (location.state?.activeSubcategoryId) {
          activeSubId = location.state.activeSubcategoryId;
        }
      }
      setSelectedSubCatId(activeSubId);
    }
  }, [
    routeHeaderParam,
    routeMainParam,
    routeSubParam,
    routeLegacyParam,
    allCategoriesTree,
    headerCategories,
    searchParams,
    location.state,
  ]);

  // 3. Fetch Products for Active Header / Category
  useEffect(() => {
    // If a route main parameter is specified, wait until that main category ID has resolved
    if (routeMainParam && (!selectedMainCatId || selectedMainCatId === 'all')) return;
    if (!activeHeader?._id && (!selectedMainCatId || selectedMainCatId === 'all')) return;

    let isMounted = true;
    const fetchCategoryProducts = async () => {
      try {
        setIsProductsLoading(true);
        const params = {
          limit: 100,
          allProducts: 'true',
        };
        if (selectedMainCatId && selectedMainCatId !== 'all') {
          params.categoryId = selectedMainCatId;
        } else if (activeHeader?._id) {
          params.headerId = activeHeader._id;
        }
        if (Number.isFinite(currentLocation?.latitude) && Number.isFinite(currentLocation?.longitude)) {
          params.lat = currentLocation.latitude;
          params.lng = currentLocation.longitude;
        }

        const res = await customerApi.getProducts(params);
        if (isMounted) {
          const data = res?.data || res;
          const rawResult = data?.result;
          const items = Array.isArray(data?.results)
            ? data.results
            : Array.isArray(rawResult?.items)
            ? rawResult.items
            : Array.isArray(rawResult?.products)
            ? rawResult.products
            : Array.isArray(rawResult)
            ? rawResult
            : Array.isArray(data?.products)
            ? data.products
            : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data)
            ? data
            : [];
          setProducts(items);
        }
      } catch (err) {
        console.error('Failed to load products for category:', err);
        if (isMounted) setProducts([]);
      } finally {
        if (isMounted) setIsProductsLoading(false);
      }
    };

    fetchCategoryProducts();
    return () => {
      isMounted = false;
    };
  }, [activeHeader?._id, selectedMainCatId, routeMainParam, currentLocation?.latitude, currentLocation?.longitude]);

  // Active Main Category Object
  const activeMainCategory = useMemo(() => {
    if (!mainCategories.length) return null;
    return mainCategories.find(
      (c) => String(c._id || c.id) === String(selectedMainCatId)
    ) || (selectedMainCatId === 'all' ? null : mainCategories[0]);
  }, [mainCategories, selectedMainCatId]);

  // 4. Compute Subcategories for the Round Shape Filter
  const availableSubCategories = useMemo(() => {
    if (!mainCategories.length) return [];
    if (selectedMainCatId && selectedMainCatId !== 'all') {
      const selectedMain = mainCategories.find(
        (c) => String(c._id || c.id) === String(selectedMainCatId)
      );
      return selectedMain?.children || [];
    }
    // If all main categories, gather subcategories of all main categories
    const allSubs = [];
    mainCategories.forEach((mc) => {
      if (Array.isArray(mc.children)) {
        allSubs.push(...mc.children);
      }
    });
    return allSubs;
  }, [mainCategories, selectedMainCatId]);

  // Active Subcategory Object
  const selectedSubCategory = useMemo(() => {
    if (selectedSubCatId === 'all') return null;
    return availableSubCategories.find(
      (s) => String(s._id || s.id) === String(selectedSubCatId)
    );
  }, [availableSubCategories, selectedSubCatId]);

  // Auto-scroll to selected round subcategory filter on selection change
  useEffect(() => {
    if (selectedSubCatRef.current) {
      selectedSubCatRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedSubCatId]);

  // 5. Filter Products by Selected Main Category, Subcategory, AND Search Query
  const filteredProducts = useMemo(() => {
    let list = products;

    // Filter by Subcategory if a specific subcategory is selected
    if (selectedSubCatId && selectedSubCatId !== 'all') {
      const targetSubId = String(selectedSubCatId);
      const selectedSubObj = availableSubCategories.find((s) => String(s._id || s.id) === targetSubId);
      const subName = selectedSubObj?.name?.toLowerCase().trim();
      const subSlug = selectedSubObj?.slug?.toLowerCase().trim();

      list = list.filter((p) => {
        const pCat = String(p.categoryId?._id || p.categoryId || p.category?._id || p.category || '');
        const pSub = String(p.subcategoryId?._id || p.subcategoryId || p.subcategory?._id || p.subcategory || '');
        const pSubName = String(p.subcategoryId?.name || '').toLowerCase().trim();
        const pSubSlug = String(p.subcategoryId?.slug || '').toLowerCase().trim();

        return (
          pSub === targetSubId ||
          pCat === targetSubId ||
          (subName && pSubName === subName) ||
          (subSlug && (pSubSlug === subSlug || pSubName.includes(subSlug)))
        );
      });
    }

    // Live search inside this category
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const name = String(p.name || '').toLowerCase();
        const brand = String(p.brand || '').toLowerCase();
        const desc = String(p.description || '').toLowerCase();
        const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : String(p.tags || '').toLowerCase();
        return name.includes(q) || brand.includes(q) || desc.includes(q) || tags.includes(q);
      });
    }

    return list;
  }, [products, selectedSubCatId, availableSubCategories, searchQuery]);

  // Backend search fallback on Enter to fetch all matching category products
  const handleSearchKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = searchQuery.trim();
      if (!q) return;

      try {
        setIsProductsLoading(true);
        const params = {
          search: q,
          headerId: activeHeader?._id,
          limit: 100,
        };
        if (selectedMainCatId && selectedMainCatId !== 'all') {
          params.categoryId = selectedMainCatId;
        }
        if (selectedSubCatId && selectedSubCatId !== 'all') {
          params.subcategoryId = selectedSubCatId;
        }
        if (Number.isFinite(currentLocation?.latitude) && Number.isFinite(currentLocation?.longitude)) {
          params.lat = currentLocation.latitude;
          params.lng = currentLocation.longitude;
        }

        const res = await customerApi.getProducts(params);
        const data = res?.data || res;
        const rawResult = data?.result;
        const items = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(rawResult?.items)
          ? rawResult.items
          : Array.isArray(rawResult?.products)
          ? rawResult.products
          : Array.isArray(rawResult)
          ? rawResult
          : Array.isArray(data?.products)
          ? data.products
          : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : [];
        if (items.length > 0) {
          setProducts((prev) => {
            const map = new Map(prev.map((p) => [String(p._id || p.id), p]));
            items.forEach((p) => map.set(String(p._id || p.id), p));
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.error('Failed category search query:', err);
      } finally {
        setIsProductsLoading(false);
      }
    }
  };

  const handleSubCatClick = (sub) => {
    const currentHeaderSlug = activeHeader?.slug || slugify(activeHeader?.name || '');
    const activeMain = mainCategories.find((mc) => String(mc._id || mc.id) === String(selectedMainCatId));
    const currentMainSlug = activeMain?.slug || slugify(activeMain?.name || '');

    if (sub === 'all') {
      setSelectedSubCatId('all');
      if (currentHeaderSlug && currentMainSlug) {
        navigate(`/category/${currentHeaderSlug}/${currentMainSlug}`, { replace: true });
      }
    } else {
      const subId = sub._id || sub.id;
      const subSlug = sub.slug || slugify(sub.name || '');
      setSelectedSubCatId(subId);
      if (currentHeaderSlug && currentMainSlug) {
        navigate(`/category/${currentHeaderSlug}/${currentMainSlug}?sub=${subSlug || subId}`, { replace: true });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] flex flex-col pb-24 font-sans select-none">
      {/* ── Top Header Bar (Sticky with Blue Background matching reference screenshot) ── */}
      <header className="sticky top-0 z-40 bg-[#028ce8] shadow-xs">
        <div className="max-w-7xl mx-auto px-2.5 py-2.5 flex items-center gap-2">
          {/* Back button */}
          <button
            type="button"
            onClick={() => navigate('/categories')}
            className="p-1.5 text-white hover:bg-white/10 rounded-full active:scale-95 transition-all shrink-0"
            aria-label="Back to Categories"
          >
            <ArrowLeft size={23} className="stroke-[2.4]" />
          </button>

          {/* Search bar matching reference screenshot */}
          <div className="flex-1 h-10 bg-white rounded-full px-3.5 flex items-center gap-2.5 shadow-xs transition-shadow">
            <Search size={18} className="text-[#878787] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search for products, brands and more"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-800 placeholder:text-[#878787] outline-none font-normal"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 active:scale-95"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Cart Icon with Counter Badge */}
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="relative p-1.5 text-white hover:bg-white/10 rounded-full active:scale-95 transition-all shrink-0"
            aria-label="Cart"
          >
            <ShoppingCart size={23} className="text-white stroke-[2.2]" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] rounded-full bg-[#ffe11b] text-slate-900 text-[10px] font-black flex items-center justify-center px-0.5 shadow-xs leading-none">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="max-w-7xl mx-auto w-full flex-1">
        {isLoading ? (
          <div className="p-4 space-y-4">
            <div className="h-20 bg-slate-200 animate-pulse rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[4/4.5] bg-slate-200 animate-pulse rounded-2xl" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── UPPER SIDE: ROUND SHAPE SUB CATEGORIES FILTER ── */}
            {availableSubCategories.length > 0 && (
              <section className="bg-white border-b border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <div className="flex items-start gap-3.5 overflow-x-auto no-scrollbar pt-3.5 pb-2.5 px-4 sm:px-5">
                  {/* "All" Circular Round Filter */}
                  <button
                    type="button"
                    onClick={() => handleSubCatClick('all')}
                    className="group flex flex-col items-center shrink-0 text-center select-none active:scale-95 transition-transform cursor-pointer"
                  >
                    <div
                      className={cn(
                        "w-[48px] h-[48px] sm:w-[52px] sm:h-[52px] rounded-full flex items-center justify-center transition-all duration-200 shadow-2xs",
                        selectedSubCatId === 'all'
                          ? "bg-[#6666FF] text-white border-2 border-[#6666FF] ring-3 ring-[#6666FF]/25 shadow-xs"
                          : "bg-[#f4f7fb] text-slate-700 border border-slate-200/90 hover:border-[#6666FF]/40 hover:bg-[#6666FF]/5"
                      )}
                    >
                      <LayoutGrid size={18} className={selectedSubCatId === 'all' ? 'text-white' : 'text-[#6666FF]'} />
                    </div>
                    <span
                      className={cn(
                        "mt-1.5 text-[10px] sm:text-[11px] font-semibold line-clamp-1 max-w-[56px] text-center leading-tight transition-colors",
                        selectedSubCatId === 'all' ? "text-[#6666FF] font-bold" : "text-slate-800 group-hover:text-[#6666FF]"
                      )}
                    >
                      All
                    </span>
                  </button>

                  {/* Each Subcategory in Circular Round Shape */}
                  {availableSubCategories.map((sub) => {
                    const subId = sub._id || sub.id;
                    const isSelected = String(selectedSubCatId) === String(subId);
                    const subImage = sub.image || sub.icon;

                    return (
                      <button
                        key={subId}
                        ref={isSelected ? selectedSubCatRef : null}
                        type="button"
                        onClick={() => handleSubCatClick(sub)}
                        className="group flex flex-col items-center shrink-0 text-center select-none active:scale-95 transition-transform cursor-pointer"
                      >
                        <div
                          className={cn(
                            "w-[48px] h-[48px] sm:w-[52px] sm:h-[52px] rounded-full flex items-center justify-center p-0 overflow-hidden transition-all duration-200 shadow-2xs",
                            isSelected
                              ? "bg-[#6666FF]/8 border-2 border-[#6666FF] ring-3 ring-[#6666FF]/25 shadow-xs"
                              : "bg-white border border-slate-200/90 hover:border-[#6666FF]/40 hover:bg-[#6666FF]/5"
                          )}
                        >
                          {subImage ? (
                            <img
                              src={applyCloudinaryTransform(subImage, 'f_auto,q_auto,w_120')}
                              alt={sub.name}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform group-hover:scale-110"
                            />
                          ) : sub.iconId ? (
                            <CategoryIcon iconId={sub.iconId} className="w-5 h-5 text-[#6666FF]" />
                          ) : (
                            <ShoppingBag size={18} className="text-[#6666FF]" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "mt-1.5 text-[10px] sm:text-[11px] font-medium line-clamp-2 max-w-[58px] text-center leading-tight transition-colors",
                            isSelected ? "text-[#6666FF] font-bold" : "text-slate-800 group-hover:text-[#6666FF]"
                          )}
                        >
                          {sub.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── CATEGORY TITLE BAR / SEARCH STATUS ── */}
            <div className="px-3.5 pt-3 pb-1 flex items-center justify-between">
              {searchQuery.trim() ? (
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs text-slate-600 truncate">
                    Search in <span className="font-bold text-slate-800">{selectedSubCategory?.name || activeMainCategory?.name || 'Category'}</span>: "{searchQuery}"
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Found {filteredProducts.length} items
                  </p>
                </div>
              ) : (
                <div>
                  <h1 className="text-[15px] font-bold text-slate-900 tracking-tight leading-tight">
                    {selectedSubCategory?.name || activeMainCategory?.name || activeHeader?.name || 'Category Products'}
                  </h1>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Showing {filteredProducts.length} items
                  </p>
                </div>
              )}

              {searchQuery.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-[#6666FF] font-bold hover:underline shrink-0"
                >
                  Clear Search
                </button>
              ) : (
                selectedSubCatId !== 'all' && (
                  <button
                    type="button"
                    onClick={() => handleSubCatClick('all')}
                    className="text-xs text-[#6666FF] font-bold hover:underline shrink-0"
                  >
                    View All
                  </button>
                )
              )}
            </div>

            {/* ── ALL PRODUCTS (2 IN ONE ROW GRID) ── */}
            {isProductsLoading ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4 pb-24 pt-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex flex-col animate-pulse">
                    <div className="w-full rounded-[12px] bg-[#F0F0F0]" style={{ aspectRatio: '0.88' }} />
                    <div className="mt-2.5 h-3.5 bg-slate-100 rounded-md w-3/4" />
                    <div className="mt-2 h-4 bg-slate-100 rounded-md w-1/2" />
                    <div className="mt-1.5 h-3.5 bg-slate-100 rounded-md w-2/3" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="mx-3 my-8 p-8 bg-white rounded-2xl border border-slate-100 text-center flex flex-col items-center justify-center">
                <ImageOff size={40} className="text-slate-300 mb-2" />
                <h3 className="text-base font-bold text-slate-800">
                  {searchQuery ? 'No Matching Products' : 'No Products Available'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  {searchQuery
                    ? `No products match "${searchQuery}" in this category selection.`
                    : "We couldn't find any products in this specific category selection."}
                </p>
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 bg-[#6666FF] text-white text-xs font-bold rounded-full shadow-xs active:scale-95 transition-transform flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Clear Search Filter</span>
                  </button>
                ) : selectedSubCatId !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => handleSubCatClick('all')}
                    className="mt-4 px-4 py-2 bg-[#6666FF] text-white text-xs font-bold rounded-full shadow-xs active:scale-95 transition-transform flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>View All {activeMainCategory?.name || 'Category'} Products</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMainCatId && selectedMainCatId !== 'all') {
                        setIsProductsLoading(true);
                        customerApi
                          .getProducts({ categoryId: selectedMainCatId, limit: 100, allProducts: 'true' })
                          .then((res) => {
                            const data = res?.data || res;
                            const rawResult = data?.result;
                            const items = Array.isArray(data?.results)
                              ? data.results
                              : Array.isArray(rawResult?.items)
                              ? rawResult.items
                              : Array.isArray(rawResult?.products)
                              ? rawResult.products
                              : Array.isArray(rawResult)
                              ? rawResult
                              : [];
                            setProducts(items);
                          })
                          .catch((err) => console.error(err))
                          .finally(() => setIsProductsLoading(false));
                      }
                    }}
                    className="mt-4 px-4 py-2 bg-[#6666FF] text-white text-xs font-bold rounded-full shadow-xs active:scale-95 transition-transform flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Refresh Products</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4 pb-24 pt-2">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id || product._id}
                    product={product}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <MiniCart />
      </div>
  );
};

export default CategoryProductsPage;
