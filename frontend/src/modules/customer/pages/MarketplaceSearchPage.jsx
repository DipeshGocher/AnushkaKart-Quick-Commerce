import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  X, Search, MapPin, Mic, Heart, Sparkles, ChevronDown, 
  ArrowLeft, SlidersHorizontal, ArrowUpDown, CheckCircle2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  C2C_CATEGORIES, 
  getC2CAds, 
  getC2CFavorites, 
  toggleC2CFavorite 
} from '../data/c2cMockData';
import MarketplaceLocationModal, { getSavedLocation, saveUserLocation } from '../components/c2c/MarketplaceLocationModal';
import { toast } from 'sonner';

const MarketplaceSearchPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchInputRef = useRef(null);

  const initialCat = searchParams.get('category') || 'all';
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCat);
  const [selectedLocation, setSelectedLocation] = useState(getSavedLocation());
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [ads, setAds] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    setAds(getC2CAds());
    setFavorites(getC2CFavorites());

    const onLocationChange = (e) => {
      if (e.detail) setSelectedLocation(e.detail);
      else setSelectedLocation(getSavedLocation());
    };
    window.addEventListener('c2c_location_changed', onLocationChange);
    return () => window.removeEventListener('c2c_location_changed', onLocationChange);
  }, []);

  // Auto-focus search input on mount if no pre-filled query
  useEffect(() => {
    if (!initialQuery && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [initialQuery]);

  const handleToggleFavorite = (e, adId) => {
    e.stopPropagation();
    const isNowFav = toggleC2CFavorite(adId);
    setFavorites(getC2CFavorites());
    if (isNowFav) {
      toast.success('Added to Wishlist');
    } else {
      toast.info('Removed from Wishlist');
    }
  };

  // Voice Search Mock
  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.info('Voice search simulated for "iPhone"');
      setQuery('iPhone');
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        toast.info('Listening... Speak now');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
        toast.error('Could not detect voice. Please try typing.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setQuery('iPhone');
    }
  };

  // Filter Ads based on search query, category, and location
  const filteredAds = useMemo(() => {
    return ads.filter((ad) => {
      const q = query.toLowerCase().trim();
      const matchesQuery = !q || (
        ad.title.toLowerCase().includes(q) ||
        ad.description?.toLowerCase().includes(q) ||
        ad.categoryName?.toLowerCase().includes(q) ||
        ad.location?.toLowerCase().includes(q)
      );

      const matchesCategory = selectedCategory === 'all' || 
        ad.category === selectedCategory || 
        ad.categoryName?.toLowerCase().includes(selectedCategory.toLowerCase());

      return matchesQuery && matchesCategory;
    });
  }, [ads, query, selectedCategory]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (query.trim()) {
      navigate(`/marketplace/products?search=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleCategoryClick = (catId) => {
    navigate(`/marketplace/products?category=${catId}`);
  };

  const handleRecentSearchClick = (term) => {
    navigate(`/marketplace/products?search=${encodeURIComponent(term)}`);
  };

  const hasActiveSearch = query.trim().length > 0 || selectedCategory !== 'all';

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col selection:bg-[#0F4C81]/15">
      {/* Top Header Bar matching OLX screenshot */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 px-3.5 pt-3 pb-2.5 shadow-2xs">
        <div className="max-w-2xl mx-auto space-y-2">
          {/* Search Row with Close (X) button */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-1 rounded-full text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
              title="Close search"
            >
              <X size={26} strokeWidth={2.4} />
            </button>

            {/* Pill Search Input with Form Submit */}
            <form onSubmit={handleSearchSubmit} className="flex-1 relative flex items-center">
              <Search size={18} className="absolute left-3.5 text-slate-600 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find Mobiles, Laptops, SmartWatches and more..."
                className="w-full h-11 pl-10 pr-10 rounded-xl bg-white border border-slate-800 focus:border-[#0F4C81] focus:ring-3 focus:ring-[#0F4C81]/15 text-[14.5px] font-medium text-slate-900 placeholder:text-slate-400 outline-hidden transition-all"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  className={`absolute right-3 p-1 transition-colors ${
                    isListening ? 'text-red-500 animate-pulse' : 'text-slate-600 hover:text-[#0F4C81]'
                  }`}
                  title="Search by voice"
                >
                  <Mic size={19} />
                </button>
              )}
            </form>
          </div>

          {/* Location Sub-pill Bar */}
          <div className="pl-9">
            <button
              type="button"
              onClick={() => setShowLocationModal(true)}
              className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-white flex items-center justify-between gap-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors truncate"
            >
              <div className="flex items-center gap-2 min-w-0 truncate">
                <MapPin size={16} className="text-slate-800 shrink-0" />
                <span className="truncate">{selectedLocation}</span>
              </div>
              <ChevronDown size={14} className="text-slate-500 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-6">
        {/* Popular Categories Grid (Exact OLX Background & Card Style) */}
        {!hasActiveSearch && (
          <section className="space-y-3.5">
            <h2 className="text-[17px] font-black text-slate-950 tracking-tight">
              Popular Categories
            </h2>

            {/* Exact Grid: 5 columns like OLX screenshot */}
            <div className="grid grid-cols-5 gap-x-2 gap-y-4 sm:gap-x-3.5">
              {C2C_CATEGORIES.slice(0, 10).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryClick(cat.id)}
                  className="flex flex-col items-center group cursor-pointer text-center focus:outline-none"
                >
                  {/* Square card with soft light gray background #f0f2f5 and rounded-2xl */}
                  <div className="w-full aspect-square rounded-2xl bg-[#f0f2f5] hover:bg-[#e4e7eb] flex items-center justify-center p-2.5 transition-all duration-200 group-hover:scale-105 group-hover:shadow-sm">
                    {cat.image ? (
                      <img
                        src={cat.image}
                        alt={cat.name}
                        className="w-11 h-11 sm:w-13 sm:h-13 object-contain drop-shadow-xs"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-2xl">{cat.icon}</span>
                    )}
                  </div>
                  {/* Category Name below card */}
                  <span className="text-[11px] sm:text-xs font-bold text-slate-900 mt-1.5 leading-tight line-clamp-2 w-full text-center">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Search Results Mode */}
        {hasActiveSearch && (
          <section className="space-y-4">
            {/* Active Filters Header */}
            <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedCategory !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#0F4C81] text-white text-xs font-bold shadow-xs">
                    {C2C_CATEGORIES.find(c => c.id === selectedCategory)?.name || selectedCategory}
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className="ml-1 hover:text-red-200"
                    >
                      <X size={13} />
                    </button>
                  </span>
                )}
                <span className="text-xs font-bold text-slate-500">
                  {filteredAds.length} {filteredAds.length === 1 ? 'item' : 'items'} found
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSelectedCategory('all');
                }}
                className="text-xs font-bold text-[#0F4C81] hover:underline"
              >
                Reset
              </button>
            </div>

            {/* Ads Grid */}
            {filteredAds.length === 0 ? (
              <div className="bg-slate-50 rounded-3xl p-8 text-center border border-slate-200 my-6">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-[#0F4C81] flex items-center justify-center mx-auto mb-3 text-2xl">
                  🔍
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mb-1">No Ads Found</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4 font-medium">
                  We couldn't find any listings matching your search. Try different keywords or browse popular categories.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSelectedCategory('all');
                  }}
                  className="px-5 py-2 rounded-xl bg-[#0F4C81] text-white text-xs font-extrabold shadow-md hover:bg-[#0A365C]"
                >
                  View All Categories
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {filteredAds.map((ad) => {
                  const isFav = favorites.includes(ad.id);
                  return (
                    <div
                      key={ad.id}
                      onClick={() => navigate(`/marketplace/product/${ad.id}`)}
                      className="group bg-white rounded-2xl border border-slate-200 hover:border-[#0F4C81]/60 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer flex flex-col relative shadow-2xs"
                    >
                      {/* Image Container */}
                      <div className="relative w-full aspect-4/3 bg-slate-100 overflow-hidden">
                        <img
                          src={ad.images?.[0] || 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500&auto=format&fit=crop&q=80'}
                          alt={ad.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />


                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(e, ad.id)}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-700 hover:text-red-500 hover:bg-white shadow-md transition-all active:scale-90"
                          title="Save Ad"
                        >
                          <Heart
                            size={16}
                            className={isFav ? "fill-red-500 text-red-500" : ""}
                          />
                        </button>

                        <div className="absolute bottom-1.5 left-2 bg-slate-900/80 backdrop-blur-md text-white font-bold text-[9px] px-2 py-0.5 rounded-full">
                          {ad.condition}
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="text-base sm:text-lg font-black text-[#0F4C81] tracking-tight mb-1">
                            ₹{ad.price?.toLocaleString('en-IN')}
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-[#0F4C81] transition-colors">
                            {ad.title}
                          </h4>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px] font-semibold text-slate-500">
                          <span className="truncate max-w-[65%]">{ad.location}</span>
                          <span className="shrink-0">{ad.postedAt}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* State & City Location Modal */}
      <MarketplaceLocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        selectedLocation={selectedLocation}
        onSelectLocation={(loc) => {
          setSelectedLocation(loc);
          saveUserLocation(loc);
        }}
      />
    </div>
  );
};

export default MarketplaceSearchPage;
