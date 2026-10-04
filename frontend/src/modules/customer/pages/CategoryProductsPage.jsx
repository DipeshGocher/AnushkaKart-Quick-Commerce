import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Search, ShoppingCart, Star, Heart, ImageOff, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform, isPngImage } from '@/core/utils/imageUtils';
import { getProductUrl } from '@/core/utils/productUrl';
import ProductDetailSheet from '../components/shared/ProductDetailSheet';
import { useProductDetail } from '../context/ProductDetailContext';
import { customerApi } from '../services/customerApi';
import MiniCart from '../components/shared/MiniCart';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { useSettings } from '@core/context/SettingsContext';

// Banner assets for header categories
import groceryBannerImg from '@/assets/grocery_section_banner.jpg';
import electronicsBannerImg from '@/assets/banners/electronics_section_banner.jpg';
import mobilesBannerImg from '@/assets/banners/mobiles_section_banner.jpg';
import beautyBannerImg from '@/assets/banners/beauty_section_banner.jpg';
import fashionBannerImg from '@/assets/banners/fashion_section_banner.jpg';
import homeAppliancesBannerImg from '@/assets/banners/home_appliances_section_banner.jpg';

const getCategoryBanner = (headerName = '', headerSlug = '') => {
  const text = `${headerName} ${headerSlug}`.toLowerCase();
  if (/grocer/i.test(text)) return groceryBannerImg;
  if (/electr/i.test(text)) return electronicsBannerImg;
  if (/mobil|phone|smartphon/i.test(text)) return mobilesBannerImg;
  if (/beaut|cosmetic|skin/i.test(text)) return beautyBannerImg;
  if (/fashion|cloth|apparel|kid/i.test(text)) return fashionBannerImg;
  if (/home|appliance|kitchen/i.test(text)) return homeAppliancesBannerImg;
  return mobilesBannerImg || groceryBannerImg;
};

