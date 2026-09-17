import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import Lottie from "lottie-react";
import LocationDrawer from "./LocationDrawer";
import { useLocation } from "../../context/LocationContext";
import { useProductDetail } from "../../context/ProductDetailContext";
import { useSettings } from "@core/context/SettingsContext";
import { cn } from "@/lib/utils";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { customerApi } from "../../services/customerApi";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import {
  buildHeaderGradient,
  buildMiniCartColor,
  buildSearchBarBackgroundColor,
  shiftHex,
} from "../../utils/headerTheme";
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
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SearchIcon from "@mui/icons-material/Search";
import MicIcon from "@mui/icons-material/Mic";
import ChevronDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import LanguageIcon from "@mui/icons-material/Language";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useTranslation } from "@core/context/LanguageContext";

/** Full-width bottom stroke + tab curve; l/r are 0–100% of column where the inner bump sits. */
function buildActiveTabPath(l, r) {
  const y = 20;
  const mapX = (x) => l + ((x - 1.5) / (98.5 - 1.5)) * (r - l);
  // Softer shoulders + flatter crown for a cleaner active tab curve.
  return `M 0 ${y} L ${l} ${y} L ${l} 12 C ${mapX(2.6)} 7 ${mapX(8.2)} 1.55 ${mapX(15)} 1.55 L ${mapX(85)} 1.55 C ${mapX(91.8)} 1.55 ${mapX(97.4)} 7 ${mapX(98.5)} 12 V ${y} L 100 ${y}`;
}

