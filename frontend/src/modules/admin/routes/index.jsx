import React, { useEffect, Suspense } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { adminApi } from "../services/adminApi";
import PageSkeleton from "@/shared/components/PageSkeleton";
import NotFoundPage from "@/shared/components/NotFoundPage";
import { useSupportUnread } from "@core/context/SupportUnreadContext";
import { setActiveRole, ROLES } from "@core/auth/activeRoleStore";
import {
  LayoutDashboard,
  Tag,
  Box,
  Building2,
  Truck,
  Wallet,
  Banknote,
  Receipt,
  CircleDollarSign,
  Users,
  HelpCircle,
  ClipboardList,
  RotateCcw,
  Settings,
  Terminal,
  Sparkles,
  User,
  AlertTriangle,
  UserCheck,
  ScrollText,
  Image as ImageIcon,
  Palette,
  Store,
  Calculator,
  CreditCard,
  Undo2,
  ShieldCheck,
} from "lucide-react";

import lazyWithRetry from "@/core/utils/lazyWithRetry";
import { useAuth } from "@core/context/AuthContext";
import { AdminAccessProvider, useAdminAccess } from "../context/AdminAccessContext";
import { filterNavItems, firstAllowedPath, canOpenPath } from "../utils/adminAccess";
import AccessDenied, { AccessLoadError } from "../components/AccessDenied";

// Lazy so the panel shell (sidebar, topbar, icon sets) stays out of the
// customer-facing main bundle.
const DashboardLayout = React.lazy(() => import("@shared/layout/DashboardLayout"));

const LayoutBranding = lazyWithRetry(() => import("../pages/LayoutBranding"));
const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const CategoryManagement = lazyWithRetry(
  () => import("../pages/CategoryManagement"),
);
const HeaderCategories = lazyWithRetry(
  () => import("../pages/categories/HeaderCategories"),
);
const Level2Categories = lazyWithRetry(
  () => import("../pages/categories/Level2Categories"),
);
const SubCategories = lazyWithRetry(
  () => import("../pages/categories/SubCategories"),
);
const CategoryHierarchy = lazyWithRetry(
  () => import("../pages/categories/CategoryHierarchy"),
);
const ProductManagement = React.lazy(
  () => import("../pages/ProductManagement"),
);
const ActiveSellers = React.lazy(() => import("../pages/ActiveSellers"));
const PendingSellers = React.lazy(() => import("../pages/PendingSellers"));
const ActiveDeliveryBoys = React.lazy(
  () => import("../pages/ActiveDeliveryBoys"),
);
const PendingDeliveryBoys = React.lazy(
  () => import("../pages/PendingDeliveryBoys"),
);
const AdminWallet = React.lazy(() => import("../pages/AdminWallet"));
const WithdrawalRequests = React.lazy(
  () => import("../pages/WithdrawalRequests"),
);
const CashCollection = React.lazy(() => import("../pages/CashCollection"));
const CustomerManagement = React.lazy(
  () => import("../pages/CustomerManagement"),
);
const CustomerDetail = React.lazy(() => import("../pages/CustomerDetail"));
const UserManagement = React.lazy(() => import("../pages/UserManagement"));
const Profile = React.lazy(() => import("@/pages/Profile"));
const FAQManagement = React.lazy(() => import("../pages/FAQManagement"));
const OrdersList = React.lazy(() => import("../pages/OrdersList"));
const OrderDetail = React.lazy(() => import("../pages/OrderDetail"));
const Returns = React.lazy(() => import("../pages/Returns"));
const SellerDetail = React.lazy(() => import("../pages/SellerDetail"));
const SupportTickets = React.lazy(() => import("../pages/SupportTickets"));
const ReviewModeration = React.lazy(() => import("../pages/ReviewModeration"));
const CouponManagement = React.lazy(() => import("../pages/CouponManagement"));
const HeroCategoriesPerPage = React.lazy(() => import("../pages/HeroCategoriesPerPage"));
const StoreBannerManager = React.lazy(() => import("../pages/StoreBannerManager"));
const NotificationComposer = React.lazy(
  () => import("../pages/NotificationComposer"),
);
const OffersManagement = React.lazy(
  () => import("../pages/OffersManagement"),
);
const AdminSettings = React.lazy(() => import("../pages/AdminSettings"));
const AdminProfile = React.lazy(() => import("../pages/AdminProfile"));


