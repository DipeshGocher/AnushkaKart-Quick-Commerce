import Order from "../../models/order.js";
import Customer from "../../models/customer.js";
import Product from "../../models/product.js";
import Seller from "../../models/seller.js";
import Warehouse from "../../models/warehouse.js";
import mongoose from "mongoose";
import axios from "axios";
import crypto from "node:crypto";
import { WORKFLOW_STATUS } from "../../constants/orderWorkflow.js";
import { emitOrderStatusUpdate } from "../orderSocketEmitter.js";
import { applyDeliveredSettlement } from "../orderSettlement.js";
import { compensateOrderCancellation } from "../orderCompensation.js";
import { emitNotificationEvent } from "../../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../../modules/notifications/notification.constants.js";
import { invalidate, buildKey } from "../cacheService.js";

const SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in/v1/external";

let cachedToken = null;
let tokenExpiry = 0;
let cachedCredentialFingerprint = null;

async function invalidateCustomerOrdersCache(customerId) {
  if (!customerId) return;
  try {
    const cid = customerId?._id ? customerId._id.toString() : customerId.toString();
    await invalidate(buildKey("orders", "customer", `${cid}:*`));
  } catch (err) {
    // Non-fatal cache invalidation error
  }
}

/**
 * Returns true if real Shiprocket credentials are provided in the environment.
 */
export function isShiprocketConfigured() {
  return Boolean(
    process.env.SHIPROCKET_EMAIL &&
    process.env.SHIPROCKET_PASSWORD
  );
}

/**
 * Authenticates with Shiprocket or returns cached JWT token.
 */
