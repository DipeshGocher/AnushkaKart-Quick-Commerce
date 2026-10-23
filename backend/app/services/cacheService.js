import { getRedisClient } from "../config/redis.js";
import * as logger from "./logger.js";
import { incrementCounter } from "./metrics.js";

/**
 * Cache Service
 * 
 * Manages Redis caching with TTL and invalidation strategies.
 * Provides cache-aside pattern, pub/sub invalidation, and graceful
 * fallback to database on Redis errors.
 */

// Configuration constants
const CACHE_ENABLED = process.env.CACHE_ENABLED !== "false";
const CACHE_INVALIDATION_CHANNEL = "cache:invalidate";
const CACHE_KEY_VERSION = String(process.env.CACHE_KEY_VERSION || "").trim();

// TTL configuration (seconds)
const TTL_CONFIG = {
  categories: parseInt(process.env.CACHE_CATEGORIES_TTL || "3600", 10), // 1 hour
  settings: parseInt(process.env.CACHE_SETTINGS_TTL || "3600", 10), // 1 hour
  deliveryRules: parseInt(process.env.CACHE_DELIVERY_RULES_TTL || "1800", 10), // 30 minutes
  product: parseInt(process.env.CACHE_PRODUCT_TTL || "300", 10), // 5 minutes
  homepage: parseInt(process.env.CACHE_HOMEPAGE_TTL || "600", 10), // 10 minutes
  dashboard: parseInt(process.env.CACHE_DASHBOARD_TTL || "300", 10), // 5 minutes
  orders: parseInt(process.env.CACHE_ORDERS_TTL || "60", 10), // 1 minute
  nearbySellers: parseInt(process.env.CACHE_NEARBY_SELLERS_TTL || "300", 10), // 5 minutes
  productList: parseInt(process.env.CACHE_PRODUCT_LIST_TTL || "300", 10), // 5 minutes
  categoryName: parseInt(process.env.CACHE_CATEGORY_NAME_TTL || "3600", 10), // 1 hour

  // P6.2 — hot read paths called out in the refactor plan.
  // Conservatively short TTLs so write-side invalidations are forgiving.
  deliveryStats: parseInt(process.env.CACHE_DELIVERY_STATS_TTL || "30", 10), // 30s
  deliveryEarnings: parseInt(process.env.CACHE_DELIVERY_EARNINGS_TTL || "30", 10), // 30s
  deliveryCodSummary: parseInt(process.env.CACHE_DELIVERY_COD_SUMMARY_TTL || "30", 10), // 30s
  sellerStats: parseInt(process.env.CACHE_SELLER_STATS_TTL || "60", 10), // 1 minute
  sellerReturns: parseInt(process.env.CACHE_SELLER_RETURNS_TTL || "30", 10), // 30s
};

/**
 * Build namespaced cache key
 * @param {string} service - Service name
 * @param {string} entity - Entity type
 * @param {string} identifier - Entity identifier (optional)
 * @returns {string} Namespaced cache key
 */
export function buildKey(service, entity, identifier = "") {
  const prefix = CACHE_KEY_VERSION
    ? `cache:${CACHE_KEY_VERSION}:${service}:${entity}`
    : `cache:${service}:${entity}`;
  if (identifier) {
    return `${prefix}:${identifier}`;
  }
  return prefix;
}

function labelsFromKey(key = "") {
  const parts = String(key || "").split(":");
  if (parts.length < 3) {
    return { service: "unknown", entity: "unknown" };
  }
  if (parts.length >= 5 && parts[1] === CACHE_KEY_VERSION && CACHE_KEY_VERSION) {
    return {
      service: parts[2] || "unknown",
      entity: parts[3] || "unknown",
    };
  }
  return {
    service: parts[1] || "unknown",
    entity: parts[2] || "unknown",
  };
}

// In-Memory L1 Cache for zero-latency (<0.1ms) reads
const l1Cache = new Map();
const L1_MAX_SIZE = 1000;

