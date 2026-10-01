import { Link } from 'react-router-dom';
import { ShoppingBag, Sun } from 'lucide-react';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

const AllCategoriesGreeting = ({ categories, firstName }) => {
  if (!categories.length) return null;

  return (
    <section className="mx-4 mt-4 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#ffe078] via-[#ffeb9c] to-[#fff2bc] py-5 shadow-[0_8px_22px_rgba(166,117,8,0.12)]" aria-label="Browse all main categories">
      <h2 className="flex items-center gap-2 px-4 text-[20px] font-bold leading-tight tracking-tight text-[#242424]">
        <span>Good Afternoon, {firstName}!</span>
        <Sun size={24} className="shrink-0 text-[#f59e0b]" fill="#facc15" strokeWidth={1.8} aria-label="Sun" />
      </h2>

      <div className="mt-4 flex snap-x snap-proximity gap-3 overflow-x-auto px-4 pb-1 no-scrollbar" aria-label="Main categories">
        {categories.map((category) => (
          <Link
            key={category.id}
            to={`/category/${category.id}`}
            className="flex w-[108px] shrink-0 snap-start flex-col rounded-[18px] bg-white p-2.5 shadow-[0_3px_12px_rgba(88,68,12,0.1)] transition-transform active:scale-[0.97]"
          >
            <span className="flex h-[84px] w-full items-center justify-center overflow-hidden rounded-[13px] bg-[#f4f7ff]">
              {category.image ? (
                <img
                  src={applyCloudinaryTransform(category.image, 'f_auto,q_auto,w_240')}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              ) : (
                <ShoppingBag size={32} className="text-[#2875e8]" aria-hidden="true" />
              )}
            </span>
            <span className="mt-2 line-clamp-2 min-h-8 text-center text-[11px] font-semibold leading-[1.2] text-[#282828]">
              {category.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default AllCategoriesGreeting;
