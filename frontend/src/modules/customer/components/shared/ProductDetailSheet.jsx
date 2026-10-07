import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation, useDragControls } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { X, ChevronDown, ChevronUp, FileText, Share2, Heart, Search, Clock, Minus, Plus, ShoppingBag, ShoppingCart, Star, MessageSquare, ArrowLeft, ChevronRight, ChevronLeft, Store, Building2, Package, RotateCcw, Banknote, ShieldCheck, Zap } from 'lucide-react';
import { useProductDetail } from '../../context/ProductDetailContext';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '@core/context/AuthContext';
import { useToast } from '@shared/components/ui/Toast';
import { useSettings } from '@core/context/SettingsContext';
import { useLocation as useAppLocation } from '../../context/LocationContext';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { customerApi } from '../../services/customerApi';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import ParticleBurst from './ParticleBurst';
import ProductCard from './ProductCard';


const HIGHLIGHT_ICON_MAP = {
    // Grocery & Food
    leaf: { emoji: "🌿", bg: "bg-[#EFF6FF] border-[#FFD0B5] text-[#D9480F]" },
    avocado: { emoji: "🥑", bg: "bg-[#EEF2FF] border-[#C7D2FE] text-[#1E3A8A]" },
    zap: { emoji: "⚡", bg: "bg-[#FFF4EC] border-[#FFE4D6] text-[#E65100]" },
    sprout: { emoji: "🌱", bg: "bg-[#E0F2FE] border-[#BAE6FD] text-[#0369A1]" },
    wheat: { emoji: "🌾", bg: "bg-[#EFF6FF] border-[#FFD0B5] text-[#D9480F]" },
    sugarfree: { emoji: "🍬", bg: "bg-[#F3E8FF] border-[#E9D5FF] text-[#6B21A8]" },
    sun: { emoji: "☀️", bg: "bg-[#FFF4EC] border-[#FFE4D6] text-[#E65100]" },
    smile: { emoji: "🚫", bg: "bg-[#E0F2FE] border-[#BAE6FD] text-[#0369A1]" },
    apple: { emoji: "🍎", bg: "bg-[#FFE4E6] border-[#FECDD3] text-[#E11D48]" },
    milk: { emoji: "🥛", bg: "bg-[#F0F9FF] border-[#BAE6FD] text-[#0284C7]" },

    // Beauty & Personal Care
    sparkles: { emoji: "✨", bg: "bg-[#FDF2F8] border-[#FBCFE8] text-[#DB2777]" },
    droplet: { emoji: "💧", bg: "bg-[#E0F2FE] border-[#BAE6FD] text-[#0284C7]" },
    flower: { emoji: "🌸", bg: "bg-[#FCE7F3] border-[#FBCFE8] text-[#BE185D]" },
    lotion: { emoji: "🧴", bg: "bg-[#FFF1F2] border-[#FECDD3] text-[#E11D48]" },
    mirror: { emoji: "🪞", bg: "bg-[#FAF5FF] border-[#E9D5FF] text-[#7E22CE]" },
    leaf2: { emoji: "🍃", bg: "bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]" },

    // Electronics & Tech
    battery: { emoji: "🔋", bg: "bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]" },
    wireless: { emoji: "📶", bg: "bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]" },
    cpu: { emoji: "💻", bg: "bg-[#F3E8FF] border-[#E9D5FF] text-[#7E22CE]" },
    plug: { emoji: "🔌", bg: "bg-[#FEF3C7] border-[#FDE68A] text-[#D97706]" },
    snowflake: { emoji: "❄️", bg: "bg-[#E0F2FE] border-[#BAE6FD] text-[#0284C7]" },
    volume: { emoji: "🔊", bg: "bg-[#EEF2FF] border-[#C7D2FE] text-[#4338CA]" },

    // Fashion & Apparel
    cotton: { emoji: "🧵", bg: "bg-[#F5F5F4] border-[#E7E5E4] text-[#44403C]" },
    shirt: { emoji: "👕", bg: "bg-[#EFF6FF] border-[#BFDBFE] text-[#2563EB]" },
    scissors: { emoji: "✂️", bg: "bg-[#FAF5FF] border-[#E9D5FF] text-[#6B21A8]" },
    wash: { emoji: "🧼", bg: "bg-[#E0F2FE] border-[#BAE6FD] text-[#0369A1]" },

    // Sports & Fitness
    fitness: { emoji: "🏋️", bg: "bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]" },
    fire: { emoji: "🔥", bg: "bg-[#FFF7ED] border-[#FFEDD5] text-[#EA580C]" },
    trophy: { emoji: "🏆", bg: "bg-[#FEF3C7] border-[#FDE68A] text-[#B45309]" },
    water: { emoji: "💧", bg: "bg-[#E0F2FE] border-[#BAE6FD] text-[#0284C7]" },

    // Trust, Service & Kits
    shield: { emoji: "🛡️", bg: "bg-[#EEF2FF] border-[#C7D2FE] text-[#1E3A8A]" },
    heart: { emoji: "❤️", bg: "bg-[#EFF6FF] border-[#FFD0B5] text-[#D9480F]" },
    star: { emoji: "⭐", bg: "bg-[#FEF3C7] border-[#FDE68A] text-[#B45309]" },
    truck: { emoji: "🚚", bg: "bg-[#EEF2FF] border-[#C7D2FE] text-[#1E3A8A]" },
    repeat: { emoji: "🔄", bg: "bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]" },
    gift: { emoji: "🎁", bg: "bg-[#FDF2F8] border-[#FBCFE8] text-[#BE185D]" },
    badge: { emoji: "🏅", bg: "bg-[#FEF3C7] border-[#FDE68A] text-[#B45309]" },
    box: { emoji: "📦", bg: "bg-[#FFF7ED] border-[#FFEDD5] text-[#C2410C]" },
    family: { emoji: "👨‍👩‍👧‍👦", bg: "bg-[#FAF5FF] border-[#E9D5FF] text-[#7E22CE]" },
    value: { emoji: "💰", bg: "bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]" },
};

