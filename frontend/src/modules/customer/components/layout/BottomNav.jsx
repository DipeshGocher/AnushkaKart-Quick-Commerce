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
    if (itemPath === '/profile') {
        return currentPath.startsWith('/profile') || currentPath.startsWith('/orders') || currentPath.startsWith('/wishlist') || currentPath.startsWith('/addresses') || currentPath.startsWith('/settings');
    }
    return currentPath === itemPath || (itemPath !== '/' && currentPath.startsWith(itemPath));
};

const MiddleCartButton = ({ isActive, count }) => {
    return (
        <div className="relative -mt-5 flex flex-col items-center justify-center select-none group pointer-events-none">
            {/* Unique Circular Badge Button with Light Orange & Skyblue Combo */}
            <motion.div
                whileTap={{ scale: 0.93 }}
                whileHover={{ scale: 1.05 }}
                className="relative flex flex-col items-center justify-center w-[52px] h-[52px] rounded-full shadow-[0_6px_20px_rgba(255,122,0,0.32),0_2px_8px_rgba(2,132,199,0.25)] border-2 border-white transition-transform duration-200 pointer-events-auto"
                style={{
                    background: 'linear-gradient(135deg, #FFA94D 0%, #FF7A00 42%, #38BDF8 85%, #0284C7 100%)',
                }}
            >
                {/* Subtle glossy glass reflection overlay */}
                <div 
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 50%, rgba(0,0,0,0.1) 100%)',
                    }}
                />

                {/* Shopping Cart Icon in Crisp White */}
                <svg
                    width="21"
                    height="21"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white drop-shadow-xs relative z-10 transition-transform group-hover:scale-105 pointer-events-none"
                >
                    <circle cx="8" cy="21" r="1" fill="currentColor" />
                    <circle cx="19" cy="21" r="1" fill="currentColor" />
                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                </svg>

                {/* CART Text inside the circle matching reference image's SHARE text */}
                <span className="text-[8.5px] font-black tracking-wider text-white uppercase leading-none mt-0.5 relative z-10 drop-shadow-xs pointer-events-none">
                    CART
                </span>

                {/* Notification Badge if items in cart */}
                {count > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-white px-1 text-[9px] font-black text-[#FF7A00] shadow-sm z-20 pointer-events-none">
                        {count > 99 ? '99+' : count}
                    </span>
                )}
            </motion.div>
        </div>
    );
};

const BottomNav = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { groceryCartCount } = useCart();

    const mainNavItems = [
        { label: 'Home', icon: Home, path: '/' },
        { label: 'Categories', icon: LayoutGrid, path: '/categories' },
        { label: 'Cart', icon: ShoppingBag, path: '/cart', isMiddle: true },
        { label: 'Products', icon: Boxes, path: '/products' },
        { label: 'Profile', icon: User, path: '/profile' },
    ];

    const handleNavClick = (e, item) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const currentIndex = mainNavItems.findIndex((navItem) => isRouteActive(navItem.path, location.pathname));
        const targetIndex = mainNavItems.findIndex((navItem) => navItem.path === item.path);
        const tabDirection = targetIndex < currentIndex ? -1 : 1;

        // 1. Tapping Home
        if (item.path === '/') {
            if (location.pathname === '/') {
                // If already on Home path: reset category back to "All" and scroll smoothly to top
                window.dispatchEvent(new CustomEvent('anushkakart:reset-home-category'));
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            } else {
                // Navigating to Home from another page: pass resetToAll flag and scroll to top
                navigate('/', { state: { pageTransition: 'tab', tabDirection: -1, resetToAll: true } });
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
        }

        // 2. Tapping already active tab on other pages: smoothly scroll to top
        if (location.pathname === item.path) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // 3. Navigate immediately without blocking async delay
        navigate(item.path, { state: { pageTransition: 'tab', tabDirection } });
    };

    return (
        <div 
            className="fixed inset-x-0 bottom-0 z-[500] pointer-events-none flex items-center justify-center"
        >
            <nav
                aria-label="Primary navigation"
                className="pointer-events-auto w-full max-w-lg md:max-w-xl mx-auto rounded-t-[28px] md:rounded-[32px] md:mb-2 border-t md:border border-white/85 px-3 pt-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom,0px))] flex items-center justify-between relative shadow-[0_-8px_32px_rgba(15,23,42,0.08)]"
                style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.76)',
                    backdropFilter: 'blur(24px) saturate(190%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(190%)',
                    boxShadow: '0 -10px 30px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
                }}
            >
                {mainNavItems.map((item) => {
                    const isActive = isRouteActive(item.path, location.pathname);

                    if (item.isMiddle) {
                        return (
                            <button
                                key={item.path}
                                type="button"
                                onClick={(e) => handleNavClick(e, item)}
                                className="relative flex flex-col items-center justify-center px-2 cursor-pointer focus:outline-none"
                                aria-label="Cart"
                                aria-current={isActive ? 'page' : undefined}
                                style={{ touchAction: 'manipulation' }}
                            >
                                <MiddleCartButton isActive={isActive} count={groceryCartCount} />
                            </button>
                        );
                    }

                    return (
                        <button
                            key={item.path}
                            type="button"
                            onClick={(e) => handleNavClick(e, item)}
                            className={cn(
                                "relative flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1 transition-all duration-150 active:scale-95 focus:outline-none",
                                isActive ? "text-[#1A6FE8]" : "text-[#2C4D6C]"
                            )}
                            aria-current={isActive ? 'page' : undefined}
                            style={{ touchAction: 'manipulation' }}
                        >
                            {/* Top rounded blue bar active indicator directly matching reference image */}
                            {isActive && (
                                <motion.span
                                    layoutId="bottomNavActiveBar"
                                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-[3.5px] w-9 rounded-full bg-[#1A6FE8] shadow-xs pointer-events-none"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}

                            <motion.div
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                className="relative flex h-8 w-11 shrink-0 items-center justify-center rounded-full transition-colors pointer-events-none"
                            >
                                <item.icon
                                    size={23}
                                    strokeWidth={isActive ? 2.4 : 2}
                                    fill={item.label === 'Home' && isActive ? "#1A6FE8" : "none"}
                                    stroke={isActive ? "#1A6FE8" : "#2C4D6C"}
                                    className="shrink-0 transition-colors"
                                />
                            </motion.div>
                            <span className={cn(
                                "text-[11px] whitespace-nowrap leading-none tracking-tight transition-colors pointer-events-none",
                                isActive ? "font-bold text-[#1A6FE8]" : "font-semibold text-[#2C4D6C]"
                            )}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};



export default BottomNav;
