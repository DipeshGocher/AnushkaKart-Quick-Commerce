import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ShieldCheck, Smartphone, BatteryCharging, CheckCircle2, 
  RotateCcw, Award, Search, Heart, User, MapPin, ChevronDown, Mic, CloudRain,
  Laptop, Tablet, Headphones, Tv, Gamepad2, Camera, Speaker, Watch, Grid, ChevronRight, Zap
} from 'lucide-react';
import { getIconSvg } from '@shared/constants/categoryIcons';
import { customerApi } from '../services/customerApi';
import ProductCard from '../components/shared/ProductCard';
import LocationDrawer from '../components/shared/LocationDrawer';
import { useLocation } from '../context/LocationContext';
import { useWishlist } from '../context/WishlistContext';
import { useSettings } from '@core/context/SettingsContext';
import { getMobileBrandLogo } from '@shared/constants/mobileBrandLogos';

const SEARCH_PHRASES = [
  '"iPhone 15"',
  '"Galaxy S24"',
  '"OnePlus 12"',
  '"Apple"',
  '"Samsung"',
  '"Xiaomi"',
  '"Realme"',
  '"Pixel 8"'
];

const COLORFUL_ICONS = {
  all: { emoji: '📱', bg: 'from-blue-500 to-indigo-600', border: 'border-blue-400', icon: Smartphone },
  mobile: { emoji: '📱', bg: 'from-blue-500 to-indigo-600', border: 'border-blue-400', icon: Smartphone },
  mobiles: { emoji: '📱', bg: 'from-blue-500 to-indigo-600', border: 'border-blue-400', icon: Smartphone },
  laptop: { emoji: '💻', bg: 'from-indigo-500 to-purple-600', border: 'border-indigo-400', icon: Laptop },
  laptops: { emoji: '💻', bg: 'from-indigo-500 to-purple-600', border: 'border-indigo-400', icon: Laptop },
  tablet: { emoji: '📱', bg: 'from-teal-500 to-emerald-600', border: 'border-teal-400', icon: Tablet },
  tablets: { emoji: '📱', bg: 'from-teal-500 to-emerald-600', border: 'border-teal-400', icon: Tablet },
  audio: { emoji: '🎧', bg: 'from-purple-500 to-pink-600', border: 'border-purple-400', icon: Headphones },
  headphones: { emoji: '🎧', bg: 'from-purple-500 to-pink-600', border: 'border-purple-400', icon: Headphones },
  smartwatch: { emoji: '⌚', bg: 'from-rose-500 to-red-600', border: 'border-rose-400', icon: Watch },
  gaming: { emoji: '🎮', bg: 'from-violet-600 to-fuchsia-600', border: 'border-violet-400', icon: Gamepad2 },
  camera: { emoji: '📷', bg: 'from-amber-500 to-yellow-600', border: 'border-amber-400', icon: Camera },
};

const BRAND_ICONS = {
  all: { emoji: '📱', color: 'from-blue-600 to-indigo-700', text: 'All' },
  apple: { emoji: '🍎', color: 'from-slate-900 to-slate-700', text: 'Apple' },
  samsung: { emoji: '📱', color: 'from-blue-600 to-indigo-700', text: 'Samsung' },
  oneplus: { emoji: '⚡', color: 'from-red-600 to-rose-700', text: 'OnePlus' },
  xiaomi: { emoji: '🧡', color: 'from-orange-500 to-amber-600', text: 'Xiaomi' },
  realme: { emoji: '🟡', color: 'from-amber-400 to-yellow-500', text: 'Realme' },
  vivo: { emoji: '🔹', color: 'from-blue-500 to-cyan-600', text: 'Vivo' },
  oppo: { emoji: '🟢', color: 'from-emerald-500 to-teal-600', text: 'Oppo' },
  acer: { emoji: '💻', color: 'from-emerald-600 to-teal-700', text: 'Acer' },
  jbl: { emoji: '🔊', color: 'from-red-500 to-orange-600', text: 'JBL' },
  noise: { emoji: '🎧', color: 'from-purple-600 to-indigo-700', text: 'Noise' },
};

const DEFAULT_BRANDS = ['Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Realme', 'Vivo', 'Oppo'];

const ScallopDivider = ({ fillColor = "#EFF6FF" }) => (
  <div 
    className="w-full h-3 bg-repeat-x leading-none select-none pointer-events-none"
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 10' width='20' height='10'%3E%3Cpath d='M 0,10 Q 10,0 20,10 Z' fill='${encodeURIComponent(fillColor)}'/%3E%3C/svg%3E")`,
      backgroundSize: '16px 10px'
    }}
  />
);

