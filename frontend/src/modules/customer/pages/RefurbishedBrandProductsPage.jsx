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

      // Always include 'All' brand at index 0
      const brandListWithAll = [
        { _id: 'ALL_BRANDS', name: 'All Brands', isAll: true },
        ...allSubCats
      ];
      setBrands(brandListWithAll);

      // 2. Fetch Refurbished Products
      const prodRes = await customerApi.getProducts({ conditionType: 'refurbished', sort: 'newest' });
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

  // Filtered Products based on active brand & search query
  const filteredProducts = useMemo(() => {
    let result = products;

    // Filter by Brand
    if (selectedBrand && selectedBrand !== 'ALL' && selectedBrand !== 'All Brands') {
      const target = selectedBrand.toLowerCase().trim();
      result = result.filter((p) => {
        const brandStr = (p.brand || p.name || '').toLowerCase();
        const catStr = JSON.stringify(p.category || {}).toLowerCase();
        return brandStr.includes(target) || catStr.includes(target);
      });
    }

    // Filter by Search Term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter((p) => {
        const nameStr = (p.name || '').toLowerCase();
        const brandStr = (p.brand || '').toLowerCase();
        const modelStr = (p.model || '').toLowerCase();
        return nameStr.includes(term) || brandStr.includes(term) || modelStr.includes(term);
      });
    }

    return result;
  }, [products, selectedBrand, searchTerm]);

  // Active Brand Display Title
  const currentBrandDisplay = selectedBrand === 'ALL' || selectedBrand === 'All Brands' ? 'All Refurbished Mobiles' : `${selectedBrand} Refurbished Mobiles`;

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-100 font-outfit overflow-hidden">
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
        {/* Left Sidebar: Compact Brand Filter List */}
        <div className="w-16 sm:w-20 md:w-48 bg-white border-r border-slate-200 overflow-y-auto shrink-0 py-1.5 no-scrollbar shadow-xs">
          <div className="hidden md:block px-3 py-1.5 border-b border-slate-100 mb-1">
            <h3 className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              Brands
            </h3>
          </div>

          <div className="space-y-1 px-1">
            {brands.map((b) => {
              const isAll = b.isAll || b.name === 'All Brands';
              const isSelected = isAll 
                ? (selectedBrand === 'ALL' || selectedBrand === 'All Brands') 
                : (selectedBrand.toLowerCase() === b.name.toLowerCase());

              const presetLogo = getMobileBrandLogo(isAll ? 'all' : b.name);
              const logoUri = isAll ? (presetLogo ? presetLogo.dataUri : null) : (b.image || (presetLogo ? presetLogo.dataUri : null));

              // Count items for this brand
              const count = isAll ? products.length : products.filter((p) => {
                const bStr = (p.brand || p.name || '').toLowerCase();
                const cStr = JSON.stringify(p.category || {}).toLowerCase();
                const target = b.name.toLowerCase();
                return bStr.includes(target) || cStr.includes(target);
              }).length;

              return (
                <button
                  key={b._id || b.name}
                  onClick={() => handleSelectBrand(b.name)}
                  className={`relative w-full p-1 sm:p-1.5 rounded-xl flex flex-col items-center justify-center transition-all duration-200 border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-200 shadow-2xs'
                      : 'bg-slate-50/50 hover:bg-slate-100 border-slate-100'
                  }`}
                >
                  {/* Selected Indicator Bar on Left */}
                  {isSelected && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-600 rounded-r-full" />
                  )}

                  <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center p-1 overflow-hidden transition-transform ${
                    isSelected ? 'scale-105 bg-white shadow-2xs border border-blue-200' : 'bg-white border border-slate-100'
                  }`}>
                    {logoUri ? (
                      <img
                        src={logoUri}
                        alt={b.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="font-black text-blue-600 text-[11px]">
                        {b.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <span className={`text-[9.5px] sm:text-[11px] font-bold text-center mt-1 line-clamp-1 leading-tight ${
                    isSelected ? 'text-blue-600 font-extrabold' : 'text-slate-700'
                  }`}>
                    {b.name}
                  </span>

                  {count > 0 && (
                    <span className={`text-[8px] sm:text-[9.5px] font-bold px-1 py-0.1 rounded-full mt-0.5 ${
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
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 bg-slate-100/90 space-y-3">
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
                  <ProductCard product={product} compact={true} />
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
