import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { X, ChevronDown, ChevronUp, FileText, Share2, Heart, Search, Clock, Minus, Plus, ShoppingBag, ShoppingCart, Star, MessageSquare, ArrowLeft, ChevronRight, ChevronLeft, Store, Building2, Package, RotateCcw, Banknote, ShieldCheck, Zap, Award, Truck, Ban, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { useProductDetail } from '../../context/ProductDetailContext';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useCart, resolveVariantStock } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '@core/context/AuthContext';
import { useToast } from '@shared/components/ui/Toast';
import { useSettings } from '@core/context/SettingsContext';
import { useLocation as useAppLocation } from '../../context/LocationContext';
import { useDeliveryEligibility } from '../../hooks/useDeliveryEligibility';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform, IMAGE_PRESETS } from '@/core/utils/imageUtils';
import { customerApi } from '../../services/customerApi';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import ParticleBurst from './ParticleBurst';
import ProductCard from './ProductCard';
import { setStatusBarColor } from '@/core/utils/statusBar';

const extendedProductMemoryCache = new Map();
const reviewsMemoryCache = new Map();
const similarProductsMemoryCache = new Map();

/**
 * ProgressiveProductImage
 * Renders the cached thumbnail immediately (from the already-rendered card cache)
 * and seamlessly displays the high-resolution image once loaded, preventing layout shifts
 * and grey placeholder flashes.
 */
const ProgressiveProductImage = ({
    thumbSrc,
    highResSrc,
    alt = "",
    loading = "lazy",
    fetchPriority = "auto",
    imgClassName = "",
    containerClassName = "",
    onClick
}) => {
    const [highResLoaded, setHighResLoaded] = useState(false);

    useEffect(() => {
        setHighResLoaded(false);
    }, [highResSrc]);

    if (!highResSrc || thumbSrc === highResSrc) {
        return (
            <img
                src={highResSrc || thumbSrc}
                alt={alt}
                loading={loading}
                fetchPriority={fetchPriority}
                decoding="async"
                referrerPolicy="no-referrer"
                className={imgClassName}
                onClick={onClick}
            />
        );
    }

    return (
        <div
            className={cn("relative w-full h-full flex items-center justify-center", containerClassName)}
            onClick={onClick}
        >
            {/* Instant thumbnail preview (zero network latency from disk/memory cache) */}
            <img
                src={thumbSrc}
                alt={alt}
                loading={loading}
                fetchPriority={fetchPriority}
                decoding="async"
                referrerPolicy="no-referrer"
                className={cn(
                    imgClassName,
                    "absolute inset-0 m-auto transition-opacity duration-200",
                    highResLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
                )}
            />
            {/* Crisp high-resolution detail image */}
            <img
                src={highResSrc}
                alt={alt}
                loading={loading}
                fetchPriority={fetchPriority}
                decoding="async"
                referrerPolicy="no-referrer"
                onLoad={() => setHighResLoaded(true)}
                className={cn(
                    imgClassName,
                    "relative transition-opacity duration-200",
                    highResLoaded ? "opacity-100" : "opacity-0"
                )}
            />
        </div>
    );
};