function CategoryNavColumn({
  cat,
  isActive,
  categoryAccent,
  onCategorySelect,
  headerFontColor,
  headerIconColor,
}) {
  const iconColor = headerIconColor || "#111111";
  const colRef = useRef(null);
  const labelRef = useRef(null);
  const [lr, setLr] = useState({ l: 22, r: 78 });

  const measure = () => {
    if (!isActive || !colRef.current || !labelRef.current) return;
    const col = colRef.current.getBoundingClientRect();
    const lab = labelRef.current.getBoundingClientRect();
    if (col.width < 4) return;
    const pad = 5;
    const l = Math.max(0, ((lab.left - col.left - pad) / col.width) * 100);
    const r = Math.min(100, ((lab.right - col.left + pad) / col.width) * 100);
    if (r - l > 6) setLr({ l, r });
  };

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (colRef.current) ro.observe(colRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isActive, cat.name]);

  const pathD = isActive ? buildActiveTabPath(lr.l, lr.r) : "";

  return (
    <motion.div
      ref={colRef}
      layout
      whileTap={{ scale: 0.96 }}
      transition={{
        layout: { type: "spring", stiffness: 520, damping: 38, mass: 0.55 },
      }}
      onClick={() => onCategorySelect && onCategorySelect(cat)}
      className="relative z-[2] flex min-w-[48px] shrink-0 cursor-pointer flex-col items-center gap-0.5 px-2 pb-0.5 pt-0.5 snap-start md:min-w-[58px]">
      <div 
        className={cn(
          "relative z-10 flex items-center justify-center rounded-full transition-all duration-300",
          isActive ? "h-12 w-12 md:h-14 md:w-14 shadow-sm" : "h-11 w-11 md:h-12 md:w-12 opacity-90"
        )}
        style={{
          backgroundColor: `${iconColor}15`,
        }}
      >
        {typeof cat.icon === "function" ||
          (typeof cat.icon === "object" && cat.icon.$$typeof) ? (
          <cat.icon
            sx={{
              fontSize: isActive ? { xs: 24, md: 28 } : { xs: 20, md: 24 },
              color: iconColor,
              transition: "color 0.2s, font-size 0.2s",
            }}
          />
        ) : typeof cat.icon === "string" && !cat.icon.startsWith("http") && !cat.icon.includes("/") ? (
          <span 
            className="transition-all duration-300 drop-shadow-sm" 
            style={{ 
              fontSize: isActive ? '26px' : '22px', 
              filter: isActive ? 'none' : 'grayscale(15%) opacity(90%)' 
            }}
          >
            {cat.icon}
          </span>
        ) : (
          <img
            src={applyCloudinaryTransform(cat.icon, "f_auto,q_auto,w_100")}
            alt={cat.name}
            loading="lazy"
            className="h-6 w-6 md:h-7 md:w-7 object-contain drop-shadow-sm transition-all duration-300"
            style={{ filter: isActive ? 'none' : 'brightness(0.95)' }}
          />
        )}
      </div>
      <div className="relative mt-px w-full">
        <span
          ref={labelRef}
          className={cn(
            "relative z-10 mx-auto block max-w-[72px] truncate px-1 pb-0.5 text-center text-[8px] uppercase tracking-tight md:max-w-[88px] md:text-[10px]",
            isActive ? "font-black" : "font-semibold",
          )}
          style={{
            color: isActive ? iconColor : (headerFontColor || "#111111"),
            opacity: isActive ? 1 : 0.68,
          }}>
          {cat.name}
        </span>
      </div>

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
  const [cartAnimData, setCartAnimData] = useState(null);

  // Dynamically load shopping-cart Lottie on mount
  useEffect(() => {
    import("../../../../assets/lottie/shopping-cart.json")
      .then((m) => setCartAnimData(m.default))
      .catch(() => { });
  }, []);
  const { currentLocation, refreshLocation, isFetchingLocation } =
    useLocation();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { settings } = useSettings();
  const { cartCount } = useCart();
  const { count: wishlistCount } = useWishlist();
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
  const mobileTopHeight = useTransform(scrollY, [0, 80], ["96px", "0px"]);
  const mobileTopOpacity = useTransform(scrollY, [0, 80], [1, 0]);

  const contentHeight = useTransform(scrollY, [0, 160], ["64px", "64px"]);
  const contentOpacity = useTransform(scrollY, [0, 160], [1, 1]);
  const navHeight = useTransform(scrollY, [0, 200], ["80px", "80px"]);
  const navOpacity = useTransform(scrollY, [0, 200], [1, 1]);
  const navMargin = useTransform(scrollY, [0, 200], [8, 8]);
  const categorySpacing = useTransform(scrollY, [0, 200], [3, 3]);
  const cartOpacity = useTransform(scrollY, [0, 110, 150], [1, 1, 1]);
  const cartScale = useTransform(scrollY, [0, 110, 150], [1, 1, 1]);

  // Helper to hide elements completely when collapsed to prevent clicks
  const displayContent = useTransform(scrollY, (value) => "block");
  const displayNav = useTransform(scrollY, (value) => "flex");
  const displayCart = useTransform(scrollY, (value) => "block");

  const baseHeaderColor = activeCategory?.headerColor || "var(--primary)";
  const headerFontColor = "#111827";
  const headerIconColor = "#111111";

  const headerGradient = buildHeaderGradient(baseHeaderColor);
  const searchBarBg = buildSearchBarBackgroundColor(baseHeaderColor);
  const categoryAccent = headerIconColor;

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
          style={{
            paddingTop: headerTopPadding,
            paddingBottom: headerBottomPadding,
            borderBottomLeftRadius: headerRoundness,
            borderBottomRightRadius: headerRoundness,
            opacity: bgOpacity,
            background: "linear-gradient(180deg, rgba(255, 87, 34, 0.90) 0%, rgba(255, 112, 67, 0.42) 35%, rgba(255, 255, 255, 0.88) 75%, rgba(255, 255, 255, 0.95) 100%)",
          }}
          className="px-4 overflow-visible transform-gpu will-change-transform border-b border-orange-200/50 shadow-sm backdrop-blur-xl backdrop-saturate-180">
          {/* Subtle Glow Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-orange-500/10 via-transparent to-transparent pointer-events-none" />



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
                <div className="flex items-center gap-1.5 bg-white shadow-xs border border-slate-200/80 px-3 py-1.5 rounded-full text-slate-900 font-bold text-sm">
                    {ActiveWeatherIcon && <ActiveWeatherIcon size={16} className="text-slate-900 fill-none stroke-current" />}
                    <span className="text-slate-900 font-extrabold">{settings?.weather?.condition || 'Rain'}</span>
                </div>
              )}

              {/* Location Block (Desktop inline row, soft medium font like Blinkit) */}
              <div className="flex flex-col pl-3 lg:pl-6 h-10 justify-center">
                <div className="flex items-center gap-1 opacity-80">
                  <AccessTimeIcon sx={{ fontSize: 13, color: "#475569" }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider leading-none text-slate-700">
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
                  className="flex items-center gap-1 text-slate-700 hover:text-slate-900 cursor-pointer group active:scale-95 transition-all border-0 bg-transparent p-0 text-left">
                  <div className="text-[13px] lg:text-[14px] font-medium leading-tight max-w-[260px] lg:max-w-[340px] truncate text-slate-700">
                    {isFetchingLocation
                      ? "Detecting location..."
                      : currentLocation.name}
                  </div>
                  <ChevronDownIcon
                    sx={{ fontSize: 16, color: "#475569" }}
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

            {/* Right Section: Action Icons (White background circles + Black icons) */}
            <div className="flex items-center gap-3.5 lg:gap-5 shrink-0">
              {/* Cart Button */}
              <motion.button
                whileHover={{ scale: 1.08, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/cart")}
                className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200/80 flex items-center justify-center relative cursor-pointer active:scale-95 transition-all text-slate-900 hover:bg-slate-50"
                title="My Cart"
              >
                <ShoppingCartOutlinedIcon sx={{ fontSize: 22, color: "#0f172a" }} />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#FF5722] text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-transform group-hover:-translate-y-0.5 animate-in zoom-in duration-300">
                    {cartCount}
                  </span>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.08, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/wishlist")}
                className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200/80 flex items-center justify-center relative cursor-pointer active:scale-95 transition-all text-slate-900 hover:bg-slate-50"
                title="Wishlist"
              >
                <FavoriteBorderOutlinedIcon sx={{ fontSize: 22, color: "#0f172a" }} />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#FF5722] text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-transform group-hover:-translate-y-0.5 animate-in zoom-in duration-300">
                    {wishlistCount}
                  </span>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.08, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/notifications")}
                className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200/80 flex items-center justify-center relative cursor-pointer active:scale-95 transition-all text-slate-900 hover:bg-slate-50"
                title="Notifications"
              >
                <NotificationsNoneOutlinedIcon sx={{ fontSize: 22, color: "#0f172a" }} />
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
                className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200/80 flex items-center justify-center cursor-pointer transition-all text-slate-900 hover:bg-slate-50"
                title="Profile"
              >
                <AccountCircleOutlinedIcon sx={{ fontSize: 24, color: "#0f172a" }} />
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
                  <div className="flex items-center gap-1 bg-white shadow-xs border border-slate-200/80 px-2.5 py-1 rounded-full">
                    {ActiveWeatherIcon && <ActiveWeatherIcon size={13} className="text-slate-900 fill-none stroke-current" />}
                    <span className="text-[10px] font-extrabold text-slate-900 leading-none">{settings?.weather?.condition || 'Rain'}</span>
                  </div>
                )}
              </div>

              {/* Right actions: Wishlist Button + Notification Bell Button (White circle background + Black icons) */}
              <div className="flex items-center gap-2.5">
                {/* Mobile Wishlist Button */}
                <button
                  type="button"
                  onClick={() => navigate("/wishlist")}
                  className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200/80 flex items-center justify-center relative cursor-pointer active:scale-95 transition-all text-slate-900 hover:bg-slate-50"
                  title="Wishlist"
                >
                  <FavoriteBorderOutlinedIcon sx={{ fontSize: 22, color: "#0f172a" }} />
                  {wishlistCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#FF5722] text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-transform group-hover:-translate-y-0.5 animate-in zoom-in duration-300">
                      {wishlistCount}
                    </span>
                  )}
                </button>

                {/* Mobile Account / Profile Button */}
                <button
                  type="button"
                  onClick={() => navigate("/profile")}
                  className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200/80 flex items-center justify-center relative cursor-pointer active:scale-95 transition-all text-slate-900 hover:bg-slate-50"
                  title="Account"
                >
                  <PersonOutlineOutlinedIcon sx={{ fontSize: 22, color: "#0f172a" }} />
                </button>
              </div>
            </div>

            {/* Middle row: Deliver to Address (Medium weight soft text, borderless like Blinkit image) */}
            <div className="flex justify-start pt-0.5">
              <button
                type="button"
                onClick={() => setIsLocationOpen(true)}
                className="w-fit max-w-[95%] flex flex-col text-left bg-transparent border-0 p-0 cursor-pointer active:opacity-85 transition-all"
              >
                <span className="text-[9.5px] font-bold text-slate-700 uppercase tracking-wider leading-none">Deliver to</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[12.5px] font-medium text-slate-700 truncate max-w-[260px] leading-tight">
                    {isFetchingLocation ? "Detecting location..." : currentLocation.name}
                  </span>
                  <ChevronDownIcon sx={{ color: "#475569", fontSize: 16 }} className="shrink-0" />
                </div>
              </button>
            </div>
            </motion.div>

            {/* Bottom row: Highly Visible White Search Bar */}
            <div
              onClick={handleSearchClick}
              className="w-full bg-white border border-slate-200/90 rounded-2xl md:rounded-full px-4 h-11 flex items-center shadow-[0_4px_16px_rgba(0,0,0,0.06)] cursor-pointer hover:border-slate-300 transition-all"
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
                ref={mobileNavRef}
                style={{ height: navHeight, opacity: navOpacity, marginTop: navMargin }}
                className="relative z-10 flex items-end gap-1 overflow-x-auto overflow-y-visible px-2 pb-0 no-scrollbar"
              >
                {categories.map((cat) => (
                  <CategoryNavColumn
                    key={cat.id || cat._id}
                    cat={cat}
                    isActive={String(activeCategory?._id || activeCategory?.id || "") === String(cat._id || cat.id || "")}
                    categoryAccent={categoryAccent}
                    onCategorySelect={onCategorySelect}
                    headerFontColor={headerFontColor}
                    headerIconColor={headerIconColor}
                  />
                ))}
              </motion.div>
            </div>

            {/* Desktop wrapper: full scrollable row */}
            <motion.div
              ref={navRef}
              style={{ height: navHeight, opacity: navOpacity, marginTop: navMargin }}
              className="relative z-10 -mx-2 hidden md:flex items-end gap-4 overflow-x-auto overflow-y-visible px-4 pb-0 no-scrollbar"
            >
              {categories.map((cat) => (
                <CategoryNavColumn
                  key={cat.id || cat._id}
                  cat={cat}
                  isActive={String(activeCategory?._id || activeCategory?.id || "") === String(cat._id || cat.id || "")}
                  categoryAccent={categoryAccent}
                  onCategorySelect={onCategorySelect}
                  headerFontColor={headerFontColor}
                  headerIconColor={headerIconColor}
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