export async function getShiprocketAuthToken() {
  const now = Date.now();
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  const credentialFingerprint = email && password
    ? crypto.createHash("sha256").update(`${email}:${password}`).digest("hex")
    : "local-simulation";
  if (cachedToken && tokenExpiry > now && cachedCredentialFingerprint === credentialFingerprint) {
    return cachedToken;
  }

  if (!email || !password) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error("Shiprocket API credentials are not configured");
      err.statusCode = 503;
      throw err;
    }
    // Simulated token for local offline development
    cachedToken = `mock_shiprocket_jwt_${Date.now()}`;
    tokenExpiry = now + 9 * 24 * 60 * 60 * 1000;
    cachedCredentialFingerprint = credentialFingerprint;
    return cachedToken;
  }

  try {
    const res = await axios.post(`${SHIPROCKET_BASE_URL}/auth/login`, {
      email,
      password,
    }, { timeout: 15000 });

    if (res.data?.token) {
      cachedToken = res.data.token;
      tokenExpiry = now + 9 * 24 * 60 * 60 * 1000; // valid ~10 days
      cachedCredentialFingerprint = credentialFingerprint;
      return cachedToken;
    }
    throw new Error("Shiprocket auth did not return a token");
  } catch (error) {
    console.error("[Shiprocket Auth Error]:", error.response?.data || error.message);
    throw new Error(`Shiprocket Authentication Failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Automatically creates or updates seller pickup location in Shiprocket.
 * Endpoint: POST /settings/company/addpickup
 */
export async function syncSellerPickupLocationToShiprocket(seller) {
  if (!seller) return null;

  const rawPincode = String(seller.pincode || seller.pickupAddress?.pincode || "").trim();
  if (!/^[1-9][0-9]{5}$/.test(rawPincode)) {
    return { success: false, reason: "INVALID_PINCODE", message: "A valid 6-digit Indian pincode is required." };
  }
  const address = seller.address || seller.pickupAddress?.address;
  const city = seller.city || seller.pickupAddress?.city;
  const state = seller.state || seller.pickupAddress?.state;
  const locality = seller.locality || seller.pickupAddress?.locality || "";
  if (!address || !city || !state) {
    return { success: false, reason: "INCOMPLETE_ADDRESS", message: "Complete address, city, and state are required." };
  }

  const sellerKey = String(seller._id || seller.id || "seller").slice(-8);
  const locationNickname = `Seller_${sellerKey}`;

  if (!isShiprocketConfigured()) {
    seller.shiprocketPickupLocation = locationNickname;
    seller.shiprocketPickupStatus = "mock";
    return {
      success: true,
      mode: "MOCK",
      pickup_location: locationNickname,
      message: "Mock pickup location registered for local development",
    };
  }

  try {
    const token = await getShiprocketAuthToken();
    const payload = {
      pickup_location: locationNickname,
      name: String(seller.name || seller.shopName || "Seller Partner").slice(0, 30),
      email: String(seller.email || process.env.SHIPROCKET_CONTACT_EMAIL || "seller@store.com").trim(),
      phone: String(seller.phone || "").replace(/\D/g, "").slice(-10),
      address: String(address).slice(0, 80),
      address_2: String(locality || "").slice(0, 80),
      city: String(city).slice(0, 30),
      state: String(state).slice(0, 30),
      country: "India",
      pin_code: Number(rawPincode),
    };

    const res = await axios.post(`${SHIPROCKET_BASE_URL}/settings/company/addpickup`, payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });

    seller.shiprocketPickupLocation = locationNickname;
    seller.shiprocketPickupStatus = "verified";
    return {
      success: true,
      mode: "LIVE",
      pickup_location: locationNickname,
      response: res.data,
    };
  } catch (err) {
    console.warn("[Shiprocket] Add pickup location API warning:", err.response?.data || err.message);
    seller.shiprocketPickupLocation = locationNickname;
    seller.shiprocketPickupStatus = "pending";
    return {
      success: false,
      pickup_location: locationNickname,
      error: err.response?.data?.message || err.message,
    };
  }
}

/**
 * Calculates live dynamic courier rate between seller and customer.
 * Endpoint: GET /courier/serviceability/
 */
export async function calculateShiprocketLiveRate({
  pickupPincode,
  deliveryPincode,
  weight = 0.5,
  length = 10,
  breadth = 10,
  height = 10,
  cod = 0,
} = {}) {
  const normPickup = String(pickupPincode || "").trim();
  const normDrop = String(deliveryPincode || "").trim();
  const normWeight = Math.max(0.1, Number(weight || 0.5));
  const normLength = Math.max(5, Number(length || 10));
  const normBreadth = Math.max(5, Number(breadth || 10));
  const normHeight = Math.max(5, Number(height || 10));

  // Volumetric weight calculation: (L x B x H) / 5000
  const volumetricWeight = (normLength * normBreadth * normHeight) / 5000;
  const billableWeight = Math.max(normWeight, volumetricWeight);

  // Dynamic weight-based fallback
  const computeFallbackRate = () => {
    const baseFee = Number(process.env.SHIPROCKET_DELIVERY_CHARGE || 49);
    const extraWeight = Math.max(0, billableWeight - 0.5);
    const extraBlocks = Math.ceil(extraWeight / 0.5);
    const extraFee = extraBlocks * 25;
    return {
      success: true,
      rate: Math.round(baseFee + extraFee),
      courierName: "Standard Courier (Surface)",
      etd: "3-4 business days",
      billableWeightKg: Math.round(billableWeight * 100) / 100,
      mode: "FALLBACK_DYNAMIC_WEIGHT",
    };
  };

  if (!normPickup || !normDrop || !/^[1-9][0-9]{5}$/.test(normDrop)) {
    return computeFallbackRate();
  }

  if (!isShiprocketConfigured()) {
    return computeFallbackRate();
  }

  try {
    const token = await getShiprocketAuthToken();
    const res = await axios.get(`${SHIPROCKET_BASE_URL}/courier/serviceability/`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        pickup_postcode: normPickup,
        delivery_postcode: normDrop,
        weight: Math.round(billableWeight * 1000) / 1000,
        cod: cod ? 1 : 0,
        length: normLength,
        breadth: normBreadth,
        height: normHeight,
      },
      timeout: 12000,
    });

    const courierList = res.data?.data?.available_courier_companies;
    if (Array.isArray(courierList) && courierList.length > 0) {
      // Pick cheapest reliable courier
      const sorted = [...courierList].sort((a, b) => Number(a.rate || 9999) - Number(b.rate || 9999));
      const best = sorted[0];
      return {
        success: true,
        rate: Math.ceil(Number(best.rate)),
        courierName: best.courier_name || "Shiprocket Express",
        etd: best.etd ? `${best.etd} days` : (best.estimated_delivery_days ? `${best.estimated_delivery_days} days` : "3-4 days"),
        courierCompanyId: best.courier_company_id,
        billableWeightKg: Math.round(billableWeight * 100) / 100,
        mode: "LIVE_SHIPROCKET",
      };
    }

    return computeFallbackRate();
  } catch (error) {
    console.warn("[Shiprocket Serviceability Rate API Warning]:", error.response?.data || error.message);
    return computeFallbackRate();
  }
}

/**
 * Creates an adhoc order in Shiprocket and assigns AWB.
 * @param {string|object} orderParam Order document or Order ID
 */
export async function processShiprocketOrder(orderParam) {
  let order = typeof orderParam === "object" ? orderParam : await Order.findOne({ orderId: orderParam });
  if (!order && typeof orderParam === "string") {
    order = await Order.findById(orderParam);
  }
  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  if (order.fulfillmentType !== "SHIPROCKET") {
    const err = new Error("This order is assigned to local delivery, not Shiprocket");
    err.statusCode = 400;
    throw err;
  }
  if (order.status === "cancelled" || (order.paymentMode === "ONLINE" && order.paymentStatus !== "PAID")) {
    const err = new Error("Courier shipment requires an active order with completed online payment");
    err.statusCode = 409;
    throw err;
  }
  if (order.workflowVersion >= 2 &&
      [WORKFLOW_STATUS.CREATED, WORKFLOW_STATUS.SELLER_PENDING].includes(order.workflowStatus)) {
    const err = new Error("Wait for seller or warehouse acceptance before booking a courier");
    err.statusCode = 409;
    throw err;
  }
  if (order.shiprocket?.shipmentId) {
    return { success: true, mode: "EXISTING", message: "Shiprocket shipment already exists", shipment: order.shiprocket };
  }
  if (!order.address?.pincode || !order.address?.phone || !order.address?.address || !order.address?.city || !order.address?.state) {
    const err = new Error("A complete delivery address and phone are required before creating a courier shipment");
    err.statusCode = 400;
    throw err;
  }

  // Check if real credentials exist
  if (!isShiprocketConfigured()) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error("Shiprocket API credentials are not configured; courier booking is unavailable");
      err.statusCode = 503;
      throw err;
    }
    // Generate realistic simulated shipment for local environment
    const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
    const mockAwb = `SR${randomSuffix}IN`;
    const mockShipmentId = `SHP_${Date.now()}`;
    const mockCouriers = ["Delhivery Surface", "Blue Dart Express", "DTDC Standard", "Shadowfax Courier"];
    const chosenCourier = mockCouriers[Math.floor(Math.random() * mockCouriers.length)];

    order.shiprocket = {
      shipmentId: mockShipmentId,
      shiprocketOrderId: `SRO_${Date.now()}`,
      awb: mockAwb,
      courierName: chosenCourier,
      courierId: "1",
      labelUrl: `https://shiprocket.co/tracking/${mockAwb}`,
      currentStatus: "AWB_ASSIGNED",
      currentStatusCode: 1,
      etd: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      trackingUrl: `https://shiprocket.co/tracking/${mockAwb}`,
      lastEventAt: new Date(),
      history: [
        {
          status: "AWB_ASSIGNED",
          location: order.address?.city || "Indore Hub",
          timestamp: new Date(),
          remarks: `Simulated local mode: AWB ${mockAwb} generated via ${chosenCourier}.`,
          source: "system",
        },
      ],
    };

    order.status = "confirmed";
    order.orderStatus = "confirmed";
    if (order.workflowVersion >= 2) {
      order.workflowStatus = WORKFLOW_STATUS.SELLER_ACCEPTED;
    }
    await order.save();

    emitOrderStatusUpdate(
      order.orderId,
      {
        workflowStatus: order.workflowStatus,
        status: order.status,
        shiprocket: order.shiprocket,
      },
      order.customer?._id || order.customer,
    );

    await invalidateCustomerOrdersCache(order.customer);

    return {
      success: true,
      mode: "SIMULATED",
      message: "Shiprocket shipment created and AWB generated (Local Dev Mode)",
      shipment: order.shiprocket,
    };
  }

  // LIVE SHIPROCKET FLOW
  const token = await getShiprocketAuthToken();
  const orderDate = new Date(order.createdAt || Date.now()).toISOString().replace("T", " ").slice(0, 16);
  const customer = order.customer?.email
    ? order.customer
    : await Customer.findById(order.customer?._id || order.customer).select("email").lean();
  const billingEmail = customer?.email || process.env.SHIPROCKET_CONTACT_EMAIL?.trim();
  if (!billingEmail) {
    const err = new Error("Customer email or SHIPROCKET_CONTACT_EMAIL is required for courier booking");
    err.statusCode = 400;
    throw err;
  }
  const billingPhone = String(order.address.phone).replace(/\D/g, "").slice(-10);
  if (!/^\d{10}$/.test(billingPhone)) {
    const err = new Error("A valid 10-digit customer phone is required for courier booking");
    err.statusCode = 400;
    throw err;
  }

  let pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || "Primary";
  if (order.seller) {
    try {
      const sellerDoc = await Seller.findById(order.seller).select("shiprocketPickupLocation pincode address city state").lean();
      if (sellerDoc?.shiprocketPickupLocation) {
        pickupLocation = sellerDoc.shiprocketPickupLocation;
      }
    } catch (err) {
      console.warn("[Shiprocket] Error fetching seller for pickup location:", err.message);
    }
  }

  const productIds = (order.items || []).map((item) => item.product).filter(Boolean);
  const productDocs = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).select("_id weight sku length breadth height").lean()
    : [];
  const productsById = new Map(productDocs.map((product) => [String(product._id), product]));
  const defaultItemWeightKg = Number(process.env.SHIPROCKET_DEFAULT_ITEM_WEIGHT_KG || 0.5);
  const itemWeightKg = (product) => {
    const raw = String(product?.weight || "").trim().toLowerCase();
    const match = raw.match(/^(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|grams?)$/);
    if (!match) return defaultItemWeightKg;
    return match[2].startsWith("k") ? Number(match[1]) : Number(match[1]) / 1000;
  };

  let maxLength = 10;
  let maxBreadth = 10;
  let totalHeight = 0;
  for (const it of (order.items || [])) {
    const p = productsById.get(String(it.product));
    const qty = Number(it.quantity || 1);
    const pL = Number(p?.length || 10);
    const pB = Number(p?.breadth || 10);
    const pH = Number(p?.height || 10);
    if (pL > maxLength) maxLength = pL;
    if (pB > maxBreadth) maxBreadth = pB;
    totalHeight += pH * qty;
  }
  const finalLength = Math.max(5, Math.min(100, Math.round(maxLength)));
  const finalBreadth = Math.max(5, Math.min(100, Math.round(maxBreadth)));
  const finalHeight = Math.max(5, Math.min(100, Math.round(totalHeight || 10)));

  const totalWeightKg = Math.max(0.5, (order.items || []).reduce((total, item) =>
    total + itemWeightKg(productsById.get(String(item.product))) * Number(item.quantity || 1), 0));
  const itemSubtotal = (order.items || []).reduce((total, item) =>
    total + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const subtotal = Number(order.paymentBreakdown?.productSubtotal ?? order.pricing?.subtotal ?? itemSubtotal);
  const deliveryFee = Number(order.paymentBreakdown?.deliveryFeeCharged || 0);
  const additionalCharges = Number(order.paymentBreakdown?.handlingFeeCharged || 0)
    + Number(order.paymentBreakdown?.taxTotal || 0);
  const totalDiscount = Number(order.paymentBreakdown?.discountTotal || 0)
    + Number(order.paymentBreakdown?.walletAmount || 0);
  if (!Number.isFinite(subtotal) || subtotal <= 0 || !Number.isFinite(totalWeightKg)) {
    const err = new Error("Valid product prices and package weight are required for courier booking");
    err.statusCode = 400;
    throw err;
  }

  const orderItems = (order.items || []).map((it, idx) => ({
    name: it.name || `Product Item #${idx + 1}`,
    sku: String(productsById.get(String(it.product))?.sku || it.product || it._id || `SKU-${idx}`),
    units: Number(it.quantity || 1),
    selling_price: Number(it.price || 1),
    discount: 0,
    tax: 0,
  }));

  const payload = {
    order_id: order.orderId,
    order_date: orderDate,
    pickup_location: pickupLocation,
    billing_customer_name: order.address?.name || "Customer",
    billing_last_name: "",
    billing_address: order.address.address,
    billing_city: order.address.city,
    billing_pincode: order.address.pincode,
    billing_state: order.address.state,
    billing_country: "India",
    billing_email: billingEmail,
    billing_phone: billingPhone,
    shipping_is_billing: true,
    order_items: orderItems,
    payment_method: order.paymentMode === "COD" ? "COD" : "Prepaid",
    sub_total: subtotal,
    shipping_charges: deliveryFee,
    transaction_charges: additionalCharges,
    total_discount: totalDiscount,
    length: finalLength,
    breadth: finalBreadth,
    height: finalHeight,
    weight: Math.round(totalWeightKg * 1000) / 1000,
  };

  try {
    const createRes = await axios.post(`${SHIPROCKET_BASE_URL}/orders/create/adhoc`, payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000,
    });

    const srData = createRes.data;
    const shipmentId = srData.shipment_id;
    const shiprocketOrderId = srData.order_id;

    // Try to auto-generate AWB
    let awbCode = null;
    let courierName = null;
    try {
      const awbRes = await axios.post(
        `${SHIPROCKET_BASE_URL}/courier/assign/awb`,
        { shipment_id: shipmentId },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
      );
      if (awbRes.data?.response?.data?.awb_code) {
        awbCode = awbRes.data.response.data.awb_code;
        courierName = awbRes.data.response.data.courier_name;
      }
    } catch (awbErr) {
      console.warn("[Shiprocket] AWB auto-assignment deferred:", awbErr.response?.data || awbErr.message);
    }

    order.shiprocket = {
      shipmentId: String(shipmentId),
      shiprocketOrderId: String(shiprocketOrderId),
      awb: awbCode,
      courierName: courierName || "Shiprocket Courier Partner",
      currentStatus: awbCode ? "AWB_ASSIGNED" : "NEW",
      currentStatusCode: srData.status_code || 1,
      trackingUrl: awbCode ? `https://shiprocket.co/tracking/${awbCode}` : null,
      lastEventAt: new Date(),
      history: [
        {
          status: awbCode ? "AWB_ASSIGNED" : "ORDER_CREATED",
          location: order.address?.city || "",
          timestamp: new Date(),
          remarks: `Shiprocket order #${shiprocketOrderId} created. ${awbCode ? `AWB: ${awbCode}` : "Awaiting AWB"}`,
          source: "api",
        },
      ],
    };

    order.status = "confirmed";
    order.orderStatus = "confirmed";
    if (order.workflowVersion >= 2) {
      order.workflowStatus = WORKFLOW_STATUS.SELLER_ACCEPTED;
    }
    await order.save();

    emitOrderStatusUpdate(
      order.orderId,
      {
        workflowStatus: order.workflowStatus,
        status: order.status,
        shiprocket: order.shiprocket,
      },
      order.customer?._id || order.customer,
    );

    await invalidateCustomerOrdersCache(order.customer);

    return {
      success: true,
      mode: "LIVE",
      shipment: order.shiprocket,
    };
  } catch (error) {
    console.error("[Shiprocket Create Order Failed]:", error.response?.data || error.message);
    const msg = error.response?.data?.message || error.message;
    throw new Error(`Shiprocket Error: ${typeof msg === "object" ? JSON.stringify(msg) : msg}`);
  }
}

