import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Heart, Plus, Minus, Star, ShieldCheck, Clock, ArrowLeft, MessageSquare, Store, Building2, Smartphone, BatteryCharging, CheckCircle2, PackageCheck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { customerApi } from '../services/customerApi';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { useSettings } from '@core/context/SettingsContext';
import Lottie from 'lottie-react';
import { motion, AnimatePresence } from 'framer-motion';
import ParticleBurst from '../components/shared/ParticleBurst';

const ProductDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { cart, addToCart, updateQuantity } = useCart();
    const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
    const { showToast } = useToast();
    const { currentLocation } = useAppLocation();
    const { settings } = useSettings();

    const [product, setProduct] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeImage, setActiveImage] = useState('');
    const [reviews, setReviews] = useState([]);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
    const [localHasReviewed, setLocalHasReviewed] = useState(false);
    const [noServiceData, setNoServiceData] = useState(null);

    const [showHeartPopup, setShowHeartPopup] = useState(false);

    // Dynamically load no-service Lottie on mount
    useEffect(() => {
        import('@/assets/lottie/animation.json')
            .then((m) => setNoServiceData(m.default))
            .catch(() => { });
    }, []);

    const fetchData = async (showLoader = true) => {
        if (showLoader) setIsLoading(true);
        setError(null);
        try {
            const hasValidLocation =
                Number.isFinite(currentLocation?.latitude) &&
                Number.isFinite(currentLocation?.longitude);

            const params = hasValidLocation ? {
                lat: currentLocation.latitude,
                lng: currentLocation.longitude
            } : {};

            const res = await customerApi.getProductById(id, params);
            if (res.data.success) {
                const p = res.data.result;
                const formatted = {
                    ...p,
                    id: p._id,
                    images: [p.mainImage, ...(p.galleryImages || [])].filter(Boolean)
                };
                setProduct(formatted);
                setActiveImage(formatted.images[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600&auto=format&fit=crop');
                fetchReviews();
            }
        } catch (err) {
            console.error("Fetch product error:", err);
            setError(err.response?.data?.message || "Failed to load product");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchReviews = async () => {
        try {
            setReviewLoading(true);
            const res = await customerApi.getProductReviews(id);
            if (res.data.success) {
                setReviews(res.data.results || []);
            }
        } catch (error) {
            console.error("Fetch reviews error:", error);
        } finally {
            setReviewLoading(false);
        }
    };

    useEffect(() => {
        setNewReview({ rating: 5, comment: '' });
        setLocalHasReviewed(false);
        setReviews([]);
        if (id) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        if (id) {
            fetchData(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentLocation?.latitude, currentLocation?.longitude]);

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (!newReview.comment.trim()) return;

        try {
            setIsSubmittingReview(true);
            const res = await customerApi.submitReview({
                productId: id,
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

    const handleToggleWishlist = () => {
        if (!product) return;

        if (!isInWishlist(product.id)) {
            setShowHeartPopup(true);
            setTimeout(() => setShowHeartPopup(false), 1000);
        }

        toggleWishlistGlobal(product);
        const isWishlisted = isInWishlist(product.id);
        showToast(
            isWishlisted ? `${product.name} removed from wishlist` : `${product.name} added to wishlist`,
            isWishlisted ? 'info' : 'success'
        );
    };

    if (isLoading) {
        const isRefurbishedPath = window.location.pathname.startsWith('/marketplace') || window.location.pathname.startsWith('/refurbished');

        return (
            <div className="min-h-screen bg-slate-50 font-outfit pb-24 animate-pulse">
                {/* Header Navbar Skeleton */}
                <div className={`sticky top-0 z-30 px-4 py-3 border-b flex items-center gap-3 ${
                    isRefurbishedPath
                        ? 'bg-gradient-to-r from-blue-100/95 via-sky-50 to-[#EFF6FF] border-blue-200/60'
                        : 'bg-white border-slate-200/60'
                }`}>
                    <div className="w-9 h-9 rounded-full bg-slate-200/80 shrink-0" />
                    <div className="h-5 w-44 bg-slate-300/80 rounded-md" />
                </div>

                {/* Main Content Area Skeleton */}
                <div className="max-w-4xl mx-auto p-4 space-y-6">
                    {/* Main Image Box & Thumbnails */}
                    <div className="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3 shadow-2xs">
                        <div className="w-full h-64 sm:h-80 bg-slate-200/80 rounded-2xl" />
                        <div className="flex gap-2 justify-center pt-2">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="w-14 h-14 bg-slate-200/80 rounded-xl border border-slate-200" />
                            ))}
                        </div>
                    </div>

                    {/* Title, Rating, Price Box Skeleton */}
                    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 space-y-4 shadow-2xs">
                        <div className="space-y-2">
                            <div className="h-6 w-3/4 bg-slate-300/80 rounded-md" />
                            <div className="h-4 w-1/3 bg-slate-200/80 rounded-md" />
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <div className="space-y-1">
                                <div className="h-8 w-28 bg-blue-200/80 rounded-lg" />
                                <div className="h-3 w-20 bg-slate-200/80 rounded" />
                            </div>
                            <div className="h-7 w-24 bg-green-100/80 rounded-full" />
                        </div>

                        <div className="h-12 w-full bg-blue-50/80 rounded-2xl border border-blue-100" />
                    </div>

                    {/* Specs / Warranty Card Skeleton */}
                    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 space-y-3 shadow-2xs">
                        <div className="h-5 w-40 bg-slate-300/80 rounded-md mb-2" />
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex justify-between items-center py-1.5 border-b border-slate-100">
                                <div className="h-3.5 w-28 bg-slate-200/80 rounded" />
                                <div className="h-3.5 w-36 bg-slate-300/80 rounded" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Action Bar Skeleton */}
                <div className="fixed bottom-0 left-0 right-0 p-3.5 bg-white border-t border-slate-200/80 flex gap-3 shadow-lg z-40">
                    <div className="h-12 flex-1 bg-slate-200/80 rounded-2xl" />
                    <div className="h-12 flex-1 bg-blue-600/60 rounded-2xl" />
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen bg-white py-20 px-8 flex flex-col items-center justify-center text-center">
                <div className="w-64 h-64 mb-6">
                    {noServiceData ? (
                        <Lottie animationData={noServiceData} loop={true} />
                    ) : (
                        <div className="w-64 h-64" />
                    )}
                </div>
                <h3 className="text-3xl font-[1000] text-slate-800 tracking-tighter mb-4 uppercase">
                    Item <span className="text-primary">Unavailable</span>
                </h3>
                <p className="text-slate-500 font-bold text-sm max-w-[280px] mb-8 leading-relaxed">
                    {error === "Product not available in your area"
                        ? "This item is not available at your current location yet."
                        : "We couldn't load this product details. Try again later!"}
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button
                        onClick={() => navigate('/')}
                        className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-black/10"
                    >
                        Go to Home
                    </button>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-10 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const cartItem = cart.find(item => item.id === product.id);
    const quantity = cartItem ? cartItem.quantity : 0;
    const isWishlisted = isInWishlist(product.id);

    const isRefurbishedProduct = React.useMemo(() => {
        if (!product) return false;
        if (product.conditionType === 'new' && product.catalogType !== 'refurbished') {
            return false;
        }
        return (
            product.conditionType === 'refurbished' ||
            product.isRefurbished ||
            product.catalogType === 'refurbished' ||
            (product.conditionType !== 'new' && typeof window !== 'undefined' && (
                window.location.pathname.includes('/marketplace') ||
                window.location.pathname.startsWith('/marketplace') ||
                window.location.pathname.includes('/refurbished') ||
                window.location.pathname.startsWith('/refurbished')
            ))
        );
    }, [product]);

    return (
        <div className="relative z-10 py-8 w-full max-w-[1920px] mx-auto px-4 md:px-[50px] animate-in fade-in duration-700 mt-24">
            <Link to={-1} className={cn(
                "inline-flex items-center gap-2 font-bold mb-6 transition-colors group",
                isRefurbishedProduct ? "text-slate-600 hover:text-blue-600" : "text-slate-500 hover:text-primary"
            )}>
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Back
            </Link>

            <div className="flex flex-col lg:flex-row gap-10 xl:gap-16">
                <div className="lg:w-[45%] xl:w-[40%] space-y-4">
                    <div className={cn(
                        "relative aspect-square rounded-[2.5rem] overflow-hidden shadow-sm transition-all hover:shadow-xl group border",
                        isRefurbishedProduct
                            ? "bg-gradient-to-b from-blue-50/80 via-sky-50/40 to-white border-blue-200/70 shadow-blue-500/5"
                            : "bg-gradient-to-b from-[#FFF2E8] via-[#FFF7F2] to-white border-orange-200/70"
                    )}>
                        <img
                            src={applyCloudinaryTransform(activeImage, "f_auto,q_auto,w_800")}
                            alt={product.name}
                            loading="lazy"
                            className="w-full h-full object-contain p-4 md:p-6 transition-transform duration-700 group-hover:scale-105 mix-blend-multiply"
                        />
                        <button
                            onClick={handleToggleWishlist}
                            className={cn(
                                "absolute top-5 right-5 p-3.5 rounded-full shadow-md transition-all duration-300 hover:scale-110 border",
                                isRefurbishedProduct ? "border-blue-100" : "border-orange-100",
                                isWishlisted ? "bg-red-50 text-red-500" : "bg-white/90 text-slate-400 backdrop-blur-md"
                            )}
                        >
                            <ParticleBurst isActive={showHeartPopup} />
                            <motion.div
                                animate={isWishlisted ? { scale: [1, 1.3, 1] } : {}}
                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                className="relative z-10"
                            >
                                <Heart size={20} className={cn(isWishlisted && "fill-current")} />
                            </motion.div>
                        </button>

                        <AnimatePresence>
                            {showHeartPopup && (
                                <motion.div
                                    initial={{ scale: 0.5, opacity: 1, y: 0 }}
                                    animate={{ scale: 2.5, opacity: 0, y: -65 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.9, ease: "easeOut" }}
                                    className="absolute top-5 right-5 z-50 pointer-events-none text-red-500"
                                >
                                    <Heart size={24} fill="currentColor" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {product.images.map((img, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveImage(img)}
                                className={cn(
                                    "relative h-20 w-20 md:h-24 md:w-24 rounded-2xl overflow-hidden flex-shrink-0 transition-all border-2",
                                    activeImage === img
                                        ? (isRefurbishedProduct ? "border-blue-600 shadow-lg scale-95 ring-2 ring-blue-100" : "border-[#FF5722] shadow-lg scale-95 ring-2 ring-orange-100")
                                        : "border-slate-200 opacity-70 hover:opacity-100"
                                )}
                            >
                                <img src={applyCloudinaryTransform(img, "f_auto,q_auto,w_150")} alt={`Angle ${idx}`} loading="lazy" className="w-full h-full object-contain p-1 mix-blend-multiply" />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="lg:w-[55%] xl:w-[60%] space-y-6 md:space-y-8">
                    <div>
                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                            <span className="bg-[#0F172A] text-white px-3.5 py-1.5 rounded-full text-[10.5px] font-black uppercase tracking-wider shadow-2xs">
                                {product.categoryId?.name || (isRefurbishedProduct ? 'Refurbished Device' : 'Essential')}
                            </span>

                            {(product.sellerId?.shopName || product.warehouseId?.name) && (
                                <span className="bg-[#EEF2FF] text-[#1E3A8A] border border-[#C7D2FE] flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10.5px] font-black uppercase tracking-wider">
                                    {product.sellerId?.shopName ? (
                                        <><Store size={13} className="text-[#1E3A8A]" /> {product.sellerId.shopName}</>
                                    ) : (
                                        <><Building2 size={13} className="text-[#1E3A8A]" /> {product.warehouseId?.name}</>
                                    )}
                                </span>
                            )}

                            <div className={cn(
                                "flex items-center gap-1 font-black px-3.5 py-1 rounded-full text-xs border",
                                isRefurbishedProduct
                                    ? "text-blue-600 bg-blue-50 border-blue-200"
                                    : "text-[#FF5722] bg-[#FFF0E6] border-[#FFD0B5]"
                            )}>
                                <Star size={13} fill="currentColor" /> 4.8 ({reviews.length > 0 ? reviews.length : '120+'})
                            </div>
                        </div>

                        <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] leading-tight mb-3">
                            {product.name}
                        </h1>

                        <div className="flex items-baseline gap-4 mb-5">
                            <span className="text-4xl font-black text-[#0F172A]">₹{product.salePrice || product.price}</span>
                            {(product.salePrice && product.salePrice < product.price) && (
                                <span className="text-lg text-slate-400 line-through font-bold">₹{product.price}</span>
                            )}
                            {product.salePrice && product.salePrice < product.price && (
                                <span className={cn(
                                    "text-xs px-2.5 py-1 rounded-xl font-black uppercase tracking-wider border",
                                    isRefurbishedProduct
                                        ? "bg-blue-50 text-blue-600 border-blue-200"
                                        : "bg-[#FFF0E6] text-[#FF5722] border-orange-200"
                                )}>
                                    {Math.round(((product.price - product.salePrice) / product.price) * 100)}% OFF
                                </span>
                            )}
                        </div>

                        <p className="text-slate-600 text-lg leading-relaxed mb-6 font-medium max-w-2xl">
                            {product.description || (isRefurbishedProduct
                                ? "Certified refurbished smartphone thoroughly tested, cleaned, and verified for peak performance."
                                : "Fresh and premium quality product sourced directly from local vendors.")}
                        </p>

                        {isRefurbishedProduct && (
                            <div className="bg-gradient-to-br from-blue-600/10 via-sky-500/5 to-indigo-900/5 rounded-3xl p-5 border border-blue-200/80 shadow-sm space-y-4 mb-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
                                            <Smartphone size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                                                Verified Refurbished Device
                                                <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md uppercase">Certified</span>
                                            </h3>
                                            <p className="text-[11px] text-slate-500 font-semibold">100% Inspected & Certified with Seller Warranty</p>
                                        </div>
                                    </div>
                                    {product.refurbishedDetails?.grade && (
                                        <span className="bg-blue-900 text-white text-xs font-black px-3 py-1 rounded-full shadow-sm">
                                            Grade {product.refurbishedDetails.grade}
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                                    <div className="bg-white p-3 rounded-2xl border border-blue-100 shadow-2xs">
                                        <div className="flex items-center gap-1.5 text-blue-600 text-[10.5px] font-extrabold uppercase tracking-wider mb-0.5">
                                            <BatteryCharging size={14} /> Battery
                                        </div>
                                        <div className="text-xs font-black text-slate-900">
                                            {product.refurbishedDetails?.batteryHealth || 90}% Health
                                        </div>
                                    </div>

                                    <div className="bg-white p-3 rounded-2xl border border-blue-100 shadow-2xs">
                                        <div className="flex items-center gap-1.5 text-indigo-600 text-[10.5px] font-extrabold uppercase tracking-wider mb-0.5">
                                            <ShieldCheck size={14} /> Warranty
                                        </div>
                                        <div className="text-xs font-black text-slate-900">
                                            {product.refurbishedDetails?.warrantyMonths || 6} Months
                                        </div>
                                    </div>

                                    <div className="bg-white p-3 rounded-2xl border border-blue-100 shadow-2xs">
                                        <div className="flex items-center gap-1.5 text-sky-600 text-[10.5px] font-extrabold uppercase tracking-wider mb-0.5">
                                            <CheckCircle2 size={14} /> Hardware
                                        </div>
                                        <div className="text-xs font-black text-slate-900">
                                            32 QC Passed
                                        </div>
                                    </div>

                                    <div className="bg-white p-3 rounded-2xl border border-blue-100 shadow-2xs">
                                        <div className="flex items-center gap-1.5 text-teal-600 text-[10.5px] font-extrabold uppercase tracking-wider mb-0.5">
                                            <PackageCheck size={14} /> Replacement
                                        </div>
                                        <div className="text-xs font-black text-slate-900">
                                            7 Days Easy
                                        </div>
                                    </div>
                                </div>

                                {Array.isArray(product.refurbishedDetails?.boxItems) && product.refurbishedDetails.boxItems.length > 0 && (
                                    <div className="bg-white p-3.5 rounded-2xl border border-blue-100">
                                        <div className="text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5">
                                            <PackageCheck size={15} className="text-blue-600" /> What's Included in Box:
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {product.refurbishedDetails.boxItems.map((item, idx) => (
                                                <span key={idx} className="bg-blue-50/80 text-blue-900 text-xs font-semibold px-2.5 py-1 rounded-lg border border-blue-200/60">
                                                    ✓ {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={cn(
                        "flex flex-col sm:flex-row items-center gap-6 p-6 rounded-[2.5rem] border",
                        isRefurbishedProduct
                            ? "bg-gradient-to-r from-blue-50/80 via-sky-50/50 to-indigo-50/80 border-blue-200/80"
                            : "bg-gradient-to-r from-[#FFF5EE] to-[#EEF2FF] border-orange-100"
                    )}>
                        {quantity > 0 ? (
                            <div className={cn(
                                "flex items-center text-white rounded-2xl h-16 w-full sm:w-auto px-2 shadow-xl",
                                isRefurbishedProduct
                                    ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 shadow-blue-500/25"
                                    : "bg-gradient-to-r from-[#FF5722] to-[#FF6D00] shadow-orange-500/25"
                            )}>
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => updateQuantity(product.id, -1, "")}
                                    className="w-12 h-12 flex items-center justify-center hover:bg-white/20 rounded-xl transition-all"
                                >
                                    <Minus size={24} strokeWidth={3} />
                                </motion.button>
                                <div className="w-16 flex justify-center items-center relative overflow-hidden h-8">
                                    <AnimatePresence mode="popLayout">
                                        <motion.span
                                            key={quantity}
                                            initial={{ y: 15, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            exit={{ y: -15, opacity: 0 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                            className="text-center font-black text-xl absolute"
                                        >
                                            {quantity}
                                        </motion.span>
                                    </AnimatePresence>
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => updateQuantity(product.id, 1, "")}
                                    className="w-12 h-12 flex items-center justify-center hover:bg-white/20 rounded-xl transition-all"
                                >
                                    <Plus size={24} strokeWidth={3} />
                                </motion.button>
                            </div>
                        ) : (
                            <Button
                                onClick={() => {
                                    addToCart(isRefurbishedProduct ? { ...product, conditionType: 'refurbished' } : product);
                                    showToast(`${product.name} added to cart`, 'success');
                                }}
                                className={cn(
                                    "h-16 w-full sm:w-64 text-white text-lg font-black rounded-2xl shadow-xl transition-all hover:opacity-95 active:scale-95",
                                    isRefurbishedProduct
                                        ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 shadow-blue-500/25 hover:shadow-blue-500/35"
                                        : "bg-gradient-to-r from-[#FF5722] to-[#FF6D00] shadow-orange-500/25"
                                )}
                            >
                                <Plus className="mr-2" size={24} strokeWidth={3} /> ADD TO CART
                            </Button>
                        )}

                        <div className="flex flex-col gap-1 text-center sm:text-left">
                            <span className={cn(
                                "text-xs font-black uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1",
                                isRefurbishedProduct ? "text-blue-600" : "text-[#FF5722]"
                            )}>
                                <ShieldCheck size={15} /> {isRefurbishedProduct ? 'Certified Refurbished' : 'Quality Guaranteed'}
                            </span>
                            <span className="text-sm font-bold text-[#0F172A] flex items-center justify-center sm:justify-start gap-1">
                                <Clock size={15} className={isRefurbishedProduct ? "text-blue-600" : "text-[#FF5722]"} /> Delivered in 10-15 mins
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className={cn(
                            "p-4 rounded-2xl border text-center shadow-2xs",
                            isRefurbishedProduct
                                ? "bg-blue-50/80 border-blue-200/80"
                                : "bg-[#FFF0E6] border-[#FFD0B5]"
                        )}>
                            <p className={cn(
                                "text-[10px] font-black uppercase tracking-widest mb-1",
                                isRefurbishedProduct ? "text-blue-700" : "text-[#D9480F]"
                            )}>{isRefurbishedProduct ? 'Unit' : 'Weight'}</p>
                            <p className="text-sm font-black text-[#0F172A]">
                                {isRefurbishedProduct ? (product.unit || '1 unit') : (product.weight || '1 kg')}
                            </p>
                        </div>
                        <div className="bg-[#EEF2FF] p-4 rounded-2xl border border-[#C7D2FE] text-center shadow-2xs">
                            <p className="text-[10px] font-black text-[#1E3A8A] uppercase tracking-widest mb-1">Stock</p>
                            <p className="text-sm font-black text-[#0F172A]">{product.stock > 0 ? 'In Stock' : 'Out of Stock'}</p>
                        </div>
                        <div className={cn(
                            "p-4 rounded-2xl border text-center shadow-2xs",
                            isRefurbishedProduct
                                ? "bg-sky-50/80 border-sky-200/80"
                                : "bg-[#FFF4EC] border-[#FFE4D6]"
                        )}>
                            <p className={cn(
                                "text-[10px] font-black uppercase tracking-widest mb-1",
                                isRefurbishedProduct ? "text-sky-700" : "text-[#E65100]"
                            )}>Brand</p>
                            <p className="text-sm font-black text-[#0F172A]">{product.brand || 'Premium'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-20 border-t border-slate-100 pt-16">
                <div className="flex flex-col lg:flex-row gap-12">
                    <div className="lg:w-[40%]">
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm sticky top-24">
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Write a Review</h3>
                            <p className="text-slate-500 font-medium mb-6 text-sm">Share your experience with this product</p>
                            {product?.hasReviewed || localHasReviewed ? (
                                <div className={cn(
                                    "p-6 rounded-2xl border text-center mt-6",
                                    isRefurbishedProduct ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-brand-50 border-brand-100 text-primary"
                                )}>
                                    <p className="text-sm font-bold">You have already reviewed this product. Thank you!</p>
                                </div>
                            ) : product?.hasPurchased ? (
                                <form onSubmit={handleReviewSubmit} className="space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Your Rating</label>
                                        <div className="flex gap-2">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => setNewReview({ ...newReview, rating: star })}
                                                    className={cn(
                                                        "h-12 w-12 rounded-xl flex items-center justify-center transition-all",
                                                        newReview.rating >= star
                                                            ? (isRefurbishedProduct ? "bg-blue-50 text-blue-600" : "bg-brand-50 text-primary")
                                                            : "bg-slate-50 text-slate-300"
                                                    )}
                                                >
                                                    <Star className={cn("h-6 w-6", newReview.rating >= star && "fill-current")} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Comment</label>
                                        <textarea
                                            value={newReview.comment}
                                            onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                                            placeholder="What did you like or dislike?"
                                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold min-h-[120px] outline-none ring-1 ring-transparent focus:ring-blue-500/20 transition-all"
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={isSubmittingReview}
                                        className={cn(
                                            "w-full h-12 text-white font-black rounded-xl text-xs uppercase tracking-[0.1em] transition-all shadow-lg",
                                            isRefurbishedProduct
                                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 shadow-blue-500/20"
                                                : "bg-primary hover:opacity-90 shadow-brand-100"
                                        )}
                                    >
                                        {isSubmittingReview ? 'Submitting...' : 'Post Review'}
                                    </Button>
                                </form>
                            ) : (
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center mt-6">
                                    <p className="text-sm font-bold text-slate-500">You must purchase and receive this product before you can write a review.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:w-[60%] space-y-8">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-3xl font-black text-slate-800">Customer Reviews</h3>
                            <div className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl border",
                                isRefurbishedProduct
                                    ? "bg-blue-50 border-blue-100 text-blue-600"
                                    : "bg-primary/5 border-primary/10 text-primary"
                            )}>
                                <MessageSquare size={18} className={isRefurbishedProduct ? "text-blue-600" : "text-primary"} />
                                <span className={cn("font-black", isRefurbishedProduct ? "text-blue-600" : "text-primary")}>{reviews.length} Verified</span>
                            </div>
                        </div>

                        {reviewLoading ? (
                            <div className="flex justify-center p-20">
                                <div className={cn(
                                    "w-8 h-8 border-4 border-t-transparent rounded-full animate-spin",
                                    isRefurbishedProduct ? "border-blue-600" : "border-primary"
                                )} />
                            </div>
                        ) : reviews.length > 0 ? (
                            <div className="space-y-6">
                                {reviews.map((review) => (
                                    <div key={review._id} className="p-8 rounded-[2rem] bg-white border border-slate-100 shadow-sm">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-400 text-xl">
                                                    {review.userId?.name?.[0] || "?"}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-800">
                                                        {review.userId?.name || "Anonymous"}
                                                        {review.status === 'pending' && <span className="ml-2 text-[10px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded uppercase">Pending</span>}
                                                    </h4>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        {[...Array(5)].map((_, i) => (
                                                            <Star
                                                                key={i}
                                                                size={12}
                                                                className={cn(i < review.rating ? "text-orange-400 fill-orange-400" : "text-slate-200")}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(review.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                        </div>
                                        <p className="text-slate-600 font-medium leading-relaxed">{review.comment}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-20 text-center rounded-[3rem] bg-slate-50 border-2 border-dashed border-slate-200">
                                <p className="text-slate-400 font-black uppercase text-sm">No reviews yet. Be the first!</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetailPage;
