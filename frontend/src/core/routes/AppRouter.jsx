import React, { lazy, useMemo, useEffect, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate, useOutlet, useLocation, useNavigationType, useParams } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { isLowEndDevice } from '../utils/devicePerformance';
import ProtectedRoute from '../guards/ProtectedRoute';
import lazyWithRetry from '../utils/lazyWithRetry';
import RootErrorBoundary from '../../shared/components/RootErrorBoundary';
import { setActiveRole, ROLES } from '../auth/activeRoleStore';

// Providers for Customer Module
import { WishlistProvider } from '../../modules/customer/context/WishlistContext';
import { CartProvider } from '../../modules/customer/context/CartContext';
import { CartAnimationProvider } from '../../modules/customer/context/CartAnimationContext';
import { ProductDetailProvider } from '../../modules/customer/context/ProductDetailContext';
import { VariantSelectionProvider } from '../../modules/customer/context/VariantSelectionContext';
import { LocationProvider } from '../../modules/customer/context/LocationContext';
import PageSkeleton from '../../shared/components/PageSkeleton';
import ScrollToTop from '../../modules/customer/components/shared/ScrollToTop';

// Seller / admin / delivery code is loaded only when one of those pages is opened,
// so a customer never downloads it (login screens included).
const Auth = lazyWithRetry(() => import('../../modules/seller/pages/Auth'));
const ApplicationPending = lazyWithRetry(() => import('../../modules/seller/pages/ApplicationPending'));
const AdminAuth = lazyWithRetry(() => import('../../modules/admin/pages/AdminAuth'));
const DeliveryAuth = lazyWithRetry(() => import('../../modules/delivery/pages/DeliveryAuth'));
const SellerPanel = lazyWithRetry(() => import('./panels/SellerPanel'));
const AdminPanel = lazyWithRetry(() => import('./panels/AdminPanel'));
const DeliveryPanel = lazyWithRetry(() => import('./panels/DeliveryPanel'));

// Customer public pages (small, needed on the first screen of a logged-out customer)
import CustomerAuth from '../../modules/customer/pages/CustomerAuth';
import VerifyOtpPage from '../../modules/customer/pages/VerifyOtpPage';

// Customer Pages (lazy-loaded)
const CategoriesPage = lazy(() => import('../../modules/customer/pages/CategoriesPage'));
const Home = lazy(() => import('../../modules/customer/pages/Home'));
const CategoryProductsPage = lazy(() => import('../../modules/customer/pages/CategoryProductsPage'));
const WishlistPage = lazy(() => import('../../modules/customer/pages/WishlistPage'));
const CartPage = lazy(() => import('../../modules/customer/pages/CartPage'));
const OffersPage = lazy(() => import('../../modules/customer/pages/OffersPage'));
const ProfilePage = lazy(() => import('../../modules/customer/pages/ProfilePage'));
const OrdersPage = lazy(() => import('../../modules/customer/pages/OrdersPage'));
const OrderTransactionsPage = lazy(() => import('../../modules/customer/pages/OrderTransactionsPage'));
const AddressesPage = lazy(() => import('../../modules/customer/pages/AddressesPage'));
const SettingsPage = lazy(() => import('../../modules/customer/pages/SettingsPage'));
const SupportPage = lazy(() => import('../../modules/customer/pages/SupportPage'));
const ChatPage = lazy(() => import('../../modules/customer/pages/ChatPage'));
const TermsPage = lazy(() => import('../../modules/customer/pages/TermsPage'));
const PrivacyPage = lazy(() => import('../../modules/customer/pages/PrivacyPage'));
const AboutPage = lazy(() => import('../../modules/customer/pages/AboutPage'));
const EditProfilePage = lazy(() => import('../../modules/customer/pages/EditProfilePage'));
const OrderDetailPage = lazy(() => import('../../modules/customer/pages/OrderDetailPage'));
const ProductDetailPage = lazy(() => import('../../modules/customer/pages/ProductDetailPage'));
const CheckoutPage = lazy(() => import('../../modules/customer/pages/CheckoutPage'));
const PaymentPage = lazy(() => import('../../modules/customer/pages/PaymentPage'));
const PaymentStatusPage = lazy(() => import('../../modules/customer/pages/PaymentStatusPage'));
const SearchPage = lazy(() => import('../../modules/customer/pages/SearchPage'));
const ProductsPage = lazy(() => import('../../modules/customer/pages/ProductsPage'));
const StorePage = lazy(() => import('../../modules/customer/pages/StorePage'));
const WalletPage = lazy(() => import('../../modules/customer/pages/WalletPage'));
const NotificationsPage = lazy(() => import('../../modules/customer/pages/NotificationsPage'));
import NotFoundPage from '../../shared/components/NotFoundPage';