/**
 * Super Admin: Request Courier Pickup via Shiprocket
 */
export async function requestShiprocketPickup(orderParam) {
  let order = typeof orderParam === "object" ? orderParam : await Order.findOne({ orderId: orderParam });
  if (!order && typeof orderParam === "string") {
    order = await Order.findById(orderParam);
  }
  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  const shipmentId = order.shiprocket?.shipmentId;
  if (!shipmentId) {
    const err = new Error("Shipment has not been generated for this order yet");
    err.statusCode = 400;
    throw err;
  }

  if (!isShiprocketConfigured()) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error("Shiprocket API credentials are not configured; pickup cannot be booked");
      err.statusCode = 503;
      throw err;
    }
    order.shiprocket.currentStatus = "PICKUP_SCHEDULED";
    order.shiprocket.pickupScheduledAt = new Date();
    order.shiprocket.history.push({
      status: "PICKUP_SCHEDULED",
      location: order.address?.city || "Warehouse",
      timestamp: new Date(),
      remarks: "Courier pickup scheduled (Simulated local mode).",
      source: "manual",
    });
    order.status = "packed";
    order.orderStatus = "packed";
    if (order.workflowVersion >= 2) {
      order.workflowStatus = WORKFLOW_STATUS.PICKUP_READY;
    }
    await order.save();

    emitOrderStatusUpdate(
      order.orderId,
      {
        workflowStatus: order.workflowStatus,
        status: order.status,
        shiprocket: order.shiprocket,
      },
      order.customer?._id || order.customer,
    );

    await invalidateCustomerOrdersCache(order.customer);

    return { success: true, mode: "SIMULATED", message: "Pickup scheduled successfully" };
  }

  const token = await getShiprocketAuthToken();
  const res = await axios.post(
    `${SHIPROCKET_BASE_URL}/courier/generate/pickup`,
    { shipment_id: [shipmentId] },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  order.shiprocket.currentStatus = "PICKUP_SCHEDULED";
  order.shiprocket.pickupScheduledAt = new Date();
  order.shiprocket.history.push({
    status: "PICKUP_SCHEDULED",
    location: order.address?.city || "",
    timestamp: new Date(),
    remarks: "Courier pickup requested on Shiprocket.",
    source: "api",
  });
  order.status = "packed";
  order.orderStatus = "packed";
  if (order.workflowVersion >= 2) {
    order.workflowStatus = WORKFLOW_STATUS.PICKUP_READY;
  }
  await order.save();

  emitOrderStatusUpdate(
    order.orderId,
    {
      workflowStatus: order.workflowStatus,
      status: order.status,
      shiprocket: order.shiprocket,
    },
    order.customer?._id || order.customer,
  );

  await invalidateCustomerOrdersCache(order.customer);

  return { success: true, mode: "LIVE", data: res.data };
}

