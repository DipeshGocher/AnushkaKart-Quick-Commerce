import React, { useEffect, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { setActiveRole, ROLES } from "@core/auth/activeRoleStore";
import PageSkeleton from "@/shared/components/PageSkeleton";
import NotFoundPage from "@/shared/components/NotFoundPage";
// Already in the main bundle via AppRouter, so keep it eager.
import DeliveryAuth from "../pages/DeliveryAuth";

// The rider app is code-split so customers don't download it on first load.
const DeliveryLayout = React.lazy(() => import("../layout/DeliveryLayout"));
const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const OrderDetails = React.lazy(() => import("../pages/OrderDetails"));
const Navigation = React.lazy(() => import("../pages/Navigation"));
const DeliveryConfirmation = React.lazy(() => import("../pages/DeliveryConfirmation"));
const EarningsPage = React.lazy(() => import("../pages/EarningsPage"));
const CodCash = React.lazy(() => import("../pages/CodCash"));
const OrderHistory = React.lazy(() => import("../pages/OrderHistory"));
const Profile = React.lazy(() => import("../pages/Profile"));
const PersonalDetails = React.lazy(() => import("../pages/profile/PersonalDetails"));
const VehicleInfo = React.lazy(() => import("../pages/profile/VehicleInfo"));
const BankAccount = React.lazy(() => import("../pages/profile/BankAccount"));
const Documents = React.lazy(() => import("../pages/profile/Documents"));
const SafetyPrivacy = React.lazy(() => import("../pages/profile/SafetyPrivacy"));
const HelpSupport = React.lazy(() => import("../pages/profile/HelpSupport"));
const Withdrawals = React.lazy(() => import("../pages/profile/Withdrawals"));
const Notifications = React.lazy(() => import("../pages/Notifications"));
const WarehouseCheckin = React.lazy(() => import("../pages/WarehouseCheckin"));

export const deliveryRoutes = [
  { index: true, element: <Navigate to="dashboard" replace /> },
  { path: "splash", element: <Navigate to="dashboard" replace /> },
  { path: "auth", element: <DeliveryAuth /> },
  { path: "dashboard", element: <Dashboard /> },
  { path: "order-details/:orderId", element: <OrderDetails /> },
  { path: "navigation", element: <Navigation /> },
  { path: "confirm-delivery/:orderId", element: <DeliveryConfirmation /> },
  { path: "earnings", element: <EarningsPage /> },
  { path: "cod-cash", element: <CodCash /> },
  { path: "history", element: <OrderHistory /> },
  { path: "profile", element: <Profile /> },
  { path: "profile/personal-details", element: <PersonalDetails /> },
  { path: "profile/vehicle-info", element: <VehicleInfo /> },
  { path: "profile/bank-account", element: <BankAccount /> },
  { path: "profile/documents", element: <Documents /> },
  { path: "profile/safety-privacy", element: <SafetyPrivacy /> },
  { path: "profile/help-support", element: <HelpSupport /> },
  { path: "profile/withdrawals", element: <Withdrawals /> },
  { path: "profile/cod-cash", element: <CodCash /> },
  { path: "notifications", element: <Notifications /> },
  { path: "warehouse-checkin", element: <WarehouseCheckin /> },
  { path: "*", element: <NotFoundPage /> },
];

const DeliveryRoutes = () => {
  useEffect(() => {
    setActiveRole(ROLES.DELIVERY);
  }, []);

  return (
    <Suspense fallback={<PageSkeleton />}>
      <DeliveryLayout />
    </Suspense>
  );
};

export default DeliveryRoutes;
