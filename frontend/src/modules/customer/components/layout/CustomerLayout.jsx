import React, { useEffect } from 'react';
import Header from './Header';
import Footer from './Footer';
import BottomNav from './BottomNav';
import MiniCart from '../shared/MiniCart';
import ProductDetailSheet from '../shared/ProductDetailSheet';
import VariantSelectionSheet from '../shared/VariantSelectionSheet';
import MobileFooterMessage from './MobileFooterMessage';
import { useProductDetail } from '../../context/ProductDetailContext';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { onReturnPickupOtp, onReturnDropOtp } from '@core/services/orderSocket';
import { toast } from 'sonner';
import { ShieldCheck, Package } from 'lucide-react';
import { setStatusBarColor } from '@/core/utils/statusBar';


const CustomerLayout = ({ children, showHeader: showHeaderProp, fullHeight = false, showCart: showCartProp, showBottomNav: showBottomNavProp }) => {
    const location = useLocation();
    const { isOpen: isProductDetailOpen } = useProductDetail();
    const { user, token } = useAuth();

    // Listen for Return OTPs (Real-time Alert for Customer)
    useEffect(() => {
        if (!token || !user) return;

        const cleanupPickup = onReturnPickupOtp(() => token, (payload) => {
            console.log('[CustomerLayout] Return Pickup OTP Received:', payload);
            toast.custom((t) => (
                <div className="bg-white border-2 border-brand-600 rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-full duration-500 max-w-md w-full">
                    <div className="flex items-start gap-4">
                        <div className="h-12 w-12 bg-brand-100 rounded-2xl flex items-center justify-center text-brand-600 shrink-0">
                            <ShieldCheck size={28} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-black text-slate-900 leading-tight mb-1">Return Pickup OTP</h3>
                            <p className="text-sm text-slate-500 font-medium mb-3">
                                Share this code with the delivery partner to confirm your return pickup.
                            </p>
                            <div className="flex items-center gap-2">
                                <span className="text-3xl font-black tracking-[0.2em] text-brand-600 bg-brand-50 px-4 py-2 rounded-xl border border-brand-100">
                                    {payload.otp}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ), { duration: 15000, position: 'top-center' });
        });

        const cleanupDrop = onReturnDropOtp(() => token, (payload) => {
            console.log('[CustomerLayout] Return Drop OTP Received:', payload);
            toast.custom((t) => (
                <div className="bg-white border-2 border-green-600 rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-full duration-500 max-w-md w-full">
                    <div className="flex items-start gap-4">
                        <div className="h-12 w-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 shrink-0">
                            <Package size={28} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-black text-slate-900 leading-tight mb-1">Return Received Alert</h3>
                            <p className="text-sm text-slate-500 font-medium mb-3">
                                Use this code to confirm that your return has reached the seller.
                            </p>
                            <div className="flex items-center gap-2">
                                <span className="text-3xl font-black tracking-[0.2em] text-green-600 bg-green-50 px-4 py-2 rounded-xl border border-green-100">
                                    {payload.otp}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ), { duration: 15000, position: 'top-center' });
        });

        return () => {
            cleanupPickup();
            cleanupDrop();
        };
    }, [token, user]);

    // Route-based visibility logic
    const path = location.pathname.replace(/\/$/, '') || '/';

    const hideHeaderRoutes = [
        '/', '/categories', '/orders', '/transactions',
        '/profile', '/profile/edit', '/wishlist', '/addresses', '/wallet', '/help', 
        '/privacy', '/privacy-policy', '/about', '/support', '/checkout',
        '/terms', '/terms-and-conditions', '/terms-conditions', '/terms&conditions', '/term-and-conditions',
        '/search', '/chat', '/notifications', '/cart'
    ];
    const hideBottomNavRoutes = ['/checkout', '/search', '/chat'];
    const hideCartRoutes = ['/checkout', '/search', '/chat'];

    const pathSegments = path.split('/').filter(Boolean);
    const isHeaderCategoryRoute = pathSegments.length === 1 && !hideHeaderRoutes.includes(path) && !['offers'].includes(pathSegments[0]);
    const isHierarchicalProduct = Boolean(new URLSearchParams(location.search).get('id') || (pathSegments.length >= 2 && !['category', 'orders', 'profile', 'seller', 'admin', 'delivery'].includes(pathSegments[0])));
    const showHeader = showHeaderProp !== undefined ? showHeaderProp : (!hideHeaderRoutes.includes(path) && !isHeaderCategoryRoute && !path.startsWith('/category') && !path.startsWith('/orders') && !path.startsWith('/products') && !path.startsWith('/product') && !isHierarchicalProduct);
    const showBottomNav = showBottomNavProp !== undefined ? showBottomNavProp : !hideBottomNavRoutes.includes(path);
    const showCart = showCartProp !== undefined ? showCartProp : (!hideCartRoutes.includes(path) && !path.startsWith('/orders'));

    // Synchronize Mobile Status Bar (Android / Flutter WebView / PWA)
    useEffect(() => {
        // Priority 1: When Product Detail Sheet is open, match its header color with parent route
        if (isProductDetailOpen) {
            const currentPath = location.pathname.replace(/\/$/, '') || '/';
            let sheetColor = '#0ea5e9';
            if (currentPath.startsWith('/category/')) {
                sheetColor = '#028ce8';
            } else if (currentPath === '/' || isHeaderCategoryRoute) {
                const activeHomeColor = typeof document !== 'undefined'
                    ? document.documentElement.style.getPropertyValue('--customer-header-base-color')?.trim()
                    : null;
                sheetColor = activeHomeColor || '#0A24AC';
            }
            setStatusBarColor(sheetColor, false);
            return;
        }

        const currentPath = location.pathname.replace(/\/$/, '') || '/';

        // Priority 2: Pure White Header Pages (Profile, Orders, Cart, Categories, Search, etc.)
        const whiteHeaderRoutes = [
            '/profile', '/profile/edit', '/categories', '/cart', '/search',
            '/orders', '/transactions', '/addresses', '/wishlist', '/wallet',
            '/settings', '/help', '/support', '/about', '/privacy', '/privacy-policy',
            '/terms', '/terms-and-conditions', '/terms-conditions', '/terms&conditions', '/term-and-conditions',
            '/checkout', '/notifications', '/chat', '/offers'
        ];

        const isWhiteHeader = whiteHeaderRoutes.some(
            (r) => currentPath === r || currentPath.startsWith('/orders/')
        );

        if (isWhiteHeader) {
            setStatusBarColor('#FFFFFF', true);
            return;
        }

        // Priority 3: Custom colored section headers
        if (currentPath === '/products') {
            setStatusBarColor('#0ea5e9', false);
            return;
        }

        if (currentPath.startsWith('/category/')) {
            setStatusBarColor('#028ce8', false);
            return;
        }

        // Priority 4: Home page or Header Category page
        if (currentPath === '/' || isHeaderCategoryRoute) {
            const activeHomeColor = document.documentElement.style.getPropertyValue('--customer-header-base-color')?.trim();
            setStatusBarColor(activeHomeColor || '#0A24AC', false);
        }
    }, [location.pathname, location.search, isProductDetailOpen, isHeaderCategoryRoute]);

    // Condition to hide the MobileFooterMessage ("Sab kuchh ek basket mein") on specific pages
    const hideFooterMessageRoutes = ['/profile', '/profile/edit', '/categories'];
    const hideFooterRoutes = ['/categories'];
    const showFooter = showBottomNav && !hideFooterRoutes.includes(path) && !path.startsWith('/categories');
    const showFooterMessage = showBottomNav && !hideFooterMessageRoutes.includes(path) && !path.startsWith('/category') && !path.startsWith('/categories') && !path.startsWith('/products') && !path.startsWith('/product') && !isHierarchicalProduct;

    // Hide elements on mobile only when product detail is open
    // On desktop, we want to keep the header visible even if the modal is open
    const finalShowHeaderMobile = showHeader && !isProductDetailOpen;
    const finalShowBottomNavMobile = showBottomNav && !isProductDetailOpen;
    const finalShowFooterMessageMobile = showFooterMessage && !isProductDetailOpen;
    return (
        <div className="customer-app min-h-screen bg-white flex flex-col font-sans">
            {/* Header logic: Always show on desktop if showHeader is true. On mobile, hide if product detail is open. */}
            {showHeader && (
                <>
                    <div className="hidden md:block">
                        <Header />
                    </div>
                    {finalShowHeaderMobile && (
                        <div className="block md:hidden">
                            <Header />
                        </div>
                    )}
                </>
            )}

            <main className={cn("flex-1 flex flex-col md:pb-0 overflow-x-clip", showHeader ? "pt-[100px] md:pt-[130px]" : "pt-0")}>
                <div className="w-full flex-1 flex flex-col">
                    {children}
                </div>
            </main>

            {showCart && <MiniCart />}
            <ProductDetailSheet />
            <VariantSelectionSheet />

            {/* Footer logic: render only for laptop, desktop, and large screen devices (hidden on mobile, tablet, iPad) */}
            {showFooter && (
                <div className="hidden lg:block mt-auto w-full">
                    <Footer />
                </div>
            )}

            {/* Spacer to push content above the fixed BottomNav (mobile only) */}
            {showBottomNav && !isProductDetailOpen && (
                <div 
                    className="w-full shrink-0 md:hidden" 
                    style={{ height: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }} 
                    aria-hidden="true" 
                />
            )}

            {/* Bottom Nav logic */}
            <div className="md:hidden">
                {showBottomNav && !isProductDetailOpen && (
                    <BottomNav />
                )}
            </div>
        </div>
    );
};

export default CustomerLayout;
