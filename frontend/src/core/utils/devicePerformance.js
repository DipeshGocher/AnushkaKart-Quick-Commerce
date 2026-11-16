/**
 * Detects phones that struggle with heavy effects (blur, big animations) and flags the page,
 * so CSS and framer-motion can switch to a lighter look on them.
 *
 *   <html data-perf="low">   weak phone / data saver / "reduce motion"
 *   <html data-perf="high">  everything else
 *
 * Testing: open the app with ?perf=low or ?perf=high (remembered in this browser),
 * or ?perf=auto to go back to automatic detection.
 */
const STORAGE_KEY = 'perfMode';

const readOverride = () => {
    try {
        const q = new URLSearchParams(window.location.search).get('perf');
        if (q === 'low' || q === 'high') {
            window.localStorage.setItem(STORAGE_KEY, q);
            return q;
        }
        if (q === 'auto') {
            window.localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        const saved = window.localStorage.getItem(STORAGE_KEY);
        return saved === 'low' || saved === 'high' ? saved : null;
    } catch {
        return null;
    }
};

/** Pure check on the numbers a browser reports (easy to test). */
export const classifyDevice = ({ deviceMemory, hardwareConcurrency, saveData, reducedMotion } = {}) => {
    if (reducedMotion || saveData) return 'low';
    // deviceMemory is rounded GB and capped at 8 (Chrome / Android WebView). 4 GB or less = budget phone.
    if (Number.isFinite(deviceMemory) && deviceMemory > 0 && deviceMemory <= 4) return 'low';
    if (Number.isFinite(hardwareConcurrency) && hardwareConcurrency > 0 && hardwareConcurrency <= 4) return 'low';
    return 'high';
};

let cachedMode = null;

export const getPerformanceMode = () => {
    if (cachedMode) return cachedMode;
    if (typeof window === 'undefined') return 'high';
    const override = readOverride();
    if (override) {
        cachedMode = override;
        return cachedMode;
    }
    const nav = window.navigator || {};
    let reducedMotion = false;
    try {
        reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch {
        reducedMotion = false;
    }
    cachedMode = classifyDevice({
        deviceMemory: nav.deviceMemory,
        hardwareConcurrency: nav.hardwareConcurrency,
        saveData: Boolean(nav.connection?.saveData),
        reducedMotion,
    });
    return cachedMode;
};

export const isLowEndDevice = () => getPerformanceMode() === 'low';

/** Call once before React renders. */
export const applyPerformanceMode = () => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-perf', getPerformanceMode());
};
