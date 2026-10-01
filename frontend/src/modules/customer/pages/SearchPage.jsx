import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { 
  Search, 
  ArrowLeft, 
  X, 
  ArrowUpRight, 
  History, 
  TrendingUp, 
  ImageOff,
  Clock
} from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { getJSON, setJSON, STORAGE_KEYS } from '@core/utils/storage';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { getProductUrl } from '@/core/utils/productUrl';
import { cn } from '@/lib/utils';

const DEFAULT_POPULAR_SUGGESTIONS = [
  {
    term: 'mobile 5g',
    categoryName: 'in Mobiles',
    image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=200',
  },
  {
    term: 'mobile',
    categoryName: 'in Mobiles',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=200',
  },
  {
    term: 'mobile under 10000',
    categoryName: '',
    image: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&q=80&w=200',
  },
  {
    term: 'motorola mobile 5g',
    categoryName: '',
    image: 'https://images.unsplash.com/photo-1567581935884-3349723552ca?auto=format&fit=crop&q=80&w=200',
  },
  {
    term: '4g mobile',
    categoryName: '',
    image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&q=80&w=200',
  },
  {
    term: 'samsung 5g mobile',
    categoryName: '',
    image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&q=80&w=200',
  },
  {
    term: 'vivo mobile 5g',
    categoryName: '',
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&q=80&w=200',
  },
  {
    term: 'realme 5g mobile',
    categoryName: '',
    image: 'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?auto=format&fit=crop&q=80&w=200',
  },
  {
    term: 'gaming mobile 5g',
    categoryName: '',
    image: 'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?auto=format&fit=crop&q=80&w=200',
  },
  {
    term: 'sony mobile 5g',
    categoryName: '',
    image: 'https://images.unsplash.com/photo-1585060544812-6b45742d762f?auto=format&fit=crop&q=80&w=200',
  },
  {
    term: 'chana',
    categoryName: 'in Groceries',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=200',
  },
  {
    term: 'laptop',
    categoryName: 'in Electronics',
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80&w=200',
  },
];

const SearchPage = () => {
  const navigate = useNavigate();
  const location = useRouterLocation();
  const inputRef = useRef(null);

  const initialQuery = location.state?.query || new URLSearchParams(location.search).get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [liveProducts, setLiveProducts] = useState([]);
  const [liveCategories, setLiveCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Recent Searches in LocalStorage
  const [pastSearches, setPastSearches] = useState(() => {
    const saved = getJSON(STORAGE_KEYS.RECENT_SEARCHES, []);
    return Array.isArray(saved) ? saved.filter((s) => typeof s === 'string') : [];
  });

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Save to history helper
  const saveSearch = (term) => {
    const clean = term?.trim();
    if (!clean) return;
    const updated = [clean, ...pastSearches.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 12);
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
          customerApi.getProducts({ search: trimmed, limit: 8 }),
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

  // Build suggestion rows (Image 2 layout)
  const suggestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    // When query is typed:
    if (trimmed) {
      const items = [];

      // 1. Category matches (e.g. "mobilesh in Mobiles")
      liveCategories.forEach((cat) => {
        items.push({
          term: trimmed,
          categoryName: `in ${cat.name}`,
          image: cat.image,
          type: 'category',
        });
      });

      // 2. Product title matches
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

      // 3. Fallback popular suggestions that match the search substring
      const matchedPopular = DEFAULT_POPULAR_SUGGESTIONS.filter((s) =>
        s.term.toLowerCase().includes(trimmed)
      );
      matchedPopular.forEach((pop) => {
        if (!items.some((it) => it.term.toLowerCase() === pop.term.toLowerCase())) {
          items.push(pop);
        }
      });

      // If user typed something specific, make sure exact term is at top
      if (!items.some((it) => it.term.toLowerCase() === trimmed)) {
        items.unshift({
          term: query.trim(),
          categoryName: '',
          image: null,
          type: 'exact',
        });
      }

      return items;
    }

    // When query is empty:
    // Show past searches + popular suggestions
    const items = [];

    pastSearches.forEach((pastTerm) => {
      const matchedPop = DEFAULT_POPULAR_SUGGESTIONS.find(
        (s) => s.term.toLowerCase() === pastTerm.toLowerCase()
      );
      items.push({
        term: pastTerm,
        categoryName: matchedPop?.categoryName || '',
        image: matchedPop?.image || null,
        isRecent: true,
      });
    });

    DEFAULT_POPULAR_SUGGESTIONS.forEach((pop) => {
      if (!items.some((it) => it.term.toLowerCase() === pop.term.toLowerCase())) {
        items.push(pop);
      }
    });

    return items;
  }, [query, liveProducts, liveCategories, pastSearches]);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 pb-16">
      {/* 1. Header (Soft light blue background matching Image 2) */}
      <header className="sticky top-0 z-40 bg-[#dbeafe] border-b border-blue-200/60 px-3.5 pt-3 pb-2.5 shadow-xs">
        <div className="flex items-center gap-2.5">
          {/* Back Arrow */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1 -ml-1 text-slate-800 hover:text-slate-950 active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ArrowLeft size={22} strokeWidth={2.2} />
          </button>

          {/* Search Pill Input (matching Image 2) */}
          <div className="flex-1 bg-white rounded-full border border-sky-300 px-3.5 py-1.5 flex items-center gap-2 shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Search size={18} className="text-slate-400 shrink-0" strokeWidth={2.2} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search for products, categories..."
              className="w-full bg-transparent text-[14.5px] font-medium text-slate-900 placeholder:text-slate-400 outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
                aria-label="Clear"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Suggestions / Recent Searches List (matching Image 2) */}
      <main className="w-full bg-white divide-y divide-slate-100">
        {/* If recent searches exist and query is empty, show a small header */}
        {!query.trim() && pastSearches.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50/70 border-b border-slate-100 text-xs text-slate-500 font-semibold">
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-slate-400" />
              <span>Recent Searches</span>
            </span>
            <button
              type="button"
              onClick={handleClearAllHistory}
              className="text-primary hover:underline text-[11px]"
            >
              Clear All
            </button>
          </div>
        )}

        {suggestions.map((item, index) => {
          return (
            <div
              key={`${item.term}-${index}`}
              onClick={() => {
                if (item.product) {
                  navigate(getProductUrl(item.product));
                } else {
                  executeSearch(item.term);
                }
              }}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/80 active:bg-slate-100 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                {/* Left Thumbnail (matching Image 2 phone/product icon) */}
                <div className="w-9 h-11 shrink-0 rounded-xs bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden p-0.5">
                  {item.image ? (
                    <img
                      src={applyCloudinaryTransform(item.image, 'f_auto,q_auto,w_100')}
                      alt={item.term}
                      className="w-full h-full object-contain"
                    />
                  ) : item.isRecent ? (
                    <History size={17} className="text-slate-400" />
                  ) : (
                    <Search size={16} className="text-slate-400" />
                  )}
                </div>

                {/* Center Text (Bold term + Optional blue category) */}
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

              {/* Right: Diagonal Arrow (matching Image 2) or Remove for recent */}
              <div className="flex items-center gap-1 pl-2">
                {item.isRecent && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveSearch(e, item.term)}
                    className="p-1.5 text-slate-300 hover:text-slate-500 rounded-full active:scale-90"
                    title="Remove from history"
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
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
                  aria-label="Search this term"
                >
                  <ArrowUpRight size={18} strokeWidth={1.8} />
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
