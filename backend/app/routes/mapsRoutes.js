import express from "express";
import { geocodeAddressController, reverseGeocodeController } from "../controller/mapsController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { mapsRateLimit } from "../middleware/mapsRateLimit.js";
import { validate } from "../middleware/validate.js";
import { geocodeQuerySchema, reverseGeocodeQuerySchema } from "../validation/mapsValidation.js";

const router = express.Router();

// Forward geocode: address string -> lat/lng (server-side key).
// Auth required to avoid public abuse of the server API key.
router.get(
    "/geocode",
    verifyToken,
    mapsRateLimit,
    validate(geocodeQuerySchema, "query"),
    geocodeAddressController,
);

// Reverse geocode: lat/lng -> formatted address & components.
// Accessible to guest customers and logged-in users alike.
router.get(
    "/reverse-geocode",
    mapsRateLimit,
    validate(reverseGeocodeQuerySchema, "query"),
    reverseGeocodeController,
);

export default router;

