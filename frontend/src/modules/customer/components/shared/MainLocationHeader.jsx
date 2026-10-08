import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import LocationDrawer from "./LocationDrawer";
import { useLocation } from "../../context/LocationContext";
import { useProductDetail } from "../../context/ProductDetailContext";
import { useSettings } from "@core/context/SettingsContext";
import { cn } from "@/lib/utils";
import { useCart } from "../../context/CartContext";
import { customerApi } from "../../services/customerApi";
import CategoryIcon from "@shared/components/CategoryIcon";
import { MapPin, Home, ChevronRight, LayoutGrid, ShoppingBag, Zap } from 'lucide-react';
import { getCustomerHeaderColor, buildMiniCartColor, isBrightColor, getCategoryHeaderColor } from "../../utils/headerTheme";


// MUI Icons
import SearchIcon from "@mui/icons-material/Search";
import MicIcon from "@mui/icons-material/Mic";
import ChevronDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useTranslation } from "@core/context/LanguageContext";

export function truncateCategoryName(name, maxLength = 12) {
  if (!name || typeof name !== "string") return "";
  const trimmed = name.trim();
  if (trimmed.length > maxLength) {
    const lower = trimmed.toLowerCase();
    const limit = lower.startsWith("home appli") ? 10 : (maxLength - 1);
    return trimmed.slice(0, limit).trimEnd() + "...";
  }
  return trimmed;
}

function DeliveryBadge({ settings, className }) {
  if (settings?.deliveryBadgeEnabled === false) return null;

  const bg = settings?.deliveryBadgeBg || 'linear-gradient(135deg, #ff9f43 0%, #ff793f 100%)';
  const img = settings?.deliveryBadgeImage;
  const rawText = settings?.deliveryBadgeText;
  const text = (typeof rawText === 'string' && rawText.trim() !== '') ? rawText.trim() : '30 min';

  return (
    <div 
      className={cn(
        "customer-header-delivery-time shrink-0 h-[38px] px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm text-white font-black text-xs select-none transition-all",
        className
      )}
      style={{
        background: bg,
        color: '#ffffff'
      }}
    >
      {img ? (
        <img src={img} alt={text || "Fast Delivery"} className="h-4 w-4 object-contain shrink-0" />
      ) : (
        <Zap className="h-3.5 w-3.5 fill-current shrink-0" />
      )}
      <span 
        className="text-[12px] font-black leading-none tracking-tight whitespace-nowrap"
        style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
      >
        {text}
      </span>
    </div>
  );
}

