import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

/* ── 1. STYLISH HOME ICON (Modern Duotone / Gradient House with Doorway) ── */
const StylishHomeIcon = ({ isActive }) => (
    <div className="relative w-6 h-6 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-transform duration-200">
            <defs>
                <linearGradient id="navHomeGradActive" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="50%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#1D4ED8" />
                </linearGradient>
            </defs>
            {/* Modern curved roof & walls */}
            <path
                d="M3.5 10.4L10.5 4.3C11.37 3.54 12.63 3.54 13.5 4.3L20.5 10.4C21.14 10.95 21.5 11.77 21.5 12.62V18.5C21.5 19.88 20.38 21 19 21H15.5C15.22 21 15 20.78 15 20.5V15.5C15 14.67 14.33 14 13.5 14H10.5C9.67 14 9 14.67 9 15.5V20.5C9 20.78 8.78 21 8.5 21H5C3.62 21 2.5 19.88 2.5 18.5V12.62C2.5 11.77 2.86 10.95 3.5 10.4Z"
                fill={isActive ? "url(#navHomeGradActive)" : "none"}
                stroke={isActive ? "#1D4ED8" : "#3B526B"}
                strokeWidth={isActive ? "1.6" : "2"}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Door Arch */}
            <path
                d="M9.5 21V15.5C9.5 14.95 9.95 14.5 10.5 14.5H13.5C14.05 14.5 14.5 14.95 14.5 15.5V21"
                fill={isActive ? "#FFFFFF" : "none"}
                stroke={isActive ? "#FFFFFF" : "#64748B"}
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity={isActive ? "0.95" : "0.75"}
            />
            {/* Active Glow Window Dot */}
            {isActive && (
                <circle cx="12" cy="8.5" r="1.25" fill="#FFFFFF" opacity="0.9" />
            )}
        </svg>
    </div>
);

/* ── 2. STYLISH CATEGORIES ICON (Modern Bento Grid with Rounded Squircles) ── */
const StylishCategoriesIcon = ({ isActive }) => (
    <div className="relative w-6 h-6 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-transform duration-200">
            <defs>
                <linearGradient id="navCatGradActive" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="100%" stopColor="#1D4ED8" />
                </linearGradient>
            </defs>
            {/* Top-Left Squircle */}
            <rect
                x="3"
                y="3"
                width="7.5"
                height="7.5"
                rx="2.8"
                fill={isActive ? "url(#navCatGradActive)" : "#E2E8F0"}
                stroke={isActive ? "#1D4ED8" : "#3B526B"}
                strokeWidth={isActive ? "1.5" : "1.8"}
            />
            {/* Top-Right Squircle */}
            <rect
                x="13.5"
                y="3"
                width="7.5"
                height="7.5"
                rx="2.8"
                fill={isActive ? "url(#navCatGradActive)" : "#CBD5E1"}
                stroke={isActive ? "#1D4ED8" : "#3B526B"}
                strokeWidth={isActive ? "1.5" : "1.8"}
                fillOpacity={isActive ? "0.85" : "0.5"}
            />
            {/* Bottom-Left Squircle */}
            <rect
                x="3"
                y="13.5"
                width="7.5"
                height="7.5"
                rx="2.8"
                fill={isActive ? "url(#navCatGradActive)" : "#CBD5E1"}
                stroke={isActive ? "#1D4ED8" : "#3B526B"}
                strokeWidth={isActive ? "1.5" : "1.8"}
                fillOpacity={isActive ? "0.85" : "0.5"}
            />
            {/* Bottom-Right Squircle */}
            <rect
                x="13.5"
                y="13.5"
                width="7.5"
                height="7.5"
                rx="2.8"
                fill={isActive ? "url(#navCatGradActive)" : "#E2E8F0"}
                stroke={isActive ? "#1D4ED8" : "#3B526B"}
                strokeWidth={isActive ? "1.5" : "1.8"}
            />
            {/* Active Center Sparkle */}
            {isActive && (
                <circle cx="6.75" cy="6.75" r="1.2" fill="#FFFFFF" />
            )}
        </svg>
    </div>
);

