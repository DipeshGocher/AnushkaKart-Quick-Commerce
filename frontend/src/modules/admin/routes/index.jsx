import React, { useEffect, Suspense } from "react";
import { Outlet, Navigate } from "react-router-dom";
import DashboardLayout from "@shared/layout/DashboardLayout";
import PageSkeleton from "@/shared/components/PageSkeleton";
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
} from "lucide-react";

const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const CategoryManagement = React.lazy(
  () => import("../pages/CategoryManagement"),
);
const HeaderCategories = React.lazy(
  () => import("../pages/categories/HeaderCategories"),
);
const Level2Categories = React.lazy(
  () => import("../pages/categories/Level2Categories"),
);
const SubCategories = React.lazy(
  () => import("../pages/categories/SubCategories"),
);
const CategoryHierarchy = React.lazy(
  () => import("../pages/categories/CategoryHierarchy"),
);
const ProductManagement = React.lazy(
  () => import("../pages/ProductManagement"),
);
const ActiveSellers = React.lazy(() => import("../pages/ActiveSellers"));
const PendingSellers = React.lazy(() => import("../pages/PendingSellers"));
const SellerLocations = React.lazy(() => import("../pages/SellerLocations"));
const ActiveWarehouses = React.lazy(() => import("../pages/ActiveWarehouses"));
const PendingWarehouses = React.lazy(() => import("../pages/PendingWarehouses"));
const ActiveDeliveryBoys = React.lazy(
  () => import("../pages/ActiveDeliveryBoys"),
);
const PendingDeliveryBoys = React.lazy(
  () => import("../pages/PendingDeliveryBoys"),
);
const DeliveryFunds = React.lazy(() => import("../pages/DeliveryFunds"));
const AdminWallet = React.lazy(() => import("../pages/AdminWallet"));
const WithdrawalRequests = React.lazy(
  () => import("../pages/WithdrawalRequests"),
);
const SellerTransactions = React.lazy(
  () => import("../pages/SellerTransactions"),
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
const FleetTracking = React.lazy(() => import("../pages/FleetTracking"));
const CouponManagement = React.lazy(() => import("../pages/CouponManagement"));
const ContentManager = React.lazy(() => import("../pages/ContentManager"));
const HeroCategoriesPerPage = React.lazy(() => import("../pages/HeroCategoriesPerPage"));
const NotificationComposer = React.lazy(
  () => import("../pages/NotificationComposer"),
);
const OffersManagement = React.lazy(
  () => import("../pages/OffersManagement"),
);
const OfferSectionsManagement = React.lazy(
  () => import("../pages/OfferSectionsManagement"),
);
const AdminSettings = React.lazy(() => import("../pages/AdminSettings"));
const AdminProfile = React.lazy(() => import("../pages/AdminProfile"));

const MonthlyBasketCategories = React.lazy(() => import("../pages/MonthlyBasketCategories"));
const MonthlyBasketBanners = React.lazy(() => import("../pages/MonthlyBasketBanners"));
const MonthlyBasketApprovals = React.lazy(() => import("../pages/MonthlyBasketApprovals"));
const EditMonthlyKit = React.lazy(() => import("../pages/EditMonthlyKit"));
const BestsellerManagement = React.lazy(() => import("../pages/BestsellerManagement"));
const FestivalDealsAdmin = React.lazy(() => import("../pages/FestivalDealsAdmin"));

const SOSAlerts = React.lazy(() => import("../pages/SOSAlerts"));

const EmployeeManagement = React.lazy(() => import("../pages/EmployeeManagement"));
const EmployeeDetail = React.lazy(() => import("../pages/EmployeeDetail"));
const WarehouseQueueDashboard = React.lazy(() => import("../pages/WarehouseQueueDashboard"));
const LegalPageEditor = React.lazy(() => import("../pages/LegalPageEditor"));

const navItems = [
  // ── CORE MANAGEMENT ──
  {
    label: "Dashboard",
    path: "/admin",
    icon: LayoutDashboard,
    color: "indigo",
    end: true,
  },
  {
    label: "Categories",
    icon: Tag,
    color: "rose",
    children: [
      { label: "All Categories", path: "/admin/categories/hierarchy" },
      { label: "Header Categories", path: "/admin/categories/header" },
      { label: "Main Categories", path: "/admin/categories/level2" },
      { label: "Sub-Categories", path: "/admin/categories/sub" },
    ],
  },
  { label: "Products", path: "/admin/products", icon: Box, color: "amber" },
  {
    label: "Orders",
    icon: ClipboardList,
    color: "fuchsia",
    children: [
      { label: "All Orders", path: "/admin/orders/all" },
      { label: "New Orders", path: "/admin/orders/pending" },
      { label: "Being Prepared", path: "/admin/orders/processed" },
      { label: "On the Way", path: "/admin/orders/out-for-delivery" },
      { label: "Delivered", path: "/admin/orders/delivered" },
      { label: "Cancelled", path: "/admin/orders/cancelled" },
      { label: "Returned", path: "/admin/orders/returned" },
      { label: "Return Requests", path: "/admin/returns" },
    ],
  },
  {
    label: "Marketing Tools",
    icon: Sparkles,
    color: "amber",
    children: [
      { label: "Send Notifications", path: "/admin/notifications" },
      { label: "Coupons & Promos", path: "/admin/coupons" },
    ],
  },
  {
    label: "Customer Support",
    icon: Receipt,
    color: "emerald",
    children: [
      { label: "Help Tickets", path: "/admin/support-tickets" },
      { label: "Review Content", path: "/admin/moderation" },
    ],
  },
  {
    label: "Sellers",
    icon: Building2,
    color: "blue",
    children: [
      { label: "Active Sellers", path: "/admin/sellers/active" },
      { label: "Waiting for Review", path: "/admin/sellers/pending" },
      { label: "Seller Locations", path: "/admin/seller-locations" },
    ],
  },
  {
    label: "Monthly Baskets",
    icon: Box,
    color: "amber",
    children: [
      { label: "Categories", path: "/admin/monthly-baskets/categories" },
      { label: "Banners", path: "/admin/monthly-baskets/banners" },
      { label: "Approvals", path: "/admin/monthly-baskets/approvals" },
    ],
  },
  {
    label: "Delivery Drivers",
    icon: Truck,
    color: "emerald",
    children: [
      { label: "Active Drivers", path: "/admin/delivery-boys/active" },
      { label: "Waiting for Review", path: "/admin/delivery-boys/pending" },
      { label: "Track Drivers", path: "/admin/tracking" },
      { label: "Send Money", path: "/admin/delivery-funds" },
      { label: "SOS Alerts", path: "/admin/sos-alerts" },
    ],
  },
  { label: "Customers", path: "/admin/customers", icon: Users, color: "sky" },
  { label: "Employees", path: "/admin/employees", icon: UserCheck, color: "green" },
  { label: "Wallet", path: "/admin/wallet", icon: Wallet, color: "violet" },
  {
    label: "Money Requests",
    path: "/admin/withdrawals",
    icon: Banknote,
    color: "cyan",
  },
  {
    label: "Seller Payments",
    path: "/admin/seller-transactions",
    icon: Receipt,
    color: "orange",
  },
  {
    label: "Collect Cash",
    path: "/admin/cash-collection",
    icon: CircleDollarSign,
    color: "green",
  },
  {
    label: "Fees & Charges",
    path: "/admin/billing",
    icon: RotateCcw,
    color: "red",
  },
  {
    label: "Settings",
    path: "/admin/settings",
    icon: Settings,
    color: "slate",
  },
  { label: "My Profile", path: "/admin/profile", icon: User, color: "indigo" },

  // ── SEPARATOR & ADMIN CMS ──
  {
    type: "section",
    label: "Admin CMS",
  },

  // ── CMS PAGES (Banners, new banners, texts & content) ──
  {
    label: "Hero & Page Banners",
    path: "/admin/hero-categories",
    icon: ImageIcon,
    color: "violet",
  },
  {
    label: "Experience Studio",
    path: "/admin/experience-studio",
    icon: Sparkles,
    color: "amber",
  },
  {
    label: "Offer Sections",
    path: "/admin/offer-sections",
    icon: Tag,
    color: "rose",
  },
  {
    label: "Home Content",
    icon: Sparkles,
    color: "purple",
    children: [
      { label: "Bestsellers", path: "/admin/content/bestsellers" },
      { label: "Festival Deals", path: "/admin/content/festival-deals" },
    ],
  },
  {
    label: "FAQs",
    path: "/admin/faqs",
    icon: HelpCircle,
    color: "pink",
  },
  {
    label: "Legal Pages",
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
  { path: "warehouses/active", element: <ActiveWarehouses /> },
  { path: "warehouses/pending", element: <PendingWarehouses /> },
  { path: "warehouse-queues", element: <WarehouseQueueDashboard /> },
  { path: "support-tickets", element: <SupportTickets /> },
  { path: "moderation", element: <ReviewModeration /> },
  { path: "monthly-baskets/categories", element: <MonthlyBasketCategories /> },
  { path: "monthly-baskets/banners", element: <MonthlyBasketBanners /> },
  { path: "monthly-baskets/approvals", element: <MonthlyBasketApprovals /> },
  { path: "monthly-baskets/edit/:id", element: <EditMonthlyKit /> },
  { path: "content/bestsellers", element: <BestsellerManagement /> },
  { path: "content/festival-deals", element: <FestivalDealsAdmin /> },
  { path: "experience-studio", element: <ContentManager /> },
  { path: "hero-categories", element: <HeroCategoriesPerPage /> },
  { path: "notifications", element: <NotificationComposer /> },
  { path: "offers", element: <OffersManagement /> },
  { path: "offer-sections", element: <OfferSectionsManagement /> },
  { path: "coupons", element: <CouponManagement /> },
  { path: "sellers/pending", element: <PendingSellers /> },
  { path: "seller-locations", element: <SellerLocations /> },
  { path: "delivery-boys/active", element: <ActiveDeliveryBoys /> },
  { path: "delivery-boys/pending", element: <PendingDeliveryBoys /> },
  { path: "tracking", element: <FleetTracking /> },
  { path: "delivery-funds", element: <DeliveryFunds /> },
  { path: "sos-alerts", element: <SOSAlerts /> },
  { path: "wallet", element: <AdminWallet /> },
  { path: "withdrawals", element: <WithdrawalRequests /> },
  { path: "seller-transactions", element: <SellerTransactions /> },
  { path: "cash-collection", element: <CashCollection /> },
  { path: "employees", element: <EmployeeManagement /> },
  { path: "employees/:id", element: <EmployeeDetail /> },
  { path: "customers", element: <CustomerManagement /> },
  { path: "customers/:id", element: <CustomerDetail /> },
  { path: "faqs", element: <FAQManagement /> },
  { path: "orders/:status", element: <OrdersList /> },
  { path: "orders/view/:orderId", element: <OrderDetail /> },
  { path: "returns", element: <Returns /> },
  { path: "billing", element: <BillingCharges /> },
  { path: "settings", element: <AdminSettings /> },
  { path: "legal-pages", element: <LegalPageEditor /> },
  { path: "*", element: <Navigate to="/admin" replace /> },
];

const AdminRoutes = () => {
  useEffect(() => {
    setActiveRole(ROLES.ADMIN);
  }, []);

  const { totalUnread } = useSupportUnread();

  const navItemsWithBadges = React.useMemo(() => {
    const count = Number.isFinite(totalUnread) ? totalUnread : 0;
    if (count <= 0) return navItems;
    return navItems.map((item) => {
      if (item?.label !== "Customer Support") return item;
      return { ...item, badgeCount: count };
    });
  }, [totalUnread]);

  return (
    <DashboardLayout navItems={navItemsWithBadges} title="Admin Center">
      <Suspense fallback={<PageSkeleton variant="dashboard" />}>
        <Outlet />
      </Suspense>
    </DashboardLayout>
  );
};

export default AdminRoutes;