function cleanL1() {
  if (l1Cache.size > L1_MAX_SIZE) {
    const oldestKey = l1Cache.keys().next().value;
    if (oldestKey) l1Cache.delete(oldestKey);
  }
}

/**
 * Get cached value
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached value or null if not found
 */
export async function get(key) {
  if (!CACHE_ENABLED) {
    return null;
  }
  
  // 1. Check ultra-fast L1 In-Memory cache (<0.1ms)
  const l1Entry = l1Cache.get(key);
  if (l1Entry) {
    if (Date.now() < l1Entry.expiresAt) {
      incrementCounter("cache_hit_total", labelsFromKey(key));
      return l1Entry.value;
    }
    l1Cache.delete(key);
  }

  // 2. Redis fallback with timeout protection (never block user > 120ms)
  try {
    const redis = getRedisClient();
    if (!redis) return null;
    
    const data = await Promise.race([
      redis.get(key),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 120)),
    ]);
    
    if (!data) {
      logger.debug(`[Cache] Miss: ${key}`);
      incrementCounter("cache_miss_total", labelsFromKey(key));
      return null;
    }
    
    logger.debug(`[Cache] Hit: ${key}`);
    incrementCounter("cache_hit_total", labelsFromKey(key));
    const parsed = JSON.parse(data);
    l1Cache.set(key, { value: parsed, expiresAt: Date.now() + 60000 });
    cleanL1();
    return parsed;
    
  } catch (error) {
    logger.debug(`[Cache] Redis skipped for ${key}:`, error?.message);
    return null;
  }
}

/**
 * Set cached value with TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttlSeconds - TTL in seconds
 * @returns {Promise<void>}
 */
export async function set(key, value, ttlSeconds = 300) {
  if (!CACHE_ENABLED) {
    return;
  }
  
  // 1. Immediate L1 in-memory write (<0.1ms)
  if (ttlSeconds <= 0) {
    l1Cache.delete(key);
  } else {
    l1Cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    cleanL1();
  }

  // 2. Fire-and-forget Redis write (non-blocking)
  try {
    const redis = getRedisClient();
    if (!redis) return;
    
    if (ttlSeconds <= 0) {
      redis.del(key).catch(() => {});
      return;
    }

    const serialized = JSON.stringify(value);
    redis.setex(key, ttlSeconds, serialized).catch(() => {});
    incrementCounter("cache_set_total", labelsFromKey(key));
    
  } catch (error) {
    // Non-blocking fallback
  }
}

/**
 * Delete cached value
 * @param {string} key - Cache key
 * @returns {Promise<void>}
 */
export async function del(key) {
  l1Cache.delete(key);
  if (!CACHE_ENABLED) {
    return;
  }
  
  try {
    const redis = getRedisClient();
    if (!redis) return;
    
    redis.del(key).catch(() => {});
    incrementCounter("cache_delete_total", labelsFromKey(key));
  } catch (error) {
    // Non-blocking fallback
  }
}

/**
 * Delete multiple keys matching pattern
 * Uses SCAN for production safety (not KEYS)
 * @param {string} pattern - Key pattern (e.g., "cache:product:*")
 * @returns {Promise<number>} Number of keys deleted
 */
export async function delPattern(pattern) {
  try {
    const basePrefix = pattern.replace(/[*].*$/, "");
    const escaped = pattern.replace(/[*]/g, ".*");
    const regex = new RegExp(`^${escaped}$`);
    for (const k of l1Cache.keys()) {
      if ((basePrefix && k.startsWith(basePrefix)) || regex.test(k)) {
        l1Cache.delete(k);
      }
    }
  } catch {}

  if (!CACHE_ENABLED) {
    return 0;
  }
  
  try {
    const redis = getRedisClient();
    if (!redis) return 0;
    
    let cursor = "0";
    let deletedCount = 0;
    
    do {
      // Use SCAN instead of KEYS for production safety
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      
      cursor = nextCursor;
      
      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
      
    } while (cursor !== "0");
    
    logger.info(`[Cache] Deleted ${deletedCount} keys matching pattern: ${pattern}`);
    return deletedCount;
    
  } catch (error) {
    logger.error(`[Cache] Error deleting pattern ${pattern}:`, error);
    return 0;
  }
}

