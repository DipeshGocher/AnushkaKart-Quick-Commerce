import React, { lazy, useMemo, useEffect, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate, useOutlet, useLocation, useNavigationType, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import ProtectedRoute from '../guards/ProtectedRoute';
import RoleGuard from '../guards/RoleGuard';
import { UserRole } from '../constants/roles';
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

// Public Pages
import Auth from '../../modules/seller/pages/Auth';
import ApplicationPending from '../../modules/seller/pages/ApplicationPending';
import AdminAuth from '../../modules/admin/pages/AdminAuth';
import DeliveryAuth from '../../modules/delivery/pages/DeliveryAuth';
import CustomerAuth from '../../modules/customer/pages/CustomerAuth';

import CategoriesPage from '../../modules/customer/pages/CategoriesPage';

// Customer Pages (lazy-loaded)
const Home = lazy(() => import('../../modules/customer/pages/Home'));
const CategoryProductsPage = lazy(() => import('../../modules/customer/pages/CategoryProductsPage'));
const WishlistPage = lazy(() => import('../../modules/customer/pages/WishlistPage'));
const CartPage = lazy(() => import('../../modules/customer/pages/CartPage'));
const OffersPage = lazy(() => import('../../modules/customer/pages/OffersPage'));
const ShopByStorePage = lazy(() => import('../../modules/customer/pages/ShopByStorePage'));
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
const KitDetailPage = lazy(() => import('../../modules/customer/pages/KitDetailPage'));
const CheckoutPage = lazy(() => import('../../modules/customer/pages/CheckoutPage'));
const PaymentStatusPage = lazy(() => import('../../modules/customer/pages/PaymentStatusPage'));
const SearchPage = lazy(() => import('../../modules/customer/pages/SearchPage'));
const ProductsPage = lazy(() => import('../../modules/customer/pages/ProductsPage'));
const WalletPage = lazy(() => import('../../modules/customer/pages/WalletPage'));
const NotificationsPage = lazy(() => import('../../modules/customer/pages/NotificationsPage'));


// Lazy load heavy modules
const SellerModule = lazy(() => import('../../modules/seller/routes/index'));
import AdminRoutes, { adminRoutes } from '../../modules/admin/routes/index';
const DeliveryModule = lazy(() => import('../../modules/delivery/routes/index'));
const DynamicLegalPage = lazy(() => import('../../shared/components/DynamicLegalPage'));

import CustomerLayout from '../../modules/customer/components/layout/CustomerLayout';

const AnimatedCustomerPage = ({ children }) => {
    const location = useLocation();
    const navigationType = useNavigationType();
    const reduceMotion = useReducedMotion();
    const isTabNavigation = navigationType === 'PUSH' && location.state?.pageTransition === 'tab';
    const direction = location.state?.tabDirection === -1 ? -1 : 1;
    const transition = reduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.32, 0.72, 0, 1] };
    const variants = {
        initial: ({ tab, side }) => tab
            ? { left: `${side * 100}vw`, top: 0, opacity: 1 }
            : { left: 0, top: 28, opacity: 0.94 },
        animate: { left: 0, top: 0, opacity: 1 },
        exit: ({ tab, side }) => tab
            ? { left: `${side * -100}vw`, top: 0, opacity: 1 }
            : { left: 0, top: -18, opacity: 0.94 },
    };

    return (
        <AnimatePresence mode="wait" initial={false} custom={{ tab: isTabNavigation, side: direction }}>
            <motion.div
                key={location.pathname}
                custom={{ tab: isTabNavigation, side: direction }}
                variants={variants}
                initial={reduceMotion ? false : 'initial'}
                animate="animate"
                exit={reduceMotion ? undefined : 'exit'}
                transition={transition}
                className="relative w-full flex-1 flex flex-col"
            >
                <Suspense fallback={<PageSkeleton />}>
                    {children}
                </Suspense>
            </motion.div>
        </AnimatePresence>
    );
};

