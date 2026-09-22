import React, { lazy, useMemo, useEffect, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom';
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
import { PageTransitionProvider } from '../../modules/customer/context/PageTransitionContext';
import ScrollToTop from '../../modules/customer/components/shared/ScrollToTop';

// Public Pages
import Auth from '../../modules/seller/pages/Auth';
import ApplicationPending from '../../modules/seller/pages/ApplicationPending';
import AdminAuth from '../../modules/admin/pages/AdminAuth';
import DeliveryAuth from '../../modules/delivery/pages/DeliveryAuth';
import CustomerAuth from '../../modules/customer/pages/CustomerAuth';

// Customer Pages (lazy-loaded)
const Home = lazy(() => import('../../modules/customer/pages/Home'));
const CategoriesPage = lazy(() => import('../../modules/customer/pages/CategoriesPage'));
const RefurbishedProductsPage = lazy(() => import('../../modules/customer/pages/RefurbishedProductsPage'));
const MarketplaceProductsPage = lazy(() => import('../../modules/customer/pages/MarketplaceProductsPage'));
const MarketplaceSearchPage = lazy(() => import('../../modules/customer/pages/MarketplaceSearchPage'));
const MarketplaceCategoriesPage = lazy(() => import('../../modules/customer/pages/MarketplaceCategoriesPage'));
const MarketplaceProductsListingPage = lazy(() => import('../../modules/customer/pages/MarketplaceProductsListingPage'));
const RefurbishedBrandsPage = lazy(() => import('../../modules/customer/pages/RefurbishedBrandsPage'));
const RefurbishedBrandProductsPage = lazy(() => import('../../modules/customer/pages/RefurbishedBrandProductsPage'));
const RefurbishedSearchPage = lazy(() => import('../../modules/customer/pages/RefurbishedSearchPage'));
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
const RefurbishedCheckoutPage = lazy(() => import('../../modules/customer/pages/RefurbishedCheckoutPage'));
const RefurbishedCartPage = lazy(() => import('../../modules/customer/pages/RefurbishedCartPage'));
const PaymentStatusPage = lazy(() => import('../../modules/customer/pages/PaymentStatusPage'));
const SearchPage = lazy(() => import('../../modules/customer/pages/SearchPage'));
const WalletPage = lazy(() => import('../../modules/customer/pages/WalletPage'));
const NotificationsPage = lazy(() => import('../../modules/customer/pages/NotificationsPage'));

// C2C Marketplace Pages (OLX Module)
const C2CProductDetailPage = lazy(() => import('../../modules/customer/pages/c2c/C2CProductDetailPage'));
const C2CSellPage = lazy(() => import('../../modules/customer/pages/c2c/C2CSellPage'));
const C2CChatsPage = lazy(() => import('../../modules/customer/pages/c2c/C2CChatsPage'));
const C2CMyAdsPage = lazy(() => import('../../modules/customer/pages/c2c/C2CMyAdsPage'));
const C2CAccountPage = lazy(() => import('../../modules/customer/pages/c2c/C2CAccountPage'));
const C2CProfilePage = lazy(() => import('../../modules/customer/pages/c2c/C2CProfilePage'));
const C2CEditProfilePage = lazy(() => import('../../modules/customer/pages/c2c/C2CEditProfilePage'));
const C2CMyProductDetailPage = lazy(() => import('../../modules/customer/pages/c2c/C2CMyProductDetailPage'));
const C2CEditProductPage = lazy(() => import('../../modules/customer/pages/c2c/C2CEditProductPage'));
const MarketplaceNotificationPage = lazy(() => import('../../modules/customer/pages/MarketplaceNotificationPage'));

// Lazy load heavy modules
const SellerModule = lazy(() => import('../../modules/seller/routes/index'));
const AdminModule = lazy(() => import('../../modules/admin/routes/index'));
const DeliveryModule = lazy(() => import('../../modules/delivery/routes/index'));
const DynamicLegalPage = lazy(() => import('../../shared/components/DynamicLegalPage'));

import CustomerLayout from '../../modules/customer/components/layout/CustomerLayout';

const CustomerLayoutWrapper = () => {
    useEffect(() => {
        setActiveRole(ROLES.CUSTOMER);
    }, []);

    return (
        <LocationProvider>
            <PageTransitionProvider>
                <WishlistProvider>
                    <CartProvider>
                        <CartAnimationProvider>
                            <ProductDetailProvider>
                                <VariantSelectionProvider>
                                    <ScrollToTop />
                                    <CustomerLayout>
                                        <Suspense fallback={<div className="flex h-screen items-center justify-center font-outfit">Loading...</div>}>
                                            <Outlet />
                                        </Suspense>
                                    </CustomerLayout>
                                </VariantSelectionProvider>
                            </ProductDetailProvider>
                        </CartAnimationProvider>
                    </CartProvider>
                </WishlistProvider>
            </PageTransitionProvider>
        </LocationProvider>
    );
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
                    element: <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}><DynamicLegalPage type="terms" audience="seller" /></Suspense>,
                },
                {
                    path: 'seller/privacy',
                    element: <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}><DynamicLegalPage type="privacy" audience="seller" /></Suspense>,
                },
                {
                    path: 'delivery/support',
                    element: <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}><DynamicLegalPage type="terms" audience="delivery" /></Suspense>,
                },
                {
                    path: 'delivery/privacy',
                    element: <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}><DynamicLegalPage type="privacy" audience="delivery" /></Suspense>,
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
                    path: 'admin/*',
                    element: (
                        <ProtectedRoute>
                            <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                                <AdminModule />
                            </RoleGuard>
                        </ProtectedRoute>
                    ),
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
                        // C2C Marketplace (OLX Module) Routes
                        { path: 'marketplace', element: <MarketplaceProductsPage /> },
                        { path: 'marketplace/product/:id', element: <C2CProductDetailPage /> },
                        { path: 'marketplace/sell', element: <C2CSellPage /> },
                        { path: 'marketplace/chats', element: <C2CChatsPage /> },
                        { path: 'marketplace/categories', element: <MarketplaceCategoriesPage /> },
                        { path: 'marketplace/products', element: <MarketplaceProductsListingPage /> },
                        { path: 'marketplace/account', element: <C2CAccountPage /> },
                        { path: 'marketplace/profile', element: <C2CProfilePage /> },
                        { path: 'marketplace/profile/edit', element: <C2CEditProfilePage /> },
                        { path: 'marketplace/search', element: <MarketplaceSearchPage /> },
                        { path: 'marketplace/notification', element: <MarketplaceNotificationPage /> },
                        { path: 'marketplace/notifications', element: <Navigate to="/marketplace/notification" replace /> },
                        { path: 'marketplace/my-listings', element: <C2CMyAdsPage /> },
                        { path: 'marketplace/my-ads', element: <C2CMyAdsPage /> },
                        { path: 'marketplace/my-listings/product', element: <C2CMyProductDetailPage /> },
                        { path: 'marketplace/my-listings/product/:id', element: <C2CMyProductDetailPage /> },
                        { path: 'marketplace/my-listings/product/:id/edit', element: <C2CEditProductPage /> },
                        { path: 'marketplace/my-listings/myproducts', element: <C2CMyProductDetailPage /> },
                        { path: 'marketplace/my-listings/myproducts/:id', element: <C2CMyProductDetailPage /> },
                        { path: 'marketplace/my-listings/edit', element: <C2CEditProductPage /> },
                        { path: 'marketplace/my-listings/edit/:id', element: <C2CEditProductPage /> },
                        { path: 'marketplace/wishlist', element: <Navigate to="/marketplace/products?view=wishlist" replace /> },
                        { path: 'marketplace/brands', element: <Navigate to="/marketplace" replace /> },
                        { path: 'marketplace/brands/products', element: <Navigate to="/marketplace" replace /> },
                        { path: 'marketplace/cart', element: <Navigate to="/marketplace" replace /> },
                        { path: 'marketplace/checkout', element: <Navigate to="/marketplace" replace /> },

                        // Backwards compatibility redirects for /refurbished -> /marketplace
                        { path: 'refurbished', element: <Navigate to="/marketplace" replace /> },
                        { path: 'refurbished/product/:id', element: <Navigate to="/marketplace" replace /> },
                        { path: 'refurbished/sell', element: <Navigate to="/marketplace/sell" replace /> },
                        { path: 'refurbished/chats', element: <Navigate to="/marketplace/chats" replace /> },
                        { path: 'refurbished/my-ads', element: <Navigate to="/marketplace/my-ads" replace /> },
                        { path: 'refurbished/wishlist', element: <Navigate to="/marketplace/my-ads?tab=wishlist" replace /> },
                        { path: 'refurbished/account', element: <Navigate to="/marketplace/account" replace /> },
                        { path: 'refurbished/search', element: <Navigate to="/marketplace" replace /> },
                        { path: 'refurbished/brands', element: <Navigate to="/marketplace" replace /> },
                        { path: 'refurbished/brands/products', element: <Navigate to="/marketplace" replace /> },
                        { path: 'refurbished/products', element: <Navigate to="/marketplace" replace /> },
                        { path: 'refurbished/cart', element: <Navigate to="/marketplace" replace /> },
                        { path: 'refurbished/checkout', element: <Navigate to="/marketplace" replace /> },
                        { path: 'category/:categoryName', element: <CategoryProductsPage /> },
                        { path: 'product/:id', element: <ProductDetailPage /> },
                        { path: 'kit/:id', element: <KitDetailPage /> },
                        { path: 'support', element: <TermsPage /> },
                        { path: 'privacy', element: <PrivacyPage /> },
                        { path: 'about', element: <AboutPage /> },
                        { path: 'offers', element: <OffersPage /> },
                        { path: 'shop-by-store', element: <ShopByStorePage /> },
                        { path: 'cart', element: <ProtectedRoute><CartPage /></ProtectedRoute> },
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
                        { path: 'search', element: <SearchPage /> },
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
