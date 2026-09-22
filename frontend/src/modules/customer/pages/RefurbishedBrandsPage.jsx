import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Smartphone, ShoppingBag, Mic 
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

const RefurbishedBrandsSkeleton = () => (
  <div className="min-h-screen bg-[#f1f4f8] pb-8 font-outfit animate-pulse">
    {/* Navbar Header Skeleton */}
    <div className="bg-gradient-to-r from-blue-100/95 via-sky-50 to-[#EFF6FF] border-b border-blue-200/60 py-2.5 px-3 shadow-2xs sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shrink-0" />
        <div className="flex-1 h-10 bg-white rounded-full border border-blue-200/60" />
      </div>
    </div>

    {/* Main Body Skeleton */}
    <div className="max-w-7xl mx-auto px-4 mt-5 space-y-6">
      {/* Brands Grid Skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-44 bg-slate-300/70 rounded-md" />
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-3 border border-slate-200/80 flex flex-col items-center space-y-2 shadow-2xs">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-200/80" />
              <div className="h-3 w-14 bg-slate-200/80 rounded" />
              <div className="h-3 w-10 bg-blue-100/80 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Products Grid Skeleton */}
      <div className="pt-4 border-t border-slate-200 space-y-4">
        <div className="space-y-1.5">
          <div className="h-5 w-56 bg-slate-300/70 rounded-md" />
          <div className="h-3 w-32 bg-slate-200/80 rounded-md" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-3 border border-slate-200/80 space-y-3 shadow-2xs">
              <div className="w-full h-36 bg-slate-200/80 rounded-xl" />
              <div className="h-3.5 bg-slate-200/80 rounded w-4/5" />
              <div className="h-3 bg-slate-200/80 rounded w-1/2" />
              <div className="h-7 bg-blue-100/80 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const RefurbishedBrandsPage = () => {
  const navigate = useNavigate();

  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // 4-second brand placeholder rotator
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % ROTATING_BRANDS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchRefurbishedData();
  }, []);

  const fetchRefurbishedData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Categories
      const catRes = await customerApi.getCategories({ catalogType: 'refurbished', tree: 'true' });
      const items = catRes?.data?.result || catRes?.data?.results || catRes?.data || [];
      const treeArray = Array.isArray(items) ? items : [];
      const headers = treeArray.filter((c) => c.catalogType === 'refurbished' || !c.catalogType);

      // Extract all level 2 brand categories from tree
      const allSubCats = [];
      headers.forEach((header) => {
        if (header.children && Array.isArray(header.children)) {
          header.children.forEach((child) => {
            if (!allSubCats.some((item) => item.name === child.name)) {
              allSubCats.push({
                ...child,
                parentHeaderName: header.name,
                parentHeaderId: header._id || header.id
              });
            }
          });
        }
      });
      setBrands(allSubCats);

      // 2. Fetch Products with limit: 1000
      const prodRes = await customerApi.getProducts({ conditionType: 'refurbished', sort: 'newest', limit: 1000 });
      const rawProducts = prodRes?.data?.result?.items || prodRes?.data?.results || prodRes?.data?.items || prodRes?.data || [];
      setProducts(Array.isArray(rawProducts) ? rawProducts : []);
    } catch (err) {
      console.error("Failed to fetch refurbished brands page data:", err);
    } finally {
      setLoading(false);
    }
  };

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

  // Filtered Brands List
  const filteredBrands = useMemo(() => {
    const list = brands.filter((brand) => {
      return brand.name.toLowerCase().includes(searchTerm.toLowerCase().trim());
    });

    return [...list].sort((a, b) => {
      const nameA = a.name?.trim() || '';
      const nameB = b.name?.trim() || '';

      const idxA = PREFERRED_BRAND_ORDER.findIndex((brand) => brand.toLowerCase() === nameA.toLowerCase());
      const idxB = PREFERRED_BRAND_ORDER.findIndex((brand) => brand.toLowerCase() === nameB.toLowerCase());

      const posA = idxA !== -1 ? idxA : 999;
      const posB = idxB !== -1 ? idxB : 999;

      return posA - posB;
    });
  }, [brands, searchTerm]);

  // Filtered Products for selected brand
  const filteredProducts = useMemo(() => {
    if (selectedBrand === 'ALL') {
      return products;
    }

    return products.filter((p) => {
      const brandStr = (p.brand || '').toLowerCase().trim();
      const nameStr = (p.name || '').toLowerCase().trim();
      const catStr = JSON.stringify(p.category || {}).toLowerCase();
      const target = selectedBrand.toLowerCase().trim();
      return brandStr === target || brandStr.includes(target) || nameStr.includes(target) || catStr.includes(target);
    });
  }, [products, selectedBrand]);

  if (loading) {
    return <RefurbishedBrandsSkeleton />;
  }

  const handleBrandClick = (brandName) => {
    navigate(`/refurbished/brands/products?brand=${encodeURIComponent(brandName)}`);
  };

  return (
    <div className="min-h-screen bg-[#f1f4f8] pb-8 font-outfit">
      {/* Short Compact Glassmorphic Navbar */}
      <div className="bg-gradient-to-r from-blue-100/95 via-sky-50 to-[#EFF6FF] backdrop-blur-md border-b border-blue-200/60 text-slate-800 py-2.5 px-3 shadow-2xs sticky top-0 z-40">
        <div className="max-w-7xl mx-auto">
          {/* Top Single Row: Round Back Button + Full Width Search Bar */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-slate-50 transition shrink-0 border border-slate-200 text-slate-700 shadow-2xs cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="relative flex-1 flex items-center bg-white rounded-full shadow-md border border-white/90 overflow-hidden px-3.5 py-2">
              <Search size={16} className="text-slate-400 shrink-0 mr-2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search "${ROTATING_BRANDS[placeholderIndex]}"`}
                className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 outline-none"
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
                  className="p-0.5 text-slate-400 hover:text-orange-500 transition-colors ml-1 shrink-0"
                >
                  <Mic size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Body Content */}
      <div className="max-w-7xl mx-auto px-4 mt-5 space-y-6">
        {/* Section 1: All Brands Grid Layout */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Smartphone size={16} className="text-blue-600" />
              <span>Browse Brands ({filteredBrands.length})</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Click any brand to filter
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200 animate-pulse flex flex-col items-center space-y-2">
                  <div className="w-14 h-14 bg-slate-200 rounded-full" />
                  <div className="h-3 bg-slate-200 rounded w-16" />
                </div>
              ))}
            </div>
          ) : filteredBrands.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500">
              No brands found matching "{searchTerm}"
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {filteredBrands.map((brand) => {
                const presetLogo = getMobileBrandLogo(brand.name);
                const logoUri = brand.image || (presetLogo ? presetLogo.dataUri : null);
                const isSelected = selectedBrand.toLowerCase() === brand.name.toLowerCase();

                // Count products matching this brand
                const brandProdCount = products.filter((p) => {
                  const bStr = (p.brand || '').toLowerCase().trim();
                  const nStr = (p.name || '').toLowerCase().trim();
                  const cStr = JSON.stringify(p.category || {}).toLowerCase();
                  const target = brand.name.toLowerCase().trim();
                  return bStr === target || bStr.includes(target) || nStr.includes(target) || cStr.includes(target);
                }).length;

                return (
                  <button
                    key={brand._id || brand.name}
                    onClick={() => handleBrandClick(brand.name)}
                    className={`p-3 rounded-2xl flex flex-col items-center justify-between transition-all duration-200 border cursor-pointer ${
                      isSelected
                        ? 'bg-orange-50/90 border-slate-200 scale-105 shadow-sm'
                        : 'bg-white hover:bg-orange-50/50 border-slate-200/80 hover:scale-102 shadow-xs'
                    }`}
                  >
                    {/* Circle / Rounded Icon Container */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-50 border border-slate-100 p-2 flex items-center justify-center overflow-hidden shadow-xs relative">
                      {logoUri ? (
                        <img
                          src={logoUri}
                          alt={brand.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="font-extrabold text-orange-600 text-sm">
                          {brand.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-bold text-slate-800 text-center mt-2 line-clamp-1">
                      {brand.name}
                    </span>

                    {brandProdCount > 0 && (
                      <span className="text-[10px] font-extrabold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full mt-1">
                        {brandProdCount} Items
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Products Display */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                {selectedBrand === 'ALL' ? 'Featured Refurbished Products' : `${selectedBrand} Refurbished Products`}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {filteredProducts.length} items available in stock
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-3 border border-slate-200 animate-pulse space-y-3">
                  <div className="w-full h-36 bg-slate-200 rounded-xl" />
                  <div className="h-3 bg-slate-200 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-3">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">No products found</h3>
              <p className="text-xs text-slate-500">
                There are no refurbished products listed under this brand yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredProducts.map((product) => (
                <ProductCard key={product._id || product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RefurbishedBrandsPage;

