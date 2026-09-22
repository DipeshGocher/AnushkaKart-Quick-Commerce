import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePageTransition } from '../../context/PageTransitionContext';
import { Smartphone, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * FlipkartHeaderSectionSwitcher
 * Modern Flipkart 2024 curved card buttons for "Cart" and "Store".
 * Inactive button is crisp white; active button fills with its signature color (Orange for Cart, Blue for Store).
 */
const FlipkartHeaderSectionSwitcher = ({ className = "" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { triggerIconFillTransition } = usePageTransition() || {};

  const isMarketplace = location.pathname.startsWith('/marketplace') || location.pathname.startsWith('/refurbished');

  const handleSwitch = (target) => {
    if ((target === 'marketplace' || target === 'refurbished') && !isMarketplace) {
      if (triggerIconFillTransition) {
        triggerIconFillTransition('marketplace', () => navigate('/marketplace'));
      } else {
        navigate('/marketplace');
      }
    } else if (target === 'grocery' && isMarketplace) {
      if (triggerIconFillTransition) {
        triggerIconFillTransition('grocery', () => navigate('/'));
      } else {
        navigate('/');
      }
    }
  };

  return (
    <div className={cn("w-full select-none bg-transparent pt-0.5 pb-2 relative z-20", className)}>
      <div className="flex items-center gap-2.5 sm:gap-3.5 max-w-lg mx-auto">
        
        {/* Left Button: Cart (Quick Commerce / Grocery) */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => handleSwitch('grocery')}
          className={cn(
            "flex-1 relative flex items-center justify-center gap-2 sm:gap-2.5 h-11 sm:h-12 rounded-2xl transition-all duration-300 font-sans cursor-pointer",
            !isMarketplace
              ? "bg-gradient-to-r from-[#D84315] to-[#BF360C] text-white shadow-lg shadow-orange-950/20 border-2 border-white/90 font-black scale-[1.01]"
              : "bg-white text-slate-800 border border-slate-200/80 shadow-sm hover:border-orange-300 font-bold"
          )}
          title="Cart Section"
        >
          <div
            className={cn(
              "w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-xl flex items-center justify-center transition-colors shrink-0",
              !isMarketplace
                ? "bg-white/20 text-white"
                : "bg-orange-50 text-[#FF5722]"
            )}
          >
            <ShoppingCart className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={2.4} />
          </div>
          <span className="italic tracking-tight text-[15px] sm:text-[17px] drop-shadow-xs">
            Cart
          </span>
        </motion.button>

        {/* Right Button: Store (C2C Marketplace) */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => handleSwitch('marketplace')}
          className={cn(
            "flex-1 relative flex items-center justify-center gap-2 sm:gap-2.5 h-11 sm:h-12 rounded-2xl transition-all duration-300 font-sans cursor-pointer",
            isMarketplace
              ? "bg-gradient-to-r from-[#0F4C81] to-[#0A365C] text-white shadow-lg shadow-blue-950/20 border-2 border-white/90 font-black scale-[1.01]"
              : "bg-white text-slate-800 border border-slate-200/80 shadow-sm hover:border-[#0F4C81]/40 font-bold"
          )}
          title="Store Section"
        >
          <div
            className={cn(
              "w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-xl flex items-center justify-center transition-colors shrink-0",
              isMarketplace
                ? "bg-white/20 text-white"
                : "bg-blue-50 text-[#0F4C81]"
            )}
          >
            <Smartphone className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={2.4} />
          </div>
          <span className="italic tracking-tight text-[15px] sm:text-[17px] drop-shadow-xs">
            Store
          </span>
        </motion.button>

      </div>
    </div>
  );
};

export default FlipkartHeaderSectionSwitcher;
