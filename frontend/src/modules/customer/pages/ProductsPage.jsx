import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search, 
  ShoppingCart, 
  Heart, 
  ImageOff, 
  X,
  SlidersHorizontal,
  Check,
  RotateCcw
} from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { useProductDetail } from '../context/ProductDetailContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useSettings } from '@core/context/SettingsContext';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { getProductUrl, getProductVariantText } from '@/core/utils/productUrl';
import { cn } from '@/lib/utils';
import ProductCard from '../components/shared/ProductCard';

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

const mapSortToServer = (sort) => {
  switch (sort) {
    case 'price_asc':
      return 'price-asc';
    case 'price_desc':
      return 'price-desc';
    case 'discount':
      return 'discount';
    case 'popularity':
      return 'stock-desc';
    case 'newest':
      return 'newest';
    case 'relevance':
    default:
      return 'newest';
  }
};

let productsPageMemoryCache = {
  headerCategories: [],
  allCategoriesMap: {},
  allSubcategoriesMap: {},
};

const ProductsPage = () => {
  const { openProduct } = useProductDetail();
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

  const [headerCategories, setHeaderCategories] = useState(() => productsPageMemoryCache.headerCategories);
  const [allCategoriesMap, setAllCategoriesMap] = useState(() => productsPageMemoryCache.allCategoriesMap);
  const [allSubcategoriesMap, setAllSubcategoriesMap] = useState(() => productsPageMemoryCache.allSubcategoriesMap);

  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProductsCount, setTotalProductsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeSort, setActiveSort] = useState('relevance');
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);

  const PRODUCT_BATCH_SIZE = 24;
  const activeFetchIdRef = useRef(0);
  const loadMoreSentinelRef = useRef(null);

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
          productsPageMemoryCache.headerCategories = headers;
          productsPageMemoryCache.allCategoriesMap = catMap;
          productsPageMemoryCache.allSubcategoriesMap = subMap;
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

  // 2. Fetch products with true server-side pagination and sorting (Page 1)
  useEffect(() => {
    let isMounted = true;
    const fetchId = ++activeFetchIdRef.current;

    const fetchInitialProducts = async () => {
      setIsLoading(true);
      try {
        const serverSort = mapSortToServer(activeSort);
        const params = {
          page: 1,
          limit: PRODUCT_BATCH_SIZE,
          sort: serverSort,
        };

        if (debouncedQuery.trim()) {
          params.search = debouncedQuery.trim();
        }

        if (selectedHeaderId && selectedHeaderId !== 'all') {
          params.headerId = selectedHeaderId;
        }

        const res = await customerApi.getProducts(params);
        if (isMounted && activeFetchIdRef.current === fetchId) {
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
            : Array.isArray(data)
            ? data
            : [];

          const total = Number(rawResult?.total ?? data?.total ?? items.length);
          const totalP = Number(rawResult?.totalPages ?? data?.totalPages ?? (Math.ceil(total / PRODUCT_BATCH_SIZE) || 1));

          setProducts(items);
          setPage(1);
          setTotalPages(Math.max(1, totalP));
          setTotalProductsCount(total);
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
        if (isMounted && activeFetchIdRef.current === fetchId) {
          setProducts([]);
          setPage(1);
          setTotalPages(1);
          setTotalProductsCount(0);
        }
      } finally {
        if (isMounted && activeFetchIdRef.current === fetchId) {
          setIsLoading(false);
        }
      }
    };

    fetchInitialProducts();

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, selectedHeaderId, activeSort]);

  // 3. Fetch Next Page on Sentinel Intersection
  const fetchNextPage = React.useCallback(async () => {
    if (isLoading || isLoadingMore || page >= totalPages) return;

    const nextPage = page + 1;
    const fetchId = activeFetchIdRef.current;
    setIsLoadingMore(true);

    try {
      const serverSort = mapSortToServer(activeSort);
      const params = {
        page: nextPage,
        limit: PRODUCT_BATCH_SIZE,
        sort: serverSort,
      };

      if (debouncedQuery.trim()) {
        params.search = debouncedQuery.trim();
      }

      if (selectedHeaderId && selectedHeaderId !== 'all') {
        params.headerId = selectedHeaderId;
      }

      const res = await customerApi.getProducts(params);
      if (activeFetchIdRef.current === fetchId) {
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
            const existingIds = new Set(prev.map((p) => String(p._id || p.id)));
            const unique = items.filter((p) => !existingIds.has(String(p._id || p.id)));
            return [...prev, ...unique];
          });
        }

        const total = Number(rawResult?.total ?? data?.total ?? totalProductsCount);
        const totalP = Number(rawResult?.totalPages ?? data?.totalPages ?? totalPages);
        setPage(nextPage);
        setTotalPages(Math.max(1, totalP));
        setTotalProductsCount(total);
      }
    } catch (err) {
      console.error('Failed to load next page:', err);
    } finally {
      if (activeFetchIdRef.current === fetchId) {
        setIsLoadingMore(false);
      }
    }
  }, [
    isLoading,
    isLoadingMore,
    page,
    totalPages,
    activeSort,
    debouncedQuery,
    selectedHeaderId,
    totalProductsCount,
  ]);

  // Observer to load more batches automatically 350px before scroll reaches bottom
  useEffect(() => {
    if (page >= totalPages || isLoading || isLoadingMore) return;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      { root: null, rootMargin: '350px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [page, totalPages, isLoading, isLoadingMore, fetchNextPage]);

  const handleHeaderCategoryClick = (headerId) => {
    setSelectedHeaderId(headerId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 pb-20">
      {/* 1. Skyblue Top Header */}
      <header className="sticky top-0 z-40 bg-[#0ea5e9] px-3 pt-3 pb-2.5 shadow-md">
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

          {/* White Search Input Field - Fully Rounded with NO focus border */}
          <div className="customer-products-search-box flex-1 bg-white rounded-full px-3.5 h-9 flex items-center gap-2 shadow-xs border-0 outline-none focus-within:ring-0">
            <Search size={16} className="text-slate-400 shrink-0" strokeWidth={2.2} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for products, brands and more"
              className="w-full bg-transparent text-[13px] font-medium text-slate-900 placeholder:text-slate-400 border-0 outline-none focus:outline-none focus:ring-0 shadow-none ring-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded-full outline-none focus:outline-none"
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
      <div className="sticky top-[53px] z-30 bg-white border-b border-slate-100 px-3.5 py-3 min-h-[56px] flex items-center gap-2.5 overflow-x-auto no-scrollbar shadow-2xs">
        {/* All Button (Default) */}
        <button
          type="button"
          onClick={() => handleHeaderCategoryClick('all')}
          className={cn(
            "px-4 py-2 min-h-[36px] rounded-full text-[13px] font-semibold whitespace-nowrap transition-all shadow-2xs active:scale-95 border flex items-center justify-center cursor-pointer",
            selectedHeaderId === 'all'
              ? "bg-[#6666FF] text-white border-transparent shadow-[0_2px_8px_rgba(102,102,255,0.35)]"
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
                "px-4 py-2 min-h-[36px] rounded-full text-[13px] font-semibold whitespace-nowrap transition-all shadow-2xs active:scale-95 border flex items-center justify-center gap-1.5 cursor-pointer",
                isSelected
                  ? "bg-[#6666FF] text-white border-transparent shadow-[0_2px_8px_rgba(102,102,255,0.35)]"
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
            "ml-auto flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[36px] rounded-full border text-[13px] font-semibold whitespace-nowrap transition-all active:scale-95 shrink-0",
            activeSort !== 'relevance'
              ? "bg-blue-50 border-blue-400 text-blue-700"
              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
          )}
        >
          <SlidersHorizontal size={13} strokeWidth={2.2} />
          <span>Sort</span>
        </button>
      </div>

      {/* 3. Product Listing Grid (Flipkart-Style responsive desktop grid) */}
      <main className="max-w-7xl mx-auto w-full px-4 py-3 pb-24">
        {/* Desktop Breadcrumbs (hidden on mobile) */}
        <nav className="hidden md:flex items-center gap-2 py-2 text-xs text-slate-500 font-medium border-b border-slate-100 mb-3">
          <button onClick={() => navigate('/')} className="hover:text-blue-600 transition-colors cursor-pointer">Home</button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600 font-semibold">Products ({totalProductsCount > 0 ? totalProductsCount : products.length})</span>
          {searchQuery && (
            <>
              <span className="text-slate-300">/</span>
              <span className="text-slate-900 font-bold">"{searchQuery}"</span>
            </>
          )}
        </nav>

        {/* Desktop Sort Bar (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-2 py-2 border-b border-slate-100 mb-4">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-1">Sort By</span>
          {[
            { id: 'relevance', label: 'Relevance' },
            { id: 'price_asc', label: 'Price -- Low to High' },
            { id: 'price_desc', label: 'Price -- High to Low' },
            { id: 'popularity', label: 'Popularity' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSort(tab.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeSort === tab.id
                  ? "bg-blue-600 text-white font-bold shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="flex flex-col animate-pulse">
                <div className="w-full rounded-[12px] bg-[#F0F0F0]" style={{ aspectRatio: '0.88' }} />
                <div className="mt-2.5 h-3.5 bg-slate-100 rounded-md w-3/4" />
                <div className="mt-2 h-4 bg-slate-100 rounded-md w-1/2" />
                <div className="mt-1.5 h-3.5 bg-slate-100 rounded-md w-2/3" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
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
              className="mt-4 px-4 py-2 bg-gradient-to-r from-[#ff9f43] to-[#ff793f] text-white text-xs font-bold rounded-full shadow-xs active:scale-95 transition-transform flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>Reset & View All Products</span>
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
              {products.map((product, idx) => (
                <ProductCard
                  key={product.id || product._id}
                  product={product}
                  priority={idx < 4}
                />
              ))}
            </div>
            {page < totalPages && (
              <div
                ref={loadMoreSentinelRef}
                className="w-full py-6 flex items-center justify-center text-xs text-slate-400 font-medium"
              >
                <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin mr-2" />
                <span>Loading more products...</span>
              </div>
            )}
            {page >= totalPages && products.length > 0 && (
              <div className="w-full py-6 flex items-center justify-center text-xs text-slate-400 font-medium">
                <span>You've reached the end of this catalog</span>
              </div>
            )}
          </>
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
                  <span className={cn(activeSort === opt.id && "font-bold text-[#6666FF]")}>
                    {opt.label}
                  </span>
                  {activeSort === opt.id && <Check size={16} className="text-[#6666FF]" />}
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