/**
 * Super Admin: Get printable shipping label URL
 */
export async function getShiprocketLabel(orderParam) {
  let order = typeof orderParam === "object" ? orderParam : await Order.findOne({ orderId: orderParam });
  if (!order && typeof orderParam === "string") {
    order = await Order.findById(orderParam);
  }
  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  const shipmentId = order.shiprocket?.shipmentId;
  if (!shipmentId) {
    const err = new Error("No shipment exists for this order");
    err.statusCode = 400;
    throw err;
  }

  if (!isShiprocketConfigured()) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error("Shiprocket API credentials are not configured; label cannot be generated");
      err.statusCode = 503;
      throw err;
    }
    return {
      success: true,
      labelUrl: order.shiprocket?.labelUrl || `https://shiprocket.co/tracking/${order.shiprocket?.awb}`,
    };
  }

  const token = await getShiprocketAuthToken();
  const res = await axios.post(
    `${SHIPROCKET_BASE_URL}/courier/generate/label`,
    { shipment_id: [shipmentId] },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const labelUrl = res.data?.label_url;
  if (labelUrl) {
    order.shiprocket.labelUrl = labelUrl;
    await order.save();
  }

  return { success: true, labelUrl };
}

/**
 * Creates a reverse courier pickup via Shiprocket for returned items.
 * Origin = Customer delivery address
 * Destination = Seller / Warehouse shop address
 */
