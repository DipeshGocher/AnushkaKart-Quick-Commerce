import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import DeliveryLayout from "../layout/DeliveryLayout";
import { setActiveRole, ROLES } from "@core/auth/activeRoleStore";
import Splash from "../pages/Splash";
import DeliveryAuth from "../pages/DeliveryAuth";
import Dashboard from "../pages/Dashboard";
import OrderDetails from "../pages/OrderDetails";
import Navigation from "../pages/Navigation";
import DeliveryConfirmation from "../pages/DeliveryConfirmation";
import EarningsPage from "../pages/EarningsPage";
import CodCash from "../pages/CodCash";
import OrderHistory from "../pages/OrderHistory";
import Profile from "../pages/Profile";
import PersonalDetails from "../pages/profile/PersonalDetails";
import VehicleInfo from "../pages/profile/VehicleInfo";
import BankAccount from "../pages/profile/BankAccount";
import Documents from "../pages/profile/Documents";
import SafetyPrivacy from "../pages/profile/SafetyPrivacy";
import Settings from "../pages/profile/Settings";
import HelpSupport from "../pages/profile/HelpSupport";
import Withdrawals from "../pages/profile/Withdrawals";
import Notifications from "../pages/Notifications";
import WarehouseCheckin from "../pages/WarehouseCheckin";

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
  { path: "profile/settings", element: <Settings /> },
  { path: "profile/help-support", element: <HelpSupport /> },
  { path: "profile/withdrawals", element: <Withdrawals /> },
  { path: "profile/cod-cash", element: <CodCash /> },
  { path: "notifications", element: <Notifications /> },
  { path: "warehouse-checkin", element: <WarehouseCheckin /> },
  { path: "*", element: <Navigate to="/delivery/dashboard" replace /> },
];

const DeliveryRoutes = () => {
  useEffect(() => {
    setActiveRole(ROLES.DELIVERY);
  }, []);

  return <DeliveryLayout />;
};

export default DeliveryRoutes;
