import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { cn } from "@/lib/utils";
import { HiChevronDown } from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const colorMap = {
  indigo:
    "text-brand-600 bg-brand-50 border-brand-100 group-hover:bg-brand-100/50",
  rose: "text-rose-600 bg-rose-50 border-rose-100 group-hover:bg-rose-100/50",
  amber:
    "text-amber-600 bg-amber-50 border-amber-100 group-hover:bg-amber-100/50",
  blue: "text-brand-600 bg-brand-50 border-brand-100 group-hover:bg-brand-100/50",
  emerald:
    "text-brand-600 bg-brand-50 border-brand-100 group-hover:bg-brand-100/50",
  violet:
    "text-violet-600 bg-violet-50 border-violet-100 group-hover:bg-violet-100/50",
  cyan: "text-brand-600 bg-brand-50 border-brand-100 group-hover:bg-brand-100/50",
  orange:
    "text-brand-600 bg-brand-50 border-brand-100 group-hover:bg-brand-100/50",
  green:
    "text-brand-600 bg-brand-50 border-brand-100 group-hover:bg-brand-100/50",
  sky: "text-brand-600 bg-brand-50 border-brand-100 group-hover:bg-brand-100/50",
  pink: "text-brand-600 bg-brand-50 border-brand-100 group-hover:bg-brand-100/50",
  fuchsia:
    "text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100 group-hover:bg-fuchsia-100/50",
  red: "text-red-600 bg-red-50 border-red-100 group-hover:bg-red-100/50",
  slate:
    "text-slate-600 bg-slate-50 border-slate-100 group-hover:bg-slate-100/50",
  dark: "text-gray-800 bg-gray-100 border-gray-200 group-hover:bg-gray-200/50",
};

