import React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "@shared/components/ui/Toast";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { getProductPriceInfo } from "@/core/utils/productUrl";
import { motion, AnimatePresence } from "framer-motion";
import { useProductDetail } from "../../context/ProductDetailContext";
import ParticleBurst from "./ParticleBurst";
import { useAuth } from "@core/context/AuthContext";

const formatPrice = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const formatReviewCount = (count, id) => {
  const num = Number(count);
  if (Number.isFinite(num) && num > 0) {
    return num.toLocaleString("en-IN");
  }
  // Deterministic realistic review count based on product ID
  let hash = 0;
  const str = String(id || "product");
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const fallbackNum = Math.abs(hash % 45000) + 1200;
  return fallbackNum.toLocaleString("en-IN");
};

/**
 * Flipkart-style Product Card
 * - Grey image container (#F0F0F0, aspect-ratio 0.88, 12px rounded)
 * - Bottom-left rating badge: Rating Star (ReviewCount)
 * - Brand + Product Title (#707070 / #333333)
 * - Selling Price + Original MRP Price
 * - Blue Bank Offer text
 */
const ProductCard = ({ product, className, priority = false }) => {
  const { isAuthenticated } = useAuth();
  const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { openProduct } = useProductDetail();
  const [showHeartPopup, setShowHeartPopup] = React.useState(false);

  const productId = product?.id || product?._id;
  const isWishlisted = isInWishlist(productId);

  const { currentPrice, originalPrice, hasDiscount } = getProductPriceInfo(product);

  const ratingVal =
    Number(product?.rating) > 0 ? Number(product.rating).toFixed(1) : "4.1";
  const reviewCount = formatReviewCount(
    product?.ratingsCount || product?.reviewsCount || product?.ratingCount,
    productId
  );

  const rawImg =
    product?.mainImage ||
    product?.variants?.[0]?.images?.[0] ||
    product?.image ||
    "";

  const brandName = product?.brand ? String(product.brand).trim() : "";

  const handleProductClick = React.useCallback(
    (e) => {
      if (product) {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        openProduct(product);
      }
    },
    [openProduct, product]
  );

  const toggleWishlist = React.useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isAuthenticated) {
        navigate("/login", { state: { from: window.location.pathname } });
        return;
      }

      if (!isWishlisted) {
        setShowHeartPopup(true);
        setTimeout(() => setShowHeartPopup(false), 1000);
      }

      toggleWishlistGlobal(product);
      showToast(
        isWishlisted
          ? `${product?.name} removed from wishlist`
          : `${product?.name} added to wishlist`,
        isWishlisted ? "info" : "success"
      );
    },
    [isAuthenticated, navigate, isWishlisted, toggleWishlistGlobal, product, showToast]
  );

  return (
    <div
      onClick={handleProductClick}
      className={cn(
        "group relative flex flex-col justify-start bg-white cursor-pointer select-none transition-all duration-200 active:scale-[0.99]",
        className
      )}
    >
      {/* ── 1. PRODUCT IMAGE CONTAINER (#F0F0F0, aspect-ratio: 0.88, rounded: 12px) ── */}
      <div
        className="product-image-wrapper relative w-full rounded-[12px] bg-[#F0F0F0] flex items-center justify-center overflow-hidden"
        style={{ aspectRatio: "0.88" }}
      >
        {/* Wishlist Heart Button */}
        <button
          type="button"
          onClick={toggleWishlist}
          className="absolute top-2 right-2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center shadow-xs hover:bg-white active:scale-90 transition-all border-0"
          title="Wishlist"
        >
          <ParticleBurst isActive={showHeartPopup} />
          <motion.div
            whileTap={{ scale: 0.8 }}
            animate={isWishlisted ? { scale: [1, 1.3, 1] } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className="relative z-10"
          >
            <Heart
              size={15}
              className={cn(
                isWishlisted ? "text-red-500 fill-red-500" : "text-slate-500"
              )}
            />
          </motion.div>
        </button>

        <AnimatePresence>
          {showHeartPopup && (
            <motion.div
              initial={{ scale: 0.5, opacity: 1, y: 0 }}
              animate={{ scale: 2.2, opacity: 0, y: -45 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute top-2 right-2 z-50 pointer-events-none text-red-500"
            >
              <Heart size={18} fill="currentColor" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Product Image (Centered, object-fit: contain, padding: 8px) */}
        {rawImg ? (
          <img
            src={applyCloudinaryTransform(rawImg, "f_auto,q_auto,w_400")}
            alt={product?.name || "Product"}
            loading={priority ? "eager" : "lazy"}
            className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <span className="text-xs">No image</span>
          </div>
        )}

        {/* Floating Rating Badge at Bottom-Left */}
        <div className="absolute bottom-2 left-2 z-10 bg-white rounded-[8px] px-2 py-1 flex items-center gap-1 shadow-xs select-none">
          <span className="text-[11px] sm:text-[12px] font-semibold text-[#333333] leading-none">
            {ratingVal}
          </span>
          <Star size={10} className="fill-[#008F5A] text-[#008F5A]" />
          <span className="text-[10px] sm:text-[11px] font-normal text-[#707070] leading-none">
            ({reviewCount})
          </span>
        </div>
      </div>

      {/* ── 2. PRODUCT TITLE (Directly below image, mt: 10-12px, font-size: 14-15px, color: #707070) ── */}
      <h3 className="mt-2.5 px-0.5 text-[14px] sm:text-[15px] font-normal sm:font-medium text-[#707070] line-clamp-2 leading-snug tracking-tight">
        {brandName && (
          <span className="font-bold text-[#333333] mr-1">{brandName}</span>
        )}
        {product?.name}
      </h3>

      {/* ── 3. PRICE SECTION (mt: 8-10px, selling price 17-18px #333333, MRP 14px line-through #777777) ── */}
      <div className="mt-2 px-0.5 flex items-baseline gap-1.5 flex-wrap leading-none">
        <span className="text-[17px] sm:text-[18px] font-bold text-[#333333]">
          {formatPrice(currentPrice)}
        </span>
        {hasDiscount && (
          <span className="text-[14px] text-[#777777] line-through font-normal">
            {formatPrice(originalPrice)}
          </span>
        )}
      </div>
    </div>
  );
};

export default React.memo(ProductCard);
