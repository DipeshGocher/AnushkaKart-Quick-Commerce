import handleResponse from "../utils/helper.js";
import {
  listLocalPincodes,
  addLocalPincode,
  updateLocalPincode,
  deleteLocalPincode,
  toggleLocalPincodeStatus,
  isPincodeLocal,
  getLocalPincodeDetails,
} from "../services/shipping/localPincodeService.js";
import {
  processShiprocketOrder,
  requestShiprocketPickup,
  getShiprocketLabel,
  updateShiprocketManualStatus,
  processShiprocketWebhook,
  isShiprocketConfigured,
} from "../services/shipping/shiprocketService.js";

/**
 * Check if a pincode is in the local quick commerce delivery zone or Shiprocket
 */
export const checkPincodeServiceability = async (req, res) => {
  try {
    const pincode = req.query.pincode || req.params.pincode;
    if (!pincode) {
      return handleResponse(res, 400, "Pincode is required");
    }

    const isLocal = await isPincodeLocal(pincode);
    const details = isLocal ? await getLocalPincodeDetails(pincode) : null;

    return handleResponse(res, 200, "Serviceability checked", {
      pincode: String(pincode).trim(),
      isLocal,
      fulfillmentType: isLocal ? "LOCAL" : "SHIPROCKET",
      deliveryEstimate: isLocal
        ? (details?.deliveryTimeEstimate || "12-15 mins")
        : "3-5 business days",
      areaName: details?.areaName || "",
      city: details?.city || "",
      state: details?.state || "",
    });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Admin: List local delivery pincodes
 */
export const getPincodes = async (req, res) => {
  try {
    const { search = "", status = "all", page = 1, limit = 50 } = req.query;
    const result = await listLocalPincodes({ search, status, page, limit });
    return handleResponse(res, 200, "Pincodes retrieved", result);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Admin: Add new local delivery pincode
 */
export const createPincode = async (req, res) => {
  try {
    const record = await addLocalPincode(req.body);
    return handleResponse(res, 201, "Local delivery pincode added successfully", record);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Admin: Update existing local pincode
 */
export const updatePincode = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateLocalPincode(id, req.body);
    return handleResponse(res, 200, "Pincode updated successfully", updated);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Admin: Delete local pincode
 */
export const deletePincode = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteLocalPincode(id);
    return handleResponse(res, 200, "Pincode removed successfully", deleted);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Admin: Toggle pincode active state
 */
export const togglePincode = async (req, res) => {
  try {
    const { id } = req.params;
    const toggled = await toggleLocalPincodeStatus(id);
    return handleResponse(res, 200, `Pincode is now ${toggled.isActive ? "Active" : "Inactive"}`, toggled);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Admin: Process Shiprocket shipment & generate AWB
 */
export const processShiprocket = async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await processShiprocketOrder(orderId);
    return handleResponse(res, 200, result.message || "Shiprocket shipment processed", result);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Admin: Request Courier Pickup on Shiprocket
 */
export const scheduleShiprocketPickup = async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await requestShiprocketPickup(orderId);
    return handleResponse(res, 200, result.message || "Pickup requested", result);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Admin: Generate / Download Shipping Label
 */
export const fetchShiprocketLabel = async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await getShiprocketLabel(orderId);
    return handleResponse(res, 200, "Shipping label fetched", result);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Admin: Manual Shiprocket Status Update
 */
export const updateShiprocketStatusManual = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, remarks, location } = req.body;
    const result = await updateShiprocketManualStatus(orderId, { status, remarks, location }, req.user?.id);
    return handleResponse(res, 200, result.message, result);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Public Webhook: Shiprocket Status Updates
 */
export const shiprocketWebhookHandler = async (req, res) => {
  try {
    const result = await processShiprocketWebhook(req.body, req.headers);
    return res.status(200).json(result);
  } catch (error) {
    console.error("[Shiprocket Webhook Error]:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Configuration status check
 */
export const getShiprocketStatus = async (req, res) => {
  return handleResponse(res, 200, "Shiprocket configuration status", {
    configured: isShiprocketConfigured(),
    pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
  });
};