const SOSAlerts = React.lazy(() => import("../pages/SOSAlerts"));

const EmployeeManagement = React.lazy(() => import("../pages/EmployeeManagement"));
const EmployeeDetail = React.lazy(() => import("../pages/EmployeeDetail"));
const LegalPageEditor = React.lazy(() => import("../pages/LegalPageEditor"));
const DeliveryPincodes = React.lazy(() => import("../pages/DeliveryPincodes"));
const FinanceSettings = React.lazy(() => import("../pages/FinanceSettings"));
const FinanceRequests = React.lazy(() => import("../pages/FinanceRequests"));
const PaymentModes = React.lazy(() => import("../pages/PaymentModes"));
const ReturnModes = React.lazy(() => import("../pages/ReturnModes"));
const StaffAccess = React.lazy(() => import("../pages/StaffAccess"));

const navItems = [
  // ── CORE MANAGEMENT ──
  {
    label: "Dashboard",
    module: "dashboard",
    path: "/admin",
    icon: LayoutDashboard,
    color: "indigo",
    end: true,
  },
  {
    label: "Categories",
    module: "categories",
    icon: Tag,
    color: "rose",
    children: [
      { label: "All Categories", path: "/admin/categories/hierarchy" },
      { label: "Header Categories", path: "/admin/categories/header" },
      { label: "Main Categories", path: "/admin/categories/level2" },
      { label: "Sub-Categories", path: "/admin/categories/sub" },
    ],
  },
  { label: "Products", path: "/admin/products", icon: Box, color: "amber", module: "products" },
  {
    label: "Orders",
    module: "orders",
    icon: ClipboardList,
    color: "fuchsia",
    children: [
      { label: "Active Orders", path: "/admin/orders/active" },
      { label: "Completed Orders", path: "/admin/orders/completed" },
    ],
  },
  {
    label: "Returns",
    module: "returns",
    icon: RotateCcw,
    color: "orange",
    children: [
      { label: "Active Returns", path: "/admin/returns/active" },
      { label: "Completed Returns", path: "/admin/returns/completed" },
    ],
  },
  {
    label: "Marketing Tools",
    icon: Sparkles,
    color: "amber",
    children: [
      { label: "Send Notifications", path: "/admin/notifications", module: "notifications" },
      { label: "Coupons & Promos", path: "/admin/coupons", module: "coupons" },
    ],
  },
  {
    label: "Customer Support",
    icon: Receipt,
    color: "emerald",
    children: [
      { label: "Help Tickets", path: "/admin/support-tickets", module: "support_tickets" },
      { label: "Review Content", path: "/admin/moderation", module: "reviews" },
    ],
  },
  {
    label: "Sellers",
    module: "sellers",
    icon: Building2,
    color: "blue",
    children: [
      { label: "Active Sellers", path: "/admin/sellers/active" },
      { label: "Waiting for Review", path: "/admin/sellers/pending" },
    ],
  },

  {
    label: "Delivery Drivers",
    icon: Truck,
    color: "emerald",
    children: [
      { label: "Active Drivers", path: "/admin/delivery-boys/active", module: "delivery_partners" },
      { label: "Waiting for Review", path: "/admin/delivery-boys/pending", module: "delivery_partners" },
      { label: "SOS Alerts", path: "/admin/sos-alerts", module: "sos_alerts" },
      { label: "Delivery Pincodes", path: "/admin/delivery-pincodes", module: "delivery_pincodes" },
    ],
  },
  {
    label: "Finance (EMI)",
    module: "emi",
    icon: Calculator,
    color: "blue",
    children: [
      { label: "EMI Settings", path: "/admin/emi/settings" },
      { label: "Quotation Requests", path: "/admin/emi/requests" },
    ],
  },
  { label: "Customers", path: "/admin/customers", icon: Users, color: "sky", module: "customers" },
  { label: "Employees", path: "/admin/employees", icon: UserCheck, color: "green", module: "employees" },
  { label: "Wallet", path: "/admin/wallet", icon: Wallet, color: "violet", module: "wallet" },
  {
    label: "Money Requests",
    module: "withdrawals",
    path: "/admin/withdrawals",
    icon: Banknote,
    color: "cyan",
  },
  {
    label: "Collect Cash",
    module: "cash_collection",
    path: "/admin/cash-collection",
    icon: CircleDollarSign,
    color: "green",
  },
  {
    label: "Fees & Charges",
    module: "billing",
    path: "/admin/billing",
    icon: RotateCcw,
    color: "red",
  },
  {
    label: "Payment Modes",
    module: "payment_modes",
    path: "/admin/payment-modes",
    icon: CreditCard,
    color: "emerald",
  },
  {
    label: "Return Modes",
    module: "return_modes",
    path: "/admin/return-modes",
    icon: Undo2,
    color: "amber",
  },
  {
    label: "Settings",
    module: "settings",
    path: "/admin/settings",
    icon: Settings,
    color: "slate",
  },
  { label: "My Profile", path: "/admin/profile", icon: User, color: "indigo" },
  {
    label: "Staff & Roles",
    path: "/admin/staff-access",
    icon: ShieldCheck,
    color: "violet",
    superOnly: true,
  },

  // ── SEPARATOR & ADMIN CMS ──
  {
    type: "section",
    label: "Admin CMS",
  },

  {
    label: "Layout & Branding",
    module: "layout_branding",
    path: "/admin/layout-branding",
    icon: Palette,
    color: "indigo",
  },

  // ── CMS PAGES (Banners, new banners, texts & content) ──
  {
    label: "Hero & Page Banners",
    module: "hero_banners",
    path: "/admin/hero-categories",
    icon: ImageIcon,
    color: "violet",


  },
  {
    label: "Seller Store Banners",
    module: "store_banners",
    path: "/admin/store-banners",
    icon: Store,
    color: "blue",


  },
  {
    label: "FAQs",
    module: "faqs",
    path: "/admin/faqs",
    icon: HelpCircle,
    color: "pink",
  },
  {
    label: "Legal Pages",
    module: "legal_pages",
    path: "/admin/legal-pages",
    icon: ScrollText,
    color: "slate",
  },
];

