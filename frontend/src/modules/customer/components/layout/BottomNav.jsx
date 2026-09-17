import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, CalendarCheck, User, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '../../context/CartContext';
import { motion } from 'framer-motion';
import secondHandIcon from '@/assets/2ndhand-icon.png';

const isRouteActive = (itemPath, currentPath) => {
    if (itemPath === '/') {
        return currentPath === '/' || currentPath === '/offers' || currentPath === '/search';
    }
    if (itemPath === '/categories') {
        return currentPath.startsWith('/categories') || currentPath.startsWith('/category');
    }
    if (itemPath === '/orders') {
        return currentPath.startsWith('/orders') || currentPath.startsWith('/payment-status');
    }
    if (itemPath === '/refurbished') {
        return currentPath.startsWith('/refurbished');
    }
    if (itemPath === '/cart') {
        return currentPath.startsWith('/cart') || currentPath.startsWith('/checkout');
    }
    return currentPath === itemPath || (itemPath !== '/' && currentPath.startsWith(itemPath));
};

const BottomNav = () => {
    const location = useLocation();
    const { cartCount } = useCart();

    const mainNavItems = [
        { label: 'Home', icon: Home, path: '/' },
        { label: 'Orders', icon: CalendarCheck, path: '/orders' },
        { label: 'Cart', icon: ShoppingBag, path: '/cart', isMiddle: true },
        { label: 'Categories', icon: LayoutGrid, path: '/categories' },
    ];

    const isRefurbishedActive = isRouteActive('/refurbished', location.pathname);

    return (
        <div 
            className="fixed left-2 right-2 max-w-md mx-auto z-[500] flex items-center gap-2 md:hidden pointer-events-auto transition-all duration-300"
            style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
            {/* Glassmorphism Floating Pill Bar for Main Navigation (4 Items) */}
            <div className="flex-1 bg-white/40 backdrop-blur-2xl backdrop-saturate-180 border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-full px-2 py-1.5 ring-1 ring-white/30 flex items-center justify-around">
                {mainNavItems.map((item) => {
                    const isActive = isRouteActive(item.path, location.pathname);

                    if (item.isMiddle) {
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className="flex flex-col items-center justify-center flex-1 min-w-[50px] relative -mt-5"
                            >
                                <motion.div
                                    whileTap={{ scale: 0.92 }}
                                    whileHover={{ scale: 1.05 }}
                                    className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all relative border-2 border-white",
                                        isActive
                                            ? "bg-gradient-to-tr from-orange-500 via-amber-500 to-orange-600 text-white shadow-orange-500/40 ring-4 ring-orange-100/90 scale-105"
                                            : "bg-gradient-to-tr from-orange-500 via-amber-500 to-orange-600 text-white shadow-orange-500/30"
                                    )}
                                >
                                    <item.icon size={22} className="stroke-[2.2]" />
                                    {cartCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-tr from-[#FF5722] to-[#FF7043] text-white font-black text-[10px] min-w-[20px] h-[20px] rounded-full px-1 flex items-center justify-center border-2 border-white shadow-md animate-in zoom-in duration-300">
                                            {cartCount > 99 ? '99+' : cartCount}
                                        </span>
                                    )}
                                </motion.div>
                                <span className={cn(
                                    "text-[9.5px] whitespace-nowrap leading-none tracking-tight mt-1 font-bold",
                                    isActive ? "text-orange-600 font-extrabold" : "text-slate-800 font-semibold"
                                )}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    }

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-2xl transition-all duration-300 flex-1 min-w-[44px]",
                                isActive
                                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/20 font-extrabold"
                                    : "text-slate-700 hover:text-slate-900 font-semibold hover:bg-slate-100/50"
                            )}
                        >
                            <motion.div
                                animate={{ scale: isActive ? 1.1 : 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                className="flex items-center justify-center shrink-0"
                            >
                                <item.icon
                                    size={18}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    className={cn("transition-colors shrink-0", isActive ? "text-orange-400" : "text-slate-700")}
                                />
                            </motion.div>
                            <span className={cn(
                                "text-[9.5px] whitespace-nowrap leading-none tracking-tight",
                                isActive ? "text-white font-black" : "text-slate-800 font-semibold"
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>

            {/* Floating 2nd Hand Mobile Action Button */}
            <Link
                to="/refurbished"
                className="shrink-0 flex flex-col items-center justify-center relative group"
            >
                <motion.div
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    className={cn(
                        "w-13 h-13 rounded-full flex items-center justify-center shadow-xl transition-all relative border-2 border-white overflow-hidden p-0 bg-white",
                        isRefurbishedActive
                            ? "ring-4 ring-blue-500 scale-105 shadow-blue-500/40"
                            : "shadow-slate-900/30 hover:scale-105"
                    )}
                >
                    <img 
                        src={secondHandIcon} 
                        alt="2nd Hand Refurbished Mobiles" 
                        className="w-full h-full object-contain rounded-full"
                    />
                </motion.div>
            </Link>
        </div>
    );
};

export default BottomNav;
