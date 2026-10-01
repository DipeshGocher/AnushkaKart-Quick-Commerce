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

const ExperienceBannerCarousel = ({ section, items, fullWidth = false, slideGap = 0, edgeToEdge = false, showDots = false, showContentOverlay = true }) => {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [visibleCount, setVisibleCount] = React.useState(() =>
    Math.min(items.length, BANNER_CHUNK_SIZE)
  );
  const visibleItems = items.slice(0, visibleCount);
  const totalItems = visibleItems.length;
  const currentSlideIsVideo = Boolean(visibleItems[activeIndex]?.isVideo);
  const containerRef = React.useRef(null);
  const hasMore = visibleCount < items.length;

  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => Math.min(items.length, prev + BANNER_CHUNK_SIZE));
  }, [items.length]);

  React.useEffect(() => {
    setVisibleCount(Math.min(items.length, BANNER_CHUNK_SIZE));
    setActiveIndex(0);
  }, [items.length]);

  // Auto-play logic
  React.useEffect(() => {
    if (totalItems <= 1) return;

    // If current slide is video, do not auto-advance with setInterval. 
    // The video's onEnded event will handle it.
    if (currentSlideIsVideo) return;

    const intervalId = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalItems);
    }, 4500);

    return () => clearInterval(intervalId);
  }, [totalItems, activeIndex, currentSlideIsVideo]);

  React.useEffect(() => {
    if (!hasMore) return;
    if (activeIndex >= totalItems - 2) {
      loadMore();
    }
  }, [activeIndex, totalItems, hasMore, loadMore]);

  const handleDragEnd = (_, info) => {
    const threshold = 50;
    if (info.offset.x < -threshold) {
      // Swipe left -> Next
      setActiveIndex((prev) => Math.min(prev + 1, totalItems - 1));
    } else if (info.offset.x > threshold) {
      // Swipe right -> Prev
      setActiveIndex((prev) => Math.max(prev - 1, 0));
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
    <div className="w-full">
      <div className={cn("overflow-hidden touch-pan-y", fullWidth && "rounded-[20px] shadow-md")}>
      <motion.div
        ref={containerRef}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={{ x: `-${(activeIndex / totalItems) * 100}%` }}
        transition={isMobileOrWebView() ? { type: "tween", ease: "easeInOut", duration: 0.3 } : { type: "spring", stiffness: 300, damping: 30 }}
        className="flex"
        style={{ width: `${totalItems * 100}%` }}
      >
        {visibleItems.map((banner, idx) => (
          <div
            key={idx}
            onClick={() => handleBannerClick(banner)}
            className={cn(
              "relative shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center box-border cursor-pointer",
              fullWidth ? "aspect-[2/1] sm:aspect-[21/9] rounded-none px-0" : "px-4 md:px-8 py-4 sm:py-6"
            )}
            style={{ width: `${100 / totalItems}%` }}
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
                className={cn(
                  "w-full h-full object-cover object-center pointer-events-none",
                  !fullWidth && "rounded-[24px] max-w-[960px] aspect-[2/1] sm:aspect-[21/9] shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
                )}
                onEnded={() => {
                  setActiveIndex((prev) => (prev + 1) % totalItems);
                }}
              />
            ) : fullWidth ? (
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
                sizes="100vw"
                alt={banner.title || section?.title || "Banner"}
                className="w-full h-full object-cover object-center pointer-events-none"
                loading={idx === 0 ? "eager" : "lazy"}
                fetchPriority={idx === 0 ? "high" : "low"}
                decoding="async"
              />
            ) : (
              <div className="w-full max-w-[960px] aspect-[2/1] sm:aspect-[21/9] overflow-hidden rounded-[24px] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                <img
                  src={getBannerOptimizedSrc(banner.imageUrl)}
                  srcSet={
                    isCloudinaryUrl(banner.imageUrl)
                      ? buildCloudinarySrcSet(
                          banner.imageUrl,
                          [{ w: 560 }, { w: 960 }, { w: 1200 }],
                          "f_auto,q_auto,c_scale"
                        )
                      : undefined
                  }
                  sizes="(max-width: 768px) 100vw, 560px"
                  alt={banner.title || section?.title || "Banner"}
                  className="w-full h-full object-cover object-center pointer-events-none"
                  loading={idx === 0 ? "eager" : "lazy"}
                  fetchPriority={idx === 0 ? "high" : "low"}
                  decoding="async"
                />
              </div>
            )}
            
            {/* Title & Subtitle Overlay */}
            {showContentOverlay && (banner.title || banner.subtitle) && (
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent p-6 sm:p-8 md:p-10 pointer-events-none">
                {banner.title && <h3 className="text-white font-black text-xl sm:text-2xl md:text-3xl drop-shadow-md">{banner.title}</h3>}
                {banner.subtitle && <p className="text-white/90 font-medium text-sm sm:text-base md:text-lg mt-1.5 drop-shadow-md">{banner.subtitle}</p>}
              </div>
            )}
          </div>
        ))}
      </motion.div>
      </div>
      {showDots && fullWidth && totalItems > 1 && (
        <div className="mt-1.5 flex items-center justify-center gap-1.5 rounded-b-[20px] bg-white px-2 py-1.5" role="tablist" aria-label="Home banners">
          {visibleItems.map((item, index) => (
            <button
              key={`${item.imageUrl || item.videoUrl || 'banner'}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="relative h-1.5 w-5 overflow-hidden rounded-full bg-slate-300"
              aria-label={`Show banner ${index + 1}`}
              aria-selected={index === activeIndex}
              role="tab"
            >
              <span className={`absolute inset-y-0 left-0 rounded-full bg-[#222] ${index === activeIndex ? currentSlideIsVideo ? 'w-full' : 'home-banner-dot-progress' : 'w-0'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExperienceBannerCarousel;
