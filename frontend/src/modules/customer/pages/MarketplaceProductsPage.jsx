import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Bell, MapPin, ChevronDown, Plus, 
  Sparkles, ShieldCheck, Filter, ArrowUpDown, CheckCircle2,
  SlidersHorizontal, X, ArrowRight, Heart, Mic
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FlipkartHeaderSectionSwitcher from '../components/shared/FlipkartHeaderSectionSwitcher';
import { 
  C2C_CATEGORIES, 
  getC2CAds, 
  getC2CFavorites, 
  toggleC2CFavorite 
} from '../data/c2cMockData';
import MarketplaceLocationModal, { getSavedLocation, saveUserLocation } from '../components/c2c/MarketplaceLocationModal';
import { toast } from 'sonner';

const DEFAULT_BANNER_IMAGE = '/c2c_home_banner.png';

const MarketplaceProductsPage = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState(getSavedLocation());
  const [sortBy, setSortBy] = useState('featured'); // 'featured', 'low-to-high', 'high-to-low', 'verified'
  const [ads, setAds] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAllCategoriesModal, setShowAllCategoriesModal] = useState(false);
  const [bannerImage, setBannerImage] = useState(DEFAULT_BANNER_IMAGE);

  // Load ads, favorites, customized banner, and listen to location changes
  useEffect(() => {
    const loadedAds = getC2CAds();
    setAds(loadedAds);
    setFavorites(getC2CFavorites());

    const savedBanner = localStorage.getItem('c2c_banner_image');
    if (savedBanner && !savedBanner.includes('unsplash')) {
      setBannerImage(savedBanner);
    } else {
      setBannerImage(DEFAULT_BANNER_IMAGE);
    }

    const onLocationChange = (e) => {
      if (e.detail) setSelectedLocation(e.detail);
      else setSelectedLocation(getSavedLocation());
    };
    window.addEventListener('c2c_location_changed', onLocationChange);
    return () => window.removeEventListener('c2c_location_changed', onLocationChange);
  }, []);

  // Handle favorite toggle
  const handleToggleFavorite = (e, adId) => {
    e.stopPropagation();
    const isNowFav = toggleC2CFavorite(adId);
    setFavorites(getC2CFavorites());
    if (isNowFav) {
      toast.success('Added to your Wishlist');
    } else {
      toast.info('Removed from Wishlist');
    }
  };

  // Filtered & Sorted ads
  const filteredAds = useMemo(() => {
    return ads
      .filter((ad) => {
        // Category filter
        if (selectedCategory !== 'all') {
          if (selectedCategory === 'laptops' && (ad.category === 'laptops' || ad.category === 'electronics')) {
            // matches
          } else if (selectedCategory === 'electronics' && (ad.category === 'laptops' || ad.category === 'electronics')) {
            // matches
          } else if (ad.category !== selectedCategory && ad.categoryName?.toLowerCase() !== selectedCategory.toLowerCase()) {
            return false;
          }
        }
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = ad.title?.toLowerCase().includes(q);
          const matchDesc = ad.description?.toLowerCase().includes(q);
          const matchCat = ad.categoryName?.toLowerCase().includes(q);
          const matchCity = ad.city?.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchCat && !matchCity) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'low-to-high') return a.price - b.price;
        if (sortBy === 'high-to-low') return b.price - a.price;
        if (sortBy === 'verified') return (b.seller?.verified ? 1 : 0) - (a.seller?.verified ? 1 : 0);
        return 0; // default order
      });
  }, [ads, selectedCategory, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-28 text-slate-900 font-sans">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 pt-2.5 pb-2">
          {/* Header Switcher: Cart (Quick Commerce) vs Store (C2C Marketplace) */}
          <FlipkartHeaderSectionSwitcher />

          {/* Location & Quick Action Bar (Wishlist removed as requested) */}
          <div className="flex items-center justify-between gap-2 mt-1 mb-2">
            <button
              type="button"
              onClick={() => setShowLocationModal(true)}
              className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-[#0F4C81] font-semibold truncate max-w-[260px] py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <MapPin size={15} className="text-[#0F4C81] shrink-0" />
              <span className="truncate">{selectedLocation}</span>
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </button>

            {/* Quick Actions Bar: Wishlist + Notifications */}
            <div className="flex items-center gap-1">
              {/* Wishlist Icon left to Notification Icon */}
              <button
                type="button"
                onClick={() => navigate('/marketplace/wishlist')}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-700 hover:text-[#0F4C81] transition-colors relative cursor-pointer"
                title="Saved Items / Wishlist"
              >
                <Heart size={19} />
              </button>

              {/* Notification Bell Icon */}
              <button
                type="button"
                onClick={() => navigate('/marketplace/notification')}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-700 hover:text-[#0F4C81] transition-colors relative cursor-pointer"
                title="Notifications"
              >
                <Bell size={19} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
              </button>
            </div>
          </div>

          {/* Search Bar - OLX Style: Tapping navigates to /marketplace/search */}
          <div 
            onClick={() => navigate('/marketplace/search')}
            className="relative flex items-center cursor-pointer group"
          >
            <Search className="absolute left-3.5 text-slate-700 pointer-events-none" size={18} />
            <input
              type="text"
              readOnly
              placeholder='Find Mobiles, Laptops, SmartWatches and more...'
              className="w-full h-11 pl-10 pr-10 rounded-2xl bg-white border border-slate-300 group-hover:border-[#0F4C81] text-sm font-medium text-slate-900 placeholder:text-slate-500 cursor-pointer shadow-2xs transition-all"
            />
            <Mic className="absolute right-3.5 text-slate-500 pointer-events-none" size={18} />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 pt-3 space-y-4">
        {/* Promotional Banner (User's Custom Graphic Banner) */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-md aspect-[2.35/1] bg-[#7EB5F6]">
          <img
            src={bannerImage}
            alt="Pre-owned Mobiles & Laptops - Buy Sell Exchange"
            className="w-full h-full object-cover"
          />
        </div>

        {/* OLX-Style 2-Row Side Scrolling Categories with 'See All' Card */}
        <div className="bg-white rounded-3xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm sm:text-base font-extrabold text-[#0F4C81] tracking-tight flex items-center gap-1.5">
              Browse Categories
            </h3>
            {selectedCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="text-xs font-bold text-[#0F4C81] hover:underline"
              >
                Show All
              </button>
            )}
          </div>

          {/* 2-Row Horizontal Scroll Container (matching OLX reference screenshot with #f0f2f5 cards) */}
          <div className="relative">
            <div className="grid grid-rows-2 grid-flow-col auto-cols-[82px] sm:auto-cols-[90px] gap-2.5 overflow-x-auto pb-2 pt-0.5 no-scrollbar scroll-smooth">
              {C2C_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => navigate(`/marketplace/products?category=${cat.id}`)}
                    className="flex flex-col items-center group cursor-pointer text-center focus:outline-none"
                  >
                    <div className="w-full aspect-square rounded-2xl flex items-center justify-center p-2.5 transition-all duration-200 group-hover:scale-105 bg-[#e2e5ea] hover:bg-[#d4d8df]">
                      {cat.image ? (
                        <img src={cat.image} alt={cat.name} className="w-10 h-10 sm:w-11 sm:h-11 object-contain drop-shadow-xs" />
                      ) : (
                        <span className="text-xl">{cat.icon}</span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold leading-tight line-clamp-2 w-full text-center mt-1.5 text-slate-900 group-hover:text-[#0F4C81]">
                      {cat.name}
                    </span>
                  </button>
                );
              })}

              {/* TALL 'SEE ALL' CARD (Spanning both rows at the end, exactly like OLX) */}
              <button
                type="button"
                onClick={() => navigate('/marketplace/categories')}
                className="row-span-2 flex flex-col items-center justify-center p-3 rounded-2xl bg-[#f0f2f5] hover:bg-blue-50/70 border border-slate-200/70 hover:border-[#0F4C81]/50 text-slate-700 hover:text-[#0F4C81] transition-all group min-w-[82px] sm:min-w-[90px] shadow-2xs cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 text-[#0F4C81] flex items-center justify-center mb-2 shadow-xs group-hover:translate-x-1 transition-transform">
                  <ArrowRight size={18} strokeWidth={2.5} />
                </div>
                <span className="text-xs font-black tracking-tight">
                  See all
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Section Header: Fresh Recommendations (Extra sort fields removed from home) */}
        <div className="flex items-center justify-between px-1 pt-1 pb-1">
          <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Fresh Recommendations
          </h3>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
            {filteredAds.length} items
          </span>
        </div>

        {/* 2-Column Responsive Card Grid (Authentic OLX Layout) */}
        {filteredAds.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center my-6 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-[#0F4C81] flex items-center justify-center mx-auto mb-3 text-2xl">
              🔍
            </div>
            <h4 className="text-base font-extrabold text-slate-900 mb-1">No Listings Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4 font-medium">
              We couldn't find any active ads matching your search or filter. Try a different term or browse other categories.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSortBy('featured');
              }}
              className="px-4 py-2 rounded-xl bg-[#0F4C81] text-white font-bold text-xs shadow-md hover:bg-[#0A365C] transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {filteredAds.map((ad) => {
              const isFav = favorites.includes(ad.id);
              return (
                <div
                  key={ad.id}
                  onClick={() => navigate(`/marketplace/product/${ad.id}`)}
                  className="group bg-white rounded-2xl border border-slate-200 hover:border-[#0F4C81]/60 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer flex flex-col relative shadow-xs"
                >
                  {/* Image Container with Heart Button */}
                  <div className="relative w-full aspect-4/3 bg-slate-100 overflow-hidden">
                    <img
                      src={ad.images?.[0] || 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500&auto=format&fit=crop&q=80'}
                      alt={ad.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />



                    {/* Favorite Heart Button */}
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

                    {/* Condition Tag */}
                    <div className="absolute bottom-1.5 left-2 bg-slate-900/80 backdrop-blur-md text-white font-bold text-[9px] px-2 py-0.5 rounded-full">
                      {ad.condition}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Price in Classic Blue #0F4C81 */}
                      <div className="flex items-baseline gap-1.5 mb-1">
                        <span className="text-base sm:text-lg font-black text-[#0F4C81] tracking-tight">
                          ₹{ad.price?.toLocaleString('en-IN')}
                        </span>
                        {ad.originalPrice && (
                          <span className="text-[11px] text-slate-400 line-through">
                            ₹{ad.originalPrice?.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-[#0F4C81] transition-colors">
                        {ad.title}
                      </h4>
                    </div>

                    {/* Bottom Metadata: Location & Time */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                      <span className="truncate max-w-[90px] sm:max-w-[120px] flex items-center gap-0.5 font-medium">
                        <MapPin size={11} className="shrink-0 text-[#0F4C81]" />
                        {ad.location?.split(',')[0] || ad.city}
                      </span>
                      <span className="font-semibold text-slate-400 uppercase text-[9px] shrink-0">
                        {ad.postedAt}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 'See All Categories' Modal */}
      <AnimatePresence>
        {showAllCategoriesModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <span>Explore All Categories</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAllCategoriesModal(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 py-4 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setShowAllCategoriesModal(false);
                  }}
                  className={`p-3 rounded-2xl border flex flex-col items-center justify-center text-center transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-[#0F4C81] text-white border-[#0F4C81]'
                      : 'bg-[#F8FAFC] border-slate-200 hover:border-[#0F4C81]/40 text-slate-800'
                  }`}
                >
                  <span className="text-2xl mb-1">⚡</span>
                  <span className="text-xs font-bold">All Deals</span>
                </button>

                {C2C_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setShowAllCategoriesModal(false);
                    }}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center text-center transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-[#0F4C81] text-white border-[#0F4C81]'
                        : 'bg-[#F8FAFC] border-slate-200 hover:border-[#0F4C81]/40 text-slate-800'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl overflow-hidden mb-1 flex items-center justify-center">
                      {cat.image ? (
                        <img src={cat.image} alt={cat.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <span className="text-2xl">{cat.icon}</span>
                      )}
                    </div>
                    <span className="text-xs font-bold leading-tight">{cat.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Location Picker Modal */}
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

export default MarketplaceProductsPage;