const BillingCharges = React.lazy(() => import("../pages/BillingCharges"));

export const adminRoutes = [
  { index: true, element: <Dashboard /> },
  { path: "users", element: <UserManagement /> },
  { path: "profile", element: <AdminProfile /> },
  {
    path: "categories",
    element: <Navigate to="/admin/categories/hierarchy" replace />,
  },
  { path: "categories/header", element: <HeaderCategories /> },
  { path: "categories/level2", element: <Level2Categories /> },
  { path: "categories/sub", element: <SubCategories /> },
  { path: "categories/hierarchy", element: <CategoryHierarchy /> },
  { path: "products", element: <ProductManagement /> },
  { path: "sellers/active", element: <ActiveSellers /> },
  { path: "sellers/active/:id", element: <SellerDetail /> },
  { path: "support-tickets", element: <SupportTickets /> },
  { path: "moderation", element: <ReviewModeration /> },
  { path: "monthly-baskets/*", element: <Navigate to="/admin/products" replace /> },
  { path: "content/bestsellers", element: <Navigate to="/admin" replace /> },
  { path: "content/festival-deals", element: <Navigate to="/admin" replace /> },
  { path: "experience-studio", element: <Navigate to="/admin/hero-categories" replace /> },
  { path: "hero-categories", element: <HeroCategoriesPerPage /> },
  { path: "store-banners", element: <StoreBannerManager /> },
  { path: "notifications", element: <NotificationComposer /> },
  { path: "offers", element: <OffersManagement /> },
  { path: "coupons", element: <CouponManagement /> },
  { path: "sellers/pending", element: <PendingSellers /> },
  { path: "seller-locations", element: <Navigate to="/admin/sellers/active" replace /> },
  { path: "delivery-boys/active", element: <ActiveDeliveryBoys /> },
  { path: "delivery-boys/pending", element: <PendingDeliveryBoys /> },
  { path: "tracking", element: <Navigate to="/admin/delivery-boys/active" replace /> },
  { path: "delivery-funds", element: <Navigate to="/admin/withdrawals" replace /> },
  { path: "sos-alerts", element: <SOSAlerts /> },
  { path: "wallet", element: <AdminWallet /> },
  { path: "withdrawals", element: <WithdrawalRequests /> },
  // the Seller Ledger page was removed (the Wallet page shows the totals); old links still land somewhere useful
  { path: "seller-transactions", element: <Navigate to="/admin/wallet" replace /> },
  { path: "cash-collection", element: <CashCollection /> },
  { path: "employees", element: <EmployeeManagement /> },
  { path: "employees/:id", element: <EmployeeDetail /> },
  { path: "customers", element: <CustomerManagement /> },
  { path: "customers/:id", element: <CustomerDetail /> },
  { path: "faqs", element: <FAQManagement /> },
  { path: "orders/view/:orderId", element: <OrderDetail /> },
  // Active / Completed Orders. The old detailed URLs (/orders/pending, /delivered, ...) redirect inside OrdersList.
  { path: "orders/:status", element: <OrdersList /> },
  // Active / Completed Returns. /admin/returns alone redirects to Active Returns inside Returns.
  { path: "returns", element: <Returns /> },
  { path: "returns/:group", element: <Returns /> },
  { path: "billing", element: <BillingCharges /> },
  { path: "payment-modes", element: <PaymentModes /> },
  { path: "return-modes", element: <ReturnModes /> },
  { path: "staff-access", element: <StaffAccess /> },
  { path: "layout-branding", element: <LayoutBranding /> },
  { path: "settings", element: <AdminSettings /> },
  { path: "delivery-pincodes", element: <DeliveryPincodes /> },
  { path: "legal-pages", element: <LegalPageEditor /> },
  { path: "emi", element: <Navigate to="/admin/emi/settings" replace /> },
  { path: "emi/settings", element: <FinanceSettings /> },
  { path: "emi/requests", element: <FinanceRequests /> },
  { path: "*", element: <NotFoundPage /> },
];