const normalizeText = (str) =>
  String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const formatPrice = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const CategoryProductsPage = () => {
  const { categoryName: routeCatParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentLocation } = useAppLocation();
  const { settings } = useSettings();
  const { cartCount } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { openProduct } = useProductDetail();

  // State
  const [allCategoriesTree, setAllCategoriesTree] = useState([]);
  const [headerCategories, setHeaderCategories] = useState([]);
  const [activeHeader, setActiveHeader] = useState(null);
  const [mainCategories, setMainCategories] = useState([]);
  const [selectedMainCatId, setSelectedMainCatId] = useState('all');
  const [selectedSubCatId, setSelectedSubCatId] = useState('all');
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(true);

  // 1. Initial Load: Fetch category tree
  useEffect(() => {
    let isMounted = true;
    const fetchTree = async () => {
      try {
        setIsLoading(true);
        const res = await customerApi.getCategories({ tree: true });
        const tree = res?.data?.results || res?.data?.result || [];
        if (!isMounted) return;

        setAllCategoriesTree(tree);

        // Header categories are top-level or items with type === 'header'
        const headers = tree.filter(
          (c) => c.type === 'header' || (!c.parentId && c.slug !== 'all')
        );
        setHeaderCategories(headers);
      } catch (err) {
        console.error('Failed to load category tree:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchTree();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Resolve Active Header Category from route parameter
  useEffect(() => {
    if (!allCategoriesTree.length) return;

    const targetParam = normalizeText(routeCatParam);
    let matchedHeader = null;
    let preselectedMain = 'all';
    let preselectedSub = 'all';

    // Walk tree to find which header category corresponds to routeCatParam
    for (const header of allCategoriesTree) {
      const headerSlug = normalizeText(header.slug);
      const headerName = normalizeText(header.name);
      const headerId = String(header._id || '').toLowerCase();

      if (headerSlug === targetParam || headerName === targetParam || headerId === targetParam) {
        matchedHeader = header;
        break;
      }

      // Check if routeCatParam matches one of header's main categories
      for (const cat of header.children || []) {
        const catSlug = normalizeText(cat.slug);
        const catName = normalizeText(cat.name);
        const catId = String(cat._id || '').toLowerCase();

        if (catSlug === targetParam || catName === targetParam || catId === targetParam) {
          matchedHeader = header;
          preselectedMain = cat._id;
          break;
        }

        // Check subcategories
        for (const sub of cat.children || []) {
          const subSlug = normalizeText(sub.slug);
          const subName = normalizeText(sub.name);
          const subId = String(sub._id || '').toLowerCase();

          if (subSlug === targetParam || subName === targetParam || subId === targetParam) {
            matchedHeader = header;
            preselectedMain = cat._id;
            preselectedSub = sub._id;
            break;
          }
        }
        if (matchedHeader) break;
      }
      if (matchedHeader) break;
    }

    // Default to first header if not found
    if (!matchedHeader && headerCategories.length > 0) {
      matchedHeader = headerCategories[0];
    }

    if (matchedHeader) {
      setActiveHeader(matchedHeader);
      const children = matchedHeader.children || [];
      setMainCategories(children);
      setSelectedMainCatId(preselectedMain);
      setSelectedSubCatId(preselectedSub);
    }
  }, [routeCatParam, allCategoriesTree, headerCategories]);

  // 3. Fetch Products for Active Header Category
  useEffect(() => {
    if (!activeHeader?._id) return;

    let isMounted = true;
    const fetchHeaderProducts = async () => {
      try {
        setIsProductsLoading(true);
        const params = {
          headerId: activeHeader._id,
          limit: 150,
        };
        if (Number.isFinite(currentLocation?.latitude) && Number.isFinite(currentLocation?.longitude)) {
          params.lat = currentLocation.latitude;
          params.lng = currentLocation.longitude;
        }

        const res = await customerApi.getProducts(params);
        if (isMounted) {
          const prods =
            res.data?.result?.products ||
            res.data?.result ||
            res.data?.products ||
            [];
          setProducts(Array.isArray(prods) ? prods : []);
        }
      } catch (err) {
        console.error('Failed to load products for header category:', err);
        if (isMounted) setProducts([]);
      } finally {
        if (isMounted) setIsProductsLoading(false);
      }
    };

    fetchHeaderProducts();
    return () => {
      isMounted = false;
    };
  }, [activeHeader?._id, currentLocation?.latitude, currentLocation?.longitude]);

  // 4. Compute Subcategories
  const availableSubCategories = useMemo(() => {
    if (!mainCategories.length) return [];
    if (selectedMainCatId !== 'all') {
      const selectedMain = mainCategories.find((c) => String(c._id) === String(selectedMainCatId));
      return selectedMain?.children || [];
    }
    // All subcategories under all main categories of this header
    const allSubs = [];
    mainCategories.forEach((mc) => {
      if (Array.isArray(mc.children)) {
        allSubs.push(...mc.children);
      }
    });
    return allSubs;
  }, [mainCategories, selectedMainCatId]);

  // 5. Filter Products by Selected Main Category & Subcategory
  const filteredProducts = useMemo(() => {
    let list = products;

    if (selectedMainCatId !== 'all') {
      const selectedMain = mainCategories.find((c) => String(c._id) === String(selectedMainCatId));
      const subCatIds = (selectedMain?.children || []).map((s) => String(s._id));
      const validIds = new Set([String(selectedMainCatId), ...subCatIds]);

      list = list.filter((p) => {
        const pCat = String(p.categoryId || p.category?._id || '');
        const pSub = String(p.subcategoryId || p.subcategory?._id || '');
        return validIds.has(pCat) || validIds.has(pSub);
      });
    }

    if (selectedSubCatId !== 'all') {
      list = list.filter((p) => {
        const pCat = String(p.categoryId || p.category?._id || '');
        const pSub = String(p.subcategoryId || p.subcategory?._id || '');
        return pSub === String(selectedSubCatId) || pCat === String(selectedSubCatId);
      });
    }

    return list;
  }, [products, selectedMainCatId, selectedSubCatId, mainCategories]);

  // Handlers
  const handleHeaderNavClick = (cat) => {
    if (!cat || cat.id === 'all' || cat._id === 'all' || cat.slug === 'all') {
      navigate('/');
      return;
    }
    const slug = cat.slug || cat._id || cat.name?.toLowerCase().replace(/\s+/g, '-');
    navigate(`/category/${slug}`);
  };

  const handleMainCatClick = (mc) => {
    if (selectedMainCatId === mc._id) {
      // Toggle off to show all
      setSelectedMainCatId('all');
      setSelectedSubCatId('all');
    } else {
      setSelectedMainCatId(mc._id);
      setSelectedSubCatId('all');
    }
  };

  const currentBanner = activeHeader ? getCategoryBanner(activeHeader.name, activeHeader.slug) : null;

  return (
    <div className="min-h-screen bg-[#fafbfc] flex flex-col pb-24 font-sans select-none">
      {/* ── Top Header Bar (Sticky) ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 py-2.5 flex items-center gap-2">
          {/* Back button */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-1 text-slate-800 hover:text-blue-600 rounded-full active:scale-95 transition-transform shrink-0"
            aria-label="Back"
          >
            <ChevronLeft size={22} className="stroke-[2.5]" />
          </button>

          {/* Search bar matching Flipkart/Amazon pattern */}
          <div
            onClick={() => navigate('/search')}
            className="flex-1 h-10 bg-slate-50 border border-slate-200/90 rounded-full px-3.5 flex items-center gap-2 cursor-pointer hover:border-slate-300 transition-colors shadow-2xs"
          >
            <Search size={16} className="text-slate-400 shrink-0" />
            <span className="text-[13px] text-slate-400 font-medium truncate">
              Search for products, categories, subcategories...
            </span>
          </div>

          {/* Cart Icon with Counter Badge */}
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="relative p-2 text-slate-800 hover:text-blue-600 active:scale-95 transition-transform shrink-0"
            aria-label="Cart"
          >
            <ShoppingCart size={22} className="stroke-[2.2]" />
            {cartCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] rounded-full bg-[#2874f0] text-white text-[10px] font-black flex items-center justify-center px-1 shadow-2xs animate-pulse">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Header Categories Navigation Tabs ── */}
        <div className="w-full overflow-x-auto no-scrollbar border-t border-slate-100 bg-white px-2 py-1.5 flex items-center gap-1.5">
          {/* "All" button returns to Home */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:text-slate-900 shrink-0 hover:bg-slate-100 transition-colors"
          >
            All
          </button>

          {headerCategories.map((hCat) => {
            const isActive = String(activeHeader?._id || '') === String(hCat._id || '');
            return (
              <button
                key={hCat._id}
                type="button"
                onClick={() => handleHeaderNavClick(hCat)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all active:scale-95',
                  isActive
                    ? 'bg-[#2874f0] text-white shadow-2xs'
                    : 'text-slate-700 bg-slate-50 hover:bg-slate-100'
                )}
              >
                {hCat.name}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="max-w-7xl mx-auto w-full flex-1">
        {isLoading ? (
          <div className="p-4 space-y-4">
            <div className="h-44 bg-slate-200 animate-pulse rounded-2xl" />
            <div className="h-32 bg-slate-200 animate-pulse rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-square bg-slate-200 animate-pulse rounded-2xl" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── 1. ALL MAIN CATEGORIES CARD (4 COLUMNS GRID) ── */}
            {mainCategories.length > 0 && (
              <section className="mx-3 mt-3 bg-white rounded-2xl p-3.5 border border-slate-100/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <div className="grid grid-cols-4 gap-y-3.5 gap-x-2">
                  {mainCategories.map((mc) => {
                    const isSelected = String(selectedMainCatId) === String(mc._id);
                    const imageSrc = mc.image || mc.icon || 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png';

                    return (
                      <button
                        key={mc._id}
                        type="button"
                        onClick={() => handleMainCatClick(mc)}
                        className="group flex flex-col items-center text-center cursor-pointer select-none active:scale-95 transition-transform"
                      >
                        {/* Rounded square tile */}
                        <div
                          className={cn(
                            'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center p-2 transition-all duration-200',
                            isSelected
                              ? 'bg-purple-100 border-2 border-purple-600 shadow-xs ring-2 ring-purple-300/40'
                              : 'bg-[#f4effe] border border-[#ebe4fb] group-hover:bg-[#eee8fc]'
                          )}
                        >
                          <img
                            src={applyCloudinaryTransform(imageSrc, 'f_auto,q_auto,w_120')}
                            alt={mc.name}
                            loading="lazy"
                            className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>

                        {/* Category Name */}
                        <span
                          className={cn(
                            'mt-1.5 text-[10.5px] sm:text-[11.5px] leading-tight font-bold line-clamp-2 max-w-[72px]',
                            isSelected ? 'text-purple-700 font-extrabold' : 'text-slate-800'
                          )}
                        >
                          {mc.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── 2. PROMOTIONAL BANNER ── */}
            {currentBanner && (
              <div className="mx-3 mt-3.5 rounded-2xl overflow-hidden shadow-2xs border border-slate-100">
                <img
                  src={currentBanner}
                  alt={activeHeader?.name || 'Category Offer Banner'}
                  className="w-full h-auto object-cover max-h-[160px] sm:max-h-[220px]"
                  loading="lazy"
                />
              </div>
            )}

            {/* ── 3. ALL SUB CATEGORIES (HORIZONTAL PILLS) ── */}
            {availableSubCategories.length > 0 && (
              <section className="mt-3 px-3">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  {/* "All" Subcategory Pill */}
                  <button
                    type="button"
                    onClick={() => setSelectedSubCatId('all')}
                    className={cn(
                      'px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all active:scale-95',
                      selectedSubCatId === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    All ({products.length})
                  </button>

                  {/* Subcategory Pills */}
                  {availableSubCategories.map((sub) => {
                    const isSubSelected = String(selectedSubCatId) === String(sub._id);
                    return (
                      <button
                        key={sub._id}
                        type="button"
                        onClick={() => setSelectedSubCatId(sub._id)}
                        className={cn(
                          'px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all active:scale-95',
                          isSubSelected
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        {sub.image && (
                          <img
                            src={applyCloudinaryTransform(sub.image, 'f_auto,q_auto,w_40')}
                            alt=""
                            className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                          />
                        )}
                        <span>{sub.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── 4. RECOMMENDED ITEMS SECTION TITLE ── */}
            <div className="px-4 pt-5 pb-2">
              <h2 className="text-[20px] font-black text-slate-900 tracking-tight leading-none">
                Recommended Items
              </h2>
              <p className="text-[13px] font-medium text-slate-500 mt-1">
                According to Your interest
              </p>
            </div>

            {/* ── 5. ALL PRODUCTS (2 IN ONE ROW GRID) ── */}
            {isProductsLoading ? (
              <div className="grid grid-cols-2 gap-3 px-3 pb-20">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex flex-col space-y-2">
                    <div className="aspect-[4/4.5] bg-slate-200 animate-pulse rounded-2xl" />
                    <div className="h-3.5 bg-slate-200 animate-pulse rounded-md w-3/4" />
                    <div className="h-4 bg-slate-200 animate-pulse rounded-md w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="mx-3 my-8 p-8 bg-white rounded-2xl border border-slate-100 text-center flex flex-col items-center justify-center">
                <ImageOff size={40} className="text-slate-300 mb-2" />
                <h3 className="text-base font-bold text-slate-800">No Products Available</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  We couldn't find any products in this specific category selection.
                </p>
                {(selectedMainCatId !== 'all' || selectedSubCatId !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMainCatId('all');
                      setSelectedSubCatId('all');
                    }}
                    className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-full shadow-xs active:scale-95 transition-transform flex items-center gap-1.5"
                  >
                    <RotateCcw size={13} />
                    <span>View All Category Products</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 px-3 pb-24">
                {filteredProducts.map((product) => {
                  const id = product.id || product._id;
                  const originalPrice = Number(product.price ?? product.originalPrice) || 0;
                  const currentPrice = Number(product.salePrice ?? product.price) || 0;
                  const hasDiscount = originalPrice > currentPrice && currentPrice > 0;
                  const discountPercent = hasDiscount
                    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
                    : 0;
                  const image =
                    product.mainImage ||
                    product.image ||
                    product.variants?.[0]?.images?.[0];
                  const isWish = isInWishlist(id);
                  const rating =
                    Number(product.rating) > 0 ? Number(product.rating).toFixed(1) : '5.0';

                  return (
                    <div
                      key={id}
                      onClick={() => openProduct(product)}
                      className="group flex flex-col cursor-pointer active:scale-[0.99] transition-transform select-none min-w-0"
                    >
                      {/* Product Card Image Box - Matching Reference Screenshot */}
                      <div className="customer-product-clean-image relative aspect-[4/4.5] w-full rounded-2xl bg-[#f1f3f6] border border-[#e0e3e8] flex items-center justify-center p-0 overflow-hidden shadow-2xs transition-colors">
                        {/* Rating Pill on Bottom-Left */}
                        <div className="absolute bottom-2 left-2 z-10 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs border border-slate-200/50">
                          <span className="text-[11px] font-bold text-slate-800 leading-none">
                            {rating}
                          </span>
                          <Star size={11} className="fill-emerald-600 text-emerald-600" />
                        </div>

                        {/* Wishlist Heart on Top-Right */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWishlist(product);
                          }}
                          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/90 backdrop-blur-xs text-slate-700 hover:text-red-500 active:scale-90 transition-transform shadow-2xs border-0"
                          aria-label="Wishlist"
                        >
                          <Heart
                            size={14}
                            className={cn(isWish ? 'fill-red-500 text-red-500' : 'text-slate-600')}
                          />
                        </button>

                        {/* Centered Product Image */}
                        {image ? (
                          <img
                            src={applyCloudinaryTransform(image, 'f_auto,q_auto,w_400')}
                            alt={product.name}
                            loading="lazy"
                            className={cn(
                              "w-full h-full transition-transform duration-300 group-hover:scale-105",
                              isPngImage(image)
                                ? "is-png-image object-contain p-1"
                                : "is-normal-image object-cover p-0"
                            )}
                          />
                        ) : (
                          <ImageOff size={28} className="text-slate-300" />
                        )}
                      </div>

                      {/* Product Title */}
                      <h3 className="mt-1.5 px-0.5 truncate text-[13.5px] font-semibold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </h3>

                      {/* Price Row: Strikethrough MRP -> Current Price -> Green Discount % */}
                      <div className="mt-0.5 px-0.5 flex items-baseline gap-1.5 leading-tight flex-wrap">
                        {hasDiscount && (
                          <span className="text-[12px] text-slate-400 line-through font-normal">
                            {formatPrice(originalPrice)}
                          </span>
                        )}
                        <span className="text-[14px] font-bold text-slate-900">
                          {formatPrice(currentPrice)}
                        </span>
                        {hasDiscount && (
                          <span className="text-[11.5px] font-bold text-emerald-600">
                            {discountPercent}% OFF
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      <MiniCart />
      <ProductDetailSheet />
    </div>
  );
};

export default CategoryProductsPage;
