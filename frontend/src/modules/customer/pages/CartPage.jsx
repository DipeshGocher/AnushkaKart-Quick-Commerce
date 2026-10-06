import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, MapPin, Plus, Minus,
  Trash2, Heart, ArrowRight, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useLocation as useAppLocation } from '../context/LocationContext';
import LocationDrawer from '../components/shared/LocationDrawer';
import EmptyCartAnimation from '../components/shared/EmptyCartAnimation';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import PageSkeleton from '@/shared/components/PageSkeleton';
import { motion, useReducedMotion } from 'framer-motion';

const CartPage = ({ asOverlay = false, onClose }) => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { 
    groceryCart, 
    groceryCartTotal,
    loading,
    removeFromCart,
    updateQuantity
  } = useCart();
  const { addToWishlist } = useWishlist();
  const { currentLocation } = useAppLocation() || {};

  const [isLocationOpen, setIsLocationOpen] = useState(false);

  // Grocery Cart is strictly grocery products
  const activeCart = groceryCart;
  const activeTotal = groceryCartTotal;

  // Calculate MRP Total and Savings
  const { totalMrp, totalSavings } = useMemo(() => {
    let mrpSum = 0;
    let saleSum = 0;

    activeCart.forEach((item) => {
      const mrp = Number(item.price || 0);
      const sale = Number(item.salePrice || 0);
      const unitSale = sale > 0 && sale < mrp ? sale : mrp;
      const qty = Number(item.quantity || 1);

      let addonsTotal = 0;
      if (item.kitAddons && Array.isArray(item.kitAddons)) {
        addonsTotal = item.kitAddons.reduce((sum, addon) => sum + (Number(addon.price || 0) * Number(addon.quantity || 1)), 0);
      }

      mrpSum += (mrp + addonsTotal) * qty;
      saleSum += (unitSale + addonsTotal) * qty;
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
    navigate('/checkout', { state: { directBuyItem: item } });
  };

  const displayAddress = currentLocation?.address || currentLocation?.formattedAddress || currentLocation?.name || "Select delivery location";

  if (loading && !asOverlay) return <PageSkeleton variant="rows" />;

  return (
    <motion.div
      initial={asOverlay || reduceMotion ? false : { opacity: 0.94, top: 20 }}
      animate={{ opacity: 1, top: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`relative bg-white font-sans antialiased text-[#212121] ${asOverlay ? 'h-full overflow-y-auto pb-32' : 'min-h-screen pb-64 md:pb-32'}`}
    >
      <LocationDrawer isOpen={isLocationOpen} onClose={() => setIsLocationOpen(false)} />

      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-white px-4 py-3.5 border-b border-[#e5e5e5] flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => (asOverlay && onClose ? onClose() : navigate(-1))}
            className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1 cursor-pointer"
          >
            <ChevronLeft size={24} className="text-slate-800" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#212121] tracking-tight leading-tight">My Cart</h1>
            {activeCart.length > 0 && (
              <p className="text-[11px] text-slate-500 font-semibold">
                {activeCart.length} {activeCart.length === 1 ? 'item' : 'items'} in grocery basket
              </p>
            )}
          </div>
        </div>
      </div>



      {/* Delivery Address Bar */}
      <div 
        onClick={() => setIsLocationOpen(true)}
        className="bg-[#f5f5f5] mx-4 my-3 rounded-xl px-3 py-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MapPin size={16} className="text-[#212121] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-[#616161] leading-tight">Deliver to:</p>
            <p className="text-sm font-semibold text-[#212121] truncate leading-tight mt-0.5">
              {displayAddress}
            </p>
          </div>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 border border-[#d6d6d6] text-[#212121] bg-white">
          Change
        </span>
      </div>

      {/* Main Cart Items Content */}
      <div className="max-w-2xl mx-auto px-4 pt-1">
        {activeCart.length > 0 ? (
          <div className="space-y-0">
            {activeCart.map((item) => {
              const mrp = Number(item.price || 0);
              const sale = Number(item.salePrice || 0);
              const unitPrice = sale > 0 && sale < mrp ? sale : mrp;
              const hasDiscount = mrp > unitPrice;
              const discountPercent = hasDiscount ? Math.round(((mrp - unitPrice) / mrp) * 100) : 0;
              return (
                <div 
                  key={`${item.id || item._id}-${item.variantSku || ''}`}
                  className="bg-white py-4 border-b border-[#e5e5e5]"
                >
                  <div className="flex gap-3.5">
                    {/* Left Column: Image Box + Stepper underneath */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-[#f5f5f5] flex items-center justify-center overflow-hidden">
                        <img
                          src={applyCloudinaryTransform(item.image || item.mainImage)}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>

                      {/* Quantity Stepper */}
                      <div className="mt-2.5 flex items-center border border-[#d6d6d6] rounded-lg overflow-hidden bg-white">
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
                        <h3 className="text-sm sm:text-base font-medium text-[#212121] leading-snug line-clamp-2">
                          {item.name}
                        </h3>

                        <p className="text-sm font-normal text-[#757575] mt-1">
                          {item.variantName || item.weight || item.unit || '1 Unit'}
                        </p>

                        {/* Price Row */}
                        <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                          {hasDiscount && (
                            <span className="text-sm sm:text-base font-bold text-[#16864a]">
                              ↓ {discountPercent}%
                            </span>
                          )}
                          {hasDiscount && (
                            <span className="text-sm text-[#757575] line-through font-normal">
                              ₹{mrp}
                            </span>
                          )}
                          <span className="text-base sm:text-lg font-bold text-[#212121]">
                            ₹{unitPrice}
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleRemove(item)}
                      className="py-2 px-2 rounded-xl border border-[#d6d6d6] text-xs sm:text-sm font-bold text-[#424242] hover:bg-slate-50 transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>

                    <button
                      onClick={() => handleMoveToWishlist(item)}
                      className="py-2 px-2 rounded-xl border border-[#d6d6d6] text-xs sm:text-sm font-bold text-[#424242] hover:bg-slate-50 transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Heart size={13} />
                      <span className="truncate">Move to Wishlist</span>
                    </button>

                    <button
                      onClick={() => handleBuyNow(item)}
                      className="py-2 px-2 rounded-xl border border-[#d6d6d6] text-xs sm:text-sm font-bold text-[#212121] hover:bg-slate-50 transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>Buy Now</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Price Details Card */}
            <div className="bg-white py-4 space-y-2.5">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Price Details ({activeCart.length} {activeCart.length === 1 ? 'Item' : 'Items'})
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

              <div className="border-t border-slate-100 pt-2.5 flex justify-between text-sm sm:text-base font-black text-slate-900">
                <span>Total Amount</span>
                <span>₹{activeTotal}</span>
              </div>

              {totalSavings > 0 && (
                  <p className="text-sm font-medium text-[#16864a] bg-[#e7f8ef] px-3 py-2 rounded-lg">
                  You will save ₹{totalSavings} on this order!
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-200/80 shadow-2xs text-center">
            <EmptyCartAnimation
              onActionClick={() => {
                if (asOverlay && onClose) onClose();
                navigate('/categories');
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom Sticky Checkout Bar (Positioned above Footer Navigation on Mobile) */}
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

            {/* Right: Grocery Proceed to Buy Button */}
            <Link
              to="/checkout"
              onClick={onClose}
              className="bg-[#ffdf00] hover:bg-[#f5d500] active:scale-95 text-[#212121] font-bold text-sm sm:text-base px-7 py-3.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <span>Proceed to buy</span>
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default CartPage;