const ProductDetailSheet = () => {
    const { selectedProduct, isOpen, closeProduct } = useProductDetail();

    const activeHeaderColor = useMemo(() => {
        if (typeof window === 'undefined') return '#0ea5e9';
        const path = window.location.pathname || '';
        if (path.startsWith('/products')) return '#0ea5e9';
        if (path.startsWith('/category/')) return '#028ce8';

        const rootHomeColor = typeof document !== 'undefined'
            ? document.documentElement.style.getPropertyValue('--customer-header-base-color')?.trim()
            : null;
        if (rootHomeColor) return rootHomeColor;

        return '#0ea5e9';
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setStatusBarColor(activeHeaderColor, false);
        }
    }, [isOpen, activeHeaderColor]);
    const { 
        cart, 
        cartCount, 
        addToCart, 
        updateQuantity, 
        removeFromCart, 
        cartTotal,
        groceryCartCount,
        refurbishedCartCount,
        groceryCartTotal,
        refurbishedCartTotal
    } = useCart();
    const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { settings } = useSettings();
    const { currentLocation } = useAppLocation();
    const supportEmail = settings?.supportEmail || 'support@example.com';

    const [extendedProduct, setExtendedProduct] = useState(null);
    const activeProduct = extendedProduct || selectedProduct;

    const {
        isDeliverable,
        canAddToCart,
        badge: deliveryBadge,
        warning: deliveryWarning,
        deliveryEstimate,
        fulfillmentType,
        customerPincode
    } = useDeliveryEligibility(activeProduct);

    const [isExpanded, setIsExpanded] = useState(true);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const activeImageIndexRef = useRef(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [isMobileDevice, setIsMobileDevice] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );

    useEffect(() => {
        const handleResize = () => {
            setIsMobileDevice(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isRefurbishedProduct = useMemo(() => {
        if (!selectedProduct) return false;
        if (selectedProduct.conditionType === 'new' && selectedProduct.catalogType !== 'refurbished') {
            return false;
        }
        return (
            selectedProduct.conditionType === 'refurbished' ||
            selectedProduct.isRefurbished ||
            selectedProduct.catalogType === 'refurbished' ||
            (selectedProduct.conditionType !== 'new' && typeof window !== 'undefined' && (
                window.location.pathname.includes('/marketplace') ||
                window.location.pathname.startsWith('/marketplace') ||
                window.location.pathname.includes('/refurbished') ||
                window.location.pathname.startsWith('/refurbished')
            ))
        );
    }, [selectedProduct]);

    const [reviews, setReviews] = useState([]);
    const [reviewLoading, setReviewLoading] = useState(true);
    const [isReviewsOpen, setIsReviewsOpen] = useState(true);
    const [previewReviewImage, setPreviewReviewImage] = useState(null);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
    const [localHasReviewed, setLocalHasReviewed] = useState(false);
    const [expandedSections, setExpandedSections] = useState(['specification']); // Start with description open
    const [showHeartPopup, setShowHeartPopup] = useState(false);
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
    const [similarProducts, setSimilarProducts] = useState([]);
    const [similarLoading, setSimilarLoading] = useState(false);
    


    const toggleSection = (section) => {
        setExpandedSections(prev =>
            prev.includes(section)
                ? prev.filter(s => s !== section)
                : [...prev, section]
        );
    };

    const scrollRef = useRef(null);
    const desktopContentRef = useRef(null);
    const mobileContentRef = useRef(null);

    const allImages = useMemo(() => {
        const prod = activeProduct || selectedProduct;
        if (!prod) return [];
        const images = [];
        if (prod.mainImage) images.push(prod.mainImage);
        else if (prod.image) images.push(prod.image);

        if (prod.galleryImages && Array.isArray(prod.galleryImages)) {
            images.push(...prod.galleryImages);
        } else if (prod.images && Array.isArray(prod.images)) {
            const extra = prod.images.filter(img => img !== prod.mainImage && img !== prod.image);
            images.push(...extra);
        }

        // Add variant images
        if (Array.isArray(prod.variants)) {
            prod.variants.forEach(v => {
                if (v.images && Array.isArray(v.images)) {
                    images.push(...v.images);
                } else if (v.image) {
                    images.push(v.image);
                }
            });
        }

        // Filter valid images and deduplicate
        const validImages = images.filter(
            (img) =>
                img &&
                typeof img === "string" &&
                img.trim().length > 0 &&
                !img.includes("api-preprod.phonepe.com")
        );
        const uniqueImages = [...new Set(validImages)];

        return uniqueImages.length > 0
            ? uniqueImages
            : [
                prod.mainImage || prod.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400",
            ];
    }, [activeProduct, selectedProduct]);

    const handleVariantSelect = (v) => {
        setSelectedVariant(v);
        const variantImage = (v.images && v.images.length > 0) ? v.images[0] : v.image;
        if (variantImage) {
            const imgIndex = allImages.findIndex(img => img === variantImage);
            if (imgIndex !== -1) {
                setActiveImageIndex(imgIndex);
                if (scrollRef.current) {
                    const width = scrollRef.current.offsetWidth;
                    scrollRef.current.scrollTo({ left: width * imgIndex, behavior: 'smooth' });
                }
            }
        }
    };



    const activePidRef = useRef(null);

    // Update variant when product changes
    useEffect(() => {
        setNewReview({ rating: 5, comment: '' });
        setLocalHasReviewed(false);
        setIsDescriptionOpen(true);

        const initialVariants = selectedProduct?.variants || [];
        if (Array.isArray(initialVariants) && initialVariants.length > 0) {
            setSelectedVariant(initialVariants[0]);
        } else {
            setSelectedVariant(null);
        }
        setActiveImageIndex(0);
        activeImageIndexRef.current = 0;

        if (desktopContentRef.current) {
            desktopContentRef.current.scrollTo({ top: 0, behavior: 'instant' });
        }
        if (mobileContentRef.current) {
            mobileContentRef.current.scrollTo({ top: 0, behavior: 'instant' });
        }

        const pid = selectedProduct?.id || selectedProduct?._id;
        activePidRef.current = pid || null;

        if (pid) {
            // CRITICAL FIX: Load from cache if available; otherwise reset to null so previous product's data never flashes!
            if (extendedProductMemoryCache.has(pid)) {
                const cachedProd = extendedProductMemoryCache.get(pid);
                setExtendedProduct(cachedProd);
                if (Array.isArray(cachedProd?.variants) && cachedProd.variants.length > 0) {
                    setSelectedVariant(prev => {
                        if (!prev) return cachedProd.variants[0];
                        const match = cachedProd.variants.find(v => 
                            (v.sku && prev.sku && String(v.sku).trim().toLowerCase() === String(prev.sku).trim().toLowerCase()) ||
                            (v.name && prev.name && String(v.name).trim().toLowerCase() === String(prev.name).trim().toLowerCase())
                        );
                        return match || cachedProd.variants[0];
                    });
                }
            } else {
                setExtendedProduct(null);
            }

            if (reviewsMemoryCache.has(pid)) {
                setReviews(reviewsMemoryCache.get(pid));
                setReviewLoading(false);
            } else {
                setReviews([]);
                setReviewLoading(true);
            }

            fetchExtendedProduct(pid);

            const catId = selectedProduct.categoryId?._id || selectedProduct.categoryId || selectedProduct.headerId?._id || selectedProduct.headerId;
            const simKey = `${catId || 'all'}:${pid}`;
            if (similarProductsMemoryCache.has(simKey)) {
                setSimilarProducts(similarProductsMemoryCache.get(simKey));
                setSimilarLoading(false);
            } else {
                setSimilarProducts([]);
                setSimilarLoading(true);
            }

            // Defer secondary data (Reviews & Similar Products) so initial entrance animation runs buttery smooth without network/main-thread lock
            const deferredTimer = setTimeout(() => {
                if (activePidRef.current === pid) {
                    fetchReviews(pid);
                    fetchSimilarProducts(catId, pid, simKey);
                }
            }, 180);

            return () => {
                clearTimeout(deferredTimer);
            };
        } else {
            setExtendedProduct(null);
            setReviews([]);
            setSimilarProducts([]);
        }
    }, [selectedProduct]);

    const fetchExtendedProduct = async (productId) => {
        try {
            const hasValidLocation =
                Number.isFinite(currentLocation?.latitude) &&
                Number.isFinite(currentLocation?.longitude);

            const params = hasValidLocation ? {
                lat: currentLocation.latitude,
                lng: currentLocation.longitude
            } : {};

            const res = await customerApi.getProductById(productId, params);
            if (activePidRef.current !== productId) return; // Stale check!
            if (res.data?.success && res.data.result) {
                const fullProd = res.data.result;
                extendedProductMemoryCache.set(productId, fullProd);
                setExtendedProduct(fullProd);
                if (Array.isArray(fullProd.variants) && fullProd.variants.length > 0) {
                    setSelectedVariant(prev => {
                        if (!prev) return fullProd.variants[0];
                        const match = fullProd.variants.find(v => 
                            (v.sku && prev.sku && String(v.sku).trim().toLowerCase() === String(prev.sku).trim().toLowerCase()) ||
                            (v.name && prev.name && String(v.name).trim().toLowerCase() === String(prev.name).trim().toLowerCase())
                        );
                        return match || fullProd.variants[0];
                    });
                }
            }
        } catch (error) {
            if (activePidRef.current !== productId) return;
            console.error("Fetch extended product error:", error);
        }
    };

    const fetchReviews = async (productId) => {
        try {
            const res = await customerApi.getProductReviews(productId);
            if (activePidRef.current !== productId) return; // Stale check!
            if (res.data?.success) {
                const list = res.data.results || res.data.result || [];
                const arr = Array.isArray(list) ? list : [];
                reviewsMemoryCache.set(productId, arr);
                setReviews(arr);
            }
        } catch (error) {
            if (activePidRef.current !== productId) return;
            console.error("Fetch reviews error:", error);
            if (!reviewsMemoryCache.has(productId)) setReviews([]);
        } finally {
            if (activePidRef.current === productId) {
                setReviewLoading(false);
            }
        }
    };

    const fetchSimilarProducts = async (catId, currentProdId, simKey) => {
        if (!catId) return;
        try {
            const params = { limit: 15 };
            params.categoryId = catId;
            if (currentLocation?.latitude && currentLocation?.longitude) {
                params.lat = currentLocation.latitude;
                params.lng = currentLocation.longitude;
            }
            const res = await customerApi.getProducts(params);
            if (activePidRef.current !== currentProdId) return; // Stale check!
            let items = [];
            if (res.data?.success) {
                const raw = res.data.results || res.data.result?.items || res.data.result || [];
                items = (Array.isArray(raw) ? raw : []).filter(p => (p._id || p.id) !== currentProdId);
            }
            
            // If fewer than 2 items found by categoryId, fall back to headerId
            if (items.length < 2 && selectedProduct?.headerId) {
                const hId = selectedProduct.headerId?._id || selectedProduct.headerId;
                const hRes = await customerApi.getProducts({ headerId: hId, limit: 15 });
                if (activePidRef.current !== currentProdId) return;
                if (hRes.data?.success) {
                    const hRaw = hRes.data.results || hRes.data.result?.items || hRes.data.result || [];
                    const hItems = (Array.isArray(hRaw) ? hRaw : []).filter(p => (p._id || p.id) !== currentProdId);
                    if (hItems.length > items.length) {
                        items = hItems;
                    }
                }
            }

            const finalItems = items.slice(0, 10);
            if (simKey) similarProductsMemoryCache.set(simKey, finalItems);
            setSimilarProducts(finalItems);
        } catch (err) {
            if (activePidRef.current !== currentProdId) return;
            console.error("Error fetching similar products:", err);
            if (simKey && !similarProductsMemoryCache.has(simKey)) setSimilarProducts([]);
        } finally {
            if (activePidRef.current === currentProdId) {
                setSimilarLoading(false);
            }
        }
    };

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (!newReview.comment.trim()) return;

        try {
            setIsSubmittingReview(true);
            const res = await customerApi.submitReview({
                productId: selectedProduct.id,
                rating: newReview.rating,
                comment: newReview.comment
            });
            if (res.data.success) {
                showToast("Review submitted successfully", "success");
                setNewReview({ rating: 5, comment: '' });
                setLocalHasReviewed(true);
                setReviews(prev => [{
                    _id: 'temp-' + Date.now(),
                    rating: newReview.rating,
                    comment: newReview.comment,
                    createdAt: new Date().toISOString(),
                    userId: { name: 'You' },
                    status: 'pending'
                }, ...prev]);
            }
        } catch (error) {
            showToast(error.response?.data?.message || "Failed to submit review", "error");
        } finally {
            setIsSubmittingReview(false);
        }
    };

    // If no product selected, don't render anything (well, Context handles isOpen, but still good check)
    // Removed early return to satisfy Rules of Hooks (hooks must be called in same order)
    // if (!selectedProduct && !isOpen) return null;

    // Strip raw RTF/RTF-like codes from description strings from the backend
    const cleanDescription = (text) => {
        if (!text) return null;
        // Detect RTF format
        if (text.trim().startsWith('{\\rtf') || text.includes('\\par')) {
            // Extract readable text: remove RTF control words and braces
            return text
                .replace(/\{\\[^}]*\}/g, '') // Remove groups like {\rtf1 ...}
                .replace(/\\[a-z]+\d*\s?/gi, '') // Remove control words like \par \b \fs22
                .replace(/[{}]/g, '') // Remove remaining braces
                .replace(/\\'/g, "'") // Replace escaped apostrophes
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
        }
        return text;
    };

    const activeVariants = useMemo(() => {
        const prod = activeProduct || selectedProduct;
        if (Array.isArray(prod?.variants) && prod.variants.length > 0) {
            return prod.variants;
        }
        return [];
    }, [activeProduct, selectedProduct]);

    const variantKey = String(selectedVariant?.sku || selectedVariant?.name || "").trim();
    const currentStock = useMemo(() => {
        const prod = activeProduct || selectedProduct;
        if (!prod) return 0;
        return resolveVariantStock(prod, variantKey);
    }, [activeProduct, selectedProduct, variantKey]);

    const isSoldOut = useMemo(() => {
        const prod = activeProduct || selectedProduct;
        if (!prod) return false;

        // If product has variants
        if (activeVariants.length > 0) {
            const hasAnyVariantInStock = activeVariants.some(
                (v) => (typeof v?.stock === "number" ? v.stock : Number(v?.stock || 0)) > 0
            );
            if (!hasAnyVariantInStock) return true;

            if (selectedVariant) {
                const matched = activeVariants.find(
                    (v) =>
                        (v.sku && selectedVariant.sku && String(v.sku).trim().toLowerCase() === String(selectedVariant.sku).trim().toLowerCase()) ||
                        (v.name && selectedVariant.name && String(v.name).trim().toLowerCase() === String(selectedVariant.name).trim().toLowerCase())
                );
                const stockVal = matched
                    ? (typeof matched.stock === "number" ? matched.stock : Number(matched.stock || 0))
                    : (typeof selectedVariant.stock === "number" ? selectedVariant.stock : Number(selectedVariant.stock || 0));
                if (stockVal <= 0) return true;
            } else if (currentStock <= 0) {
                return true;
            }
            return false;
        }

        // Single product without variants
        const rootStock = typeof prod.stock === "number" ? prod.stock : Number(prod.stock ?? 0);
        return currentStock <= 0 || rootStock <= 0;
    }, [activeProduct, selectedProduct, activeVariants, selectedVariant, currentStock]);
    const isLowStock = currentStock > 0 && currentStock <= 2 && !isSoldOut;

    const resolvedSellingPrice = useMemo(() => {
        const prod = activeProduct || selectedProduct;
        if (!prod) return 0;
        if (selectedVariant) {
            return Number(selectedVariant.salePrice || selectedVariant.price || 0);
        }
        if (prod.salePrice && Number(prod.salePrice) > 0) {
            return Number(prod.salePrice);
        }
        return Number(prod.price || 0);
    }, [selectedVariant, activeProduct, selectedProduct]);

    const resolvedOriginalPrice = useMemo(() => {
        const prod = activeProduct || selectedProduct;
        if (!prod) return 0;
        if (selectedVariant) {
            return Number(
                selectedVariant.price && selectedVariant.salePrice && Number(selectedVariant.price) > Number(selectedVariant.salePrice)
                    ? selectedVariant.price
                    : (selectedVariant.originalPrice || selectedVariant.mrp || resolvedSellingPrice)
            );
        }
        if (prod.originalPrice && Number(prod.originalPrice) > 0) {
            return Number(prod.originalPrice);
        }
        if (prod.mrp && Number(prod.mrp) > 0) {
            return Number(prod.mrp);
        }
        if (prod.salePrice && Number(prod.salePrice) > 0 && Number(prod.price) > Number(prod.salePrice)) {
            return Number(prod.price);
        }
        return resolvedSellingPrice;
    }, [selectedVariant, activeProduct, selectedProduct, resolvedSellingPrice]);

    const effectivePrice = resolvedSellingPrice;

    const activeProductId = String(activeProduct?._id || activeProduct?.id || selectedProduct?._id || selectedProduct?.id || "");
    const activeVariantKey = String(selectedVariant?.sku || selectedVariant?.name || variantKey || "").trim();

    const cartItem = useMemo(() => {
        if (!activeProductId) return null;
        return cart.find((item) => {
            const itemPid = String(item.id || item._id || "");
            const itemSku = String(item.variantSku || "").trim();
            if (itemPid !== activeProductId) return false;
            if (activeVariantKey) {
                return itemSku === activeVariantKey;
            }
            return !itemSku || itemSku === activeVariantKey;
        });
    }, [cart, activeProductId, activeVariantKey]);

    const quantity = cartItem ? Number(cartItem.quantity || 0) : 0;

    const isWishlisted = useMemo(() => {
        const ids = [
            activeProduct?.id,
            activeProduct?._id,
            selectedProduct?.id,
            selectedProduct?._id,
            selectedProduct?.productId,
        ].filter(Boolean);
        return ids.some((id) => isInWishlist(id));
    }, [activeProduct, selectedProduct, isInWishlist]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"; // Prevent background scroll
            document.body.style.touchAction = "none"; // Disable swipe background panning
            document.documentElement.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
            document.body.style.touchAction = "auto";
            document.documentElement.style.overflow = "unset";
            setIsExpanded(false);
        }

        // Cleanup function to ensure scroll is restored if component unmounts
        return () => {
            document.body.style.overflow = "unset";
            document.body.style.touchAction = "auto";
            document.documentElement.style.overflow = "unset";
        }
    }, [isOpen]);

    const handleShareProduct = async (e) => {
        e?.stopPropagation?.();
        const prod = activeProduct || selectedProduct;
        if (!prod) return;

        const idOrSlug = prod.slug || prod._id || prod.id;
        const shareUrl = `${window.location.origin}/product/${idOrSlug}`;
        const shareTitle = prod.name || "Check out this product on AnushkaKart";
        const priceToShare = selectedVariant?.salePrice || selectedVariant?.price || prod.salePrice || prod.price;
        const shareText = `Check out ${prod.name} on AnushkaKart for just ₹${priceToShare}!\n${shareUrl}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: shareTitle,
                    text: shareText,
                    url: shareUrl,
                });
                return;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error("Share failed", err);
                } else {
                    return;
                }
            }
        }

        // Fallback: Clipboard copy
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareUrl);
                showToast("Product link copied to clipboard!", "success");
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = shareUrl;
                textArea.style.position = "fixed";
                textArea.style.opacity = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);
                showToast("Product link copied to clipboard!", "success");
            }
        } catch {
            showToast("Could not copy link automatically", "error");
        }
    };

    const toggleWishlist = (e) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }

        if (!isAuthenticated) {
            closeProduct();
            navigate('/login', { state: { from: window.location.pathname } });
            return;
        }

        if (!isWishlisted) {
            setShowHeartPopup(true);
            setTimeout(() => setShowHeartPopup(false), 1000);
        }

        const prod = activeProduct || selectedProduct;
        toggleWishlistGlobal({
            ...prod,
            id: prod?.id || prod?._id,
            _id: prod?._id || prod?.id,
            conditionType: isRefurbishedProduct ? 'refurbished' : (prod?.conditionType || 'new'),
        });
    };

    const handleAddToCart = async () => {
        if (!isAuthenticated) {
            closeProduct();
            navigate('/login', { state: { from: window.location.pathname } });
            return;
        }

        if (!canAddToCart) {
            showToast(deliveryWarning || "This item is only delivered in local areas.", 'error');
            return;
        }

        if (isSoldOut) {
            showToast("This product is currently sold out.", "error");
            return;
        }

        const targetProduct = activeProduct || selectedProduct;
        let customData = {};
        
        await addToCart(
            {
                ...targetProduct,
                conditionType: isRefurbishedProduct ? 'refurbished' : (targetProduct?.conditionType || 'new'),
            },
            1, 
            String(selectedVariant?.sku || selectedVariant?.name || "").trim(),
            customData
        );
        closeProduct();
        navigate('/cart');
    };

    const handleBuyNow = () => {
        if (!isAuthenticated) {
            closeProduct();
            navigate('/login', { state: { from: window.location.pathname } });
            return;
        }

        if (!canAddToCart) {
            showToast(deliveryWarning || "This item is only delivered in local areas.", 'error');
            return;
        }

        if (isSoldOut) {
            showToast("This product is currently sold out.", "error");
            return;
        }

        const targetProduct = activeProduct || selectedProduct;
        const pidOrSlug = targetProduct?.slug || targetProduct?.id || targetProduct?._id;
        const buyNowItem = {
            id: targetProduct?.id || targetProduct?._id,
            _id: targetProduct?.id || targetProduct?._id,
            name: targetProduct.name,
            title: targetProduct.name,
            image: (selectedVariant?.images && selectedVariant.images[0]) || selectedVariant?.image || targetProduct.mainImage || (targetProduct.images && targetProduct.images[0]) || "",
            price: resolvedSellingPrice,
            salePrice: resolvedSellingPrice,
            originalPrice: resolvedOriginalPrice > resolvedSellingPrice ? resolvedOriginalPrice : (targetProduct.originalPrice || targetProduct.mrp || resolvedSellingPrice),
            variantSku: String(selectedVariant?.sku || selectedVariant?.name || "").trim(),
            variantName: selectedVariant?.name || "",
            variant: selectedVariant || null,
            quantity: 1,
            fulfillmentType: fulfillmentType === "LOCAL_RIDERS" || fulfillmentType === "LOCAL" ? "LOCAL" : "SHIPROCKET",
            conditionType: isRefurbishedProduct ? 'refurbished' : (targetProduct?.conditionType || 'new'),
            weight: targetProduct.weight,
            dimensions: targetProduct.dimensions,
            slug: targetProduct.slug || "",
            productData: targetProduct,
        };

        const currentPath = window.location.pathname;
        const returnProductUrl = currentPath.includes('/cart') || currentPath.includes('/checkout')
            ? `/?product=${encodeURIComponent(pidOrSlug)}`
            : `${currentPath}?product=${encodeURIComponent(pidOrSlug)}`;

        try {
            sessionStorage.setItem("direct_buy_item", JSON.stringify(buyNowItem));
            sessionStorage.setItem("direct_buy_return_url", returnProductUrl);
        } catch (e) {}

        closeProduct();
        navigate('/checkout', {
            state: {
                directBuyItem: buyNowItem,
                returnProductUrl,
                fromBuyNow: true,
                initialFulfillmentType: fulfillmentType === "LOCAL_RIDERS" || fulfillmentType === "LOCAL" ? "LOCAL" : "SHIPROCKET",
                destinationPincode: customerPincode || "",
            }
        });
    };

    const handleIncrement = () => {
        if (!isAuthenticated) {
            closeProduct();
            navigate('/login', { state: { from: window.location.pathname } });
            return;
        }
        const maxAllowed = currentStock > 0 ? Math.min(currentStock, 10) : 0;
        if (quantity >= currentStock) {
            showToast(`You cannot add more than available stock (${currentStock} units)`, 'error');
            return;
        }
        if (quantity >= maxAllowed) {
            showToast(`Maximum allowed order quantity is ${maxAllowed} units per item`, 'error');
            return;
        }
        const pid = activeProduct?.id || activeProduct?._id || selectedProduct?.id || selectedProduct?._id;
        updateQuantity(pid, 1, String(selectedVariant?.sku || selectedVariant?.name || "").trim());
    };

    const handleDecrement = () => {
        const pid = activeProduct?.id || activeProduct?._id || selectedProduct?.id || selectedProduct?._id;
        if (quantity === 1) {
            removeFromCart(pid, String(selectedVariant?.sku || selectedVariant?.name || "").trim());
        } else {
            updateQuantity(pid, -1, String(selectedVariant?.sku || selectedVariant?.name || "").trim());
        }
    };

    // Scroll handler to expand on scroll
    const handleScroll = (e) => {
        if (!isExpanded && e.currentTarget.scrollTop > 5) {
            setIsExpanded(true);
        }
    };

    // Wheel handler for expansion
    const handleWheel = (e) => {
        if (!isExpanded && e.deltaY > 0) {
            setIsExpanded(true);
            e.stopPropagation();
        } else if (isExpanded) {
            // Allow normal scroll but stop propagation to background
            e.stopPropagation();
        }
    };

    const cleanDesc = cleanDescription(activeProduct?.description || selectedProduct?.description);

    const specificationsList = useMemo(() => {
        if (!activeProduct && !selectedProduct) return [];
        const list = [];
        const seenKeys = new Set();

        // 1. Dynamic attributes from database
        const dynamicAttrs = activeProduct?.dynamicAttributes;
        if (Array.isArray(dynamicAttrs)) {
            dynamicAttrs.forEach((attr) => {
                if (attr && (attr.name || attr.value)) {
                    const k = String(attr.name || '').trim();
                    const v = String(attr.value || '').trim();
                    if (k && v && !seenKeys.has(k.toLowerCase())) {
                        seenKeys.add(k.toLowerCase());
                        list.push({ label: k, value: v });
                    }
                }
            });
        }

        // 1b. Custom specifications from database
        const rawSpecs = activeProduct?.specifications;
        if (Array.isArray(rawSpecs)) {
            rawSpecs.forEach((s) => {
                if (s && (s.key || s.value)) {
                    const k = String(s.key || '').trim();
                    const v = String(s.value || '').trim();
                    if (k && v && !seenKeys.has(k.toLowerCase())) {
                        seenKeys.add(k.toLowerCase());
                        list.push({ label: k, value: v });
                    }
                }
            });
        }

        // 2. Standard product fields if available and not yet included
        const standardFields = [
            { key: 'Brand', value: activeProduct?.brand },
            { key: 'Type', value: activeProduct?.type },
            { key: 'Model Name', value: activeProduct?.modelName || (activeProduct?.name !== selectedProduct?.name ? activeProduct?.name : '') },
            { key: 'Quantity', value: selectedVariant?.name || activeProduct?.quantity },
            { key: 'Pack Of', value: activeProduct?.packOf },
            { key: 'Container Type', value: activeProduct?.containerType },
            { key: 'Maximum Shelf Life', value: activeProduct?.shelfLife },
            { key: 'FSSAI Number', value: activeProduct?.fssaiLicense },
            { key: 'Country of Origin', value: activeProduct?.countryOfOrigin },
            { key: 'Weight', value: activeProduct?.weight },
        ];

        standardFields.forEach((field) => {
            if (field.value && !seenKeys.has(field.key.toLowerCase())) {
                seenKeys.add(field.key.toLowerCase());
                list.push({ label: field.key, value: String(field.value).trim() });
            }
        });

        return list;
    }, [activeProduct, selectedProduct, selectedVariant]);

    const specificationPairs = useMemo(() => {
        const pairs = [];
        for (let i = 0; i < specificationsList.length; i += 2) {
            pairs.push(specificationsList.slice(i, i + 2));
        }
        return pairs;
    }, [specificationsList]);

    const displayPrice = selectedVariant?.salePrice || selectedVariant?.price || selectedProduct?.salePrice || selectedProduct?.price || 0;



    const getTrustBadgeIcon = (iconName) => {
        switch (String(iconName || "").toLowerCase()) {
            case "return":
            case "rotateccw":
            case "replacement":
            case "refresh":
                return RotateCcw;
            case "cod":
            case "cash":
            case "banknote":
                return Banknote;
            case "warranty":
            case "shield":
            case "shieldcheck":
                return ShieldCheck;
            case "quality":
            case "award":
                return Award;
            case "check":
            case "checkcircle":
                return CheckCircle2;
            case "delivery":
            case "zap":
            case "express":
                return Zap;
            case "truck":
                return Truck;
            case "ban":
            case "no-return":
                return Ban;
            case "clock":
                return Clock;
            default:
                return ShieldCheck;
        }
    };

    const resolvedTrustBadges = useMemo(() => {
        // 1. Direct product override
        if (Array.isArray(activeProduct?.trustBadges) && activeProduct.trustBadges.length > 0) {
            return activeProduct.trustBadges.slice(0, 3);
        }
        // 2. Subcategory badges
        if (Array.isArray(activeProduct?.subcategoryId?.trustBadges) && activeProduct.subcategoryId.trustBadges.length > 0) {
            return activeProduct.subcategoryId.trustBadges.slice(0, 3);
        }
        // 3. Level 2 category badges
        if (Array.isArray(activeProduct?.categoryId?.trustBadges) && activeProduct.categoryId.trustBadges.length > 0) {
            return activeProduct.categoryId.trustBadges.slice(0, 3);
        }
        // 4. Level 1 header category badges
        if (Array.isArray(activeProduct?.headerId?.trustBadges) && activeProduct.headerId.trustBadges.length > 0) {
            return activeProduct.headerId.trustBadges.slice(0, 3);
        }

        // 5. Category-Based Intelligent Fallbacks if nothing configured yet
        const categoryName = (
            activeProduct?.subcategoryId?.name ||
            activeProduct?.categoryId?.name ||
            activeProduct?.headerId?.name ||
            activeProduct?.category ||
            ""
        ).toLowerCase();

        const catalogType = (
            activeProduct?.catalogType ||
            activeProduct?.headerId?.catalogType ||
            ""
        ).toLowerCase();

        if (
            categoryName.includes("grocery") ||
            categoryName.includes("fruit") ||
            categoryName.includes("vegetable") ||
            categoryName.includes("food") ||
            catalogType === "grocery"
        ) {
            return [
                { icon: "quality", title: "Quality Assured", subtitle: "CHECK AT DOORSTEP" },
                { icon: "cod", title: "Cash on Delivery", subtitle: "PAY AT DOORSTEP" },
                { icon: "return", title: "Doorstep Return", subtitle: "NO QUESTIONS ASKED" },
            ];
        }

        if (
            categoryName.includes("medicine") ||
            categoryName.includes("pharma") ||
            categoryName.includes("health")
        ) {
            return [
                { icon: "warranty", title: "100% Genuine", subtitle: "VERIFIED PHARMACY" },
                { icon: "cod", title: "Cash on Delivery", subtitle: "PAY AT DOORSTEP" },
                { icon: "delivery", title: "Express Delivery", subtitle: "TEMPERATURE SAFE" },
            ];
        }

        if (
            categoryName.includes("electronic") ||
            categoryName.includes("mobile") ||
            categoryName.includes("appliance")
        ) {
            return [
                { icon: "return", title: "7-Day Replacement", subtitle: "BRAND REPLACEMENT" },
                { icon: "cod", title: "Cash on Delivery", subtitle: "PAY AT DOORSTEP" },
                { icon: "warranty", title: "1 Year Warranty", subtitle: "BRAND WARRANTY" },
            ];
        }

        // Default 3 standard badges
        return [
            { icon: "return", title: "7-Day Return", subtitle: "EASY RETURN" },
            { icon: "cod", title: "Cash on Delivery", subtitle: "PAY AT DOORSTEP" },
            { icon: "warranty", title: "1 Year Warranty details", subtitle: "" },
        ];
    }, [activeProduct]);

    const renderTrustBadges = () => {
        if (!resolvedTrustBadges || resolvedTrustBadges.length === 0) return null;
        const gridCols =
            resolvedTrustBadges.length === 1
                ? "grid-cols-1 max-w-[200px] mx-auto"
                : resolvedTrustBadges.length === 2
                ? "grid-cols-2"
                : "grid-cols-3";

        return (
            <div className={cn("grid gap-2.5 my-3.5", gridCols)}>
                {resolvedTrustBadges.map((badge, idx) => {
                    const IconComp = getTrustBadgeIcon(badge.icon);
                    const isWarrantyOrDetail =
                        badge.title?.toLowerCase().includes("detail") ||
                        badge.subtitle?.toLowerCase().includes("detail") ||
                        badge.title?.toLowerCase().includes("return");

                    return (
                        <div
                            key={idx}
                            className="flex flex-col items-center justify-center p-3 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all"
                        >
                            <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-800 mb-2">
                                <IconComp size={18} strokeWidth={2.3} />
                            </div>
                            <div className="flex items-center justify-center gap-0.5 text-[11px] sm:text-xs font-bold text-slate-900 leading-tight">
                                <span>{badge.title}</span>
                                {isWarrantyOrDetail && (
                                    <ChevronRight size={12} className="text-slate-400 shrink-0" />
                                )}
                            </div>
                            {badge.subtitle && !badge.subtitle.toLowerCase().includes("detail") && (
                                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5 line-clamp-1">
                                    {badge.subtitle}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderDeliveryFulfillmentCard = () => {
        return null;
    };

    const renderMoreDetailsCard = () => {
        if (!specificationsList || specificationsList.length === 0) return null;
        return (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs my-3">
                <h3 className="text-base font-bold text-slate-900 mb-2.5">More Details</h3>
                <ul className="space-y-2">
                    {specificationsList.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-[13px] text-slate-800 leading-snug">
                            <span className="text-slate-400 font-bold select-none text-sm leading-4">•</span>
                            <span className="font-medium text-slate-800">
                                <span className="text-slate-500 font-normal">{item.label}: </span>
                                <span className="text-slate-900 font-semibold">{item.value}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    const renderDescriptionCard = () => {
        if (!cleanDesc) return null;
        return (
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden my-3">
                <button
                    type="button"
                    onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                    className="w-full flex items-center justify-between p-4 bg-white text-left transition-colors hover:bg-slate-50/50"
                >
                    <span className="text-base font-bold text-slate-900">Product Description</span>
                    {isDescriptionOpen ? (
                        <ChevronUp size={20} className="text-slate-600 shrink-0" />
                    ) : (
                        <ChevronDown size={20} className="text-slate-600 shrink-0" />
                    )}
                </button>

                {isDescriptionOpen && (
                    <div className="p-4 pt-1 space-y-3 border-t border-slate-100">
                        <div
                            className="text-[13px] text-slate-600 font-normal leading-relaxed whitespace-pre-line pt-2"
                            dangerouslySetInnerHTML={{ __html: cleanDesc }}
                        />
                    </div>
                )}
            </div>
        );
    };

    const renderReviewsCard = () => {
        const approvedReviews = (reviews || []).filter(r => r.status === 'approved' || r.status === undefined);
        const reviewCount = approvedReviews.length;
        const avgRating = reviewCount > 0 
            ? (approvedReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / reviewCount).toFixed(1)
            : null;

        return (
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden my-3">
                <button
                    type="button"
                    onClick={() => setIsReviewsOpen(!isReviewsOpen)}
                    className="w-full flex items-center justify-between p-4 bg-white text-left transition-colors hover:bg-slate-50/50"
                >
                    <div className="flex-1 pr-3">
                        <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-slate-900">Ratings and reviews</span>
                            {reviewCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700">
                                    <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                                    {avgRating}
                                </span>
                            )}
                        </div>
                        <p className="text-[12px] text-slate-500 font-medium mt-0.5">
                            {reviewCount === 0
                                ? "No reviews yet. Be the first to review!"
                                : `${avgRating} ★ based on ${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}`}
                        </p>
                    </div>

                    {isReviewsOpen ? (
                        <ChevronUp size={20} className="text-slate-600 shrink-0" />
                    ) : (
                        <ChevronDown size={20} className="text-slate-600 shrink-0" />
                    )}
                </button>

                {isReviewsOpen && (
                    <div className="p-4 pt-1 border-t border-slate-100">
                        {reviewLoading ? (
                            <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                Loading reviews...
                            </div>
                        ) : reviewCount === 0 ? (
                            <div className="py-6 text-center">
                                <p className="text-sm font-medium text-slate-400 italic">
                                    No reviews yet. Be the first to review!
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {approvedReviews.map((r, idx) => (
                                    <div key={r._id || idx} className="py-3.5 first:pt-2 last:pb-1 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                                                    {(r.userId?.name || "Customer")[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-900 leading-tight">
                                                        {r.userId?.name || "Verified Customer"}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <div className="flex items-center gap-0.5">
                                                            {[1, 2, 3, 4, 5].map((star) => (
                                                                <Star
                                                                    key={star}
                                                                    className={cn(
                                                                        "w-3 h-3",
                                                                        star <= (Number(r.rating) || 5)
                                                                            ? "fill-emerald-600 text-emerald-600"
                                                                            : "fill-slate-200 text-slate-200"
                                                                    )}
                                                                />
                                                            ))}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full">
                                                            Verified Buyer
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[11px] font-medium text-slate-400 shrink-0">
                                                {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                                            </span>
                                        </div>

                                        <p className="text-[13px] text-slate-700 font-normal leading-relaxed pl-10">
                                            {r.comment}
                                        </p>

                                        {Array.isArray(r.images) && r.images.length > 0 && (
                                            <div className="flex items-center gap-2 pl-10 pt-1 overflow-x-auto no-scrollbar">
                                                {r.images.map((imgUrl, imgIdx) => (
                                                    <img
                                                        key={imgIdx}
                                                        src={applyCloudinaryTransform(imgUrl)}
                                                        alt="Customer review photo"
                                                        onClick={() => setPreviewReviewImage(imgUrl)}
                                                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-90 hover:scale-105 transition-all shadow-2xs"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderSimilarProducts = () => (
        similarProducts && similarProducts.length > 0 && (
            <div className="my-5">
                <div className="flex items-center justify-between mb-3 px-0.5">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">Similar Products</h3>
                    <span className="text-[11px] font-semibold text-slate-400">Swipe right →</span>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-3 pt-1 -mx-2 px-2 snap-x snap-mandatory">
                    {similarProducts.map((p) => (
                        <div key={p._id || p.id} className="w-[150px] sm:w-[170px] shrink-0 snap-start">
                            <ProductCard product={p} />
                        </div>
                    ))}
                </div>
            </div>
        )
    );

    return (
        <AnimatePresence>
            {isOpen && selectedProduct && (
                <>
                    {/* Backdrop - sits above header */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeProduct}
                        className="fixed inset-0 bg-black/60 z-[580]"
                    />

                    {/* ============================================================ */}
                    {/* DESKTOP LAYOUT: Wide 2-column modal (hidden on mobile) */}
                    {/* ============================================================ */}
                    {!isMobileDevice && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 15 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        style={{ willChange: "transform, opacity" }}
                        className="hidden md:flex fixed z-[590] top-[72px] bottom-[16px] left-[3%] right-[3%] lg:left-[6%] lg:right-[6%] xl:left-[12%] xl:right-[12%] bg-white rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.25)] overflow-hidden"
                    >
                        {/* Height-constrained row so the right column can scroll independently */}
                        <div className="flex w-full h-full min-h-0 overflow-hidden">
                            {/* Left: Image Gallery */}
                            <div className="relative w-[42%] lg:w-[44%] flex-shrink-0 flex flex-col h-full" style={{ background: 'linear-gradient(145deg, #f9fafb 0%, #f1f8f2 50%, #fafbfc 100%)' }}>
                                {/* Top bar with back + wishlist */}
                                <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-5 z-20">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={closeProduct}
                                        className="w-10 h-10 bg-white/95 backdrop-blur-md rounded-xl shadow-md shadow-black/5 flex items-center justify-center hover:shadow-lg transition-all border border-gray-100/80"
                                    >
                                        <ArrowLeft size={18} className="text-gray-700" strokeWidth={2.5} />
                                    </motion.button>

                                    {/* Discount Badge (center) */}
                                    {(selectedProduct.originalPrice > selectedProduct.price) && (
                                        <motion.div
                                            initial={{ scale: 0, rotate: -10 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            transition={{ type: 'spring', delay: 0.2 }}
                                            className="bg-gradient-to-r from-primary to-[var(--brand-400)] text-white text-[10px] font-[800] px-3 py-1.5 rounded-xl uppercase tracking-wider shadow-md shadow-brand-200/40"
                                        >
                                            {Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100)}% OFF
                                        </motion.div>
                                    )}

                                    <div className="flex items-center gap-2">
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={handleShareProduct}
                                            className="w-10 h-10 bg-white/95 backdrop-blur-md rounded-xl shadow-md shadow-black/5 flex items-center justify-center hover:shadow-lg transition-all border border-gray-100/80 text-gray-700 cursor-pointer"
                                            title="Share Product"
                                        >
                                            <Share2 size={18} strokeWidth={2.3} />
                                        </motion.button>

                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={toggleWishlist}
                                            className={cn(
                                                "relative w-10 h-10 backdrop-blur-md rounded-xl shadow-md shadow-black/5 flex items-center justify-center hover:shadow-lg transition-all border cursor-pointer",
                                                isWishlisted ? "bg-red-50/95 border-red-100" : "bg-white/95 border-gray-100/80"
                                            )}
                                        >
                                            <ParticleBurst isActive={showHeartPopup} />
                                            <motion.div
                                                animate={isWishlisted ? { scale: [1, 1.3, 1] } : {}}
                                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                                className="relative z-10"
                                            >
                                                <Heart size={18} className={cn(
                                                    "transition-all",
                                                    isWishlisted ? 'text-red-500 fill-red-500' : 'text-gray-400 hover:text-red-400'
                                                )} />
                                            </motion.div>
                                        </motion.button>
                                    </div>

                                    <AnimatePresence>
                                        {showHeartPopup && (
                                            <motion.div
                                                initial={{ scale: 0.5, opacity: 1, y: 0 }}
                                                animate={{ scale: 2.5, opacity: 0, y: -65 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.9, ease: "easeOut" }}
                                                className="absolute top-4 right-4 z-50 pointer-events-none text-red-500"
                                            >
                                                <Heart size={24} fill="currentColor" />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Main content area: vertical thumbnails + main image */}
                                <div className="flex-1 flex mt-[64px] mb-3 overflow-hidden">
                                    {/* Vertical thumbnail strip (left side) */}
                                    {allImages.length > 1 && (
                                        <div className="flex flex-col gap-2 px-3 py-2 overflow-y-auto no-scrollbar">
                                            {allImages.slice(0, 5).map((img, i) => (
                                                <motion.button
                                                    key={i}
                                                    whileHover={{ scale: 1.08 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => setActiveImageIndex(i)}
                                                    className={cn(
                                                        'w-[52px] h-[52px] lg:w-14 lg:h-14 rounded-xl overflow-hidden flex-shrink-0 transition-all duration-300 border-2',
                                                        i === activeImageIndex
                                                            ? 'border-primary shadow-lg shadow-brand-100/60 ring-2 ring-brand-100 bg-white'
                                                            : 'border-gray-200/60 opacity-50 hover:opacity-90 bg-white/60'
                                                    )}
                                                >
                                                    <img src={applyCloudinaryTransform(img, IMAGE_PRESETS.ICON)} alt="" loading="lazy" decoding="async" className="w-full h-full object-contain p-1" />
                                                </motion.button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Main image viewer */}
                                    <div className="flex-1 flex items-center justify-center p-6 lg:p-8 relative min-h-[350px]">
                                        <AnimatePresence mode="wait">
                                            <motion.div
                                                key={activeImageIndex}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="w-full h-full max-h-[440px] flex items-center justify-center"
                                            >
                                                <ProgressiveProductImage
                                                    thumbSrc={applyCloudinaryTransform(allImages[activeImageIndex], IMAGE_PRESETS.PRODUCT_THUMB)}
                                                    highResSrc={applyCloudinaryTransform(allImages[activeImageIndex], IMAGE_PRESETS.PRODUCT_FULL)}
                                                    alt={`${selectedProduct.name} ${activeImageIndex + 1}`}
                                                    loading="eager"
                                                    fetchPriority="high"
                                                    onClick={() => setIsLightboxOpen(true)}
                                                    imgClassName="w-full h-full max-h-[440px] object-contain transition-transform duration-300 hover:scale-[1.03] cursor-pointer"
                                                />
                                            </motion.div>
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Carousel dot indicators */}
                                {allImages.length > 1 && (
                                    <div className="flex justify-center gap-2 pb-5">
                                        {allImages.map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setActiveImageIndex(i)}
                                                className={cn(
                                                    'rounded-full transition-all duration-400',
                                                    i === activeImageIndex ? 'w-8 h-2 bg-primary' : 'w-2 h-2 bg-gray-300/60 hover:bg-gray-400'
                                                )}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Desktop Action Buttons: Add to Cart & Buy Now (Flipkart signature style) */}
                                <div className="p-4 bg-white/95 backdrop-blur-sm border-t border-slate-100 flex items-center gap-3 z-20 mt-auto">
                                    {!canAddToCart ? (
                                        <button
                                            type="button"
                                            disabled
                                            className="w-full bg-slate-100 text-slate-400 font-bold text-xs lg:text-sm py-3.5 px-3 rounded-xl border border-slate-200 flex items-center justify-center gap-2 cursor-not-allowed uppercase tracking-wider"
                                        >
                                            <Ban size={16} className="text-red-400" strokeWidth={2.5} />
                                            <span>Quick Delivery Not Available</span>
                                        </button>
                                    ) : isSoldOut ? (
                                        <button
                                            type="button"
                                            disabled
                                            className="w-full bg-slate-200 text-slate-500 font-bold text-xs lg:text-sm py-3.5 px-3 rounded-xl border border-slate-300 flex items-center justify-center gap-2 cursor-not-allowed uppercase tracking-wider select-none opacity-80"
                                        >
                                            <Ban size={16} className="text-slate-500" strokeWidth={2.5} />
                                            <span>Sold Out</span>
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleAddToCart}
                                                className="flex-1 bg-[#ff9f00] hover:bg-[#f39700] active:scale-95 text-white font-bold text-xs lg:text-sm py-3.5 px-3 rounded-xl shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider"
                                            >
                                                <ShoppingCart size={16} strokeWidth={2.5} />
                                                <span>Add to Cart</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleBuyNow}
                                                className="flex-1 bg-[#fb641b] hover:bg-[#f45305] active:scale-95 text-white font-bold text-xs lg:text-sm py-3.5 px-3 rounded-xl shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider"
                                            >
                                                <Zap size={16} strokeWidth={2.5} />
                                                <span>Buy Now</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Right: Product Info (scrollable for tall basket content) */}
                            <div ref={desktopContentRef} className="flex-1 flex flex-col bg-white min-h-0 overflow-y-auto overscroll-contain">
                                <div className="flex-1 px-7 py-6 lg:px-8 lg:py-7 space-y-3">

                                    {/* Top badges row */}
                                    {selectedProduct.originalPrice > selectedProduct.price && (
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.15 }}
                                                className="text-[10px] font-[700] text-primary bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-200/50 uppercase tracking-wider"
                                            >
                                                💰 Save ₹{selectedProduct.originalPrice - selectedProduct.price}
                                            </motion.div>
                                        </div>
                                    )}
                                    {/* Product Name */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.15 }}
                                    >
                                        <h1 className="text-[19px] lg:text-[22px] font-black text-[#111827] leading-[1.2] tracking-tight">
                                            {selectedProduct.name}
                                        </h1>
                                        {/* Rating Badge (Flipkart style 4.2 ★ green badge) */}
                                        <div className="flex items-center gap-2 mt-2">
                                            <div className="inline-flex items-center gap-1 bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-md shadow-2xs">
                                                <span>{Number(selectedProduct.averageRating || selectedProduct.rating || 4.2).toFixed(1)}</span>
                                                <Star size={11} fill="currentColor" strokeWidth={0} />
                                            </div>
                                            <span className="text-xs text-slate-500 font-medium">
                                                ({selectedProduct.numReviews || selectedProduct.reviewsCount || 128} Ratings & Reviews)
                                            </span>
                                        </div>
                                    </motion.div>

                                    {/* Seller / Warehouse Name */}
                                    {(selectedProduct.sellerId?.shopName || selectedProduct.warehouseId?.name) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.17 }}
                                            className="flex items-center gap-1.5 mt-2 mb-3 text-[13px] font-semibold text-slate-500"
                                        >
                                            {selectedProduct.sellerId?.shopName ? (
                                                <><Store size={15} className="text-slate-400" /> <span>{selectedProduct.sellerId.shopName}</span></>
                                            ) : (
                                                <><Building2 size={15} className="text-slate-400" /> <span>{selectedProduct.warehouseId?.name}</span></>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* Price + Add-to-Cart Card */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="relative overflow-hidden rounded-[20px] border border-brand-200/60 shadow-sm"
                                        style={{ background: 'linear-gradient(135deg, #f4fcfe 0%, #eefbfb 100%)' }}
                                    >
                                        {/* Decorative subtle patterns */}
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-3xl" />
                                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl" />

                                        <div className="relative flex items-center justify-between py-4 px-5">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-[28px] lg:text-[32px] font-[800] text-primary tracking-tight leading-none">
                                                        ₹{displayPrice}
                                                    </span>
                                                    {selectedProduct.originalPrice > selectedProduct.price && (
                                                        <span className="text-[14px] text-gray-400 line-through font-[600]">₹{selectedProduct.originalPrice}</span>
                                                    )}
                                                </div>
                                                {selectedProduct.originalPrice > selectedProduct.price && (
                                                    <span className="inline-flex w-fit items-center text-[10px] font-[800] text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md uppercase tracking-wide">
                                                        {Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100)}% off
                                                    </span>
                                                )}
                                                {isLowStock && (
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md mt-1 w-fit animate-pulse">
                                                        <Zap size={13} className="text-amber-600 fill-amber-500" />
                                                        <span>Hurry, only {currentStock} left in stock!</span>
                                                    </div>
                                                )}
                                                {isSoldOut && (
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-md mt-1 w-fit">
                                                        <AlertTriangle size={13} className="text-rose-600" />
                                                        <span>Sold Out</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                {quantity > 0 ? (
                                                    <div className="flex items-center gap-1 bg-[#FFC200] border border-[#E6AC00] rounded-xl p-1 shadow-sm">
                                                        <motion.button whileTap={{ scale: 0.85 }} onClick={handleDecrement} className="w-9 h-9 bg-white/70 rounded-lg flex items-center justify-center text-slate-900 hover:bg-white transition-colors cursor-pointer">
                                                            <Minus size={16} strokeWidth={2.5} />
                                                        </motion.button>
                                                        <div className="w-8 flex justify-center items-center relative overflow-hidden h-6">
                                                            <AnimatePresence mode="popLayout">
                                                                <motion.span
                                                                    key={quantity}
                                                                    initial={{ y: 15, opacity: 0 }}
                                                                    animate={{ y: 0, opacity: 1 }}
                                                                    exit={{ y: -15, opacity: 0 }}
                                                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                                                    className="font-black text-base text-slate-900 text-center absolute"
                                                                >
                                                                    {quantity}
                                                                </motion.span>
                                                            </AnimatePresence>
                                                        </div>
                                                        <motion.button 
                                                            whileTap={{ scale: quantity >= (currentStock > 0 ? Math.min(currentStock, 10) : 0) ? 1 : 0.85 }} 
                                                            onClick={handleIncrement} 
                                                            disabled={quantity >= (currentStock > 0 ? Math.min(currentStock, 10) : 0)}
                                                            className={cn(
                                                                "w-9 h-9 rounded-lg flex items-center justify-center text-slate-900 transition-colors",
                                                                quantity >= (currentStock > 0 ? Math.min(currentStock, 10) : 0) ? "opacity-35 cursor-not-allowed bg-slate-200" : "bg-white/70 hover:bg-white cursor-pointer"
                                                            )}
                                                        >
                                                            <Plus size={16} strokeWidth={2.5} />
                                                        </motion.button>
                                                    </div>
                                                ) : !canAddToCart ? (
                                                    <button
                                                        disabled
                                                        className="bg-slate-100 text-slate-400 h-12 px-6 rounded-xl font-bold text-xs flex items-center gap-2 border border-slate-200 cursor-not-allowed uppercase tracking-wider"
                                                    >
                                                        <Ban size={15} className="text-red-400" />
                                                        <span>Unavailable</span>
                                                    </button>
                                                ) : isSoldOut ? (
                                                    <button
                                                        disabled
                                                        className="bg-slate-200 text-slate-500 h-12 px-6 rounded-xl font-bold text-xs flex items-center gap-2 border border-slate-300 cursor-not-allowed uppercase tracking-wider select-none opacity-80"
                                                    >
                                                        <Ban size={15} className="text-slate-500" />
                                                        <span>Sold Out</span>
                                                    </button>
                                                ) : (
                                                    <motion.button
                                                        whileHover={{ scale: 1.02, y: -2 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={handleAddToCart}
                                                        className="bg-[#FFC200] hover:bg-[#F5B800] text-slate-900 h-12 px-8 rounded-xl font-bold text-[14px] flex items-center gap-2 shadow-md shadow-amber-200/50 hover:shadow-amber-300/60 transition-all uppercase tracking-wider border border-[#E6AC00] cursor-pointer"
                                                    >
                                                        <ShoppingCart size={17} strokeWidth={2.5} />
                                                        Add to Cart
                                                    </motion.button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* View Cart */}
                                    {(isRefurbishedProduct ? refurbishedCartCount : groceryCartCount) > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="flex justify-center -mt-1"
                                        >
                                            <Link
                                                to="/cart"
                                                onClick={closeProduct}
                                                className={cn(
                                                    "w-[80%] text-white h-[40px] rounded-xl flex items-center justify-between px-4 shadow-md transition-all active:scale-[0.98]",
                                                    isRefurbishedProduct
                                                        ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25"
                                                        : "bg-gradient-to-r from-primary to-[var(--brand-500)] shadow-brand-200/40 hover:shadow-lg hover:-translate-y-0.5"
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <ShoppingBag size={14} strokeWidth={2.0} />
                                                    <span className="text-[12px] font-[700] uppercase tracking-wider">View Cart</span>
                                                </div>
                                                <div className="flex items-center justify-center gap-1.5 bg-white/10 px-2 py-1 rounded-lg">
                                                    <span className="text-[13px] font-[800] tracking-tight">
                                                        ₹{isRefurbishedProduct ? refurbishedCartTotal : groceryCartTotal}
                                                    </span>
                                                    <ChevronRight size={14} strokeWidth={2.5} />
                                                </div>
                                            </Link>
                                        </motion.div>
                                    )}

                                    {/* Variants */}
                                    {activeVariants && activeVariants.filter(v => v.name).length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.25 }}
                                            className="bg-gray-50/60 rounded-xl p-3 border border-gray-100/70"
                                        >
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2.5">Select Variant</h4>
                                            <div className="flex gap-3 flex-wrap">
                                                {activeVariants.filter(v => v.name).map((v, idx) => (
                                                    <motion.button
                                                        key={idx}
                                                        whileHover={{ scale: 1.03 }}
                                                        whileTap={{ scale: 0.97 }}
                                                        onClick={() => handleVariantSelect(v)}
                                                        className={cn(
                                                            'px-4 py-2 font-[600] rounded-lg text-[13px] transition-all border-2',
                                                            selectedVariant?.sku === v.sku
                                                                ? 'bg-brand-50 border-primary text-primary shadow-md shadow-brand-100/50'
                                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:shadow-sm'
                                                        )}
                                                    >
                                                        {v.name}
                                                        {typeof v.stock === 'number' && v.stock <= 0 && (
                                                            <span className="ml-1 text-[11px] text-red-500 font-bold">(Sold Out)</span>
                                                        )}
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Delivery Fulfillment Notice Card (Below Select Variant) */}
                                    {renderDeliveryFulfillmentCard()}



                                    {/* Thin Divider between Select Variant and Trust Badges */}
                                    <div className="border-t border-slate-100 my-4" />

                                    {/* 1. 7-Day Return, Cash on Delivery, 1 Year Warranty */}
                                    {renderTrustBadges()}

                                    {/* 2. More Details Card */}
                                    {renderMoreDetailsCard()}

                                    {/* 3. Product Description / Details Card (Default Open) */}
                                    {renderDescriptionCard()}

                                    {/* Ratings and Reviews Card */}
                                    {renderReviewsCard()}

                                    {/* 4. Similar Products Section (Right Swipe) */}
                                    {renderSimilarProducts()}

                                    {/* Bottom spacer */}
                                    <div className="h-6" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                    )}

                    {/* ============================================================ */}
                    {/* MOBILE LAYOUT: Full Screen Sheet (hidden on desktop md+) */}
                    {/* ============================================================ */}
                    {isMobileDevice && (
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%", transition: { duration: 0.2, ease: "easeIn" } }}
                        transition={{
                            duration: 0.24,
                            ease: [0.16, 1, 0.3, 1]
                        }}
                        className={cn(
                            "md:hidden fixed z-[590] shadow-2xl overflow-hidden flex flex-col inset-0 h-[100dvh] max-h-[100dvh] w-full",
                        )}
                        style={{
                            backgroundColor: activeHeaderColor,
                            willChange: "transform",
                            touchAction: "auto",
                            height: "100dvh",
                            maxHeight: "100dvh"
                        }}
                    >
                        {/* Top Blue Header Bar (Bottle reference: Back Arrow + White Search field + Cart icon with badge) */}
                        <div 
                            className="px-3.5 pt-1.5 pb-2 flex items-center gap-2.5 shrink-0 z-40 text-white border-none shadow-none"
                            style={{
                                backgroundColor: activeHeaderColor,
                                paddingTop: 'env(safe-area-inset-top, 6px)'
                            }}
                        >
                            {/* 1. Back Arrow Button */}
                            <motion.button
                                onClick={closeProduct}
                                whileTap={{ scale: 0.9 }}
                                className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all shrink-0 cursor-pointer"
                                aria-label="Back"
                            >
                                <ArrowLeft size={22} strokeWidth={2.5} />
                            </motion.button>

                            {/* 2. White Search Input Field */}
                            <div 
                                onClick={() => {
                                    closeProduct();
                                    navigate('/search');
                                }}
                                className="flex-1 bg-white h-10 rounded-full px-3.5 flex items-center gap-2 cursor-pointer shadow-xs border-0 select-none active:scale-[0.99] transition-transform"
                            >
                                <Search size={17} className="text-slate-400 shrink-0" />
                                <span className="text-xs sm:text-sm text-slate-400 font-normal truncate">
                                    Search for products
                                </span>
                            </div>

                            {/* 3. Cart Icon with Badge */}
                            <Link
                                to="/cart"
                                onClick={closeProduct}
                                className="relative w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all shrink-0 cursor-pointer"
                                aria-label="Cart"
                            >
                                <ShoppingCart size={22} strokeWidth={2.2} />
                                {((isRefurbishedProduct ? refurbishedCartCount : groceryCartCount) || cartCount || 0) > 0 && (
                                    <span 
                                        className="absolute -top-1 -right-1 bg-[#ff5200] text-white border-2 text-[10px] font-black min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center shadow-xs"
                                        style={{ borderColor: activeHeaderColor }}
                                    >
                                        {((isRefurbishedProduct ? refurbishedCartCount : groceryCartCount) || cartCount) > 99
                                            ? '99+'
                                            : ((isRefurbishedProduct ? refurbishedCartCount : groceryCartCount) || cartCount)}
                                    </span>
                                )}
                            </Link>
                        </div>

                        {/* Scrollable Content */}
                        <div
                            ref={mobileContentRef}
                            className="flex-1 overflow-x-hidden overflow-y-auto no-scrollbar bg-white overscroll-contain"
                            style={{ 
                                paddingBottom: 'calc(6.5rem + env(safe-area-inset-bottom, 20px))',
                                overscrollBehaviorY: 'contain',
                                WebkitOverflowScrolling: 'touch',
                            }}
                            onScroll={handleScroll}
                            onWheel={handleWheel}
                        >
                            {/* Product Image Carousel */}
                            <div className={cn(
                                "relative w-full pt-3 pb-6 h-[360px] sm:h-[440px] border-b",
                                isRefurbishedProduct
                                    ? "bg-gradient-to-b from-blue-50/90 via-sky-50/50 to-white border-blue-100/80"
                                    : "bg-gradient-to-b from-[#FFF2E8] via-[#FFF7F2] to-white border-orange-100/60"
                            )}>
                                <div
                                    ref={scrollRef}
                                    className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar h-full w-full"
                                    onScroll={(e) => {
                                        const width = e.currentTarget.clientWidth;
                                        if (!width) return;
                                        const index = Math.round(e.currentTarget.scrollLeft / width);
                                        if (index !== activeImageIndexRef.current) {
                                            activeImageIndexRef.current = index;
                                            setActiveImageIndex(index);
                                        }
                                    }}
                                >
                                    {allImages.map((img, i) => (
                                        <div key={i} onClick={() => setIsLightboxOpen(true)} className="flex-shrink-0 w-full h-full snap-center flex items-center justify-center px-0 cursor-pointer">
                                            <ProgressiveProductImage
                                                thumbSrc={applyCloudinaryTransform(img, IMAGE_PRESETS.PRODUCT_THUMB)}
                                                highResSrc={applyCloudinaryTransform(img, IMAGE_PRESETS.PRODUCT_DETAIL)}
                                                alt={`${selectedProduct?.name || 'Product'} ${i + 1}`}
                                                loading={i === 0 ? "eager" : "lazy"}
                                                fetchPriority={i === 0 ? "high" : "auto"}
                                                imgClassName="w-full h-full object-contain mix-blend-multiply drop-shadow-xl scale-110"
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Carousel Dots */}
                                {allImages.length > 1 && (
                                    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
                                        {allImages.map((_, i) => (
                                            <div
                                                key={i}
                                                className={cn(
                                                    "h-1.5 rounded-full transition-all duration-300",
                                                    i === activeImageIndex
                                                        ? (isRefurbishedProduct ? "w-6 bg-blue-600" : "w-6 bg-[#2875E8]")
                                                        : (isRefurbishedProduct ? "w-1.5 bg-blue-200" : "w-1.5 bg-orange-200")
                                                )}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Top-Right Floating Wishlist & Share Buttons (Flipkart Style Stack) */}
                                <div className="absolute top-3 right-3 z-30 flex flex-col gap-2.5 pointer-events-auto">
                                    {/* Wishlist Button */}
                                    <motion.button
                                        type="button"
                                        whileTap={{ scale: 0.88 }}
                                        onClick={(e) => {
                                            e?.stopPropagation?.();
                                            toggleWishlist(e);
                                        }}
                                        className={cn(
                                            "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border shadow-xs backdrop-blur-md transition-all cursor-pointer",
                                            isWishlisted
                                                ? "bg-rose-50/95 border-rose-200 text-rose-500 shadow-rose-100/50"
                                                : "bg-white/95 border-slate-200/90 text-slate-700 hover:bg-white"
                                        )}
                                        title={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                                        aria-label="Wishlist"
                                    >
                                        <ParticleBurst isActive={showHeartPopup} />
                                        <Heart
                                            size={18}
                                            className={cn("transition-colors", isWishlisted ? "fill-rose-500 text-rose-500" : "text-slate-700")}
                                            strokeWidth={2.2}
                                        />
                                    </motion.button>

                                    {/* Share Button */}
                                    <motion.button
                                        type="button"
                                        whileTap={{ scale: 0.88 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleShareProduct();
                                        }}
                                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 border border-slate-200/90 shadow-xs backdrop-blur-md flex items-center justify-center text-slate-700 hover:bg-white active:scale-90 transition-all cursor-pointer"
                                        title="Share Product"
                                        aria-label="Share"
                                    >
                                        <Share2 size={17} strokeWidth={2.2} className="text-slate-700" />
                                    </motion.button>
                                </div>
                            </div>

                            {/* Thumbnail Row (Mobile) */}
                            {allImages.length > 1 && (
                                <div className="px-5 pt-4 pb-1">
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{allImages.length} Product Images</h4>
                                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                                        {allImages.map((img, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    setActiveImageIndex(i);
                                                    if (scrollRef.current) {
                                                        const width = scrollRef.current.offsetWidth;
                                                        scrollRef.current.scrollTo({ left: width * i, behavior: 'smooth' });
                                                    }
                                                }}
                                                className={cn(
                                                    "w-[65px] h-[65px] flex-shrink-0 rounded-2xl overflow-hidden transition-all duration-300 border-2",
                                                    i === activeImageIndex
                                                        ? (isRefurbishedProduct
                                                            ? "border-blue-600 shadow-md shadow-blue-100 ring-2 ring-blue-100 bg-white scale-95"
                                                            : "border-[#2875E8] shadow-md shadow-orange-100 ring-2 ring-orange-100 bg-white scale-95")
                                                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                                                )}
                                            >
                                                <img src={applyCloudinaryTransform(img, IMAGE_PRESETS.ICON)} alt="" loading="lazy" decoding="async" className="w-full h-full object-contain p-1.5 mix-blend-multiply" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Product Info Container */}
                            <div className="px-5 pt-3 pb-3 space-y-3">
                                {/* Title & Weight */}
                                <div>
                                    <h2 className="text-xl font-extrabold text-[#0F172A] leading-snug tracking-tight">
                                        {selectedProduct.name}
                                    </h2>
                                </div>

                                {/* Price Row */}
                                <div className="flex items-baseline gap-2.5 pt-0.5">
                                    <span className="text-2xl font-black text-[#0F172A] tracking-tight">
                                        ₹{selectedVariant?.salePrice || selectedVariant?.price || selectedProduct.price}
                                    </span>
                                    {((selectedVariant?.salePrice && selectedVariant.salePrice < selectedVariant.price) ||
                                        (!selectedVariant && selectedProduct.originalPrice > selectedProduct.price)) && (
                                            <>
                                                <span className="text-sm font-bold text-slate-400 line-through">
                                                    ₹{selectedVariant?.price || selectedProduct.originalPrice}
                                                </span>
                                                <span className={cn(
                                                    "text-xs font-black px-2 py-0.5 rounded-lg uppercase tracking-wide border",
                                                    isRefurbishedProduct
                                                        ? "bg-blue-50 text-blue-600 border-blue-200"
                                                        : "bg-[#EFF6FF] text-[#2875E8] border-orange-200/80"
                                                )}>
                                                    {selectedVariant
                                                        ? Math.round(((selectedVariant.price - selectedVariant.salePrice) / selectedVariant.price) * 100)
                                                        : Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100)}% OFF
                                                </span>
                                            </>
                                        )}
                                </div>
                                {isLowStock && (
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-md w-fit animate-pulse">
                                        <Zap size={13} className="text-amber-600 fill-amber-500" />
                                        <span>Hurry, only {currentStock} left in stock!</span>
                                    </div>
                                )}
                                {isSoldOut && (
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-md w-fit">
                                        <AlertTriangle size={13} className="text-rose-600" />
                                        <span>Sold Out</span>
                                    </div>
                                )}

                                {/* Variants Selection (Mobile) */}
                                {activeVariants && activeVariants.filter(v => v.name).length > 0 && (
                                    <div className="pt-1 mb-1">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Select Variant</h4>
                                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                            {activeVariants.filter(v => v.name).map((v, idx) => (
                                                <motion.button
                                                    key={idx}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleVariantSelect(v)}
                                                    className={cn(
                                                        "flex-shrink-0 px-4 py-2 font-bold rounded-xl text-xs transition-all relative border-2",
                                                        selectedVariant?.sku === v.sku
                                                            ? (isRefurbishedProduct
                                                                ? "bg-blue-50 border-blue-600 text-blue-700 shadow-sm shadow-blue-100"
                                                                : "bg-[#ecfeff] border-primary text-primary shadow-sm shadow-brand-100")
                                                            : "bg-slate-50 border-slate-100 text-slate-500"
                                                    )}
                                                >
                                                    {v.name}
                                                    {typeof v.stock === 'number' && v.stock <= 0 && (
                                                        <span className="ml-1 text-[10px] text-red-500 font-bold">(Sold Out)</span>
                                                    )}
                                                    {selectedVariant?.sku === v.sku && (
                                                        <div className={cn(
                                                            "absolute top-0 right-0 w-2.5 h-2.5 rounded-bl-lg",
                                                            isRefurbishedProduct ? "bg-blue-600" : "bg-primary"
                                                        )} />
                                                    )}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Delivery Fulfillment Notice Card (Mobile - Below Select Variant) */}
                                {renderDeliveryFulfillmentCard()}



                                {/* Thin Divider between Select Variant and Trust Badges */}
                                <div className="border-t border-slate-100 my-3" />

                                {/* 1. 7-Day Return, Cash on Delivery, 1 Year Warranty */}
                                {renderTrustBadges()}

                                {/* 2. More Details Card */}
                                {renderMoreDetailsCard()}

                                {/* 3. Product Description / Details Card (Default Open) */}
                                {renderDescriptionCard()}

                                {/* Ratings and Reviews Card */}
                                {renderReviewsCard()}

                                {/* 4. Similar Products Section (Right Swipe) */}
                                {renderSimilarProducts()}
                            </div>
                        </div>

                        {/* Sticky Bottom Action Bar */}
                        <div 
                            className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 p-3 sm:p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-50 shrink-0"
                            style={{ paddingBottom: 'max(1.25rem, calc(0.75rem + env(safe-area-inset-bottom, 16px)))' }}
                        >
                            <div className="flex items-center gap-3 max-w-md mx-auto">
                                {!canAddToCart ? (
                                    <div className="flex-1 bg-slate-100 border border-slate-200 text-slate-400 h-12 rounded-2xl flex items-center justify-center gap-2 px-3">
                                        <Ban size={16} className="text-red-400 shrink-0" strokeWidth={2.5} />
                                        <span className="font-bold text-xs uppercase tracking-wider text-slate-500 truncate">
                                            Quick Delivery Not Available
                                        </span>
                                    </div>
                                ) : isSoldOut ? (
                                    <div className="flex-1 bg-slate-200 border border-slate-300 text-slate-600 h-12 rounded-2xl flex items-center justify-center gap-2 px-3 opacity-90 select-none">
                                        <Ban size={16} className="text-slate-600 shrink-0" strokeWidth={2.5} />
                                        <span className="font-bold text-xs uppercase tracking-wider text-slate-600 truncate">
                                            Sold Out
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        {/* Left Button: Add to cart (or Quantity Pill if in cart) */}
                                        {quantity > 0 ? (
                                            <div className="flex-1 bg-white border-2 border-[#FFC200] text-slate-900 h-12 rounded-2xl flex items-center justify-between px-2.5 shadow-xs">
                                                <motion.button
                                                    type="button"
                                                    whileTap={{ scale: 0.8 }}
                                                    onClick={handleDecrement}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                                                >
                                                    <Minus size={16} strokeWidth={2.5} />
                                                </motion.button>
                                                <span className="font-black text-xs text-slate-900">
                                                    {quantity} in cart
                                                </span>
                                                <motion.button
                                                    type="button"
                                                    whileTap={{ scale: quantity >= (currentStock > 0 ? Math.min(currentStock, 10) : 0) ? 1 : 0.8 }}
                                                    onClick={handleIncrement}
                                                    disabled={quantity >= (currentStock > 0 ? Math.min(currentStock, 10) : 0)}
                                                    className={cn(
                                                        "w-8 h-8 rounded-lg flex items-center justify-center text-slate-900 transition-colors",
                                                        quantity >= (currentStock > 0 ? Math.min(currentStock, 10) : 0) ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-100 cursor-pointer"
                                                    )}
                                                >
                                                    <Plus size={16} strokeWidth={2.5} />
                                                </motion.button>
                                            </div>
                                        ) : (
                                            <motion.button
                                                type="button"
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.96 }}
                                                onClick={handleAddToCart}
                                                className="flex-1 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 h-12 rounded-2xl font-bold text-sm flex items-center justify-center border border-slate-300 shadow-xs transition-all cursor-pointer"
                                            >
                                                Add to cart
                                            </motion.button>
                                        )}

                                        {/* Right Button: Buy now at ₹... */}
                                        <motion.button
                                            type="button"
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.96 }}
                                            onClick={handleBuyNow}
                                            className="flex-1 bg-[#FFC200] hover:bg-[#F5B800] active:scale-[0.98] text-slate-900 h-12 rounded-2xl flex flex-col items-center justify-center shadow-md shadow-amber-200/50 border border-[#E6AC00] transition-all cursor-pointer"
                                        >
                                            <span className="font-extrabold text-[13px] leading-tight text-slate-900">Buy now</span>
                                            {effectivePrice > 0 && (
                                                <span className="font-bold text-[11px] leading-tight text-slate-800">
                                                    at ₹{Number(effectivePrice).toLocaleString('en-IN')}
                                                </span>
                                            )}
                                        </motion.button>
                                    </>
                                )}
                            </div>
                        </div>

                    </motion.div>
                    )}

                    {/* Lightbox */}
                    <AnimatePresence>
                        {isLightboxOpen && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center backdrop-blur-xl"
                                onClick={() => setIsLightboxOpen(false)}
                            >
                                <button
                                    onClick={() => setIsLightboxOpen(false)}
                                    className="absolute top-6 right-6 z-[1010] w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
                                >
                                    <X size={24} />
                                </button>

                                {allImages.length > 1 && (
                                    <>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
                                            }}
                                            className="absolute left-4 z-[1010] w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
                                        >
                                            <ChevronLeft size={28} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
                                            }}
                                            className="absolute right-4 z-[1010] w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
                                        >
                                            <ChevronRight size={28} />
                                        </button>
                                    </>
                                )}

                                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                                    <TransformWrapper
                                        initialScale={1}
                                        minScale={1}
                                        maxScale={4}
                                        centerOnInit
                                        wheel={{ step: 0.1 }}
                                        doubleClick={{ disabled: false }}
                                        pinch={{ step: 5 }}
                                    >
                                        <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                                            <motion.img
                                                key={activeImageIndex}
                                                initial={{ scale: 0.9, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0.9, opacity: 0 }}
                                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                                src={applyCloudinaryTransform(allImages[activeImageIndex], IMAGE_PRESETS.PRODUCT_FULL)}
                                                alt={selectedProduct.name}
                                                className="max-w-full max-h-[85vh] object-contain drop-shadow-2xl cursor-zoom-in"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </TransformComponent>
                                    </TransformWrapper>
                                </div>

                                {allImages.length > 1 && (
                                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 pointer-events-none">
                                        {allImages.map((_, i) => (
                                            <div
                                                key={i}
                                                className={cn(
                                                    "h-2 rounded-full transition-all duration-300",
                                                    i === activeImageIndex ? "w-8 bg-white" : "w-2 bg-white/30"
                                                )}
                                            />
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Review Photo Preview Modal */}
                    {previewReviewImage && (
                        <div
                            className="fixed inset-0 z-[750] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
                            onClick={() => setPreviewReviewImage(null)}
                        >
                            <div className="relative max-w-lg max-h-[85vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl animate-in zoom-in-95 duration-200">
                                <button
                                    onClick={() => setPreviewReviewImage(null)}
                                    className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition z-10"
                                >
                                    <X size={18} />
                                </button>
                                <img
                                    src={previewReviewImage}
                                    alt="Enlarged review photo"
                                    className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
                                />
                            </div>
                        </div>
                    )}
                </>
            )}
        </AnimatePresence>
    );
};

export default ProductDetailSheet;


