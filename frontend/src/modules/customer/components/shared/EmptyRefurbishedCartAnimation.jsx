import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingBag, ArrowRight } from "lucide-react";

/**
 * Animated Empty Cart matching IconScout Empty Cart Animation (ID: 14058115).
 * Features:
 * - Yellow/Gold cart handle and base bar (#F59E0B)
 * - Dark Navy Blue basket frame and mesh grid (#1E293B)
 * - Two wheels with Navy rim, white disc, and Coral Red center hub (#EF4444)
 * - Dynamic sway & bounce animation with animated ground shadow
 * - "Start Shopping" call-to-action button
 */
const EmptyRefurbishedCartAnimation = ({ isRefurbished = true, onActionClick }) => {
  return (
    <div className="flex flex-col items-center justify-center pt-8 pb-12 px-4 text-center select-none">
      {/* Animated Empty Cart Graphic */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex flex-col items-center justify-center mb-6">
        {/* Ambient Glow */}
        <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full pointer-events-none transform -translate-y-4" />

        {/* Floating / Bouncing Cart Body */}
        <motion.div
          animate={{
            y: [0, -14, 0],
            rotate: [0, -2.5, 2.5, 0],
          }}
          transition={{
            duration: 2.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative z-10 w-48 h-48 sm:w-56 sm:h-56"
        >
          <svg
            viewBox="0 0 240 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-md"
          >
            {/* Cart Yellow Top Handle */}
            <path
              d="M 32 104 C 32 94 40 86 50 86 L 80 86 C 88 86 94 92 96 100 L 118 190 L 48 190"
              stroke="#F59E0B"
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Cart Wire Basket Main Outline (Dark Navy) */}
            <rect
              x="76"
              y="96"
              width="134"
              height="88"
              rx="12"
              transform="rotate(3.5 76 96)"
              stroke="#1E293B"
              strokeWidth="9"
              fill="white"
              fillOpacity="0.85"
            />

            {/* Basket Grid Lines - Horizontal */}
            <line
              x1="78"
              y1="126"
              x2="210"
              y2="134"
              stroke="#1E293B"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <line
              x1="80"
              y1="156"
              x2="208"
              y2="164"
              stroke="#1E293B"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Basket Grid Lines - Vertical */}
            <line
              x1="110"
              y1="98"
              x2="114"
              y2="182"
              stroke="#1E293B"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <line
              x1="142"
              y1="100"
              x2="146"
              y2="184"
              stroke="#1E293B"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <line
              x1="174"
              y1="102"
              x2="178"
              y2="186"
              stroke="#1E293B"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Bottom Yellow Frame Bar */}
            <path
              d="M 112 188 L 194 188"
              stroke="#F59E0B"
              strokeWidth="11"
              strokeLinecap="round"
            />

            {/* Left Wheel Group (Animated Rolling Spin) */}
            <motion.g
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "114px 206px" }}
            >
              {/* Outer Navy Ring */}
              <circle cx="114" cy="206" r="17" fill="#1E293B" />
              {/* White Tire Center */}
              <circle cx="114" cy="206" r="11" fill="white" />
              {/* Coral Red Hub Dot */}
              <circle cx="114" cy="206" r="6" fill="#EF4444" />
            </motion.g>

            {/* Right Wheel Group (Animated Rolling Spin) */}
            <motion.g
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "186px 206px" }}
            >
              {/* Outer Navy Ring */}
              <circle cx="186" cy="206" r="17" fill="#1E293B" />
              {/* White Tire Center */}
              <circle cx="186" cy="206" r="11" fill="white" />
              {/* Coral Red Hub Dot */}
              <circle cx="186" cy="206" r="6" fill="#EF4444" />
            </motion.g>
          </svg>
        </motion.div>

        {/* Dynamic Ground Shadow */}
        <motion.div
          animate={{
            scaleX: [1, 0.75, 1],
            opacity: [0.35, 0.15, 0.35],
          }}
          transition={{
            duration: 2.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="w-40 h-4 bg-slate-400/40 rounded-[100%] blur-sm -mt-2 z-0"
        />
      </div>

      {/* Empty State Text Content */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2"
      >
        Your Cart is Empty
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-slate-500 font-medium text-sm sm:text-base max-w-sm mb-8 leading-relaxed"
      >
        {isRefurbished
          ? "Explore top-quality certified devices with full warranty & quality checks."
          : "Looks like you haven't added anything to your shopping cart yet."}
      </motion.p>

      {/* Start Shopping Button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
      >
        <Link
          to={isRefurbished ? "/marketplace" : "/categories"}
          onClick={onActionClick}
          className={`inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl text-base font-bold text-white shadow-xl transition-all ${
            isRefurbished
              ? "bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-blue-500/30"
              : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/25"
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span>Start Shopping</span>
          <ArrowRight className="w-5 h-5 ml-0.5" />
        </Link>
      </motion.div>
    </div>
  );
};

export default EmptyRefurbishedCartAnimation;
