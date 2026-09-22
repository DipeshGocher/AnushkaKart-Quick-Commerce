import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Search, Sparkles, ShoppingBag, Mic, Smartphone
} from 'lucide-react';
import { customerApi } from '../services/customerApi';
import ProductCard from '../components/shared/ProductCard';
import { getMobileBrandLogo } from '@shared/constants/mobileBrandLogos';

const ROTATING_BRANDS = [
  'Apple',
  'Vivo',
  'Samsung',
  'Oppo',
  'Realme',
  'Xiaomi',
  'OnePlus',
  'Motorola',
  'Google Pixel',
  'iQOO',
  'Poco',
  'Nothing',
  'Nokia'
];

const PREFERRED_BRAND_ORDER = [
  'All',
  'All Brands',
  'Apple',
  'Samsung',
  'Motorola',
  'OnePlus',
  'Xiaomi',
  'Realme',
  'Vivo',
  'Oppo',
  'Google Pixel',
  'Poco',
  'Nothing',
  'iQOO',
  'Other Brands'
];

const UNIFORM_CARD_THEME = {
  cardBg: 'bg-[#F0F7FF]',
  cardBorder: 'border-blue-200/90 hover:border-blue-300',
  addBtnClass: 'bg-blue-600 hover:bg-blue-700 text-white font-bold border-none shadow-xs',
  addBtnBg: 'bg-blue-600 text-white',
};

