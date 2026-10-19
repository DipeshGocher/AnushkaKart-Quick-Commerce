import { Client } from "@googlemaps/google-maps-services-js";
import crypto from "crypto";
import { getRedisClient } from "../config/redis.js";
import GeocodeCache from "../models/geocodeCache.js";

const client = new Client({});

const GEOCODE_CACHE_TTL_SEC = () =>
  parseInt(process.env.GEOCODE_CACHE_TTL_SEC || "2592000", 10); // 30d

function getApiKey() {
  return (
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_SERVER_KEY?.trim() ||
    ""
  );
}

function cacheKeyAddress(address, country) {
  const raw = `geocode:v2:addr:${country || ""}:${address || ""}`.toLowerCase();
  const h = crypto.createHash("sha1").update(raw).digest("hex");
  return `geocode:v2:${h}`;
}

function cacheKeyPlaceId(placeId) {
  const raw = `geocode:v2:pid:${placeId || ""}`.toLowerCase();
  const h = crypto.createHash("sha1").update(raw).digest("hex");
  return `geocode:v2:${h}`;
}

/**
 * Forward geocode an address string or placeId -> { lat, lng, formattedAddress }.
 * Uses Redis cache when available.
 *
 * Requires Geocoding API enabled in Google Cloud.
 */
export async function geocodeAddress(address, { country } = {}) {
  if (!address || typeof address !== "string" || address.trim().length < 3) {
    const err = new Error("address is required");
    err.statusCode = 400;
    throw err;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error(
      "Google Maps API key missing. Set GOOGLE_MAPS_API_KEY (Geocoding API).",
    );
    err.statusCode = 500;
    err.code = "MAPS_KEY_MISSING";
    throw err;
  }

  const addr = address.trim();
  const redis = getRedisClient();
  const key = cacheKeyAddress(addr, country);

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // ignore cache errors
    }
  }

  // Mongo fallback cache (also used when Redis is disabled)
  try {
    const doc = await GeocodeCache.findOne({ key }).lean();
    if (doc && doc.expiresAt && doc.expiresAt > new Date()) {
      return {
        lat: doc.lat,
        lng: doc.lng,
        formattedAddress: doc.formattedAddress || addr,
        placeId: doc.placeId || null,
        types: Array.isArray(doc.types) ? doc.types : [],
      };
    }
  } catch {
    // ignore cache errors
  }

  const params = {
    address: addr,
    key: apiKey,
  };

  // Optional country bias (e.g. IN). This doesn't hardcode business rules; it just improves accuracy.
  if (country && typeof country === "string" && country.trim()) {
    params.components = `country:${country.trim().toUpperCase()}`;
  } else if (process.env.MAPS_DEFAULT_COUNTRY?.trim()) {
    params.components = `country:${process.env.MAPS_DEFAULT_COUNTRY.trim().toUpperCase()}`;
  }

  const resp = await client.geocode({ params, timeout: 10000 });
  const status = resp.data?.status;

  if (status && status !== "OK") {
    const msg = resp.data?.error_message || status;
    const err = new Error(`Geocoding failed: ${msg}`);
    err.statusCode = status === "ZERO_RESULTS" ? 404 : 502;
    err.code = status;
    throw err;
  }

  const first = resp.data?.results?.[0];
  const loc = first?.geometry?.location;
  if (!first || !loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
    const err = new Error("Geocoding returned no coordinates");
    err.statusCode = 404;
    err.code = "ZERO_RESULTS";
    throw err;
  }

  const result = {
    lat: loc.lat,
    lng: loc.lng,
    formattedAddress: first.formatted_address || addr,
    placeId: first.place_id || null,
    types: Array.isArray(first.types) ? first.types : [],
  };

  const expiresAt = new Date(Date.now() + GEOCODE_CACHE_TTL_SEC() * 1000);

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(result), "EX", GEOCODE_CACHE_TTL_SEC());
    } catch {
      // ignore cache errors
    }
  }

  try {
    await GeocodeCache.updateOne(
      { key },
      {
        $set: {
          lat: result.lat,
          lng: result.lng,
          formattedAddress: result.formattedAddress,
          placeId: result.placeId,
          types: result.types,
          expiresAt,
        },
      },
      { upsert: true },
    );
  } catch {
    // ignore mongo cache errors
  }

  return result;
}

