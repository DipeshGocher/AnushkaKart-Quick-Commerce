import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  ShoppingCart,
  Store,
  CheckCircle2,
  MapPin,
  ChevronDown,
  Loader2,
  PackageX,
  X,
} from "lucide-react";
import axiosInstance from "@core/api/axios";
import ProductCard from "../components/shared/ProductCard";
import { useCart } from "../context/CartContext";

const PAGE_LIMIT = 30;

export default function StorePage() {
  const { sellerId: rawIdentifier } = useParams();
  const navigate = useNavigate();
  const { cartCount } = useCart();

  const [seller, setSeller] = useState(null);
  const [loadingSeller, setLoadingSeller] = useState(true);

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

  // 1. Fetch Seller Store Profile (by slug or ObjectId)
  useEffect(() => {
    let isMounted = true;
    async function fetchSellerStore() {
      setLoadingSeller(true);
      try {
        const identifier = rawIdentifier || "default";
        const res = await axiosInstance.get(`/seller/store/${identifier}`);
        const sellerData = res.data?.result || res.data?.data || res.data || null;
        if (isMounted) {
          setSeller(sellerData);
        }
      } catch (err) {
        console.error("Failed to fetch seller store details:", err);
      } finally {
        if (isMounted) {
          setLoadingSeller(false);
        }
      }
    }
    fetchSellerStore();
    return () => {
      isMounted = false;
    };
  }, [rawIdentifier]);

  // 2. Fetch Products for Seller once seller is resolved
  const resolvedSellerId = useMemo(() => {
    return (
      seller?._id ||
      (/^[0-9a-fA-F]{24}$/.test(rawIdentifier || "") ? rawIdentifier : null)
    );
  }, [seller, rawIdentifier]);

  const fetchProducts = useCallback(
    async (pageNum = 1, append = false) => {
      if (!resolvedSellerId) {
        setLoadingProducts(false);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingProducts(true);
      }

      try {
        const res = await axiosInstance.get("/products", {
          params: {
            sellerId: resolvedSellerId,
            page: pageNum,
            limit: PAGE_LIMIT,
            sort: "newest",
          },
        });

        const resData = res.data?.result || res.data?.data || res.data || {};
        // Backend returns items in `items` or `products`
        const items = Array.isArray(resData.items)
          ? resData.items
          : Array.isArray(resData.products)
          ? resData.products
          : Array.isArray(resData)
          ? resData
          : [];
        const totalCount =
          resData.total ?? resData.pagination?.total ?? items.length;

        if (append) {
          setProducts((prev) => [...prev, ...items]);
        } else {
          setProducts(items);
        }
        setTotal(totalCount);
        setPage(pageNum);
      } catch (err) {
        console.error("Failed to fetch seller products:", err);
      } finally {
        setLoadingProducts(false);
        setLoadingMore(false);
      }
    },
    [resolvedSellerId]
  );

  useEffect(() => {
    if (resolvedSellerId) {
      fetchProducts(1, false);
    } else if (!loadingSeller) {
      setLoadingProducts(false);
    }
  }, [resolvedSellerId, loadingSeller, fetchProducts]);

  // Handle "View more" button click
  const handleLoadMore = () => {
    if (loadingMore || products.length >= total) return;
    fetchProducts(page + 1, true);
  };

  // Valid banners from seller
  const banners = useMemo(() => {
    if (!seller?.storeBanners || !Array.isArray(seller.storeBanners)) return [];
    return seller.storeBanners.filter(
      (b) => b && b.imageUrl && b.imageUrl.trim()
    );
  }, [seller]);

  // Autoplay slider when multiple banners exist
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIdx((prev) => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [banners.length]);

  // Filtered products by in-store search
  const displayedProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(query) ||
        p.brand?.toLowerCase().includes(query) ||
        p.categoryName?.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const hasMore = products.length < total;

  return (
    <div className="min-h-screen bg-[#F1F3F6] pb-24 font-outfit">
      {/* ── STICKY TOP APP BAR (Flipkart style) ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate("/");
                }
              }}
              aria-label="Back"
              className="p-1 -ml-1 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {seller?.shopName
                  ? `${seller.shopName} Store`
                  : loadingSeller
                  ? "Loading Store..."
                  : "Seller Store"}
              </h1>
              {seller?.city && (
                <p className="text-[11px] text-slate-500 truncate flex items-center gap-0.5">
                  <MapPin size={10} className="shrink-0 text-slate-400" />
                  <span>{seller.city}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen((prev) => !prev)}
              aria-label="Search Store"
              className="p-2 text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
            >
              <Search size={18} />
            </button>
            <Link
              to="/cart"
              aria-label="Cart"
              className="p-2 text-slate-700 hover:bg-slate-100 rounded-full transition-colors relative"
            >
              <ShoppingCart size={19} />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 bg-[#FF3E6C] text-white font-bold text-[9px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center leading-none shadow-xs">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Collapsible Store Search Bar */}
        {searchOpen && (
          <div className="px-3 pb-2.5 pt-1 bg-white border-t border-slate-100 flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                autoFocus
                placeholder={`Search in ${seller?.shopName || "store"}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-100 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchOpen(false);
              }}
              className="text-xs font-semibold text-slate-600 px-2 py-1"
            >
              Cancel
            </button>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto">
        {/* ── STORE IDENTITY HERO CARD (Flipkart boAt Style) ── */}
        <section className="bg-white px-4 py-3.5 border-b border-slate-200/80 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-xs shrink-0">
              {seller?.shopName ? (
                seller.shopName[0].toUpperCase()
              ) : (
                <Store size={22} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  {seller?.shopName || (loadingSeller ? "Loading..." : "Seller Store")}
                </h2>
                {seller?.isVerified && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded">
                    <CheckCircle2 size={11} /> Verified Seller
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {seller?.category ? `${seller.category} • ` : ""}
                Official Seller on Anushka Connect
              </p>
            </div>
          </div>
        </section>

        {/* ── STORE BANNERS (0 to 3) ── */}
        {/* If 0 banners: render nothing, consumes zero space */}
        {banners.length > 0 && (
          <section className="mb-2 px-2 sm:px-4">
            {banners.length === 1 ? (
              // 1 Banner: single prominent showcase
              <div className="relative w-full rounded-xl overflow-hidden bg-slate-200 shadow-xs aspect-[21/9] sm:aspect-[24/7]">
                {banners[0].linkUrl ? (
                  <Link
                    to={banners[0].linkUrl}
                    className="block w-full h-full"
                  >
                    <img
                      src={banners[0].imageUrl}
                      alt={
                        banners[0].title || seller?.shopName || "Store Banner"
                      }
                      className="w-full h-full object-cover"
                    />
                  </Link>
                ) : (
                  <img
                    src={banners[0].imageUrl}
                    alt={
                      banners[0].title || seller?.shopName || "Store Banner"
                    }
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            ) : (
              // 2 or 3 Banners: carousel slider with indicator dots
              <div className="relative w-full rounded-xl overflow-hidden bg-slate-200 shadow-xs aspect-[21/9] sm:aspect-[24/7] group">
                {banners.map((banner, idx) => {
                  const isActive = idx === activeBannerIdx;
                  return (
                    <div
                      key={idx}
                      className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
                        isActive
                          ? "opacity-100 z-10"
                          : "opacity-0 z-0 pointer-events-none"
                      }`}
                    >
                      {banner.linkUrl ? (
                        <Link
                          to={banner.linkUrl}
                          className="block w-full h-full"
                        >
                          <img
                            src={banner.imageUrl}
                            alt={banner.title || `Banner ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </Link>
                      ) : (
                        <img
                          src={banner.imageUrl}
                          alt={banner.title || `Banner ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  );
                })}

                {/* Dot indicators */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-black/30 backdrop-blur-xs px-2 py-1 rounded-full">
                  {banners.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveBannerIdx(idx)}
                      aria-label={`Go to banner ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === activeBannerIdx
                          ? "w-4 bg-white"
                          : "w-1.5 bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── PRODUCTS SECTION ── */}
        <section className="bg-white rounded-t-xl sm:rounded-xl mx-0 sm:mx-4 border-t sm:border border-slate-200/80 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              {searchQuery
                ? `Search results for "${searchQuery}"`
                : "All Products"}
            </h3>
            <span className="text-xs font-semibold text-slate-500">
              {total} {total === 1 ? "Product" : "Products"}
            </span>
          </div>

          {/* Loading state for initial load */}
          {loadingProducts || loadingSeller ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 py-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="bg-slate-100 animate-pulse rounded-xl aspect-[0.7] w-full"
                />
              ))}
            </div>
          ) : displayedProducts.length === 0 ? (
            // Empty state
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                <PackageX size={32} />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                No products found
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                {searchQuery
                  ? "No items match your search. Try different keywords."
                  : "This seller hasn't added any products to their store yet."}
              </p>
            </div>
          ) : (
            <>
              {/* 2 Products in one row (Grid) */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {displayedProducts.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>

              {/* ── FLIPKART STYLE "VIEW MORE" BUTTON ── */}
              {hasMore && !searchQuery && (
                <div className="py-6 px-2 flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full max-w-sm py-2.5 px-6 bg-[#FFC200] hover:bg-[#e6b000] active:scale-[0.99] text-slate-900 font-bold text-xs sm:text-sm rounded-lg shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-70"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2
                          size={16}
                          className="animate-spin text-slate-900"
                        />
                        <span>Loading more products...</span>
                      </>
                    ) : (
                      <>
                        <span>View more</span>
                        <ChevronDown size={16} className="text-slate-900" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
