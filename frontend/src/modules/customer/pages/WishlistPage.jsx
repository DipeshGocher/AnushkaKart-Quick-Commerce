import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import ProductCard from "../components/shared/ProductCard";
import { useWishlist } from "../context/WishlistContext";
import { ChevronLeft, Heart, Trash2, Smartphone } from "lucide-react";

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

  const isRefurbished = location.pathname.startsWith('/refurbished');
  const activeWishlist = isRefurbished ? refurbishedWishlist : groceryWishlist;

  React.useEffect(() => {
    if (!isFullDataFetched) {
      fetchFullWishlist();
    }
  }, [isFullDataFetched]);

  if (loading && !isFullDataFetched) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f4f8] pb-16">
      <div className={`sticky top-0 z-30 px-4 pt-4 pb-3 border-b mb-2 flex items-center justify-between gap-2 ${
        isRefurbished 
          ? 'bg-gradient-to-r from-blue-100/95 via-sky-50 to-[#EFF6FF] border-blue-200/60 text-slate-900'
          : 'bg-slate-50/95 backdrop-blur-sm border-slate-200/60'
      }`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => (isRefurbished ? navigate('/refurbished') : navigate(-1))}
            className="w-10 h-10 flex items-center justify-center hover:bg-black/5 rounded-full transition-colors -ml-1">
            <ChevronLeft size={22} className="text-slate-800" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              {isRefurbished ? (
                <>
                  <Smartphone size={20} className="text-blue-600" />
                  <span>Refurbished Wishlist</span>
                </>
              ) : (
                'My Wishlist'
              )}
            </h1>
            <p className="text-xs font-semibold text-slate-500">
              {activeWishlist.length} {activeWishlist.length === 1 ? "item" : "items"} saved
            </p>
          </div>
        </div>
        {activeWishlist.length > 0 && (
          <button
            onClick={clearWishlist}
            className="flex items-center gap-1.5 text-slate-600 text-xs font-semibold hover:bg-black/5 px-3 py-2 rounded-lg transition-colors">
            <Trash2 size={14} /> Clear
          </button>
        )}
      </div>

      <div className="px-4">
        {activeWishlist.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {activeWishlist.map((product) => (
              <ProductCard
                key={product.id || product._id}
                product={product}
                neutralBg={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-white rounded-xl border border-slate-200">
            <div className={`h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isRefurbished ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
            }`}>
              <Heart size={26} className={isRefurbished ? 'text-blue-600' : 'text-slate-500'} strokeWidth={1.8} />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">
              {isRefurbished ? 'No items in Refurbished Wishlist' : 'No items in wishlist'}
            </h2>
            <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
              {isRefurbished ? 'Start saving your favorite refurbished electronics to see them here.' : 'Start saving your favorite items to see them here later.'}
            </p>
            <Link
              to={isRefurbished ? '/refurbished/products' : '/categories'}
              className={`px-6 py-2.5 text-white text-sm font-bold rounded-xl transition-all shadow-md active:scale-95 ${
                isRefurbished ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' : 'bg-slate-900 hover:bg-slate-800'
              }`}>
              {isRefurbished ? 'Explore Refurbished Devices' : 'Explore Products'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;
