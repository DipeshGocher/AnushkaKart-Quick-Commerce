import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, MapPin, Plus, Minus,
  Trash2, Heart, ArrowRight, Sparkles,
  Ban, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useLocation as useAppLocation } from '../context/LocationContext';
import LocationDrawer from '../components/shared/LocationDrawer';
import EmptyCartAnimation from '../components/shared/EmptyCartAnimation';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import PageSkeleton from '@/shared/components/PageSkeleton';
import { evaluateProductDelivery } from '../services/deliveryService';
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

  const destinationPincode = currentLocation?.pincode ? String(currentLocation.pincode).trim() : "";

  const unserviceableCartItems = useMemo(() => {
    if (!destinationPincode) return [];
    return activeCart.filter((item) => {
      const check = evaluateProductDelivery(item, destinationPincode);
      return !check.canAddToCart;
    });
  }, [activeCart, destinationPincode]);

  const handleProceedToCheckout = (e) => {
    if (unserviceableCartItems.length > 0) {
      if (e) e.preventDefault();
      toast.error(
        `Please remove fresh items not deliverable to pincode ${destinationPincode} before proceeding.`,
      );
      return false;
    }
    if (asOverlay && onClose) onClose();
    return true;
  };

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
      <div className="sticky top-0 z-30 bg-white border-b border-[#e5e5e5]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between">
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
      </div>

      {/* Main Cart Items Content */}
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 pt-3">
        {activeCart.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (8 cols / ~68%) */}
            <div className="lg:col-span-8 space-y-3">
              {/* Delivery Address Bar */}
              <div 
                onClick={() => setIsLocationOpen(true)}
                className="bg-[#f5f5f5] rounded-xl px-3 py-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-100 transition-colors border border-slate-200/60"
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

              {/* Undeliverable Items Banner */}
              {unserviceableCartItems.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 flex items-start gap-2.5">
                  <Ban className="text-red-600 shrink-0 mt-0.5" size={18} />
                  <div className="text-xs text-red-800">
                    <p className="font-bold text-red-700">Quick Delivery Not Available for {unserviceableCartItems.length} Item(s)</p>
                    <p className="mt-0.5 text-slate-600 leading-relaxed">
                      Fresh groceries cannot be delivered to pincode <strong>{destinationPincode || 'your location'}</strong>. Please remove them to proceed with your order.
                    </p>
                  </div>
                </div>
              )}

              {/* Items Card List */}
              <div className="bg-white rounded-2xl lg:border lg:border-[#e5e5e5] lg:p-4 divide-y divide-[#e5e5e5]">
                {activeCart.map((item) => {
                  const mrp = Number(item.price || 0);
                  const sale = Number(item.salePrice || 0);
                  const unitPrice = sale > 0 && sale < mrp ? sale : mrp;
                  const hasDiscount = mrp > unitPrice;
                  const discountPercent = hasDiscount ? Math.round(((mrp - unitPrice) / mrp) * 100) : 0;
                  const deliveryCheck = evaluateProductDelivery(item, destinationPincode);
                  return (
                    <div 
                      key={`${item.id || item._id}-${item.variantSku || ''}`}
                      className="bg-white py-4 first:pt-0 last:pb-0"
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

                            {/* Delivery Fulfillment / Restriction Badge */}
                            <div className="mt-2">
                              {!deliveryCheck.canAddToCart ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                                  <Ban size={11} className="shrink-0" />
                                  <span>{deliveryCheck.warning || `Quick delivery not available at ${destinationPincode}`}</span>
                                </span>
                              ) : deliveryCheck.badge ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                  <span>{deliveryCheck.badge}</span>
                                </span>
                              ) : null}
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
              </div>

              {/* Price Details Card (Mobile & Tablet only, < lg) */}
              <div className="lg:hidden bg-white py-4 space-y-2.5">
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

            {/* Right Column (4 cols / ~32% on Desktop lg:) */}
            <div className="hidden lg:block lg:col-span-4 sticky top-28 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-3">
                  Price Details ({activeCart.length} {activeCart.length === 1 ? 'Item' : 'Items'})
                </h4>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between font-semibold text-slate-600">
                    <span>Price ({activeCart.length} {activeCart.length === 1 ? 'item' : 'items'})</span>
                    <span>₹{totalMrp}</span>
                  </div>

                  {totalSavings > 0 && (
                    <div className="flex justify-between font-bold text-emerald-600">
                      <span>Discount</span>
                      <span>- ₹{totalSavings}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-semibold text-slate-600">
                    <span>Delivery Charges</span>
                    <span className="text-emerald-600 font-bold">FREE</span>
                  </div>

                  <div className="border-t border-dashed border-slate-200 pt-3 flex justify-between text-base font-black text-slate-900">
                    <span>Total Amount</span>
                    <span>₹{activeTotal}</span>
                  </div>
                </div>

                {totalSavings > 0 && (
                  <div className="text-xs font-bold text-emerald-700 bg-[#e7f8ef] px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                    <Sparkles size={14} className="text-emerald-600 shrink-0" />
                    <span>You will save ₹{totalSavings} on this order</span>
                  </div>
                )}

                <Link
                  to={unserviceableCartItems.length > 0 ? "#" : "/checkout"}
                  onClick={handleProceedToCheckout}
                  className={`w-full ${unserviceableCartItems.length > 0 ? 'bg-slate-400 cursor-not-allowed opacity-90' : 'bg-[#fb641b] hover:bg-[#f45305] shadow-md shadow-orange-500/20'} active:scale-[0.99] text-white font-bold text-sm py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer`}
                >
                  <span>{unserviceableCartItems.length > 0 ? 'Remove Undeliverable Items' : 'Place Order'}</span>
                  <ArrowRight size={16} strokeWidth={2.5} />
                </Link>

                <div className="pt-1 text-[11px] text-slate-400 text-center">
                  Safe and Secure Payments. 100% Authentic products.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-200/80 shadow-2xs text-center max-w-2xl mx-auto my-6">
            <EmptyCartAnimation
              onActionClick={() => {
                if (asOverlay && onClose) onClose();
                navigate('/categories');
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom Sticky Checkout Bar (Positioned above Footer Navigation on Mobile, hidden on desktop lg:) */}
      {activeCart.length > 0 && (
        <div className={`${asOverlay ? 'absolute bottom-0' : 'fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-0'} lg:hidden left-0 right-0 z-40 bg-white border-y border-slate-200/90 shadow-[0_-4px_25px_rgba(0,0,0,0.08)]`}>
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
              to={unserviceableCartItems.length > 0 ? "#" : "/checkout"}
              onClick={handleProceedToCheckout}
              className={`${unserviceableCartItems.length > 0 ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-[#ffdf00] hover:bg-[#f5d500] text-[#212121]'} active:scale-95 font-bold text-sm sm:text-base px-7 py-3.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0`}
            >
              <span>{unserviceableCartItems.length > 0 ? 'Fix Cart' : 'Proceed to buy'}</span>
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default CartPage;
