import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '@core/context/AuthContext';
import { useToast } from '@shared/components/ui/Toast';
import { applyCloudinaryTransform, isPngImage } from '@/core/utils/imageUtils';
import { cn } from '@/lib/utils';
import { getProductVariantText } from '@/core/utils/productUrl';

/**
 * FlipkartCatalogCard
 * - Clean image card with rounded corners, heart icon top-right, variants pill bottom-right
 * - Below image: Product name, ratings + Flipkart Assured badge, and Price (discount, MRP, sale price)
 * - NO ADD button on the card outside
 * - Clicking the card triggers onProductClick (opens ProductDetailSheet with all details and ADD button)
 */
const FlipkartCatalogCard = ({ product, onProductClick }) => {
    const { isInWishlist, toggleWishlist } = useWishlist();
    const { isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const productId = product.id || product._id;
    const isWishlisted = isInWishlist(productId);

    const price = Number(product.price || product.salePrice || 0);
    const originalPrice = Number(product.originalPrice || 0);
    const discount = originalPrice > price && originalPrice > 0
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : 0;

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const variantsCount = variants.length;

    const rawImage = product.image || product.mainImage || product.variants?.[0]?.images?.[0] || '';
    const isPng = typeof rawImage === 'string' && (rawImage.toLowerCase().endsWith('.png') || rawImage.toLowerCase().includes('.png?') || rawImage.toLowerCase().includes('/png'));

    const handleWishlist = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isAuthenticated) {
            navigate('/login', { state: { from: window.location.pathname } });
            return;
        }
        toggleWishlist(product);
        showToast(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist', 'info');
    };

    return (
        <div
            onClick={() => onProductClick && onProductClick(product)}
            className="fk-catalog-card group cursor-pointer flex flex-col select-none w-full min-w-0 max-w-full"
        >
            {/* Top: Full Card Image Area with visible off-white / grey background and border */}
            <div className="customer-product-clean-image relative w-full aspect-square bg-[#f1f3f6] border border-[#e0e3e8] rounded-xl sm:rounded-2xl p-0 flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:scale-[1.01] shadow-2xs">
                {/* Wishlist Heart Button (Top Right) */}
                <button
                    type="button"
                    onClick={handleWishlist}
                    aria-label="Wishlist"
                    className="absolute top-1 right-1 z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/90 flex items-center justify-center shadow-2xs transition-transform active:scale-90 hover:bg-white border-0"
                >
                    <Heart
                        size={11}
                        className={isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-500'}
                    />
                </button>

                {/* Centered Product Image */}
                <img
                    src={applyCloudinaryTransform(rawImage, 'f_auto,q_auto,w_300')}
                    alt={product.name}
                    loading="lazy"
                    className={cn(
                        "w-full h-full transition-transform duration-200 group-hover:scale-105",
                        isPngImage(rawImage)
                            ? "is-png-image object-contain p-1"
                            : "is-normal-image object-cover p-0"
                    )}
                />

                {/* Variants Pill (Bottom Right) */}
                {variantsCount > 1 && (
                    <span className="absolute bottom-1 right-1 z-10 text-[8px] sm:text-[9px] font-bold text-[#2874f0] bg-white border border-[#2874f0]/40 px-1 py-0.2 rounded-full shadow-2xs leading-none">
                        {variantsCount} options
                    </span>
                )}
            </div>

            {/* Bottom: Only Product Name & Price (NO external Add button) */}
            <div className="pt-1 px-0.5 flex flex-col flex-1 min-w-0 w-full overflow-hidden">
                {/* 1. Product Name */}
                <h4 className="fk-product-title truncate text-[11px] sm:text-[12px] font-semibold text-[#212121] leading-tight group-hover:text-[#2874f0] transition-colors">
                    {product.name}
                </h4>

                {/* 2. Variant */}
                <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5 leading-tight">
                    {getProductVariantText(product)}
                </p>

                {/* 3. Price Row: Discount Price, Cut MRP (if discount), and Green % off, else only Original price */}
                <div className="flex items-center gap-1 mt-0.5 flex-wrap leading-tight">
                    <span className="fk-product-price text-[11px] sm:text-[12px] font-semibold text-[#212121]">
                        ₹{price}
                    </span>
                    {originalPrice > price && (
                        <span className="fk-product-mrp text-[9.5px] sm:text-[10px] text-slate-400 line-through font-normal">
                            ₹{originalPrice}
                        </span>
                    )}
                    {discount > 0 && (
                        <span className="fk-product-discount text-[9.5px] sm:text-[10px] font-semibold text-[#388e3c]">
                            {discount}% off
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FlipkartCatalogCard;