export async function createShiprocketReversePickup(orderParam) {
  let order = typeof orderParam === "object" ? orderParam : await Order.findOne({ orderId: orderParam });
  if (!order && typeof orderParam === "string") {
    order = await Order.findById(orderParam);
  }
  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  if (order.fulfillmentType !== "SHIPROCKET") {
    const err = new Error("Order is not a Shiprocket courier order");
    err.statusCode = 400;
    throw err;
  }

  // Populate seller and warehouse details if needed
  let seller = null;
  if (order.seller) {
    seller = await Seller.findById(order.seller).lean();
  }
  let warehouse = null;
  if (order.warehouseId) {
    warehouse = await Warehouse.findById(order.warehouseId).lean();
  }

  const destinationName = seller?.shopName || warehouse?.name || "AnushkaKart Central Store";
  const destinationPhone = seller?.phone || warehouse?.phone || order.address?.phone || "9999999999";
  const destinationAddress = seller?.address || warehouse?.address || "Jhansi Store Hub";
  const destinationCity = seller?.city || warehouse?.city || "Jhansi";
  const destinationState = seller?.state || warehouse?.state || "Uttar Pradesh";
  const destinationPincode = seller?.pincode || warehouse?.pincode || "284001";

  if (!isShiprocketConfigured()) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error("Shiprocket credentials are not configured for reverse pickup");
      err.statusCode = 503;
      throw err;
    }
    // Simulation mode for local development
    const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
    const mockReverseAwb = `SR_RET_${randomSuffix}IN`;
    const mockReverseShipmentId = `SHP_RET_${Date.now()}`;
    const mockCourier = "Delhivery Surface Reverse";

    if (!order.shiprocket) {
      order.shiprocket = { history: [] };
    }
    order.shiprocket.reverseShipmentId = String(mockReverseShipmentId);
    order.shiprocket.reverseAwb = mockReverseAwb;
    order.shiprocket.reverseCourierName = mockCourier;
    order.shiprocket.reverseStatus = "REVERSE_PICKUP_SCHEDULED";
    order.shiprocket.history.push({
      status: "REVERSE_PICKUP_SCHEDULED",
      location: order.address?.city || "Customer Address",
      timestamp: new Date(),
      remarks: `Shiprocket courier reverse pickup scheduled. Reverse AWB: ${mockReverseAwb}`,
      source: "simulation",
    });

    order.returnStatus = "return_pickup_assigned";
    await order.save();

    emitOrderStatusUpdate(
      order.orderId,
      {
        returnStatus: order.returnStatus,
        shiprocket: order.shiprocket,
      },
      order.customer?._id || order.customer
    );

    return {
      success: true,
      mode: "SIMULATED",
      message: `Reverse courier pickup scheduled. Reverse AWB: ${mockReverseAwb}`,
      reverseAwb: mockReverseAwb,
      reverseShipmentId: mockReverseShipmentId,
      courierName: mockCourier,
    };
  }

  const token = await getShiprocketAuthToken();

  const returnItems = (Array.isArray(order.returnItems) && order.returnItems.length > 0)
    ? order.returnItems
    : order.items;

  const orderItems = returnItems.map((item, idx) => ({
    name: item.name || `Item ${idx + 1}`,
    sku: item.sku || `SKU-${idx + 1}`,
    units: item.quantity || 1,
    selling_price: item.price || 1,
    discount: 0,
    qc_enable: true,
  }));

  const payload = {
    order_id: `${order.orderId}-RET`,
    order_date: new Date().toISOString().slice(0, 10),
    channel_id: "",
    pickup_customer_name: order.address?.name || "Customer",
    pickup_last_name: "",
    pickup_address: order.address?.address || order.address?.fullAddress || "Customer Address",
    pickup_address_2: "",
    pickup_city: order.address?.city || "",
    pickup_state: order.address?.state || "",
    pickup_country: "India",
    pickup_pincode: String(order.address?.pincode || "").trim(),
    pickup_email: order.address?.email || "customer@anushkakart.com",
    pickup_phone: String(order.address?.phone || "").trim(),
    shipping_customer_name: destinationName,
    shipping_address: destinationAddress,
    shipping_city: destinationCity,
    shipping_state: destinationState,
    shipping_country: "India",
    shipping_pincode: String(destinationPincode).trim(),
    shipping_phone: String(destinationPhone).trim(),
    order_items: orderItems,
    payment_method: "Prepaid",
    sub_total: order.returnRefundAmount || 100,
    length: 10,
    breadth: 10,
    height: 10,
    weight: 0.5,
  };

  try {
    const retRes = await axios.post(`${SHIPROCKET_BASE_URL}/orders/create/return`, payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000,
    });

    const retData = retRes.data;
    const reverseShipmentId = retData.shipment_id || retData.order_id;
    const reverseAwb = retData.awb_code || `SR_RET_${Date.now()}`;
    const reverseCourier = retData.courier_name || "Shiprocket Reverse Logistics";

    if (!order.shiprocket) {
      order.shiprocket = { history: [] };
    }
    order.shiprocket.reverseShipmentId = String(reverseShipmentId);
    order.shiprocket.reverseAwb = reverseAwb;
    order.shiprocket.reverseCourierName = reverseCourier;
    order.shiprocket.reverseStatus = "REVERSE_PICKUP_SCHEDULED";
    order.shiprocket.history.push({
      status: "REVERSE_PICKUP_SCHEDULED",
      location: order.address?.city || "",
      timestamp: new Date(),
      remarks: `Shiprocket reverse pickup booked. Reverse AWB: ${reverseAwb}`,
      source: "api",
    });

    order.returnStatus = "return_pickup_assigned";
    await order.save();

    emitOrderStatusUpdate(
      order.orderId,
      {
        returnStatus: order.returnStatus,
        shiprocket: order.shiprocket,
      },
      order.customer?._id || order.customer
    );

    return {
      success: true,
      mode: "LIVE",
      message: `Reverse pickup booked successfully. Reverse AWB: ${reverseAwb}`,
      reverseAwb,
      reverseShipmentId,
      courierName: reverseCourier,
    };
  } catch (err) {
    console.error("[Shiprocket Reverse Pickup Error]:", err.response?.data || err.message);
    throw new Error(`Failed to create Shiprocket reverse pickup: ${err.response?.data?.message || err.message}`);
  }
}

