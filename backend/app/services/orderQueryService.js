import Order from "../models/order.js";
import { buildQcView } from "../utils/returnQcPolicy.js";
import mongoose from "mongoose";
import Delivery from "../models/delivery.js";
import Seller from "../models/seller.js";
import CheckoutGroup from "../models/checkoutGroup.js";
import OrderOtp from "../models/orderOtp.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { distanceMeters } from "../utils/geoUtils.js";
import {
  orderMatchQueryFlexible,
} from "../utils/orderLookup.js";
import { buildKey, getOrSet, getTTL } from "./cacheService.js";
import { resolveWorkflowStatus } from "./orderWorkflowService.js";
import logger from "./logger.js";
import { sanitizeOrderForCustomer } from "../utils/customerShipmentView.js";
import { buildReturnMoneyView } from "./order/returnMoney.js";
import { attachParcelIssues } from "../utils/parcelCheck.js";

function svcErr(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function refToIdString(ref) {
  if (ref == null) return "";
  if (typeof ref === "object" && ref._id != null) return String(ref._id);
  return String(ref);
}

/**
 * UPI QR orders whose payment admin has not approved yet. They live ONLY on the
 * "Pending UPI Approvals" page; everywhere else in the admin order lists they are hidden
 * until approved. (Cancelled ones are excluded: an expired order is history, not a to-do.)
 */
export const UNAPPROVED_UPI_ORDER = Object.freeze({
  paymentMode: "UPI_QR",
  paymentStatus: { $in: ["AWAITING_VERIFICATION", "CREATED", "REJECTED"] },
  status: { $ne: "cancelled" },
});

function isUpiPendingFilter(statusParam) {
  return String(statusParam || "").toLowerCase().trim().replace(/_/g, "-") === "upi-pending";
}

/** Order statuses that are finished (or belong to the Returns pages), so they are never "active". */
const NOT_ACTIVE_ORDER_STATUSES = ["delivered", "cancelled", "returned", "refunded"];
const NO_RETURN = {
  $or: [{ returnStatus: { $in: ["none", null, ""] } }, { returnStatus: { $exists: false } }],
};

function normalizeSellerStatusFilter(statusParam) {
  if (!statusParam || statusParam === "all") {
    return {};
  }

  const normalized = String(statusParam).toLowerCase().trim().replace(/_/g, "-");

  // Admin "Active Orders": everything still in progress and not in a return. Any status we do not know
  // by name counts as active too, so an order can never fall out of every list.
  if (normalized === "active") {
    return { status: { $nin: NOT_ACTIVE_ORDER_STATUSES }, ...NO_RETURN };
  }
  // Admin "Completed Orders": delivered (with no return in progress/finished) and cancelled.
  if (normalized === "completed") {
    return {
      $or: [
        {
          status: "delivered",
          $or: [
            { returnStatus: { $in: ["none", "return_rejected", null, ""] } },
            { returnStatus: { $exists: false } },
          ],
        },
        { status: "cancelled" },
      ],
    };
  }

  if (normalized === "upi-pending") {
    return { ...UNAPPROVED_UPI_ORDER };
  }
  if (normalized === "pending") {
    return { status: "pending" };
  }
  if (normalized === "confirmed") {
    return { status: "confirmed" };
  }
  if (normalized === "packed") {
    return { status: "packed" };
  }
  if (normalized === "processed") {
    return { status: { $in: ["confirmed", "packed"] } };
  }
  if (normalized === "out-for-delivery") {
    return { status: "out_for_delivery" };
  }
  if (normalized === "delivered") {
    return {
      status: "delivered",
      $or: [
        { returnStatus: { $in: ["none", "return_rejected", null, ""] } },
        { returnStatus: { $exists: false } },
      ],
    };
  }
  if (normalized === "cancelled") {
    return { status: "cancelled" };
  }
  if (normalized === "returned") {
    return {
      $or: [
        { status: "returned" },
        { returnStatus: { $nin: ["none", null, ""] } },
      ],
    };
  }

  return { status: statusParam };
}

function appendDateRange(query, { startDate, endDate }) {
  if (!startDate && !endDate) {
    return query;
  }

  const range = {};
  if (startDate) {
    range.$gte = new Date(startDate);
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }

  return {
    ...query,
    createdAt: range,
  };
}

export function buildSellerOrdersQuery({
  role,
  userId,
  statusParam,
  startDate,
  endDate,
}) {
  const targetId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  const base = role === "admin" ? {} : { seller: targetId };
  const withStatus = {
    ...base,
    ...normalizeSellerStatusFilter(statusParam),
  };
  // Admin: unapproved UPI orders only show on the Pending UPI Approvals page.
  if (role === "admin" && !isUpiPendingFilter(statusParam)) {
    withStatus.$nor = [{ ...UNAPPROVED_UPI_ORDER }];
  }
  return appendDateRange(withStatus, { startDate, endDate });
}

export async function fetchSellerOrdersPage({
  role,
  userId,
  statusParam,
  startDate,
  endDate,
  sort,
  skip,
  limit,
}) {
  const query = buildSellerOrdersQuery({
    role,
    userId,
    statusParam,
    startDate,
    endDate,
  });

  const targetId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  const baseScope = role === "admin" ? {} : { seller: targetId };
  // Admin totals count approved orders only; unapproved UPI orders are reported as `upiPending`.
  const summaryQuery = appendDateRange(
    role === "admin" ? { ...baseScope, $nor: [{ ...UNAPPROVED_UPI_ORDER }] } : { ...baseScope },
    { startDate, endDate },
  );

  const sortMap = {
    newest: { createdAt: -1, _id: -1 },
    oldest: { createdAt: 1, _id: 1 },
    "amount-desc": { "pricing.total": -1, createdAt: -1 },
    "amount-asc": { "pricing.total": 1, createdAt: -1 },
  };
  const sortQuery = sortMap[String(sort || "newest").toLowerCase()] || sortMap.newest;

  const [orders, total, upiPending, summaryRows] = await Promise.all([
    Order.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .populate("customer", "name phone")
      .populate("items.product", "name mainImage price salePrice weight length breadth height")
      .populate("deliveryBoy", "name phone profileImage image location vehicleType")
      .populate("seller", "shopName name location address")
      .lean(),
    Order.countDocuments(query),
    role === "admin"
      ? Order.countDocuments(appendDateRange({ ...baseScope, ...UNAPPROVED_UPI_ORDER }, { startDate, endDate }))
      : Promise.resolve(0),
    Order.aggregate([
      { $match: summaryQuery },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: {
            $sum: {
              $cond: [
                { $eq: ["$status", "delivered"] },
                { $ifNull: ["$pricing.total", 0] },
                0,
              ],
            },
          },
          totalOrderValue: {
            $sum: {
              $cond: [
                { $ne: ["$status", "cancelled"] },
                { $ifNull: ["$pricing.total", 0] },
                0,
              ],
            },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          upiPending: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$paymentMode", "UPI_QR"] },
                    { $in: ["$paymentStatus", ["AWAITING_VERIFICATION", "CREATED"]] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          confirmed: {
            $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
          },
          packed: {
            $sum: { $cond: [{ $eq: ["$status", "packed"] }, 1, 0] },
          },
          outForDelivery: {
            $sum: { $cond: [{ $eq: ["$status", "out_for_delivery"] }, 1, 0] },
          },
          delivered: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "delivered"] },
                    {
                      $or: [
                        { $eq: ["$returnStatus", null] },
                        { $eq: ["$returnStatus", ""] },
                        { $eq: ["$returnStatus", "none"] },
                        { $eq: ["$returnStatus", "return_rejected"] },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
          returned: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$status", "returned"] },
                    {
                      $and: [
                        { $ne: ["$returnStatus", null] },
                        { $ne: ["$returnStatus", ""] },
                        { $ne: ["$returnStatus", "none"] },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const rawSummary = summaryRows?.[0] || {};
  const summary = {
    totalOrders: Number(rawSummary.totalOrders || 0),
    totalAmount: Number(rawSummary.totalAmount || 0),
    totalOrderValue: Number(rawSummary.totalOrderValue || 0),
    pending: Number(rawSummary.pending || 0),
    confirmed: Number(rawSummary.confirmed || 0),
    packed: Number(rawSummary.packed || 0),
    outForDelivery: Number(rawSummary.outForDelivery || 0),
    delivered: Number(rawSummary.delivered || 0),
    cancelled: Number(rawSummary.cancelled || 0),
    returned: Number(rawSummary.returned || 0),
    upiPending: Number(upiPending || 0),
  };
  summary.activeOrders =
    summary.pending +
    summary.confirmed +
    summary.packed +
    summary.outForDelivery;

  attachParcelIssues(orders);

  return {
    query,
    orders,
    total,
    summary,
  };
}

function parseAvailableOrdersLimit(requestedLimit) {
  const maxLimit = 50;
  const parsed = parseInt(requestedLimit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, maxLimit);
}

async function resolveNearbySellerIds(deliveryPartner, userId) {
  const nearbySellers = await Seller.find({
    location: {
      $near: {
        $geometry: deliveryPartner.location,
        $maxDistance: 30000,
      },
    },
  }).select("_id");

  const sellerIds = nearbySellers.map((seller) => seller._id);

  return {
    sellerIds,
    usedFallback: false,
  };
}

function filterV2OrdersByRadius(v2Orders, deliveryCoords) {
  const [dlng, dlat] = deliveryCoords;
  return v2Orders.filter((order) => {
    const coords = order.seller?.location?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return true;

    const [slng, slat] = coords;
    const searchR = order.deliverySearchMeta?.radiusMeters || 10000;
    const serviceKm = Number(order.seller?.serviceRadius ?? (order.riderRadiusKm ?? 10));
    const serviceM = Math.max(serviceKm, 0) * 1000;
    const maxR = Math.min(searchR, serviceM, 30000);
    return distanceMeters(dlat, dlng, slat, slng) <= maxR;
  });
}

function mergeAvailableOrders(v2Orders, legacyOrders, returnPickups, limit) {
  const seen = new Set();
  const merged = [];

  for (const order of [...v2Orders, ...legacyOrders, ...returnPickups]) {
    if (seen.has(order.orderId)) continue;
    seen.add(order.orderId);
    merged.push(order);
    if (merged.length >= limit) break;
  }

  return merged;
}

export async function fetchAvailableOrdersForDelivery({
  userId,
  requestedLimit,
  type = "delivery",
}) {
  const limit = parseAvailableOrdersLimit(requestedLimit);
  const showDeliveries = type === "delivery" || type === "all";
  const showReturns = type === "return" || type === "all";

  let assignedReturnPickups = [];
  if (showReturns) {
    const assignedReturnPickupsRaw = await Order.find({
      returnStatus: {
        $in: [
          "return_pickup_assigned",
          "return_in_transit",
          "return_drop_pending",
        ],
      },
      returnDeliveryBoy: userId,
      skippedBy: { $nin: [userId] },
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate("customer", "name phone")
      .populate("seller", "shopName address name location")
      .lean();

    assignedReturnPickups = assignedReturnPickupsRaw.map((rp) => ({
      ...rp,
      isReturnPickup: true,
    }));
  }

  const deliveryPartner = await Delivery.findById(userId);
  const hasLocation = deliveryPartner && deliveryPartner.location && Array.isArray(deliveryPartner.location.coordinates);

  if (!hasLocation) {
    return {
      orders: assignedReturnPickups,
      requiresLocation: true,
    };
  }

  let sellerIds = [];
  let usedFallback = false;

  const result = await resolveNearbySellerIds(deliveryPartner, userId);
  sellerIds = result.sellerIds;
  usedFallback = result.usedFallback;

  let v2Orders = [];
  if (showDeliveries) {
    const v2OrdersRaw = await Order.find({
      workflowVersion: { $gte: 2 },
      workflowStatus: WORKFLOW_STATUS.DELIVERY_SEARCH,
      fulfillmentType: { $ne: "SHIPROCKET" },
      deliveryBoy: null,
      seller: { $in: sellerIds },
      skippedBy: { $nin: [userId] },
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate("customer", "name phone")
      .populate("seller", "shopName address name location serviceRadius")
      .lean();

    v2Orders = filterV2OrdersByRadius(
      v2OrdersRaw,
      deliveryPartner.location.coordinates,
    );
  }

  let legacyOrders = [];
  if (showDeliveries) {
    legacyOrders = await Order.find({
      $or: [
        { workflowVersion: { $exists: false } },
        { workflowVersion: { $lt: 2 } },
      ],
      status: { $in: ["confirmed", "packed"] },
      fulfillmentType: { $ne: "SHIPROCKET" },
      deliveryBoy: null,
      seller: { $in: sellerIds },
      skippedBy: { $nin: [userId] },
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate("customer", "name phone")
      .populate("seller", "shopName address name location")
      .lean();
  }

  let returnPickups = [];
  if (showReturns) {
    const now = new Date();
    const returnPickupsRaw = await Order.find({
      skippedBy: { $nin: [userId] },
      $or: [
        // Manual reassign queue — seller picked "no specific rider" but
        // the broadcast loop hasn't been kicked off yet (or it expired
        // out). These stay visible until a seller re-assigns.
        {
          returnStatus: "return_approved",
          returnDeliveryBoy: null,
          seller: { $in: sellerIds },
        },
        // Active broadcast — only show while the assignment window is
        // still open. Legacy rows without a stored expiry stay visible
        // for backwards compatibility.
        {
          returnStatus: "return_pickup_assigned",
          returnDeliveryBoy: null,
          seller: { $in: sellerIds },
          $or: [
            { returnSearchExpiresAt: { $exists: false } },
            { returnSearchExpiresAt: null },
            { returnSearchExpiresAt: { $gt: now } },
          ],
        },
        // Mine to handle right now — only active in-progress return statuses,
        // never completed/returned/refunded returns.
        {
          returnDeliveryBoy: userId,
          returnStatus: {
            $in: [
              "return_pickup_assigned",
              "return_in_transit",
              "return_drop_pending",
            ],
          },
        },
      ],
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate("customer", "name phone")
      .populate("seller", "shopName address name location")
      .lean();

    returnPickups = returnPickupsRaw.map((rp) => ({
      ...rp,
      isReturnPickup: true,
    }));
  }

  const orders = mergeAvailableOrders(
    v2Orders,
    legacyOrders,
    [...assignedReturnPickups, ...returnPickups],
    limit,
  );

  return {
    requiresLocation: false,
    orders,
    limit,
  };
}

/**
 * Customer-facing paginated order list (cached).
 * Replaces inline logic from orderController.getMyOrders.
 */
export async function getCustomerOrders(customerId, pagination) {
  const { page, limit, skip } = pagination;
  const cacheKey = buildKey(
    "orders",
    "customer",
    `${customerId}:p${page}:l${limit}`,
  );

  return getOrSet(
    cacheKey,
    async () => {
      const [orders, total] = await Promise.all([
        Order.find({ customer: customerId })
          .select(
            "orderId checkoutGroupId customer seller items address payment pricing status workflowStatus workflowVersion pickupReadyAt returnStatus timeSlot createdAt paymentMode paymentStatus fulfillmentType shiprocket expiresAt stockReservation cancelReason",
          )
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          // headerId: lets the My Orders page group orders by header category (Grocery, Mobile, ...)
          .populate("items.product", "name mainImage headerId price salePrice conditionType catalogType refurbishedDetails isReturnable returnWindowDays returnPolicyNote")
          .lean(),
        Order.countDocuments({ customer: customerId }),
      ]);

      return {
        // Same customer-safe shipment view as the detail API (the list needs the
        // courier stage to show "Shipped" etc., but never labels/penalties).
        items: orders.map((o) => sanitizeOrderForCustomer(o)),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      };
    },
    getTTL("orders"),
  );
}

/**
 * Fetches an order with role-based access control. Returns a "virtual" group
 * summary if the ID is a checkout group identifier and no concrete order
 * exists.
 *
 * Throws: 403 (access denied), 404 (not found), 500 (data integrity).
 */
export async function getOrderWithAccess(orderId, userId, role) {
  const orderKey = orderMatchQueryFlexible(orderId);
  if (!orderKey) {
    throw svcErr("Order not found", 404);
  }

  let order = await Order.findOne(orderKey)
    .populate("customer", "name email phone")
    .populate("items.product", "name mainImage price salePrice weight length breadth height conditionType catalogType refurbishedDetails isReturnable returnWindowDays returnPolicyNote")
    .populate("deliveryBoy", "name phone")
    .populate("returnDeliveryBoy", "name phone")
    .populate("seller", "shopName name address phone location")
    .lean();
  if (order && (role === "admin" || role === "seller")) attachParcelIssues([order]);

  if (!order) {
    if (orderId && orderId.startsWith("CHK-")) {
      const group = await CheckoutGroup.findOne({
        checkoutGroupId: orderId,
      }).lean();
      if (group) {
        return {
          isGroupSummary: true,
          payload: {
            orderId: group.checkoutGroupId,
            status: group.status?.toLowerCase() || "pending",
            orderStatus: group.status?.toLowerCase() || "pending",
            paymentStatus:
              group.paymentStatus === "CAPTURED"
                ? "PAID"
                : group.paymentStatus || "CREATED",
            workflowStatus: group.status || "CREATED",
            pricing: {
              subtotal: group.pricingSummary?.subtotal || 0,
              deliveryFee: group.pricingSummary?.deliveryFee || 0,
              platformFee: group.pricingSummary?.platformFee || 0,
              total: group.pricingSummary?.totalAmount || 0,
            },
            address: group.addressSnapshot || {},
            items: [],
            createdAt: group.createdAt,
            isGroupSummary: true,
            isFragmented: true,
          },
        };
      }
    }
    throw svcErr("Order not found", 404);
  }

  // Defensive: customer reference integrity check (BUGFIX preserved)
  if (!order.customer) {
    logger.error("Order has null/undefined customer field", {
      scope: "ORDER_BUG",
      orderId: order.orderId,
      _id: order._id,
      workflowStatus: order.workflowStatus,
    });

    const rawOrder = await Order.findOne(orderKey).lean();
    if (rawOrder && rawOrder.customer) {
      logger.error("Customer reference exists but failed to populate", {
        scope: "ORDER_BUG",
        orderId: order.orderId,
        customerRef: rawOrder.customer,
      });
      order.customer = rawOrder.customer;
    } else {
      logger.error("Customer field is null in database", {
        scope: "ORDER_BUG",
        orderId: order.orderId,
      });
      throw svcErr(
        "Order data integrity error: customer reference is missing",
        500,
      );
    }
  }

  if (!order.workflowStatus) {
    order.workflowStatus = resolveWorkflowStatus(order);
  }

  const uid = userId != null ? String(userId).trim() : "";
  const roleNorm = String(role || "").toLowerCase();
  const sellerIdStr =
    typeof order.seller === "object" && order.seller?._id
      ? order.seller._id.toString()
      : order.seller?.toString();

  const customerIdStr = refToIdString(order.customer);

  const isOwnerCustomer =
    (roleNorm === "customer" || roleNorm === "user") &&
    order.customer &&
    customerIdStr === uid;
  const isOwnerSeller = role === "seller" && sellerIdStr === uid;
  const primaryRiderId = refToIdString(order.deliveryBoy);
  const returnRiderId = refToIdString(order.returnDeliveryBoy);
  const isAssignedDeliveryBoy =
    role === "delivery" &&
    (primaryRiderId === uid || returnRiderId === uid);

  const isBroadcastedOrder =
    role === "delivery" &&
    ((!order.deliveryBoy &&
      order.workflowStatus === WORKFLOW_STATUS.DELIVERY_SEARCH) ||
      (!order.returnDeliveryBoy &&
        ["return_approved", "return_pickup_assigned"].includes(
          order.returnStatus,
        )));

  const isAdmin = role === "admin";

  if (
    !isOwnerCustomer &&
    !isOwnerSeller &&
    !isAssignedDeliveryBoy &&
    !isBroadcastedOrder &&
    !isAdmin
  ) {
    logger.warn("Authorization denied for order", {
      scope: "ORDER_ACCESS",
      orderId: order.orderId,
      requestedBy: uid,
      role: roleNorm,
      customerIdStr,
      hasCustomer: !!order.customer,
    });
    throw svcErr(
      "Access denied. You are not authorized to view this order.",
      403,
    );
  }

  if (isOwnerCustomer) {
    const now = new Date();
    
    // Check if order is out for delivery or packed/ready for pickup
    const isDeliveryOtpEligible = [
      WORKFLOW_STATUS.PICKUP_READY,
      WORKFLOW_STATUS.OUT_FOR_DELIVERY,
      "OUT_FOR_DELIVERY",
      "PICKUP_READY",
      "out_for_delivery",
      "packed"
    ].includes(order.workflowStatus) || [
      "out_for_delivery",
      "packed"
    ].includes(String(order.status || "").toLowerCase());

    if (isDeliveryOtpEligible) {
      const canonicalId = order.orderId;
      const mongoId = order._id;
      const deliveryOtp = await OrderOtp.findOne({ 
        $or: [
          ...(canonicalId ? [{ orderId: canonicalId }] : []),
          ...(mongoId ? [{ orderMongoId: mongoId }] : []),
          ...(orderId ? [{ orderId }] : [])
        ],
        type: 'delivery', 
        consumedAt: null, 
        expiresAt: { $gt: now } 
      }).sort({ lastGeneratedAt: -1 }).lean();
      
      if (deliveryOtp) {
        order.deliveryOtp = { 
          code: deliveryOtp.code, 
          otp: deliveryOtp.code,
          expiresAt: deliveryOtp.expiresAt 
        };
        order.handoffOtp = order.deliveryOtp;
      }
    }
    
    if (order.returnStatus === "return_pickup_assigned") {
      const canonicalId = order.orderId;
      const mongoId = order._id;
      const returnOtp = await OrderOtp.findOne({ 
        $or: [
          ...(canonicalId ? [{ orderId: canonicalId }] : []),
          ...(mongoId ? [{ orderMongoId: mongoId }] : []),
          ...(orderId ? [{ orderId }] : [])
        ],
        type: 'return_pickup', 
        consumedAt: null, 
        expiresAt: { $gt: now } 
      }).sort({ lastGeneratedAt: -1 }).lean();
      
      if (returnOtp) {
        order.returnPickupOtp = {
          code: returnOtp.code,
          otp: returnOtp.code,
          expiresAt: returnOtp.expiresAt
        };
      }
    }

    // Customers only get customer-safe shipment data (no label/manifest URLs,
    // weight penalties, internal logs or seller pickup address for courier orders).
    sanitizeOrderForCustomer(order);
  }

  return {
    isGroupSummary: false,
    payload: order,
  };
}

/**
 * Returns paginated seller/admin view of orders with active return status.
 */
/** Return statuses where someone still has something to do (request, pickup, QC, refund retry). */
export const ACTIVE_RETURN_STATUSES = [
  "return_requested",
  "return_approved",
  "return_pickup_assigned",
  "return_in_transit",
  "return_drop_pending",
  "returned",
  "qc_passed",
];
/** Closed for good: refund paid or request rejected. A failed QC joins them once its dispute is settled. */
export const DONE_RETURN_STATUSES = ["refund_completed", "return_rejected"];

/**
 * Mongo filter for the admin Returns pages.
 *   active    = ACTIVE_RETURN_STATUSES, plus a failed QC that is still open (customer may dispute within the
 *               window / a dispute is open / the seller payout has not been released yet).
 *   completed = DONE_RETURN_STATUSES, plus a failed QC that is settled (payout released, or admin ruled).
 */
export function returnGroupQuery(group) {
  const g = String(group || "").toLowerCase();
  const failedQcSettled = {
    returnStatus: "qc_failed",
    $or: [
      { returnQcPayoutReleasedAt: { $ne: null, $exists: true } },
      { "returnDispute.status": { $in: ["upheld", "overturned"] } },
    ],
  };
  if (g === "active") {
    return {
      $or: [
        { returnStatus: { $in: ACTIVE_RETURN_STATUSES } },
        {
          returnStatus: "qc_failed",
          returnQcPayoutReleasedAt: { $in: [null] },
          "returnDispute.status": { $nin: ["upheld", "overturned"] },
        },
      ],
    };
  }
  if (g === "completed") {
    return { $or: [{ returnStatus: { $in: DONE_RETURN_STATUSES } }, failedQcSettled] };
  }
  return null;
}

export async function getSellerReturns({
  role,
  userId,
  filters = {},
  pagination,
}) {
  const { status, startDate, endDate, group } = filters;
  const { page, limit, skip } = pagination;

  let query = {};
  if (role !== "admin") {
    query.seller = userId;
  }
  query.returnStatus = { $ne: "none" };

  if (status && status !== "all") {
    query.returnStatus = status;
  }

  // Active / Completed Returns pages
  const groupQuery = returnGroupQuery(group);
  if (groupQuery) {
    query = { $and: [query, groupQuery] };
  }

  if (startDate || endDate) {
    query.returnRequestedAt = {};
    if (startDate) {
      query.returnRequestedAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.returnRequestedAt.$lte = end;
    }
  }

  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort({ returnRequestedAt: -1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customer", "name phone")
      .populate("returnDeliveryBoy", "name phone")
      .lean(),
    Order.countDocuments(query),
  ]);

  const now = new Date();
  return {
    // `qc` = server-computed QC deadlines / dispute window so every panel shows the same times.
    items: orders.map((o) => ({
      ...o,
      qc: buildQcView(o, now),
      // the money split for the Returns pages (a seller only gets their own side of it)
      returnMoney: buildReturnMoneyView(o, { role: role === "admin" ? "admin" : "seller" }),
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Small numbers for the admin sidebar badges: what needs the admin's attention right now.
 *   orders  = UPI payments to approve + brand-new orders
 *   returns = return requests to approve + items waiting for QC + open disputes
 */
export async function getAdminNavCounts() {
  const notUnapprovedUpi = { $nor: [{ ...UNAPPROVED_UPI_ORDER }] };
  const [upiPending, newOrders, activeOrders, activeReturns, returnRequests, qcWaiting, openDisputes] = await Promise.all([
    Order.countDocuments({ ...UNAPPROVED_UPI_ORDER }),
    Order.countDocuments({ status: "pending", ...notUnapprovedUpi }),
    Order.countDocuments({ ...normalizeSellerStatusFilter("active"), ...notUnapprovedUpi }),
    Order.countDocuments(returnGroupQuery("active")),
    Order.countDocuments({ returnStatus: "return_requested" }),
    Order.countDocuments({ returnStatus: "returned" }),
    Order.countDocuments({ "returnDispute.status": "open" }),
  ]);
  return {
    upiPending,
    newOrders,
    activeOrders,
    activeReturns,
    returnRequests,
    qcWaiting,
    openDisputes,
    ordersNeedAction: upiPending + newOrders,
    returnsNeedAction: returnRequests + qcWaiting + openDisputes,
  };
}

export default {
  buildSellerOrdersQuery,
  fetchSellerOrdersPage,
  fetchAvailableOrdersForDelivery,
  getCustomerOrders,
  getOrderWithAccess,
  getSellerReturns,
  getAdminNavCounts,
};