const ProductDetailSheet = () => {
    const { selectedProduct, isOpen, closeProduct } = useProductDetail();
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

    // Controls for sheet animation
    const controls = useAnimation();
    const [isExpanded, setIsExpanded] = useState(true);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

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
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
    const [localHasReviewed, setLocalHasReviewed] = useState(false);
    const [extendedProduct, setExtendedProduct] = useState(null);
    const [expandedSections, setExpandedSections] = useState(['specification']); // Start with description open
    const [showHeartPopup, setShowHeartPopup] = useState(false);
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
    const [similarProducts, setSimilarProducts] = useState([]);
    const [similarLoading, setSimilarLoading] = useState(false);
    
    // Kit Add-ons State
    const [addons, setAddons] = useState([]);
    const [addonQuantities, setAddonQuantities] = useState({});
    const [addonsLoading, setAddonsLoading] = useState(false);

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
        if (!selectedProduct) return [];
        const images = [];
        if (selectedProduct.mainImage) images.push(selectedProduct.mainImage);
        else if (selectedProduct.image) images.push(selectedProduct.image);

        if (selectedProduct.galleryImages && Array.isArray(selectedProduct.galleryImages)) {
            images.push(...selectedProduct.galleryImages);
        } else if (selectedProduct.images && Array.isArray(selectedProduct.images)) {
            const extra = selectedProduct.images.filter(img => img !== selectedProduct.mainImage && img !== selectedProduct.image);
            images.push(...extra);
        }

        // Add variant images
        if (Array.isArray(selectedProduct.variants)) {
            selectedProduct.variants.forEach(v => {
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
                selectedProduct.mainImage || selectedProduct.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400",
            ];
    }, [selectedProduct]);

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

    const displayHighlights = useMemo(() => {
        const targetProduct = extendedProduct || selectedProduct;
        const raw = Array.isArray(targetProduct?.highlights) ? targetProduct.highlights : [];
        return raw.filter(
            (h) => h && typeof h.label === "string" && h.label.trim().length > 0
        );
    }, [selectedProduct, extendedProduct]);

    const fetchSimilarProducts = async (catId, currentProdId) => {
        if (!catId) return;
        try {
            setSimilarLoading(true);
            const params = { limit: 15 };
            params.categoryId = catId;
            if (currentLocation?.latitude && currentLocation?.longitude) {
                params.lat = currentLocation.latitude;
                params.lng = currentLocation.longitude;
            }
            const res = await customerApi.getProducts(params);
            let items = [];
            if (res.data?.success) {
                const raw = res.data.results || res.data.result?.items || res.data.result || [];
                items = (Array.isArray(raw) ? raw : []).filter(p => (p._id || p.id) !== currentProdId);
            }
            
            // If fewer than 2 items found by categoryId, fall back to headerId
            if (items.length < 2 && selectedProduct?.headerId) {
                const hId = selectedProduct.headerId?._id || selectedProduct.headerId;
                const hRes = await customerApi.getProducts({ headerId: hId, limit: 15 });
                if (hRes.data?.success) {
                    const hRaw = hRes.data.results || hRes.data.result?.items || hRes.data.result || [];
                    const hItems = (Array.isArray(hRaw) ? hRaw : []).filter(p => (p._id || p.id) !== currentProdId);
                    if (hItems.length > items.length) {
                        items = hItems;
                    }
                }
            }

            setSimilarProducts(items.slice(0, 10));
        } catch (err) {
            console.error("Error fetching similar products:", err);
            setSimilarProducts([]);
        } finally {
            setSimilarLoading(false);
        }
    };

    // Update variant when product changes
    useEffect(() => {
        setNewReview({ rating: 5, comment: '' });
        setLocalHasReviewed(false);
        setReviews([]);
        setIsDescriptionOpen(true);

        if (selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0) {
            setSelectedVariant(selectedProduct.variants[0]);
        } else {
            setSelectedVariant(null);
        }
        setActiveImageIndex(0);
        
        // Reset Addons
        setAddons([]);
        setAddonQuantities({});

        if (desktopContentRef.current) {
            desktopContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        if (mobileContentRef.current) {
            mobileContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }

        if (selectedProduct?.id || selectedProduct?._id) {
            const pid = selectedProduct.id || selectedProduct._id;
            fetchReviews(pid);
            fetchExtendedProduct(pid);
            if (selectedProduct.isMonthlyKit) {
                fetchAddons(pid);
            }

            const catId = selectedProduct.categoryId?._id || selectedProduct.categoryId || selectedProduct.headerId?._id || selectedProduct.headerId;
            fetchSimilarProducts(catId, pid);
        }
    }, [selectedProduct]);

    const fetchAddons = async (kitId) => {
        try {
            setAddonsLoading(true);
            const response = await customerApi.getKitAddons({ kitId });
            if (response?.data?.success) {
                const items = response.data.results || response.data.result || response.data.data || [];
                setAddons(items);
                
                // Get current cart item if it exists
                const variantKey = String(selectedVariant?.sku || selectedVariant?.name || "").trim();
                const currentCartItem = cart.find(
                    (item) =>
                        `${item.id || item._id}::${String(item.variantSku || "").trim()}` ===
                        `${kitId}::${variantKey || ""}`,
                );
                
                const initQty = {};
                items.forEach(item => {
                    if (currentCartItem && currentCartItem.kitAddons) {
                        const existing = currentCartItem.kitAddons.find(a => String(a.addonId) === String(item._id));
                        initQty[item._id] = existing ? existing.quantity : 0;
                    } else {
                        initQty[item._id] = 0;
                    }
                });
                setAddonQuantities(initQty);
            }
        } catch (err) {
            console.error("Error fetching add-ons:", err);
        } finally {
            setAddonsLoading(false);
        }
    };

    const updateAddonQty = (addonId, delta) => {
        setAddonQuantities(prev => {
            const addon = addons.find(a => a._id === addonId);
            const max = addon?.maxQtyPerOrder || 10;
            const newQty = Math.max(0, Math.min(max, (prev[addonId] || 0) + delta));
            
            const updatedPrev = { ...prev, [addonId]: newQty };
            
            // If the item is already in cart, auto update cart addons
            if (quantity > 0) {
                const newSelectedAddons = addons.filter(a => (updatedPrev[a._id] || 0) > 0);
                const newAddonData = newSelectedAddons.map(a => ({
                    addonId: a._id,
                    name: a.name,
                    price: a.price,
                    quantity: updatedPrev[a._id],
                    image: a.image
                }));
                
                // Patch kitAddons only (qty 0) — CartContext/backend treat this as addons-only update
                addToCart(
                    selectedProduct,
                    0,
                    String(selectedVariant?.sku || selectedVariant?.name || "").trim(),
                    { kitAddons: newAddonData }
                );
            }
            
            return updatedPrev;
        });
    };

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
            if (res.data.success) {
                setExtendedProduct(res.data.result);
            }
        } catch (error) {
            console.error("Fetch extended product error:", error);
        }
    };

    const fetchReviews = async (productId) => {
        try {
            setReviewLoading(true);
            const res = await customerApi.getProductReviews(productId);
            if (res.data.success) {
                setReviews(res.data.results);
            }
        } catch (error) {
            console.error("Fetch reviews error:", error);
        } finally {
            setReviewLoading(false);
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

    const variantKey = String(selectedVariant?.sku || selectedVariant?.name || "").trim();
    const cartItem = selectedProduct
        ? cart.find(
            (item) =>
                `${item.id || item._id}::${String(item.variantSku || "").trim()}` ===
                `${selectedProduct.id}::${variantKey || ""}`,
        )
        : null;
    const quantity = cartItem ? cartItem.quantity : 0;
    const isWishlisted = selectedProduct ? isInWishlist(selectedProduct.id) : false;

    useEffect(() => {
        if (isOpen) {
            controls.start("visible");
            document.body.style.overflow = "hidden"; // Prevent background scroll
            document.body.style.touchAction = "none"; // Disable swipe background panning
            document.documentElement.style.overflow = "hidden";
        } else {
            controls.start("hidden");
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
    }, [isOpen, controls]);

    const handleDragEnd = (event, info) => {
        const offset = info.offset.y;
        const velocity = info.velocity.y;

        if (offset > 150 || velocity > 200) {
            // Dragged down significantly -> Close
            closeProduct();
        } else if (offset < -20 || velocity < -200) {
            // Dragged up -> Expand
            setIsExpanded(true);
        } else {
            // Snap back to current state (expanded or initial)
        }
    };

    const toggleWishlist = (e) => {
        e.stopPropagation();

        if (!isAuthenticated) {
            closeProduct();
            navigate('/login', { state: { from: window.location.pathname } });
            return;
        }

        if (!isWishlisted) {
            setShowHeartPopup(true);
            setTimeout(() => setShowHeartPopup(false), 1000);
        }

        toggleWishlistGlobal({
            ...selectedProduct,
            conditionType: isRefurbishedProduct ? 'refurbished' : (selectedProduct?.conditionType || 'new'),
        });
        showToast(
            isWishlisted ? `${selectedProduct.name} removed from wishlist` : `${selectedProduct.name} added to wishlist`,
            isWishlisted ? 'info' : 'success'
        );
    };

    const handleAddToCart = () => {
        if (!isAuthenticated) {
            closeProduct();
            navigate('/login', { state: { from: window.location.pathname } });
            return;
        }

        let customData = {};
        if (selectedProduct.isMonthlyKit) {
            const selectedAddons = addons.filter(a => (addonQuantities[a._id] || 0) > 0);
            const addonData = selectedAddons.map(a => ({
                addonId: a._id,
                name: a.name,
                image: a.mainImage,
                quantity: addonQuantities[a._id],
                price: a.price,
                unit: a.unit,
                subtotal: a.price * addonQuantities[a._id],
            }));
            if (addonData.length > 0) {
                customData.kitAddons = addonData;
            }
        }
        
        addToCart(
            {
                ...selectedProduct,
                conditionType: isRefurbishedProduct ? 'refurbished' : (selectedProduct?.conditionType || 'new'),
            },
            1, 
            String(selectedVariant?.sku || selectedVariant?.name || "").trim(),
            customData
        );
        showToast(`${selectedProduct.name} added to cart`, 'success');
    };

    const handleIncrement = () => {
        if (!isAuthenticated) {
            closeProduct();
            navigate('/login', { state: { from: window.location.pathname } });
            return;
        }
        updateQuantity(selectedProduct.id, 1, String(selectedVariant?.sku || selectedVariant?.name || "").trim());
    };

    const handleDecrement = () => {
        if (quantity === 1) {
            removeFromCart(selectedProduct.id, String(selectedVariant?.sku || selectedVariant?.name || "").trim());
        } else {
            updateQuantity(selectedProduct.id, -1, String(selectedVariant?.sku || selectedVariant?.name || "").trim());
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

    const cleanDesc = cleanDescription(selectedProduct?.description);

    const activeProduct = extendedProduct || selectedProduct;

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
            { key: 'Customer Care', value: supportEmail },
        ];

        standardFields.forEach((field) => {
            if (field.value && !seenKeys.has(field.key.toLowerCase())) {
                seenKeys.add(field.key.toLowerCase());
                list.push({ label: field.key, value: String(field.value).trim() });
            }
        });

        return list;
    }, [activeProduct, selectedProduct, selectedVariant, supportEmail]);

    const specificationPairs = useMemo(() => {
        const pairs = [];
        for (let i = 0; i < specificationsList.length; i += 2) {
            pairs.push(specificationsList.slice(i, i + 2));
        }
        return pairs;
    }, [specificationsList]);

    const selectedAddons = addons.filter(a => (addonQuantities[a._id] || 0) > 0);
    const addonsTotal = selectedAddons.reduce((sum, a) => sum + (a.price * addonQuantities[a._id]), 0);
    const displayPrice = (selectedVariant?.salePrice || selectedVariant?.price || selectedProduct?.salePrice || selectedProduct?.price || 0) + addonsTotal;

    const renderKitAddons = () => (
        !addonsLoading && addons.length > 0 ? (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-4 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
            >
                <div className="px-4 pt-4 pb-3">
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-primary" />
                        अपनी Basket में और Add करें
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        Atta, Oil, Rice — जितना चाहें उतना quantity select करें
                    </p>
                </div>

                <div className="px-4 pb-4 space-y-3">
                    {addons.map((addon) => {
                        const qty = addonQuantities[addon._id] || 0;
                        return (
                            <div
                                key={addon._id}
                                className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
                                    qty > 0
                                        ? 'border-primary/30 bg-primary/5 shadow-sm'
                                        : 'border-slate-100 bg-slate-50/50'
                                }`}
                            >
                                <div className="w-14 h-14 rounded-xl overflow-hidden bg-white border border-slate-100 flex-shrink-0">
                                    {addon.mainImage ? (
                                        <img
                                            src={addon.mainImage}
                                            alt={addon.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
                                            <Package className="h-5 w-5 text-orange-300" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h4 className="font-black text-slate-900 text-sm leading-tight">{addon.name}</h4>
                                    <p className="text-xs text-slate-500 font-medium">{addon.unit}</p>
                                    <p className="text-sm font-black text-primary mt-0.5">₹{addon.price}</p>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {qty > 0 ? (
                                        <>
                                            <button
                                                onClick={() => updateAddonQty(addon._id, -1)}
                                                className="w-7 h-7 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center hover:border-primary/50 active:scale-90 transition-all shadow-sm"
                                            >
                                                <Minus className="h-3 w-3 text-slate-600" />
                                            </button>
                                            <span className="w-6 text-center text-sm font-black text-slate-900">
                                                {qty}
                                            </span>
                                            <button
                                                onClick={() => updateAddonQty(addon._id, 1)}
                                                className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 active:scale-90 transition-all shadow-sm shadow-primary/20"
                                            >
                                                <Plus className="h-3 w-3" />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => updateAddonQty(addon._id, 1)}
                                            className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-black hover:bg-primary/20 active:scale-95 transition-all"
                                        >
                                            + ADD
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        ) : null
    );

    const highlightItems = useMemo(() => {
        if (displayHighlights && displayHighlights.length > 0) {
            return displayHighlights.map(h => h.label);
        }
        if (specificationsList && specificationsList.length > 0) {
            return specificationsList.slice(0, 5).map(s => `${s.value ? `${s.value} ${s.label}` : s.label}`);
        }
        return [
            "100% Genuine and Brand Assured",
            "Superfast Doorstep Delivery",
            "Best Price Guaranteed"
        ];
    }, [displayHighlights, specificationsList]);

    const groupedSpecifications = useMemo(() => {
        if (!specificationsList || specificationsList.length === 0) return {};
        const groups = {};

        specificationsList.forEach(item => {
            const key = item.label.toLowerCase();
            let groupName = "GENERAL";

            if (key.includes("battery") || key.includes("power") || key.includes("charging") || key.includes("mah")) {
                groupName = "BATTERY & POWER FEATURES";
            } else if (key.includes("os") || key.includes("operating system") || key.includes("processor") || key.includes("cpu") || key.includes("chip") || key.includes("ram") || key.includes("rom") || key.includes("storage")) {
                groupName = "OS & PROCESSOR FEATURES";
            } else if (key.includes("camera") || key.includes("lens") || key.includes("mp") || key.includes("video") || key.includes("photo")) {
                groupName = "CAMERA FEATURES";
            } else if (key.includes("display") || key.includes("screen") || key.includes("resolution") || key.includes("inch") || key.includes("refresh rate") || key.includes("pixel")) {
                groupName = "DISPLAY FEATURES";
            } else if (key.includes("box") || key.includes("pack") || key.includes("package") || key.includes("included") || key.includes("in the box")) {
                groupName = "IN THE BOX";
            } else if (key.includes("weight") || key.includes("shelf") || key.includes("fssai") || key.includes("country") || key.includes("origin") || key.includes("brand") || key.includes("container") || key.includes("model")) {
                groupName = "GENERAL";
            } else {
                groupName = "MORE DETAILS";
            }

            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(item);
        });

        return groups;
    }, [specificationsList]);

    const renderTrustBadges = () => (
        <div className="grid grid-cols-3 gap-2.5 my-3.5">
            {/* 7-Day Return */}
            <div className="flex flex-col items-center justify-center p-3 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-800 mb-2">
                    <RotateCcw size={18} strokeWidth={2.3} />
                </div>
                <div className="flex items-center justify-center gap-0.5 text-[11px] sm:text-xs font-bold text-slate-900 leading-tight">
                    <span>7-Day Return</span>
                    <ChevronRight size={12} className="text-slate-400 shrink-0" />
                </div>
            </div>

            {/* Cash on Delivery */}
            <div className="flex flex-col items-center justify-center p-3 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-800 mb-2">
                    <Banknote size={18} strokeWidth={2.3} />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-slate-900 leading-tight">Cash on Delivery</span>
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">PAY AT DOORSTEP</span>
            </div>

            {/* 1 Year Warranty */}
            <div className="flex flex-col items-center justify-center p-3 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-800 mb-2">
                    <ShieldCheck size={18} strokeWidth={2.3} />
                </div>
                <div className="flex items-center justify-center gap-0.5 text-[11px] sm:text-xs font-bold text-slate-900 leading-tight">
                    <span>1 Year Warranty details</span>
                    <ChevronRight size={12} className="text-slate-400 shrink-0" />
                </div>
            </div>
        </div>
    );

    const renderHighlightsCard = () => (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs my-3">
            <h3 className="text-base font-bold text-slate-900 mb-1">Highlights</h3>
            <h4 className="text-[13px] font-semibold text-slate-800 mb-2.5">Product Highlights</h4>
            <ul className="space-y-2">
                {highlightItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-[13px] text-slate-800 leading-snug">
                        <span className="text-slate-400 font-bold select-none text-sm leading-4">•</span>
                        <span className="font-medium text-slate-800">{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );

    const renderDescriptionCard = () => (
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
                <div className="p-4 pt-1 space-y-4 border-t border-slate-100">
                    {/* Grouped Features / Specifications */}
                    {Object.keys(groupedSpecifications).length > 0 ? (
                        Object.entries(groupedSpecifications).map(([groupName, items]) => (
                            <div key={groupName} className="space-y-2">
                                <h5 className="text-xs font-bold text-slate-900 tracking-wider uppercase">
                                    {groupName}
                                </h5>
                                <div className="space-y-1.5 pl-0.5">
                                    {items.map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-2 text-[13px] leading-snug">
                                            <span className="text-blue-500 font-bold select-none text-xs leading-4 shrink-0">.</span>
                                            <span className="font-medium text-slate-800">
                                                <span className="text-slate-600">{item.label}</span> {item.value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : null}

                    {/* Clean Description Text */}
                    {cleanDesc && (
                        <div className="pt-2 border-t border-slate-100">
                            <h5 className="text-xs font-bold text-slate-900 tracking-wider uppercase mb-2">
                                PRODUCT DETAILS
                            </h5>
                            <div
                                className="text-[13px] text-slate-600 font-normal leading-relaxed whitespace-pre-line"
                                dangerouslySetInnerHTML={{ __html: cleanDesc }}
                            />
                        </div>
                    )}

                    {!cleanDesc && Object.keys(groupedSpecifications).length === 0 && (
                        <p className="text-xs text-slate-400 italic py-1">No additional details available</p>
                    )}
                </div>
            )}
        </div>
    );

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
                        className="fixed inset-0 bg-black/60 z-[580] backdrop-blur-sm"
                    />

                    {/* ============================================================ */}
                    {/* DESKTOP LAYOUT: Wide 2-column modal (hidden on mobile) */}
                    {/* ============================================================ */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 30 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
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

                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={toggleWishlist}
                                        className={cn(
                                            "relative w-10 h-10 backdrop-blur-md rounded-xl shadow-md shadow-black/5 flex items-center justify-center hover:shadow-lg transition-all border",
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
                                                    <img src={applyCloudinaryTransform(img, "f_auto,q_auto:best,w_160,dpr_auto")} alt="" loading="lazy" className="w-full h-full object-contain p-1.5" />
                                                </motion.button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Main image viewer */}
                                    <div className="flex-1 flex items-center justify-center p-6 lg:p-8 relative min-h-[350px]">
                                        <AnimatePresence mode="wait">
                                            <motion.img
                                                key={activeImageIndex}
                                                initial={{ scale: 0.93, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0.93, opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                src={applyCloudinaryTransform(allImages[activeImageIndex], "f_auto,q_auto:best,w_1200,dpr_auto")}
                                                alt={`${selectedProduct.name} ${activeImageIndex + 1}`}
                                                onClick={() => setIsLightboxOpen(true)}
                                                className="w-full h-full object-contain mix-blend-multiply drop-shadow-2xl hover:scale-[1.03] transition-transform duration-500 absolute inset-0 m-auto p-12 cursor-pointer"
                                            />
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
                                        onClick={() => {
                                            closeProduct();
                                            navigate('/checkout', { state: { directBuyItem: selectedProduct } });
                                        }}
                                        className="flex-1 bg-[#fb641b] hover:bg-[#f45305] active:scale-95 text-white font-bold text-xs lg:text-sm py-3.5 px-3 rounded-xl shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider"
                                    >
                                        <Zap size={16} strokeWidth={2.5} />
                                        <span>Buy Now</span>
                                    </button>
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
                                            </div>
                                            <div>
                                                {quantity > 0 ? (
                                                    <div className="flex items-center gap-1 bg-[#FFC200] border border-[#E6AC00] rounded-xl p-1 shadow-sm">
                                                        <motion.button whileTap={{ scale: 0.85 }} onClick={handleDecrement} className="w-9 h-9 bg-white/70 rounded-lg flex items-center justify-center text-slate-900 hover:bg-white transition-colors">
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
                                                        <motion.button whileTap={{ scale: 0.85 }} onClick={handleIncrement} className="w-9 h-9 bg-white/70 rounded-lg flex items-center justify-center text-slate-900 hover:bg-white transition-colors">
                                                            <Plus size={16} strokeWidth={2.5} />
                                                        </motion.button>
                                                    </div>
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
                                    {selectedProduct.variants && selectedProduct.variants.filter(v => v.name).length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.25 }}
                                            className="bg-gray-50/60 rounded-xl p-3 border border-gray-100/70"
                                        >
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2.5">Select Variant</h4>
                                            <div className="flex gap-3 flex-wrap">
                                                {selectedProduct.variants.filter(v => v.name).map((v, idx) => (
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
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Included Items for Monthly Kits */}
                                    {selectedProduct.isMonthlyKit && selectedProduct.includedItems && selectedProduct.includedItems.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.25 }}
                                            className="bg-amber-50/50 rounded-xl p-4 border border-amber-100/50 mt-3"
                                        >
                                            <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                                                <Package className="w-3.5 h-3.5" />
                                                What's in the Basket
                                            </h4>
                                            <ul className="space-y-2">
                                                {selectedProduct.includedItems.map((item, idx) => (
                                                    <li key={idx} className="flex justify-between items-center text-sm font-semibold">
                                                        <span className="text-slate-700">{item.name}</span>
                                                        <span className="text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-100 text-xs">{item.quantity}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </motion.div>
                                    )}

                                    {/* Kit Addons (Desktop) */}
                                    {selectedProduct.isMonthlyKit && renderKitAddons()}

                                    {/* Thin Divider between Select Variant and Trust Badges */}
                                    <div className="border-t border-slate-100 my-4" />

                                    {/* 1. 7-Day Return, Cash on Delivery, 1 Year Warranty */}
                                    {renderTrustBadges()}

                                    {/* 2. Highlights / Specification Card */}
                                    {renderHighlightsCard()}

                                    {/* 3. Product Description / Details Card (Default Open) */}
                                    {renderDescriptionCard()}

                                    {/* 4. Similar Products Section (Right Swipe) */}
                                    {renderSimilarProducts()}

                                    {/* Bottom spacer */}
                                    <div className="h-6" />
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* ============================================================ */}
                    {/* MOBILE LAYOUT: Full Screen Sheet (hidden on desktop md+) */}
                    {/* ============================================================ */}
                    <motion.div
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.2}
                        onDragEnd={handleDragEnd}
                        initial={{
                            opacity: 0,
                            y: "100%",
                            top: 0,
                            bottom: 0,
                            left: 0,
                            width: "100%",
                            borderTopLeftRadius: 0,
                            borderTopRightRadius: 0,
                            height: "100dvh",
                            maxHeight: "100dvh"
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            top: 0,
                            bottom: 0,
                            left: 0,
                            width: "100%",
                            borderTopLeftRadius: 0,
                            borderTopRightRadius: 0,
                            height: "100dvh",
                            maxHeight: "100dvh"
                        }}
                        exit={{ opacity: 0, y: "100%", transition: { duration: 0.25 } }}
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 400,
                            mass: 0.8
                        }}
                        className={cn(
                            "md:hidden fixed z-[590] bg-white shadow-2xl overflow-hidden flex flex-col inset-0 h-[100dvh] max-h-[100dvh] w-full",
                        )}
                        style={{ willChange: "transform, height", touchAction: "auto", height: "100dvh", maxHeight: "100dvh" }}
                    >
                        {/* Header Actions (Absolute & Sticky) */}
                        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-40 pointer-events-none">
                            <motion.button
                                onClick={closeProduct}
                                whileTap={{ scale: 0.9 }}
                                className="w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center border border-gray-100 pointer-events-auto"
                            >
                                <ArrowLeft size={24} className={isRefurbishedProduct ? "text-blue-600" : "text-primary"} strokeWidth={3} />
                            </motion.button>
                            <div className="flex gap-3 pointer-events-auto invisible">
                                {/* Hidden as per request to simplify the view */}
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div
                            ref={mobileContentRef}
                            className="flex-1 overflow-x-hidden overflow-y-auto no-scrollbar bg-white"
                            style={{ paddingBottom: 'calc(6.5rem + env(safe-area-inset-bottom, 20px))' }}
                            onScroll={handleScroll}
                            onWheel={handleWheel}
                        >
                            {/* Product Image Carousel */}
                            <div className={cn(
                                "relative w-full pt-12 pb-8 h-[380px] sm:h-[480px] border-b",
                                isRefurbishedProduct
                                    ? "bg-gradient-to-b from-blue-50/90 via-sky-50/50 to-white border-blue-100/80"
                                    : "bg-gradient-to-b from-[#FFF2E8] via-[#FFF7F2] to-white border-orange-100/60"
                            )}>
                                <div
                                    ref={scrollRef}
                                    className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar h-full w-full"
                                    onScroll={(e) => {
                                        const index = Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth);
                                        setActiveImageIndex(index);
                                    }}
                                >
                                    {allImages.map((img, i) => (
                                        <div key={i} onClick={() => setIsLightboxOpen(true)} className="flex-shrink-0 w-full h-full snap-center flex items-center justify-center px-0 cursor-pointer">
                                            <img
                                                src={applyCloudinaryTransform(img, "f_auto,q_auto:best,w_1000,dpr_auto")}
                                                alt={`${selectedProduct.name} ${i + 1}`}
                                                className="w-full h-full object-contain mix-blend-multiply drop-shadow-xl scale-110"
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
                                                <img src={applyCloudinaryTransform(img, "f_auto,q_auto:best,w_150")} alt="" className="w-full h-full object-contain p-1.5 mix-blend-multiply" />
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

                                {/* Variants Selection (Mobile) */}
                                {selectedProduct.variants && selectedProduct.variants.filter(v => v.name).length > 0 && (
                                    <div className="pt-1 mb-1">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Select Variant</h4>
                                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                            {selectedProduct.variants.filter(v => v.name).map((v, idx) => (
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

                                {/* Included Items (Mobile) */}
                                {selectedProduct.isMonthlyKit && selectedProduct.includedItems && selectedProduct.includedItems.length > 0 && (
                                    <div className="pt-2 mb-2">
                                        <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <Package className="w-3 h-3" /> What's in the Basket
                                        </h4>
                                        <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100/50 space-y-2">
                                            {selectedProduct.includedItems.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-xs font-bold">
                                                    <span className="text-slate-700">{item.name}</span>
                                                    <span className="text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-100">{item.quantity}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Kit Addons (Mobile) */}
                                {selectedProduct.isMonthlyKit && renderKitAddons()}

                                {/* Thin Divider between Select Variant and Trust Badges */}
                                <div className="border-t border-slate-100 my-3" />

                                {/* 1. 7-Day Return, Cash on Delivery, 1 Year Warranty */}
                                {renderTrustBadges()}

                                {/* 2. Highlights / Specification Card */}
                                {renderHighlightsCard()}

                                {/* 3. Product Description / Details Card (Default Open) */}
                                {renderDescriptionCard()}

                                {/* 4. Similar Products Section (Right Swipe) */}
                                {renderSimilarProducts()}
                            </div>
                        </div>

                        {/* Sticky Bottom Action Bar */}
                        <div 
                            className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 p-3 sm:p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-50 shrink-0"
                            style={{ paddingBottom: 'max(1.25rem, calc(0.75rem + env(safe-area-inset-bottom, 16px)))' }}
                        >
                            <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
                                {/* Left Side: Cart Icon with Badge */}
                                <Link
                                    to="/cart"
                                    onClick={closeProduct}
                                    className="relative w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-800 hover:bg-slate-200 active:scale-95 transition-all shrink-0"
                                    title="View Cart"
                                >
                                    <ShoppingCart size={20} className="text-slate-800" />
                                    {(isRefurbishedProduct ? refurbishedCartCount : groceryCartCount) > 0 && (
                                        <div className="absolute -top-1.5 -right-1.5 text-slate-900 bg-[#FFC200] border border-white text-[10px] font-black w-4.5 h-4.5 rounded-full flex shrink-0 items-center justify-center shadow-xs">
                                            {(isRefurbishedProduct ? refurbishedCartCount : groceryCartCount) > 99 ? '99+' : (isRefurbishedProduct ? refurbishedCartCount : groceryCartCount)}
                                        </div>
                                    )}
                                </Link>

                                {/* Right Side: Flipkart-style Yellow Add to Cart / Quantity Pill Button */}
                                {quantity > 0 ? (
                                    <div className="flex-1 bg-[#FFC200] text-slate-900 h-12 rounded-xl flex items-center justify-between px-3 shadow-md border border-[#E6AC00]">
                                        <motion.button
                                            whileTap={{ scale: 0.8 }}
                                            onClick={handleDecrement}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-900 hover:bg-black/10 transition-colors"
                                        >
                                            <Minus size={18} strokeWidth={3} />
                                        </motion.button>
                                        <div className="flex-1 flex justify-center items-center relative overflow-hidden h-6">
                                            <span className="font-black text-xs uppercase tracking-wider text-slate-900">
                                                {quantity} in cart
                                            </span>
                                        </div>
                                        <motion.button
                                            whileTap={{ scale: 0.8 }}
                                            onClick={handleIncrement}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-900 hover:bg-black/10 transition-colors"
                                        >
                                            <Plus size={18} strokeWidth={3} />
                                        </motion.button>
                                    </div>
                                ) : (
                                    <motion.button
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.96 }}
                                        onClick={handleAddToCart}
                                        className="flex-1 bg-[#FFC200] hover:bg-[#F5B800] text-slate-900 h-12 rounded-xl font-bold text-xs sm:text-[14px] flex items-center justify-center gap-2 shadow-md shadow-amber-200/50 border border-[#E6AC00] active:opacity-95 tracking-wider uppercase cursor-pointer"
                                    >
                                        <ShoppingCart size={18} strokeWidth={2.5} />
                                        ADD TO CART
                                    </motion.button>
                                )}
                            </div>
                        </div>

                    </motion.div>

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
                                                src={applyCloudinaryTransform(allImages[activeImageIndex], "f_auto,q_auto:best,w_1600,dpr_auto")}
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
                </>
            )}
        </AnimatePresence>
    );
};

export default ProductDetailSheet;


