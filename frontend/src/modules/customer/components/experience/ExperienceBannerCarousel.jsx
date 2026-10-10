import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  applyCloudinaryTransform,
  buildCloudinarySrcSet,
  isCloudinaryUrl,
} from "@/core/utils/imageUtils";

import { useNavigate } from "react-router-dom";
import { isMobileOrWebView } from "@/core/utils/deviceUtils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const BANNER_CHUNK_SIZE = 20;

const ExperienceBannerCarousel = ({
  section,
  items,
  fullWidth = false,
  slideGap = 12,
  edgeToEdge = false,
  showDots = false,
  showContentOverlay = true,
  peekNext = true,
  stretchSingle = false,
  autoPlayInterval = 2500,
  isSectionBanner = false,
}) => {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [visibleCount, setVisibleCount] = React.useState(() =>
    Math.min(items.length, BANNER_CHUNK_SIZE)
  );
  const visibleItems = items.slice(0, visibleCount);
  const totalItems = visibleItems.length;
  const currentSlideIsVideo = Boolean(visibleItems[activeIndex]?.isVideo);
  const containerRef = React.useRef(null);
  const cardRef = React.useRef(null);
  const [cardStep, setCardStep] = React.useState(0);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(() => isMobileOrWebView());
  const [windowWidth, setWindowWidth] = React.useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const resumeTimeoutRef = React.useRef(null);
  const hasMore = visibleCount < items.length;

  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => Math.min(items.length, prev + BANNER_CHUNK_SIZE));
  }, [items.length]);

  React.useEffect(() => {
    setVisibleCount(Math.min(items.length, BANNER_CHUNK_SIZE));
    setActiveIndex(0);
  }, [items.length]);

  // Compute number of cards visible simultaneously on desktop (Flipkart style)
  const getVisibleCardsCount = React.useCallback(() => {
    if (isMobile) return 1;
    const w = windowWidth || (typeof window !== "undefined" ? window.innerWidth : 1200);
    if (w >= 1536) {
      return Math.min(4, Math.max(1, totalItems));
    }
    if (w >= 1024) {
      return Math.min(3, Math.max(1, totalItems));
    }
    return Math.min(2, Math.max(1, totalItems));
  }, [isMobile, windowWidth, totalItems]);

  const numVisible = getVisibleCardsCount();
  const maxActiveIndex = isMobile
    ? Math.max(0, totalItems - 1)
    : Math.max(0, totalItems - numVisible);

  const measureCardStep = React.useCallback(() => {
    const mobile = isMobileOrWebView();
    setIsMobile(mobile);
    const winW = typeof window !== "undefined" ? window.innerWidth : 1200;
    setWindowWidth(winW);

    if (containerRef.current?.parentElement) {
      const parentW = containerRef.current.parentElement.clientWidth;
      setContainerWidth(parentW);
      if (cardRef.current) {
        const cWidth = cardRef.current.offsetWidth;
        const effectiveGap = (mobile && edgeToEdge && !peekNext) ? 0 : slideGap;
        setCardStep(cWidth + effectiveGap);
      }
    } else if (cardRef.current) {
      const effectiveGap = (mobile && edgeToEdge && !peekNext) ? 0 : slideGap;
      setCardStep(cardRef.current.offsetWidth + effectiveGap);
    }
  }, [slideGap, edgeToEdge, peekNext]);

  React.useEffect(() => {
    measureCardStep();
    window.addEventListener("resize", measureCardStep);
    return () => window.removeEventListener("resize", measureCardStep);
  }, [measureCardStep, visibleItems.length]);

  // Pause on user interaction and resume after delay
  const pauseAutoPlay = () => {
    setIsPaused(true);
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
  };

  const resumeAutoPlay = () => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 2000);
  };

  // Auto-play logic: slide smoothly every interval
  React.useEffect(() => {
    if (totalItems <= 1 || maxActiveIndex <= 0 || currentSlideIsVideo || isPaused) return;

    const intervalId = setInterval(() => {
      setActiveIndex((prev) => (prev >= maxActiveIndex ? 0 : prev + 1));
    }, autoPlayInterval);

    return () => clearInterval(intervalId);
  }, [totalItems, maxActiveIndex, currentSlideIsVideo, isPaused, autoPlayInterval]);

  React.useEffect(() => {
    if (!hasMore) return;
    if (activeIndex >= totalItems - 2) {
      loadMore();
    }
  }, [activeIndex, totalItems, hasMore, loadMore]);

  const handleDragEnd = (_, info) => {
    resumeAutoPlay();
    if (maxActiveIndex <= 0) return;
    const threshold = 35;
    if (info.offset.x < -threshold) {
      // Swipe left -> Next
      setActiveIndex((prev) => (prev >= maxActiveIndex ? 0 : prev + 1));
    } else if (info.offset.x > threshold) {
      // Swipe right -> Prev
      setActiveIndex((prev) => (prev <= 0 ? maxActiveIndex : prev - 1));
    }
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    pauseAutoPlay();
    setActiveIndex((prev) => (prev >= maxActiveIndex ? 0 : prev + 1));
  };

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    pauseAutoPlay();
    setActiveIndex((prev) => (prev <= 0 ? maxActiveIndex : prev - 1));
  };

  const getBannerOptimizedSrc = React.useCallback((url) => {
    if (!url) return url;
    if (!isCloudinaryUrl(url)) return url;
    return applyCloudinaryTransform(url, "f_auto,q_auto,c_scale,w_824");
  }, []);

  const handleBannerClick = (banner) => {
    if (!banner.linkType || banner.linkType === 'none') return;
    
    if (banner.linkType === 'url' && banner.linkValue) {
      window.open(banner.linkValue, '_blank');
    } else if (banner.linkType === 'category' && banner.linkValue) {
      navigate(`/category/${banner.linkValue}`);
    } else if (banner.linkType === 'subcategory' && banner.linkValue) {
      let route = banner.linkValue.trim();
      if (route.startsWith('http://') || route.startsWith('https://')) {
        try {
          const urlObj = new URL(route);
          route = urlObj.pathname + urlObj.search;
        } catch {
          route = banner.linkValue.trim();
        }
      }
      if (route.startsWith('/') || route.startsWith('?')) {
        navigate(route);
      } else {
        navigate(`/category/sub/${route}`);
      }
    } else if (banner.linkType === 'product' && banner.linkValue) {
      let route = banner.linkValue.trim();
      if (route.startsWith('http://') || route.startsWith('https://')) {
        try {
          const urlObj = new URL(route);
          route = urlObj.pathname + urlObj.search;
        } catch {
          route = banner.linkValue.trim();
        }
      }
      if (route.startsWith('/') || route.startsWith('?')) {
        navigate(route);
      } else {
        navigate(`?product=${route}`);
      }
    } else if (banner.linkType === 'header' && banner.linkValue) {
      navigate(`/?header=${banner.linkValue}`);
    }
  };

  // Compute exact desktop card width based on measured container: compatible with "All" page
  const desktopCardWidth = React.useMemo(() => {
    if (isMobile || !containerWidth) return 0;
    
    // Standard 3-slot card width from "All" page (~405px at 1240px container)
    const standard3SlotWidth = Math.floor((containerWidth - 2 * slideGap) / 3);
    
    if (totalItems === 1) {
      if (stretchSingle) return containerWidth;
      // 1 banner: identical card size as "All" page, perfectly centered with zero crop
      return Math.min(standard3SlotWidth, 420);
    }
    
    if (totalItems === 2) {
      // 2 banners: maintain 2:1 ratio, placed side-by-side in middle
      return Math.min(standard3SlotWidth, 440);
    }
    
    // 3 or more banners: fill 3 slots (or 2 on tablet)
    const currentNumVisible = Math.min(numVisible, totalItems);
    const totalGaps = (currentNumVisible - 1) * slideGap;
    return Math.max(200, Math.floor((containerWidth - totalGaps) / currentNumVisible));
  }, [isMobile, containerWidth, totalItems, numVisible, slideGap, stretchSingle]);

  if (!items.length) return null;

  return (
    <div
      className="w-full select-none relative group"
      onMouseEnter={pauseAutoPlay}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={pauseAutoPlay}
      onTouchEnd={resumeAutoPlay}
    >
      <div
        className={cn(
          "w-full overflow-hidden touch-pan-y",
          edgeToEdge
            ? "px-0"
            : totalItems === 1
            ? "px-3.5 sm:px-4 md:px-0 flex justify-center"
            : !isMobile && totalItems === 2
            ? "px-4 md:px-0 flex justify-center"
            : "pl-3.5 sm:pl-4 md:pl-0"
        )}
      >
        <motion.div
          ref={containerRef}
          drag={!isMobile && totalItems <= 2 ? false : (maxActiveIndex > 0 ? "x" : false)}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragStart={pauseAutoPlay}
          onDragEnd={handleDragEnd}
          animate={{
            x: (!isMobile && totalItems <= 2)
              ? 0
              : (cardStep ? -(activeIndex * cardStep) : (isMobile && edgeToEdge && !peekNext) ? `-${activeIndex * 100}%` : `-${(activeIndex / totalItems) * 100}%`),
          }}
          transition={
            isMobile
              ? { type: "spring", stiffness: 320, damping: 32, mass: 0.8 }
              : { type: "spring", stiffness: 280, damping: 28 }
          }
          className={cn(
            "flex",
            !isMobile && totalItems <= 2 ? "w-full justify-center" : ""
          )}
          style={
            !isMobile && totalItems <= 2
              ? { width: "100%", columnGap: `${slideGap}px` }
              : {
                  width: "max-content",
                  columnGap: (isMobile && edgeToEdge && !peekNext) ? "0px" : `${slideGap}px`,
                }
          }
        >
          {visibleItems.map((banner, idx) => (
            <div
              ref={idx === 0 ? cardRef : null}
              key={idx}
              onClick={() => handleBannerClick(banner)}
              style={
                !isMobile && desktopCardWidth > 0
                  ? {
                      width: `${desktopCardWidth}px`,
                      height: stretchSingle
                        ? (isSectionBanner ? "clamp(135px, 12vw, 175px)" : "clamp(240px, 20vw, 360px)")
                        : (isSectionBanner ? "145px" : "215px")
                    }
                  : (isMobile && edgeToEdge && !peekNext)
                  ? { width: containerWidth ? `${containerWidth}px` : "100vw" }
                  : undefined
              }
              className={cn(
                "relative shrink-0 overflow-hidden flex items-center justify-center cursor-pointer transition-shadow",
                edgeToEdge
                  ? "rounded-none md:rounded-2xl border-0 shadow-none md:shadow-[0_4px_16px_rgba(0,0,0,0.06)] md:border md:border-slate-100/80 bg-slate-100"
                  : "rounded-2xl md:rounded-3xl bg-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-slate-100/80",
                isMobile
                  ? isSectionBanner
                    ? (edgeToEdge && !peekNext)
                      ? "aspect-[2.85/1] sm:aspect-[2.95/1]"
                      : totalItems === 1
                      ? stretchSingle
                        ? "w-full aspect-[2.85/1] sm:aspect-[2.95/1]"
                        : "w-full max-w-[360px] mx-auto aspect-[2.85/1] sm:aspect-[2.95/1]"
                      : peekNext
                      ? "w-[84vw] sm:w-[80vw] aspect-[2.85/1] sm:aspect-[2.95/1]"
                      : fullWidth
                      ? "w-[90vw] aspect-[2.85/1] sm:aspect-[2.95/1]"
                      : "w-[85vw] aspect-[2.85/1] sm:aspect-[2.95/1]"
                    : (edgeToEdge && !peekNext)
                    ? "aspect-[2/1] sm:aspect-[2.1/1]"
                    : totalItems === 1
                    ? stretchSingle
                      ? "w-full aspect-[2.6/1] sm:aspect-[2.85/1]"
                      : "w-full max-w-[360px] mx-auto aspect-[2.2/1] sm:aspect-[2.5/1]"
                    : peekNext
                    ? "w-[84vw] sm:w-[80vw] aspect-[1.95/1] sm:aspect-[2.1/1]"
                    : fullWidth
                    ? "w-[90vw] aspect-[2/1] sm:aspect-[21/9]"
                    : "w-[85vw] aspect-[2/1] sm:aspect-[21/9]"
                  : totalItems === 1
                  ? stretchSingle
                    ? isSectionBanner ? "w-full h-[145px] lg:h-[165px]" : "w-full h-[240px] lg:h-[300px] xl:h-[350px]"
                    : isSectionBanner ? "h-[145px] max-w-[420px] mx-auto" : "h-[215px] max-w-[420px] mx-auto"
                  : totalItems === 2
                  ? isSectionBanner ? "h-[145px] max-w-[440px]" : "h-[215px] max-w-[480px]"
                  : numVisible >= 4
                  ? isSectionBanner ? "w-[calc((100%-36px)/4)] h-[140px] lg:h-[145px]" : "w-[calc((100%-36px)/4)] h-[200px] lg:h-[215px]"
                  : numVisible >= 3
                  ? isSectionBanner ? "w-[calc((100%-24px)/3)] h-[140px] lg:h-[145px]" : "w-[calc((100%-24px)/3)] h-[200px] lg:h-[215px]"
                  : isSectionBanner ? "w-[calc((100%-12px)/2)] h-[140px] lg:h-[145px]" : "w-[calc((100%-12px)/2)] h-[200px] lg:h-[215px]"
              )}
            >
              {banner.isVideo ? (
                <video
                  ref={(el) => {
                    if (el) {
                      if (activeIndex === idx) el.play().catch(() => {});
                      else el.pause();
                    }
                  }}
                  src={banner.videoUrl}
                  muted
                  playsInline
                  autoPlay={activeIndex === idx}
                  className="w-full h-full object-cover object-center pointer-events-none"
                  onEnded={() => {
                    setActiveIndex((prev) => (prev >= maxActiveIndex ? 0 : prev + 1));
                  }}
                />
              ) : (
                <img
                  src={getBannerOptimizedSrc(banner.imageUrl)}
                  srcSet={
                    isCloudinaryUrl(banner.imageUrl)
                      ? buildCloudinarySrcSet(
                          banner.imageUrl,
                          [{ w: 412 }, { w: 824 }, { w: 1248 }, { w: 1600 }],
                          "f_auto,q_auto,c_scale"
                        )
                      : undefined
                  }
                  sizes={stretchSingle && totalItems === 1
                    ? "(max-width: 768px) 100vw, 1280px"
                    : "(max-width: 768px) 85vw, 420px"}
                  className={cn(
                    "w-full h-full pointer-events-none",
                    stretchSingle
                      ? "object-cover object-center"
                      : isSectionBanner
                      ? "object-cover object-center"
                      : "object-cover object-top sm:object-center"
                  )}
                  loading={idx === 0 ? "eager" : "lazy"}
                  fetchPriority={idx === 0 ? "high" : "low"}
                  decoding="async"
                />
              )}

              {/* Title & Subtitle Overlay */}
              {showContentOverlay && (banner.title || banner.subtitle) && (
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5 sm:p-7 pointer-events-none">
                  {banner.title && (
                    <h3 className="text-white font-black text-lg sm:text-2xl drop-shadow-md">
                      {banner.title}
                    </h3>
                  )}
                  {banner.subtitle && (
                    <p className="text-white/90 font-medium text-xs sm:text-base mt-1 drop-shadow-md">
                      {banner.subtitle}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Flipkart-style Desktop Navigation Arrows */}
      {!isMobile && maxActiveIndex > 0 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-slate-800 shadow-[0_4px_16px_rgba(0,0,0,0.18)] border border-slate-100 items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Previous banner"
          >
            <ChevronLeft size={22} className="stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-slate-800 shadow-[0_4px_16px_rgba(0,0,0,0.18)] border border-slate-100 items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Next banner"
          >
            <ChevronRight size={22} className="stroke-[2.5]" />
          </button>
        </>
      )}

      {/* Indicator dots */}
      {(showDots || totalItems > 1) && (isMobile ? totalItems > 1 : maxActiveIndex > 0) && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5" role="tablist" aria-label="Home banners">
          {[...Array(isMobile ? totalItems : maxActiveIndex + 1)].map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                index === activeIndex ? "w-6 bg-slate-800" : "w-1.5 bg-slate-300 hover:bg-slate-400"
              )}
              aria-label={`Show banner ${index + 1}`}
              aria-selected={index === activeIndex}
              role="tab"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ExperienceBannerCarousel;
