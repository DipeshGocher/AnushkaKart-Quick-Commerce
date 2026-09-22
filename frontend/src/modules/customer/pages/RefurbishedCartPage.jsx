import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Smartphone, MapPin, Plus, Minus, 
  Trash2, Heart, Zap, ArrowRight, Sparkles, Truck, 
  ShieldCheck, RotateCcw, Shield, ShoppingBag
} from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useLocation as useAppLocation } from '../context/LocationContext';
import LocationDrawer from '../components/shared/LocationDrawer';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import EmptyRefurbishedCartAnimation from '../components/shared/EmptyRefurbishedCartAnimation';

const RefurbishedCartPage = ({ asOverlay = false, onClose }) => {
  const navigate = useNavigate();
  const { 
    refurbishedCart, 
    refurbishedCartTotal,
    groceryCart,
    removeFromCart,
    updateQuantity
  } = useCart();
  const { addToWishlist } = useWishlist();
  const { currentLocation } = useAppLocation() || {};

  const [isLocationOpen, setIsLocationOpen] = useState(false);

  // Strictly Refurbished items
  const activeCart = refurbishedCart;
  const activeTotal = refurbishedCartTotal;

  // Calculate MRP Total and Savings
  const { totalMrp, totalSavings } = useMemo(() => {
    let mrpSum = 0;
    let saleSum = 0;

    activeCart.forEach((item) => {
      const mrp = Number(item.price || 0);
      const sale = Number(item.salePrice || 0);
      const unitSale = sale > 0 && sale < mrp ? sale : mrp;
      const qty = Number(item.quantity || 1);

      mrpSum += mrp * qty;
      saleSum += unitSale * qty;
    });

    const savings = Math.max(0, mrpSum - saleSum);
    return {
      totalMrp: mrpSum,
      totalSavings: savings
    };
  }, [activeCart]);

  const handleQuantityMinus = (item) => {
    const key = String(item.variantSku || '').trim();
    if (item.quantity <= 1) {
      removeFromCart(item.id || item._id, key);
      toast.info(`${item.name} removed from cart`);
    } else {
      updateQuantity(item.id || item._id, -1, key);
    }
  };

  const handleQuantityPlus = (item) => {
    const key = String(item.variantSku || '').trim();
    updateQuantity(item.id || item._id, 1, key);
  };

  const handleRemove = (item) => {
    const key = String(item.variantSku || '').trim();
    removeFromCart(item.id || item._id, key);
    toast.info(`${item.name} removed from cart`);
  };

  const handleMoveToWishlist = (item) => {
    addToWishlist(item);
    const key = String(item.variantSku || '').trim();
    removeFromCart(item.id || item._id, key);
    toast.success(`${item.name} moved to wishlist`);
  };

  const handleBuyNow = (item) => {
    if (asOverlay && onClose) onClose();
    navigate('/refurbished/checkout', { state: { directBuyItem: item } });
  };

  const displayAddress = currentLocation?.address || currentLocation?.formattedAddress || currentLocation?.name || "Select delivery location";

  return (
    <div className={`bg-[#f1f4f8] font-sans antialiased text-slate-900 ${asOverlay ? 'h-full overflow-y-auto relative pb-32' : 'min-h-screen pb-64 md:pb-32'}`}>
      <LocationDrawer isOpen={isLocationOpen} onClose={() => setIsLocationOpen(false)} />

      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => (asOverlay && onClose ? onClose() : navigate('/refurbished'))}
            className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1 cursor-pointer"
          >
            <ChevronLeft size={24} className="text-slate-800" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">Refurbished Cart</h1>
            {activeCart.length > 0 && (
              <p className="text-[11px] text-blue-600 font-bold">
                {activeCart.length} {activeCart.length === 1 ? 'device' : 'devices'} • Certified & Tested
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Cross-section banner if user also has grocery items */}
      {groceryCart.length > 0 && (
        <div className="bg-orange-50 border-b border-orange-100 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingBag size={16} className="text-[#FF5722] shrink-0" />
            <p className="text-xs font-bold text-orange-900 truncate">
              {groceryCart.length} {groceryCart.length === 1 ? 'item' : 'items'} in Grocery Cart
            </p>
          </div>
          <Link
            to="/cart"
            onClick={onClose}
            className="text-xs font-black text-orange-700 bg-white border border-orange-200 hover:bg-[#FF5722] hover:text-white px-2.5 py-1 rounded-lg transition shrink-0"
          >
            Go to Grocery Cart →
          </Link>
        </div>
      )}

      {/* Flipkart Delivery Address Bar */}
      <div 
        onClick={() => setIsLocationOpen(true)}
        className="bg-white border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50/80 transition-colors shadow-2xs"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MapPin size={16} className="text-blue-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-slate-400 leading-tight">Deliver to:</p>
            <p className="text-xs font-bold text-slate-800 truncate leading-tight mt-0.5">
              {displayAddress}
            </p>
          </div>
        </div>
        <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg shrink-0 border text-blue-700 bg-blue-50 border-blue-200">
          Change
        </span>
      </div>

      {/* 32-Point Quality Trust Strip */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100/80 px-4 py-2 flex items-center justify-around text-center gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-blue-600 shrink-0" />
          <span className="text-[11px] font-bold text-slate-700">32-Pt Check</span>
        </div>
        <div className="h-3 w-px bg-blue-200" />
        <div className="flex items-center gap-1.5">
          <RotateCcw size={13} className="text-blue-600 shrink-0" />
          <span className="text-[11px] font-bold text-slate-700">7-Day Return</span>
        </div>
        <div className="h-3 w-px bg-blue-200" />
        <div className="flex items-center gap-1.5">
          <Shield size={13} className="text-blue-600 shrink-0" />
          <span className="text-[11px] font-bold text-slate-700">1-Yr Warranty</span>
        </div>
      </div>

      {/* Main Cart Items Content */}
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-3">
        {activeCart.length > 0 ? (
          <div className="space-y-3">
            {activeCart.map((item) => {
              const mrp = Number(item.price || 0);
              const sale = Number(item.salePrice || 0);
              const unitPrice = sale > 0 && sale < mrp ? sale : mrp;
              const hasDiscount = mrp > unitPrice;
              const discountPercent = hasDiscount ? Math.round(((mrp - unitPrice) / mrp) * 100) : 0;
              const lineTotal = Math.round(unitPrice * Number(item.quantity || 1));

              return (
                <div 
                  key={`${item.id || item._id}-${item.variantSku || ''}`}
                  className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs"
                >
                  <div className="flex gap-3.5">
                    {/* Left Column: Image Box + Stepper underneath */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-50 border border-slate-100 p-1.5 flex items-center justify-center overflow-hidden">
                        <img
                          src={applyCloudinaryTransform(item.image || item.mainImage)}
                          alt={item.name}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      </div>

                      {/* Quantity Stepper */}
                      <div className="mt-2.5 flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                        <button
                          onClick={() => handleQuantityMinus(item)}
                          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 transition active:scale-90 cursor-pointer"
                          title="Decrease quantity"
                        >
                          <Minus size={13} strokeWidth={2.5} />
                        </button>
                        <span className="w-8 sm:w-9 text-center text-xs sm:text-sm font-extrabold text-slate-900 select-none">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityPlus(item)}
                          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 transition active:scale-90 cursor-pointer"
                          title="Increase quantity"
                        >
                          <Plus size={13} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Product Info & Pricing */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                          {item.name}
                        </h3>

                        <p className="text-[11px] font-semibold text-slate-500 mt-1">
                          {item.variantName || item.refurbishedDetails?.grade || 'Grade A (Superb)'}
                        </p>

                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-md border border-blue-200">
                            ✓ Certified Refurbished
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            ★ 4.2
                          </span>
                        </div>

                        {/* Price Row */}
                        <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                          {hasDiscount && (
                            <span className="text-[11px] sm:text-xs font-bold text-emerald-600">
                              ↓ {discountPercent}%
                            </span>
                          )}
                          {hasDiscount && (
                            <span className="text-xs text-slate-400 line-through font-semibold">
                              ₹{mrp}
                            </span>
                          )}
                          <span className="text-sm sm:text-base font-black text-slate-900">
                            ₹{unitPrice}
                          </span>
                        </div>
                      </div>

                      {/* Delivery Speed Indicator */}
                      <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-slate-600">
                        <Truck size={13} className="text-blue-600" />
                        <span>Delivery in 2-3 days via Express Courier</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="border-t border-slate-100 mt-3 pt-2.5 grid grid-cols-3 gap-1">
                    <button
                      onClick={() => handleRemove(item)}
                      className="py-1.5 px-2 rounded-lg text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50/60 transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>

                    <button
                      onClick={() => handleMoveToWishlist(item)}
                      className="py-1.5 px-2 rounded-lg text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Heart size={13} />
                      <span className="truncate">Move to Wishlist</span>
                    </button>

                    <button
                      onClick={() => handleBuyNow(item)}
                      className="py-1.5 px-2 rounded-lg text-xs font-extrabold text-slate-900 hover:text-blue-600 hover:bg-slate-50 transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Zap size={13} className="text-amber-500" />
                      <span>Buy Now</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Price Details Card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-2.5">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Price Details ({activeCart.length} {activeCart.length === 1 ? 'Device' : 'Devices'})
              </h4>

              <div className="flex justify-between text-xs sm:text-sm font-semibold text-slate-600">
                <span>Total MRP</span>
                <span>₹{totalMrp}</span>
              </div>

              {totalSavings > 0 && (
                <div className="flex justify-between text-xs sm:text-sm font-bold text-emerald-600">
                  <span>Discount on MRP</span>
                  <span>- ₹{totalSavings}</span>
                </div>
              )}

              <div className="flex justify-between text-xs sm:text-sm font-semibold text-slate-600">
                <span>Delivery Fee</span>
                <span className="text-emerald-600 font-bold">FREE</span>
              </div>

              <div className="border-t border-slate-100 pt-2.5 flex justify-between text-sm sm:text-base font-black text-slate-900">
                <span>Total Amount</span>
                <span>₹{activeTotal}</span>
              </div>

              {totalSavings > 0 && (
                <p className="text-[11.5px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                  You will save ₹{totalSavings} on this order!
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs text-center">
            <EmptyRefurbishedCartAnimation
              isRefurbished={true}
              onActionClick={() => {
                if (asOverlay && onClose) onClose();
                navigate('/refurbished');
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom Sticky Checkout Bar */}
      {activeCart.length > 0 && (
        <div className={`${asOverlay ? 'absolute bottom-0' : 'fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-0'} left-0 right-0 z-40 bg-white border-y border-slate-200/90 shadow-[0_-4px_25px_rgba(0,0,0,0.08)]`}>
          {/* Green Savings Strip */}
          {totalSavings > 0 && (
            <div className="bg-emerald-50 text-emerald-800 text-xs font-bold px-4 py-1.5 flex items-center justify-center gap-1.5 border-b border-emerald-100">
              <Sparkles size={12} className="text-emerald-600" />
              <span>You'll save ₹{totalSavings} on this order</span>
            </div>
          )}

          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            {/* Left: Total Price */}
            <div>
              {totalSavings > 0 && (
                <p className="text-xs text-slate-400 line-through font-semibold leading-tight">
                  ₹{totalMrp}
                </p>
              )}
              <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                ₹{activeTotal}
              </p>
            </div>

            {/* Right: Flipkart High-Conversion Proceed to Buy Button */}
            <Link
              to="/refurbished/checkout"
              onClick={onClose}
              className="bg-[#FFC200] hover:bg-[#FFB800] active:scale-95 text-slate-950 font-black text-xs sm:text-sm px-7 py-3.5 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <span>Proceed to buy</span>
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default RefurbishedCartPage;