/**
 * Super Admin: Manual Status Update
 * Fulfills requirement: "in shiprocket order give manual status update option as well"
 */
export async function updateShiprocketManualStatus(orderId, { status, remarks = "", location = "" } = {}, adminId = null) {
  const order = await Order.findOne({
    $or: [{ orderId }, { _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }],
  });

  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  const upperStatus = String(status || "").toUpperCase().trim();
  const validStatuses = [
    "NEW",
    "AWB_ASSIGNED",
    "PICKUP_SCHEDULED",
    "PICKUP_QUEUED",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "RTO_INITIATED",
    "RTO_DELIVERED",
  ];

  if (!validStatuses.includes(upperStatus)) {
    const err = new Error(`Invalid status: ${status}. Valid options: ${validStatuses.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  if (!order.shiprocket) {
    order.shiprocket = { history: [] };
  }

  order.shiprocket.currentStatus = upperStatus;
  order.shiprocket.lastEventAt = new Date();

  // Map Shiprocket courier status to core order status
  if (upperStatus === "DELIVERED") {
    order.status = "delivered";
    order.orderStatus = "delivered";
    if (order.workflowVersion >= 2) {
      order.workflowStatus = WORKFLOW_STATUS.DELIVERED;
    }
    order.deliveredAt = new Date();
    order.shiprocket.deliveredAt = new Date();
  } else if (upperStatus === "OUT_FOR_DELIVERY") {
    order.status = "out_for_delivery";
    order.orderStatus = "out_for_delivery";
    if (order.workflowVersion >= 2) {
      order.workflowStatus = WORKFLOW_STATUS.OUT_FOR_DELIVERY;
    }
    order.outForDeliveryAt = new Date();
  } else if (upperStatus === "IN_TRANSIT") {
    order.status = "packed";
    order.orderStatus = "packed";
    if (order.workflowVersion >= 2) {
      order.workflowStatus = WORKFLOW_STATUS.PICKUP_READY;
    }
    if (!order.shiprocket.shippedAt) order.shiprocket.shippedAt = new Date();
  } else if (upperStatus === "PICKUP_SCHEDULED") {
    order.status = "packed";
    order.orderStatus = "packed";
    if (order.workflowVersion >= 2) {
      order.workflowStatus = WORKFLOW_STATUS.PICKUP_READY;
    }
    if (!order.shiprocket.pickupScheduledAt) order.shiprocket.pickupScheduledAt = new Date();
  } else if (upperStatus === "CANCELLED") {
    order.status = "cancelled";
    order.orderStatus = "cancelled";
    if (order.workflowVersion >= 2) {
      order.workflowStatus = WORKFLOW_STATUS.CANCELLED;
    }
  }

  order.shiprocket.history.push({
    status: upperStatus,
    location: location || order.address?.city || "Admin Manual Update",
    timestamp: new Date(),
    remarks: remarks || `Manually marked as ${upperStatus} by Administrator`,
    source: "manual",
  });

  await order.save();

  if (upperStatus === "DELIVERED") {
    try {
      await applyDeliveredSettlement(order, order.orderId);
    } catch (settleErr) {
      console.error("[Shiprocket] applyDeliveredSettlement error:", settleErr.message);
    }
    emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_DELIVERED, {
      orderId: order.orderId,
      customerId: order.customer?._id || order.customer,
      userId: order.customer?._id || order.customer,
      sellerId: order.seller?._id || order.seller,
    });
  } else if (upperStatus === "CANCELLED") {
    try {
      await compensateOrderCancellation(order, order.orderId, {
        reason: remarks || "Shiprocket courier shipment cancelled",
      });
    } catch (cancelErr) {
      console.error("[Shiprocket] compensateOrderCancellation error:", cancelErr.message);
    }
    emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_CANCELLED, {
      orderId: order.orderId,
      customerId: order.customer?._id || order.customer,
      userId: order.customer?._id || order.customer,
      sellerId: order.seller?._id || order.seller,
      customerMessage: "Your order shipment was cancelled.",
      sellerMessage: `Order #${order.orderId} shipment was cancelled.`,
    });
  } else if (upperStatus === "OUT_FOR_DELIVERY") {
    emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_OUT_FOR_DELIVERY, {
      orderId: order.orderId,
      customerId: order.customer?._id || order.customer,
      userId: order.customer?._id || order.customer,
      sellerId: order.seller?._id || order.seller,
    });
  } else if (upperStatus === "IN_TRANSIT" || upperStatus === "PICKUP_SCHEDULED") {
    emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_PACKED, {
      orderId: order.orderId,
      customerId: order.customer?._id || order.customer,
      userId: order.customer?._id || order.customer,
      sellerId: order.seller?._id || order.seller,
    });
  }

  emitOrderStatusUpdate(
    order.orderId,
    {
      workflowStatus: order.workflowStatus,
      status: order.status,
      shiprocket: order.shiprocket,
    },
    order.customer?._id || order.customer,
  );

  await invalidateCustomerOrdersCache(order.customer);

  return {
    success: true,
    message: `Shiprocket status updated to ${upperStatus}`,
    order,
  };
}

