import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import LocationDrawer from "./LocationDrawer";
import { useLocation } from "../../context/LocationContext";
import { useProductDetail } from "../../context/ProductDetailContext";
import { useSettings } from "@core/context/SettingsContext";
import { cn } from "@/lib/utils";
import { useCart } from "../../context/CartContext";
import { customerApi } from "../../services/customerApi";
import CategoryIcon from "@shared/components/CategoryIcon";
import { MapPin, Home, ChevronRight, LayoutGrid, ShoppingBag, Zap } from 'lucide-react';
import { getCustomerHeaderColor, buildMiniCartColor, isBrightColor, getCategoryHeaderColor, getCategoryHeaderTextColor } from "../../utils/headerTheme";
import VoiceSearchModal from "./VoiceSearchModal";


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
  const rawText = settings?.deliveryBadgeText;
  const text = (typeof rawText === 'string' && rawText.trim() !== '') ? rawText.trim() : '30 min';

  return (
    <div 
      className={cn(
        "customer-header-delivery-time shrink-0 h-[36px] px-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm text-white font-black text-xs select-none transition-all",
        className
      )}
      style={{
        background: bg,
        color: '#ffffff'
      }}
    >
      <Zap className="h-3.5 w-3.5 fill-current shrink-0" />
      <span 
        className="text-[11.5px] font-black leading-none tracking-tight whitespace-nowrap"
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
  headerTextColor = null,
  layoutIdPrefix = "desktop",
}) {
  const displayName = truncateCategoryName(cat.name, 12);

  // Icons and names are always white as requested for dark header background
  const activeColor = "#ffffff";
  const inactiveColor = "rgba(255, 255, 255, 0.88)";
  const iconColor = "#ffffff";
  const activeIconColor = "#ffffff";
  const indicatorColor = "#ffffff";

  return (
    <div
      data-category-id={String(cat.id || cat._id || "")}
      onClick={(e) => {
        if (onCategorySelect) onCategorySelect(cat);
        if (onItemClick) onItemClick(e.currentTarget);
      }}
      className={cn(
        "customer-category-nav-item relative z-[2] flex shrink-0 cursor-pointer items-center justify-center flex-col select-none",
        "flex-col gap-0.5 px-0.5 pb-1 pt-0.5 md:min-w-[68px] md:max-w-[88px] h-[46px]",
        isActive && "is-active"
      )}>
      <div 
        className={cn(
          "customer-category-nav-icon relative z-10 flex items-center justify-center transition-all duration-200",
          "h-5 w-5 sm:h-[22px] sm:w-[22px]",
          isActive ? "scale-105 opacity-100" : "opacity-85"
        )}
      >
        <CategoryIcon
          iconId={cat.iconId}
          alt={cat.name}
          className={cn(
            "transition-all duration-200",
            "h-[18px] w-[18px] sm:h-[19px] sm:w-[19px]",
            isActive ? "scale-105" : "scale-100"
          )}
          style={{ color: isActive ? activeIconColor : iconColor }}
        />
      </div>
      <div className="relative flex items-center justify-center w-full">
        <span
          className={cn(
            "customer-category-nav-label relative z-10 block text-center leading-none tracking-tight transition-all duration-200 whitespace-nowrap mt-0.5",
            "w-full max-w-full truncate text-[10px] sm:text-[10.5px] md:text-[11px]",
            isActive ? "font-bold" : "font-medium",
          )}
          style={{
            color: isActive ? activeColor : inactiveColor,
          }}>
          {displayName}
        </span>
      </div>
      {/* Lower active indicator bar: shifts to whichever category is selected */}
      {isActive && (
        <motion.span
          layoutId={`category-nav-indicator-${layoutIdPrefix}`}
          className="customer-category-nav-indicator absolute bottom-0 inset-x-1.5 h-[2.5px] rounded-full pointer-events-none"
          style={{
            backgroundColor: indicatorColor,
          }}
          transition={{ type: "spring", stiffness: 520, damping: 36, mass: 0.7 }}
        />
      )}
    </div>
  );
}

