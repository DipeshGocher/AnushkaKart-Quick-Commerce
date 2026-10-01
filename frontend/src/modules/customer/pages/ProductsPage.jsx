import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search, 
  ShoppingCart, 
  Star, 
  ShieldCheck, 
  Heart, 
  ImageOff, 
  X,
  SlidersHorizontal,
  Check,
  RotateCcw
} from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useSettings } from '@core/context/SettingsContext';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { getProductUrl } from '@/core/utils/productUrl';
import { cn } from '@/lib/utils';

const formatPrice = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

// Helper to shuffle array (Fisher-Yates) for random mix
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const ProductsPage = () => {
  const navigate = useNavigate();
  const location = useRouterLocation();
  const { groceryCartCount } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { settings } = useSettings();
  const appName = settings?.appName || 'Flipkart';

  const searchParams = new URLSearchParams(location.search);
  const initialQuery = searchParams.get('q') || searchParams.get('search') || location.state?.query || '';
  const initialCategory = searchParams.get('category') || 'all';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [selectedHeaderId, setSelectedHeaderId] = useState(initialCategory);

  const [headerCategories, setHeaderCategories] = useState([]);
  const [allCategoriesMap, setAllCategoriesMap] = useState({});
  const [allSubcategoriesMap, setAllSubcategoriesMap] = useState({});

  const [rawProducts, setRawProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSort, setActiveSort] = useState('relevance');
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 1. Fetch categories (headers, main categories, and subcategories)
  useEffect(() => {
    let cancelled = false;

    const fetchCategoryStructure = async () => {
      try {
        const res = await customerApi.getCategories();
        const data = res?.data || res;
        const list = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.result)
          ? data.result
          : Array.isArray(data)
          ? data
          : [];

        if (!cancelled && list.length > 0) {
          const headers = list.filter(
            (c) => c.type === 'header' && c.name?.toLowerCase() !== 'all' && c.status !== 'inactive'
          );
          setHeaderCategories(headers);

          const catMap = {};
          const subMap = {};
          list.forEach((c) => {
            if (c.type === 'category') catMap[c._id] = c;
            if (c.type === 'subcategory') subMap[c._id] = c;
          });
          setAllCategoriesMap(catMap);
          setAllSubcategoriesMap(subMap);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };

    fetchCategoryStructure();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Fetch products in bulk (random mix across categories)
  useEffect(() => {
    let cancelled = false;

    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const params = {
          limit: 150,
          allProducts: 'true',
        };

        if (debouncedQuery.trim()) {
          params.search = debouncedQuery.trim();
        }

        // If specific header category is selected (and not 'all')
        if (selectedHeaderId && selectedHeaderId !== 'all') {
          params.headerId = selectedHeaderId;
        }

        const res = await customerApi.getProducts(params);
        const data = res?.data || res;
        const rawResult = data?.result;
        const items = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(rawResult?.items)
          ? rawResult.items
          : Array.isArray(rawResult)
          ? rawResult
          : Array.isArray(data)
          ? data
          : [];

        if (!cancelled) {
          // If viewing All and no search query, shuffle for random mix
          if ((!selectedHeaderId || selectedHeaderId === 'all') && !debouncedQuery.trim()) {
            setRawProducts(shuffleArray(items));
          } else {
            setRawProducts(items);
          }
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
        if (!cancelled) setRawProducts([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchProducts();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, selectedHeaderId]);

  // 3. Client-side Category & Hierarchy Filter (ensures all main & subcategories under selected header match)
  const displayProducts = useMemo(() => {
    let list = [...rawProducts];

    // If a specific header is selected, filter strictly or loosely
    if (selectedHeaderId && selectedHeaderId !== 'all') {
      // Find all child category IDs belonging to this header
      const childCategoryIds = new Set(
        Object.values(allCategoriesMap)
          .filter((c) => String(c.parentId?._id || c.parentId) === String(selectedHeaderId))
          .map((c) => String(c._id))
      );

      // Find all child subcategory IDs belonging to those categories
      const childSubcategoryIds = new Set(
        Object.values(allSubcategoriesMap)
          .filter((s) => childCategoryIds.has(String(s.parentId?._id || s.parentId)))
          .map((s) => String(s._id))
      );

      list = list.filter((p) => {
        const prodHeader = String(p.headerId?._id || p.headerId || '');
        const prodCat = String(p.categoryId?._id || p.categoryId || '');
        const prodSub = String(p.subcategoryId?._id || p.subcategoryId || '');

        return (
          prodHeader === String(selectedHeaderId) ||
          prodCat === String(selectedHeaderId) ||
          childCategoryIds.has(prodCat) ||
          childSubcategoryIds.has(prodSub)
        );
      });
    }

    // Client-side text search filter as instant refinement
    if (debouncedQuery.trim()) {
      const qLower = debouncedQuery.trim().toLowerCase();
      const words = qLower.split(/\s+/).filter(Boolean);

      list = list.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const brand = (p.brand || '').toLowerCase();
        const catName = (p.categoryName || p.categoryId?.name || '').toLowerCase();
        const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : (p.tags || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();

        const combinedText = `${name} ${brand} ${catName} ${tags} ${desc}`;
        return words.every((word) => combinedText.includes(word));
      });
    }

    // Sorting
    if (activeSort === 'price_asc') {
      list.sort((a, b) => (Number(a.salePrice || a.price) || 0) - (Number(b.salePrice || b.price) || 0));
    } else if (activeSort === 'price_desc') {
      list.sort((a, b) => (Number(b.salePrice || b.price) || 0) - (Number(a.salePrice || a.price) || 0));
    } else if (activeSort === 'discount') {
      list.sort((a, b) => {
        const discA = ((Number(a.price || a.originalPrice) - Number(a.salePrice || a.price)) / (Number(a.price || a.originalPrice) || 1));
        const discB = ((Number(b.price || b.originalPrice) - Number(b.salePrice || b.price)) / (Number(b.price || b.originalPrice) || 1));
        return discB - discA;
      });
    } else if (activeSort === 'newest') {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return list;
  }, [rawProducts, selectedHeaderId, debouncedQuery, allCategoriesMap, allSubcategoriesMap, activeSort]);

  // Delivery estimate display
  const getDeliveryText = (index) => {
    const today = new Date();
    const target = new Date(today);
    target.setDate(today.getDate() + (index % 3 === 0 ? 1 : 2));
    const day = target.getDate();
    const month = target.toLocaleString('en-US', { month: 'short' });
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
    return `Delivery by ${day}${suffix} ${month}`;
  };

  const handleHeaderCategoryClick = (headerId) => {
    setSelectedHeaderId(headerId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 pb-20">
      {/* 1. Flipkart Blue Top Header */}
      <header className="sticky top-0 z-40 bg-[#2874f0] px-3 pt-3 pb-2.5 shadow-md">
        <div className="flex items-center gap-2.5">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1 -ml-1 text-white hover:opacity-85 active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ArrowLeft size={22} strokeWidth={2.5} />
          </button>

          {/* Flipkart / App Name text branding */}
          <span 
            onClick={() => navigate('/')}
            className="text-white font-black italic tracking-tighter text-[16px] cursor-pointer hidden xs:inline-block drop-shadow-xs"
          >
            {appName}
          </span>

          {/* White Search Input Field */}
          <div className="flex-1 bg-white rounded-sm sm:rounded-md px-3 py-1.5 flex items-center gap-2 shadow-xs transition-all">
            <Search size={16} className="text-slate-400 shrink-0" strokeWidth={2.2} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for products, brands and more"
              className="w-full bg-transparent text-[13.5px] font-medium text-slate-900 placeholder:text-slate-400 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
                aria-label="Clear search"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Cart Icon with Counter Badge */}
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="relative p-1 text-white hover:opacity-90 active:scale-95 transition-transform shrink-0"
            aria-label="View Cart"
          >
            <ShoppingCart size={23} strokeWidth={2} />
            {groceryCartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#ff6161] text-white text-[10px] font-black h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center leading-none border border-white shadow-xs animate-in zoom-in">
                {groceryCartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 2. Header Category Buttons: All, Grocery, Electronics, Mobile etc. */}
      <div className="sticky top-[53px] z-30 bg-white border-b border-slate-100 px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
        {/* All Button (Default) */}
        <button
          type="button"
          onClick={() => handleHeaderCategoryClick('all')}
          className={cn(
            "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-2xs active:scale-95 border",
            selectedHeaderId === 'all'
              ? "bg-[#2874f0] text-white border-[#2874f0] shadow-sm"
              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
          )}
        >
          All
        </button>

        {/* Dynamic Header Categories from DB */}
        {headerCategories.map((header) => {
          const isSelected = String(selectedHeaderId) === String(header._id);
          return (
            <button
              key={header._id}
              type="button"
              onClick={() => handleHeaderCategoryClick(header._id)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-2xs active:scale-95 border flex items-center gap-1.5",
                isSelected
                  ? "bg-[#2874f0] text-white border-[#2874f0] shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              )}
            >
              <span>{header.name}</span>
            </button>
          );
        })}

        {/* Sort Trigger Button */}
        <button
          type="button"
          onClick={() => setIsSortModalOpen(true)}
          className={cn(
            "ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-all active:scale-95 shrink-0",
            activeSort !== 'relevance'
              ? "bg-blue-50 border-blue-400 text-blue-700"
              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
          )}
        >
          <SlidersHorizontal size={12} strokeWidth={2.2} />
          <span>Sort</span>
        </button>
      </div>

      {/* 3. Product Listing Grid (Image Layout: 2 items per row) */}
      <main className="px-2.5 py-3">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col animate-pulse">
                <div className="aspect-[4/4.5] w-full rounded-2xl bg-slate-100" />
                <div className="mt-2 h-3 bg-slate-100 rounded-md w-3/4" />
                <div className="mt-1 h-3 bg-slate-100 rounded-md w-1/2" />
                <div className="mt-1.5 h-4 bg-slate-100 rounded-md w-2/3" />
              </div>
            ))}
          </div>
        ) : displayProducts.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center px-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-3">
              <Search size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-800">No products found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {searchQuery
                ? `We couldn't find any products matching "${searchQuery}". Try different keywords.`
                : 'No products available in this category yet.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedHeaderId('all');
              }}
              className="mt-4 px-4 py-2 bg-[#2874f0] text-white text-xs font-bold rounded-full shadow-xs active:scale-95 transition-transform flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>Reset & View All Products</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-4">
            {displayProducts.map((product, index) => {
              const id = product.id || product._id;
              const originalPrice = Number(product.price ?? product.originalPrice) || 0;
              const currentPrice = Number(product.salePrice ?? product.price) || 0;
              const hasDiscount = originalPrice > currentPrice && currentPrice > 0;
              const discountPercent = hasDiscount
                ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
                : 0;
              const image =
                product.image ||
                product.mainImage ||
                product.variants?.[0]?.images?.[0];
              const isWish = isInWishlist(id);
              const variantCount = Array.isArray(product.variants) ? product.variants.length : 0;
              const isSponsored = index === 0 || index === 1;

              return (
                <div
                  key={id}
                  className="group flex flex-col cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => navigate(getProductUrl(product))}
                >
                  {/* Top Image Box */}
                  <div className="relative aspect-[4/4.5] w-full rounded-2xl bg-white border border-slate-100/90 flex items-center justify-center p-2.5 overflow-hidden shadow-2xs group-hover:border-slate-300 transition-colors">
                    {/* Wishlist Heart */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWishlist(id);
                      }}
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/85 backdrop-blur-xs text-slate-700 hover:text-red-500 active:scale-90 transition-transform shadow-2xs border border-slate-100"
                      aria-label="Wishlist"
                    >
                      <Heart
                        size={15}
                        className={cn(isWish ? "fill-red-500 text-red-500" : "text-slate-600")}
                      />
                    </button>

                    {/* Product Image */}
                    {image ? (
                      <img
                        src={applyCloudinaryTransform(image, 'f_auto,q_auto,w_400')}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <ImageOff size={28} className="text-slate-300" />
                    )}

                    {/* Variant Pill (e.g. "3 variants") */}
                    {variantCount > 1 && (
                      <span className="absolute bottom-1.5 right-1.5 bg-white/95 border border-blue-200 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                        {variantCount} variants
                      </span>
                    )}
                  </div>

                  {/* Sponsored tag */}
                  {isSponsored && (
                    <span className="text-[10px] text-slate-400 font-normal leading-none block mt-1.5">
                      Sponsored
                    </span>
                  )}

                  {/* Product Title (2-line clamp) */}
                  <h3 className={cn(
                    "text-[13px] font-medium text-slate-900 leading-snug line-clamp-2 min-h-[34px] group-hover:text-[#2874f0] transition-colors",
                    isSponsored ? "mt-0.5" : "mt-1.5"
                  )}>
                    {product.name}
                  </h3>

                  {/* Rating & Assured Badge Row */}
                  <div className="flex items-center gap-1 mt-1">
                    <div className="flex items-center text-emerald-600">
                      {[1, 2, 3, 4].map((s) => (
                        <Star key={s} size={11} className="fill-emerald-600 text-emerald-600" />
                      ))}
                      <Star size={11} className="fill-slate-200 text-slate-200" />
                    </div>
                    <span className="flex items-center gap-0.5 text-[#2874f0] font-black italic text-[10.5px] ml-1">
                      <ShieldCheck size={12} className="fill-[#2874f0] text-white" />
                      Assured
                    </span>
                  </div>

                  {/* Pricing Row (↓64%  ₹637  ₹231) */}
                  <div className="mt-1 flex items-baseline gap-1.5 leading-none">
                    {hasDiscount && (
                      <span className="text-[#16a34a] font-bold text-[13px] flex items-center">
                        ↓{discountPercent}%
                      </span>
                    )}
                    {hasDiscount && (
                      <span className="text-[12px] text-slate-400 line-through font-normal">
                        {formatPrice(originalPrice)}
                      </span>
                    )}
                    <span className="text-[15px] font-extrabold text-slate-900">
                      {formatPrice(currentPrice)}
                    </span>
                  </div>

                  {/* Promotional Badge (Big Billion Days Price) */}
                  <div className="mt-1">
                    <span className="bg-purple-100/70 text-purple-800 text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] inline-block">
                      Big Billion Days Price
                    </span>
                  </div>

                  {/* Delivery Timeline */}
                  <p className="mt-1 text-[11px] text-slate-600 font-medium">
                    {getDeliveryText(index)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Sort Bottom Sheet */}
      {isSortModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-end justify-center"
          onClick={() => setIsSortModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-3xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-base font-bold text-slate-900">Sort Products</h4>
              <button
                type="button"
                onClick={() => setIsSortModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-3 space-y-1">
              {[
                { id: 'relevance', label: 'Relevance (Default)' },
                { id: 'price_asc', label: 'Price: Low to High' },
                { id: 'price_desc', label: 'Price: High to Low' },
                { id: 'discount', label: 'Discount: High to Low' },
                { id: 'newest', label: 'Newest First' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setActiveSort(opt.id);
                    setIsSortModalOpen(false);
                  }}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-800 transition-colors"
                >
                  <span className={cn(activeSort === opt.id && "font-bold text-[#2874f0]")}>
                    {opt.label}
                  </span>
                  {activeSort === opt.id && <Check size={16} className="text-[#2874f0]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
