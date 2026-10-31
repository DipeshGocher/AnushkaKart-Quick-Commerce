import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, RefreshCw, LayoutDashboard, LogIn } from 'lucide-react';
import Lottie from 'lottie-react';
import emptyBoxAnimation from '@/assets/lottie/Empty box.json';
import { useSettings } from '@core/context/SettingsContext';
import { useAuth } from '@core/context/AuthContext';

const NotFoundPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { settings } = useSettings();
    const { authData, user, isAuthenticated } = useAuth();

    const logoSrc = useMemo(() => {
        return settings?.logoUrl || '/logo.png';
    }, [settings?.logoUrl]);

    const appName = settings?.appName || 'Anushka Connect';

    // Check auth status per portal
    const isAdminLoggedIn = Boolean(authData?.admin || (user?.role && ['admin', 'super_admin', 'sub_admin'].includes(user.role) && isAuthenticated));
    const isSellerLoggedIn = Boolean(authData?.seller || (user?.role === 'seller' && isAuthenticated));
    const isDeliveryLoggedIn = Boolean(authData?.delivery || (user?.role === 'delivery' && isAuthenticated));
    const isWarehouseLoggedIn = Boolean(authData?.warehouse || (user?.role === 'warehouse' && isAuthenticated));

    // Dynamic destination & label according to portal context and login state
    const redirectConfig = useMemo(() => {
        const path = (location.pathname || '').toLowerCase();

        if (path.startsWith('/admin')) {
            if (isAdminLoggedIn) {
                return {
                    target: '/admin',
                    label: 'Back to Admin Dashboard',
                    icon: LayoutDashboard,
                };
            }
            return {
                target: '/admin/auth',
                label: 'Go to Admin Login',
                icon: LogIn,
            };
        }

        if (path.startsWith('/seller')) {
            if (isSellerLoggedIn) {
                return {
                    target: '/seller',
                    label: 'Back to Seller Dashboard',
                    icon: LayoutDashboard,
                };
            }
            return {
                target: '/seller/auth',
                label: 'Go to Seller Login',
                icon: LogIn,
            };
        }

        if (path.startsWith('/delivery')) {
            if (isDeliveryLoggedIn) {
                return {
                    target: '/delivery/dashboard',
                    label: 'Back to Delivery Dashboard',
                    icon: LayoutDashboard,
                };
            }
            return {
                target: '/delivery/auth',
                label: 'Go to Delivery Login',
                icon: LogIn,
            };
        }

        if (path.startsWith('/warehouse')) {
            if (isWarehouseLoggedIn) {
                return {
                    target: '/warehouse',
                    label: 'Back to Warehouse Dashboard',
                    icon: LayoutDashboard,
                };
            }
            return {
                target: '/admin/auth',
                label: 'Go to Login',
                icon: LogIn,
            };
        }

        // Default: Customer Storefront
        return {
            target: '/',
            label: 'Back to Home',
            icon: Home,
        };
    }, [location.pathname, isAdminLoggedIn, isSellerLoggedIn, isDeliveryLoggedIn, isWarehouseLoggedIn]);

    const ActionIcon = redirectConfig.icon;

    return (
        <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-50 via-white to-slate-100 flex flex-col items-center justify-center p-4 font-outfit select-none overflow-y-auto">
            {/* Main Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/60 p-8 text-center border border-slate-100 relative overflow-hidden"
            >
                {/* Decorative top ambient glow */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-orange-500 to-amber-500" />

                {/* Application Logo */}
                <motion.div
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex justify-center mb-4"
                >
                    <img
                        src={logoSrc}
                        alt={appName}
                        className="h-10 max-w-[180px] object-contain drop-shadow-xs"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                </motion.div>

                {/* 404 Lottie Animation */}
                <div className="w-48 h-48 mx-auto -my-2 flex items-center justify-center">
                    <Lottie
                        animationData={emptyBoxAnimation}
                        loop={true}
                        autoplay={true}
                        className="w-full h-full object-contain"
                    />
                </div>

                {/* 404 Headline */}
                <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                >
                    <div className="inline-block px-3 py-1 mb-2 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-xs font-black tracking-widest uppercase">
                        404 • Not Found
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                        Page Not Found
                    </h1>
                    <p className="text-sm text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
                        The page you are looking for doesn't exist or has been moved.
                    </p>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mt-6 space-y-2.5"
                >
                    <button
                        type="button"
                        onClick={() => navigate(redirectConfig.target)}
                        className="w-full bg-gradient-to-r from-primary to-orange-600 hover:from-primary/95 hover:to-orange-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <ActionIcon className="w-4 h-4" />
                        <span>{redirectConfig.label}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-3 px-6 rounded-2xl border border-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                    >
                        <RefreshCw className="w-4 h-4 text-slate-500" />
                        <span>Refresh Page</span>
                    </button>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default NotFoundPage;

