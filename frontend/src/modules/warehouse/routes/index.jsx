import React, { useEffect, Suspense } from "react";
import PageSkeleton from "@/shared/components/PageSkeleton";
import { Routes, Route, Navigate } from "react-router-dom";
import { setActiveRole, ROLES } from "@core/auth/activeRoleStore";
import Orders from "../pages/Orders";
import {
  HiOutlineSquares2X2,
  HiOutlineCube,
  HiOutlineCurrencyDollar,
  HiOutlineUser,
  HiOutlineTruck,
  HiOutlineArchiveBox,
  HiOutlineChartBarSquare,
  HiOutlineCreditCard,
  HiOutlineMapPin,
  HiOutlineBuildingStorefront,
} from "react-icons/hi2";

// Lazy so the panel shell (sidebar, topbar, icon sets) stays out of the
// customer-facing main bundle.
const DashboardLayout = React.lazy(() => import("@shared/layout/DashboardLayout"));

const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const ProductManagement = React.lazy(() => import("../pages/ProductManagement"));
const StockManagement = React.lazy(() => import("../pages/StockManagement"));
const AddProduct = React.lazy(() => import("../pages/AddProduct"));
const Returns = React.lazy(() => import("../pages/Returns"));
const Earnings = React.lazy(() => import("../pages/Earnings"));
const Analytics = React.lazy(() => import("../pages/Analytics"));
const Transactions = React.lazy(() => import("../pages/Transactions"));
const DeliveryTracking = React.lazy(() => import("../pages/DeliveryTracking"));
const Profile = React.lazy(() => import("../pages/Profile"));
const Withdrawals = React.lazy(() => import("../pages/Withdrawals"));
const QRManager = React.lazy(() => import("../pages/QRManager"));
const QueueMonitor = React.lazy(() => import("../pages/QueueMonitor"));

const navItems = [
  { label: "Dashboard", path: "/warehouse", icon: HiOutlineSquares2X2, end: true },
  { label: "Products", path: "/warehouse/products", icon: HiOutlineCube },
  { label: "Stock", path: "/warehouse/inventory", icon: HiOutlineArchiveBox },

  { label: "Orders", path: "/warehouse/orders", icon: HiOutlineTruck },
  { label: "Returns", path: "/warehouse/returns", icon: HiOutlineArchiveBox },
  { label: "Track Orders", path: "/warehouse/tracking", icon: HiOutlineMapPin },
  { label: "Sales Reports", path: "/warehouse/analytics", icon: HiOutlineChartBarSquare },
  { label: "Money Request", path: "/warehouse/withdrawals", icon: HiOutlineCurrencyDollar },
  { label: "Payment History", path: "/warehouse/transactions", icon: HiOutlineCreditCard },
  { label: "Earnings", path: "/warehouse/earnings", icon: HiOutlineCurrencyDollar },
  { label: "Profile", path: "/warehouse/profile", icon: HiOutlineUser },
  { label: "QR Check-in", path: "/warehouse/qr-manager", icon: HiOutlineMapPin },
  { label: "Queue Monitor", path: "/warehouse/queue-monitor", icon: HiOutlineBuildingStorefront },
];

const WarehouseRoutes = () => {
  useEffect(() => {
    setActiveRole(ROLES.WAREHOUSE);
  }, []);

  return (
    <Suspense fallback={<PageSkeleton variant="dashboard" />}>
    <DashboardLayout navItems={navItems} title="Warehouse Panel">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<ProductManagement />} />
        <Route path="/products/add" element={<AddProduct />} />

        <Route path="/inventory" element={<StockManagement />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/tracking" element={<DeliveryTracking />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/earnings" element={<Earnings />} />
        <Route path="/withdrawals" element={<Withdrawals />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/qr-manager" element={<QRManager />} />
        <Route path="/queue-monitor" element={<QueueMonitor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
    </Suspense>
  );
};

export default WarehouseRoutes;
