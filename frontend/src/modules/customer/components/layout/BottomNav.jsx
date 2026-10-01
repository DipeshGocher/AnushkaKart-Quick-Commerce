import React, { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, Package, User, ShoppingBag, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '../../context/CartContext';
import { motion } from 'framer-motion';

const isRouteActive = (itemPath, currentPath) => {
    if (itemPath === '/') {
        return currentPath === '/' || currentPath === '/offers';
    }
    if (itemPath === '/categories') {
        return currentPath.startsWith('/categories') || currentPath.startsWith('/category');
    }
    if (itemPath === '/products') {
        return currentPath.startsWith('/products') || currentPath.startsWith('/product');
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
        { label: 'Products', icon: Boxes, path: '/products' },
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
            '/products': () => import('../../pages/ProductsPage'),
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
            className="fixed inset-x-0 bottom-0 z-[500] flex items-center justify-center md:hidden pointer-events-auto"
        >
            <nav
                aria-label="Primary navigation"
                className="w-full bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] rounded-t-[28px] px-2 pt-2 flex items-start justify-between"
                style={{ paddingBottom: "max(0.55rem, env(safe-area-inset-bottom, 0px))" }}
            >
                {mainNavItems.map((item) => {
                    const isActive = isRouteActive(item.path, location.pathname);
                    return (
                        <button
                            key={item.path}
                            type="button"
                            onClick={(e) => handleNavClick(e, item)}
                            className={cn(
                                "relative flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-all duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                                isActive ? "text-[#2875E8]" : "text-slate-400"
                            )}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <motion.div
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                className={cn(
                                    "relative flex h-9 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
                                )}
                            >
                                <item.icon
                                    size={22}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    fill={isActive ? "currentColor" : "none"}
                                    className="shrink-0 transition-colors"
                                />
                                {item.isMiddle && groceryCartCount > 0 && (
                                    <span className="absolute -right-0.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#2875E8] px-0.5 text-[9px] font-black text-white">
                                        {groceryCartCount > 99 ? '99+' : groceryCartCount}
                                    </span>
                                )}
                            </motion.div>
                            <span className={cn(
                                "text-[10px] whitespace-nowrap leading-none tracking-tight",
                                isActive ? "font-extrabold text-[#2875E8]" : "font-semibold text-slate-400"
                            )}>
                                {item.label}
                            </span>
                            {isActive && <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-[#2875E8]" />}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

export default BottomNav;
