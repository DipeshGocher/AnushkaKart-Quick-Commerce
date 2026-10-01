import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '@core/context/AuthContext';
import { useToast } from '@shared/components/ui/Toast';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

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
            className="fk-catalog-card group cursor-pointer flex flex-col select-none"
        >
            {/* Top: Image Card */}
            <div className="fk-card-image-box relative w-full aspect-square bg-white rounded-2xl border border-[#e5e7eb] p-2.5 flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:border-[#2874f0]/60 group-hover:shadow-xs group-active:scale-[0.98]">
                {/* Wishlist Heart Button (Top Right) */}
                <button
                    type="button"
                    onClick={handleWishlist}
                    aria-label="Wishlist"
                    className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/95 border border-gray-200/70 flex items-center justify-center shadow-xs transition-transform active:scale-90 hover:bg-white"
                >
                    <Heart
                        size={15}
                        className={isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-500'}
                    />
                </button>

                {/* Centered Product Image */}
                <img
                    src={applyCloudinaryTransform(product.image, 'f_auto,q_auto,w_300')}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-contain max-h-[135px] transition-transform duration-200 group-hover:scale-105"
                />

                {/* Variants Pill (Bottom Right) */}
                {variantsCount > 1 && (
                    <span className="absolute bottom-2 right-2 text-[10px] font-bold text-[#2874f0] bg-white border border-[#2874f0]/40 px-2 py-0.5 rounded-full shadow-2xs">
                        {variantsCount} variants
                    </span>
                )}
            </div>

            {/* Bottom: Only Product Name, Rating/Assured & Price */}
            <div className="pt-2 px-0.5 flex flex-col flex-1">
                {/* Optional Sponsored tag */}
                {product.isFeatured && (
                    <span className="text-[10px] font-medium text-gray-400 leading-none mb-1">
                        Sponsored
                    </span>
                )}

                {/* Product Name */}
                <h4 className="text-[13px] font-medium text-[#212121] line-clamp-2 leading-[1.25] min-h-[32px]">
                    {product.name}
                </h4>

                {/* Ratings & Flipkart Assured Badge */}
                <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[11px] text-[#388e3c] tracking-tighter leading-none">
                        ★★★★<span className="text-gray-300">★</span>
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-extrabold italic text-[#2874f0] leading-none">
                        <svg className="w-3.5 h-3.5 fill-[#2874f0]" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                        Assured
                    </span>
                </div>

                {/* Price Row: Discount + Original Strikethrough + Sale Price */}
                <div className="flex items-baseline gap-1.5 mt-1.5 flex-wrap">
                    {discount > 0 && (
                        <span className="text-[12px] font-bold text-[#388e3c] leading-none flex items-center">
                            ↓{discount}%
                        </span>
                    )}
                    {originalPrice > price && (
                        <span className="text-[12px] text-gray-400 line-through leading-none">
                            ₹{originalPrice}
                        </span>
                    )}
                    <span className="text-[15px] font-bold text-[#212121] leading-none">
                        ₹{price}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default FlipkartCatalogCard;
