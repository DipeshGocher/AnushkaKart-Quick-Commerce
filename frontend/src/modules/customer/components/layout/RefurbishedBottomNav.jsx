import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Smartphone, ShoppingBag, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { motion } from 'framer-motion';
import groceryBasketIcon from '@/assets/grocery-basket-icon.png';

const isRouteActive = (itemPath, currentPath) => {
    if (itemPath === '/refurbished') {
        return currentPath === '/refurbished' || currentPath === '/refurbished/';
    }
    if (itemPath === '/refurbished/products') {
        return currentPath.startsWith('/refurbished/products') || currentPath.startsWith('/refurbished/brands');
    }
    if (itemPath === '/refurbished/cart') {
        return currentPath.startsWith('/refurbished/cart');
    }
    if (itemPath === '/refurbished/wishlist') {
        return currentPath.startsWith('/refurbished/wishlist');
    }
    return currentPath === itemPath;
};

const RefurbishedBottomNav = () => {
    const location = useLocation();
    const { refurbishedCartCount } = useCart();
    const { refurbishedWishlistCount } = useWishlist();

    const navItems = [
        { label: 'Home', icon: Home, path: '/refurbished' },
        { label: 'Products', icon: Smartphone, path: '/refurbished/products' },
        { label: 'Cart', icon: ShoppingBag, path: '/refurbished/cart', badgeCount: refurbishedCartCount },
        { label: 'Wishlist', icon: Heart, path: '/refurbished/wishlist', badgeCount: refurbishedWishlistCount },
    ];

    return (
        <div 
            className="fixed left-2 right-2 max-w-md mx-auto z-[500] flex items-center gap-2 md:hidden pointer-events-auto transition-all duration-300"
            style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
            {/* Glassmorphism Floating Pill Bar for Refurbished Navigation (4 Items) */}
            <div className="flex-1 bg-white/40 backdrop-blur-2xl backdrop-saturate-180 border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-full px-2 py-1.5 ring-1 ring-white/30 flex items-center justify-around">
                {navItems.map((item) => {
                    const isActive = isRouteActive(item.path, location.pathname);

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-2xl transition-all duration-300 flex-1 min-w-[44px] relative",
                                isActive
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-extrabold"
                                    : "text-slate-700 hover:text-blue-600 font-semibold hover:bg-blue-50/60"
                            )}
                        >
                            <motion.div
                                animate={{ scale: isActive ? 1.1 : 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                className="flex items-center justify-center shrink-0 relative"
                            >
                                <item.icon
                                    size={18}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    className={cn("transition-colors shrink-0", isActive ? "text-white" : "text-slate-700")}
                                />
                                {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                                    <span className={cn(
                                        "absolute -top-1.5 -right-2 font-black text-[9.5px] min-w-[17px] h-[17px] rounded-full px-1 flex items-center justify-center border border-white shadow-xs",
                                        isActive ? "bg-amber-400 text-slate-900" : "bg-blue-600 text-white"
                                    )}>
                                        {item.badgeCount > 99 ? '99+' : item.badgeCount}
                                    </span>
                                )}
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

            {/* Quick Commerce Grocery Return Switcher Button */}
            <Link
                to="/"
                title="Switch to Grocery Quick Commerce"
                className="shrink-0 flex flex-col items-center justify-center relative group"
            >
                <motion.div
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    className="w-13 h-13 rounded-full flex items-center justify-center shadow-xl transition-all relative border-2 border-white overflow-hidden p-0 bg-white"
                >
                    <img 
                        src={groceryBasketIcon} 
                        alt="Switch to Grocery Quick Commerce" 
                        className="w-full h-full object-contain rounded-full"
                    />
                </motion.div>
            </Link>
        </div>
    );
};

export default RefurbishedBottomNav;
