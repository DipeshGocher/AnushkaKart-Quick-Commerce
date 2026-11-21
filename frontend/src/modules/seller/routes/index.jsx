import React, { useEffect, Suspense } from "react";
import { Outlet, Navigate } from "react-router-dom";
import PageSkeleton from "@/shared/components/PageSkeleton";
import NotFoundPage from "@/shared/components/NotFoundPage";
import { setActiveRole, ROLES } from "@core/auth/activeRoleStore";
import Orders from "../pages/Orders";
import {
  HiOutlineSquares2X2,
  HiOutlineCube,
  HiOutlineCurrencyDollar,
  HiOutlineUser,
  HiOutlineTruck,
  HiOutlineArchiveBox,
  HiOutlineMapPin,
} from "react-icons/hi2";

// Lazy so the panel shell (sidebar, topbar, icon sets) stays out of the
// customer-facing main bundle.
const DashboardLayout = React.lazy(() => import("@shared/layout/DashboardLayout"));

const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const ProductManagement = React.lazy(
  () => import("../pages/ProductManagement"),
);
const StockManagement = React.lazy(() => import("../pages/StockManagement"));
const AddProduct = React.lazy(() => import("../pages/AddProduct"));
// Note: Orders is imported eagerly above to avoid dynamic import issues
const Returns = React.lazy(() => import("../pages/Returns"));
const Earnings = React.lazy(() => import("../pages/Earnings"));
const DeliveryTracking = React.lazy(() => import("../pages/DeliveryTracking"));
const Profile = React.lazy(() => import("../pages/Profile"));
const Withdrawals = React.lazy(() => import("../pages/Withdrawals"));

const navItems = [
  { label: "Dashboard", path: "/seller", icon: HiOutlineSquares2X2, end: true },
  { label: "Products", path: "/seller/products", icon: HiOutlineCube },
  { label: "Stock", path: "/seller/inventory", icon: HiOutlineArchiveBox },
  { label: "Orders", path: "/seller/orders", icon: HiOutlineTruck },
  { label: "Returns", path: "/seller/returns", icon: HiOutlineArchiveBox },
  { label: "Track Orders", path: "/seller/tracking", icon: HiOutlineMapPin },
  {
    label: "Money Request",
    path: "/seller/withdrawals",
    icon: HiOutlineCurrencyDollar,
  },
  {
    label: "Earnings",
    path: "/seller/earnings",
    icon: HiOutlineCurrencyDollar,
  },
  { label: "Profile", path: "/seller/profile", icon: HiOutlineUser },
];

export const sellerRoutes = [
  { index: true, element: <Dashboard /> },
  { path: "products", element: <ProductManagement /> },
  { path: "products/add", element: <AddProduct /> },
  { path: "inventory", element: <StockManagement /> },
  { path: "orders", element: <Orders /> },
  { path: "returns", element: <Returns /> },
  { path: "tracking", element: <DeliveryTracking /> },
  // the Sales Reports and Payment History pages were removed; old links still land somewhere useful
  { path: "analytics", element: <Navigate to="/seller" replace /> },
  { path: "transactions", element: <Navigate to="/seller/earnings" replace /> },
  { path: "earnings", element: <Earnings /> },
  { path: "withdrawals", element: <Withdrawals /> },
  { path: "profile", element: <Profile /> },
  { path: "*", element: <NotFoundPage /> },
];

const SellerRoutes = () => {
  useEffect(() => {
    setActiveRole(ROLES.SELLER);
  }, []);

  return (
    <Suspense fallback={<PageSkeleton variant="dashboard" />}>
    <DashboardLayout navItems={navItems} title="Seller Panel">
      <Suspense fallback={<PageSkeleton variant="dashboard" />}>
        <Outlet />
      </Suspense>
    </DashboardLayout>
    </Suspense>
  );
};

export default SellerRoutes;
