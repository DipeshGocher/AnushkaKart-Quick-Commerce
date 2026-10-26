import handleResponse from "../utils/helper.js";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Order from "../models/order.js";
import Product from "../models/product.js";
import LocalPincode from "../models/localPincode.js";
import {
  listLocalPincodes,
  addLocalPincode,
  updateLocalPincode,
  deleteLocalPincode,
  toggleLocalPincodeStatus,
  isPincodeLocal,
  getLocalPincodeDetails,
  evaluateDeliveryEligibility,
  resolveProductDeliveryMode,
} from "../services/shipping/localPincodeService.js";
import {
  processShiprocketOrder,
  requestShiprocketPickup,
  getShiprocketLabel,
  updateShiprocketManualStatus,
  processShiprocketWebhook,
  isShiprocketConfigured,
  recordShiprocketWeightDiscrepancy,
  createShiprocketReversePickup,
  getShiprocketReverseLabel,
  updateShiprocketReverseStatus,
} from "../services/shipping/shiprocketService.js";

/**
 * Public: Get active local quick delivery pincodes list
 */
export const getPublicLocalPincodes = async (req, res) => {
  try {
    const list = await LocalPincode.find({ isActive: true })
      .select("pincode areaName city state deliveryTimeEstimate")
      .lean();
    return handleResponse(res, 200, "Active local delivery pincodes", {
      localPincodes: list.map((p) => String(p.pincode).trim()),
      details: list,
    });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Check if a pincode is in the local quick commerce delivery zone or Shiprocket,
 * with optional product and seller origin validation.
 */
export const checkPincodeServiceability = async (req, res) => {
  try {
    const pincode = req.query.pincode || req.params.pincode;
    if (!pincode) {
      return handleResponse(res, 400, "Pincode is required");
    }

    const { productId, sellerPincode: querySellerPincode, deliveryMode: queryDeliveryMode } = req.query;

    let sellerPincode = querySellerPincode;
    let deliveryMode = queryDeliveryMode;

    if (productId) {
      try {
        const product = await Product.findById(productId)
          .select("deliveryMode headerId categoryId sellerId warehouseId")
          .populate("sellerId", "pincode")
          .populate("warehouseId", "pincode")
          .populate("headerId", "deliveryMode catalogType")
          .lean();

        if (product) {
          if (!deliveryMode) {
            deliveryMode = await resolveProductDeliveryMode(product, product.headerId);
          }
          if (!sellerPincode) {
            sellerPincode = product.sellerId?.pincode || product.warehouseId?.pincode || "";
          }
        }
      } catch (prodErr) {
        // Continue with basic pincode check
      }
    }

    const evaluation = await evaluateDeliveryEligibility({
      customerPincode: pincode,
      sellerPincode,
      deliveryMode: deliveryMode || "both",
    });

    const details = evaluation.isCustomerLocal ? await getLocalPincodeDetails(pincode) : null;

    return handleResponse(res, 200, "Serviceability checked", {
      pincode: String(pincode).trim(),
      sellerPincode: sellerPincode ? String(sellerPincode).trim() : null,
      isLocal: evaluation.isCustomerLocal,
      ...evaluation,
      areaName: details?.areaName || "",
      city: details?.city || "",
      state: details?.state || "",
    });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Validates delivery eligibility for an array of cart items against a customer pincode.
 */
export const validateCartDelivery = async (req, res) => {
  try {
    const { customerPincode, items = [] } = req.body;
    if (!customerPincode) {
      return handleResponse(res, 400, "customerPincode is required");
    }

    if (!Array.isArray(items) || items.length === 0) {
      return handleResponse(res, 200, "Cart is empty", {
        isValid: true,
        overallFulfillment: "LOCAL_RIDERS",
        items: [],
      });
    }

    const evaluatedItems = await Promise.all(
      items.map(async (item) => {
        let sellerPincode = item.sellerPincode;
        let deliveryMode = item.deliveryMode;

        if (item.productId && (!sellerPincode || !deliveryMode)) {
          try {
            const product = await Product.findById(item.productId)
              .select("name deliveryMode headerId categoryId sellerId warehouseId")
              .populate("sellerId", "pincode")
              .populate("warehouseId", "pincode")
              .populate("headerId", "deliveryMode catalogType")
              .lean();

            if (product) {
              if (!deliveryMode) {
                deliveryMode = await resolveProductDeliveryMode(product, product.headerId);
              }
              if (!sellerPincode) {
                sellerPincode = product.sellerId?.pincode || product.warehouseId?.pincode || "";
              }
            }
          } catch (e) {}
        }

        const result = await evaluateDeliveryEligibility({
          customerPincode,
          sellerPincode,
          deliveryMode: deliveryMode || "both",
        });

        return {
          productId: item.productId,
          name: item.name,
          ...result,
        };
      })
    );

    const hasBlockedItems = evaluatedItems.some((i) => !i.isDeliverable);
    const hasShiprocketItems = evaluatedItems.some((i) => i.fulfillmentType === "SHIPROCKET");
    const overallFulfillment = hasShiprocketItems ? "SHIPROCKET" : "LOCAL_RIDERS";

    return handleResponse(res, 200, "Delivery validated", {
      isValid: !hasBlockedItems,
      customerPincode: String(customerPincode).trim(),
      overallFulfillment,
      hasBlockedItems,
      hasShiprocketItems,
      items: evaluatedItems,
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
 * Helper to verify order fulfillment permission:
 * - Admin has master access across all orders
 * - Seller and Warehouse can strictly only manage courier shipments for their own assigned orders
 */
async function verifyOrderShipmentAccess(orderId, user) {
  if (!user) {
    const err = new Error("Authentication required");
    err.statusCode = 401;
    throw err;
  }
  if (user.role === "admin") {
    return;
  }
  let order = await Order.findOne({ orderId }).select("seller warehouseId").lean();
  if (!order && mongoose.Types.ObjectId.isValid(orderId)) {
    order = await Order.findById(orderId).select("seller warehouseId").lean();
  }
  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }
  const sellerId = (order.seller?._id || order.seller)?.toString?.() || "";
  const warehouseId = (order.warehouseId?._id || order.warehouseId)?.toString?.() || "";
  const userId = (user.id || user._id)?.toString?.() || "";
  if (sellerId !== userId && warehouseId !== userId) {
    const err = new Error("Unauthorized: You can only manage courier shipments for your own orders");
    err.statusCode = 403;
    throw err;
  }
}

/**
 * Admin / Seller: Process Shiprocket shipment & generate AWB
 */
export const processShiprocket = async (req, res) => {
  try {
    const { orderId } = req.params;
    await verifyOrderShipmentAccess(orderId, req.user);
    const result = await processShiprocketOrder(orderId);
    return handleResponse(res, 200, result.message || "Shiprocket shipment processed", result);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Admin / Seller: Request Courier Pickup on Shiprocket
 */
export const scheduleShiprocketPickup = async (req, res) => {
  try {
    const { orderId } = req.params;
    await verifyOrderShipmentAccess(orderId, req.user);
    const result = await requestShiprocketPickup(orderId);
    return handleResponse(res, 200, result.message || "Pickup requested", result);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Admin / Seller: Generate / Download Shipping Label
 */
export const fetchShiprocketLabel = async (req, res) => {
  try {
    const { orderId } = req.params;
    await verifyOrderShipmentAccess(orderId, req.user);
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
    const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN?.trim();
    if (!expectedToken) {
      return res.status(503).json({ success: false, message: "Shiprocket webhook is not configured" });
    }
    const suppliedToken = String(req.headers["x-api-key"] || "").trim();
    const expected = Buffer.from(expectedToken);
    const supplied = Buffer.from(suppliedToken);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
      return res.status(401).json({ success: false, message: "Unauthorized webhook" });
    }
    const result = await processShiprocketWebhook(req.body, req.headers);
    return res.status(result.success ? 200 : 400).json(result);
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

/**
 * Admin: Record Weight Discrepancy for Shiprocket Order
 * Penalty is deducted from seller payout during settlement.
 */
export const recordDiscrepancy = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { discrepancyAmount, reason, chargedWeightKg, enteredWeightKg } = req.body;
    const result = await recordShiprocketWeightDiscrepancy(orderId, {
      discrepancyAmount,
      reason,
      chargedWeightKg,
      enteredWeightKg,
    });
    return handleResponse(res, 200, result.message, result);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Admin / Seller: Manually Book or Re-attempt Shiprocket Reverse Pickup
 */
export const scheduleShiprocketReversePickupHandler = async (req, res) => {
  try {
    const { orderId } = req.params;
    await verifyOrderShipmentAccess(orderId, req.user);
    const result = await createShiprocketReversePickup(orderId);
    return handleResponse(res, 200, result.message || "Shiprocket reverse pickup scheduled", result);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Admin / Seller: Fetch / Download Shiprocket Reverse Shipping Label
 */
export const fetchShiprocketReverseLabel = async (req, res) => {
  try {
    const { orderId } = req.params;
    await verifyOrderShipmentAccess(orderId, req.user);
    const result = await getShiprocketReverseLabel(orderId);
    return handleResponse(res, 200, "Reverse shipping label fetched successfully", result);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * Admin / Seller: Update / Advance Shiprocket Reverse Pickup Status (for testing or manual sync)
 */
export const updateShiprocketReverseStatusManual = async (req, res) => {
  try {
    const { orderId } = req.params;
    await verifyOrderShipmentAccess(orderId, req.user);
    const { status, remarks, location } = req.body || {};
    const result = await updateShiprocketReverseStatus(orderId, { status, remarks, location }, req.user?.id);
    return handleResponse(res, 200, result.message, result);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};


