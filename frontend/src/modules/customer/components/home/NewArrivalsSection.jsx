import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Sparkles, Plus, Minus, ImageOff } from "lucide-react";
import { customerApi } from "../../services/customerApi";
import { useProductDetail } from "../../context/ProductDetailContext";
import { useCart } from "../../context/CartContext";
import { useVariantSelection } from "../../context/VariantSelectionContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { getProductVariantText, getProductPriceInfo } from "@/core/utils/productUrl";
import { useTranslation } from "@core/context/LanguageContext";
import { useDynamicTranslation } from "@/core/hooks/useDynamicTranslation";

const formatPrice = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const getItems = (response) => {
  const data = response?.data || response;
  const result = data?.result;
  return Array.isArray(data?.results)
    ? data.results
    : Array.isArray(result?.items)
    ? result.items
    : Array.isArray(result)
    ? result
    : [];
};

/**
 * Individual Product Card for New Arrivals
 * Displays:
 * 1. Image box with top-left % OFF badge and bottom-right + / - [qty] + stepper
 * 2. Product Name
 * 3. Variant (below name)
 * 4. Price (below variant)
 */
const NewArrivalProductCard = ({ product }) => {
  const { openProduct } = useProductDetail();
  const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
  const { openVariantSelection } = useVariantSelection();

  const productId = product.id || product._id;
  const { currentPrice, originalPrice, hasDiscount, discountPercent } =
    getProductPriceInfo(product);
  const variantText = getProductVariantText(product);
  const image = product.image;

  const defaultVariant = useMemo(() => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (variants.length === 0) return null;
    const picked = variants[0];
    return {
      key: String(picked?.sku || picked?.name || "").trim(),
      name: String(picked?.name || "").trim(),
    };
  }, [product]);

  const variantKey = String(defaultVariant?.key || product?.variantSku || "").trim();
  const cartKey = `${productId}::${variantKey || ""}`;

  const cartItem = useMemo(
    () =>
      cart.find(
        (item) =>
          `${item.id || item._id}::${String(item.variantSku || "").trim()}` === cartKey ||
          (!variantKey && String(item.id || item._id) === String(productId))
      ),
    [cart, cartKey, productId, variantKey]
  );

  const quantity = cartItem ? cartItem.quantity : 0;

  const handleAddToCart = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (Array.isArray(product?.variants) && product.variants.length > 1) {
        if (openVariantSelection) {
          openVariantSelection(product);
          return;
        }
      }

      addToCart({
        ...product,
        id: productId,
        variantSku: variantKey,
        variantName: defaultVariant?.name || "",
      });
    },
    [product, productId, variantKey, defaultVariant?.name, openVariantSelection, addToCart]
  );

  const handleIncrement = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      updateQuantity(productId, 1, variantKey);
    },
    [updateQuantity, productId, variantKey]
  );

  const handleDecrement = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (quantity === 1) {
        removeFromCart(productId, variantKey);
      } else {
        updateQuantity(productId, -1, variantKey);
      }
    },
    [quantity, removeFromCart, updateQuantity, productId, variantKey]
  );

  return (
    <div
      onClick={() => openProduct(product)}
      className="group bg-white rounded-2xl p-2 sm:p-2.5 shadow-sm border border-white/60 flex flex-col justify-between active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden select-none hover:shadow-md h-full"
    >
      {/* 1. Image Box with % OFF tag and + / - Stepper */}
      <div className="relative w-full aspect-square rounded-xl bg-[#f8f9fa] flex items-center justify-center overflow-hidden mb-1.5 border border-slate-100">
        {/* Top-Left % OFF Badge */}
        {hasDiscount && discountPercent > 0 && (
          <span className="absolute top-0 left-0 bg-[#e11d48] text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-tl-xl rounded-br-lg z-10 leading-none shadow-xs tracking-tight">
            {discountPercent}% OFF
          </span>
        )}

        {/* Product Image */}
        {image ? (
          <img
            src={applyCloudinaryTransform(image, "f_auto,q_auto,w_300")}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <ImageOff size={24} className="text-slate-300" aria-hidden="true" />
        )}

        {/* Bottom-Right + / - [qty] + Button */}
        {quantity > 0 ? (
          <div
            className="absolute bottom-1 right-1 h-6 sm:h-7 bg-[#0b63b6] text-white rounded-lg flex items-center px-1 gap-1 shadow-md z-10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              type="button"
              onClick={handleDecrement}
              className="w-4 h-full flex items-center justify-center hover:bg-white/20 rounded cursor-pointer transition-colors active:scale-90"
              title="Decrease quantity"
            >
              <Minus size={11} strokeWidth={2.8} />
            </button>
            <span className="text-[11px] font-black min-w-[12px] text-center leading-none">
              {quantity}
            </span>
            <button
              type="button"
              onClick={handleIncrement}
              className="w-4 h-full flex items-center justify-center hover:bg-white/20 rounded cursor-pointer transition-colors active:scale-90"
              title="Increase quantity"
            >
              <Plus size={11} strokeWidth={2.8} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAddToCart}
            className="absolute bottom-1 right-1 w-6 h-6 sm:w-7 sm:h-7 bg-[#0b63b6] hover:bg-[#084b8a] text-white rounded-lg flex items-center justify-center shadow-md active:scale-90 transition-all z-10 cursor-pointer"
            title="Add to cart"
          >
            <Plus size={15} strokeWidth={2.8} />
          </button>
        )}
      </div>

      {/* 2. Product Name, 3. Variant, 4. Price (Strict hierarchy inside white card) */}
      <div className="flex flex-col flex-1 justify-between min-w-0">
        {/* Name & Variant Container */}
        <div>
          {/* Product Name */}
          <h4 className="line-clamp-2 text-[11px] sm:text-[12px] font-bold text-slate-800 leading-snug mb-0.5 group-hover:text-[#0b63b6] transition-colors">
            {product.name}
          </h4>

          {/* Variant (Strictly below Product Name) */}
          <p className="text-[10px] text-slate-500 font-medium truncate mb-1 leading-tight">
            {variantText}
          </p>
        </div>

        {/* Price (Strictly below Variant) */}
        <div className="flex items-baseline gap-1 mt-auto flex-wrap leading-tight pt-0.5">
          <span className="text-[12px] sm:text-[13px] font-black text-slate-900 leading-none">
            {formatPrice(currentPrice)}
          </span>
          {hasDiscount && (
            <span className="text-[10px] text-slate-400 line-through leading-none font-normal">
              {formatPrice(originalPrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const NewArrivalsSection = ({ latitude, longitude }) => {
  const [products, setProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const { language } = useTranslation();
  const { translateObject } = useDynamicTranslation();

  useEffect(() => {
    let cancelled = false;

    const fetchNewArrivals = async () => {
      setIsLoading(true);
      try {
        const params = {
          newArrivals: "true",
          sort: "newest",
          conditionType: "all",
          limit: 30,
          page: 1,
        };
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          params.lat = latitude;
          params.lng = longitude;
        }

        const res = await customerApi.getProducts(params);
        const rawItems = getItems(res);

        if (!cancelled) {
          // Exactly latest 30 products (10 rows of 3)
          const formatted = rawItems.slice(0, 30).map((p) => ({
            ...p,
            id: p._id || p.id,
            image: p.mainImage || p.variants?.[0]?.images?.[0] || p.image || "",
            price: Number(p.salePrice || p.price) || 0,
            originalPrice: Number(p.price || p.variants?.[0]?.price) || 0,
            rating: Number(p.rating) > 0 ? Number(p.rating) : 5.0,
          }));
          setProducts(formatted);
          setDisplayProducts(formatted);
          if (formatted.length === 0 && retryCount < 2) {
            setTimeout(() => {
              if (!cancelled) setRetryCount((prev) => prev + 1);
            }, 3000);
          }
        }
      } catch (error) {
        console.error("Failed to load new arrivals:", error);
        if (!cancelled) {
          setProducts([]);
          setDisplayProducts([]);
          if (retryCount < 2) {
            setTimeout(() => {
              if (!cancelled) setRetryCount((prev) => prev + 1);
            }, 3000);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchNewArrivals();

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, retryCount]);

  useEffect(() => {
    if (language === "en" || products.length === 0) {
      setDisplayProducts(products);
      return;
    }

    let isMounted = true;
    const translateProducts = async () => {
      try {
        const translated = await translateObject(products, ["name", "weight"]);
        if (isMounted) {
          setDisplayProducts(translated);
        }
      } catch (err) {
        if (isMounted) setDisplayProducts(products);
      }
    };

    translateProducts();
    return () => {
      isMounted = false;
    };
  }, [language, products]);

  if (isLoading && products.length === 0) {
    return (
      <section
        className="mx-3.5 sm:mx-4 md:mx-0 mt-4 overflow-hidden rounded-[24px] bg-[#FFB27F] py-4 px-3 sm:px-4 md:px-6 shadow-sm border border-[#ff9d60]/40"
        aria-label="Loading New Arrivals"
      >
        <div className="flex items-center gap-2 px-1 mb-3">
          <div className="h-6 w-36 bg-white/40 animate-pulse rounded-md" />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-2.5 md:gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between shadow-sm border border-white/60 h-44"
            >
              <div className="aspect-square w-full rounded-xl bg-slate-100 animate-pulse mb-1.5" />
              <div className="h-3.5 bg-slate-200 animate-pulse rounded w-3/4 mb-1" />
              <div className="h-3 bg-slate-100 animate-pulse rounded w-1/2 mb-2" />
              <div className="h-4 bg-slate-200 animate-pulse rounded w-1/3 mt-auto" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (displayProducts.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <section
        className="mx-3.5 sm:mx-4 md:mx-0 mt-4 overflow-hidden rounded-[24px] bg-[#FFB27F] py-4 px-3 sm:px-4 md:px-6 shadow-sm border border-[#ff9d60]/40"
        aria-label="New Arrivals"
      >
        {/* Header with Sparkles Icon */}
        <div className="flex items-center justify-between mb-3 px-0.5">
          <h2 className="text-[17px] sm:text-[19px] font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
            <span>New Arrivals</span>
            <Sparkles size={18} className="text-[#e11d48]" fill="#e11d48" />
          </h2>
        </div>

        {/* Responsive Grid: 3 columns on mobile, 4 to 6 columns on desktop */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-2.5 md:gap-3">
          {displayProducts.map((product) => (
            <NewArrivalProductCard
              key={product.id || product._id}
              product={product}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default React.memo(NewArrivalsSection);
