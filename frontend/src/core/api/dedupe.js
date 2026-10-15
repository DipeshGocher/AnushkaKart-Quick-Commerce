import axiosInstance from './axios';

// ── TTL tiers ──────────────────────────────────────────────────────────────
// Products/home data: 2 min  (stable, but freshness matters)
// Categories/settings: 5 min (very stable, change rarely)
// Hero/CMS: 30 s (admin can change at any time)
export const TTL = {
    SHORT: 30 * 1000,        // 30 s  — hero/CMS config
    MEDIUM: 2 * 60 * 1000,   // 2 min — product lists
    LONG: 5 * 60 * 1000,     // 5 min — categories, settings
};
const DEFAULT_CACHE_TTL_MS = TTL.MEDIUM;

// Prevent unbounded memory growth: evict oldest entry when cache exceeds this.
const MAX_CACHE_ENTRIES = 80;

const apiCache = new Map();
const inFlightRequests = new Map();

const buildCacheKey = (url, params = {}) => {
    const entries = Object.entries(params || {}).sort(([a], [b]) => a.localeCompare(b));
    return `${url}?${JSON.stringify(entries)}`;
};

/** Evict the oldest entry when the cache is too large (simple LRU approximation). */
function maybeEvict() {
    if (apiCache.size <= MAX_CACHE_ENTRIES) return;
    // Map iteration order is insertion order — delete the first (oldest) key.
    const firstKey = apiCache.keys().next().value;
    if (firstKey) apiCache.delete(firstKey);
}

/**
 * Generic helper to deduplicate and cache GET requests across the whole app.
 *
 * @param {string}  url
 * @param {object}  params        — query params
 * @param {object}  options
 * @param {number}  options.ttl         — cache TTL in ms (default: TTL.MEDIUM = 2 min)
 * @param {boolean} options.forceRefresh — bypass cache
 */
export const getWithDedupe = async (url, params = {}, options = {}) => {
    const ttl = options.ttl ?? DEFAULT_CACHE_TTL_MS;
    const forceRefresh = options.forceRefresh || false;
    const key = buildCacheKey(url, params);
    const now = Date.now();

    if (!forceRefresh) {
        const cached = apiCache.get(key);
        if (cached && now - cached.ts < ttl) {
            return cached.response;
        }
    }

    const inFlight = inFlightRequests.get(key);
    if (inFlight && !forceRefresh) {
        return inFlight;
    }

    const request = axiosInstance.get(url, { params })
        .then((response) => {
            maybeEvict();
            apiCache.set(key, { ts: Date.now(), response });
            return response;
        })
        .finally(() => {
            inFlightRequests.delete(key);
        });

    inFlightRequests.set(key, request);
    return request;
};

/**
 * Invalidate cache entries whose key starts with `pattern` (string prefix)
 * or matches `pattern` (RegExp).
 */
export const invalidateCache = (pattern) => {
    if (typeof pattern === 'string') {
        apiCache.forEach((_, key) => {
            if (key.startsWith(pattern)) apiCache.delete(key);
        });
    } else if (pattern instanceof RegExp) {
        apiCache.forEach((_, key) => {
            if (pattern.test(key)) apiCache.delete(key);
        });
    }
};

/** Wipe the entire in-memory cache (e.g. after CMS update broadcast). */
export const clearAllCache = () => {
    apiCache.clear();
};