const SidebarItem = ({
  item,
  isOpen,
  onToggle,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}) => {
  const location = useLocation();
  const badgeCount = Number(item?.badgeCount || 0);
  const badgeLabel = badgeCount > 99 ? "99+" : String(badgeCount);

  const hasChildren = item.children && item.children.length > 0;
  const isChildActive =
    hasChildren &&
    item.children.some((child) => location.pathname === child.path);

  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          onClick={onToggle}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={cn(
            "w-full flex items-center justify-between rounded-lg px-3 pr-12 py-2.5 transition-all duration-300 group relative overflow-hidden",
            isChildActive || isOpen
              ? "bg-black/10 text-[#060606] font-bold ring-1 ring-black/10"
              : "text-[#060606]/80 hover:text-[#060606]",
          )}>
          <AnimatePresence>
            {isHovered && (
              <motion.div
                layoutId="hover-highlight"
                className="absolute inset-0 bg-black/5 rounded-lg -z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
          </AnimatePresence>

          <div className="flex items-center space-x-2.5 z-10">
            <div
              className={cn(
                "p-1.5 rounded-lg transition-all duration-500 shadow-sm",
                isChildActive || isOpen
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/20"
                  : "bg-black/5 text-[#060606]/70 group-hover:bg-black/10 group-hover:text-[#060606]",
              )}>
              {item.icon && <item.icon className="h-4 w-4" />}
            </div>
            <span
              className={cn(
                "text-xs tracking-tight transition-all duration-300 text-[#060606]",
                isChildActive || isOpen ? "font-bold" : "font-semibold",
              )}>
              {item.label}
            </span>
          </div>
          {badgeCount > 0 && !isOpen && (
            <span className="pointer-events-none absolute top-2 right-3 min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-rose-500/30 ring-2 ring-[#FFFDD0]">
              {badgeLabel}
            </span>
          )}
          <div
            className={cn(
              "transition-all duration-300 z-10",
              isOpen
                ? "rotate-180 text-primary"
                : "rotate-0 text-[#060606]/60 group-hover:text-[#060606]",
            )}>
            <HiChevronDown className="h-4 w-4" />
          </div>
        </button>
        {isOpen && (
          <div className="pl-9 pr-3 py-1 space-y-1 animate-in slide-in-from-top-2 fade-in duration-500">
            {item.children.map((child) => {
              const showChildBadge =
                badgeCount > 0 && String(child?.path || "") === "/admin/support-tickets";

              return (
              <NavLink
                key={child.path}
                to={child.path}
                end={child.end !== undefined ? child.end : false}
                className={({ isActive }) =>
                  cn(
                    "block text-xs py-1.5 px-2.5 rounded-lg transition-all duration-300 relative",
                    isActive
                      ? "text-[#060606] font-bold bg-black/10 shadow-sm ring-1 ring-black/5"
                      : "text-[#060606]/75 hover:text-[#060606] hover:bg-black/5",
                    showChildBadge && "pr-9",
                  )
                }>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                    )}
                    {child.label}
                    {showChildBadge && (
                      <span className="pointer-events-none absolute top-1 right-2 min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-rose-500/30 ring-2 ring-[#FFFDD0]">
                        {badgeLabel}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      end={item.end !== undefined ? item.end : false}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={({ isActive }) =>
        cn(
          "flex items-center space-x-2.5 rounded-lg px-3 py-2.5 transition-all duration-300 group relative overflow-hidden",
          isActive
            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
            : "text-[#060606]/85 hover:text-[#060606]",
        )
      }>
      {({ isActive }) => (
        <>
          <AnimatePresence>
            {isHovered && !isActive && (
              <motion.div
                layoutId="hover-highlight"
                className="absolute inset-0 bg-black/5 rounded-lg -z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
          </AnimatePresence>

          <div
            className={cn(
              "p-1.5 rounded-lg transition-all duration-500 shadow-sm z-10",
              isActive
                ? "bg-white/20 text-white"
                : "bg-black/5 text-[#060606]/70 group-hover:bg-black/10 group-hover:text-[#060606]",
            )}>
            {item.icon && <item.icon className="h-4 w-4" />}
          </div>
          <span
            className={cn(
              "text-xs tracking-tight transition-all duration-300 z-10",
              isActive ? "font-bold text-white" : "font-semibold text-[#060606]",
            )}>
            {item.label}
          </span>
          {badgeCount > 0 && (
            <span className="pointer-events-none absolute top-2 right-3 min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-rose-500/30 ring-2 ring-[#FFFDD0] z-10">
              {badgeLabel}
            </span>
          )}
          {isActive && (
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/40 rounded-l-full animate-in slide-in-from-right-1" />
          )}
        </>
      )}
    </NavLink>
  );
};

const SidebarContent = ({ items, title, onClose, openMenu, handleToggle, hoveredIdx, setHoveredIdx }) => {
  const { settings } = useSettings();
  const appName = settings?.appName || 'App';

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 flex h-16 items-center justify-between px-5 border-b border-[#060606]/10 bg-gradient-to-b from-black/[0.02] to-transparent z-10">
        <div className="flex items-center space-x-2.5">
          <div className="h-9 w-9 rounded-xl overflow-hidden shadow-sm ring-1 ring-black/10 group-hover:scale-110 transition-all duration-500 ease-out">
            <img src={settings?.logoUrl || '/logo.png'} alt={appName} className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-[#060606] leading-none">
              {appName}
            </h1>
            <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mt-1 block">
              {title}
            </span>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className="p-2 md:hidden text-[#060606]/60 hover:text-[#060606] transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav
        data-lenis-prevent
        onMouseLeave={() => setHoveredIdx(null)}
        className="mt-4 px-3 space-y-1.5 flex-1 overflow-y-auto overscroll-contain custom-scrollbar min-h-0 pb-6 relative z-20"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <p className="px-3 text-[9px] font-black text-[#060606]/60 uppercase tracking-[0.3em] mb-3">
          Core Management
        </p>
        <AnimatePresence>
          {items.map((item, idx) => {
            if (item.type === "section" || item.isDivider) {
              return (
                <div key={item.key || `section-${idx}`} className="pt-4 pb-1">
                  <div className="border-t border-[#060606]/10 mx-2 mb-3" />
                  <p className="px-3 text-[9px] font-black text-[#060606]/60 uppercase tracking-[0.3em] mb-2 flex items-center gap-1.5">
                    {item.label}
                  </p>
                </div>
              );
            }

            return (
              <SidebarItem
                key={item.path || item.label || idx}
                item={item}
                isOpen={openMenu === item.label}
                onToggle={() => handleToggle(item.label)}
                isHovered={hoveredIdx === idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseEnterWithClose={() => {
                  setHoveredIdx(idx);
                }}
                onMouseLeave={() => { }} // Handle in nav container
              />
            );
          })}
        </AnimatePresence>
      </nav>

      <div className="p-4 border-t border-[#060606]/10 bg-gradient-to-t from-black/[0.02] to-transparent flex-shrink-0">
        <div className="bg-black/[0.04] rounded-lg p-3 shadow-sm border border-[#060606]/10 hover:bg-black/[0.08] hover:border-[#060606]/15 transition-all group cursor-pointer">
          <div className="flex items-center space-x-2.5">
            <div className="relative group">
              <div className="h-8 w-8 rounded-lg overflow-hidden border border-[#060606]/10 shadow-sm group-hover:scale-110 transition-all duration-500">
                <img src={settings?.logoUrl || '/logo.png'} alt={appName} className="h-full w-full object-contain" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-brand-500 rounded-full border-2 border-[#FFFDD0] shadow-sm animate-pulse"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#060606] truncate group-hover:text-primary transition-colors">
                {title?.toLowerCase().includes('seller') ? 'Seller Console' : 'Admin Console'}
              </p>
              <p className="text-[9px] text-[#060606]/60 truncate font-black uppercase tracking-widest">
                {title?.toLowerCase().includes('seller') ? 'Seller' : 'Super Admin'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({ items, title, isOpen, onClose }) => {
  const { role } = useAuth();
  const [openMenu, setOpenMenu] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const handleToggle = (label) => {
    setOpenMenu((prev) => (prev === label ? null : label));
  };

  const commonProps = {
    items,
    title,
    onClose,
    openMenu,
    handleToggle,
    hoveredIdx,
    setHoveredIdx
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        "fixed left-0 inset-y-0 w-72 bg-[#FFFDD0] text-[#060606] border-r border-[#060606]/10 shadow-[8px_0_24px_rgba(0,0,0,0.04)] md:flex flex-col z-50 transition-all duration-300",
        (role === "admin" || role === "seller") ? "hidden md:flex" : "flex",
      )}>
        <SidebarContent {...commonProps} />
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <div className="fixed inset-0 z-[1500] md:hidden">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            />

            {/* Outer Container (Fixed Shell - NO TRANSFORM) */}
            <div className="absolute left-0 inset-y-0 w-72 flex flex-col pointer-events-none">
              {/* Inner Animation Wrapper (TRANSFORM APPLIED HERE) */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
                className="flex-1 bg-[#FFFDD0] shadow-2xl flex flex-col pointer-events-auto min-h-0"
              >
                <SidebarContent {...commonProps} />
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