const DynamicLegalPage = lazy(() => import('../../shared/components/DynamicLegalPage'));
const DeliveryHelpSupport = lazy(() => import('../../modules/delivery/pages/profile/HelpSupport'));

import CustomerLayout from '../../modules/customer/components/layout/CustomerLayout';

const AnimatedCustomerPage = () => {
    return (
        <div className="w-full flex-1 flex flex-col">
            <Suspense fallback={<PageSkeleton />}>
                <Outlet />
            </Suspense>
        </div>
    );
};

const CustomerLayoutWrapper = () => {
    useEffect(() => {
        const path = window.location.pathname;
        if (
            path.startsWith('/admin') ||
            path.startsWith('/seller') ||
            path.startsWith('/delivery')
        ) {
            return;
        }
        setActiveRole(ROLES.CUSTOMER);
    }, []);

    return (
        <LocationProvider>
                <WishlistProvider>
                    <CartProvider>
                        <CartAnimationProvider>
                            <ProductDetailProvider>
                                <VariantSelectionProvider>
                                    <ScrollToTop />
                                    <CustomerLayout>
                                        <AnimatedCustomerPage />
                                    </CustomerLayout>
                                </VariantSelectionProvider>
                            </ProductDetailProvider>
                        </CartAnimationProvider>
                    </CartProvider>
                </WishlistProvider>
        </LocationProvider>
    );
};

const RESERVED_CUSTOMER_SLUGS = new Set([
    'admin', 'seller', 'delivery', 'unauthorized', 'marketplace', 'api', 'store', 
    'login', 'signup', 'verify-otp', 'categories', 'category', 'product', 'products', 
    'search', 'orders', 'cart', 'wishlist', 'settings', 'profile', 
    'wallet', 'notifications', 'checkout', 'payment', 'support', 'help', 'privacy', 'privacy-policy', 'about', 'offers',
    'terms', 'terms-and-conditions', 'terms-conditions', 'terms&conditions', 'term-and-conditions'
]);

const HierarchicalProductRoute = () => {
    const { headerSlug, '*': splat } = useParams();
    const cleanHeader = String(headerSlug || '').toLowerCase();
    if (cleanHeader && (RESERVED_CUSTOMER_SLUGS.has(cleanHeader) || ['admin', 'seller', 'delivery'].includes(cleanHeader))) {
        return <NotFoundPage />;
    }
    // header/category/[sub-category/]product is at most 4 segments; the splat holds the part after
    // the first two, so more than two extra segments is not a product link.
    const extraSegments = String(splat || '').split('/').filter(Boolean).length;
    if (extraSegments > 2) {
        return <NotFoundPage />;
    }
    return <ProductDetailPage />;
};

