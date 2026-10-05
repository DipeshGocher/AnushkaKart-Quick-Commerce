import { useEffect, useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ImageOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { customerApi } from '../../services/customerApi';
import { applyCloudinaryTransform, isPngImage } from '@/core/utils/imageUtils';
import { cn } from '@/lib/utils';

const TopDealsOnProducts = () => {
  const [subcategories, setSubcategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef(null);
  const [canScroll, setCanScroll] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchSubcategories = async () => {
      setIsLoading(true);
      try {
        const response = await customerApi.getCategories({ catalogType: 'grocery' });
        const data = response?.data || response;
        const allItems = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.result)
          ? data.result
          : Array.isArray(data?.result?.items)
          ? data.result.items
          : [];

        if (!cancelled) {
          const subs = allItems.filter(
            (c) => c.type === 'subcategory' && c.status !== 'inactive' && c.catalogType !== 'refurbished'
          );

          // Filter subcategories marked as featured in admin panel
          const featured = subs.filter((c) => c.isFeatured === true);

          // If admin has marked subcategories as featured, display all featured ones!
          // Otherwise gracefully fallback to active subcategories (up to 24 with images first)
          if (featured.length > 0) {
            setSubcategories(featured);
          } else {
            const withImages = subs.filter((s) => s.image && typeof s.image === 'string' && s.image.trim() !== '');
            const others = subs.filter((s) => !s.image || typeof s.image !== 'string' || s.image.trim() === '');
            const combined = [...withImages, ...others];
            setSubcategories(combined.slice(0, 24));
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load subcategories for Best Selling Categories:', error);
          setSubcategories([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchSubcategories();
    return () => {
      cancelled = true;
    };
  }, []);

  // Organize subcategories into columns of 2 rows (3 columns visible per swipe screen)
  const columns = useMemo(() => {
    if (!subcategories || subcategories.length === 0) return [];
    const cols = [];
    const chunkSize = 6;
    for (let i = 0; i < subcategories.length; i += chunkSize) {
      const chunk = subcategories.slice(i, i + chunkSize);
      const topRow = chunk.slice(0, 3);
      const bottomRow = chunk.slice(3, 6);
      const numCols = Math.max(topRow.length, bottomRow.length);
      for (let c = 0; c < numCols; c++) {
        const colItems = [];
        if (topRow[c]) colItems.push(topRow[c]);
        if (bottomRow[c]) colItems.push(bottomRow[c]);
        cols.push(colItems);
      }
    }
    return cols;
  }, [subcategories]);

  // Track horizontal scroll progress to move the pill indicator and show/hide arrows
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 6) {
      setCanScroll(true);
      setScrollProgress(Math.min(1, Math.max(0, scrollLeft / maxScroll)));
    } else {
      setCanScroll(false);
    }
  };

  useEffect(() => {
    handleScroll();
  }, [columns]);

  const scrollByAmount = (direction) => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.85;
    scrollRef.current.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    });
  };

  if (!isLoading && subcategories.length === 0) {
    return null;
  }

  const isMultiScreen = columns.length > 3;

  return (
    <section
      className="relative w-full py-7 px-3.5 sm:px-4 my-2 transition-colors select-none"
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #F8C6C7 14%, #F8C6C7 86%, #ffffff 100%)',
      }}
      aria-label="Best Selling Categories"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Heading & Desktop Scroll Controls */}
        <div className="flex items-center justify-between mb-3.5 px-1">
          <h2 className="text-[17px] sm:text-[19px] font-black tracking-tight text-gray-900">
            Best Selling Categories
          </h2>

          {isMultiScreen && (
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollByAmount('left')}
                className="w-7 h-7 rounded-full bg-white/90 border border-black/5 shadow-xs flex items-center justify-center text-gray-700 hover:bg-white hover:text-black transition-all cursor-pointer"
                aria-label="Scroll left"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => scrollByAmount('right')}
                className="w-7 h-7 rounded-full bg-white/90 border border-black/5 shadow-xs flex items-center justify-center text-gray-700 hover:bg-white hover:text-black transition-all cursor-pointer"
                aria-label="Scroll right"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Loading Skeleton */}
        {isLoading && subcategories.length === 0 ? (
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 px-1" aria-label="Loading categories">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-white flex flex-col items-center min-h-[140px]"
              >
                <div className="aspect-square w-full animate-pulse rounded-xl bg-slate-100" />
                <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-200 mt-2.5" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Horizontal Swipeable Columns (2 rows of 3 categories per screen) */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className={cn(
                'w-full no-scrollbar pb-1 px-1',
                isMultiScreen
                  ? 'overflow-x-auto scroll-smooth snap-x snap-mandatory flex gap-2.5 sm:gap-3'
                  : 'grid grid-cols-3 gap-2.5 sm:gap-3'
              )}
            >
              {columns.map((col, colIdx) => (
                <div
                  key={colIdx}
                  className={cn(
                    'flex flex-col gap-2.5 sm:gap-3 justify-start',
                    isMultiScreen
                      ? 'shrink-0 w-[calc((100%-18px)/3.18)] sm:w-[145px] snap-start'
                      : 'w-full'
                  )}
                >
                  {col.map((sub) => {
                    const id = sub._id || sub.id;
                    const image =
                      sub.image && typeof sub.image === 'object'
                        ? sub.image.url || sub.image.secure_url
                        : sub.image;
                    const parentTarget = sub.parentId?._id || sub.parentId || sub.slug || id;

                    return (
                      <Link
                        key={id}
                        to={`/category/${parentTarget}`}
                        state={{ activeSubcategoryId: id }}
                        className="group bg-white rounded-2xl p-2 sm:p-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-white hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-200 active:scale-[0.98] flex flex-col items-center justify-between min-h-[140px] sm:min-h-[160px] w-full"
                      >
                        {/* Big Image box */}
                        <div className="relative aspect-square w-full rounded-xl p-1 flex items-center justify-center overflow-hidden">
                          {image ? (
                            <img
                              src={applyCloudinaryTransform(image, 'f_auto,q_auto,w_300')}
                              alt={sub.name}
                              loading="lazy"
                              className={cn(
                                'h-full w-full object-contain transition-transform duration-300 group-hover:scale-105',
                                isPngImage(image) ? 'p-1' : 'p-0.5'
                              )}
                            />
                          ) : (
                            <ImageOff size={28} className="text-slate-300" aria-hidden="true" />
                          )}
                        </div>

                        {/* Subcategory Name */}
                        <div className="mt-1.5 mb-1 w-full text-center px-0.5">
                          <h3 className="text-[12px] sm:text-[13px] font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-pink-600 transition-colors">
                            {sub.name}
                          </h3>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Scroll Indicator Pill (matching Quick Commerce style) */}
            {canScroll && (
              <div className="w-12 h-1 bg-black/10 rounded-full mx-auto mt-3 overflow-hidden relative">
                <div
                  className="h-full w-5 bg-black/40 rounded-full transition-all duration-75 ease-out"
                  style={{
                    transform: `translateX(${scrollProgress * 28}px)`,
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default TopDealsOnProducts;
