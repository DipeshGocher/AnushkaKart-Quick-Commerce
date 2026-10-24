import axiosInstance from "@core/api/axios";
import { getWithDedupe, invalidateCache, TTL } from "@core/api/dedupe";
import { registerCategoriesDeliveryModes } from "./deliveryCache";

export const customerApi = {
  sendLoginOtp: (data) => axiosInstance.post("/customer/send-login-otp", data),
  sendSignupOtp: (data) =>
    axiosInstance.post("/customer/send-signup-otp", data),
  verifyOtp: (data) => axiosInstance.post("/customer/verify-otp", data),
  getProfile: () => getWithDedupe("/customer/profile", {}, { ttl: 5000 }), // Short cache for profile
  updateProfile: (data) => {
    invalidateCache("/customer/profile");
    return axiosInstance.put("/customer/profile", data);
  },
  deleteAccount: () => axiosInstance.delete("/customer/delete-account"),
  getWalletTransactions: (params) =>
    getWithDedupe("/customer/transactions", params),
  getCategories: async (params) => {
    const res = await getWithDedupe("/categories", params, { ttl: TTL.LONG });
    try {
      const data =
        res?.data?.results ||
        res?.data?.result ||
        res?.data?.items ||
        res?.data ||
        res;
      if (Array.isArray(data)) registerCategoriesDeliveryModes(data);
    } catch (e) {}
    return res;
  },
  getProducts: (params) => getWithDedupe("/products", params, { ttl: TTL.MEDIUM }),
  getHeaderProducts: async (params) => {
    const res = await getWithDedupe("/products/header-products", params, { ttl: TTL.MEDIUM });
    try {
      const sections =
        res?.data?.results ||
        res?.data?.result ||
        res?.data?.items ||
        res?.data ||
        res;
      if (Array.isArray(sections)) {
        sections.forEach((s) => {
          if (s?.header) registerCategoriesDeliveryModes([s.header]);
        });
      }
    } catch (e) {}
    return res;
  },
  getProductById: (id, params) => getWithDedupe(`/products/${id}`, params),

  // Sellers & Location
  getNearbySellers: (params) => getWithDedupe("/seller/nearby", params),
  reverseGeocode: (params) => getWithDedupe("/maps/reverse-geocode", params, { ttl: 60000 }),

  // Cart
  getCart: () => getWithDedupe("/cart", {}, { ttl: 2000 }), // Very short cache for cart
  addToCart: (data) => {
    invalidateCache("/cart"); // Invalidate cart cache
    return axiosInstance.post("/cart/add", data);
  },
  updateCartQuantity: (data) => {
    invalidateCache("/cart");
    return axiosInstance.put("/cart/update", data);
  },
  removeFromCart: (productId, variantSku = "") => {
    invalidateCache("/cart");
    const params = {};
    const normalizedVariantSku = String(variantSku || "").trim();
    if (normalizedVariantSku) params.variantSku = normalizedVariantSku;
    return axiosInstance.delete(`/cart/remove/${productId}`, { params });
  },
  clearCart: () => {
    invalidateCache("/cart");
    return axiosInstance.delete("/cart/clear");
  },

  // Wishlist
  getWishlist: (params) => getWithDedupe("/wishlist", params, { ttl: 5000 }),
  addToWishlist: (data) => {
    invalidateCache("/wishlist");
    return axiosInstance.post("/wishlist/add", data);
  },
  toggleWishlist: (data) => {
    invalidateCache("/wishlist");
    return axiosInstance.post("/wishlist/toggle", data);
  },
  removeFromWishlist: (productId) => {
    invalidateCache("/wishlist");
    return axiosInstance.delete(`/wishlist/remove/${productId}`);
  },

  // Orders
  // Explicit timeout so checkout never waits forever if the server blocks (e.g. Redis/Bull).
  checkoutPreview: (data) =>
    axiosInstance.post("/orders/checkout/preview", data, { timeout: 120000 }),
  previewCheckoutFinance: (data) =>
    axiosInstance.post("/orders/checkout/preview", data, { timeout: 120000 }),
  createOrder: (data) =>
    axiosInstance.post("/orders", data, { timeout: 120000 }),
  verifyOnlineOrderPayment: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/payment/verify-online`, data),
  markOrderDelivered: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/delivered`, data || {}),
  markOrderCodCollected: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/cod/mark-collected`, data || {}),
  reconcileOrderCod: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/cod/reconcile`, data),
  placeOrder: (data) =>
    axiosInstance.post("/orders/place", data, { timeout: 120000 }),
  getMyOrders: () => getWithDedupe("/orders/my-orders"),
  /**
   * Order details must reflect live workflow, but we still dedupe in-flight requests to avoid
   * network spam when multiple effects/events trigger refresh simultaneously.
   * ttl=0 means "no caching" (only in-flight dedupe).
   */
  getOrderDetails: (orderId) =>
    getWithDedupe(
      `/orders/details/${encodeURIComponent(String(orderId ?? "").trim())}`,
      {},
      { ttl: 0 },
    ),
  getOrderRoute: (orderId, params) =>
    axiosInstance.get(`/orders/workflow/${orderId}/route`, { params }),
  cancelOrder: (orderId, data) =>
    axiosInstance.put(`/orders/cancel/${orderId}`, data),
  requestReturn: (orderId, data) =>
    axiosInstance.post(`/orders/${orderId}/returns`, data),
  getReturnDetails: (orderId) =>
    axiosInstance.get(`/orders/${encodeURIComponent(String(orderId ?? "").trim())}/returns`),

  // Payments
  createPaymentOrder: (data) =>
    axiosInstance.post("/payments/create-order", data),
  verifyPaymentStatus: (id) => axiosInstance.get(`/payments/status/${id}`),

  // Support & Reviews
  getProductReviews: (productId) =>
    getWithDedupe(`/reviews/product/${productId}`),
  checkReviewEligibility: (productId) =>
    axiosInstance.get(`/reviews/check-eligibility/${productId}`),
  submitReview: (data) => {
    invalidateCache("/reviews/product");
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
    return axiosInstance.post("/reviews/submit", data, {
      headers: isFormData ? { "Content-Type": "multipart/form-data" } : {}
    });
  },
  createTicket: (data) => axiosInstance.post("/tickets/create", data),
  getMyTickets: () => getWithDedupe("/tickets/my-tickets"),
  replyTicket: (ticketId, text, options = {}) => {
    const {
      mediaUrl = "",
      mediaType = "",
      mimeType = "",
    } = options || {};

    return axiosInstance.post(`/tickets/reply/${encodeURIComponent(String(ticketId))}`, {
      text,
      isAdmin: false,
      mediaUrl,
      mediaType,
      mimeType,
    });
  },

  // Experience sections (home / header pages)
  getExperienceSections: (params) => getWithDedupe("/experience", params, { ttl: TTL.MEDIUM }),

  // Hero config (separate hero banners + categories per page; fallback to home)
  getHeroConfig: (params, options = {}) => {
    const qParams = options.forceRefresh ? { ...params, _t: Date.now() } : params;
    return getWithDedupe("/experience/hero", qParams, { ttl: TTL.SHORT, ...options }); // 30 s — CMS can update any time
  },

  // Public offers
  getOffers: () => getWithDedupe("/offers"),

  // Coupons
  validateCoupon: (data) => axiosInstance.post("/coupons/validate", data),
  getActiveCoupons: () => getWithDedupe("/coupons", { status: "active" }),
  getCoupons: () => getWithDedupe("/coupons", { status: "active" }),

  // Maps (server-side geocoding)
  geocodeAddress: (address, params = {}) =>
    axiosInstance.get("/maps/geocode", { params: { address, ...params } }),
  geocodePlaceId: (placeId, params = {}) =>
    axiosInstance.get("/maps/geocode", { params: { placeId, ...params } }),

  // Push (FCM) test
  testPushNotification: () => axiosInstance.post("/push/test"),
  getTestPushNotificationStatus: (orderId) =>
    axiosInstance.get(`/push/test-status/${encodeURIComponent(String(orderId || "").trim())}`),

  // Notifications
  getNotifications: (params) => axiosInstance.get("/notifications", { params }),
  markNotificationsRead: () => axiosInstance.patch("/notifications/read"),

  // Shipping & Hyperlocal Pincodes
  checkShippingServiceability: (params) =>
    getWithDedupe("/shipping/check-serviceability", params, { ttl: 60 * 1000 }),
  getLocalPincodes: () =>
    getWithDedupe("/shipping/local-pincodes", {}, { ttl: 5 * 60 * 1000 }),
  validateCartDelivery: (data) =>
    axiosInstance.post("/shipping/validate-cart", data),
};
