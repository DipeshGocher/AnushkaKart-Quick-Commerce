import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, ClipboardList, CircleDollarSign, User } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const isRouteActive = (itemPath, currentPath) => {
  if (itemPath === "/delivery/dashboard") {
    return currentPath === "/delivery" || currentPath === "/delivery/" || currentPath === "/delivery/dashboard";
  }
  if (itemPath === "/delivery/history") {
    return currentPath.startsWith("/delivery/history") || currentPath.startsWith("/delivery/order-details") || currentPath.startsWith("/delivery/confirm-delivery");
  }
  if (itemPath === "/delivery/earnings") {
    return currentPath.startsWith("/delivery/earnings") || currentPath.startsWith("/delivery/cod");
  }
  if (itemPath === "/delivery/profile") {
    return currentPath.startsWith("/delivery/profile") || currentPath.startsWith("/delivery/notifications");
  }
  return currentPath === itemPath;
};

const BottomNav = () => {
  const location = useLocation();

  const navItems = [
    { path: "/delivery/dashboard", label: "Home", icon: Home, hasNotification: false },
    { path: "/delivery/history", label: "Orders", icon: ClipboardList, hasNotification: true },
    { path: "/delivery/earnings", label: "Earnings", icon: CircleDollarSign, hasNotification: false },
    { path: "/delivery/profile", label: "Profile", icon: User, hasNotification: false },
  ];

  return (
    <div 
      className="fixed left-2 right-2 max-w-md mx-auto z-[500] flex items-center justify-center md:hidden pointer-events-auto transition-all duration-300"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {/* White Glass Frosted Glassmorphism Floating Pill Bar */}
      <div className="w-full bg-white/40 backdrop-blur-2xl backdrop-saturate-180 border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-full px-2 py-1.5 ring-1 ring-white/30 flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = isRouteActive(item.path, location.pathname);

          return (
            <Link
              key={item.label}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-2xl transition-all duration-300 flex-1 min-w-[50px] relative",
                isActive
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/20 font-extrabold"
                  : "text-slate-700 hover:text-slate-900 font-semibold hover:bg-white/50"
              )}
            >
              <motion.div
                animate={{ scale: isActive ? 1.1 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="flex items-center justify-center shrink-0 relative"
              >
                <item.icon
                  size={18}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={cn("transition-colors shrink-0", isActive ? "text-orange-400" : "text-slate-700")}
                />
                {item.hasNotification && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-[#FF5722] rounded-full border border-white shadow-xs" />
                )}
              </motion.div>
              <span className={cn(
                "text-[9.5px] whitespace-nowrap leading-none tracking-tight",
                isActive ? "text-white font-black" : "text-slate-800 font-semibold"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
