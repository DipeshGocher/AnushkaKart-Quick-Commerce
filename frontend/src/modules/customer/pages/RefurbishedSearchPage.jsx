import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Mic, ArrowLeft, X, TrendingUp, History, Smartphone, ChevronRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { customerApi } from '../services/customerApi';
import ProductCard from '../components/shared/ProductCard';
import { getMobileBrandLogo } from '@shared/constants/mobileBrandLogos';

const POPULAR_BRANDS = [
  'Apple', 'Samsung', 'Motorola', 'OnePlus', 'Xiaomi', 'Realme', 'Vivo', 'Oppo', 'Google Pixel', 'Poco', 'Nothing', 'iQOO'
];

const RECENT_SEARCHES_KEY = 'anushka_refurbished_recent_searches';

const RefurbishedSearchPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const initialQuery = location.state?.query || new URLSearchParams(location.search).get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [allRefurbishedProducts, setAllRefurbishedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);

  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      return saved ? JSON.parse(saved) : ['iPhone 15', 'Samsung S24', 'Motorola Edge', 'OnePlus 12'];
    } catch (e) {
      return ['iPhone 15', 'Samsung S24', 'Motorola Edge', 'OnePlus 12'];
    }
  });

  // Debounce logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Save search to recent list
  const saveSearchTerm = (term) => {
    const t = term.trim();
    if (!t) return;
    const updated = [t, ...recentSearches.filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, 10);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const removeRecentSearch = (e, term) => {
    e.stopPropagation();
    const updated = recentSearches.filter((s) => s !== term);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  // Fetch Refurbished Products
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await customerApi.getRefurbishedProducts({
          conditionType: 'refurbished',
          sort: 'newest',
          limit: 1000,
        });
        const items = res?.data?.result?.items || res?.data?.items || (Array.isArray(res?.data) ? res.data : []);
        setAllRefurbishedProducts(Array.isArray(items) ? items : []);
      } catch (err) {
        console.error("Failed to load refurbished products for search:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Voice Search Handler
  const handleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice search is not supported in your browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setQuery('');
    };

    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript) {
        setQuery(transcript);
        if (event.results[event.results.length - 1].isFinal) {
          saveSearchTerm(transcript);
        }
      }
    };

    try {
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  // Filtered & Ranked Results
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return [];

    const term = debouncedQuery.toLowerCase().trim();

    const matches = allRefurbishedProducts.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      const model = (p.model || '').toLowerCase();

      // Check full string inclusion or word prefix startsWith
      const words = name.split(/\s+/);
      const brandWords = brand.split(/\s+/);

      const startsWithTerm = words.some((w) => w.startsWith(term)) || brandWords.some((w) => w.startsWith(term));

      return startsWithTerm || name.includes(term) || brand.includes(term) || model.includes(term);
    });

    // Rank results: exact name/brand startsWith first, then word startsWith, then general inclusion
    return matches.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      const brandA = (a.brand || '').toLowerCase();
      const brandB = (b.brand || '').toLowerCase();

      const aDirectStart = nameA.startsWith(term) || brandA.startsWith(term);
      const bDirectStart = nameB.startsWith(term) || brandB.startsWith(term);

      if (aDirectStart && !bDirectStart) return -1;
      if (!aDirectStart && bDirectStart) return 1;

      const aWordStart = nameA.split(/\s+/).some((w) => w.startsWith(term));
      const bWordStart = nameB.split(/\s+/).some((w) => w.startsWith(term));

      if (aWordStart && !bWordStart) return -1;
      if (!aWordStart && bWordStart) return 1;

      return nameA.localeCompare(nameB);
    });
  }, [debouncedQuery, allRefurbishedProducts]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      saveSearchTerm(query);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f4f8] font-outfit pb-20">
      {/* Top Header with Blue Gradient Light Transparent Theme */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 border-b border-blue-300/30 shadow-md">
        {/* Soft Ambient Light Glass Highlights */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-sky-300/20 rounded-full -ml-12 -mb-12 blur-xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-3.5 py-3.5 flex items-center gap-2.5 relative z-10">
          <button
            onClick={() => navigate('/refurbished')}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition active:scale-95 shrink-0"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>

          {/* Search Input Box */}
          <div className="flex-1 relative flex items-center bg-white rounded-full shadow-lg border border-white/90 overflow-hidden px-3.5 py-2">
            <Search size={18} className="text-blue-500 shrink-0 mr-2" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search refurbished phones, brands (e.g. iPhone, Moto)..."
              className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 outline-none"
            />
            {query ? (
              <button
                onClick={() => setQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleVoiceSearch}
                className={`p-1 transition-colors shrink-0 ${isListening ? 'text-red-500 animate-pulse' : 'text-blue-500 hover:text-blue-700'}`}
              >
                <Mic size={17} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-3.5 pt-4">
        {/* If Query is Empty -> Show Recent Searches & Popular Brands */}
        {!debouncedQuery.trim() ? (
          <div className="space-y-5">
            {/* Recent Searches Section */}
            {recentSearches.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <History size={14} className="text-blue-500" />
                    Recent Searches
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setQuery(term);
                        saveSearchTerm(term);
                      }}
                      className="flex items-center gap-1.5 bg-blue-50/80 hover:bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-200/60 transition"
                    >
                      <span>{term}</span>
                      <X
                        size={12}
                        className="text-blue-400 hover:text-blue-600"
                        onClick={(e) => removeRecentSearch(e, term)}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Refurbished Brands */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-100">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Smartphone size={14} className="text-blue-500" />
                Popular Brands
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5">
                {POPULAR_BRANDS.map((brandName) => {
                  const logo = getMobileBrandLogo(brandName);
                  return (
                    <button
                      key={brandName}
                      onClick={() => {
                        saveSearchTerm(brandName);
                        navigate(`/refurbished/products?brand=${encodeURIComponent(brandName)}`);
                      }}
                      className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/80 border border-slate-200/70 hover:border-blue-300 transition group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white p-1 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                        {logo?.dataUri ? (
                          <img src={logo.dataUri} alt={brandName} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-sm font-bold text-blue-600">{brandName[0]}</span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 mt-1.5 truncate max-w-full">
                        {brandName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Top Featured Refurbished Devices */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles size={16} className="text-blue-600" />
                  Top Refurbished Deals
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {allRefurbishedProducts.slice(0, 10).map((product) => (
                  <ProductCard key={product._id} product={{ ...product, conditionType: 'refurbished' }} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Real-time Search Results View */
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs sm:text-sm font-bold text-slate-700">
                Found <span className="text-blue-600">{searchResults.length}</span> refurbished products matching "{debouncedQuery}"
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-blue-100 shadow-sm my-4">
                <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-500">
                  <Search size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-800">No refurbished phones found</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Try searching for a different brand like "Apple", "Samsung", "Motorola" or model name like "iPhone 15".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {searchResults.map((product) => (
                  <ProductCard key={product._id} product={{ ...product, conditionType: 'refurbished' }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RefurbishedSearchPage;