/**
 * Webhook Handler: Process Shiprocket status notifications
 */
export async function processShiprocketWebhook(payload = {}, headers = {}) {
  // Shiprocket webhook format:
  // { awb: "123", current_status: "DELIVERED", order_id: "ORD-xxx", current_timestamp: "...", ... }
  const awb = payload.awb || payload.awb_code;
  const orderId = payload.order_id;
  const statusRaw = String(payload.current_status || payload.shipment_status || "").toUpperCase().trim();
  const location = payload.location || payload.destination || "";
  const remarks = payload.status_remarks || payload.scans?.[0]?.activity || `Webhook event: ${statusRaw}`;

  if (!awb && !orderId) {
    return { success: false, message: "Missing AWB or Order ID in webhook payload" };
  }
  if (!statusRaw) {
    return { success: false, message: "Missing shipment status in webhook payload" };
  }

  const matches = [];
  if (orderId) {
    matches.push({ orderId: String(orderId) }, { "shiprocket.shiprocketOrderId": String(orderId) });
  }
  if (awb) matches.push({ "shiprocket.awb": String(awb) });
  const query = { $or: matches };

  const order = await Order.findOne(query);
  if (!order) {
    return { success: false, message: "Order not found for webhook notification" };
  }
  if (order.fulfillmentType !== "SHIPROCKET") {
    return { success: false, message: "Order is not a Shiprocket shipment" };
  }
  if (awb && order.shiprocket?.awb && String(awb) !== String(order.shiprocket.awb)) {
    return { success: false, message: "AWB does not match this order" };
  }
  if (["DELIVERED", "CANCELLED"].includes(statusRaw) && order.shiprocket?.currentStatus === statusRaw) {
    return { success: true, duplicate: true, message: "Shipment status already processed" };
  }

  if (!order.shiprocket) order.shiprocket = { history: [] };

  order.shiprocket.currentStatus = statusRaw;
  order.shiprocket.lastEventAt = new Date();
  if (awb && !order.shiprocket.awb) order.shiprocket.awb = awb;
  if (payload.courier_name && !order.shiprocket.courierName) {
    order.shiprocket.courierName = payload.courier_name;
  }
  if (payload.etd) {
    order.shiprocket.etd = payload.etd;
  }

  const discrepancyAmt = Number(payload.weight_discrepancy_amount || payload.discrepancy_amount || 0);
  if (discrepancyAmt > 0) {
    order.shiprocket.weightDiscrepancyAmount = discrepancyAmt;
    order.shiprocket.weightDiscrepancyReason = payload.discrepancy_reason || "Weight discrepancy reported by courier partner";
    if (payload.charged_weight) order.shiprocket.chargedWeightKg = Number(payload.charged_weight);
    if (payload.entered_weight) order.shiprocket.enteredWeightKg = Number(payload.entered_weight);
    order.shiprocket.history.push({
      status: "WEIGHT_DISCREPANCY",
      location: location || "Courier Hub",
      timestamp: new Date(),
      remarks: `Weight discrepancy of ₹${discrepancyAmt} logged (deducted from seller payout). Reason: ${order.shiprocket.weightDiscrepancyReason}`,
      source: "webhook",
    });
  }

  if (statusRaw === "DELIVERED") {
    order.status = "delivered";
    order.orderStatus = "delivered";
    if (order.workflowVersion >= 2) {
      order.workflowStatus = WORKFLOW_STATUS.DELIVERED;
    }
    order.deliveredAt = new Date();
    order.shiprocket.deliveredAt = new Date();
  } else if (statusRaw.includes("OUT FOR DELIVERY") || statusRaw === "OUT_FOR_DELIVERY") {
    order.status = "out_for_delivery";
    order.orderStatus = "out_for_delivery";
    if (order.workflowVersion >= 2) {
      order.workflowStatus = WORKFLOW_STATUS.OUT_FOR_DELIVERY;
    }
  } else if (statusRaw.includes("IN TRANSIT") || statusRaw === "IN_TRANSIT" || statusRaw.includes("SHIPPED")) {
    order.status = "packed";
    order.orderStatus = "packed";
    if (order.workflowVersion >= 2) {
      order.workflowStatus = WORKFLOW_STATUS.PICKUP_READY;
    }
    if (!order.shiprocket.shippedAt) order.shiprocket.shippedAt = new Date();
  } else if (statusRaw.includes("CANCELLED") || statusRaw === "CANCELLED") {
    order.status = "cancelled";
    order.orderStatus = "cancelled";
    if (order.workflowVersion >= 2) {
      order.workflowStatus = WORKFLOW_STATUS.CANCELLED;
    }
  }

  order.shiprocket.history.push({
    status: statusRaw,
    location,
    timestamp: new Date(),
    remarks,
    source: "webhook",
  });

  await order.save();

  if (statusRaw === "DELIVERED") {
    try {
      await applyDeliveredSettlement(order, order.orderId);
    } catch (settleErr) {
      console.error("[Shiprocket Webhook] applyDeliveredSettlement error:", settleErr.message);
    }
    emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_DELIVERED, {
      orderId: order.orderId,
      customerId: order.customer?._id || order.customer,
      userId: order.customer?._id || order.customer,
      sellerId: order.seller?._id || order.seller,
    });
  } else if (statusRaw.includes("CANCELLED") || statusRaw === "CANCELLED") {
    try {
      await compensateOrderCancellation(order, order.orderId, {
        reason: remarks || "Shiprocket webhook cancelled shipment",
      });
    } catch (cancelErr) {
      console.error("[Shiprocket Webhook] compensateOrderCancellation error:", cancelErr.message);
    }
    emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_CANCELLED, {
      orderId: order.orderId,
      customerId: order.customer?._id || order.customer,
      userId: order.customer?._id || order.customer,
      sellerId: order.seller?._id || order.seller,
      customerMessage: "Your order shipment was cancelled.",
      sellerMessage: `Order #${order.orderId} shipment was cancelled.`,
    });
  } else if (statusRaw.includes("OUT FOR DELIVERY") || statusRaw === "OUT_FOR_DELIVERY") {
    emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_OUT_FOR_DELIVERY, {
      orderId: order.orderId,
      customerId: order.customer?._id || order.customer,
      userId: order.customer?._id || order.customer,
      sellerId: order.seller?._id || order.seller,
    });
  } else if (statusRaw.includes("IN TRANSIT") || statusRaw === "IN_TRANSIT" || statusRaw.includes("SHIPPED")) {
    emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_PACKED, {
      orderId: order.orderId,
      customerId: order.customer?._id || order.customer,
      userId: order.customer?._id || order.customer,
      sellerId: order.seller?._id || order.seller,
    });
  }

  emitOrderStatusUpdate(
    order.orderId,
    {
      workflowStatus: order.workflowStatus,
      status: order.status,
      shiprocket: order.shiprocket,
    },
    order.customer?._id || order.customer,
  );

  await invalidateCustomerOrdersCache(order.customer);

  return {
    success: true,
    message: `Order #${order.orderId} updated via Shiprocket webhook: ${statusRaw}`,
  };
}

