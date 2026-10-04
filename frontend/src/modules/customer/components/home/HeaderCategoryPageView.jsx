import React, { useState, useEffect, useMemo } from 'react';
import { Star, Heart, ImageOff, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform, isPngImage } from '@/core/utils/imageUtils';
import { customerApi } from '../../services/customerApi';
import { useWishlist } from '../../context/WishlistContext';
import { useProductDetail } from '../../context/ProductDetailContext';

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
  return groceryBannerImg;
};

const formatPrice = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const HeaderCategoryPageView = ({
  headerCategory,
  categoryMap = {},
  subcategoryMap = {},
  currentLocation,
}) => {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { openProduct } = useProductDetail();

  const [selectedMainCatId, setSelectedMainCatId] = useState('all');
  const [selectedSubCatId, setSelectedSubCatId] = useState('all');
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const headerId = String(headerCategory?._id || headerCategory?.id || '');

  // Reset filter when header category changes
  useEffect(() => {
    setSelectedMainCatId('all');
    setSelectedSubCatId('all');
  }, [headerId]);

  // 1. All Main Categories for this Header (Level 1)
  const mainCategories = useMemo(() => {
    if (!headerId) return [];
    return Object.values(categoryMap)
      .filter(
        (c) =>
          c.type === 'category' &&
          String(c.parentId?._id || c.parentId || c.headerId?._id || c.headerId) === headerId
      )
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.name.localeCompare(b.name));
  }, [categoryMap, headerId]);

  // 2. Sub Categories for this Header / Selected Main Category (Level 2)
  const subCategories = useMemo(() => {
    if (!headerId) return [];
    if (selectedMainCatId !== 'all') {
      return Object.values(subcategoryMap)
        .filter((s) => String(s.parentId?._id || s.parentId) === String(selectedMainCatId))
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.name.localeCompare(b.name));
    }
    const mainIds = new Set(mainCategories.map((m) => String(m._id || m.id)));
    return Object.values(subcategoryMap)
      .filter((s) => mainIds.has(String(s.parentId?._id || s.parentId)))
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.name.localeCompare(b.name));
  }, [subcategoryMap, mainCategories, selectedMainCatId, headerId]);

  // 3. Fetch all products of this header category
  useEffect(() => {
    if (!headerId) return;
    let isMounted = true;

    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const params = { headerId, limit: 120 };
        if (
          Number.isFinite(currentLocation?.latitude) &&
          Number.isFinite(currentLocation?.longitude)
        ) {
          params.lat = currentLocation.latitude;
          params.lng = currentLocation.longitude;
        }

        const res = await customerApi.getProducts(params);
        if (isMounted) {
          const prods =
            res.data?.result?.products ||
            res.data?.result?.items ||
            res.data?.result ||
            res.data?.products ||
            [];
          setProducts(Array.isArray(prods) ? prods : []);
        }
      } catch (err) {
        console.error('Failed to load category products:', err);
        if (isMounted) setProducts([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchProducts();
    return () => {
      isMounted = false;
    };
  }, [headerId, currentLocation?.latitude, currentLocation?.longitude]);

  // 4. Filter products by selected main category & subcategory
  const filteredProducts = useMemo(() => {
    let list = products;

    if (selectedSubCatId !== 'all') {
      return list.filter(
        (p) =>
          String(p.subcategoryId?._id || p.subcategoryId) === String(selectedSubCatId) ||
          String(p.categoryId?._id || p.categoryId) === String(selectedSubCatId)
      );
    }

    if (selectedMainCatId !== 'all') {
      const subIds = new Set(
        Object.values(subcategoryMap)
          .filter((s) => String(s.parentId?._id || s.parentId) === String(selectedMainCatId))
          .map((s) => String(s._id || s.id))
      );
      return list.filter(
        (p) =>
          String(p.categoryId?._id || p.categoryId) === String(selectedMainCatId) ||
          subIds.has(String(p.subcategoryId?._id || p.subcategoryId))
      );
    }

    return list;
  }, [products, selectedMainCatId, selectedSubCatId, subcategoryMap]);

  // Toggle main category selection
  const handleMainCatClick = (mcId) => {
    if (selectedMainCatId === mcId) {
      setSelectedMainCatId('all');
      setSelectedSubCatId('all');
    } else {
      setSelectedMainCatId(mcId);
      setSelectedSubCatId('all');
    }
  };

  // Toggle subcategory selection
  const handleSubCatClick = (subId) => {
    if (selectedSubCatId === subId) {
      setSelectedSubCatId('all');
    } else {
      setSelectedSubCatId(subId);
    }
  };

  const bannerImg = getCategoryBanner(headerCategory?.name, headerCategory?.slug);

  return (
    <div className="w-full flex flex-col pb-20 select-none animate-in fade-in duration-300">
      {/* ── 1. ALL MAIN CATEGORIES (4 IN ONE ROW) ── */}
      {mainCategories.length > 0 && (
        <section className="mx-3 mt-3 bg-white rounded-2xl p-3.5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="grid grid-cols-4 gap-y-3.5 gap-x-2">
            {mainCategories.map((mc) => {
              const mcId = mc._id || mc.id;
              const isSelected = String(selectedMainCatId) === String(mcId);
              const imageSrc =
                mc.image || mc.icon || 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png';

              return (
                <button
                  key={mcId}
                  type="button"
                  onClick={() => handleMainCatClick(mcId)}
                  className="group flex flex-col items-center text-center cursor-pointer select-none active:scale-95 transition-transform"
                >
                  {/* Rounded square tile with light sky blue inner background */}
                  <div
                    className={cn(
                      'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center p-2 transition-all duration-200',
                      isSelected
                        ? 'bg-sky-200 border-2 border-sky-600 shadow-xs ring-2 ring-sky-300/50'
                        : 'bg-[#e0f2fe] border border-[#bae6fd] hover:bg-[#d0ecfd]'
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
                      isSelected ? 'text-sky-700 font-extrabold' : 'text-slate-800'
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

      {/* ── 2. BANNER ── */}
      {bannerImg && (
        <div className="mx-3 mt-3.5 rounded-2xl overflow-hidden shadow-2xs border border-slate-100">
          <img
            src={bannerImg}
            alt={headerCategory?.name || 'Category Offer Banner'}
            className="w-full h-auto object-cover max-h-[160px] sm:max-h-[220px]"
            loading="lazy"
          />
        </div>
      )}

      {/* ── 3. SUB CATEGORIES (4 IN ONE ROW) ── */}
      {subCategories.length > 0 && (
        <section className="mx-3 mt-3 bg-white rounded-2xl p-3.5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="grid grid-cols-4 gap-y-3.5 gap-x-2">
            {subCategories.map((sub) => {
              const subId = sub._id || sub.id;
              const isSelected = String(selectedSubCatId) === String(subId);
              const imageSrc =
                sub.image || sub.icon || 'https://cdn-icons-png.flaticon.com/128/2321/2321801.png';

              return (
                <button
                  key={subId}
                  type="button"
                  onClick={() => handleSubCatClick(subId)}
                  className="group flex flex-col items-center text-center cursor-pointer select-none active:scale-95 transition-transform"
                >
                  {/* Rounded square tile with light sky blue inner background */}
                  <div
                    className={cn(
                      'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center p-2 transition-all duration-200',
                      isSelected
                        ? 'bg-sky-200 border-2 border-sky-600 shadow-xs ring-2 ring-sky-300/50'
                        : 'bg-[#e0f2fe] border border-[#bae6fd] hover:bg-[#d0ecfd]'
                    )}
                  >
                    <img
                      src={applyCloudinaryTransform(imageSrc, 'f_auto,q_auto,w_120')}
                      alt={sub.name}
                      loading="lazy"
                      className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>

                  {/* Subcategory Name */}
                  <span
                    className={cn(
                      'mt-1.5 text-[10.5px] sm:text-[11.5px] leading-tight font-bold line-clamp-2 max-w-[72px]',
                      isSelected ? 'text-sky-700 font-extrabold' : 'text-slate-800'
                    )}
                  >
                    {sub.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 4. RECOMMENDED ITEMS TEXT (EXACT LIKE GIVEN IMAGE) ── */}
      <div className="px-4 pt-5 pb-2">
        <h2 className="text-[20px] font-black text-slate-900 tracking-tight leading-none">
          Recommended Items
        </h2>
        <p className="text-[13px] font-medium text-slate-500 mt-1">
          According to Your interest
        </p>
      </div>

      {/* ── 5. ALL PRODUCTS OF CATEGORY (2 IN ONE ROW) ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 px-3 pb-16">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col space-y-2">
              <div className="aspect-[4/4.5] bg-slate-200 animate-pulse rounded-2xl" />
              <div className="h-3.5 bg-slate-200 animate-pulse rounded-md w-3/4" />
              <div className="h-4 bg-slate-200 animate-pulse rounded-md w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="mx-3 my-6 p-8 bg-white rounded-2xl border border-slate-100 text-center flex flex-col items-center justify-center">
          <ImageOff size={38} className="text-slate-300 mb-2" />
          <h3 className="text-base font-bold text-slate-800">No Products Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            No products available for the selected category filters.
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
              <span>Reset & View All {headerCategory?.name} Products</span>
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
    </div>
  );
};

export default HeaderCategoryPageView;