const ScallopDividerBottom = ({ fillColor = "#EFF6FF" }) => (
  <div 
    className="w-full h-3 bg-repeat-x leading-none select-none pointer-events-none rotate-180"
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 10' width='20' height='10'%3E%3Cpath d='M 0,10 Q 10,0 20,10 Z' fill='${encodeURIComponent(fillColor)}'/%3E%3C/svg%3E")`,
      backgroundSize: '16px 10px'
    }}
  />
);

const RefurbishedProductsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const brandParam = searchParams.get('brand');
  const { coords, currentLocation } = useLocation();
  const { count: wishlistCount } = useWishlist();
  const { settings } = useSettings();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [headerCategories, setHeaderCategories] = useState([]);
  const [selectedHeaderId, setSelectedHeaderId] = useState('ALL');
  const [selectedSubCat, setSelectedSubCat] = useState(brandParam || 'All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocationOpen, setIsLocationOpen] = useState(false);

  useEffect(() => {
    if (brandParam) {
      setSelectedSubCat(brandParam);
    }
  }, [brandParam]);

  useEffect(() => {
    const fetchRefurbishedTree = async () => {
      try {
        const res = await customerApi.getCategories({ catalogType: 'refurbished', tree: 'true' });
        const items = res?.data?.result || res?.data?.results || res?.data || [];
        const treeArray = Array.isArray(items) ? items : [];
        const filteredHeaders = treeArray.filter((c) => c.catalogType === 'refurbished' || !c.catalogType);
        setHeaderCategories(filteredHeaders);
      } catch (err) {
        console.error("Failed to fetch refurbished category tree:", err);
      }
    };
    fetchRefurbishedTree();
  }, []);

  const headerTabs = React.useMemo(() => {
    const allTab = { _id: 'ALL', name: 'ALL', iconId: 'all' };
    if (headerCategories.length > 0) {
      return [allTab, ...headerCategories];
    }
    return [
      allTab,
      { _id: 'mobile', name: 'Mobile', iconId: 'smartphone' },
      { _id: 'laptop', name: 'Laptop', iconId: 'laptop' },
      { _id: 'tablets', name: 'Tablets', iconId: 'tablet' },
      { _id: 'audio', name: 'Audio', iconId: 'headphones' }
    ];
  }, [headerCategories]);

  const subCategoriesList = React.useMemo(() => {
    let list = [];
    if (selectedHeaderId === 'ALL') {
      const allSubs = [];
      headerCategories.forEach((header) => {
        if (header.children && Array.isArray(header.children)) {
          header.children.forEach((child) => {
            if (!allSubs.some((item) => item.name === child.name)) {
              allSubs.push(child);
            }
          });
        }
      });
      list = allSubs.length > 0 ? allSubs : DEFAULT_BRANDS.map((b) => ({ _id: b, name: b }));
    } else {
      const currentHeader = headerCategories.find(
        (h) => (h._id || h.id) === selectedHeaderId || h.name?.toLowerCase() === String(selectedHeaderId).toLowerCase()
      );

      if (currentHeader && currentHeader.children && currentHeader.children.length > 0) {
        list = currentHeader.children;
      } else {
        list = DEFAULT_BRANDS.map((b) => ({ _id: b, name: b }));
      }
    }

    // Always prepend "All" brand logo box at position 1
    const hasAll = list.some((item) => item.name?.toLowerCase() === 'all');
    if (!hasAll) {
      return [{ _id: 'ALL_BRANDS', name: 'All', isAll: true }, ...list];
    }
    return list;
  }, [headerCategories, selectedHeaderId]);

  // Typewriter search placeholder animation
  const [searchPlaceholder, setSearchPlaceholder] = useState('Search ');
  const [typingState, setTypingState] = useState({
    textIndex: 0,
    charIndex: 0,
    isDeleting: false,
    isPaused: false
  });

  useEffect(() => {
    const { textIndex, charIndex, isDeleting, isPaused } = typingState;
    const currentPhrase = SEARCH_PHRASES[textIndex];

    if (isPaused) {
      const timeout = setTimeout(() => {
        setTypingState((prev) => ({ ...prev, isPaused: false, isDeleting: true }));
      }, 2000);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (charIndex < currentPhrase.length) {
            setSearchPlaceholder('Search ' + currentPhrase.substring(0, charIndex + 1));
            setTypingState((prev) => ({ ...prev, charIndex: prev.charIndex + 1 }));
          } else {
            setTypingState((prev) => ({ ...prev, isPaused: true }));
          }
        } else {
          if (charIndex > 0) {
            setSearchPlaceholder('Search ' + currentPhrase.substring(0, charIndex - 1));
            setTypingState((prev) => ({ ...prev, charIndex: prev.charIndex - 1 }));
          } else {
            setTypingState((prev) => ({
              ...prev,
              isDeleting: false,
              textIndex: (prev.textIndex + 1) % SEARCH_PHRASES.length
            }));
          }
        }
      },
      isDeleting ? 50 : 100
    );

    return () => clearTimeout(timeout);
  }, [typingState]);

  useEffect(() => {
    fetchRefurbishedProducts();
  }, [selectedHeaderId, selectedSubCat, coords, searchQuery]);

  const fetchRefurbishedProducts = async () => {
    setLoading(true);
    try {
      const params = {
        conditionType: 'refurbished',
        sort: 'newest',
      };
      if (coords?.lat && coords?.lng) {
        params.lat = coords.lat;
        params.lng = coords.lng;
      }
      
      // 1. Header Category filtering
      if (selectedHeaderId && selectedHeaderId !== 'ALL') {
        const isHexId = /^[0-9a-fA-F]{24}$/.test(String(selectedHeaderId));
        if (isHexId) {
          params.headerId = selectedHeaderId;
        } else {
          const activeHeader = headerTabs.find((h) => (h._id || h.id) === selectedHeaderId);
          if (activeHeader && activeHeader.name && activeHeader.name !== 'ALL') {
            params.search = activeHeader.name;
          }
        }
      }

      // 2. Sub-Category / Brand Box filtering
      if (selectedSubCat && selectedSubCat !== 'All') {
        const matchingSub = subCategoriesList.find(
          (s) => s.name === selectedSubCat || s._id === selectedSubCat
        );
        if (matchingSub && matchingSub._id && /^[0-9a-fA-F]{24}$/.test(String(matchingSub._id))) {
          params.categoryId = matchingSub._id;
        } else {
          params.brand = selectedSubCat;
        }
      }

      // 3. User explicit search input
      const term = searchQuery.trim();
      if (term) {
        params.search = term;
      }

      const res = await customerApi.getRefurbishedProducts(params);
      let items = res?.data?.result?.items || res?.data?.items || (Array.isArray(res?.data) ? res.data : []);
      if (!Array.isArray(items)) items = [];

      setProducts(items);
    } catch (err) {
      console.error('Failed to fetch refurbished products', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      fetchRefurbishedProducts();
    }
  };

  const [showAllBrands, setShowAllBrands] = useState(false);

  const brandGroups = React.useMemo(() => {
    if (!Array.isArray(products) || products.length === 0) return [];

    const map = {};
    products.forEach((p) => {
      let b = p.brand || p.refurbishedDetails?.brand || '';
      if (!b) {
        const pName = p.name || '';
        const foundBrand = DEFAULT_BRANDS.find((brand) => pName.toLowerCase().includes(brand.toLowerCase()));
        b = foundBrand || 'Other Brands';
      }
      const key = b.trim();
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });

    const groups = [];
    Object.keys(map).forEach((bName) => {
      if (map[bName].length > 0) {
        groups.push({
          name: bName,
          items: map[bName]
        });
      }
    });

    return groups;
  }, [products]);

  const displayAddress = currentLocation?.address || currentLocation?.formattedAddress || "Corporate House, RNT Marg...";

  return (
    <div className="min-h-screen bg-slate-100/80 pb-28 font-outfit">
      {/* Location Drawer Modal */}
      <LocationDrawer isOpen={isLocationOpen} onClose={() => setIsLocationOpen(false)} />

      {/* Top Header Upper Section (Scrolls away on scroll) */}
      <div className="bg-gradient-to-b from-blue-100/95 via-sky-50 to-sky-50/90 pt-2.5 pb-2 px-3.5 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-2.5 relative z-10">
          
          {/* 1. Top Bar: Logo + Weather */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div 
                onClick={() => navigate('/')}
                className="cursor-pointer flex items-center gap-2"
              >
                <img 
                  src={settings?.logoUrl || "/logo.png"} 
                  alt="AnushkaStore Logo" 
                  className="h-9.5 w-auto object-contain shrink-0"
                  onError={(e) => {
                    e.target.src = "/logo.png";
                  }}
                />
                <div className="flex items-center gap-1 bg-blue-600/10 backdrop-blur-md px-2 py-0.5 rounded-full border border-blue-200/60 text-blue-700 text-[10px] font-bold">
                  <CloudRain size={11} className="text-blue-600" />
                  <span>Rain</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Location Delivery Selector */}
          <div 
            onClick={() => setIsLocationOpen(true)}
            className="flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <span className="text-[10px] uppercase font-bold text-blue-700/80 tracking-wider leading-none">DELIVER TO</span>
            <span className="text-[12.5px] sm:text-[13.5px] font-bold leading-tight max-w-[240px] sm:max-w-sm truncate text-slate-900">{displayAddress}</span>
            <ChevronDown size={13} className="text-blue-700 shrink-0" />
          </div>

          {/* 3. Premium Refurbished Electronics Heading Text */}
          <div className="pt-0.5 pb-0.5">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-700 leading-tight">
              Premium Refurbished Electronics
            </h1>
            <p className="text-blue-600/90 text-[11px] sm:text-xs font-medium tracking-wide">
              100% Tested • 32+ Quality Checks • Instant Delivery
            </p>
          </div>

        </div>
      </div>

      {/* Sticky Search Field (Sticks to top when scrolling down, matching quick commerce home) */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-sky-50/95 via-[#EFF6FF]/95 to-[#EFF6FF] backdrop-blur-md pt-1.5 pb-3 px-3.5 border-b border-blue-200/50 shadow-2xs">
        <div className="max-w-7xl mx-auto">
          <div className="relative flex items-center w-full bg-white rounded-2xl shadow-sm border border-blue-200/80 overflow-hidden px-3.5 py-2">
            <Search size={17} className="text-slate-400 shrink-0 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchSubmit}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 outline-none"
            />
            <button 
              type="button"
              onClick={() => {
                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                  const recognition = new SpeechRecognition();
                  recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    setSearchQuery(transcript);
                  };
                  recognition.start();
                }
              }}
              className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
            >
              <Mic size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Brands & Main Categories Section - Directly After Header Section */}
      {subCategoriesList.length > 0 && (() => {
        const MAX_BRANDS_LIMIT = 8;
        const visibleBrands = showAllBrands ? subCategoriesList : subCategoriesList.slice(0, MAX_BRANDS_LIMIT);

        return (
          <div className="max-w-7xl mx-auto px-4 mt-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone size={15} className="text-blue-600" />
                {selectedHeaderId === 'ALL'
                  ? 'Popular Refurbished Brands'
                  : `${headerTabs.find((h) => (h._id || h.id) === selectedHeaderId)?.name || 'Refurbished'} Brands`}
              </h2>
              
              <div className="flex items-center gap-2">
                {subCategoriesList.length > MAX_BRANDS_LIMIT && (
                  <button
                    onClick={() => setShowAllBrands((prev) => !prev)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 transition cursor-pointer"
                  >
                    <span>{showAllBrands ? 'Show Less' : 'Show All'}</span>
                    <ChevronRight size={13} className={`transition-transform duration-200 ${showAllBrands ? 'rotate-90' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
              {visibleBrands.map((sub) => {
                const isSubSelected = selectedSubCat === sub.name || (selectedSubCat === 'All' && (sub.isAll || sub.name?.toLowerCase() === 'all'));
                const bKey = sub.name?.toLowerCase().trim();
                const brandMeta = BRAND_ICONS[bKey];
                const isAllItem = sub.isAll || sub.name?.toLowerCase() === 'all';
                const presetBrandLogo = getMobileBrandLogo(isAllItem ? 'all' : sub.name);
                const logoUri = isAllItem ? (presetBrandLogo ? presetBrandLogo.dataUri : null) : (sub.image || (presetBrandLogo ? presetBrandLogo.dataUri : null));

                return (
                  <button
                    key={sub._id || sub.name}
                    onClick={() => {
                      if (sub.isAll || sub.name?.toLowerCase() === 'all') {
                        setSelectedSubCat('All');
                      } else if (isSubSelected) {
                        setSelectedSubCat('All');
                      } else {
                        setSelectedSubCat(sub.name);
                      }
                    }}
                    className={`p-2.5 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 border cursor-pointer ${
                      isSubSelected
                        ? 'bg-blue-50 border-blue-400 text-blue-600 shadow-md ring-2 ring-blue-500/30 scale-105'
                        : 'bg-white hover:bg-blue-50/70 border-slate-200/80 text-slate-800 hover:scale-102 shadow-xs'
                    }`}
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden p-1 shrink-0 border border-slate-100">
                      {logoUri ? (
                        <img
                          src={logoUri}
                          alt={sub.name}
                          className="w-full h-full object-contain rounded-lg p-0.5"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}

                      <div
                        className={`w-full h-full rounded-lg bg-gradient-to-br ${
                          brandMeta?.color || 'from-indigo-500 to-purple-600'
                        } text-white font-extrabold text-xs flex items-center justify-center uppercase shadow-xs`}
                        style={{ display: logoUri ? 'none' : 'flex' }}
                      >
                        {brandMeta?.emoji ? (
                          <span className="text-xl">{brandMeta.emoji}</span>
                        ) : (
                          sub.name?.slice(0, 2)
                        )}
                      </div>
                    </div>

                    <span className="text-[11.5px] font-bold text-center mt-1.5 line-clamp-1 leading-snug">
                      {sub.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Main Content Area - Full-Width Sections with Scalloped Top Dividers */}
      <div className="w-full mt-4">
        {loading ? (
          <div className="w-full">
            <ScallopDivider fillColor="#EFF6FF" />
            <div className="w-full bg-[#EFF6FF] py-5 px-4 sm:px-6">
              <div className="max-w-7xl mx-auto">
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-[155px] sm:w-[175px] shrink-0 bg-white rounded-xl p-3 border border-slate-200/80 animate-pulse space-y-3">
                      <div className="w-full h-28 bg-slate-200 rounded-lg" />
                      <div className="h-3 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                      <div className="h-7 bg-slate-200 rounded-lg" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : products.length > 0 ? (
          <div className="space-y-4">
            {/* 1. Latest Arrival Section (Full Width with Light Blue Scalloped Top Edge) */}
            <div className="w-full">
              <ScallopDivider fillColor="#EFF6FF" />
              <div className="w-full bg-[#EFF6FF] py-4 sm:py-5 px-4 sm:px-6">
                <div className="max-w-7xl mx-auto">
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Zap size={16} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h2 className="text-sm sm:text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5">
                          Latest Arrival
                        </h2>
                        <p className="text-[11px] font-semibold text-slate-500">
                          Recently added quality-tested electronics
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/refurbished/products')}
                      className="text-xs font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-white px-3.5 py-1.5 rounded-full border border-blue-200/80 shadow-2xs hover:bg-blue-50 transition cursor-pointer"
                    >
                      <span>See All</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {/* Horizontal Slider for Latest Arrival */}
                  <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar scrollbar-hide scroll-smooth snap-x">
                    {products.slice(0, 15).map((product) => (
                      <div key={product._id} className="w-[155px] sm:w-[175px] shrink-0 snap-start">
                        <ProductCard
                          product={product}
                          compact={true}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <ScallopDividerBottom fillColor="#EFF6FF" />
            </div>

            {/* 2. Individual Brand Sections (Full Width with Scalloped Top and Bottom Borders) */}
            {brandGroups.map((brandGroup) => {
              const presetLogo = getMobileBrandLogo(brandGroup.name);
              const logoUri = presetLogo ? presetLogo.dataUri : null;

              return (
                <div key={brandGroup.name} className="w-full">
                  <ScallopDivider fillColor="#EFF6FF" />
                  <div className="w-full bg-[#EFF6FF] py-4 sm:py-5 px-4 sm:px-6">
                    <div className="max-w-7xl mx-auto">
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center p-1 shadow-2xs overflow-hidden shrink-0">
                            {logoUri ? (
                              <img src={logoUri} alt={brandGroup.name} className="w-full h-full object-contain" />
                            ) : (
                              <span className="font-extrabold text-xs text-blue-600">{brandGroup.name.slice(0, 2)}</span>
                            )}
                          </div>
                          <div>
                            <h2 className="text-sm sm:text-base font-extrabold text-slate-800 tracking-tight">
                              {brandGroup.name} Refurbished
                            </h2>
                            <p className="text-[11px] font-semibold text-slate-500">
                              {brandGroup.items.length} item{brandGroup.items.length > 1 ? 's' : ''} available
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => navigate(`/refurbished/products?brand=${encodeURIComponent(brandGroup.name)}`)}
                          className="text-xs font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-white px-3.5 py-1.5 rounded-full border border-blue-200/80 shadow-2xs hover:bg-blue-50 transition cursor-pointer"
                        >
                          <span>See All</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>

                      {/* Horizontal Slider for this Brand */}
                      <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar scrollbar-hide scroll-smooth snap-x">
                        {brandGroup.items.map((product) => (
                          <div key={product._id} className="w-[155px] sm:w-[175px] shrink-0 snap-start">
                            <ProductCard
                              product={product}
                              compact={true}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <ScallopDividerBottom fillColor="#EFF6FF" />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-w-md mx-auto my-6 px-4">
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Smartphone size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                No Refurbished Products Found
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                We couldn't find any refurbished items matching your current search or selection.
              </p>
              <button
                onClick={() => {
                  setSelectedHeaderId('ALL');
                  setSelectedSubCat('All');
                  setSearchQuery('');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RefurbishedProductsPage;
