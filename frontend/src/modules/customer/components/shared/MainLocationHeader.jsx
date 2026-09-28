import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import LocationDrawer from "./LocationDrawer";
import { useLocation } from "../../context/LocationContext";
import { useProductDetail } from "../../context/ProductDetailContext";
import { useSettings } from "@core/context/SettingsContext";
import { cn } from "@/lib/utils";
import { useCart } from "../../context/CartContext";
import { customerApi } from "../../services/customerApi";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { buildMiniCartColor, getCustomerHeaderColor } from "../../utils/headerTheme";
import { CloudRain, Sun, Snowflake, Cloud, CloudLightning, Wind } from 'lucide-react';

const WeatherIconMap = {
    CloudRain,
    Sun,
    Snowflake,
    Cloud,
    CloudLightning,
    Wind
};


// MUI Icons
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SearchIcon from "@mui/icons-material/Search";
import MicIcon from "@mui/icons-material/Mic";
import ChevronDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useTranslation } from "@core/context/LanguageContext";

function CategoryNavColumn({
  cat,
  isActive,
  onCategorySelect,
}) {
  return (
    <motion.div
      layout
      whileTap={{ scale: 0.96 }}
      transition={{
        layout: { type: "spring", stiffness: 520, damping: 38, mass: 0.55 },
      }}
      onClick={() => onCategorySelect && onCategorySelect(cat)}
      className="relative z-[2] flex min-w-[54px] shrink-0 cursor-pointer flex-col items-center gap-1 px-2 pb-2 pt-0.5 snap-start md:min-w-[64px]">
      <div 
        className={cn(
          "relative z-10 flex h-11 w-11 items-center justify-center transition-all duration-300 md:h-12 md:w-12",
          isActive ? "scale-105 opacity-100" : "opacity-90"
        )}
      >
        {typeof cat.icon === "function" ||
          (typeof cat.icon === "object" && cat.icon.$$typeof) ? (
          <cat.icon
            sx={{
              fontSize: isActive ? { xs: 24, md: 28 } : { xs: 20, md: 24 },
              color: "#ffffff",
              transition: "color 0.2s, font-size 0.2s",
            }}
          />
        ) : typeof cat.icon === "string" && !cat.icon.startsWith("http") && !cat.icon.includes("/") ? (
          <span 
            className="transition-all duration-300 drop-shadow-sm" 
            style={{ 
              fontSize: isActive ? '26px' : '22px', 
              filter: isActive ? 'drop-shadow(0 2px 5px rgba(12, 35, 82, 0.28))' : 'none'
            }}
          >
            {cat.icon}
          </span>
        ) : (
          <img
            src={applyCloudinaryTransform(cat.icon, "f_auto,q_auto,w_100")}
            alt={cat.name}
            loading="lazy"
            className="h-9 w-9 md:h-10 md:w-10 object-contain drop-shadow-[0_3px_7px_rgba(14,43,93,0.32)] transition-all duration-300"
          />
        )}
      </div>
      <div className="relative w-full">
        <span
          className={cn(
            "relative z-10 mx-auto block max-w-[72px] truncate px-1 pb-0.5 text-center text-[9px] uppercase tracking-tight md:max-w-[88px] md:text-[10px]",
            isActive ? "font-black" : "font-semibold",
          )}
          style={{
            color: "#ffffff",
            opacity: isActive ? 1 : 0.84,
          }}>
          {cat.name}
        </span>
      </div>
      {isActive && <span className="absolute bottom-0 left-4 right-4 h-[3px] rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />}

    </motion.div>
  );
}

const MainLocationHeader = ({
  categories = [],
  activeCategory,
  onCategorySelect,
}) => {
  const { scrollY } = useScroll();
  const { t, language, setLanguage, languages } = useTranslation();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const desktopLangDropdownRef = useRef(null);
  const mobileLangDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInDesktop = desktopLangDropdownRef.current && desktopLangDropdownRef.current.contains(event.target);
      const clickedInMobile = mobileLangDropdownRef.current && mobileLangDropdownRef.current.contains(event.target);
      
      if (!clickedInDesktop && !clickedInMobile) {
        setIsLangDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isMobileView = typeof window !== "undefined" && window.innerWidth < 768;
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const { currentLocation, refreshLocation, isFetchingLocation } =
    useLocation();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { settings } = useSettings();
  const { cartCount } = useCart();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchUnreadCount = async () => {
      try {
        const token = localStorage.getItem("auth_customer") || localStorage.getItem("token");
        if (!token) return;
        const res = await customerApi.getNotifications({ unreadOnly: true });
        const resData = res?.data;
        const count =
          resData?.result?.unreadCount ??
          (Array.isArray(resData?.result?.notifications) ? resData.result.notifications.length : 0);
        if (isMounted) {
          setUnreadNotificationsCount(Number(count) || 0);
        }
      } catch (err) {
        // silent fallback
      }
    };
    fetchUnreadCount();
    return () => { isMounted = false; };
  }, []);

  const appName = settings?.appName || "App";
  const logoUrl = settings?.logoUrl;
  const navigate = useNavigate();

  // Horizontal scroll for categories navigation
  const navRef = useRef(null);
  const mobileNavRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (navRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = navRef.current;
      setShowLeftArrow(scrollLeft > 5);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 5);
    }
  };

  useEffect(() => {
    const el = navRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll);
      checkScroll();
      window.addEventListener("resize", checkScroll);
      const timer = setTimeout(checkScroll, 300);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
        clearTimeout(timer);
      };
    }
  }, [categories]);

  const handleScroll = (direction) => {
    if (navRef.current) {
      const scrollAmount = direction === "left" ? -180 : 180;
      navRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // Search Logic
  const handleSearchClick = () => {
    navigate("/search");
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      navigate("/search", { state: { query: e.target.value } });
    }
  };

  // Search placeholder animation
  const [searchPlaceholder, setSearchPlaceholder] = useState("Search ");
  const [typingState, setTypingState] = useState({
    textIndex: 0,
    charIndex: 0,
    isDeleting: false,
    isPaused: false,
  });

  const staticText = "Search ";
  const typingPhrases = [
    '"bread"',
    '"milk"',
    '"chocolate"',
    '"eggs"',
    '"chips"',
  ];

  useEffect(() => {
    const { textIndex, charIndex, isDeleting, isPaused } = typingState;
    const currentPhrase = typingPhrases[textIndex];

    if (isPaused) {
      const timeout = setTimeout(() => {
        setTypingState((prev) => ({
          ...prev,
          isPaused: false,
          isDeleting: true,
        }));
      }, 2000); // Pause after full phrase
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          // Typing
          if (charIndex < currentPhrase.length) {
            setSearchPlaceholder(
              staticText + currentPhrase.substring(0, charIndex + 1),
            );
            setTypingState((prev) => ({
              ...prev,
              charIndex: prev.charIndex + 1,
            }));
          } else {
            // Finished typing
            setTypingState((prev) => ({ ...prev, isPaused: true }));
          }
        } else {
          // Deleting
          if (charIndex > 0) {
            setSearchPlaceholder(
              staticText + currentPhrase.substring(0, charIndex - 1),
            );
            setTypingState((prev) => ({
              ...prev,
              charIndex: prev.charIndex - 1,
            }));
          } else {
            // Finished deleting
            setTypingState((prev) => ({
              ...prev,
              isDeleting: false,
              textIndex: (prev.textIndex + 1) % typingPhrases.length,
            }));
          }
        }
      },
      isDeleting ? 50 : 100,
    ); // 50ms deleting speed, 100ms typing speed

    return () => clearTimeout(timeout);
  }, [typingState]);

  // Smooth scroll interpolations
  const headerTopPadding = useTransform(scrollY, [0, 160], [16, 16]);
  const headerBottomPadding = useTransform(scrollY, [0, 160], [4, 4]);
  const headerRoundness = useTransform(scrollY, [0, 160], [0, 0]);
  const bgOpacity = useTransform(scrollY, [0, 160], [1, 1]);

  // Content animations
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const mobileTopHeight = useTransform(scrollY, [0, 22, 108], ["96px", "96px", "0px"]);
  const mobileTopOpacity = useTransform(scrollY, [0, 30, 95], [1, 1, 0]);

  const contentHeight = useTransform(scrollY, [0, 160], ["64px", "64px"]);
  const contentOpacity = useTransform(scrollY, [0, 160], [1, 1]);
  const mobileNavHeight = useTransform(scrollY, [0, 22, 108], ["80px", "80px", "0px"]);
  const mobileNavOpacity = useTransform(scrollY, [0, 35, 92], [1, 1, 0]);
  const mobileNavMargin = useTransform(scrollY, [0, 22, 108], [8, 8, 0]);
  const mobileNavPointerEvents = useTransform(scrollY, (value) => value >= 92 ? 'none' : 'auto');
  const categorySpacing = useTransform(scrollY, [0, 200], [3, 3]);
  const cartOpacity = useTransform(scrollY, [0, 110, 150], [1, 1, 1]);
  const cartScale = useTransform(scrollY, [0, 110, 150], [1, 1, 1]);

  // Helper to hide elements completely when collapsed to prevent clicks
  const displayContent = useTransform(scrollY, (value) => "block");
  const displayNav = useTransform(scrollY, (value) => "flex");
  const displayCart = useTransform(scrollY, (value) => "block");

  const baseHeaderColor = getCustomerHeaderColor(activeCategory, categories);

  useEffect(() => {
    const c = buildMiniCartColor(baseHeaderColor);
    document.documentElement.style.setProperty("--customer-mini-cart-color", c);
    return () => {
      document.documentElement.style.removeProperty(
        "--customer-mini-cart-color",
      );
    };
  }, [baseHeaderColor]);

  const weatherEnabled = settings?.weather?.isEnabled !== false;
  const ActiveWeatherIcon = settings?.weather?.icon ? WeatherIconMap[settings.weather.icon] : CloudRain;

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[200]">
        <motion.div
          initial={false}
          animate={{ backgroundColor: baseHeaderColor }}
          transition={{ backgroundColor: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
          style={{
            paddingTop: headerTopPadding,
            paddingBottom: headerBottomPadding,
            borderBottomLeftRadius: headerRoundness,
            borderBottomRightRadius: headerRoundness,
            opacity: bgOpacity,
          }}
          className="px-4 overflow-visible transform-gpu will-change-transform border-b border-white/40 shadow-[0_14px_34px_rgba(23,39,78,0.26)] backdrop-blur-xl backdrop-saturate-150">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 12% -18%, rgba(255,255,255,0.42), transparent 45%), radial-gradient(ellipse at 94% 8%, rgba(255,224,174,0.18), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.03) 36%, rgba(8,17,50,0.26) 100%)' }} />
          <div className="absolute inset-x-0 top-0 h-px bg-white/65 pointer-events-none" />
          <svg aria-hidden="true" viewBox="0 0 430 280" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none" style={{ opacity: 0.3 }}>
            <g fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round">
              <path d="M-28 43 C55 8 92 63 163 34 S298 6 461 59" strokeWidth="1.65" />
              <path d="M-20 84 C53 45 128 105 207 69 S352 55 450 103" strokeWidth="1.25" />
              <path d="M-18 191 C79 161 120 205 207 176 S343 150 455 183" strokeWidth="1.55" />
              <path d="M36 239 C103 221 177 259 252 225 S365 208 454 229" strokeWidth="1.2" />
              <path d="M-12 159 C70 143 125 173 204 143 S335 125 451 150" strokeWidth="0.95" opacity="0.75" />
              <path d="M266 12 C307 25 310 47 352 48 M80 126 C116 115 141 123 165 137" strokeWidth="2.6" opacity="0.65" />
            </g>
          </svg>
          <div className="absolute inset-x-0 bottom-0 h-px bg-white/50 pointer-events-none" />

          {/* Desktop/Tablet Header Layout (md and above) */}
          <div className="hidden md:flex items-center justify-between relative z-20 px-2 lg:px-6 mb-8 mt-1">
            {/* Left Section: Logo + Location row */}
            <div className="flex items-center gap-4 lg:gap-8">
              <div
                onClick={() => navigate("/")}
                className="flex items-center gap-3 cursor-pointer group shrink-0">
                <div className="group-hover:scale-110 transition-all duration-300 drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]">
                  <img
                    src={logoUrl || "/logo.png"}
                    alt={`${appName || 'AnushkaStore'} Logo`}
                    loading="lazy"
                    className="h-14 w-auto object-contain"
                  />
                </div>
              </div>

              {/* Weather Widget (Desktop) */}
              {weatherEnabled && (
                <div className="flex items-center gap-1.5 rounded-xl border border-white/35 bg-black/20 px-3 py-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl">
                    {ActiveWeatherIcon && <ActiveWeatherIcon size={16} className="text-white" />}
                    <span className="text-sm font-extrabold text-white">{settings?.weather?.condition || 'Rain'}</span>
                </div>
              )}

              <div className="flex flex-col justify-center rounded-xl border border-white/35 bg-black/20 px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl">
                <div className="flex items-center gap-1 opacity-90">
                  <AccessTimeIcon sx={{ fontSize: 13, color: "#ffffff" }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider leading-none text-white">
                    {currentLocation.time}
                  </span>
                </div>
                <button
                  type="button"
                  data-lenis-prevent
                  data-lenis-prevent-touch
                  onClick={() => {
                    setIsLocationOpen(true);
                  }}
                  className="flex items-center gap-1 text-white cursor-pointer group active:scale-95 transition-all border-0 bg-transparent p-0 text-left">
                  <div className="text-[13px] lg:text-[14px] font-medium leading-tight max-w-[260px] lg:max-w-[340px] truncate text-white">
                    {isFetchingLocation
                      ? "Detecting location..."
                      : currentLocation.name}
                  </div>
                  <ChevronDownIcon
                    sx={{ fontSize: 16, color: "#ffffff" }}
                  />
                </button>
              </div>
            </div>

            {/* Center Section: Highly Visible Search Bar */}
            <div className="flex-1 max-w-[450px] lg:max-w-2xl px-6">
              <motion.div
                onClick={handleSearchClick}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="bg-white rounded-full px-4 h-11 border border-slate-200/90 shadow-[0_4px_18px_rgba(0,0,0,0.08)] flex items-center transition-all duration-200 focus-within:ring-2 focus-within:ring-orange-500/40 cursor-pointer hover:shadow-md hover:border-slate-300">
                <SearchIcon sx={{ color: "#0f172a", fontSize: 20 }} />
                <input
                  type="text"
                  placeholder={searchPlaceholder || "Search Products..."}
                  readOnly
                  className="flex-1 bg-transparent border-none outline-none pl-2 text-slate-900 font-bold placeholder:text-slate-600 text-[15px] cursor-pointer"
                />
                <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                  <MicIcon sx={{ color: "#0f172a", fontSize: 20 }} />
                </div>
              </motion.div>
            </div>

            {/* Right Section: clean icons over the glossy header */}
            <div className="flex items-center gap-3.5 lg:gap-5 shrink-0">
              {/* Cart Button */}
              <motion.button
                whileHover={{ scale: 1.08, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/cart")}
                className="w-10 h-10 flex items-center justify-center relative cursor-pointer text-white drop-shadow-sm"
                title="My Cart"
              >
                <ShoppingCartOutlinedIcon sx={{ fontSize: 24, color: "#ffffff" }} />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#FF5722] text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-transform group-hover:-translate-y-0.5 animate-in zoom-in duration-300">
                    {cartCount}
                  </span>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.08, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/notifications")}
                className="w-10 h-10 flex items-center justify-center relative cursor-pointer text-white drop-shadow-sm"
                title="Notifications"
              >
                <NotificationsNoneOutlinedIcon sx={{ fontSize: 24, color: "#ffffff" }} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#FF5722] text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-transform group-hover:-translate-y-0.5 animate-in zoom-in duration-300">
                    {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                  </span>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/profile")}
                className="w-10 h-10 flex items-center justify-center cursor-pointer text-white drop-shadow-sm"
                title="Profile"
              >
                <AccountCircleOutlinedIcon sx={{ fontSize: 26, color: "#ffffff" }} />
              </motion.button>
            </div>
          </div>

          {/* Mobile Header Layout (MOBILE ONLY) */}
          <div className="md:hidden pt-1 pb-1.5 space-y-1.5 select-none">
            {/* Top row: Logo/Branding + Bell Button */}
            <motion.div
              style={{
                height: mobileTopHeight,
                opacity: mobileTopOpacity,
                overflow: "hidden"
              }}
              className="flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
              {/* Brand Logo */}
              <div onClick={() => navigate("/")} className="flex items-center gap-2 cursor-pointer">
                <img
                  src={logoUrl || "/logo.png"}
                  alt="AnushkaStore Logo"
                  className="h-11 w-auto object-contain shrink-0"
                />
                {weatherEnabled && (
                  <div className="flex items-center gap-1.5 rounded-xl border border-white/35 bg-black/20 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl">
                    {ActiveWeatherIcon && <ActiveWeatherIcon size={13} className="text-white fill-none stroke-current" />}
                    <span className="text-[10px] font-extrabold text-white leading-none">{settings?.weather?.condition || 'Rain'}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/notifications")}
                  className="relative flex h-10 w-10 items-center justify-center text-white drop-shadow-sm active:scale-95 transition-transform"
                  title="Notifications"
                >
                  <NotificationsNoneOutlinedIcon sx={{ fontSize: 26, color: "#ffffff" }} />
                  {unreadNotificationsCount > 0 && <span className="absolute right-0 top-0 h-4 min-w-4 rounded-full bg-orange-500 px-0.5 text-center text-[9px] font-black leading-4 text-white">{unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}</span>}
                </button>
              </div>
            </div>

            {/* Location bar over the glossy header */}
            <div className="flex justify-start pt-0.5">
              <button
                type="button"
                onClick={() => setIsLocationOpen(true)}
                className="w-full flex items-center gap-2 rounded-xl border border-white/35 bg-black/20 px-3 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_5px_18px_rgba(5,28,101,0.16)] backdrop-blur-xl cursor-pointer active:scale-[0.99] transition-transform"
              >
                <span className="text-[13px] font-black text-white drop-shadow-sm">⌂</span>
                <span className="text-[10px] font-black text-white uppercase tracking-wide whitespace-nowrap">Deliver to</span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white/95">
                    {isFetchingLocation ? "Detecting location..." : currentLocation.name}
                </span>
                <ChevronDownIcon sx={{ color: "#ffffff", fontSize: 18 }} className="shrink-0" />
              </button>
            </div>
            </motion.div>

            {/* Bottom row: Highly Visible White Search Bar */}
            <div
              onClick={handleSearchClick}
              className="w-full bg-white/95 border-2 border-white/90 rounded-2xl md:rounded-full px-4 h-12 flex items-center shadow-[0_8px_24px_rgba(18,50,113,0.2),inset_0_1px_0_rgba(255,255,255,0.9)] cursor-pointer hover:border-white transition-all"
            >
              <SearchIcon sx={{ color: "#0f172a", fontSize: 20 }} className="shrink-0" />
              <input
                type="text"
                placeholder='Search "Atta, Rice, Oil, Maggi..."'
                readOnly
                className="flex-1 bg-transparent border-none outline-none pl-2 text-slate-900 font-bold placeholder:text-slate-600 text-[13.5px] cursor-pointer"
              />
              <div className="flex items-center gap-3.5 shrink-0 ml-1 border-l border-slate-200 pl-3">
                <MicIcon sx={{ color: "#0f172a", fontSize: 20 }} className="cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Categories Navigation Row (Shared for Desktop & Mobile) */}
          <div className="relative w-full overflow-visible">
            {/* Scroll arrows: desktop only */}
            {showLeftArrow && (
              <button
                onClick={() => handleScroll("left")}
                className="absolute left-0 z-30 hidden md:flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-md border border-slate-100 hover:bg-white active:scale-90 transition-all cursor-pointer -ml-1.5"
                style={{ top: "calc(50% - 14px)" }}
              >
                <ChevronLeftIcon sx={{ fontSize: 18 }} />
              </button>
            )}

            {/* Mobile wrapper */}
            <div className="md:hidden w-full">
              <motion.div
                style={{ height: mobileNavHeight, opacity: mobileNavOpacity, marginTop: mobileNavMargin, pointerEvents: mobileNavPointerEvents }}
                className="relative z-10 overflow-hidden"
              >
                <div ref={mobileNavRef} className="flex h-20 items-end gap-1 overflow-x-auto overflow-y-hidden px-2 pb-0 no-scrollbar">
                  {categories.map((cat) => (
                    <CategoryNavColumn
                      key={cat.id || cat._id}
                      cat={cat}
                      isActive={String(activeCategory?._id || activeCategory?.id || "") === String(cat._id || cat.id || "")}
                      onCategorySelect={onCategorySelect}
                    />
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Desktop wrapper: full scrollable row */}
            <motion.div
              ref={navRef}
              style={{ height: "80px", opacity: 1, marginTop: 8 }}
              className="relative z-10 -mx-2 hidden md:flex items-end gap-4 overflow-x-auto overflow-y-visible px-4 pb-0 no-scrollbar"
            >
              {categories.map((cat) => (
                <CategoryNavColumn
                  key={cat.id || cat._id}
                  cat={cat}
                  isActive={String(activeCategory?._id || activeCategory?.id || "") === String(cat._id || cat.id || "")}
                  onCategorySelect={onCategorySelect}
                />
              ))}
            </motion.div>

            {showRightArrow && (
              <button
                onClick={() => handleScroll("right")}
                className="absolute right-0 z-30 hidden md:flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-md border border-slate-100 hover:bg-white active:scale-90 transition-all cursor-pointer -mr-1.5"
                style={{ top: "calc(50% - 14px)" }}
              >
                <ChevronRightIcon sx={{ fontSize: 18 }} />
              </button>
            )}
          </div>

          {/* Background Decorative patterns */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none" />
        </motion.div>
      </div>

      <LocationDrawer
        isOpen={isLocationOpen}
        onClose={() => setIsLocationOpen(false)}
      />
    </>
  );
};

export default MainLocationHeader;

