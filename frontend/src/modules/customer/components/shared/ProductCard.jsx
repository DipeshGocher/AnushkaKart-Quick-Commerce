import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Plus, Minus, Check, Store, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "@shared/components/ui/Toast";
import { useCartAnimation } from "../../context/CartAnimationContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { motion, AnimatePresence } from "framer-motion";
import { useProductDetail } from "../../context/ProductDetailContext";
import ParticleBurst from "./ParticleBurst";
import { useVariantSelection } from "../../context/VariantSelectionContext";

import { useAuth } from "@core/context/AuthContext";

/**
 * @param {{ product: any, badge?: any, className?: string, compact?: boolean, neutralBg?: boolean, layout?: string, priority?: boolean, addBtnClass?: string, addBtnBg?: string }} props
 */
const ProductCard = ({ product, badge, className, compact = false, neutralBg = false, layout = "grid", priority = false, addBtnClass, addBtnBg }) => {
    const { isAuthenticated } = useAuth();
    const { toggleWishlist: toggleWishlistGlobal, isInWishlist } =
      useWishlist();
    const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
    const { showToast } = useToast();
    const { animateAddToCart, animateRemoveFromCart } = useCartAnimation();

    const navigate = useNavigate();
    const { openProduct } = useProductDetail();
    const { openVariantSelection } = useVariantSelection();
    const [showHeartPopup, setShowHeartPopup] = React.useState(false);

    const imageRef = React.useRef(null);

    const defaultVariant = React.useMemo(() => {
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      if (variants.length === 0) return null;

      const displayed = Number(product?.price || 0);
      const displayedOriginal = Number(product?.originalPrice || 0);

      const matchesDisplayedPrice = (variant) => {
        const mrp = Number(variant?.price || 0);
        const sale = Number(variant?.salePrice || 0);
        const effective = sale > 0 && sale < mrp ? sale : mrp;

        if (Number.isFinite(displayedOriginal) && displayedOriginal > displayed) {
          if (effective === displayed && (mrp === displayedOriginal || displayedOriginal === 0)) {
            return true;
          }
        }

        return effective === displayed || mrp === displayed;
      };

      const picked = variants.find(matchesDisplayedPrice) || variants[0];
      const key = String(picked?.sku || picked?.name || "").trim();
      return {
        key,
        name: String(picked?.name || "").trim(),
      };
    }, [product]);

    const productId = product.id || product._id;
    const variantKey = String(defaultVariant?.key || "").trim();
    const cartKey = `${productId}::${variantKey || ""}`;

    const cartItem = React.useMemo(
      () =>
        cart.find(
          (item) =>
            `${item.id || item._id}::${String(item.variantSku || "").trim()}` ===
            cartKey,
        ),
      [cart, cartKey],
    );
    const quantity = cartItem ? cartItem.quantity : 0;
    const isWishlisted = isInWishlist(product.id || product._id);

    const isRefurbished = React.useMemo(() => {
      return (
        product?.conditionType === 'refurbished' ||
        product?.catalogType === 'refurbished' ||
        Boolean(product?.refurbishedDetails) ||
        (typeof window !== 'undefined' && (window.location.pathname.startsWith('/marketplace') || window.location.pathname.startsWith('/refurbished')))
      );
    }, [product]);

    const handleProductClick = React.useCallback(
      (e) => {
        if (openProduct) {
          e.preventDefault();
          openProduct(product);
        }
      },
      [openProduct, product],
    );

    const toggleWishlist = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isAuthenticated) {
          navigate('/login', { state: { from: window.location.pathname } });
          return;
        }

        if (!isWishlisted) {
          setShowHeartPopup(true);
          setTimeout(() => setShowHeartPopup(false), 1000);
        }

        toggleWishlistGlobal({
          ...product,
          conditionType: isRefurbished ? 'refurbished' : (product?.conditionType || 'new'),
        });
        showToast(
          isWishlisted
            ? `${product.name} removed from wishlist`
            : `${product.name} added to wishlist`,
          isWishlisted ? "info" : "success",
        );
      },
      [isAuthenticated, navigate, isWishlisted, toggleWishlistGlobal, product, isRefurbished, showToast],
    );

    const handleAddToCart = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isAuthenticated) {
          navigate('/login', { state: { from: window.location.pathname } });
          return;
        }
        
        if (Array.isArray(product?.variants) && product.variants.length > 1) {
            if (openVariantSelection) {
                openVariantSelection(product);
            }
            return;
        }

        if (imageRef.current) {
          animateAddToCart(
            imageRef.current.getBoundingClientRect(),
            product.mainImage || product.image,
          );
        }
        addToCart({
          ...product,
          conditionType: isRefurbished ? 'refurbished' : (product?.conditionType || 'new'),
          variantSku: variantKey,
          variantName: defaultVariant?.name || "",
        });
      },
      [isAuthenticated, navigate, animateAddToCart, product, isRefurbished, addToCart, variantKey, defaultVariant?.name, openVariantSelection],
    );

    const handleIncrement = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isAuthenticated) {
          navigate('/login', { state: { from: window.location.pathname } });
          return;
        }
        updateQuantity(productId, 1, variantKey);
      },
      [isAuthenticated, navigate, updateQuantity, productId, variantKey],
    );

    const handleDecrement = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isAuthenticated) {
          navigate('/login', { state: { from: window.location.pathname } });
          return;
        }

        if (quantity === 1) {
          animateRemoveFromCart(product.mainImage || product.image);
          removeFromCart(productId, variantKey);
        } else {
          updateQuantity(productId, -1, variantKey);
        }
      },
      [
        isAuthenticated,
        navigate,
        quantity,
        animateRemoveFromCart,
        product.image,
        removeFromCart,
        productId,
        updateQuantity,
        variantKey,
      ],
    );

    const discountText = React.useMemo(() => {
      if (badge) return badge;
      if (product.discount) return product.discount;
      if (product.originalPrice > product.price) {
        return `-${Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%`;
      }
      return null;
    }, [badge, product]);

    return (
      <div
        className={cn(
          "group relative flex flex-col justify-between transition-all duration-300 cursor-pointer shadow-2xs hover:shadow-md",
          isRefurbished
            ? "bg-gradient-to-b from-[#F0F7FF] via-[#F8FAFC] to-white border border-blue-200/70 hover:border-blue-300"
            : "bg-gradient-to-b from-[#FFF5EE] via-[#FFF9F5] to-white border border-orange-200/70 hover:border-orange-300",
          compact ? "p-1.5 sm:p-2 rounded-xl" : "p-2.5 sm:p-3 rounded-2xl",
          layout === "list" ? "flex-row items-center gap-3 py-3" : "h-full",
          className
        )}
        onClick={handleProductClick}
      >
        {/* Wishlist Heart Button */}
        <button
          onClick={toggleWishlist}
          className={cn(
            "absolute z-20 rounded-full bg-white/90 backdrop-blur-md shadow-2xs flex items-center justify-center hover:bg-white hover:scale-105 active:scale-90 transition-all border",
            isRefurbished ? "border-blue-100" : "border-orange-100",
            compact ? "top-1.5 right-1.5 w-6 h-6" : "top-2.5 right-2.5 sm:top-3 sm:right-3 w-7 h-7 sm:w-8 sm:h-8"
          )}
          title="Wishlist"
        >
          <ParticleBurst isActive={showHeartPopup} />
          <motion.div
            whileTap={{ scale: 0.8 }}
            animate={isWishlisted ? { scale: [1, 1.35, 1] } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className="relative z-10"
          >
            <Heart
              size={compact ? 12 : 15}
              className={cn(
                isWishlisted ? "text-red-500 fill-current" : "text-slate-400"
              )}
            />
          </motion.div>
        </button>

        <AnimatePresence>
          {showHeartPopup && (
            <motion.div
              initial={{ scale: 0.5, opacity: 1, y: 0 }}
              animate={{ scale: 2.5, opacity: 0, y: -65 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-50 pointer-events-none text-red-500"
            >
              <Heart size={compact ? 15 : 20} fill="currentColor" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Image Section - Clean White Inner Box (like Saathi Grow UI) */}
        <div className={cn(
          "relative w-full overflow-hidden flex items-center justify-center p-1 bg-white rounded-xl shadow-2xs border border-white/80", 
          compact ? "h-24 sm:h-28" : layout === "list" ? "w-[90px] h-[90px] shrink-0" : "aspect-square"
        )}>
          {/* Discount Badge (Top-Left Speech Bubble) */}
          {discountText && (
            <div className={cn(
              "absolute top-0 left-0 z-10 text-white font-black rounded-[8px_8px_8px_0px] shadow-2xs tracking-tight leading-none select-none border",
              isRefurbished ? "bg-[#1E3A8A] border-blue-800/50" : "bg-[#0F172A] border-slate-700/50",
              compact ? "text-[8.5px] px-1.5 py-0.5" : "text-[9.5px] px-2.5 py-1"
            )}>
              {discountText}
            </div>
          )}

          {/* Product Image */}
          <img
            ref={imageRef}
            src={applyCloudinaryTransform(product.mainImage || (product.variants?.[0]?.images?.[0]) || product.image || "")}
            alt={product.name}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
          />
        </div>

        {/* Content Box */}
        <div className={cn("flex flex-col flex-1 mt-1", layout === "list" && "mt-0")}>
          {/* Title & Weight */}
          <div>
            <h4 className={cn(
              "font-extrabold text-[#0F172A] leading-snug line-clamp-2 transition-colors",
              isRefurbished ? "group-hover:text-blue-600" : "group-hover:text-[#FF5722]",
              compact ? "text-[11px] sm:text-xs" : "text-xs sm:text-sm"
            )}>
              {product.name}
            </h4>
            <div className="flex items-center gap-1 mt-0.5">
              <p className={cn("font-semibold text-slate-500", compact ? "text-[10px]" : "text-[11px]")}>
                {defaultVariant?.name || product.weight || "1 unit"}
              </p>
              {Array.isArray(product?.variants) && product.variants.length > 1 && (
                <span className="text-[8.5px] bg-[#EEF2FF] text-[#1E3A8A] border border-[#C7D2FE] px-1 py-0.2 rounded-full font-black">
                  +{product.variants.length - 1} {product.variants.length - 1 === 1 ? 'variant' : 'variants'}
                </span>
              )}
            </div>
            {/* Seller / Warehouse Name */}
            {(product.sellerId?.shopName || product.warehouseId?.name) && !compact && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-medium line-clamp-1">
                {product.sellerId?.shopName ? (
                  <><Store size={10} className="shrink-0 text-slate-400" /> <span className="truncate">{product.sellerId.shopName}</span></>
                ) : (
                  <><Building2 size={10} className="shrink-0 text-slate-400" /> <span className="truncate">{product.warehouseId?.name}</span></>
                )}
              </div>
            )}
          </div>

          {/* Bottom Price & ADD Button Section (Structured: Price on top, ADD button below) */}
          <div className="mt-auto pt-1 flex flex-col justify-end">
            {/* Price Line */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className={cn(
                "font-black text-[#0F172A] tracking-tight leading-none",
                compact ? "text-xs sm:text-sm" : "text-[13.5px] sm:text-[15.5px]"
              )}>
                ₹{product.price}
              </span>
              {product.originalPrice > product.price && (
                <span className={cn(
                  "text-slate-400 line-through font-bold leading-none",
                  compact ? "text-[9px]" : "text-[10px]"
                )}>
                  ₹{product.originalPrice}
                </span>
              )}
            </div>

            {/* ADD / Quantity Selector Button (Always placed below price) */}
            <div className="mt-1 flex items-center justify-end w-full">
              {quantity > 0 ? (
                <div 
                  className={cn(
                    "flex items-center justify-between rounded-lg text-white shadow-2xs",
                    addBtnBg ? addBtnBg : (isRefurbished
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600"
                      : "bg-gradient-to-r from-[#FF5722] to-[#FF6D00]"),
                    compact ? "h-6.5 min-w-[55px]" : "h-8 min-w-[70px]"
                  )}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                  <button 
                    onClick={handleDecrement} 
                    className="w-6 h-full flex items-center justify-center rounded-l-lg transition-colors px-0.5 cursor-pointer hover:opacity-80"
                  >
                    <Minus size={compact ? 12 : 14} strokeWidth={3} />
                  </button>
                  <span className={cn("font-black", compact ? "text-[11px]" : "text-[12.5px]")}>
                    {quantity}
                  </span>
                  <button 
                    onClick={handleIncrement} 
                    className="w-6 h-full flex items-center justify-center rounded-r-lg transition-colors px-0.5 cursor-pointer hover:opacity-80"
                  >
                    <Plus size={compact ? 12 : 14} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAddToCart}
                  className={cn(
                    "rounded-lg border-2 flex items-center justify-center font-black uppercase active:scale-95 transition-all shadow-2xs cursor-pointer",
                    addBtnClass ? addBtnClass : (isRefurbished
                      ? "border-blue-600 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white"
                      : "border-[#FF5722] bg-[#FFF0E6] text-[#FF5722] hover:bg-[#FF5722] hover:text-white"),
                    compact ? "h-6.5 min-w-[55px] px-2 text-[10px]" : "h-8 min-w-[70px] px-3.5 text-[12px]"
                  )}
                  title="Add to Cart"
                >
                  ADD
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

export default React.memo(ProductCard);