/* ── 3. STYLISH PRODUCTS ICON (Modern Shopping Tote / Storefront Bag) ── */
const StylishProductsIcon = ({ isActive }) => (
    <div className="relative w-6 h-6 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-transform duration-200">
            <defs>
                <linearGradient id="navProdGradActive" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="50%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#1D4ED8" />
                </linearGradient>
            </defs>
            {/* Bag Body with rounded corners */}
            <path
                d="M4.5 8.5C4.5 7.4 5.4 6.5 6.5 6.5H17.5C18.6 6.5 19.5 7.4 19.5 8.5V17.5C19.5 19.43 17.93 21 16 21H8C6.07 21 4.5 19.43 4.5 17.5V8.5Z"
                fill={isActive ? "url(#navProdGradActive)" : "none"}
                stroke={isActive ? "#1D4ED8" : "#3B526B"}
                strokeWidth={isActive ? "1.6" : "2"}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Curved Handle */}
            <path
                d="M8.5 7.5V5.5C8.5 3.57 10.07 2 12 2C13.93 2 15.5 3.57 15.5 5.5V7.5"
                stroke={isActive ? "#1D4ED8" : "#3B526B"}
                strokeWidth={isActive ? "2.2" : "2"}
                strokeLinecap="round"
            />
            {/* Front Detail (Star / Pocket Notch) */}
            {isActive ? (
                <path
                    d="M10 13L12 11L14 13M12 11.5V16"
                    stroke="#FFFFFF"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ) : (
                <path
                    d="M9 11.5C9 13.1569 10.3431 14.5 12 14.5C13.6569 14.5 15 13.1569 15 11.5"
                    stroke="#3B526B"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                />
            )}
        </svg>
    </div>
);

/* ── 4. STYLISH PROFILE ICON (Modern Avatar Silhouette with Depth) ── */
const StylishProfileIcon = ({ isActive }) => (
    <div className="relative w-6 h-6 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-transform duration-200">
            <defs>
                <linearGradient id="navUserGradActive" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="50%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#1E40AF" />
                </linearGradient>
            </defs>
            {/* Head Circle */}
            <circle
                cx="12"
                cy="7.5"
                r="4.2"
                fill={isActive ? "url(#navUserGradActive)" : "none"}
                stroke={isActive ? "#1D4ED8" : "#3B526B"}
                strokeWidth={isActive ? "1.6" : "2"}
            />
            {/* Head Highlight */}
            {isActive && (
                <circle cx="13.3" cy="6.2" r="1.1" fill="#FFFFFF" opacity="0.9" />
            )}
            {/* Shoulders / Torso */}
            <path
                d="M4.5 19.5C4.5 16.18 7.85 13.5 12 13.5C16.15 13.5 19.5 16.18 19.5 19.5C19.5 20.33 18.83 21 18 21H6C5.17 21 4.5 20.33 4.5 19.5Z"
                fill={isActive ? "url(#navUserGradActive)" : "none"}
                stroke={isActive ? "#1D4ED8" : "#3B526B"}
                strokeWidth={isActive ? "1.6" : "2"}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Collar Accent */}
            {isActive && (
                <path
                    d="M10 14L12 16.5L14 14"
                    stroke="#FFFFFF"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.9"
                />
            )}
        </svg>
    </div>
);