function CategoryNavColumn({
  cat,
  isActive,
  onCategorySelect,
  isBright = false,
  isAllCategory = true,
  onItemClick,
  isScrolled = false,
}) {
  const isTextOnlyMode = !isAllCategory || isScrolled;
  const displayName = truncateCategoryName(cat.name, 12);

  const activeColor = isTextOnlyMode
    ? (isAllCategory ? (isBright ? "#1764cf" : "#ffffff") : (isBright ? "#0f172a" : "#ffffff"))
    : (isBright ? "#1764cf" : "#ffffff");
  const inactiveColor = isTextOnlyMode
    ? (isBright ? "rgba(15, 23, 42, 0.72)" : "rgba(255, 255, 255, 0.85)")
    : (isBright ? "#344054" : "rgba(255, 255, 255, 0.85)");
  const iconColor = isBright ? "#111827" : "#ffffff";
  const indicatorColor = isAllCategory
    ? (isBright ? "#2875E8" : "#ffffff")
    : (isBright ? "#0f172a" : "#ffffff");

  return (
    <div
      data-category-id={String(cat.id || cat._id || "")}
      onClick={(e) => {
        if (onCategorySelect) onCategorySelect(cat);
        if (onItemClick) onItemClick(e.currentTarget);
      }}
      className={cn(
        "customer-category-nav-item relative z-[2] flex shrink-0 cursor-pointer items-center justify-end flex-col transition-all duration-200 select-none",
        isTextOnlyMode
          ? "px-3.5 pt-1 pb-2 h-9"
          : "min-w-[58px] flex-col gap-1 px-2 pb-2 pt-0.5 md:min-w-[72px]",
        isActive && "is-active"
      )}>
      {!isTextOnlyMode && (
        <div 
          className={cn(
            "customer-category-nav-icon relative z-10 flex items-center justify-center transition-all duration-200",
            "h-11 w-11 md:h-12 md:w-12",
            isActive ? "scale-105 opacity-100" : "opacity-90"
          )}
        >
          <CategoryIcon
            iconId={cat.iconId}
            alt={cat.name}
            className={cn(
              "transition-all duration-200",
              "h-6 w-6 md:h-7 md:w-7",
              isActive ? "scale-110" : "scale-100"
            )}
            style={{ color: isActive ? activeColor : iconColor }}
          />
        </div>
      )}
      <div className={cn("relative flex items-center justify-center", isTextOnlyMode ? "w-auto" : "w-full")}>
        <span
          className={cn(
            "customer-category-nav-label relative z-10 block text-center leading-tight tracking-tight transition-all duration-200 whitespace-nowrap",
            isTextOnlyMode
              ? "text-[13.5px] md:text-[14px]"
              : "max-w-[82px] pb-0.5 text-[10px] md:max-w-[104px] md:text-[12px]",
            isActive ? "font-bold" : "font-medium",
          )}
          style={{
            color: isActive ? activeColor : inactiveColor,
          }}>
          {displayName}
        </span>
      </div>
      {/* Full underline bar directly matching the reference image */}
      {isActive && (
        <motion.span
          layoutId="category-nav-indicator"
          className="customer-category-nav-indicator absolute bottom-0 left-0.5 right-0.5 h-[3.5px] rounded-full pointer-events-none"
          style={{
            backgroundColor: indicatorColor,
          }}
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
    </div>
  );
}

const MainLocationHeader = ({
  categories = [],
  activeCategory,
  onCategorySelect,
  isScrolled: isScrolledProp,
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
  const [internalScrolled, setInternalScrolled] = useState(false);
  const isScrolled = isScrolledProp !== undefined ? isScrolledProp : internalScrolled;
  const { currentLocation, refreshLocation, isFetchingLocation } =
    useLocation();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { settings } = useSettings();
  const { cartCount } = useCart();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    if (isScrolledProp !== undefined) return;
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY || document.documentElement.scrollTop || 0;
          setInternalScrolled((prev) => {
            if (!prev && currentY > 40) return true;
            if (prev && currentY < 20) return false;
            return prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isScrolledProp]);

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

  // Auto-scroll category into view, shifting right-side tabs to the left/center
  const scrollCategoryIntoView = (targetEl) => {
    if (!targetEl) return;
    [mobileNavRef.current, navRef.current].forEach((container) => {
      if (!container) return;
      const containerWidth = container.clientWidth;
      const elOffset = targetEl.offsetLeft;
      const elWidth = targetEl.clientWidth;

      // Center the active category tab in the scroll view so right-side categories become visible
      const targetScrollLeft = Math.max(0, elOffset - (containerWidth / 2) + (elWidth / 2));
      container.scrollTo({
        left: targetScrollLeft,
        behavior: "smooth",
      });
    });
  };

  // Automatically scroll when activeCategory changes
  useEffect(() => {
    if (!activeCategory) return;
    const activeId = String(activeCategory._id || activeCategory.id || "");
    if (!activeId) return;

    const timer = setTimeout(() => {
      [mobileNavRef.current, navRef.current].forEach((container) => {
        if (!container) return;
        const activeEl = container.querySelector(`[data-category-id="${activeId}"]`);
        if (activeEl) {
          const containerWidth = container.clientWidth;
          const elOffset = activeEl.offsetLeft;
          const elWidth = activeEl.clientWidth;
          const targetScrollLeft = Math.max(0, elOffset - (containerWidth / 2) + (elWidth / 2));
          container.scrollTo({
            left: targetScrollLeft,
            behavior: "smooth",
          });
        }
      });
    }, 80);

    return () => clearTimeout(timer);
  }, [activeCategory]);

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
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const mobileTopHeight = useTransform(scrollY, [0, 22, 108], ["116px", "116px", "0px"]);
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

  const isAllCategory =
    !activeCategory ||
    activeCategory._id === "all" ||
    activeCategory.id === "all" ||
    String(activeCategory.slug || "").toLowerCase() === "all" ||
    String(activeCategory.name || "").toLowerCase() === "all";


  const targetHeaderColor = getCategoryHeaderColor(activeCategory);
  const isBright = isBrightColor(targetHeaderColor);

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

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[200] pointer-events-none px-0 md:px-4 lg:px-6">
        <motion.div
          initial={false}
          animate={{
            backgroundColor: targetHeaderColor,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
          }}
          transition={{
            backgroundColor: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
            layout: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
          }}
          style={{
            backgroundColor: targetHeaderColor,
            paddingTop: isScrolled ? 16 : 14,
            paddingBottom: (!isAllCategory || isScrolled) ? 3 : 4,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            opacity: bgOpacity,
          }}
          className={cn(
            "customer-location-header pointer-events-auto w-full md:max-w-7xl md:mx-auto px-4 overflow-hidden transform-gpu will-change-transform backdrop-blur-xl transition-all duration-300",
            "rounded-b-[24px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] border-b md:border-x",
            (!isAllCategory || isScrolled) && "is-category-mode",
            isBright ? "is-bright-header border-black/10" : "is-dark-header border-white/10"
          )}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: isAllCategory ? 'linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(234,244,255,0.22) 100%)' : 'none' }} />
          <div className="absolute inset-x-0 top-0 h-px bg-white/40 pointer-events-none" />
          <svg aria-hidden="true" viewBox="0 0 430 280" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none" style={{ opacity: isAllCategory ? 0.3 : 0.12 }}>
            <g fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round">
              <path d="M-28 43 C55 8 92 63 163 34 S298 6 461 59" strokeWidth="1.65" />
              <path d="M-20 84 C53 45 128 105 207 69 S352 55 450 103" strokeWidth="1.25" />
              <path d="M-18 191 C79 161 120 205 207 176 S343 150 455 183" strokeWidth="1.55" />
              <path d="M36 239 C103 221 177 259 252 225 S365 208 454 229" strokeWidth="1.2" />
              <path d="M-12 159 C70 143 125 173 204 143 S335 125 451 150" strokeWidth="0.95" opacity="0.75" />
              <path d="M266 12 C307 25 310 47 352 48 M80 126 C116 115 141 123 165 137" strokeWidth="2.6" opacity="0.65" />
            </g>
          </svg>
          <div className={cn("absolute inset-x-0 bottom-0 h-px pointer-events-none", isAllCategory ? "bg-blue-200/80" : "hidden")} />

          {/* Desktop/Tablet Header Layout (md and above) */}
          <div className={cn("hidden md:flex items-center justify-between relative z-20 w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 transition-all duration-300 mt-1", (isAllCategory && isScrolled) ? "mb-2" : "mb-8")}>
            {/* Left Section: Logo + Location row */}
            <div className="flex items-center gap-2.5 lg:gap-3.5 shrink-0">
              <div
                onClick={() => navigate("/")}
                className="flex items-center gap-2 cursor-pointer group shrink-0">
                <div className="group-hover:scale-105 transition-all duration-300 drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]">
                  <img
                    src={logoUrl || "/logo.png"}
                    alt={`${appName || 'AnushkaStore'} Logo`}
                    loading="lazy"
                    className="h-11 lg:h-12 max-w-[110px] lg:max-w-[125px] w-auto object-contain drop-shadow-[0_2px_5px_rgba(16,24,40,0.12)]"
                  />
                </div>
              </div>

              <button
                type="button"
                data-lenis-prevent
                data-lenis-prevent-touch
                onClick={() => setIsLocationOpen(true)}
                className="customer-delivery-card flex min-w-0 max-w-[190px] lg:max-w-[230px] xl:max-w-[270px] h-[38px] items-center gap-1.5 rounded-xl border border-blue-100/90 bg-blue-50/70 px-2.5 text-left shadow-[0_2px_8px_rgba(40,117,232,0.06)] backdrop-blur-xl transition-transform active:scale-[0.99] cursor-pointer"
              >
                <MapPin className="customer-delivery-icon h-3.5 w-3.5 shrink-0 text-[#2875E8]" style={{ color: '#2875E8' }} />
                <span className="customer-delivery-label shrink-0 text-[11px] font-black text-[#2875E8] tracking-tight uppercase" style={{ color: '#2875E8' }}>HOME</span>
                <span className="customer-delivery-address min-w-0 flex-1 truncate text-[10.5px] font-medium text-slate-500" style={{ color: '#64748b' }}>
                  {isFetchingLocation ? "Detecting..." : (currentLocation.name || currentLocation.city || "Select address")}
                </span>
                <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" style={{ color: '#94a3b8' }} />
              </button>

              {/* Delivery Time Badge / Logo */}
              <DeliveryBadge settings={settings} className="hidden sm:flex" />
            </div>

            {/* Center Section: Highly Visible Search Bar */}
            <div className="flex-1 min-w-[180px] max-w-[340px] lg:max-w-[400px] xl:max-w-[460px] px-2 lg:px-3">
              <motion.div
                onClick={handleSearchClick}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                tabIndex={-1}
                className="bg-white rounded-full px-3.5 h-10 border border-slate-200/90 shadow-[0_4px_14px_rgba(0,0,0,0.06)] flex items-center transition-all duration-200 cursor-pointer hover:shadow-md hover:border-slate-300 select-none focus:outline-none focus:ring-0 focus-within:ring-0"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <SearchIcon sx={{ color: "#0f172a", fontSize: 19 }} />
                <input
                  type="text"
                  placeholder={searchPlaceholder || "Search Products..."}
                  readOnly
                  tabIndex={-1}
                  className="flex-1 bg-transparent border-0 ring-0 outline-none focus:outline-none focus:ring-0 focus:border-0 focus-visible:outline-none focus-visible:ring-0 pl-2 text-slate-900 font-bold placeholder:text-slate-500 text-[13px] cursor-pointer pointer-events-none select-none shadow-none truncate"
                  style={{ outline: "none", border: "none", boxShadow: "none", WebkitTapHighlightColor: "transparent" }}
                />
                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                  <MicIcon sx={{ color: "#0f172a", fontSize: 18 }} />
                </div>
              </motion.div>
            </div>

            {/* Right Section: clean icons and buttons over the glossy header */}
            <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
              {/* Categories Button (Website / Desktop only) */}
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate("/categories")}
                className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-primary transition-all cursor-pointer font-bold text-[11px] shadow-xs border border-slate-200/80 shrink-0 whitespace-nowrap"
                title="All Categories"
              >
                <LayoutGrid size={13} className="text-primary shrink-0" />
                <span>Categories</span>
              </motion.button>

              {/* Products Button (Website / Desktop only) */}
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate("/products")}
                className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-emerald-700 transition-all cursor-pointer font-bold text-[11px] shadow-xs border border-slate-200/80 shrink-0 whitespace-nowrap"
                title="All Products"
              >
                <ShoppingBag size={13} className="text-emerald-600 shrink-0" />
                <span>Products</span>
              </motion.button>

              {/* Cart Button */}
              <motion.button
                whileHover={{ scale: 1.06, rotate: 4 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => navigate("/cart")}
                className={cn(
                  "w-9 h-9 flex items-center justify-center relative cursor-pointer rounded-full transition-colors shrink-0",
                  isBright ? "hover:bg-black/5" : "hover:bg-white/10"
                )}
                title="My Cart"
              >
                <ShoppingCartOutlinedIcon sx={{ fontSize: 22, color: isBright ? "#0f172a" : "#ffffff" }} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#2875E8] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-transform group-hover:-translate-y-0.5 animate-in zoom-in duration-300">
                    {cartCount}
                  </span>
                )}
              </motion.button>

              {/* Notification Bell Button */}
              <motion.button
                whileHover={{ scale: 1.06, rotate: 4 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => navigate("/notifications")}
                className={cn(
                  "w-9 h-9 flex items-center justify-center relative cursor-pointer rounded-full transition-colors shrink-0",
                  isBright ? "hover:bg-black/5" : "hover:bg-white/10"
                )}
                title="Notifications"
              >
                <NotificationsNoneOutlinedIcon sx={{ fontSize: 22, color: isBright ? "#0f172a" : "#ffffff" }} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#2875E8] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-transform group-hover:-translate-y-0.5 animate-in zoom-in duration-300">
                    {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                  </span>
                )}
              </motion.button>

              {/* Profile / Account Button */}
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => navigate("/profile")}
                className={cn(
                  "w-9 h-9 flex items-center justify-center cursor-pointer rounded-full transition-colors shrink-0",
                  isBright ? "hover:bg-black/5" : "hover:bg-white/10"
                )}
                title="Profile"
              >
                <AccountCircleOutlinedIcon sx={{ fontSize: 24, color: isBright ? "#0f172a" : "#ffffff" }} />
              </motion.button>
            </div>
          </div>

          {/* Mobile Header Layout (MOBILE ONLY) */}
          <div className="md:hidden pt-0.5 pb-1 select-none">
            {/* Top row: Logo/Branding + Bell Button + Location bar (ONLY when isAllCategory and not scrolled) */}
            <AnimatePresence initial={false}>
              {isAllCategory && !isScrolled && (
                <motion.div
                  key="mobile-header-top-section"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden flex flex-col gap-1.5 mb-2"
                >
                  <div className="flex items-center justify-between">
                    {/* Brand Logo */}
                    <div onClick={() => navigate("/")} className="flex items-center gap-2 cursor-pointer">
                      <img
                        src={logoUrl || "/logo.png"}
                        alt="AnushkaStore Logo"
                        className="h-14 max-w-[132px] w-auto object-contain shrink-0 drop-shadow-[0_2px_4px_rgba(16,24,40,0.12)]"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate("/notifications")}
                        className="relative flex h-10 w-10 items-center justify-center text-white drop-shadow-sm active:scale-95 transition-transform"
                        title="Notifications"
                      >
                        <NotificationsNoneOutlinedIcon sx={{ fontSize: 26, color: isBright ? "#0f172a" : "#ffffff" }} />
                        {unreadNotificationsCount > 0 && <span className="absolute right-0 top-0 h-4 min-w-4 rounded-full bg-orange-500 px-0.5 text-center text-[9px] font-black leading-4 text-white">{unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}</span>}
                      </button>
                    </div>
                  </div>

                  {/* Location bar + 30 min delivery time */}
                  <div className="flex items-center gap-2 w-full pt-0.5">
                    <button
                      type="button"
                      onClick={() => setIsLocationOpen(true)}
                      className="customer-delivery-card flex-1 min-w-0 h-[40px] flex items-center gap-2 rounded-xl border border-blue-100/90 bg-blue-50/65 px-3 text-left shadow-[0_2px_8px_rgba(40,117,232,0.06)] backdrop-blur-xl cursor-pointer active:scale-[0.99] transition-transform"
                    >
                      <MapPin className="customer-delivery-icon h-4 w-4 shrink-0 text-[#2875E8]" style={{ color: '#2875E8' }} />
                      <span className="customer-delivery-label shrink-0 text-[11.5px] font-black text-[#2875E8] tracking-tight uppercase" style={{ color: '#2875E8' }}>HOME</span>
                      <span className="customer-delivery-address min-w-0 flex-1 truncate text-[11px] font-medium text-slate-500" style={{ color: '#64748b' }}>
                        {isFetchingLocation ? "Detecting location..." : (currentLocation.name || currentLocation.city || "Select address")}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" style={{ color: '#94a3b8' }} />
                    </button>

                    {/* Delivery Time Badge / Logo */}
                    <DeliveryBadge settings={settings} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom row: Highly Visible White Search Bar */}
            <div
              onClick={handleSearchClick}
              tabIndex={-1}
              className="w-full bg-white/95 border-2 border-white/90 rounded-2xl md:rounded-full px-4 h-11 flex items-center shadow-[0_4px_16px_rgba(0,0,0,0.12)] cursor-pointer hover:border-white transition-all mb-1.5 select-none focus:outline-none focus:ring-0 focus:border-white focus-visible:outline-none focus-visible:ring-0 active:scale-[0.99]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <SearchIcon sx={{ color: "#0f172a", fontSize: 20 }} className="shrink-0" />
              <input
                type="text"
                placeholder='Search "Atta, Rice, Oil, Maggi..."'
                readOnly
                tabIndex={-1}
                className="flex-1 bg-transparent border-0 ring-0 outline-none focus:outline-none focus:ring-0 focus:border-0 focus-visible:outline-none focus-visible:ring-0 pl-2 text-slate-900 font-bold placeholder:text-slate-600 text-[13.5px] cursor-pointer pointer-events-none select-none shadow-none"
                style={{ outline: "none", border: "none", boxShadow: "none", WebkitTapHighlightColor: "transparent" }}
              />
              <div className="flex items-center gap-3.5 shrink-0 ml-1 border-l border-slate-200 pl-3">
                <MicIcon sx={{ color: "#0f172a", fontSize: 20 }} className="cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Categories Navigation Row (Icons & Names exactly like image) */}
          <div className="relative w-full max-w-7xl mx-auto overflow-visible">
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

            {/* Mobile wrapper with icon tabs */}
            <div className="md:hidden w-full">
              <div
                ref={mobileNavRef}
                className={cn(
                  "overflow-x-auto no-scrollbar scroll-smooth transition-all duration-300",
                  (isAllCategory && !isScrolled)
                    ? "h-20 overflow-y-hidden pb-1.5"
                    : "h-10 overflow-y-visible pb-0"
                )}
              >
                <div className={cn(
                  "flex shrink-0 px-2 transition-all duration-300", 
                  (isAllCategory && !isScrolled)
                    ? "h-20 items-end gap-1 pb-1"
                    : "h-10 items-end gap-3 pb-0"
                )}>
                  {categories.map((cat) => (
                    <CategoryNavColumn
                      key={cat.id || cat._id}
                      cat={cat}
                      isActive={String(activeCategory?._id || activeCategory?.id || "") === String(cat._id || cat.id || "")}
                      onCategorySelect={onCategorySelect}
                      isBright={isBright}
                      isAllCategory={isAllCategory}
                      onItemClick={scrollCategoryIntoView}
                      isScrolled={isScrolled}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop wrapper: centered scrollable row */}
            <motion.div
              ref={navRef}
              style={{ height: (isAllCategory && !isScrolled) ? "80px" : "40px", opacity: 1, marginTop: 4 }}
              className={cn(
                "relative z-10 w-full hidden md:flex overflow-x-auto overflow-y-visible px-4 no-scrollbar scroll-smooth justify-center",
                (isAllCategory && !isScrolled) ? "items-end gap-2.5 pb-1.5" : "items-end gap-4 pb-0"
              )}
            >
              {categories.map((cat) => (
                <CategoryNavColumn
                  key={cat.id || cat._id}
                  cat={cat}
                  isActive={String(activeCategory?._id || activeCategory?.id || "") === String(cat._id || cat.id || "")}
                  onCategorySelect={onCategorySelect}
                  isBright={isBright}
                  isAllCategory={isAllCategory}
                  onItemClick={scrollCategoryIntoView}
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