/**
 * Super Admin: Manually Record Weight Discrepancy for Shiprocket Order
 * Ensures platform safety: the discrepancy penalty is deducted from the seller's payout.
 */
export async function recordShiprocketWeightDiscrepancy(orderId, { discrepancyAmount, reason = "", chargedWeightKg = 0, enteredWeightKg = 0 } = {}) {
  const query = mongoose.Types.ObjectId.isValid(orderId) ? { _id: orderId } : { orderId };
  const order = await Order.findOne(query);
  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }
  const amt = Number(discrepancyAmount || 0);
  if (amt <= 0) {
    const err = new Error("Valid positive discrepancy penalty amount is required");
    err.statusCode = 400;
    throw err;
  }
  if (!order.shiprocket) order.shiprocket = { history: [] };
  order.shiprocket.weightDiscrepancyAmount = amt;
  order.shiprocket.weightDiscrepancyReason = reason || "Weight discrepancy recorded by Admin";
  if (chargedWeightKg) order.shiprocket.chargedWeightKg = Number(chargedWeightKg);
  if (enteredWeightKg) order.shiprocket.enteredWeightKg = Number(enteredWeightKg);
  order.shiprocket.history.push({
    status: "WEIGHT_DISCREPANCY",
    location: "Admin Portal",
    timestamp: new Date(),
    remarks: `Weight discrepancy of ₹${amt} manually recorded by Admin. Reason: ${order.shiprocket.weightDiscrepancyReason}`,
    source: "manual",
  });
  await order.save();
  return { success: true, message: `Weight discrepancy of ₹${amt} recorded`, order };
}