const RefurbishedBrandProductsSkeleton = () => (
  <div className="flex flex-col h-screen max-h-screen bg-[#f1f4f8] font-outfit overflow-hidden animate-pulse">
    {/* Navbar Header Skeleton */}
    <div className="bg-gradient-to-r from-blue-100/95 via-sky-50 to-[#EFF6FF] border-b border-blue-200/60 py-2 px-3 shadow-2xs z-40 shrink-0">
      <div className="max-w-7xl mx-auto flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-white border border-slate-200 shrink-0" />
        <div className="flex-1 h-9 bg-white rounded-full border border-blue-200/60" />
      </div>
    </div>

    {/* Split View Container Skeleton */}
    <div className="flex-1 flex overflow-hidden">
      {/* Left Sidebar Skeleton */}
      <div className="w-20 sm:w-24 md:w-52 bg-white border-r border-slate-200 shrink-0 py-2.5 px-1.5 space-y-2">
        <div className="hidden md:block h-3 w-20 bg-slate-200 rounded px-2 mb-2" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center space-y-1.5">
            <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-xl bg-slate-200" />
            <div className="h-3 w-12 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* Right Product Grid Skeleton */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 bg-slate-100/90">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-2.5 border border-slate-200/80 space-y-2.5 shadow-2xs">
              <div className="w-full h-28 sm:h-32 bg-slate-200/80 rounded-xl" />
              <div className="h-3 bg-slate-200/80 rounded w-4/5" />
              <div className="h-3 bg-slate-200/80 rounded w-1/2" />
              <div className="h-7 bg-blue-100/80 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const RefurbishedBrandProductsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const brandFromUrl = searchParams.get('brand') || 'ALL';

  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState(brandFromUrl);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Sync state if URL search param changes
  useEffect(() => {
    if (brandFromUrl) {
      setSelectedBrand(brandFromUrl);
    }
  }, [brandFromUrl]);

  // 4-second brand placeholder rotator
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % ROTATING_BRANDS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchBrandsAndProducts();
  }, []);

  const fetchBrandsAndProducts = async () => {
    setLoading(true);
    try {
      // 1. Fetch Categories
      const catRes = await customerApi.getCategories({ catalogType: 'refurbished', tree: 'true' });
      const items = catRes?.data?.result || catRes?.data?.results || catRes?.data || [];
      const treeArray = Array.isArray(items) ? items : [];
      const headers = treeArray.filter((c) => c.catalogType === 'refurbished' || !c.catalogType);

      // Extract all level 2 brand categories
      const allSubCats = [];
      headers.forEach((header) => {
        if (header.children && Array.isArray(header.children)) {
          header.children.forEach((child) => {
            if (!allSubCats.some((item) => item.name === child.name)) {
              allSubCats.push(child);
            }
          });
        }
      });

      // Sort according to PREFERRED_BRAND_ORDER: All, Apple, Samsung, Motorola...
      const sortedSubCats = [...allSubCats].sort((a, b) => {
        const nameA = a.name?.trim() || '';
        const nameB = b.name?.trim() || '';

        const idxA = PREFERRED_BRAND_ORDER.findIndex((brand) => brand.toLowerCase() === nameA.toLowerCase());
        const idxB = PREFERRED_BRAND_ORDER.findIndex((brand) => brand.toLowerCase() === nameB.toLowerCase());

        const posA = idxA !== -1 ? idxA : 999;
        const posB = idxB !== -1 ? idxB : 999;

        return posA - posB;
      });

      // Always include 'All' brand at index 0
      const brandListWithAll = [
        { _id: 'ALL_BRANDS', name: 'All Brands', isAll: true },
        ...sortedSubCats
      ];
      setBrands(brandListWithAll);

      // 2. Fetch Refurbished Products (request all items so every brand has products loaded)
      const prodRes = await customerApi.getProducts({ conditionType: 'refurbished', sort: 'newest', limit: 1000 });
      const rawProducts = prodRes?.data?.result?.items || prodRes?.data?.results || prodRes?.data?.items || prodRes?.data || [];
      setProducts(Array.isArray(rawProducts) ? rawProducts : []);
    } catch (err) {
      console.error("Failed to fetch brand products page data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBrand = (brandName) => {
    const newBrand = brandName === 'All Brands' ? 'ALL' : brandName;
    setSelectedBrand(newBrand);
    setSearchParams({ brand: newBrand });
  };

  // Filtered & Prioritized Products based on active brand & search query
  const filteredProducts = useMemo(() => {
    let result = products;

    // Filter by Search Term (if typed by user)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();

      // If user types search query, search across all products
      result = products.filter((p) => {
        const nameStr = (p.name || '').toLowerCase();
        const brandStr = (p.brand || '').toLowerCase();
        const modelStr = (p.model || '').toLowerCase();

        // Tokenize words
        const words = nameStr.split(/\s+/);
        const brandWords = brandStr.split(/\s+/);

        const wordStartsWith = words.some((w) => w.startsWith(term)) || brandWords.some((w) => w.startsWith(term));
        return wordStartsWith || nameStr.includes(term) || brandStr.includes(term) || modelStr.includes(term);
      });

      // Sort so products/brands starting with the search term appear FIRST
      result.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        const brandA = (a.brand || '').toLowerCase();
        const brandB = (b.brand || '').toLowerCase();

        const aStart = nameA.startsWith(term) || brandA.startsWith(term);
        const bStart = nameB.startsWith(term) || brandB.startsWith(term);

        if (aStart && !bStart) return -1;
        if (!aStart && bStart) return 1;

        const aWordStart = nameA.split(/\s+/).some((w) => w.startsWith(term));
        const bWordStart = nameB.split(/\s+/).some((w) => w.startsWith(term));

        if (aWordStart && !bWordStart) return -1;
        if (!aWordStart && bWordStart) return 1;

        return nameA.localeCompare(nameB);
      });

      return result;
    }

    // Filter by Brand if no search query typed
    if (selectedBrand && selectedBrand !== 'ALL' && selectedBrand !== 'All Brands') {
      const target = selectedBrand.toLowerCase().trim();
      result = result.filter((p) => {
        const brandStr = (p.brand || '').toLowerCase().trim();
        const nameStr = (p.name || '').toLowerCase().trim();
        const catStr = JSON.stringify(p.category || {}).toLowerCase();
        return brandStr === target || brandStr.includes(target) || nameStr.includes(target) || catStr.includes(target);
      });
    }

    return result;
  }, [products, selectedBrand, searchTerm]);

  // Active Brand Display Title
  const currentBrandDisplay = selectedBrand === 'ALL' || selectedBrand === 'All Brands' ? 'All Refurbished Mobiles' : `${selectedBrand} Refurbished Mobiles`;

  if (loading) {
    return <RefurbishedBrandProductsSkeleton />;
  }

  return (
    <div className="flex flex-col h-screen max-h-screen bg-[#f1f4f8] font-outfit overflow-hidden">
      {/* Short Compact Glassmorphic Navbar Header */}
      <div className="bg-gradient-to-r from-blue-100/95 via-sky-50 to-[#EFF6FF] backdrop-blur-md border-b border-blue-200/60 text-slate-800 py-2 px-3 shadow-2xs z-40 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <button
            onClick={() => navigate('/refurbished')}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:bg-slate-50 transition shrink-0 border border-slate-200 text-slate-700 shadow-2xs"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="relative flex-1 flex items-center bg-white rounded-full shadow-md border border-white/90 overflow-hidden px-3 py-1.5">
            <Search size={15} className="text-slate-400 shrink-0 mr-1.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search "${ROTATING_BRANDS[placeholderIndex]}"`}
              className="w-full bg-transparent text-xs font-bold text-slate-800 placeholder-slate-400 outline-none"
            />
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 px-1 shrink-0"
              >
                Clear
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => {
                  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    const recognition = new SpeechRecognition();
                    recognition.onresult = (event) => {
                      setSearchTerm(event.results[0][0].transcript);
                    };
                    recognition.start();
                  }
                }}
                className="p-0.5 text-slate-400 hover:text-blue-600 transition-colors ml-1 shrink-0"
              >
                <Mic size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Container: Split View (Compact Sidebar + Right Product Grid) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Brand Filter List */}
        <div className="w-20 sm:w-24 md:w-52 bg-white border-r border-slate-200 overflow-y-auto shrink-0 py-2.5 no-scrollbar shadow-xs">
          <div className="hidden md:block px-3.5 py-1.5 border-b border-slate-100 mb-1.5">
            <h3 className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              Brands
            </h3>
          </div>

          <div className="space-y-1.5 px-1.5">
            {brands.map((b) => {
              const isAll = b.isAll || b.name === 'All Brands';
              const isSelected = isAll 
                ? (selectedBrand === 'ALL' || selectedBrand === 'All Brands') 
                : (selectedBrand.toLowerCase() === b.name.toLowerCase());

              const presetLogo = getMobileBrandLogo(isAll ? 'all' : b.name);
              const logoUri = isAll ? (presetLogo ? presetLogo.dataUri : null) : (b.image || (presetLogo ? presetLogo.dataUri : null));

              // Count items for this brand
              const count = isAll ? products.length : products.filter((p) => {
                const bStr = (p.brand || '').toLowerCase().trim();
                const nStr = (p.name || '').toLowerCase().trim();
                const cStr = JSON.stringify(p.category || {}).toLowerCase();
                const target = b.name.toLowerCase().trim();
                return bStr === target || bStr.includes(target) || nStr.includes(target) || cStr.includes(target);
              }).length;

              return (
                <button
                  key={b._id || b.name}
                  onClick={() => handleSelectBrand(b.name)}
                  className={`relative w-full p-1.5 sm:p-2 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-200 shadow-2xs'
                      : 'bg-slate-50/50 hover:bg-slate-100 border-slate-100'
                  }`}
                >
                  {/* Selected Indicator Bar on Left */}
                  {isSelected && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 rounded-r-full" />
                  )}

                  <div className={`w-11 h-11 sm:w-13 sm:h-13 rounded-xl flex items-center justify-center p-1.5 overflow-hidden transition-transform ${
                    isSelected ? 'scale-105 bg-white shadow-2xs border border-blue-200' : 'bg-white border border-slate-100'
                  }`}>
                    {logoUri ? (
                      <img
                        src={logoUri}
                        alt={b.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="font-black text-blue-600 text-xs sm:text-sm">
                        {b.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <span className={`text-[10.5px] sm:text-[12px] font-bold text-center mt-1 line-clamp-1 leading-tight ${
                    isSelected ? 'text-blue-600 font-extrabold' : 'text-slate-700'
                  }`}>
                    {b.name}
                  </span>

                  {count > 0 && (
                    <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-full mt-0.5 ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Area: Compact Product Grid View */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 bg-[#f1f4f8] space-y-3">
          {/* Product Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-2 border border-slate-200 animate-pulse space-y-2">
                  <div className="w-full h-24 bg-slate-200 rounded-lg" />
                  <div className="h-2.5 bg-slate-200 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200 space-y-2.5 my-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <Smartphone size={24} />
              </div>
              <h3 className="font-bold text-slate-800 text-xs">No products found</h3>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                There are no refurbished devices listed under "{selectedBrand}" at the moment.
              </p>
              <button
                onClick={() => handleSelectBrand('All Brands')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-xs transition-all"
              >
                Show All Devices
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {filteredProducts.map((product) => (
                <div key={product._id || product.id} className="h-full">
                  <ProductCard 
                    product={product} 
                    compact={true} 
                    className={`${UNIFORM_CARD_THEME.cardBg} ${UNIFORM_CARD_THEME.cardBorder}`}
                    addBtnClass={UNIFORM_CARD_THEME.addBtnClass}
                    addBtnBg={UNIFORM_CARD_THEME.addBtnBg}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RefurbishedBrandProductsPage;
