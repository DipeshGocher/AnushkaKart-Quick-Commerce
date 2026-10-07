import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Sun, ChevronLeft, ChevronRight } from 'lucide-react';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

const AllCategoriesGreeting = ({ categories, firstName }) => {
  const scrollRef = useRef(null);

  if (!categories || !categories.length) return null;

  const scrollByAmount = (direction) => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section className="mx-3.5 sm:mx-4 md:mx-0 mt-4 overflow-hidden rounded-[24px] md:rounded-[28px] bg-gradient-to-br from-[#ffe078] via-[#ffeb9c] to-[#fff2bc] py-5 shadow-[0_8px_22px_rgba(166,117,8,0.12)] relative" aria-label="Browse all main categories">
      <div className="flex items-center justify-between px-5 sm:px-6">
        <h2 className="flex items-center gap-2 text-[19px] sm:text-[21px] font-bold leading-tight tracking-tight text-[#242424]">
          <span>Good Afternoon, {firstName}!</span>
          <Sun size={24} className="shrink-0 text-[#f59e0b]" fill="#facc15" strokeWidth={1.8} aria-label="Sun" />
        </h2>

        {/* Desktop scroll arrows */}
        <div className="hidden md:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollByAmount('left')}
            className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-[#242424] shadow-xs flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
            aria-label="Scroll left"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount('right')}
            className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-[#242424] shadow-xs flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
            aria-label="Scroll right"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="mt-4 flex snap-x snap-proximity gap-3 overflow-x-auto pl-5 sm:pl-6 pr-4 sm:pr-6 pb-2 no-scrollbar scroll-smooth" aria-label="Main categories">
        {categories.map((category, idx) => (
          <Link
            key={category.id}
            to={`/category/${category.id}`}
            className={`group flex w-[105px] sm:w-[110px] md:w-[118px] shrink-0 snap-start flex-col rounded-[18px] bg-white p-2 sm:p-2.5 shadow-[0_3px_12px_rgba(88,68,12,0.1)] transition-transform active:scale-[0.97] hover:shadow-md ${idx === 0 ? 'ml-0.5' : ''}`}
          >
            {/* Big full-cover category image box matching Best Selling Categories style */}
            <div className="relative aspect-square w-full rounded-[14px] overflow-hidden flex items-center justify-center bg-[#eff5ff] border border-[#dbeafe]/70 p-0">
              {category.image ? (
                <img
                  src={applyCloudinaryTransform(category.image, 'f_auto,q_auto,w_300')}
                  alt={category.name}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <ShoppingBag size={32} className="text-[#2875e8]" aria-hidden="true" />
              )}
            </div>
            <span className="mt-2 line-clamp-2 min-h-8 text-center text-[12px] font-bold leading-snug text-[#282828] group-hover:text-primary transition-colors">
              {category.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default AllCategoriesGreeting;
