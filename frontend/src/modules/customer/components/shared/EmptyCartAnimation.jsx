import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';

/**
 * EmptyCartAnimation Component
 * Replicates the IconScout red basket animation (ID: 8062901)
 * with swinging handle, floating basket, ground shadow,
 * "EMPTY CART" text on the basket (replacing "SALE"),
 * and an orange "Start Shopping" button redirecting to /categories.
 */
const EmptyCartAnimation = ({ onActionClick }) => {
  return (
    <div className="flex flex-col items-center justify-center py-6 sm:py-10 px-4 text-center select-none">
      {/* Animated Graphic Container */}
      <div className="relative w-64 h-56 sm:w-72 sm:h-64 flex flex-col items-center justify-center mb-4">
        {/* Soft Ambient Background Glow */}
        <div className="absolute inset-0 bg-red-500/10 blur-3xl rounded-full pointer-events-none transform -translate-y-2" />

        <svg
          viewBox="0 0 360 270"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full overflow-visible drop-shadow-sm"
        >
          <defs>
            {/* Soft Shadow Filter for subtle depth */}
            <filter id="cartShadow" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#FF3838" floodOpacity="0.18" />
            </filter>
            {/* Subtle Gradient for 3D Basket Body */}
            <linearGradient id="basketGradient" x1="180" y1="120" x2="180" y2="225" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF3F3F" />
              <stop offset="100%" stopColor="#FA3434" />
            </linearGradient>
          </defs>

          {/* Dynamic Ground Shadow */}
          <motion.ellipse
            cx="180"
            cy="246"
            rx="88"
            ry="10"
            fill="#CBD5E1"
            animate={{
              scaleX: [1, 0.82, 1],
              opacity: [0.55, 0.28, 0.55],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ transformOrigin: '180px 246px' }}
          />

          {/* Floating / Bouncing Basket Group */}
          <motion.g
            animate={{
              y: [0, -12, 0],
              rotate: [0, -1, 1, 0],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ transformOrigin: '180px 180px' }}
            filter="url(#cartShadow)"
          >
            {/* Swinging Handle (Pivot at center of the basket rim) */}
            <motion.g
              animate={{
                rotate: [34, -30, 34],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ transformOrigin: '180px 128px' }}
            >
              {/* Handle Bar */}
              <line
                x1="180"
                y1="128"
                x2="216"
                y2="34"
                stroke="#FF3838"
                strokeWidth="24"
                strokeLinecap="round"
              />
              {/* Handle inner highlight accent */}
              <line
                x1="181"
                y1="118"
                x2="213"
                y2="40"
                stroke="#FF6B6B"
                strokeWidth="7"
                strokeLinecap="round"
                opacity="0.6"
              />
            </motion.g>

            {/* Basket Body (Tapered trapezoid with rounded bottom corners) */}
            <path
              d="M 80 126 L 98 206 C 101 216 110 223 121 223 L 239 223 C 250 223 259 216 262 206 L 280 126 Z"
              fill="url(#basketGradient)"
            />

            {/* Front Rim (Elongated pill with rounded caps) */}
            <rect
              x="62"
              y="113"
              width="236"
              height="26"
              rx="13"
              fill="#FF3838"
            />
            {/* Top Rim Highlight Line */}
            <rect
              x="76"
              y="116"
              width="208"
              height="4"
              rx="2"
              fill="#FFA3A3"
              opacity="0.45"
            />

            {/* Handle Pivot Notch / Hinge Joint Indicator */}
            <circle
              cx="180"
              cy="126"
              r="7"
              fill="#D62828"
              opacity="0.85"
            />
            <circle
              cx="180"
              cy="126"
              r="3.5"
              fill="#FFFFFF"
              opacity="0.9"
            />

            {/* "EMPTY CART" Text (Replacing "SALE" on the red basket) */}
            <text
              x="180"
              y="183"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#FFFFFF"
              fontSize="23"
              fontWeight="900"
              letterSpacing="0.04em"
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              style={{
                userSelect: 'none',
                textShadow: '0 1px 2px rgba(0,0,0,0.12)',
              }}
            >
              EMPTY CART
            </text>
          </motion.g>

          {/* Floating Playful Sparkles / Accents */}
          <motion.g
            animate={{
              opacity: [0.2, 0.9, 0.2],
              scale: [0.8, 1.2, 0.8],
              y: [0, -6, 0],
            }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.3,
            }}
            style={{ transformOrigin: '55px 105px' }}
          >
            <path
              d="M 55 96 L 57 103 L 64 105 L 57 107 L 55 114 L 53 107 L 46 105 L 53 103 Z"
              fill="#FF9800"
            />
          </motion.g>

          <motion.g
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.25, 0.8],
              y: [0, -8, 0],
            }}
            transition={{
              duration: 3.1,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.8,
            }}
            style={{ transformOrigin: '305px 95px' }}
          >
            <path
              d="M 305 86 L 307 93 L 314 95 L 307 97 L 305 104 L 303 97 L 296 95 L 303 93 Z"
              fill="#FFB74D"
            />
          </motion.g>
        </svg>
      </div>

      {/* Primary Message */}
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2"
      >
        Your Cart is Empty
      </motion.h2>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="text-slate-500 font-medium text-xs sm:text-sm max-w-xs sm:max-w-sm mb-7 leading-relaxed"
      >
        Looks like you haven't added anything to your cart yet. Explore all categories to start shopping!
      </motion.p>

      {/* Orange "Start Shopping" Button Redirecting to /categories */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        <Link
          to="/categories"
          onClick={onActionClick}
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm sm:text-base font-extrabold text-white bg-[#FF5722] hover:bg-[#F4511E] active:bg-[#E64A19] shadow-lg shadow-orange-500/30 hover:shadow-orange-500/40 transition-all cursor-pointer"
        >
          <ShoppingBag className="w-5 h-5 shrink-0" />
          <span>Start Shopping</span>
          <ArrowRight className="w-4 h-4 ml-0.5 shrink-0" />
        </Link>
      </motion.div>
    </div>
  );
};

export default EmptyCartAnimation;
