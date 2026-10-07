import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { 
  Search, 
  ArrowLeft, 
  X, 
  ArrowUpRight, 
  History, 
  Clock
} from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { useProductDetail } from '../context/ProductDetailContext';
import { getJSON, setJSON, STORAGE_KEYS } from '@core/utils/storage';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { cn } from '@/lib/utils';

const MAX_RECENT_SEARCHES = 12;

const SearchPage = () => {
  const { openProduct } = useProductDetail();
  const navigate = useNavigate();
  const location = useRouterLocation();
  const inputRef = useRef(null);

  const initialQuery = location.state?.query || new URLSearchParams(location.search).get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [liveProducts, setLiveProducts] = useState([]);
  const [liveCategories, setLiveCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Recent Searches from LocalStorage (max 12)
  const [pastSearches, setPastSearches] = useState(() => {
    const saved = getJSON(STORAGE_KEYS.RECENT_SEARCHES, []);
    return Array.isArray(saved) 
      ? saved.filter((s) => typeof s === 'string' && s.trim().length > 0).slice(0, MAX_RECENT_SEARCHES) 
      : [];
  });

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Save to history helper (stores up to 12)
  const saveSearch = (term) => {
    const clean = term?.trim();
    if (!clean) return;
    const updated = [clean, ...pastSearches.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
    setPastSearches(updated);
    setJSON(STORAGE_KEYS.RECENT_SEARCHES, updated);
  };

  const handleRemoveSearch = (e, term) => {
    e.stopPropagation();
    const updated = pastSearches.filter((s) => s !== term);
    setPastSearches(updated);
    setJSON(STORAGE_KEYS.RECENT_SEARCHES, updated);
  };

  const handleClearAllHistory = () => {
    setPastSearches([]);
    setJSON(STORAGE_KEYS.RECENT_SEARCHES, []);
  };

  // Navigate to /products on search
  const executeSearch = (searchTerm) => {
    const finalTerm = (searchTerm || query).trim();
    if (!finalTerm) return;
    saveSearch(finalTerm);
    navigate(`/products?q=${encodeURIComponent(finalTerm)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch(query);
    }
  };

  // Live suggestions query debounce
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setLiveProducts([]);
      setLiveCategories([]);
      return;
    }

    let isCurrent = true;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const [prodRes, catRes] = await Promise.allSettled([
          customerApi.getProducts({ search: trimmed, limit: 10 }),
          customerApi.getCategories?.() || Promise.resolve({ data: [] }),
        ]);

        if (!isCurrent) return;

        if (prodRes.status === 'fulfilled') {
          const data = prodRes.value?.data || prodRes.value;
          const items = Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data?.result?.items)
            ? data.result.items
            : Array.isArray(data?.result)
            ? data.result
            : [];
          setLiveProducts(items);
        }

        if (catRes.status === 'fulfilled') {
          const rawCats = catRes.value?.data?.categories || catRes.value?.data || [];
          const matched = (Array.isArray(rawCats) ? rawCats : []).filter((c) =>
            c.name?.toLowerCase().includes(trimmed.toLowerCase())
          );
          setLiveCategories(matched.slice(0, 4));
        }
      } catch (err) {
        console.error('Failed to fetch live suggestions:', err);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }, 200);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Build suggestion rows
  const suggestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    // 1. When query is typed: show live category & product results
    if (trimmed) {
      const items = [];

      // Exact term typed at top
      items.push({
        term: query.trim(),
        categoryName: '',
        image: null,
        type: 'exact',
      });

      // Category matches (e.g. "Electronics in Electronics")
      liveCategories.forEach((cat) => {
        items.push({
          term: cat.name,
          categoryName: `in ${cat.name}`,
          image: cat.image,
          type: 'category',
        });
      });

      // Product title matches
      liveProducts.forEach((p) => {
        const title = p.name || '';
        const img = p.image || p.mainImage || p.variants?.[0]?.images?.[0];
        const catName = p.categoryName || p.categoryId?.name;
        items.push({
          term: title,
          categoryName: catName ? `in ${catName}` : '',
          image: img,
          type: 'product',
          product: p,
        });
      });

      return items.slice(0, MAX_RECENT_SEARCHES);
    }

    // 2. When query is empty: ONLY show recent searches (max 12)
    return pastSearches.slice(0, MAX_RECENT_SEARCHES).map((pastTerm) => ({
      term: pastTerm,
      isRecent: true,
    }));
  }, [query, liveProducts, liveCategories, pastSearches]);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 pb-16">
      {/* 1. Header with Search Input */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-2xs">
        <div className="max-w-4xl mx-auto px-3.5 pt-3 pb-2.5 flex items-center gap-2.5">
          {/* Back Arrow */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1 -ml-1 text-slate-800 hover:text-slate-950 active:scale-95 transition-transform cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft size={22} strokeWidth={2.2} />
          </button>

          {/* Search Input Box */}
          <div className="flex-1 bg-slate-50 border border-slate-200/90 rounded-full px-3.5 py-1.5 flex items-center gap-2 shadow-2xs focus-within:bg-white focus-within:border-slate-400 transition-all">
            <Search size={18} className="text-slate-400 shrink-0" strokeWidth={2.2} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search for products, categories..."
              className="w-full bg-transparent text-[14px] font-medium text-slate-900 placeholder:text-slate-400 outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                aria-label="Clear"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Recent Searches Header (when query is empty and recent searches exist) */}
      {!query.trim() && pastSearches.length > 0 && (
        <div className="bg-slate-50 border-b border-slate-100">
          <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-2.5 text-xs text-slate-600 font-semibold">
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-slate-500" />
              <span>Recent Searches ({pastSearches.length})</span>
            </span>
            <button
              type="button"
              onClick={handleClearAllHistory}
              className="text-orange-600 hover:underline text-[11px] font-bold cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* 3. Empty State (when no recent searches and no query typed) */}
      {!query.trim() && pastSearches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center max-w-4xl mx-auto">
          <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-3 text-slate-400">
            <History size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">No Recent Searches</h3>
          <p className="text-xs text-slate-400 max-w-[240px]">
            Search for groceries, fashion, electronics, and daily essentials.
          </p>
        </div>
      )}

      {/* 4. Suggestions / Recent Searches List (Max 12) */}
      <main className="max-w-4xl mx-auto w-full bg-white divide-y divide-slate-100">
        {suggestions.map((item, index) => {
          return (
            <div
              key={`${item.term}-${index}`}
              onClick={() => {
                if (item.product) {
                  openProduct(item.product);
                } else {
                  executeSearch(item.term);
                }
              }}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 active:bg-slate-100 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                {/* Left Icon or Product Thumbnail */}
                <div className="w-8 h-8 shrink-0 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                  {item.image ? (
                    <img
                      src={applyCloudinaryTransform(item.image, 'f_auto,q_auto,w_100')}
                      alt={item.term}
                      className="w-full h-full object-cover"
                    />
                  ) : item.isRecent ? (
                    <History size={16} className="text-slate-500" />
                  ) : (
                    <Search size={16} className="text-slate-500" />
                  )}
                </div>

                {/* Center Text (Term + Optional Category) */}
                <div className="min-w-0 flex-1 flex flex-col justify-center">
                  <span className="text-[14px] font-semibold text-slate-900 truncate leading-snug">
                    {item.term}
                  </span>
                  {item.categoryName && (
                    <span className="text-[12px] font-medium text-blue-600 truncate leading-tight mt-0.5">
                      {item.categoryName}
                    </span>
                  )}
                </div>
              </div>

              {/* Right Action: Remove Button (for recent items) + Arrow Button */}
              <div className="flex items-center gap-1 pl-2">
                {item.isRecent && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveSearch(e, item.term)}
                    className="p-1.5 text-slate-300 hover:text-red-500 rounded-full active:scale-90 transition-colors cursor-pointer"
                    title="Remove from history"
                    aria-label="Remove search term"
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    executeSearch(item.term);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
                  aria-label="Search this term"
                >
                  <ArrowUpRight size={17} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
};

export default SearchPage;
