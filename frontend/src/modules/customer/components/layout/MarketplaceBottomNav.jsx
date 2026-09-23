import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, MessageCircle, Plus, LayoutGrid, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAuth } from '@core/context/AuthContext';
import { toast } from 'sonner';
import { getC2CChats } from '../../data/c2cMockData';

const isRouteActive = (itemPath, currentPath) => {
    if (itemPath === '/marketplace') {
        return currentPath === '/marketplace' || currentPath === '/marketplace/' || currentPath === '/refurbished' || currentPath === '/refurbished/';
    }
    if (itemPath === '/marketplace/chats') {
        return currentPath.startsWith('/marketplace/chats') || currentPath.startsWith('/refurbished/chats');
    }
    if (itemPath === '/marketplace/sell') {
        return currentPath.startsWith('/marketplace/sell') || currentPath.startsWith('/refurbished/sell');
    }
    if (itemPath === '/marketplace/categories') {
        return currentPath.startsWith('/marketplace/categories');
    }
    if (itemPath === '/marketplace/account') {
        return currentPath.startsWith('/marketplace/account') || currentPath.startsWith('/marketplace/profile') || currentPath.startsWith('/refurbished/account');
    }
    return currentPath === itemPath;
};

const MarketplaceBottomNav = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [hasUnreadChats, setHasUnreadChats] = useState(false);

    useEffect(() => {
        const checkUnread = () => {
            try {
                const chats = getC2CChats();
                const unread = chats.some(c => c.unread === true || Number(c.unread) > 0);
                setHasUnreadChats(unread);
            } catch {
                setHasUnreadChats(false);
            }
        };

        checkUnread();
        window.addEventListener('c2c_chats_updated', checkUnread);
        window.addEventListener('storage', checkUnread);
        return () => {
            window.removeEventListener('c2c_chats_updated', checkUnread);
            window.removeEventListener('storage', checkUnread);
        };
    }, [location.pathname]);

    const navItems = [
        { label: 'Home', icon: Home, path: '/marketplace' },
        { label: 'Chats', icon: MessageCircle, path: '/marketplace/chats', hasUnreadDot: hasUnreadChats, requiresAuth: true },
        { label: 'SELL', isSellButton: true, path: '/marketplace/sell', requiresAuth: true },
        { label: 'Categories', icon: LayoutGrid, path: '/marketplace/categories' },
        { label: 'Account', icon: User, path: '/marketplace/account', requiresAuth: true },
    ];

    const handleNavClick = (e, item) => {
        if (item.requiresAuth && !isAuthenticated) {
            e.preventDefault();
            toast.info(item.isSellButton ? 'Please log in to sell your products' : `Please log in to view ${item.label.toLowerCase()}`);
            navigate('/login', { state: { from: { pathname: item.path } } });
        }
    };

    return (
        <div 
            className="fixed left-0 right-0 max-w-md mx-auto z-[500] flex items-center justify-center pointer-events-auto transition-all duration-300 px-3"
            style={{ bottom: "calc(0.6rem + env(safe-area-inset-bottom, 0px))" }}
        >
            {/* OLX-style C2C Marketplace Bottom Navigation Bar with Center Sell Button */}
            <nav 
                aria-label="C2C Marketplace Navigation"
                className="w-full bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_10px_35px_rgba(15,76,129,0.18)] rounded-3xl px-2 py-1.5 flex items-center justify-around relative"
            >
                {navItems.map((item) => {
                    const isActive = isRouteActive(item.path, location.pathname);

                    // Prominent Center SELL Button
                    if (item.isSellButton) {
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={(e) => handleNavClick(e, item)}
                                className="flex flex-col items-center justify-center -mt-6 group focus:outline-none"
                            >
                                <motion.div
                                    whileHover={{ scale: 1.08 }}
                                    whileTap={{ scale: 0.94 }}
                                    className="relative flex items-center justify-center"
                                >
                                    {/* Glowing outer ring in signature Classic Blue #0F4C81 & amber/cyan */}
                                    <div className="w-14 h-14 rounded-full p-[3px] bg-gradient-to-tr from-[#0F4C81] via-[#155e9e] to-amber-400 shadow-[0_8px_20px_rgba(15,76,129,0.45)] flex items-center justify-center animate-pulse duration-1000">
                                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center transition-all group-hover:bg-blue-50/50">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#0F4C81] to-[#0A365C] text-white flex items-center justify-center shadow-inner">
                                                <Plus size={24} strokeWidth={3} className="transition-transform group-hover:rotate-90 duration-300" />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-wider mt-0.5",
                                    isActive ? "text-[#0F4C81] font-extrabold" : "text-slate-800"
                                )}>
                                    SELL
                                </span>
                            </Link>
                        );
                    }

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={(e) => handleNavClick(e, item)}
                            className={cn(
                                "flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-2xl transition-all duration-200 flex-1 min-w-[50px] relative",
                                isActive
                                    ? "text-[#0F4C81] font-bold"
                                    : "text-slate-500 hover:text-[#0F4C81] font-medium hover:bg-slate-100/60"
                            )}
                        >
                            <motion.div
                                animate={{ scale: isActive ? 1.12 : 1 }}
                                transition={{ type: "spring", stiffness: 450, damping: 20 }}
                                className="flex items-center justify-center shrink-0 relative"
                            >
                                <item.icon
                                    size={20}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    className={cn(
                                        "transition-colors shrink-0",
                                        isActive ? "text-[#0F4C81] fill-blue-50/60" : "text-slate-500"
                                    )}
                                />
                                {item.hasUnreadDot && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
                                )}
                            </motion.div>
                            <span className={cn(
                                "text-[10px] whitespace-nowrap leading-none tracking-tight transition-colors",
                                isActive ? "text-[#0F4C81] font-bold" : "text-slate-600"
                            )}>
                                {item.label}
                            </span>
                            {isActive && (
                                <motion.div
                                    layoutId="c2cNavIndicator"
                                    className="w-1.5 h-1.5 rounded-full bg-[#0F4C81] mt-0.5"
                                />
                            )}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
};

export default MarketplaceBottomNav;
