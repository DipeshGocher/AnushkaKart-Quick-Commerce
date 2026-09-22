import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import ProductCard from "../components/shared/ProductCard";
import { useWishlist } from "../context/WishlistContext";
import { ChevronLeft, Heart, Trash2, Smartphone, ShoppingBag, ArrowRight } from "lucide-react";

const WishlistPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    groceryWishlist,
    refurbishedWishlist,
    clearWishlist,
    fetchFullWishlist,
    isFullDataFetched,
    loading,
  } = useWishlist();

  const isInitialRefurbished = location.pathname.startsWith('/marketplace') || location.pathname.startsWith('/refurbished');
  const [activeTab, setActiveTab] = useState(isInitialRefurbished ? 'refurbished' : 'grocery');

  const isRefurbishedActive = activeTab === 'refurbished';
  const activeWishlist = isRefurbishedActive ? refurbishedWishlist : groceryWishlist;

  useEffect(() => {
    if (!isFullDataFetched) {
      fetchFullWishlist();
    }
  }, [isFullDataFetched]);

  if (loading && !isFullDataFetched) {
    return (
      <div className="min-h-screen bg-[#f1f4f8] pb-16 font-outfit animate-pulse">
        {/* Header Skeleton */}
        <div className="px-4 pt-4 pb-3 border-b mb-4 flex items-center justify-between gap-2 bg-white border-slate-200/60">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-slate-200/70" />
            <div className="space-y-1.5">
              <div className="h-5 w-36 bg-slate-300/80 rounded-md" />
              <div className="h-3 w-20 bg-slate-200/80 rounded" />
            </div>
          </div>
        </div>

        {/* Product Grid Skeleton */}
        <div className="px-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
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
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f4f8] pb-16 font-sans">
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-200/80 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => (isRefurbishedActive ? navigate('/marketplace') : navigate(-1))}
            className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1 cursor-pointer"
            title="Back"
          >
            <ChevronLeft size={22} className="text-slate-800" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <Heart size={20} className={isRefurbishedActive ? "text-blue-600 fill-blue-600" : "text-rose-500 fill-rose-500"} />
              <span>My Wishlist</span>
            </h1>
            <p className="text-xs font-semibold text-slate-500">
              {activeWishlist.length} {activeWishlist.length === 1 ? "item" : "items"} saved
            </p>
          </div>
        </div>

        {activeWishlist.length > 0 && (
          <button
            onClick={clearWishlist}
            className="flex items-center gap-1.5 text-slate-500 hover:text-red-600 text-xs font-bold hover:bg-red-50 px-3 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 size={14} /> Clear
          </button>
        )}
      </div>

      {/* Flipkart-Style Wishlist Section Tabs: [ Grocery (x) ] [ Refurbished (y) ] */}
      <div className="bg-white border-b border-slate-200 px-3 py-2.5 mb-4 shadow-2xs">
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('grocery')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              !isRefurbishedActive
                ? 'bg-[#FF5722] text-white shadow-md shadow-orange-500/25'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ShoppingBag size={15} />
            <span>Grocery ({groceryWishlist.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('refurbished')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isRefurbishedActive
                ? 'bg-[#0071DC] text-white shadow-md shadow-blue-500/25'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Smartphone size={15} />
            <span>Refurbished ({refurbishedWishlist.length})</span>
          </button>
        </div>
      </div>

      {/* Product List or Empty State */}
      <div className="px-3 sm:px-4 max-w-7xl mx-auto">
        {activeWishlist.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
            {activeWishlist.map((product) => (
              <ProductCard
                key={product.id || product._id}
                product={product}
                neutralBg={true}
              />
            ))}
          </div>
        ) : (
          <div className="max-w-md mx-auto my-6 p-7 sm:p-8 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm">
            <div className="w-44 h-44 sm:w-52 sm:h-52 mx-auto mb-4 relative flex items-center justify-center">
              <img 
                src="/empty-wishlist-box.png" 
                alt="Empty Wishlist" 
                className="w-full h-full object-contain" 
              />
            </div>
            
            <h2 className="text-xl font-extrabold text-slate-800 mb-1.5 tracking-tight">
              {isRefurbishedActive ? "Refurbished Wishlist is Empty" : "Grocery Wishlist is Empty"}
            </h2>
            
            <p className="text-slate-500 text-xs sm:text-sm font-semibold mb-6 max-w-xs mx-auto leading-relaxed">
              {isRefurbishedActive 
                ? 'Explore our collection of quality-tested smartphones and electronics at unbeatable prices.' 
                : 'Start saving your favorite daily essentials, snacks and groceries to easily find them anytime.'
              }
            </p>

            <button
              onClick={() => navigate(isRefurbishedActive ? '/marketplace' : '/categories')}
              className={`w-full py-3.5 px-6 text-white text-sm font-extrabold rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
                isRefurbishedActive 
                  ? 'bg-[#0F4C81] hover:bg-[#0A365C] shadow-blue-500/25' 
                  : 'bg-[#FF5722] hover:bg-orange-600 shadow-orange-500/25'
              }`}
            >
              <span>{isRefurbishedActive ? 'Explore Marketplace Deals' : 'Explore Grocery Items'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;