/**
 * Get or set cached value (cache-aside pattern)
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch value if not cached
 * @param {number} ttlSeconds - TTL in seconds
 * @returns {Promise<any>} Cached or fetched value
 */
export async function getOrSet(key, fetchFn, ttlSeconds) {
  // Try to get from cache
  const cached = await get(key);
  
  if (cached !== null) {
    return cached;
  }
  
  // Cache miss: fetch from source
  try {
    const value = await fetchFn();
    
    // Store in cache for next time
    await set(key, value, ttlSeconds);
    
    return value;
    
  } catch (error) {
    logger.error(`[Cache] Error in getOrSet for key ${key}:`, error);
    throw error;
  }
}

/**
 * Invalidate cache and publish event to all instances
 * @param {string} key - Cache key or pattern
 * @returns {Promise<void>}
 */
export async function invalidate(key) {
  if (!CACHE_ENABLED) {
    return;
  }
  
  try {
    const patterns = [key];
    if (
      CACHE_KEY_VERSION &&
      String(key || "").startsWith("cache:") &&
      !String(key || "").startsWith(`cache:${CACHE_KEY_VERSION}:`)
    ) {
      patterns.push(String(key).replace(/^cache:/, `cache:${CACHE_KEY_VERSION}:`));
    }
    
    // Always delete the key(s) from local L1 cache and Redis (if connected)
    for (const candidate of patterns) {
      if (candidate.includes("*")) {
        await delPattern(candidate);
      } else {
        await del(candidate);
      }
    }

    const redis = getRedisClient();
    if (!redis) return;
    
    // Publish invalidation event to all instances
    const message = JSON.stringify({
      key: patterns[0],
      patterns,
      timestamp: Date.now(),
    });
    
    await redis.publish(CACHE_INVALIDATION_CHANNEL, message);
    logger.info(`[Cache] Invalidation published for key: ${key}`);
    
  } catch (error) {
    logger.error(`[Cache] Error invalidating key ${key}:`, error);
    // Graceful fallback: don't throw, just log
  }
}

/**
 * Subscribe to cache invalidation events
 * Should be called once during application startup
 * @param {Function} callback - Callback function to handle invalidation events
 * @returns {Promise<void>}
 */
export async function subscribeToInvalidations(callback) {
  if (!CACHE_ENABLED) {
    return;
  }
  
  try {
    const redis = getRedisClient();
    if (!redis) return;
    
    // Create a separate Redis client for pub/sub
    const subscriber = redis.duplicate();
    
    await subscriber.subscribe(CACHE_INVALIDATION_CHANNEL);
    
    subscriber.on("message", (channel, message) => {
      if (channel === CACHE_INVALIDATION_CHANNEL) {
        try {
          const data = JSON.parse(message);
          logger.debug(`[Cache] Invalidation received for key: ${data.key}`);
          
          if (callback) {
            callback(data);
          }
          
        } catch (error) {
          logger.error("[Cache] Error processing invalidation message:", error);
        }
      }
    });
    
    logger.info(`[Cache] Subscribed to invalidation channel: ${CACHE_INVALIDATION_CHANNEL}`);
    
  } catch (error) {
    logger.error("[Cache] Error subscribing to invalidations:", error);
    // Don't throw - cache invalidation is not critical for app startup
  }
}

/**
 * Get TTL configuration for a cache type
 * @param {string} type - Cache type (categories, settings, product, etc.)
 * @returns {number} TTL in seconds
 */
export function getTTL(type) {
  return TTL_CONFIG[type] || 300; // Default 5 minutes
}

export default {
  buildKey,
  get,
  set,
  del,
  delPattern,
  getOrSet,
  invalidate,
  subscribeToInvalidations,
  getTTL,
};