const AdminRoutesContent = () => {
  useEffect(() => {
    setActiveRole(ROLES.ADMIN);
  }, []);

  const { logout } = useAuth();
  const adminAccess = useAdminAccess();
  const { totalUnread } = useSupportUnread();
  const { pathname } = useLocation();

  // Role-based access: only the menu items this admin's role includes (the main admin sees all).
  const visibleNavItems = React.useMemo(
    () => filterNavItems(navItems, adminAccess?.access),
    [adminAccess?.access],
  );

  // What needs the admin right now (UPI approvals + new orders, return requests + QC + disputes).
  // Refreshed when the admin moves between pages and once a minute.
  const [navCounts, setNavCounts] = React.useState(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      adminApi
        .getAdminNavCounts()
        .then((res) => alive && setNavCounts(res?.data?.result || null))
        .catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pathname]);

  const navItemsWithBadges = React.useMemo(() => {
    const support = Number.isFinite(totalUnread) ? totalUnread : 0;
    const orders = Number(navCounts?.ordersNeedAction) || 0;
    const returns = Number(navCounts?.returnsNeedAction) || 0;
    if (support <= 0 && orders <= 0 && returns <= 0) return visibleNavItems;
    return visibleNavItems.map((item) => {
      if (item?.label === "Customer Support" && support > 0) return { ...item, badgeCount: support };
      if (item?.label === "Orders" && orders > 0) return { ...item, badgeCount: orders };
      if (item?.label === "Returns" && returns > 0) return { ...item, badgeCount: returns };
      return item;
    });
  }, [totalUnread, navCounts, visibleNavItems]);

  if (adminAccess?.status === "loading" || !adminAccess) {
    return <PageSkeleton variant="dashboard" />;
  }
  if (adminAccess.status === "error") {
    return <AccessLoadError error={adminAccess.error} onLogout={logout} />;
  }

  const allowed = canOpenPath(pathname, adminAccess.access);
  const landingPath = firstAllowedPath(visibleNavItems);
  const isHome = /^\/admin\/?$/.test(pathname);

  // A staff login without the Dashboard opens straight on its first page.
  if (isHome && !allowed && landingPath) {
    return <Navigate to={landingPath} replace />;
  }

  return (
    <Suspense fallback={<PageSkeleton variant="dashboard" />}>
    <DashboardLayout navItems={navItemsWithBadges} title="Admin Center">
      {adminAccess.readOnly && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          View-only access{adminAccess.roleName ? ` (${adminAccess.roleName})` : ""}: you can open your pages but cannot change anything.
        </div>
      )}
      <Suspense fallback={<PageSkeleton variant="dashboard" />}>
        {allowed ? <Outlet /> : <AccessDenied landingPath={landingPath} />}
      </Suspense>
    </DashboardLayout>
    </Suspense>
  );
};

const AdminRoutes = () => (
  <AdminAccessProvider>
    <AdminRoutesContent />
  </AdminAccessProvider>
);

export default AdminRoutes;
