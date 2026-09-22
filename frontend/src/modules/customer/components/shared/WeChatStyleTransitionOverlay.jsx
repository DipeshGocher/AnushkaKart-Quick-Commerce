import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import secondHandIcon from '@/assets/2ndhand-icon.png';
import groceryBasketIcon from '@/assets/grocery-basket-icon.png';

const WeChatStyleTransitionOverlay = ({ transitionData }) => {
    if (!transitionData) return null;

    const { type } = transitionData; // 'marketplace' | 'refurbished' | 'grocery'
    const isMarketplace = type === 'marketplace' || type === 'refurbished';

    const bgColor = isMarketplace ? '#0F4C81' : '#FF5722';
    const iconSrc = isMarketplace ? secondHandIcon : groceryBasketIcon;
    const sectionSubtitle = isMarketplace ? 'C2C Marketplace' : 'Quick Commerce Grocery';

    return (
        <AnimatePresence>
            {transitionData && (
                <motion.div
                    key="wechat-transition-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.4 } }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-[999999] flex flex-col items-center justify-center overflow-hidden select-none pointer-events-auto"
                    style={{ backgroundColor: bgColor }}
                >
                    {/* Ripple background ring 1 */}
                    <motion.div
                        initial={{ scale: 0.2, opacity: 0.6 }}
                        animate={{ scale: [0.2, 2.5, 4.5], opacity: [0.6, 0.25, 0] }}
                        transition={{ duration: 1.1, ease: "easeOut" }}
                        className="absolute w-72 h-72 rounded-full bg-white/25 pointer-events-none"
                    />

                    {/* Ripple background ring 2 */}
                    <motion.div
                        initial={{ scale: 0.1, opacity: 0.8 }}
                        animate={{ scale: [0.1, 1.8, 3.5], opacity: [0.8, 0.35, 0] }}
                        transition={{ duration: 0.9, delay: 0.1, ease: "easeOut" }}
                        className="absolute w-72 h-72 rounded-full bg-white/35 pointer-events-none"
                    />

                    {/* Center Icon Popup & Pulse Animation */}
                    <motion.div
                        initial={{ scale: 0, rotate: -25, opacity: 0 }}
                        animate={{ 
                            scale: [0, 1.25, 0.95, 1.05, 1],
                            rotate: [-25, 10, -5, 2, 0],
                            opacity: [0, 1, 1, 1, 1]
                        }}
                        transition={{ 
                            duration: 0.55, 
                            times: [0, 0.35, 0.6, 0.85, 1],
                            ease: "easeInOut" 
                        }}
                        className="relative z-10 flex flex-col items-center justify-center"
                    >
                        <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-white p-3.5 shadow-2xl flex items-center justify-center border-4 border-white/90 ring-8 ring-black/10">
                            <img 
                                src={iconSrc} 
                                alt="Anushka Store" 
                                className="w-full h-full object-contain rounded-2xl"
                            />
                        </div>

                        {/* Title: Anushka Store */}
                        <motion.h3
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15, duration: 0.3 }}
                            className="mt-5 text-white font-black text-xl sm:text-2xl tracking-wide uppercase text-center px-4 drop-shadow-md"
                        >
                            Anushka Store
                        </motion.h3>

                        {/* Subtitle Section Label */}
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25, duration: 0.3 }}
                            className="mt-1 text-white/90 font-extrabold text-xs sm:text-sm tracking-widest uppercase text-center px-4 drop-shadow-sm"
                        >
                            {sectionSubtitle}
                        </motion.p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default WeChatStyleTransitionOverlay;