const AppRouter = () => {
    const router = useMemo(() => createBrowserRouter([
        {
            path: '/',
            element: <Outlet />,
            errorElement: <RootErrorBoundary />,
            children: [
                {
                    path: 'login',
                    element: <CustomerAuth />,
                },
                {
                    path: 'signup',
                    element: <CustomerAuth />,
                },
                {
                    path: 'verify-otp',
                    element: <VerifyOtpPage />,
                },
                {
                    path: 'seller/auth',
                    element: <Suspense fallback={<PageSkeleton />}><Auth /></Suspense>,
                },
                {
                    path: 'seller/pending-approval',
                    element: <Suspense fallback={<PageSkeleton />}><ApplicationPending /></Suspense>,
                },
                {
                    path: 'admin/auth',
                    element: <Suspense fallback={<PageSkeleton />}><AdminAuth /></Suspense>,
                },
                {
                    path: 'delivery/auth',
                    element: <Suspense fallback={<PageSkeleton />}><DeliveryAuth /></Suspense>,
                },
                // Public legal and support pages for each module
                {
                    path: 'seller/terms',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="terms" audience="seller" /></Suspense>,
                },
                {
                    path: 'seller/terms-and-conditions',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="terms" audience="seller" /></Suspense>,
                },
                {
                    path: 'seller/privacy',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="privacy" audience="seller" /></Suspense>,
                },
                {
                    path: 'seller/privacy-policy',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="privacy" audience="seller" /></Suspense>,
                },
                {
                    path: 'seller/support',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><SupportPage /></Suspense>,
                },
                {
                    path: 'delivery/terms',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="terms" audience="delivery" /></Suspense>,
                },
                {
                    path: 'delivery/terms-and-conditions',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="terms" audience="delivery" /></Suspense>,
                },
                {
                    path: 'delivery/privacy',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="privacy" audience="delivery" /></Suspense>,
                },
                {
                    path: 'delivery/privacy-policy',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="privacy" audience="delivery" /></Suspense>,
                },
                {
                    path: 'privacy/seller',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="privacy" audience="seller" /></Suspense>,
                },
                {
                    path: 'terms/seller',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="terms" audience="seller" /></Suspense>,
                },
                {
                    path: 'privacy/delivery',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="privacy" audience="delivery" /></Suspense>,
                },
                {
                    path: 'terms/delivery',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="terms" audience="delivery" /></Suspense>,
                },
                {
                    path: 'terms',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="terms" audience="customer" /></Suspense>,
                },
                {
                    path: 'terms-and-conditions',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="terms" audience="customer" /></Suspense>,
                },
                {
                    path: 'privacy',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="privacy" audience="customer" /></Suspense>,
                },
                {
                    path: 'privacy-policy',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="privacy" audience="customer" /></Suspense>,
                },
                {
                    path: 'delivery/support',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DeliveryHelpSupport /></Suspense>,
                },
                {
                    path: 'admin/terms',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="terms" audience="customer" /></Suspense>,
                },
                {
                    path: 'admin/terms-and-conditions',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="terms" audience="customer" /></Suspense>,
                },
                {
                    path: 'admin/privacy',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="privacy" audience="customer" /></Suspense>,
                },
                {
                    path: 'admin/privacy-policy',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="privacy" audience="customer" /></Suspense>,
                },
                {
                    path: 'admin/support',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><SupportPage /></Suspense>,
                },
                // Each panel brings its own routes (and its own 404) inside the lazy file.
                {
                    path: 'seller/*',
                    element: <Suspense fallback={<PageSkeleton variant="dashboard" />}><SellerPanel /></Suspense>,
                },
                {
                    path: 'admin/*',
                    element: <Suspense fallback={<PageSkeleton variant="dashboard" />}><AdminPanel /></Suspense>,
                },
                {
                    path: 'delivery/*',
                    element: <Suspense fallback={<PageSkeleton />}><DeliveryPanel /></Suspense>,
                },
                {
                    path: 'unauthorized',
                    element: <div className="flex h-screen items-center justify-center font-outfit">Unauthorized Access</div>,
                },
                {
                    element: <CustomerLayoutWrapper />,
                    children: [
                        { index: true, element: <Home /> },
                        { path: 'categories', element: <CategoriesPage /> },
                        { path: 'category', element: <Navigate to="/categories" replace /> },
                        { path: 'category/sub/:subCategory', element: <CategoryProductsPage /> },
                        { path: 'category/:headerCategory/:mainCategory/:subCategory', element: <CategoryProductsPage /> },
                        { path: 'category/:headerCategory/:mainCategory', element: <CategoryProductsPage /> },
                        { path: 'category/:categoryName', element: <CategoryProductsPage /> },
                        { path: 'product/:id', element: <ProductDetailPage /> },
                        { path: 'kit/:id', element: <Navigate to="/" replace /> },
                        { path: 'support', element: <SupportPage /> },
                        { path: 'help', element: <SupportPage /> },
                        { path: 'terms', element: <TermsPage /> },
                        { path: 'terms-and-conditions', element: <TermsPage /> },
                        { path: 'terms-conditions', element: <TermsPage /> },
                        { path: 'terms&conditions', element: <TermsPage /> },
                        { path: 'term-and-conditions', element: <TermsPage /> },
                        { path: 'privacy', element: <PrivacyPage /> },
                        { path: 'privacy-policy', element: <PrivacyPage /> },
                        { path: 'about', element: <AboutPage /> },
                        { path: 'offers', element: <OffersPage /> },
                        { path: 'cart', element: <CartPage /> },
                        { path: 'wishlist', element: <ProtectedRoute><WishlistPage /></ProtectedRoute> },
                        { path: 'orders', element: <ProtectedRoute><OrdersPage /></ProtectedRoute> },
                        { path: 'orders/:orderId', element: <ProtectedRoute><OrderDetailPage /></ProtectedRoute> },
                        { path: 'transactions', element: <ProtectedRoute><OrderTransactionsPage /></ProtectedRoute> },
                        { path: 'addresses', element: <ProtectedRoute><AddressesPage /></ProtectedRoute> },
                        { path: 'settings', element: <ProtectedRoute><SettingsPage /></ProtectedRoute> },
                        { path: 'chat', element: <ProtectedRoute><ChatPage /></ProtectedRoute> },
                        { path: 'checkout', element: <ProtectedRoute><CheckoutPage /></ProtectedRoute> },
                        { path: 'payment', element: <ProtectedRoute><PaymentPage /></ProtectedRoute> },
                        { path: 'payment-status', element: <PaymentStatusPage /> },
                        { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
                        { path: 'profile/edit', element: <ProtectedRoute><EditProfilePage /></ProtectedRoute> },
                        { path: 'wallet', element: <ProtectedRoute><WalletPage /></ProtectedRoute> },
                        { path: 'notifications', element: <ProtectedRoute><NotificationsPage /></ProtectedRoute> },
                        { path: 'products', element: <ProductsPage /> },
                        { path: 'product', element: <ProductsPage /> },
                        { path: 'store/:sellerId', element: <StorePage /> },
                        { path: 'search', element: <SearchPage /> },
                        // 3 or more segments (header/category/[sub-category/]product): one splat route.
                        // It must stay a splat: route ranking puts it below the seller/*, admin/* and
                        // delivery/* panels, so panel pages with 3-4 segments are never taken by it.
                        { path: ':headerSlug/:categorySlug/*', element: <HierarchicalProductRoute /> },
                        { path: ':headerSlug/:productSlug', element: <HierarchicalProductRoute /> },
                        { path: ':headerSlug', element: <Home /> },
                    ]
                },
                {
                    path: '*',
                    element: <NotFoundPage />
                }
            ]
        }
    ]), []);

    // Weak phones: framer-motion skips slide/scale/layout animations (they jump to the final state)
    // and keeps only fades. Everyone else follows the phone's own "reduce motion" setting.
    return (
        <MotionConfig reducedMotion={isLowEndDevice() ? 'always' : 'user'}>
            <RouterProvider router={router} />
        </MotionConfig>
    );
};

export default AppRouter;