const CustomerLayoutWrapper = () => {
    const outlet = useOutlet();

    useEffect(() => {
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
                                        <AnimatedCustomerPage>{outlet}</AnimatedCustomerPage>
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
    'admin', 'seller', 'delivery', 'unauthorized', 'marketplace', 'api', 
    'login', 'signup', 'categories', 'category', 'product', 'products', 
    'search', 'orders', 'cart', 'wishlist', 'settings', 'profile', 
    'wallet', 'notifications', 'checkout', 'support', 'privacy', 'about', 'offers'
]);

const HierarchicalProductRoute = () => {
    const { headerSlug } = useParams();
    const cleanHeader = String(headerSlug || '').toLowerCase();
    if (cleanHeader && RESERVED_CUSTOMER_SLUGS.has(cleanHeader)) {
        return <Navigate to={`/${cleanHeader}`} replace />;
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
                    path: 'seller/auth',
                    element: <Auth />,
                },
                {
                    path: 'seller/pending-approval',
                    element: <ApplicationPending />,
                },
                {
                    path: 'admin/auth',
                    element: <AdminAuth />,
                },
                {
                    path: 'delivery/auth',
                    element: <DeliveryAuth />,
                },
                // Public legal pages for each module
                {
                    path: 'seller/terms',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="terms" audience="seller" /></Suspense>,
                },
                {
                    path: 'seller/privacy',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="privacy" audience="seller" /></Suspense>,
                },
                {
                    path: 'delivery/support',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="terms" audience="delivery" /></Suspense>,
                },
                {
                    path: 'delivery/privacy',
                    element: <Suspense fallback={<PageSkeleton variant="rows" />}><DynamicLegalPage type="privacy" audience="delivery" /></Suspense>,
                },
                {
                    path: 'seller/*',
                    element: (
                        <ProtectedRoute>
                            <RoleGuard allowedRoles={[UserRole.SELLER]}>
                                <SellerModule />
                            </RoleGuard>
                        </ProtectedRoute>
                    ),
                },
                {
                    path: 'admin',
                    element: (
                        <ProtectedRoute>
                            <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                                <AdminRoutes />
                            </RoleGuard>
                        </ProtectedRoute>
                    ),
                    children: adminRoutes,
                },
                {
                    path: 'delivery/*',
                    element: (
                        <ProtectedRoute>
                            <RoleGuard allowedRoles={[UserRole.DELIVERY]}>
                                <DeliveryModule />
                            </RoleGuard>
                        </ProtectedRoute>
                    ),
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
                        { path: 'kit/:id', element: <KitDetailPage /> },
                        { path: 'support', element: <TermsPage /> },
                        { path: 'privacy', element: <PrivacyPage /> },
                        { path: 'about', element: <AboutPage /> },
                        { path: 'offers', element: <OffersPage /> },
                        { path: 'shop-by-store', element: <ShopByStorePage /> },
                        { path: 'cart', element: <CartPage /> },
                        { path: 'wishlist', element: <ProtectedRoute><WishlistPage /></ProtectedRoute> },
                        { path: 'orders', element: <ProtectedRoute><OrdersPage /></ProtectedRoute> },
                        { path: 'orders/:orderId', element: <ProtectedRoute><OrderDetailPage /></ProtectedRoute> },
                        { path: 'transactions', element: <ProtectedRoute><OrderTransactionsPage /></ProtectedRoute> },
                        { path: 'addresses', element: <ProtectedRoute><AddressesPage /></ProtectedRoute> },
                        { path: 'settings', element: <ProtectedRoute><SettingsPage /></ProtectedRoute> },
                        { path: 'help', element: <ProtectedRoute><SupportPage /></ProtectedRoute> },
                        { path: 'chat', element: <ProtectedRoute><ChatPage /></ProtectedRoute> },
                        { path: 'checkout', element: <ProtectedRoute><CheckoutPage /></ProtectedRoute> },
                        { path: 'payment-status', element: <PaymentStatusPage /> },
                        { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
                        { path: 'profile/edit', element: <ProtectedRoute><EditProfilePage /></ProtectedRoute> },
                        { path: 'wallet', element: <ProtectedRoute><WalletPage /></ProtectedRoute> },
                        { path: 'notifications', element: <ProtectedRoute><NotificationsPage /></ProtectedRoute> },
                        { path: 'products', element: <ProductsPage /> },
                        { path: 'product', element: <ProductsPage /> },
                        { path: 'search', element: <SearchPage /> },
                        { path: ':headerSlug/:categorySlug/:subCategorySlug/:productSlug', element: <HierarchicalProductRoute /> },
                        { path: ':headerSlug/:categorySlug/:productSlug', element: <HierarchicalProductRoute /> },
                        { path: ':headerSlug/:productSlug', element: <HierarchicalProductRoute /> },
                    ]
                },
                {
                    path: '*',
                    element: <Navigate to="/" replace />
                }
            ]
        }
    ]), []);

    return <RouterProvider router={router} />;
};

export default AppRouter;
