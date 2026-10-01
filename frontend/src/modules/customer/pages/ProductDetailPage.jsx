import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Search, ShoppingCart, Star, Heart, Check, 
  ChevronLeft, ChevronRight, Plus, Minus, ShieldCheck, Tag
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { customerApi } from '../services/customerApi';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { getProductUrl } from '@/core/utils/productUrl';
import { useAuth } from '@core/context/AuthContext';
import { cn } from '@/lib/utils';

const ProductDetailPage = () => {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { cart, addToCart, updateQuantity } = useCart();
  const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
  const { showToast } = useToast();
  const { currentLocation } = useAppLocation();

  // Resolve ID from query param (?id=...) or path params
  const productId = searchParams.get('id') || params.id || params.productSlug;

  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [moreProducts, setMoreProducts] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  // Touch swipe support for image gallery
  const touchStartXRef = useRef(null);

  // Fetch product data
  useEffect(() => {
    let isMounted = true;
    const fetchProductDetails = async () => {
      if (!productId) return;
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = { allProducts: 'true' };
        if (Number.isFinite(currentLocation?.latitude) && Number.isFinite(currentLocation?.longitude)) {
          queryParams.lat = currentLocation.latitude;
          queryParams.lng = currentLocation.longitude;
        }

        const res = await customerApi.getProductById(productId, queryParams);
        if (res.data?.success && isMounted) {
          const p = res.data.result;
          const formattedImages = [
            p.mainImage,
            ...(p.galleryImages || [])
          ].filter(Boolean);

          const formattedProduct = {
            ...p,
            id: p._id,
            images: formattedImages.length > 0 ? formattedImages : ['https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600&auto=format&fit=crop'],
          };

          setProduct(formattedProduct);
          setActiveImageIndex(0);

          // Select first variant if available
          if (Array.isArray(formattedProduct.variants) && formattedProduct.variants.length > 0) {
            setSelectedVariant(formattedProduct.variants[0]);
          } else {
            setSelectedVariant(null);
          }

          // Fetch "More products for you" matching the header category
          fetchCategoryProducts(formattedProduct);
        } else if (isMounted) {
          setError(res.data?.message || 'Product not found');
        }
      } catch (err) {
        if (isMounted) {
          console.error('Fetch product error:', err);
          setError(err.response?.data?.message || 'Failed to load product');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchProductDetails();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    return () => {
      isMounted = false;
    };
  }, [productId, currentLocation?.latitude, currentLocation?.longitude]);

  // Fetch all products in this category for "More products for you"
  const fetchCategoryProducts = async (currProduct) => {
    try {
      setLoadingMore(true);
      const headerId = currProduct.headerId?._id || currProduct.headerId;
      const categoryId = currProduct.categoryId?._id || currProduct.categoryId;

      const params = {
        allProducts: 'true',
        limit: 40,
      };

      if (headerId) {
        params.header = headerId;
      } else if (categoryId) {
        params.category = categoryId;
      }

      const res = await customerApi.getProducts(params);
      const items = res.data?.results || res.data?.result || res.data?.items || [];
      // Exclude currently viewed product
      const filtered = items.filter(item => String(item._id || item.id) !== String(currProduct.id || currProduct._id));
      setMoreProducts(filtered);
    } catch (err) {
      console.error('Fetch more products error:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Compute active price & discount
  const activePrice = useMemo(() => {
    if (selectedVariant?.price !== undefined) {
      const sale = Number(selectedVariant.salePrice || 0);
      const reg = Number(selectedVariant.price || 0);
      return sale > 0 && sale < reg ? sale : reg;
    }
    const sale = Number(product?.salePrice || 0);
    const reg = Number(product?.price || 0);
    return sale > 0 && sale < reg ? sale : reg;
  }, [product, selectedVariant]);

  const activeOriginalPrice = useMemo(() => {
    if (selectedVariant?.price !== undefined) {
      const sale = Number(selectedVariant.salePrice || 0);
      const reg = Number(selectedVariant.price || 0);
      return sale > 0 && sale < reg ? reg : 0;
    }
    const sale = Number(product?.salePrice || 0);
    const reg = Number(product?.price || 0);
    return sale > 0 && sale < reg ? reg : 0;
  }, [product, selectedVariant]);

  const discountPercent = useMemo(() => {
    if (activeOriginalPrice > activePrice) {
      return Math.round(((activeOriginalPrice - activePrice) / activeOriginalPrice) * 100);
    }
    return null;
  }, [activePrice, activeOriginalPrice]);

  // Cart operations
  const cartKey = useMemo(() => {
    if (!product) return '';
    const vKey = String(selectedVariant?.sku || selectedVariant?.name || '').trim();
    return `${product.id || product._id}::${vKey}`;
  }, [product, selectedVariant]);

  const cartItem = useMemo(() => {
    return cart.find(
      (item) => `${item.id || item._id}::${String(item.variantSku || '').trim()}` === cartKey
    );
  }, [cart, cartKey]);

  const currentQuantity = cartItem ? cartItem.quantity : 0;
  const isWishlisted = product ? isInWishlist(product.id || product._id) : false;

  const handleAddToCart = (e) => {
    if (e) e.stopPropagation();
    if (!product) return;

    if (!isAuthenticated) {
      navigate('/login', { state: { from: window.location.pathname + window.location.search } });
      return;
    }

    addToCart(product, 1, selectedVariant ? {
      sku: selectedVariant.sku,
      name: selectedVariant.name,
      price: activePrice
    } : null);

    showToast(`Added ${product.name} to cart`, 'success');
  };

  const handleIncrement = (e) => {
    if (e) e.stopPropagation();
    if (!cartItem) {
      handleAddToCart(e);
      return;
    }
    updateQuantity(cartItem._id || cartItem.id, currentQuantity + 1, cartItem.variantSku);
  };

  const handleDecrement = (e) => {
    if (e) e.stopPropagation();
    if (!cartItem) return;
    updateQuantity(cartItem._id || cartItem.id, currentQuantity - 1, cartItem.variantSku);
  };

  const handleToggleWishlist = () => {
    if (!product) return;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: window.location.pathname + window.location.search } });
      return;
    }
    toggleWishlistGlobal(product);
    showToast(
      isWishlisted ? `${product.name} removed from wishlist` : `${product.name} added to wishlist`,
      isWishlisted ? 'info' : 'success'
    );
  };

  // Image swipe handling
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null || !product?.images?.length) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;

    if (Math.abs(diff) > 40) {
      if (diff > 0 && activeImageIndex < product.images.length - 1) {
        setActiveImageIndex(prev => prev + 1);
      } else if (diff < 0 && activeImageIndex > 0) {
        setActiveImageIndex(prev => prev - 1);
      }
    }
    touchStartXRef.current = null;
  };

  // Build dynamic specifications list strictly from database fields
  const dynamicSpecs = useMemo(() => {
    if (!product) return [];

    const specs = [];

    // Pack of
    if (product.packOf) {
      specs.push({ label: 'Pack of', value: product.packOf });
    } else if (product.includedItems?.length) {
      specs.push({ label: 'Pack of', value: String(product.includedItems.length) });
    } else if (selectedVariant?.name || product.variants?.length) {
      specs.push({ label: 'Pack of', value: '1' });
    }

    // Brand
    if (product.brand) {
      specs.push({ label: 'Brand', value: product.brand });
    }

    // Model Name
    if (product.modelName) {
      specs.push({ label: 'Model Name', value: product.modelName });
    }

    // Quantity / Weight
    if (product.weight) {
      specs.push({ label: 'Quantity', value: product.weight });
    } else if (selectedVariant?.name && selectedVariant.name !== 'Default') {
      specs.push({ label: 'Quantity', value: selectedVariant.name });
    }

    // Category / Type
    if (product.headerId?.name) {
      specs.push({ label: 'Category', value: product.headerId.name });
    }
    if (product.categoryId?.name) {
      specs.push({ label: 'Sub-Category', value: product.categoryId.name });
    }
    if (product.subcategoryId?.name) {
      specs.push({ label: 'Type', value: product.subcategoryId.name });
    } else if (product.conditionType) {
      specs.push({ label: 'Type', value: product.conditionType === 'refurbished' ? 'Refurbished Device' : 'Standard Product' });
    }

    // Container Type
    if (product.containerType) {
      specs.push({ label: 'Container Type', value: product.containerType });
    }

    // Flavor
    if (product.flavor) {
      specs.push({ label: 'Flavor', value: product.flavor });
    }

    // Organic
    if (product.isOrganic !== undefined && product.isOrganic !== null) {
      specs.push({ label: 'Organic', value: product.isOrganic ? 'Yes' : 'No' });
    }

    // Gourmet
    if (product.isGourmet !== undefined && product.isGourmet !== null) {
      specs.push({ label: 'Gourmet', value: product.isGourmet ? 'Yes' : 'No' });
    }

    // Perishable
    if (product.isPerishable !== undefined && product.isPerishable !== null) {
      specs.push({ label: 'Is Perishable', value: product.isPerishable ? 'Yes' : 'No' });
    }

    // Maximum Shelf Life
    if (product.shelfLife) {
      specs.push({ label: 'Maximum Shelf Life', value: product.shelfLife });
    }

    // Preservatives
    if (product.addedPreservatives !== undefined && product.addedPreservatives !== null) {
      specs.push({ label: 'Added Preservatives', value: product.addedPreservatives ? 'Yes' : 'No' });
    }

    // Dietary Preference
    if (product.dietaryPreference) {
      specs.push({ label: 'Dietary Preference', value: product.dietaryPreference });
    }

    // Manufactured By / Seller
    if (product.manufacturedBy) {
      specs.push({ label: 'Manufactured By', value: product.manufacturedBy });
    } else if (product.sellerId?.shopName) {
      specs.push({ label: 'Manufactured / Sold By', value: product.sellerId.shopName });
    }

    // Caloric Value
    if (product.caloricValue) {
      specs.push({ label: 'Caloric Value', value: String(product.caloricValue) });
    }

    // Ingredients
    if (product.ingredients) {
      specs.push({ label: 'Ingredients', value: product.ingredients });
    }

    // Country of Origin
    if (product.countryOfOrigin) {
      specs.push({ label: 'Country of Origin', value: product.countryOfOrigin });
    }

    // FSSAI License
    if (product.fssaiLicense) {
      specs.push({ label: 'FSSAI License', value: product.fssaiLicense });
    }

    // SKU
    if (product.sku) {
      specs.push({ label: 'SKU', value: product.sku });
    }

    // Refurbished details (if any)
    if (product.conditionType === 'refurbished' || product.refurbishedDetails) {
      const rf = product.refurbishedDetails || {};
      if (rf.grade) specs.push({ label: 'Grade', value: rf.grade });
      if (rf.warrantyMonths) specs.push({ label: 'Warranty', value: `${rf.warrantyMonths} Months` });
      if (rf.batteryHealth) specs.push({ label: 'Battery Health', value: `${rf.batteryHealth}%` });
      if (rf.qcPassed !== undefined) specs.push({ label: 'QC Passed', value: rf.qcPassed ? 'Yes' : 'No' });
    }

    // Included Items
    if (Array.isArray(product.includedItems) && product.includedItems.length > 0) {
      const itemsList = product.includedItems
        .filter(item => item?.name)
        .map(item => `${item.name}${item.quantity ? ` (${item.quantity})` : ''}`)
        .join(', ');
      if (itemsList) {
        specs.push({ label: 'Included Items', value: itemsList });
      }
    }

    return specs;
  }, [product, selectedVariant]);

  const cartTotalCount = useMemo(() => {
    return cart.reduce((total, item) => total + (item.quantity || 1), 0);
  }, [cart]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        {/* Blue Header skeleton */}
        <div className="bg-[#2874f0] px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-white/20 animate-pulse shrink-0" />
          <div className="flex-1 h-9 rounded-full bg-white/90 animate-pulse" />
          <div className="w-8 h-8 rounded-full bg-white/20 animate-pulse shrink-0" />
        </div>
        {/* Main image skeleton */}
        <div className="p-4 flex flex-col items-center">
          <div className="w-full max-w-sm aspect-square bg-gray-100 rounded-2xl animate-pulse" />
          <div className="flex gap-2 mt-4">
            <div className="w-6 h-2 rounded-full bg-gray-300 animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-gray-200 animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-gray-200 animate-pulse" />
          </div>
          <div className="w-full mt-6 space-y-3">
            <div className="h-6 w-3/4 bg-gray-100 rounded animate-pulse" />
            <div className="h-5 w-1/4 bg-gray-100 rounded animate-pulse" />
            <div className="h-12 w-full bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Blue Header */}
        <div className="bg-[#2874f0] px-3 py-2.5 flex items-center gap-2.5 shadow-sm text-white">
          <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-white/10 active:scale-95 transition-all">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 text-sm font-semibold">Product Not Found</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Item Unavailable</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">{error || 'This product is currently not available.'}</p>
          <button
            onClick={() => navigate('/products')}
            className="bg-[#2874f0] text-white px-6 py-2.5 rounded-full font-bold text-sm shadow hover:bg-blue-600 transition-colors"
          >
            Browse All Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 pb-20 select-none">
      {/* 1. FLIPKART BLUE TOP HEADER */}
      <header className="sticky top-0 z-50 bg-[#2874f0] px-3 py-2.5 flex items-center gap-2.5 shadow-sm text-white">
        <button
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 text-white hover:bg-white/10 rounded-full transition-transform active:scale-90"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>

        {/* Round shape search field */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchInput.trim()) {
              navigate(`/products?search=${encodeURIComponent(searchInput.trim())}`);
            } else {
              navigate('/search');
            }
          }}
          className="flex-1 relative"
        >
          <div
            onClick={() => navigate('/search')}
            className="w-full bg-white rounded-full px-3.5 py-1.5 flex items-center gap-2 shadow-xs cursor-text"
          >
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search for products"
              className="w-full bg-transparent text-gray-800 placeholder-gray-400 text-xs sm:text-sm focus:outline-none"
            />
          </div>
        </form>

        {/* Cart Icon with badge */}
        <button
          onClick={() => navigate('/cart')}
          className="relative p-1 text-white hover:bg-white/10 rounded-full transition-transform active:scale-90"
          aria-label="Cart"
        >
          <ShoppingCart size={22} />
          {cartTotalCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#e41e31] text-white text-[10px] font-bold min-w-[17px] h-[17px] rounded-full flex items-center justify-center px-1 shadow-xs animate-in zoom-in-50">
              {cartTotalCount > 99 ? '99+' : cartTotalCount}
            </span>
          )}
        </button>
      </header>

      {/* 2. PRODUCT IMAGE CAROUSEL WITH SLIDE DOTS */}
      <div className="relative bg-white pt-4 pb-2 border-b border-gray-100">
        <div
          className="w-full max-w-md mx-auto aspect-square relative flex items-center justify-center px-4 overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={applyCloudinaryTransform(product.images[activeImageIndex] || product.mainImage, 'f_auto,q_auto,w_800')}
            alt={product.name}
            className="max-h-full max-w-full object-contain transition-all duration-300"
          />

          {/* Wishlist Heart Icon top right */}
          <button
            onClick={handleToggleWishlist}
            className="absolute top-2 right-4 p-2 rounded-full bg-white/80 backdrop-blur-xs text-gray-500 hover:text-red-500 active:scale-90 transition-transform shadow-2xs"
            aria-label="Wishlist"
          >
            <Heart
              size={20}
              className={cn(isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-400')}
            />
          </button>

          {/* Desktop image arrows */}
          {product.images.length > 1 && (
            <>
              {activeImageIndex > 0 && (
                <button
                  onClick={() => setActiveImageIndex(prev => prev - 1)}
                  className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow items-center justify-center text-gray-700 hover:bg-white"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              {activeImageIndex < product.images.length - 1 && (
                <button
                  onClick={() => setActiveImageIndex(prev => prev + 1)}
                  className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow items-center justify-center text-gray-700 hover:bg-white"
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Slide Dots Indicator */}
        {product.images.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-3 pb-1">
            {product.images.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveImageIndex(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={cn(
                  'h-1.5 transition-all duration-300 rounded-full',
                  activeImageIndex === index
                    ? 'w-5 bg-gray-800'
                    : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* 3. PRODUCT NAME & DETAILS SECTION */}
      <div className="px-4 pt-3 pb-3 space-y-2.5">
        {/* Product Name */}
        <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-snug tracking-tight">
          {product.name}
        </h1>

        {/* Discount Tag */}
        {discountPercent !== null && discountPercent > 0 && (
          <div className="text-green-700 font-bold text-sm tracking-tight flex items-center gap-1">
            <span>{discountPercent}% off</span>
          </div>
        )}

        {/* Price Box & Orange Add Button Row */}
        <div className="flex items-center justify-between gap-3 pt-0.5">
          {/* Left: Price and Variant Tag */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center bg-[#fef9c3] border border-[#facc15] rounded-md px-2.5 py-1 gap-2 shadow-2xs">
              <span className="text-xs font-black text-gray-900 tracking-tight">
                ₹{activePrice}
              </span>
              {activeOriginalPrice > activePrice && (
                <span className="text-[11px] text-gray-500 font-medium">
                  MRP <span className="line-through">₹{activeOriginalPrice}</span>
                </span>
              )}
            </div>

            {/* Multiple Variants Selector Chips if available */}
            {Array.isArray(product.variants) && product.variants.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-[180px] no-scrollbar">
                {product.variants.map((v, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedVariant(v)}
                    className={cn(
                      'text-[11px] font-bold px-2 py-0.5 rounded border whitespace-nowrap transition-colors',
                      selectedVariant?.name === v.name
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Orange Add Button */}
          <div>
            {currentQuantity > 0 ? (
              <div className="inline-flex items-center bg-white border border-[#ff6f00] rounded-lg shadow-xs overflow-hidden">
                <button
                  onClick={handleDecrement}
                  className="px-2.5 py-1 text-[#ff6f00] hover:bg-orange-50 font-black text-base active:scale-90 transition-transform"
                  aria-label="Decrease quantity"
                >
                  <Minus size={15} />
                </button>
                <span className="px-2 font-bold text-sm text-[#ff6f00] min-w-[20px] text-center">
                  {currentQuantity}
                </span>
                <button
                  onClick={handleIncrement}
                  className="px-2.5 py-1 text-[#ff6f00] hover:bg-orange-50 font-black text-base active:scale-90 transition-transform"
                  aria-label="Increase quantity"
                >
                  <Plus size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAddToCart}
                className="border border-[#ff6f00] text-[#ff6f00] bg-white hover:bg-orange-50 active:scale-95 font-bold px-5 py-1.5 rounded-lg text-sm transition-all shadow-2xs"
              >
                Add
              </button>
            )}
          </div>
        </div>

        {/* Rating row: Green stars 4.3 • (313) */}
        <div className="flex items-center gap-1.5 pt-0.5 text-xs text-gray-500">
          <div className="flex items-center text-green-700">
            <Star size={13} className="fill-green-600 text-green-600" />
            <Star size={13} className="fill-green-600 text-green-600" />
            <Star size={13} className="fill-green-600 text-green-600" />
            <Star size={13} className="fill-green-600 text-green-600" />
            <Star size={13} className="text-gray-300" />
          </div>
          <span className="font-bold text-gray-800 ml-1">4.3</span>
          <span>•</span>
          <span>(313)</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 italic">
            <ShieldCheck size={13} className="text-blue-600 not-italic" /> Assured
          </span>
        </div>
      </div>

      <div className="h-2 bg-[#f1f2f4]" />

      {/* 4. PRODUCT DETAILS CARD (DYNAMIC KEY-VALUES MATCHING IMAGE 1) */}
      <div className="px-4 py-4 bg-white">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3 tracking-tight">
          Product Details
        </h2>

        {dynamicSpecs.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {dynamicSpecs.map((spec, index) => (
              <div key={index} className="grid grid-cols-2 py-2 text-sm gap-2">
                <span className="text-gray-500 font-normal">{spec.label}</span>
                <span className="text-gray-900 font-medium break-words">{spec.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No additional specifications specified.</p>
        )}

        {/* Product Description text from database */}
        {product.description && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Description
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>
        )}
      </div>

      <div className="h-2 bg-[#f1f2f4]" />

      {/* 5. "MORE PRODUCTS FOR YOU" SECTION (MATCHING IMAGE 2) */}
      <div className="pt-4 pb-6 bg-white">
        <div className="px-4 mb-3">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
            More products for you
          </h2>
        </div>

        {/* 2 Products per row grid */}
        <div className="grid grid-cols-2 gap-3 px-4">
          {moreProducts.map((item) => {
            const itemPrice = Number(item.salePrice || item.price || 0);
            const itemMrp = Number(item.price || item.originalPrice || 0);
            const showMrp = itemMrp > itemPrice;
            const itemTargetUrl = getProductUrl(item);

            return (
              <Link
                key={item._id || item.id}
                to={itemTargetUrl}
                className="group flex flex-col bg-white rounded-2xl border border-gray-100 p-2.5 hover:shadow-md transition-all active:scale-[0.98]"
              >
                {/* Off-white Image Container */}
                <div className="w-full aspect-square bg-[#f6f7f9] rounded-xl relative flex items-center justify-center p-2 overflow-hidden mb-2">
                  <img
                    src={applyCloudinaryTransform(item.mainImage || item.image, 'f_auto,q_auto,w_400')}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Badges matching Image 2 */}
                  {item.isFeatured ? (
                    <span className="absolute top-2 left-2 bg-[#f0f0f0] text-gray-700 text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-2xs">
                      Bought Together
                    </span>
                  ) : null}

                  <span className="absolute top-2 right-2 bg-gray-200/80 text-gray-600 text-[8px] font-bold px-1 rounded">
                    AD
                  </span>

                  {/* Rating Tag bottom-left of image matching Image 2 */}
                  <div className="absolute bottom-1.5 left-1.5 bg-white/95 backdrop-blur-xs text-[10px] font-bold text-gray-800 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs border border-gray-100">
                    <span>4.2</span>
                    <Star size={10} className="fill-green-600 text-green-600" />
                    <span className="text-gray-400 font-normal">|</span>
                    <span className="text-gray-500 font-normal">74</span>
                  </div>
                </div>

                {/* Product Brand & Name below image */}
                <div className="flex-1 flex flex-col">
                  <p className="text-xs text-gray-800 font-medium line-clamp-2 leading-snug">
                    <span className="font-bold text-gray-900 mr-1">
                      {item.brand || 'Fresh'}
                    </span>
                    {item.name}
                  </p>

                  {/* Price Row: MRP strikethrough & Selling Price */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {showMrp && (
                      <span className="text-[11px] text-gray-400 line-through">
                        ₹{itemMrp}
                      </span>
                    )}
                    <span className="text-sm font-bold text-gray-900">
                      ₹{itemPrice}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {loadingMore && (
          <div className="text-center py-6">
            <div className="inline-block w-6 h-6 border-2 border-[#2874f0] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* 6. STICKY BOTTOM ACTION BAR (MATCHING IMAGE 2) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-4 py-2.5 flex items-center gap-3 shadow-lg max-w-md mx-auto md:max-w-2xl">
        <button
          onClick={handleAddToCart}
          className="flex-1 border border-gray-300 bg-white text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all text-sm text-center shadow-2xs"
        >
          {currentQuantity > 0 ? `In Cart (${currentQuantity})` : 'Add to cart'}
        </button>
        <button
          onClick={() => {
            if (currentQuantity === 0) {
              handleAddToCart();
            }
            navigate('/cart');
          }}
          className="flex-1 bg-[#ffc200] hover:bg-[#e6af00] text-gray-900 font-bold py-3 rounded-xl active:scale-[0.98] transition-all text-sm text-center shadow-sm"
        >
          Buy now
        </button>
      </div>
    </div>
  );
};

export default ProductDetailPage;
