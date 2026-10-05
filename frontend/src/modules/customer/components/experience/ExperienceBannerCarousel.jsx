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
  autoPlayInterval = 2000,
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
  const [isPaused, setIsPaused] = React.useState(false);
  const resumeTimeoutRef = React.useRef(null);
  const hasMore = visibleCount < items.length;

  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => Math.min(items.length, prev + BANNER_CHUNK_SIZE));
  }, [items.length]);

  React.useEffect(() => {
    setVisibleCount(Math.min(items.length, BANNER_CHUNK_SIZE));
    setActiveIndex(0);
  }, [items.length]);

  const measureCardStep = React.useCallback(() => {
    if (cardRef.current) {
      setCardStep(cardRef.current.offsetWidth + slideGap);
    }
  }, [slideGap]);

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

  // Auto-play logic: swipe right to left every 2 seconds
  React.useEffect(() => {
    if (totalItems <= 1 || currentSlideIsVideo || isPaused) return;

    const intervalId = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalItems);
    }, autoPlayInterval);

    return () => clearInterval(intervalId);
  }, [totalItems, activeIndex, currentSlideIsVideo, isPaused, autoPlayInterval]);

  React.useEffect(() => {
    if (!hasMore) return;
    if (activeIndex >= totalItems - 2) {
      loadMore();
    }
  }, [activeIndex, totalItems, hasMore, loadMore]);

  const handleDragEnd = (_, info) => {
    resumeAutoPlay();
    const threshold = 35;
    if (info.offset.x < -threshold) {
      // Swipe left -> Next
      setActiveIndex((prev) => (prev + 1) % totalItems);
    } else if (info.offset.x > threshold) {
      // Swipe right -> Prev
      setActiveIndex((prev) => (prev - 1 + totalItems) % totalItems);
    }
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

  if (!items.length) return null;

  return (
    <div
      className="w-full select-none"
      onMouseEnter={pauseAutoPlay}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={pauseAutoPlay}
      onTouchEnd={resumeAutoPlay}
    >
      <div className="w-full overflow-hidden touch-pan-y pl-3.5 sm:pl-4 md:pl-6">
        <motion.div
          ref={containerRef}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragStart={pauseAutoPlay}
          onDragEnd={handleDragEnd}
          animate={{ x: cardStep ? -(activeIndex * cardStep) : `-${(activeIndex / totalItems) * 100}%` }}
          transition={
            isMobileOrWebView()
              ? { type: "spring", stiffness: 320, damping: 32, mass: 0.8 }
              : { type: "spring", stiffness: 280, damping: 28 }
          }
          className="flex"
          style={{ width: "max-content", columnGap: `${slideGap}px` }}
        >
          {visibleItems.map((banner, idx) => (
            <div
              ref={idx === 0 ? cardRef : null}
              key={idx}
              onClick={() => handleBannerClick(banner)}
              className={cn(
                "relative shrink-0 overflow-hidden rounded-2xl bg-slate-100 flex items-center justify-center cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-slate-100/80 transition-shadow",
                peekNext
                  ? "w-[84vw] sm:w-[80vw] md:w-[68vw] lg:w-[60vw] max-w-[820px] aspect-[1.95/1] sm:aspect-[2.1/1] md:aspect-[2.3/1]"
                  : fullWidth
                  ? "w-[90vw] aspect-[2/1] sm:aspect-[21/9]"
                  : "w-[85vw] max-w-[960px] aspect-[2/1] sm:aspect-[21/9]"
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
                    setActiveIndex((prev) => (prev + 1) % totalItems);
                  }}
                />
              ) : (
                <img
                  src={getBannerOptimizedSrc(banner.imageUrl)}
                  srcSet={
                    isCloudinaryUrl(banner.imageUrl)
                      ? buildCloudinarySrcSet(
                          banner.imageUrl,
                          [{ w: 412 }, { w: 824 }, { w: 1248 }],
                          "f_auto,q_auto,c_scale"
                        )
                      : undefined
                  }
                  sizes="(max-width: 768px) 85vw, 820px"
                  alt={banner.title || section?.title || "Banner"}
                  className="w-full h-full object-cover object-center pointer-events-none"
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

      {showDots && totalItems > 1 && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5" role="tablist" aria-label="Home banners">
          {visibleItems.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                index === activeIndex ? "w-5 bg-slate-800" : "w-1.5 bg-slate-300"
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
