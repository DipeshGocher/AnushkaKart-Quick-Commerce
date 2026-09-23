import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { C2C_CATEGORIES } from '../data/c2cMockData';
import { cn } from '@/lib/utils';
import { useAuth } from '@core/context/AuthContext';
import { toast } from 'sonner';

const MarketplaceCategoriesPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [selectedCatId, setSelectedCatId] = useState('mobiles');

  const selectedCategory = useMemo(() => {
    return C2C_CATEGORIES.find(c => c.id === selectedCatId) || C2C_CATEGORIES[0];
  }, [selectedCatId]);

  const handleSubCategoryClick = (subCatName) => {
    navigate(`/marketplace/products?category=${selectedCategory.id}&subCategory=${encodeURIComponent(subCatName)}`);
  };

  const handleViewAllClick = () => {
    navigate(`/marketplace/products?category=${selectedCategory.id}`);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col pb-24">
      {/* Top Header matching Image 2 */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-900 active:scale-95 transition-all"
            aria-label="Back"
          >
            <ArrowLeft size={22} strokeWidth={2.5} />
          </button>
          
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            Categories
          </h1>

          <div className="w-8" aria-hidden="true" />
        </div>
      </header>

      {/* Main Split Body: Sidebar Categories on Left, Subcategories on Right */}
      <div className="flex-1 flex max-w-4xl w-full mx-auto overflow-hidden">
        {/* Left Sidebar: Header Categories matching Image 2 */}
        <aside className="w-24 sm:w-28 shrink-0 bg-[#f4f7fb] border-r border-slate-200/80 overflow-y-auto max-h-[calc(100vh-3.5rem)] py-2 select-none scrollbar-none">
          <div className="space-y-1">
            {C2C_CATEGORIES.map((cat) => {
              const isSelected = cat.id === selectedCatId;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  className={cn(
                    "w-full relative flex flex-col items-center justify-center py-3 px-2 text-center transition-all group",
                    isSelected 
                      ? "bg-white text-[#0F4C81] shadow-2xs" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  )}
                >
                  {/* Left Active Indicator Bar matching Image 2 */}
                  {isSelected && (
                    <motion.div
                      layoutId="activeCategoryPill"
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#0F4C81] rounded-r-md"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}

                  {/* 3D Cutout visual or emoji icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1 overflow-hidden shrink-0">
                    {cat.image ? (
                      <img 
                        src={cat.image} 
                        alt={cat.name} 
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <span className="text-2xl">{cat.icon}</span>
                    )}
                  </div>

                  {/* Category Name */}
                  <span className={cn(
                    "text-[11px] leading-tight line-clamp-2 max-w-[80px]",
                    isSelected ? "font-black text-[#0F4C81]" : "font-semibold"
                  )}>
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Content Panel: Subcategories matching Image 2 */}
        <main className="flex-1 bg-white overflow-y-auto max-h-[calc(100vh-3.5rem)] px-4 sm:px-6 py-4">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={selectedCategory.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {/* Category Title Header with Horizontal Separator matching Image 2 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    {selectedCategory.name}
                  </h2>
                </div>
                <hr className="border-slate-100" />
              </div>

              {/* Subcategories Grid matching Image 2 */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-y-6 gap-x-3">
                {selectedCategory.subCategories?.map((subCat) => (
                  <button
                    key={subCat.id}
                    type="button"
                    onClick={() => handleSubCategoryClick(subCat.name)}
                    className="flex flex-col items-center text-center group cursor-pointer"
                  >
                    {/* Circular Item Graphic */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#f4f7fb] border border-slate-200/70 p-2 flex items-center justify-center overflow-hidden mb-2 shadow-2xs group-hover:border-[#0F4C81] group-hover:shadow-sm group-active:scale-95 transition-all">
                      <img
                        src={subCat.image}
                        alt={subCat.name}
                        className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform"
                      />
                    </div>
                    {/* Subcategory Label */}
                    <span className="text-xs font-bold text-slate-800 group-hover:text-[#0F4C81] leading-tight line-clamp-2 max-w-[85px] transition-colors">
                      {subCat.name}
                    </span>
                  </button>
                ))}

                {/* 'View All' Circular Action matching Image 2 */}
                <button
                  type="button"
                  onClick={handleViewAllClick}
                  className="flex flex-col items-center text-center group cursor-pointer"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#f4f7fb] border border-slate-200/70 p-2 flex items-center justify-center mb-2 shadow-2xs group-hover:border-[#0F4C81] group-hover:bg-blue-50/50 group-active:scale-95 transition-all">
                    <ChevronRight size={26} strokeWidth={2.5} className="text-[#0F4C81] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <span className="text-xs font-black text-slate-900 group-hover:text-[#0F4C81] leading-tight transition-colors">
                    View All
                  </span>
                </button>
              </div>

              {/* 'Have something to sell? List here >' Banner matching Image 2 */}
              <div 
                onClick={() => {
                  if (!isAuthenticated) {
                    toast.info('Please log in to sell your products');
                    navigate('/login', { state: { from: { pathname: '/marketplace/sell' } } });
                    return;
                  }
                  navigate('/marketplace/sell');
                }}
                className="mt-8 bg-[#fff9ea] hover:bg-[#fff4d6] border border-[#f5dfa0] rounded-2xl p-3.5 flex items-center justify-between cursor-pointer shadow-xs active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                    <Tag size={18} className="text-amber-700" />
                  </div>
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                    Have something to sell? List here
                  </span>
                </div>
                <ChevronRight size={18} strokeWidth={2.5} className="text-slate-700" />
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default MarketplaceCategoriesPage;
