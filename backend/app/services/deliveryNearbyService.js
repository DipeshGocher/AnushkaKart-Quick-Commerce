import Delivery from "../models/delivery.js";
import Seller from "../models/seller.js";
import { distanceMeters } from "../utils/geoUtils.js";

/** When true, only verified riders receive broadcasts (stricter). Default: do not require. */
const requireVerifiedForBroadcast = () =>
  process.env.DELIVERY_BROADCAST_REQUIRE_VERIFIED === "true";

const HAVERSINE_FALLBACK_LIMIT = () =>
  parseInt(process.env.DELIVERY_BROADCAST_HAVERSINE_LIMIT || "2000", 10);

function buildDeliveryFilter() {
  const q = { isOnline: true };
  if (requireVerifiedForBroadcast()) {
    q.isVerified = true;
  }
  return q;
}

function filterByHaversine(candidates, lat, lng, maxDistanceM) {
  return candidates
    .filter((d) => {
      const c = d.location?.coordinates;
      if (!Array.isArray(c) || c.length < 2) return false;
      const [dlng, dlat] = c;
      if (!Number.isFinite(dlat) || !Number.isFinite(dlng)) return false;
      if (Math.abs(dlat) < 1e-5 && Math.abs(dlng) < 1e-5) return false;
      return distanceMeters(dlat, dlng, lat, lng) <= maxDistanceM;
    })
    .map((d) => d._id.toString());
}

/**
 * Delivery partner IDs whose last known location is within the seller's
 * `serviceRadius` (km) of the seller store.
 * Uses MongoDB $near first; if that returns no rows, falls back to Haversine
 * (helps when geo index / $near is strict or data is borderline).
 */
export async function getDeliveryPartnerIdsWithinSellerRadius(sellerId) {
  if (!sellerId) return [];

  let entity = await Seller.findById(sellerId)
    .select("location pincode address")
    .lean();

  if (!entity) {
    try {
      const Warehouse = (await import("../models/warehouse.js")).default;
      entity = await Warehouse.findById(sellerId)
        .select("location pincode address")
        .lean();
    } catch (_wErr) {}
  }

  if (!entity?.location?.coordinates?.length) return [];

  const [lng, lat] = entity.location.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  if (Math.abs(lat) < 1e-5 && Math.abs(lng) < 1e-5) return [];

  // Determine rider search radius from the store's Local Pincode configuration set in Admin panel (max 30 km)
  let radiusKm = 10;
  const storePincode = String(entity.pincode || entity.address?.pincode || "").trim();
  if (storePincode) {
    try {
      const LocalPincode = (await import("../models/localPincode.js")).default;
      const localPin = await LocalPincode.findOne({ pincode: storePincode, isActive: true }).lean();
      if (localPin && Number.isFinite(localPin.riderRadiusKm)) {
        radiusKm = Math.min(Math.max(Number(localPin.riderRadiusKm), 1), 30);
      }
    } catch (_pErr) {}
  }

  const maxDistanceM = radiusKm * 1000;

  const base = buildDeliveryFilter();

  let ids = [];
  try {
    const candidates = await Delivery.find({
      ...base,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: maxDistanceM,
        },
      },
    })
      .select("_id location")
      .lean();

    ids = filterByHaversine(candidates, lat, lng, maxDistanceM);
  } catch (e) {
    console.warn(
      "[deliveryNearby] $near query failed, using Haversine fallback:",
      e.message,
    );
  }

  if (ids.length) return ids;

  try {
    const rough = await Delivery.find({
      ...base,
      "location.coordinates": { $exists: true },
    })
      .select("_id location")
      .limit(HAVERSINE_FALLBACK_LIMIT())
      .lean();

    return filterByHaversine(rough, lat, lng, maxDistanceM);
  } catch (e) {
    console.warn("[deliveryNearby] Haversine fallback failed:", e.message);
    return [];
  }
}

/**
 * Generic nearby rider search by coordinates.
 */
export async function getDeliveryPartnerIdsWithinRadius(lat, lng, radiusKm = 5) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  
  const maxDistanceM = radiusKm * 1000;
  const base = buildDeliveryFilter();

  let ids = [];
  try {
    const candidates = await Delivery.find({
      ...base,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: maxDistanceM,
        },
      },
    })
      .select("_id location")
      .lean();

    ids = filterByHaversine(candidates, lat, lng, maxDistanceM);
  } catch (e) {
    console.warn("[deliveryNearby] $near fallback search failed:", e.message);
  }

  if (ids.length) return ids;

  try {
    const rough = await Delivery.find({
      ...base,
      "location.coordinates": { $exists: true },
    })
      .select("_id location")
      .limit(HAVERSINE_FALLBACK_LIMIT())
      .lean();

    return filterByHaversine(rough, lat, lng, maxDistanceM);
  } catch (e) {
    return [];
  }
}

/**
 * Finds riders near a customer's location for return pickup.
 */
export async function getDeliveryPartnerIdsWithinCustomerRadius(customerLocation, radiusKm = 5) {
  const lat = customerLocation?.lat;
  const lng = customerLocation?.lng;
  return getDeliveryPartnerIdsWithinRadius(lat, lng, radiusKm);
}
