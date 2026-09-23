import React from 'react';
import { ChevronLeft } from 'lucide-react';

const SellSubCategoryStep = ({ category, onSelectSubCategory, onBack }) => {
  const categoryName = category?.name || 'Category';
  const subCategories = category?.subCategories || [];

  return (
    <div className="w-full min-h-screen bg-white flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-4 h-14 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="p-1 -ml-1 text-slate-800 hover:text-slate-900 active:scale-95 transition-transform"
        >
          <ChevronLeft size={28} strokeWidth={2.4} />
        </button>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight flex-1 text-center pr-7">
          {categoryName}
        </h1>
      </header>

      {/* Subcategory List (OLX Style) */}
      <div className="flex-1 divide-y divide-slate-100">
        {subCategories.map((sub) => {
          // Clean display name if needed
          let displayName = sub.name;
          if (sub.id === 'mobiles-smartphones') displayName = 'Mobile Phones';
          if (sub.id === 'mobiles-accessories') displayName = 'Accessories';
          if (sub.id === 'mobiles-tablets') displayName = 'Tablets';

          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => onSelectSubCategory(sub)}
              className="w-full flex items-center gap-4 px-4 py-3.5 text-left bg-white hover:bg-slate-50/80 active:bg-blue-50/40 transition-colors focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center p-1.5 shrink-0 border border-slate-200/60 shadow-sm">
                <img
                  src={sub.image}
                  alt={displayName}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <span className="text-base font-medium text-slate-900 flex-1">
                {displayName}
              </span>
            </button>
          );
        })}

        {subCategories.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No sub-categories available.
          </div>
        )}
      </div>
    </div>
  );
};

export default SellSubCategoryStep;
