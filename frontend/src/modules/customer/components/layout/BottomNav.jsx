import React, { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, CalendarCheck, User, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '../../context/CartContext';
import { motion } from 'framer-motion';

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
    if (itemPath === '/cart') {
        return currentPath.startsWith('/cart') || currentPath.startsWith('/checkout');
    }
    return currentPath === itemPath || (itemPath !== '/' && currentPath.startsWith(itemPath));
};

const BottomNav = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { groceryCartCount } = useCart();
    const pendingNavigation = useRef(0);

    const mainNavItems = [
        { label: 'Home', icon: Home, path: '/' },
        { label: 'Orders', icon: CalendarCheck, path: '/orders' },
        { label: 'Cart', icon: ShoppingBag, path: '/cart', isMiddle: true },
        { label: 'Categories', icon: LayoutGrid, path: '/categories' },
        { label: 'Account', icon: User, path: '/profile' },
    ];

    const handleNavClick = async (e, item) => {
        e.preventDefault();
        if (location.pathname === item.path) return;

        const navigationId = ++pendingNavigation.current;
        const currentIndex = mainNavItems.findIndex((navItem) => isRouteActive(navItem.path, location.pathname));
        const targetIndex = mainNavItems.findIndex((navItem) => navItem.path === item.path);
        const tabDirection = targetIndex < currentIndex ? -1 : 1;

        // Keep the current screen visible until the destination chunk is ready.
        // This lets the full-page slide show the actual page instead of a route skeleton.
        const pageImports = {
            '/': () => import('../../pages/Home'),
            '/orders': () => import('../../pages/OrdersPage'),
            '/cart': () => import('../../pages/CartPage'),
            '/profile': () => import('../../pages/ProfilePage'),
        };
        try {
            await pageImports[item.path]?.();
        } catch {
            // Let the route's own error boundary handle a failed import.
        }
        if (navigationId !== pendingNavigation.current) return;
        navigate(item.path, { state: { pageTransition: 'tab', tabDirection } });
    };

    return (
        <div 
            className="fixed left-3 right-3 max-w-sm mx-auto z-[500] flex items-center justify-center md:hidden pointer-events-auto transition-all duration-300"
            style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
            {/* Translucent white glass navigation */}
            <div className="w-full bg-white/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/75 shadow-[0_8px_32px_rgba(15,23,42,0.14)] rounded-full px-1.5 py-1.5 ring-1 ring-white/40 flex items-center justify-between">
                {mainNavItems.map((item) => {
                    const isActive = isRouteActive(item.path, location.pathname);

                    if (item.isMiddle) {
                        return (
                            <button
                                key={item.path}
                                type="button"
                                onClick={(e) => handleNavClick(e, item)}
                                className="flex flex-col items-center justify-center flex-1 min-w-0 relative -mt-5 cursor-pointer focus:outline-none"
                            >
                                <motion.div
                                    whileTap={{ scale: 0.92 }}
                                    className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all relative border-2 border-white",
                                        isActive
                                            ? "bg-gradient-to-tr from-orange-500 via-amber-500 to-orange-600 text-white shadow-orange-500/40 ring-4 ring-orange-100/90 scale-105"
                                            : "bg-gradient-to-tr from-orange-500 via-amber-500 to-orange-600 text-white shadow-orange-500/30"
                                    )}
                                >
                                    <item.icon size={22} className="stroke-[2.2]" />
                                    {groceryCartCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-tr from-[#FF5722] to-[#FF7043] text-white font-black text-[10px] min-w-[20px] h-[20px] rounded-full px-1 flex items-center justify-center border-2 border-white shadow-md animate-in zoom-in duration-300">
                                            {groceryCartCount > 99 ? '99+' : groceryCartCount}
                                        </span>
                                    )}
                                </motion.div>
                                <span className={cn(
                                    "text-[9.5px] whitespace-nowrap leading-none tracking-tight mt-1 font-bold",
                                    isActive ? "text-orange-600 font-extrabold" : "text-slate-800 font-semibold"
                                )}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    }

                    return (
                        <button
                            key={item.path}
                            type="button"
                            onClick={(e) => handleNavClick(e, item)}
                            className={cn(
                                "flex flex-col items-center justify-center gap-0.5 px-1 py-1 rounded-2xl border transition-all duration-150 flex-1 min-w-0 cursor-pointer active:scale-95 focus:outline-none",
                                isActive
                                    ? "bg-white/75 border-white/90 text-slate-900 shadow-sm font-extrabold"
                                    : "bg-transparent border-transparent text-slate-700 font-semibold md:hover:bg-white/50"
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
                                    className={cn("transition-colors shrink-0", isActive ? "text-orange-600" : "text-slate-700")}
                                />
                            </motion.div>
                            <span className={cn(
                                "text-[9.5px] whitespace-nowrap leading-none tracking-tight",
                                isActive ? "text-slate-900 font-black" : "text-slate-800 font-semibold"
                            )}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default BottomNav;
