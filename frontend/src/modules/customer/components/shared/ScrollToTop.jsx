import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// In-memory scroll position memory map keyed by pathname
const scrollPositionMap = new Map();

// Primary tab paths that preserve browsing position across tab switching
const TAB_PATHS = new Set(["/", "/categories", "/cart", "/orders", "/profile"]);

const ScrollToTop = () => {
    const { pathname } = useLocation();
    const navigationType = useNavigationType();
    const prevPathRef = useRef(pathname);

    // Track scroll position on the active page
    useEffect(() => {
        const handleScroll = () => {
            scrollPositionMap.set(pathname, window.scrollY);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
            // Save final scroll position on unmount/route change
            scrollPositionMap.set(pathname, window.scrollY);
            window.removeEventListener("scroll", handleScroll);
        };
    }, [pathname]);

    // Handle scroll position on navigation
    useEffect(() => {
        const prevPath = prevPathRef.current;
        prevPathRef.current = pathname;

        // Blur active element to prevent mobile keyboard from popping up
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        const isPopNavigation = navigationType === "POP";
        const isTabSwitch = TAB_PATHS.has(pathname) && TAB_PATHS.has(prevPath);

        if (isPopNavigation || isTabSwitch) {
            const savedPosition = scrollPositionMap.get(pathname);
            if (typeof savedPosition === "number" && savedPosition > 0) {
                // Restore scroll position after DOM paints
                requestAnimationFrame(() => {
                    window.scrollTo({ top: savedPosition, left: 0, behavior: "instant" });
                    // Secondary check in case content renders asynchronously
                    setTimeout(() => {
                        if (Math.abs(window.scrollY - savedPosition) > 50 && document.documentElement.scrollHeight > savedPosition) {
                            window.scrollTo({ top: savedPosition, left: 0, behavior: "instant" });
                        }
                    }, 60);
                });
                return;
            }
        }

        // Default: PUSH navigation to a new sub-page scrolls to top
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [pathname, navigationType]);

    return null;
};

export default ScrollToTop;