const SearchPlaceholderTypewriter = React.memo(({ categories = [] }) => {
  const [searchPlaceholder, setSearchPlaceholder] = useState('Search "Mobile"');
  const [typingState, setTypingState] = useState({
    textIndex: 0,
    charIndex: 0,
    isDeleting: false,
    isPaused: false,
  });

  const staticText = "Search ";

  // Dynamically extract category names from categories prop (ignoring "All")
  // e.g. ["Mobile", "Grocery", "Electronics", "Home Appliances", "Fashion"]
  const typingPhrases = React.useMemo(() => {
    const names = (categories || [])
      .map((c) => (typeof c === "string" ? c : c?.name))
      .filter((n) => n && typeof n === "string" && n.trim().toLowerCase() !== "all");

    if (names.length > 0) {
      return names.map((name) => `"${name.trim()}"`);
    }
    return ['"Mobile"', '"Grocery"', '"Electronics"', '"Home Appliances"', '"Fashion"'];
  }, [categories]);

  useEffect(() => {
    if (!typingPhrases.length) return;
    const { textIndex, charIndex, isDeleting, isPaused } = typingState;
    const currentPhrase = typingPhrases[textIndex % typingPhrases.length];

    if (isPaused) {
      // Pause for 3.2 seconds when full category name is displayed (changes every 3-4 seconds)
      const timeout = setTimeout(() => {
        setTypingState((prev) => ({
          ...prev,
          isPaused: false,
          isDeleting: true,
        }));
      }, 3200);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (charIndex < currentPhrase.length) {
            setSearchPlaceholder(
              staticText + currentPhrase.substring(0, charIndex + 1),
            );
            setTypingState((prev) => ({
              ...prev,
              charIndex: prev.charIndex + 1,
            }));
          } else {
            setTypingState((prev) => ({ ...prev, isPaused: true }));
          }
        } else {
          if (charIndex > 0) {
            setSearchPlaceholder(
              staticText + currentPhrase.substring(0, charIndex - 1),
            );
            setTypingState((prev) => ({
              ...prev,
              charIndex: prev.charIndex - 1,
            }));
          } else {
            setTypingState((prev) => ({
              ...prev,
              isDeleting: false,
              charIndex: 0,
              textIndex: (prev.textIndex + 1) % typingPhrases.length,
            }));
          }
        }
      },
      isDeleting ? 40 : 80,
    );

    return () => clearTimeout(timeout);
  }, [typingState, typingPhrases]);

  return (
    <input
      type="text"
      placeholder={searchPlaceholder || 'Search "Mobile"'}
      readOnly
      tabIndex={-1}
      className="min-w-0 flex-1 bg-transparent border-0 ring-0 outline-none focus:outline-none focus:ring-0 focus:border-0 focus-visible:outline-none focus-visible:ring-0 pl-2 text-black font-semibold placeholder:text-black text-[13px] sm:text-[13.5px] cursor-pointer pointer-events-none select-none shadow-none truncate"
      style={{ outline: "none", border: "none", boxShadow: "none", WebkitTapHighlightColor: "transparent", color: "#000000" }}
    />
  );
});