export async function geocodePlaceId(placeId) {
  if (!placeId || typeof placeId !== "string" || placeId.trim().length < 5) {
    const err = new Error("placeId is required");
    err.statusCode = 400;
    throw err;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error(
      "Google Maps API key missing. Set GOOGLE_MAPS_API_KEY (Geocoding API).",
    );
    err.statusCode = 500;
    err.code = "MAPS_KEY_MISSING";
    throw err;
  }

  const pid = placeId.trim();
  const key = cacheKeyPlaceId(pid);
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch {
      // ignore
    }
  }

  try {
    const doc = await GeocodeCache.findOne({ key }).lean();
    if (doc && doc.expiresAt && doc.expiresAt > new Date()) {
      return {
        lat: doc.lat,
        lng: doc.lng,
        formattedAddress: doc.formattedAddress || "",
        placeId: doc.placeId || pid,
        types: Array.isArray(doc.types) ? doc.types : [],
      };
    }
  } catch {
    // ignore
  }

  // Geocoding API supports place_id param.
  const resp = await client.geocode({
    params: { place_id: pid, key: apiKey },
    timeout: 10000,
  });

  const status = resp.data?.status;
  if (status && status !== "OK") {
    const msg = resp.data?.error_message || status;
    const err = new Error(`Geocoding failed: ${msg}`);
    err.statusCode = status === "ZERO_RESULTS" ? 404 : 502;
    err.code = status;
    throw err;
  }

  const first = resp.data?.results?.[0];
  const loc = first?.geometry?.location;
  if (!first || !loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
    const err = new Error("Geocoding returned no coordinates");
    err.statusCode = 404;
    err.code = "ZERO_RESULTS";
    throw err;
  }

  const result = {
    lat: loc.lat,
    lng: loc.lng,
    formattedAddress: first.formatted_address || "",
    placeId: first.place_id || pid,
    types: Array.isArray(first.types) ? first.types : [],
  };

  const expiresAt = new Date(Date.now() + GEOCODE_CACHE_TTL_SEC() * 1000);

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(result), "EX", GEOCODE_CACHE_TTL_SEC());
    } catch {
      // ignore
    }
  }

  try {
    await GeocodeCache.updateOne(
      { key },
      {
        $set: {
          lat: result.lat,
          lng: result.lng,
          formattedAddress: result.formattedAddress,
          placeId: result.placeId,
          types: result.types,
          expiresAt,
        },
      },
      { upsert: true },
    );
  } catch {
    // ignore
  }

  return result;
}

function cacheKeyReverseGeocode(lat, lng) {
  const roundedLat = Number(lat).toFixed(5);
  const roundedLng = Number(lng).toFixed(5);
  const raw = `reverse_geocode:v2:${roundedLat}:${roundedLng}`.toLowerCase();
  const h = crypto.createHash("sha1").update(raw).digest("hex");
  return `geocode:v2:rev:${h}`;
}

/**
 * Reverse geocode coordinates -> { lat, lng, formattedAddress, friendlyName, city, state, pincode, placeId }.
 * Uses Redis cache and Mongo cache when available.
 */
export async function reverseGeocodeCoords(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const err = new Error("Valid lat and lng numbers are required");
    err.statusCode = 400;
    throw err;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error(
      "Google Maps API key missing. Set GOOGLE_MAPS_API_KEY.",
    );
    err.statusCode = 500;
    err.code = "MAPS_KEY_MISSING";
    throw err;
  }

  const redis = getRedisClient();
  const key = cacheKeyReverseGeocode(latitude, longitude);

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // ignore
    }
  }

  try {
    const doc = await GeocodeCache.findOne({ key }).lean();
    if (doc && doc.expiresAt && doc.expiresAt > new Date()) {
      return {
        lat: doc.lat,
        lng: doc.lng,
        formattedAddress: doc.formattedAddress,
        placeId: doc.placeId || null,
        city: "",
        state: "",
        pincode: "",
        friendlyName: doc.formattedAddress,
      };
    }
  } catch {
    // ignore
  }

  const resp = await client.reverseGeocode({
    params: {
      latlng: { lat: latitude, lng: longitude },
      key: apiKey,
    },
    timeout: 10000,
  });

  const status = resp.data?.status;
  if (status && status !== "OK") {
    const msg = resp.data?.error_message || status;
    const err = new Error(`Reverse geocoding failed: ${msg}`);
    err.statusCode = status === "ZERO_RESULTS" ? 404 : 502;
    err.code = status;
    throw err;
  }

  const first = resp.data?.results?.[0];
  if (!first) {
    const err = new Error("Reverse geocoding returned no results");
    err.statusCode = 404;
    err.code = "ZERO_RESULTS";
    throw err;
  }

  const components = first.address_components || [];
  const getComponent = (types) =>
    components.find((c) => types.every((t) => c.types.includes(t)))?.long_name;

  const premise = getComponent(["premise"]);
  const neighborhood = getComponent(["neighborhood"]);
  const sublocality = getComponent(["sublocality_level_1", "sublocality"]);
  const locality = getComponent(["locality"]);
  const state = getComponent(["administrative_area_level_1"]);
  const pincode = getComponent(["postal_code"]);

  const displayParts = [];
  if (premise) displayParts.push(premise);
  if (neighborhood) displayParts.push(neighborhood);
  if (sublocality && sublocality !== neighborhood) displayParts.push(sublocality);
  if (locality && !displayParts.includes(locality)) displayParts.push(locality);

  let friendlyName = displayParts.join(", ");
  if (!friendlyName) {
    const parts = (first.formatted_address || "").split(",");
    friendlyName = (parts.slice(0, 2).join(",") || "Current Location").trim();
  }

  const result = {
    lat: latitude,
    lng: longitude,
    formattedAddress: first.formatted_address || friendlyName,
    friendlyName,
    city: locality || "",
    state: state || "",
    pincode: pincode || "",
    placeId: first.place_id || null,
  };

  const expiresAt = new Date(Date.now() + GEOCODE_CACHE_TTL_SEC() * 1000);
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(result), "EX", GEOCODE_CACHE_TTL_SEC());
    } catch {}
  }

  try {
    await GeocodeCache.updateOne(
      { key },
      {
        $set: {
          lat: latitude,
          lng: longitude,
          formattedAddress: result.formattedAddress,
          placeId: result.placeId,
          expiresAt,
        },
      },
      { upsert: true },
    );
  } catch {}

  return result;
}
