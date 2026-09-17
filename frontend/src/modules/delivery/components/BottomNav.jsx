import React from "react";
import { NavLink } from "react-router-dom";
import { Home, ClipboardList, CircleDollarSign, Inbox, User } from "lucide-react";
import { motion } from "framer-motion";

const BottomNav = () => {
  const navItems = [
    { path: "/delivery/dashboard", label: "Home", icon: Home, hasNotification: false },
    { path: "/delivery/history", label: "Orders", icon: ClipboardList, hasNotification: true },
    { path: "/delivery/earnings", label: "Earnings", icon: CircleDollarSign, hasNotification: false },
    { path: "/delivery/profile", label: "Profile", icon: User, hasNotification: false },
  ];

  return (
    <div 
      className="fixed left-3 right-3 max-w-sm mx-auto bg-[#18181b]/90 backdrop-blur-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.5)] rounded-full px-2 py-1.5 flex justify-around items-center z-40 transition-all duration-300 md:hidden"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {navItems.map(({ path, label, icon: Icon, hasNotification }) => (
        <NavLink
          key={label}
          to={path}
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center gap-0.5 transition-all duration-300 rounded-2xl py-1 px-3 flex-1 min-w-[55px] ${
              isActive 
                ? "bg-white text-slate-900 shadow-md font-extrabold" 
                : "text-slate-300 hover:text-white font-medium"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <motion.div
                className="relative flex items-center justify-center shrink-0"
                animate={{ scale: isActive ? 1.1 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Icon 
                  size={18} 
                  strokeWidth={isActive ? 2.5 : 2} 
                  className={isActive ? "text-[#FF5722]" : "text-slate-400"}
                />
                {hasNotification && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#FF5722] rounded-full border border-slate-900 shadow-xs" />
                )}
              </motion.div>
              <span className={`text-[10px] whitespace-nowrap leading-none tracking-tight ${isActive ? "font-black text-slate-900" : "font-medium text-slate-300"}`}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
};

export default BottomNav;
