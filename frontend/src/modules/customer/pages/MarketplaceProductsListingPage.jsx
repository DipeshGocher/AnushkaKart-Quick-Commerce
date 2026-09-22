import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Search, Mic, MapPin, SlidersHorizontal, ChevronDown, 
  Heart, X, Check, Sparkles, AlertCircle, ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getC2CAds, getC2CFavorites, toggleC2CFavorite, C2C_CATEGORIES } from '../data/c2cMockData';
import MarketplaceLocationModal, { getSavedLocation, saveUserLocation } from '../components/c2c/MarketplaceLocationModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MarketplaceProductsListingPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read query params
  const isWishlistView = searchParams.get('view') === 'wishlist';
  const initialQuery = searchParams.get('search') || '';
  const initialCategory = searchParams.get('category') || 'all';
  const initialSubCategory = searchParams.get('subCategory') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedSubCategory, setSelectedSubCategory] = useState(initialSubCategory);
  const [locationText, setLocationText] = useState(getSavedLocation());
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Sorting & Filtering
  const [sortBy, setSortBy] = useState('relevance'); // 'relevance', 'low-to-high', 'high-to-low', 'newest'
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState('all');

  // Ads & Favorites data
  const [ads, setAds] = useState([]);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    setAds(getC2CAds());
    setFavorites(getC2CFavorites());
    const onLocationChange = (e) => {
      if (e.detail) setLocationText(e.detail);
      else setLocationText(getSavedLocation());
    };
    window.addEventListener('c2c_location_changed', onLocationChange);
    return () => window.removeEventListener('c2c_location_changed', onLocationChange);
  }, []);

  // Synchronize when searchParams change in URL
  useEffect(() => {
    const q = searchParams.get('search') || '';
    const cat = searchParams.get('category') || 'all';
    const sub = searchParams.get('subCategory') || '';
    setSearchQuery(q);
    setSelectedCategory(cat);
    setSelectedSubCategory(sub);
  }, [searchParams]);

  const handleToggleFavorite = (e, adId) => {
    e.stopPropagation();
    const isNowFav = toggleC2CFavorite(adId);
    setFavorites(getC2CFavorites());
    if (isNowFav) {
      toast.success('Saved to your favorites');
    } else {
      toast.info('Removed from favorites');
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
    } else {
      params.delete('search');
    }
    setSearchParams(params);
  };

  // Fine-tuned Filtering & Multi-keyword Searching
  const filteredProducts = useMemo(() => {
    return ads.filter((item) => {
      // 0. Wishlist filter
      if (isWishlistView && !favorites.includes(item.id)) {
        return false;
      }
      // 1. Search Query with multi-token word matching
      if (searchQuery.trim()) {
        const queryTokens = searchQuery.toLowerCase().trim().split(/\s+/);
        const searchableText = [
          item.title,
          item.description,
          item.categoryName,
          item.category,
          item.subCategory,
          item.location,
          item.city,
          item.specs ? Object.values(item.specs).join(' ') : ''
        ].filter(Boolean).join(' ').toLowerCase();

        // Check if every token exists in the searchable text (e.g. "acer" + "laptop" or "s22" + "ultra")
        const allTokensMatch = queryTokens.every(token => searchableText.includes(token));
        if (!allTokensMatch) return false;
      }

      // 2. Category Filter
      if (selectedCategory && selectedCategory !== 'all') {
        if (selectedCategory === 'bikes' && (item.category === 'bikes' || item.category === 'vehicles')) {
          // matched
        } else if (item.category !== selectedCategory) {
          return false;
        }
      }

      // 3. SubCategory Filter
      if (selectedSubCategory && selectedSubCategory.trim()) {
        const itemSub = (item.subCategory || '').toLowerCase();
        const targetSub = selectedSubCategory.toLowerCase();
        if (itemSub && !itemSub.includes(targetSub) && !targetSub.includes(itemSub)) {
          // If item doesn't explicitly match subcategory but matches category, allow if query aligns
        }
      }

      // 4. Price Filter
      if (priceRange.min && item.price < Number(priceRange.min)) return false;
      if (priceRange.max && item.price > Number(priceRange.max)) return false;

      // 5. Condition Filter
      if (selectedCondition !== 'all') {
        const cond = (item.condition || '').toLowerCase();
        if (selectedCondition === 'like-new' && !cond.includes('like new')) return false;
        if (selectedCondition === 'brand-new' && !cond.includes('brand new')) return false;
        if (selectedCondition === 'good' && !cond.includes('good')) return false;
      }

      // 6. Verified Seller Filter
      if (onlyVerified && !item.seller?.verified) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'low-to-high') return a.price - b.price;
      if (sortBy === 'high-to-low') return b.price - a.price;
      if (sortBy === 'newest') {
        // featured or recent
        return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
      }
      // Relevance (Default): Featured first, then rating
      if (b.isFeatured !== a.isFeatured) return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
      return (b.seller?.rating || 0) - (a.seller?.rating || 0);
    });
  }, [ads, favorites, isWishlistView, searchQuery, selectedCategory, selectedSubCategory, priceRange, selectedCondition, onlyVerified, sortBy]);

  // Active filter label
  const activeResultsTitle = useMemo(() => {
    if (isWishlistView) return 'My Wishlist';
    if (searchQuery.trim()) return searchQuery.trim();
    if (selectedSubCategory) return selectedSubCategory;
    if (selectedCategory && selectedCategory !== 'all') {
      const cat = C2C_CATEGORIES.find(c => c.id === selectedCategory);
      return cat ? cat.name : selectedCategory;
    }
    return 'All Listings';
  }, [isWishlistView, searchQuery, selectedSubCategory, selectedCategory]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-28">
      {/* Top Header matching Image 1 */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-3xl mx-auto px-3 py-2.5 flex items-center gap-2">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-1 text-slate-800 hover:bg-slate-100 rounded-full active:scale-95 transition-all"
            aria-label="Back"
          >
            <ArrowLeft size={22} strokeWidth={2.5} />
          </button>

          {/* Search Input Box with Mic */}
          <form onSubmit={handleSearchSubmit} className="flex-1 relative flex items-center">
            <Search className="absolute left-3 text-slate-400 pointer-events-none" size={17} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find Cars, Mobile Phones and..."
              className="w-full h-10 pl-9 pr-9 rounded-xl bg-slate-100/90 border border-slate-200 focus:bg-white focus:border-[#0F4C81] text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-500 focus:outline-none transition-all shadow-inner"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  const p = new URLSearchParams(searchParams);
                  p.delete('search');
                  setSearchParams(p);
                }}
                className="absolute right-3 p-1 text-slate-400 hover:text-slate-700"
              >
                <X size={15} />
              </button>
            ) : (
              <Mic className="absolute right-3 text-slate-400 pointer-events-none" size={17} />
            )}
          </form>

          {/* Location Pin Button */}
          <button
            type="button"
            onClick={() => setShowLocationModal(true)}
            className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
            title={locationText}
          >
            <MapPin size={20} className="text-[#0F4C81]" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-3 sm:px-4 pt-3 space-y-3">
        {/* Filter & Sort Bar matching Image 1 */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {/* Filters Button */}
          <button
            type="button"
            onClick={() => setShowFilterModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-800 hover:border-[#0F4C81] shadow-2xs transition-colors"
          >
            <SlidersHorizontal size={14} className="text-[#0F4C81]" />
            <span>Filters</span>
          </button>

          {/* Sort By Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-800 hover:border-[#0F4C81] shadow-2xs transition-colors"
            >
              <span>Sort By</span>
              <ChevronDown size={14} className={cn("text-slate-500 transition-transform", showSortDropdown && "rotate-180")} />
            </button>

            {showSortDropdown && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 py-1 divide-y divide-slate-100 overflow-hidden animate-in fade-in-50 zoom-in-95">
                {[
                  { id: 'relevance', label: 'Relevance' },
                  { id: 'low-to-high', label: 'Price: Low to High' },
                  { id: 'high-to-low', label: 'Price: High to Low' },
                  { id: 'newest', label: 'Newest First' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortBy(opt.id);
                      setShowSortDropdown(false);
                    }}
                    className={cn(
                      "w-full px-3.5 py-2 text-left text-xs flex items-center justify-between font-semibold transition-colors",
                      sortBy === opt.id ? "text-[#0F4C81] bg-blue-50/60 font-bold" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span>{opt.label}</span>
                    {sortBy === opt.id && <Check size={14} className="text-[#0F4C81]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results Info & Count Pill matching Image 1 */}
        <div className="flex items-center justify-between px-0.5 pt-1 pb-1">
          <p className="text-xs text-slate-600 font-medium truncate">
            Showing results for <span className="font-bold text-slate-900">{activeResultsTitle}</span>
          </p>
          <span className="shrink-0 bg-blue-50 text-[#0F4C81] font-bold text-[11px] px-2.5 py-0.5 rounded-full border border-blue-100">
            {filteredProducts.length} items
          </span>
        </div>

        {/* Product Listing Items matching Image 1 exactly */}
        {filteredProducts.length > 0 ? (
          <div className="space-y-3">
            {filteredProducts.map((item) => {
              const isFav = favorites.includes(item.id);

              return (
                <article
                  key={item.id}
                  onClick={() => navigate(`/marketplace/product/${item.id}`)}
                  className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md hover:border-[#0F4C81]/40 transition-all cursor-pointer flex flex-row active:scale-[0.995]"
                >
                  {/* Left: Product Thumbnail matching Image 1 */}
                  <div className="w-36 sm:w-44 shrink-0 relative bg-slate-100 overflow-hidden">
                    <img
                      src={item.images?.[0]}
                      alt={item.title}
                      className="w-full h-full min-h-[120px] max-h-[145px] object-cover"
                      loading="lazy"
                    />
                    <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-xs text-[9px] font-black text-white px-1 rounded tracking-wider">
                      OLX
                    </div>
                  </div>

                  {/* Right: Content Area matching Image 1 */}
                  <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <div>
                      {/* Top Action Row */}
                      <div className="flex items-center justify-end gap-1 mb-1">

                        {/* Favorite Button */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(e, item.id)}
                          className="p-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                          aria-label={isFav ? "Remove from wishlist" : "Add to wishlist"}
                        >
                          <Heart 
                            size={18} 
                            className={cn(
                              "transition-all",
                              isFav ? "text-rose-500 fill-rose-500 scale-110" : "text-slate-600 hover:text-slate-900"
                            )} 
                          />
                        </button>
                      </div>

                      {/* Price in Bold 18px-20px matching Image 1 */}
                      <div className="text-lg sm:text-xl font-black text-slate-950 tracking-tight">
                        ₹ {item.price?.toLocaleString('en-IN')}
                      </div>

                      {/* Product Title */}
                      <h3 className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-2 mt-0.5 leading-snug">
                        {item.title}
                      </h3>
                    </div>

                    {/* Bottom: Location & Date matching Image 1 */}
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium pt-2 border-t border-slate-100/60 mt-2">
                      <span className="truncate max-w-[120px]">{item.location || item.city}</span>
                      <span className="shrink-0">{item.postedAt}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : isWishlistView ? (
          /* Dedicated Empty State for Wishlist */
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 my-6 shadow-2xs">
            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 mx-auto flex items-center justify-center">
              <Heart size={28} className="fill-rose-500 text-rose-500" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Your Wishlist is Empty
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Explore listings in the marketplace and tap the heart icon on any ad to save your favorite products here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/marketplace')}
              className="px-6 py-2.5 rounded-xl bg-[#0F4C81] text-white text-xs font-bold shadow-sm hover:bg-[#0A365C] transition-all"
            >
              Explore Marketplace
            </button>
          </div>
        ) : (
          /* Empty State when no results found */
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 my-6 shadow-2xs">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-[#0F4C81] mx-auto flex items-center justify-center">
              <Search size={30} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                No items found
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                We couldn't find anything matching "<span className="font-semibold text-slate-700">{searchQuery}</span>". Try different keywords or reset filters.
              </p>
            </div>

            {/* Popular Suggested Search Chips */}
            <div className="pt-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Popular Searches
              </span>
              <div className="flex flex-wrap justify-center gap-1.5">
                {['Samsung S22 Ultra', 'iPhone 12', 'Acer Laptop', 'Royal Enfield', 'MacBook Air'].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setSearchQuery(chip);
                      const p = new URLSearchParams(searchParams);
                      p.set('search', chip);
                      setSearchParams(p);
                    }}
                    className="px-3 py-1 bg-slate-100 hover:bg-blue-50 hover:text-[#0F4C81] rounded-full text-xs font-semibold text-slate-700 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedSubCategory('');
                setPriceRange({ min: '', max: '' });
                setSelectedCondition('all');
                setOnlyVerified(false);
                setSearchParams({});
              }}
              className="px-5 py-2 rounded-xl bg-[#0F4C81] text-white text-xs font-bold shadow-sm hover:bg-[#0A365C] transition-all"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </main>

      {/* Filter Modal Drawer */}
      <AnimatePresence>
        {showFilterModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900">Filters</h3>
                <button
                  type="button"
                  onClick={() => setShowFilterModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Price Range Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Price Range (₹)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min Price"
                    value={priceRange.min}
                    onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                    className="w-1/2 h-10 px-3 rounded-xl border border-slate-200 text-xs font-medium focus:border-[#0F4C81] outline-none"
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="number"
                    placeholder="Max Price"
                    value={priceRange.max}
                    onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                    className="w-1/2 h-10 px-3 rounded-xl border border-slate-200 text-xs font-medium focus:border-[#0F4C81] outline-none"
                  />
                </div>
              </div>

              {/* Condition Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Item Condition</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'like-new', label: 'Like New' },
                    { id: 'good', label: 'Good' },
                  ].map((cond) => (
                    <button
                      key={cond.id}
                      type="button"
                      onClick={() => setSelectedCondition(cond.id)}
                      className={cn(
                        "py-2 px-2 rounded-xl text-xs font-bold border transition-all",
                        selectedCondition === cond.id
                          ? "bg-[#0F4C81] text-white border-[#0F4C81]"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300"
                      )}
                    >
                      {cond.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Verified Seller Switch */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Verified Sellers Only</span>
                  <span className="text-[10px] text-slate-500">Show listings from identity-verified users</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOnlyVerified(!onlyVerified)}
                  className={cn(
                    "w-11 h-6 rounded-full transition-colors relative p-0.5",
                    onlyVerified ? "bg-[#0F4C81]" : "bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full bg-white transition-transform shadow-xs",
                    onlyVerified ? "translate-x-5" : "translate-x-0"
                  )} />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPriceRange({ min: '', max: '' });
                    setSelectedCondition('all');
                    setOnlyVerified(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilterModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#0F4C81] text-white text-xs font-bold hover:bg-[#0A365C]"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* State & City Location Modal */}
      <MarketplaceLocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        selectedLocation={locationText}
        onSelectLocation={(loc) => {
          setLocationText(loc);
          saveUserLocation(loc);
        }}
      />
    </div>
  );
};

export default MarketplaceProductsListingPage;
