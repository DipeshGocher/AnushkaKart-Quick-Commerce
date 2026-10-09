import Order from "../../models/order.js";
import axios from "axios";

const SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in/v1/external";

let cachedToken = null;
let tokenExpiry = 0;

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
  if (cachedToken && tokenExpiry > now) {
    return cachedToken;
  }

  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    // Simulated token for local offline development
    cachedToken = `mock_shiprocket_jwt_${Date.now()}`;
    tokenExpiry = now + 9 * 24 * 60 * 60 * 1000;
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
      return cachedToken;
    }
    throw new Error("Shiprocket auth did not return a token");
  } catch (error) {
    console.error("[Shiprocket Auth Error]:", error.response?.data || error.message);
    throw new Error(`Shiprocket Authentication Failed: ${error.response?.data?.message || error.message}`);
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

  // Ensure fulfillmentType is SHIPROCKET
  order.fulfillmentType = "SHIPROCKET";

  // Check if real credentials exist
  if (!isShiprocketConfigured()) {
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
    await order.save();

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

  const orderItems = (order.items || []).map((it, idx) => ({
    name: it.name || `Product Item #${idx + 1}`,
    sku: String(it.product || it._id || `SKU-${idx}`),
    units: Number(it.quantity || 1),
    selling_price: Number(it.price || 1),
    discount: 0,
    tax: 0,
  }));

  const payload = {
    order_id: order.orderId,
    order_date: orderDate,
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
    billing_customer_name: order.address?.name || "Customer",
    billing_last_name: "",
    billing_address: order.address?.address || "Address",
    billing_city: order.address?.city || "City",
    billing_pincode: order.address?.pincode || "452001",
    billing_state: order.address?.state || "Madhya Pradesh",
    billing_country: "India",
    billing_email: "customer@anushkakart.com",
    billing_phone: String(order.address?.phone || "9999999999").replace(/\D/g, "").slice(-10),
    shipping_is_billing: true,
    order_items: orderItems,
    payment_method: order.paymentMode === "COD" ? "COD" : "Prepaid",
    sub_total: order.pricing?.subtotal || order.paymentBreakdown?.productSubtotal || 100,
    length: 10,
    breadth: 10,
    height: 10,
    weight: 0.5,
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
    await order.save();

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
    await order.save();
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
  await order.save();

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
    order.deliveredAt = new Date();
    order.shiprocket.deliveredAt = new Date();
  } else if (upperStatus === "OUT_FOR_DELIVERY") {
    order.status = "out_for_delivery";
    order.orderStatus = "out_for_delivery";
    order.outForDeliveryAt = new Date();
  } else if (upperStatus === "IN_TRANSIT") {
    order.status = "packed";
    order.orderStatus = "packed";
    if (!order.shiprocket.shippedAt) order.shiprocket.shippedAt = new Date();
  } else if (upperStatus === "CANCELLED") {
    order.status = "cancelled";
    order.orderStatus = "cancelled";
  }

  order.shiprocket.history.push({
    status: upperStatus,
    location: location || order.address?.city || "Admin Manual Update",
    timestamp: new Date(),
    remarks: remarks || `Manually marked as ${upperStatus} by Administrator`,
    source: "manual",
  });

  await order.save();

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

  const query = {};
  if (orderId) query.orderId = orderId;
  else if (awb) query["shiprocket.awb"] = awb;

  const order = await Order.findOne(query);
  if (!order) {
    return { success: false, message: "Order not found for webhook notification" };
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

  if (statusRaw === "DELIVERED") {
    order.status = "delivered";
    order.orderStatus = "delivered";
    order.deliveredAt = new Date();
    order.shiprocket.deliveredAt = new Date();
  } else if (statusRaw.includes("OUT FOR DELIVERY") || statusRaw === "OUT_FOR_DELIVERY") {
    order.status = "out_for_delivery";
    order.orderStatus = "out_for_delivery";
  } else if (statusRaw.includes("IN TRANSIT") || statusRaw === "IN_TRANSIT" || statusRaw.includes("SHIPPED")) {
    order.status = "packed";
    order.orderStatus = "packed";
    if (!order.shiprocket.shippedAt) order.shiprocket.shippedAt = new Date();
  } else if (statusRaw.includes("CANCELLED") || statusRaw === "CANCELLED") {
    order.status = "cancelled";
    order.orderStatus = "cancelled";
  }

  order.shiprocket.history.push({
    status: statusRaw,
    location,
    timestamp: new Date(),
    remarks,
    source: "webhook",
  });

  await order.save();

  return {
    success: true,
    message: `Order #${order.orderId} updated via Shiprocket webhook: ${statusRaw}`,
  };
}
