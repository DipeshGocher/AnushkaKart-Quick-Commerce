import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { C2C_CATEGORIES } from '../../../data/c2cMockData';

// High-fidelity isolated icons/images for the electronics categories matching the OLX style in image 1
const CATEGORY_DISPLAY_DATA = {
  mobiles: {
    label: 'Mobiles',
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=300&auto=format&fit=crop&q=80',
  },
  laptops: {
    label: 'Laptops',
    image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=300&auto=format&fit=crop&q=80',
  },
  smartwatches: {
    label: 'SmartWatch',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&auto=format&fit=crop&q=80',
  },
  earphones: {
    label: 'Earphones',
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=300&auto=format&fit=crop&q=80',
  },
  cameras: {
    label: 'Cameras',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=300&auto=format&fit=crop&q=80',
  },
  tv: {
    label: 'TV & Video',
    image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=300&auto=format&fit=crop&q=80',
  },
  gaming: {
    label: 'Gaming',
    image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=300&auto=format&fit=crop&q=80',
  },
  appliances: {
    label: 'Electronics & Appliances',
    image: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=300&auto=format&fit=crop&q=80',
  },
};

const SellCategoryStep = ({ onSelectCategory, onBack }) => {
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
          What are you offering?
        </h1>
      </header>

      {/* 2-Column Categories Grid (OLX Style) */}
      <div className="flex-1 grid grid-cols-2 divide-x divide-y divide-slate-200 border-b border-slate-200">
        {C2C_CATEGORIES.map((cat, idx) => {
          const display = CATEGORY_DISPLAY_DATA[cat.id] || {
            label: cat.name,
            image: cat.image,
          };

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat)}
              className="group flex flex-col items-center justify-center p-6 text-center bg-white hover:bg-slate-50/80 active:bg-blue-50/30 transition-colors focus:outline-none"
            >
              <div className="w-24 h-24 flex items-center justify-center mb-3 transition-transform group-hover:scale-105 duration-200">
                <img
                  src={display.image}
                  alt={display.label}
                  className="max-h-20 max-w-20 object-contain drop-shadow-sm rounded-lg"
                  loading="lazy"
                />
              </div>
              <span className="text-sm font-semibold text-slate-900 group-hover:text-[#0F4C81] leading-tight">
                {display.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SellCategoryStep;