const MainLocationHeader = ({
  categories = [],
  activeCategory,
  onCategorySelect,
  isScrolled: isScrolledProp,
}) => {
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
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [internalScrolled, setInternalScrolled] = useState(false);
  const isScrolled = isScrolledProp !== undefined ? isScrolledProp : internalScrolled;
  const [isMobileCollapsed, setIsMobileCollapsed] = useState(false);
  const { currentLocation, refreshLocation, isFetchingLocation } =
    useLocation();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { settings } = useSettings();
  const { cartCount } = useCart();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY || document.documentElement.scrollTop || 0;
          // Desktop compact header toggle
          setInternalScrolled((prev) => {
            if (!prev && currentY > 60) return true;
            if (prev && currentY < 25) return false;
            return prev;
          });
          // Mobile collapsible header (collapses past 35px, expands below 15px)
          setIsMobileCollapsed((prev) => {
            if (!prev && currentY > 35) return true;
            if (prev && currentY < 15) return false;
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
  }, []);

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

  // Dynamic mobile category width: ensures EXACTLY 6 items visible on 1 screen/page with comfortable gap
  useEffect(() => {
    const el = mobileNavRef.current;
    if (!el) return;

    const calculateItemWidth = () => {
      const containerWidth = el.clientWidth;
      if (containerWidth > 0) {
        // Exactly 6 items visible per screen/page:
        // gap between items = 8px (0.5rem) -> 5 gaps = 40px
        // inner left + right padding = 8px (4px each)
        // total spacing = 48px
        const GAP = 8;
        const PADDING = 8;
        const TOTAL_SPACING = (5 * GAP) + PADDING;
        const computedWidth = Math.floor((containerWidth - TOTAL_SPACING) / 6);
        el.style.setProperty('--cat-item-width', `${computedWidth}px`);
        el.style.setProperty('--cat-gap', `${GAP}px`);
      }
    };

    calculateItemWidth();
    const ro = new ResizeObserver(() => calculateItemWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [categories.length]);

  const lastScrolledCatIdRef = useRef("");

  // Auto-scroll category into view, shifting right-side tabs to the left/center immediately
  const scrollCategoryIntoView = (targetEl) => {
    if (!targetEl) return;
    const catId = targetEl.getAttribute("data-category-id");
    if (catId) {
      lastScrolledCatIdRef.current = catId;
    }
    [mobileNavRef.current, navRef.current].forEach((container) => {
      if (!container) return;
      const containerWidth = container.clientWidth;
      const elOffset = targetEl.offsetLeft;
      const elWidth = targetEl.clientWidth;

      const targetScrollLeft = Math.max(0, elOffset - (containerWidth / 2) + (elWidth / 2));
      container.scrollTo({
        left: targetScrollLeft,
        behavior: "smooth",
      });
    });
  };

  // Automatically scroll when activeCategory changes from external navigation (e.g. route switch)
  useEffect(() => {
    if (!activeCategory) return;
    const activeId = String(activeCategory._id || activeCategory.id || "");
    if (!activeId) return;

    if (lastScrolledCatIdRef.current === activeId) {
      return; // Already centered smoothly on tap
    }
    lastScrolledCatIdRef.current = activeId;

    const rafId = window.requestAnimationFrame(() => {
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
    });

    return () => window.cancelAnimationFrame(rafId);
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


  // Responsive check
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

  const isAllCategory =
    !activeCategory ||
    activeCategory._id === "all" ||
    activeCategory.id === "all" ||
    String(activeCategory.slug || "").toLowerCase() === "all" ||
    String(activeCategory.name || "").toLowerCase() === "all";


  const targetHeaderColor = getCategoryHeaderColor(activeCategory, categories);
  const targetTextColor = "#ffffff";
  const isBright = isBrightColor(targetHeaderColor);
  const categoryModeTextColor = "#ffffff";

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
      <div className="fixed top-0 left-0 right-0 z-[200] pointer-events-none px-0">
        <motion.div
          initial={false}
          animate={{
            ...(targetHeaderColor && typeof targetHeaderColor === "string" && targetHeaderColor.includes("gradient")
              ? {}
              : { backgroundColor: targetHeaderColor }),
          }}
          transition={{
            backgroundColor: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
          }}
          style={{
            background: targetHeaderColor,
            paddingTop: isMobile
              ? "env(safe-area-inset-top, 2px)"
              : (isScrolled ? 16 : 14),
            paddingBottom: 3,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            opacity: 1,
            "--category-header-text-active": "#ffffff",
            "--category-header-text-color": "rgba(255, 255, 255, 0.85)",
            "--category-header-indicator": "#ffffff",
          }}
          className={cn(
            "customer-location-header pointer-events-auto w-full max-w-full min-w-0 px-4 lg:px-6 xl:px-8 2xl:px-10 overflow-hidden transform-gpu will-change-[transform,background]",
            "rounded-b-[24px] shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
            "is-dark-header border-b border-white/10"
          )}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'none' }} />
          <svg aria-hidden="true" viewBox="0 0 430 280" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none" style={{ opacity: 0.12 }}>
            <g fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round">
              <path d="M-28 43 C55 8 92 63 163 34 S298 6 461 59" strokeWidth="1.65" />
              <path d="M-20 84 C53 45 128 105 207 69 S352 55 450 103" strokeWidth="1.25" />
              <path d="M-18 191 C79 161 120 205 207 176 S343 150 455 183" strokeWidth="1.55" />
              <path d="M36 239 C103 221 177 259 252 225 S365 208 454 229" strokeWidth="1.2" />
              <path d="M-12 159 C70 143 125 173 204 143 S335 125 451 150" strokeWidth="0.95" opacity="0.75" />
              <path d="M266 12 C307 25 310 47 352 48 M80 126 C116 115 141 123 165 137" strokeWidth="2.6" opacity="0.65" />
            </g>
          </svg>
          <div className="absolute inset-x-0 bottom-0 h-px pointer-events-none bg-white/10" />

          {/* Desktop/Tablet Header Layout (md and above) */}
          <div className={cn("hidden md:flex items-center gap-2 lg:gap-3 relative z-20 w-full min-w-0 max-w-full transition-all duration-300 mt-1", isScrolled ? "mb-2" : "mb-8")}>
            {/* Left Section: Logo + Location row */}
            <div className="flex min-w-0 shrink items-center gap-2 lg:gap-3">
              <div
                onClick={() => navigate("/")}
                className="flex items-center justify-center bg-white rounded-xl px-1.5 py-0.5 h-[42px] w-fit shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-white/80 cursor-pointer group active:scale-95 transition-all hover:shadow-md overflow-hidden"
              >
                <img
                  src={logoUrl || "/logo.png"}
                  alt={`${appName || 'AnushkaStore'} Logo`}
                  loading="lazy"
                  className="h-full w-auto max-h-[39px] max-w-[125px] object-contain"
                />
              </div>

              <button
                type="button"
                data-lenis-prevent
                data-lenis-prevent-touch
                onClick={() => setIsLocationOpen(true)}
                className="customer-delivery-card flex min-w-0 w-[190px] lg:w-[230px] xl:w-[270px] max-w-full shrink items-center gap-1.5 h-[38px] rounded-xl border border-white/20 bg-white/15 px-2.5 text-left shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-transform active:scale-[0.99] cursor-pointer"
              >
                <MapPin className="customer-delivery-icon h-3.5 w-3.5 shrink-0 text-white" style={{ color: '#ffffff' }} />
                <span className="customer-delivery-label shrink-0 text-[11px] font-black text-white tracking-tight uppercase" style={{ color: '#ffffff' }}>HOME</span>
                <span className="customer-delivery-address min-w-0 flex-1 truncate text-[10.5px] font-medium text-white/95" style={{ color: '#ffffff' }}>
                  {isFetchingLocation ? "Detecting..." : (currentLocation.name || currentLocation.city || "Select address")}
                </span>
                <ChevronRight className="h-3 w-3 shrink-0 text-white/80" style={{ color: '#ffffff' }} />
              </button>

              {/* Delivery Time Badge / Logo */}
              <DeliveryBadge settings={settings} className="hidden md:flex" />
            </div>

            {/* Center Section: Highly Visible White Search Bar */}
            <div className="min-w-0 flex-1 xl:max-w-[680px]">
              <motion.div
                onClick={handleSearchClick}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                tabIndex={-1}
                data-search-box="true"
                className="customer-search-box bg-white border-2 border-white rounded-full px-3.5 h-10 shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex items-center transition-all duration-200 cursor-pointer select-none focus:outline-none focus:ring-0 focus-within:ring-0"
                style={{ WebkitTapHighlightColor: "transparent", backgroundColor: "#ffffff" }}
              >
                <SearchIcon
                  className="customer-search-icon shrink-0 text-black"
                  sx={{ color: "#000000 !important", fill: "#000000 !important", fontSize: 20 }}
                  style={{ color: "#000000", fill: "#000000" }}
                />
                <SearchPlaceholderTypewriter categories={categories} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsVoiceModalOpen(true);
                  }}
                  className="flex items-center justify-center border-l border-slate-300 pl-2 text-black hover:text-slate-700 transition-colors cursor-pointer"
                  title="Voice Search"
                  aria-label="Voice Search"
                >
                  <MicIcon
                    className="customer-mic-icon text-black"
                    sx={{ color: "#000000 !important", fill: "#000000 !important", fontSize: 19 }}
                    style={{ color: "#000000", fill: "#000000" }}
                  />
                </button>
              </motion.div>
            </div>

            {/* Right Section: clean icons and buttons over the glossy header */}
            <div className="flex shrink-0 items-center gap-1 lg:gap-2">
              {/* Categories Button (Website / Desktop only) */}
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate("/categories")}
                className="hidden 2xl:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-primary transition-all cursor-pointer font-bold text-[11px] shadow-xs border border-slate-200/80 shrink-0 whitespace-nowrap"
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
                className="hidden 2xl:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-emerald-700 transition-all cursor-pointer font-bold text-[11px] shadow-xs border border-slate-200/80 shrink-0 whitespace-nowrap"
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
                  "hover:bg-white/10"
                )}
                title="My Cart"
              >
                <ShoppingCartOutlinedIcon sx={{ fontSize: 22, color: "#ffffff" }} />
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
                  "hover:bg-white/10"
                )}
                title="Notifications"
              >
                <NotificationsNoneOutlinedIcon sx={{ fontSize: 22, color: "#ffffff" }} />
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
                  "hover:bg-white/10"
                )}
                title="Profile"
              >
                <AccountCircleOutlinedIcon sx={{ fontSize: 24, color: "#ffffff" }} />
              </motion.button>
            </div>
          </div>

          {/* Mobile Header Layout (MOBILE ONLY) */}
          <div className="md:hidden pt-0 pb-1 select-none">
            {/* Top row: Logo/Branding + Bell Button + Location bar (GPU-accelerated smooth collapse on scroll for all categories) */}
            <div
              className={cn(
                "mobile-header-collapsible flex flex-col gap-2.5",
                isMobileCollapsed ? "is-collapsed" : "is-expanded"
              )}
            >
              <div className="flex items-center justify-between">
                {/* Brand Logo placed inside white card container, image covering full height & width */}
                <div
                  onClick={() => navigate("/")}
                  className="flex items-center justify-center bg-white rounded-xl px-1.5 py-0.5 h-[42px] w-fit shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-white/80 cursor-pointer active:scale-95 transition-transform overflow-hidden"
                >
                  <img
                    src={logoUrl || "/logo.png"}
                    alt="AnushkaStore Logo"
                    className="h-full w-auto max-h-[39px] max-w-[125px] object-contain shrink-0"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate("/notifications")}
                    className="relative flex h-9 w-9 items-center justify-center text-white drop-shadow-sm active:scale-95 transition-transform"
                    title="Notifications"
                  >
                    <NotificationsNoneOutlinedIcon sx={{ fontSize: 24, color: "#ffffff" }} />
                    {unreadNotificationsCount > 0 && <span className="absolute right-0 top-0 h-4 min-w-4 rounded-full bg-orange-500 px-0.5 text-center text-[9px] font-black leading-4 text-white">{unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}</span>}
                  </button>
                </div>
              </div>

              {/* Location bar + 30 min delivery time */}
              <div className="flex items-center gap-2 w-full pt-0">
                <button
                  type="button"
                  onClick={() => setIsLocationOpen(true)}
                  className="customer-delivery-card flex-1 min-w-0 h-[36px] flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/15 px-2.5 text-left shadow-[0_2px_8px_rgba(0,0,0,0.12)] cursor-pointer active:scale-[0.99] transition-transform"
                >
                  <MapPin className="customer-delivery-icon h-3.5 w-3.5 shrink-0 text-white" style={{ color: '#ffffff' }} />
                  <span className="customer-delivery-label shrink-0 text-[11px] font-black text-white tracking-tight uppercase" style={{ color: '#ffffff' }}>HOME</span>
                  <span className="customer-delivery-address min-w-0 flex-1 truncate text-[10.5px] font-medium text-white/95" style={{ color: '#ffffff' }}>
                    {isFetchingLocation ? "Detecting location..." : (currentLocation.name || currentLocation.city || "Select address")}
                  </span>
                  <ChevronRight className="h-3 w-3 shrink-0 text-white/80" style={{ color: '#ffffff' }} />
                </button>

                {/* Delivery Time Badge / Logo */}
                <DeliveryBadge settings={settings} />
              </div>
            </div>

            {/* Bottom row: Search Bar with solid white background, black icons and dynamic category placeholder */}
            <div
              onClick={handleSearchClick}
              tabIndex={-1}
              data-search-box="true"
              className="customer-search-box w-full bg-white border-2 border-white rounded-2xl md:rounded-full px-4 h-10 flex items-center shadow-[0_4px_16px_rgba(0,0,0,0.12)] cursor-pointer transition-all select-none focus:outline-none mb-1 active:scale-[0.99]"
              style={{ WebkitTapHighlightColor: "transparent", backgroundColor: "#ffffff" }}
            >
              <SearchIcon
                className="customer-search-icon shrink-0 text-black"
                sx={{ color: "#000000 !important", fill: "#000000 !important", fontSize: 20 }}
                style={{ color: "#000000", fill: "#000000" }}
              />
              <SearchPlaceholderTypewriter categories={categories} />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVoiceModalOpen(true);
                }}
                className="flex items-center justify-center shrink-0 ml-1 border-l border-slate-300 pl-3 text-black hover:text-slate-700 transition-colors cursor-pointer active:scale-95"
                title="Voice Search"
                aria-label="Voice Search"
              >
                <MicIcon
                  className="customer-mic-icon text-black"
                  sx={{ color: "#000000 !important", fill: "#000000 !important", fontSize: 20 }}
                  style={{ color: "#000000", fill: "#000000" }}
                />
              </button>
            </div>
          </div>

          {/* Categories Navigation Row (Icons & Names exactly like image) */}
          <div className="relative w-full max-w-none px-0 sm:px-4 lg:px-8 xl:px-12 2xl:px-16 overflow-visible">
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
            <div 
              className="md:hidden w-full relative"
              style={{ containerType: "inline-size" }}
            >
              <div
                ref={mobileNavRef}
                data-lenis-prevent
                className="overflow-x-auto no-scrollbar scroll-smooth h-[48px] overflow-y-hidden pb-0.5"
                style={{
                  WebkitOverflowScrolling: "touch",
                  overscrollBehaviorX: "contain",
                }}
              >
                <div 
                  className="flex shrink-0 px-1 h-[48px] items-center gap-[var(--cat-gap,8px)] pb-0.5"
                  style={{
                    gap: "var(--cat-gap, 8px)",
                  }}
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
                      isScrolled={isScrolled}
                      headerTextColor={categoryModeTextColor}
                      layoutIdPrefix="mobile"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop wrapper: centered scrollable row */}
            <motion.div
              ref={navRef}
              data-lenis-prevent
              style={{ height: !isScrolled ? "48px" : "40px", opacity: 1, marginTop: 2 }}
              className="relative z-10 w-full hidden md:flex overflow-x-auto overflow-y-visible px-4 lg:px-8 xl:px-12 no-scrollbar scroll-smooth"
            >
              <div
                className={cn(
                  "flex mx-auto shrink-0",
                  !isScrolled
                    ? "items-center gap-2.5 lg:gap-4 xl:gap-5 pb-0.5"
                    : "items-end gap-3 lg:gap-5 xl:gap-6 pb-0"
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
                    headerTextColor={categoryModeTextColor}
                    layoutIdPrefix="desktop"
                  />
                ))}
              </div>
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

      <VoiceSearchModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />
    </>
  );
};

export default MainLocationHeader;

