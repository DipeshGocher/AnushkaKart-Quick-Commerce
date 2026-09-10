import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, CalendarCheck, Wallet, User, ShoppingCart } from 'lucide-react';
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
    if (itemPath === '/wallet') {
        return currentPath.startsWith('/wallet');
    }
    if (itemPath === '/profile') {
        return (
            currentPath.startsWith('/profile') ||
            currentPath.startsWith('/addresses') ||
            currentPath.startsWith('/settings') ||
            currentPath.startsWith('/help') ||
            currentPath.startsWith('/support') ||
            currentPath.startsWith('/about') ||
            currentPath.startsWith('/privacy') ||
            currentPath.startsWith('/wishlist') ||
            currentPath.startsWith('/transactions')
        );
    }
    return currentPath === itemPath || (itemPath !== '/' && currentPath.startsWith(itemPath));
};

const BottomNav = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { cartCount } = useCart();

    const leftNavItems = [
        { label: 'Home', icon: Home, path: '/' },
        { label: 'Categories', icon: LayoutGrid, path: '/categories' },
        { label: 'Orders', icon: CalendarCheck, path: '/orders' },
    ];

    const rightNavItems = [
        { label: 'Wallet', icon: Wallet, path: '/wallet' },
        { label: 'Account', icon: User, path: '/profile' },
    ];

    return (
        <div 
            className="fixed left-3 right-3 max-w-md mx-auto z-[500] bg-[#18181b]/90 backdrop-blur-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.5)] rounded-full px-2 py-1.5 md:hidden pointer-events-auto transition-all duration-300"
            style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
            <div className="flex items-center justify-around relative w-full px-1">
                {/* 5 Nav Icons - Spaced evenly across dark glass capsule */}
                <div className="flex items-center justify-around w-full gap-1">
                    {[...leftNavItems, ...rightNavItems].map((item) => {
                        const isActive = isRouteActive(item.path, location.pathname);

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-2xl transition-all duration-300 flex-1 min-w-[50px]",
                                    isActive
                                        ? "bg-white text-slate-900 shadow-md font-extrabold"
                                        : "text-slate-300 hover:text-white font-medium"
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
                                        className={cn("transition-colors shrink-0", isActive ? "text-[var(--primary)]" : "text-slate-400")}
                                    />
                                </motion.div>
                                <span className={cn(
                                    "text-[9.5px] whitespace-nowrap leading-none tracking-tight",
                                    isActive ? "text-slate-900 font-black" : "text-slate-300 font-medium"
                                )}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>

            </div>
        </div>
    );
};

export default BottomNav;