/* ── 5. MIDDLE CART BUTTON (Unchanged Orange-Skyblue Glowing Circle) ── */
const MiddleCartButton = ({ isActive, count }) => {
    return (
        <div className="relative -mt-5 flex flex-col items-center justify-center select-none group pointer-events-auto cursor-pointer">
            <motion.div
                whileTap={{ scale: 0.93 }}
                whileHover={{ scale: 1.05 }}
                className="relative flex flex-col items-center justify-center w-[54px] h-[54px] rounded-full shadow-[0_6px_20px_rgba(255,122,0,0.32),0_2px_8px_rgba(2,132,199,0.25)] border-2 border-white transition-transform duration-200 pointer-events-auto"
                style={{
                    background: 'linear-gradient(135deg, #FFA94D 0%, #FF7A00 42%, #38BDF8 85%, #0284C7 100%)',
                }}
            >
                {/* Glossy glass reflection overlay */}
                <div 
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 50%, rgba(0,0,0,0.1) 100%)',
                    }}
                />

                {/* Shopping Cart Icon */}
                <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white drop-shadow-xs relative z-10 transition-transform group-hover:scale-105"
                >
                    <circle cx="8" cy="21" r="1" fill="currentColor" />
                    <circle cx="19" cy="21" r="1" fill="currentColor" />
                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                </svg>

                {/* CART Text */}
                <span className="text-[9px] font-black tracking-wider text-white uppercase leading-none mt-0.5 relative z-10 drop-shadow-xs">
                    CART
                </span>

                {/* Notification Badge */}
                {count > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-white px-1 text-[9px] font-black text-[#FF7A00] shadow-sm z-20">
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
        { label: 'Home', renderIcon: (isActive) => <StylishHomeIcon isActive={isActive} />, path: '/' },
        { label: 'Categories', renderIcon: (isActive) => <StylishCategoriesIcon isActive={isActive} />, path: '/categories' },
        { label: 'Cart', path: '/cart', isMiddle: true },
        { label: 'Products', renderIcon: (isActive) => <StylishProductsIcon isActive={isActive} />, path: '/products' },
        { label: 'Profile', renderIcon: (isActive) => <StylishProfileIcon isActive={isActive} />, path: '/profile' },
    ];

    const handleNavClick = (e, item) => {
        if (e) {
            e.stopPropagation();
        }

        // 1. Tapping Home
        if (item.path === '/') {
            if (location.pathname === '/') {
                window.dispatchEvent(new CustomEvent('anushkakart:reset-home-category'));
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            } else {
                navigate('/');
                window.scrollTo({ top: 0, behavior: 'instant' });
                return;
            }
        }

        // 2. Tapping already active tab on other pages: smoothly scroll to top
        if (location.pathname === item.path) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // 3. Navigate immediately
        navigate(item.path);
        window.scrollTo({ top: 0, behavior: 'instant' });
    };

    return (
        <div 
            className="fixed inset-x-0 bottom-0 z-[500] pointer-events-none flex items-center justify-center overflow-visible"
        >
            <nav
                aria-label="Primary navigation"
                className="pointer-events-auto w-full max-w-lg md:max-w-xl mx-auto rounded-t-[28px] md:rounded-[32px] md:mb-2 border-t md:border border-white/85 px-3 pt-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom,0px))] flex items-center justify-between relative shadow-[0_-8px_32px_rgba(15,23,42,0.08)] overflow-visible"
                style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
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
                                className="relative flex flex-col items-center justify-center px-2 cursor-pointer focus:outline-none pointer-events-auto"
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
                                "relative flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1 transition-all duration-150 active:scale-95 focus:outline-none pointer-events-auto group",
                                isActive ? "text-[#1A6FE8]" : "text-[#3B526B]"
                            )}
                            aria-current={isActive ? 'page' : undefined}
                            style={{ touchAction: 'manipulation' }}
                        >
                            {/* Stylish Icon Capsule Container */}
                            <motion.div
                                animate={{ scale: isActive ? 1.06 : 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                className={cn(
                                    "relative flex h-8 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-200",
                                    isActive ? "bg-gradient-to-b from-blue-50/90 to-blue-100/60 shadow-2xs" : "group-hover:bg-slate-50/60"
                                )}
                            >
                                {item.renderIcon(isActive)}
                            </motion.div>

                            {/* Label */}
                            <span className={cn(
                                "text-[11px] whitespace-nowrap leading-none tracking-tight transition-colors",
                                isActive ? "font-bold text-[#1D4ED8]" : "font-semibold text-[#475569]"
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
