import { useEffect, useRef, useState } from 'react';

// Sections that were already shown once in this session. When the customer comes back to the
// page (back button) they render at once, so the page is as tall as before and the scroll
// position is restored correctly.
const shownBefore = new Set();

/**
 * Renders its children only when the spot is within `rootMargin` of the screen.
 * Below-the-fold parts of a long page (and their API calls) then do not slow down the first screen.
 * Until then a plain empty block of `minHeight` keeps the page length roughly right.
 * Once shown it stays shown.
 */
const DeferredSection = ({ id, children, minHeight = 260, rootMargin = '700px 0px' }) => {
    const ref = useRef(null);
    const [show, setShow] = useState(() => (id && shownBefore.has(id)) || typeof IntersectionObserver === 'undefined');

    useEffect(() => {
        if (show) {
            if (id) shownBefore.add(id);
            return undefined;
        }
        const el = ref.current;
        if (!el) return undefined;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                setShow(true);
                observer.disconnect();
            }
        }, { rootMargin });
        observer.observe(el);
        return () => observer.disconnect();
    }, [show, id, rootMargin]);

    if (show) return children;
    return <div ref={ref} aria-hidden="true" style={{ minHeight }} />;
};

export default DeferredSection;
