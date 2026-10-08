import { useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Sun, ChevronLeft, ChevronRight } from 'lucide-react';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { slugify } from '@/core/utils/productUrl';

const AllCategoriesGreeting = ({ categories, firstName, greetingConfig }) => {
  const scrollRef = useRef(null);

  // If section is explicitly disabled by admin in CMS
  if (greetingConfig?.enabled === false) {
    return null;
  }

  // Determine categories to display
  const displayCategories = useMemo(() => {
    if (Array.isArray(greetingConfig?.categoryIds) && greetingConfig.categoryIds.length > 0) {
      return greetingConfig.categoryIds
        .filter(Boolean)
        .map((cat) => ({
          id: cat._id || cat.id,
          _id: cat._id || cat.id,
          name: cat.name || '',
          image: cat.image || cat.icon || '',
          slug: cat.slug || '',
          rawCategory: cat,
        }));
    }
    return categories || [];
  }, [greetingConfig?.categoryIds, categories]);

  if (!displayCategories || !displayCategories.length) return null;

  const scrollByAmount = (direction) => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    });
  };

  // Section Styles
  const sectionBg = greetingConfig?.bgColor?.trim() || 'linear-gradient(135deg, #ffe078 0%, #ffeb9c 50%, #fff2bc 100%)';
  const headingColor = greetingConfig?.titleColor?.trim() || '#242424';
  const rawTitle = greetingConfig?.title?.trim() || 'Good Afternoon, {name}! ☀️';
  const resolvedTitle = rawTitle.replace(/\{name\}/gi, firstName || 'Friend');

  // Card Styles matching "Furnishing deals" layout
  const cardBgColor = greetingConfig?.cardBgColor?.trim() || '#ffffff';
  const cardNameBgColor = greetingConfig?.cardNameBgColor?.trim() || '#2563eb';
  const cardNameTextColor = greetingConfig?.cardNameTextColor?.trim() || '#FFFFFF';

  return (
    <section
      className="w-full my-3 sm:my-4 py-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] relative select-none transition-all duration-300"
      style={{ background: sectionBg }}
      aria-label="Browse categories"
    >
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex items-center justify-between px-4 sm:px-6">
          <h2
            className="flex items-center gap-2 text-[19px] sm:text-[21px] font-bold leading-tight tracking-tight drop-shadow-xs"
            style={{ color: headingColor }}
          >
            <span>{resolvedTitle}</span>
            {resolvedTitle.toLowerCase().includes('sun') || resolvedTitle.includes('☀️') ? null : (
              <Sun size={24} className="shrink-0 text-[#f59e0b]" fill="#facc15" strokeWidth={1.8} aria-hidden="true" />
            )}
          </h2>

          {/* Desktop scroll arrows */}
          <div className="hidden md:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollByAmount('left')}
              className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-xs flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
              aria-label="Scroll left"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount('right')}
              className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-xs flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
              aria-label="Scroll right"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Horizontal Carousel of Category Cards matching Furnishing Deals layout */}
        <div
          ref={scrollRef}
          className="mt-4 flex snap-x snap-proximity gap-3 sm:gap-3.5 overflow-x-auto px-4 sm:px-6 pb-2 no-scrollbar scroll-smooth"
          aria-label="Main categories"
        >
          {displayCategories.map((category, idx) => {
            const rawCat = category.rawCategory || category;
            const isSub = rawCat.type === 'subcategory' || Boolean(rawCat.parentId && typeof rawCat.parentId === 'object' && rawCat.parentId.parentId);
            const isMain = rawCat.type === 'category' || Boolean(rawCat.parentId && typeof rawCat.parentId === 'object');

            let targetUrl = `/category/${category.slug || category.id || category._id}`;
            let navState = null;

            if (isSub) {
              const subCat = rawCat;
              const mainCat = typeof subCat.parentId === 'object' ? subCat.parentId : null;
              const headerCat = mainCat && typeof mainCat.parentId === 'object' ? mainCat.parentId : null;
              const hSlug = headerCat?.slug || slugify(headerCat?.name || '');
              const mSlug = mainCat?.slug || slugify(mainCat?.name || '');
              const sSlug = subCat.slug || slugify(subCat.name || category.name || '');
              if (hSlug && mSlug) {
                targetUrl = `/category/${hSlug}/${mSlug}?sub=${sSlug}`;
                navState = {
                  activeSubcategoryId: subCat._id || subCat.id || category.id,
                  subCategorySlug: sSlug,
                  subCategoryName: subCat.name || category.name,
                  activeMainCategoryId: mainCat._id || mainCat.id,
                  mainCategorySlug: mSlug,
                  mainCategoryName: mainCat.name,
                  headerSlug: hSlug,
                  headerName: headerCat?.name,
                };
              }
            } else if (isMain) {
              const mainCat = rawCat;
              const headerCat = typeof mainCat.parentId === 'object' ? mainCat.parentId : null;
              const hSlug = headerCat?.slug || slugify(headerCat?.name || '');
              const mSlug = mainCat.slug || slugify(mainCat.name || category.name || '');
              if (hSlug && mSlug) {
                targetUrl = `/category/${hSlug}/${mSlug}`;
                navState = {
                  activeMainCategoryId: mainCat._id || mainCat.id || category.id,
                  mainCategorySlug: mSlug,
                  mainCategoryName: mainCat.name || category.name,
                  headerSlug: hSlug,
                  headerName: headerCat?.name,
                };
              }
            }

            return (
              <Link
                key={category.id || category._id || idx}
                to={targetUrl}
                state={navState}
                className="group flex w-[114px] sm:w-[124px] md:w-[132px] shrink-0 snap-start flex-col rounded-2xl overflow-hidden shadow-[0_3px_12px_rgba(0,0,0,0.08)] border border-black/5 transition-all duration-200 active:scale-95 hover:shadow-md"
                style={{ backgroundColor: cardBgColor }}
              >
              {/* 1. Top Image Box */}
              <div
                className="relative aspect-square w-full flex items-center justify-center p-2 sm:p-2.5 overflow-hidden transition-colors"
                style={{ backgroundColor: cardBgColor }}
              >
                {category.image ? (
                  <img
                    src={applyCloudinaryTransform(category.image, 'f_auto,q_auto,w_300')}
                    alt={category.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <ShoppingBag size={32} className="text-slate-400" aria-hidden="true" />
                )}
              </div>

              {/* 2. Bottom Colored Strip with Category Name matching Furnishing deals image */}
              <div
                className="w-full py-2 px-1.5 flex items-center justify-center text-center transition-colors min-h-[34px] sm:min-h-[36px]"
                style={{ backgroundColor: cardNameBgColor }}
              >
                <span
                  className="line-clamp-1 text-center text-[12px] sm:text-[13px] font-bold tracking-tight leading-tight w-full drop-shadow-xs"
                  style={{ color: cardNameTextColor }}
                >
                  {category.name}
                </span>
              </div>
            </Link>
          );
        })}
        </div>
      </div>
    </section>
  );
};

export default AllCategoriesGreeting;
