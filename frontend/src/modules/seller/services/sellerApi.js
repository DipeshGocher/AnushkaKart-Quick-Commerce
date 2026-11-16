import axiosInstance from '@core/api/axios';

export const sellerApi = {
    login: (data) => axiosInstance.post('/seller/login', data),
    signup: (data) => axiosInstance.post('/seller/signup', data),
    checkExists: (data) => axiosInstance.post('/seller/check-exists', data),
    sendVerificationOtp: (data) => axiosInstance.post('/seller/verification/send-otp', data),
    verifyVerificationOtp: (data) => axiosInstance.post('/seller/verification/verify-otp', data),
    sendResetOtp: (data) => axiosInstance.post('/seller/forgot-password/send-otp', data),
    verifyResetOtp: (data) => axiosInstance.post('/seller/forgot-password/verify-otp', data),
    resetPassword: (data) => axiosInstance.post('/seller/reset-password', data),
    // Products
    getProducts: (params) => axiosInstance.get('/products/seller/me', { params }),
    getProductById: (id) => axiosInstance.get(`/products/${id}`),
    createProduct: (data) => axiosInstance.post('/products', data),
    // Bulk upload (Excel)
    downloadProductTemplate: () => axiosInstance.get('/products/bulk/template', { responseType: 'blob' }),
    bulkPreviewProducts: (file) => { const f = new FormData(); f.append('file', file); return axiosInstance.post('/products/bulk/preview', f, { timeout: 120000 }); },
    bulkCommitProducts: (file) => { const f = new FormData(); f.append('file', file); return axiosInstance.post('/products/bulk/commit', f, { timeout: 600000 }); },
    updateProduct: (id, data) => axiosInstance.put(`/products/${id}`, data),
    deleteProduct: (id) => axiosInstance.delete(`/products/${id}`),
    bulkDeleteProducts: (productIds) => axiosInstance.post("/products/bulk-delete", { productIds }),

    // Categories (Public)
    getCategories: (params) => axiosInstance.get('/admin/categories', { params }),
    getCategoryTree: (params) => axiosInstance.get('/admin/categories?tree=true', { params }),

    // Others
    getStats: (params) => axiosInstance.get('/seller/stats', { params: typeof params === 'object' ? params : { range: params } }),
    getOrders: (params) => axiosInstance.get('/orders/seller-orders', { params }),
    updateOrderStatus: (orderId, data) => axiosInstance.put(`/orders/status/${orderId}`, data),
    getEarnings: () => axiosInstance.get('/seller/earnings'),
    getWalletSummary: () => axiosInstance.get('/seller/wallet/summary'),
    getProfile: () => axiosInstance.get('/seller/profile'),
    updateProfile: (data) => axiosInstance.put('/seller/profile', data),

    // Stock
    adjustStock: (data) => axiosInstance.post('/products/adjust-stock', data),
    getStockHistory: () => axiosInstance.get('/products/stock-history'),

    // Notifications
    getNotifications: () => axiosInstance.get('/notifications'),
    markNotificationRead: (id) => axiosInstance.put(`/notifications/${id}/read`),
    markAllNotificationsRead: () => axiosInstance.put('/notifications/mark-all-read'),

    // Money Requests
    requestWithdrawal: (data) => axiosInstance.post('/seller/request-withdrawal', data),

    // Returns
    getReturns: (params) => axiosInstance.get('/orders/seller-returns', { params }),
    getReturnDetails: (orderId) => axiosInstance.get(`/orders/${orderId}/returns`),
    approveReturn: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/approve`, data),
    rejectReturn: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/reject`, data),
    assignReturnDelivery: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/assign-delivery`, data),
    updateReturnQcStatus: (orderId, data) => axiosInstance.put(`/orders/returns/${orderId}/qc`, data),

    // Shiprocket Courier Fulfillment & Reverse Pickup
    processShiprocketOrder: (orderId) => axiosInstance.post(`/shipping/shiprocket/process/${orderId}`),
    // Runs / resumes the whole courier pipeline: shipment -> AWB -> pickup -> label
    fulfillShiprocketOrder: (orderId) => axiosInstance.post(`/shipping/shiprocket/fulfill/${orderId}`),
    scheduleShiprocketPickup: (orderId) => axiosInstance.post(`/shipping/shiprocket/pickup/${orderId}`),
    getShiprocketLabel: (orderId) => axiosInstance.get(`/shipping/shiprocket/label/${orderId}`),
    scheduleShiprocketReversePickup: (orderId) => axiosInstance.post(`/shipping/shiprocket/reverse/pickup/${orderId}`),
    updateShiprocketReverseStatus: (orderId, data) => axiosInstance.post(`/shipping/shiprocket/reverse/manual-status/${orderId}`, data),
    getShiprocketReverseLabel: (orderId) => axiosInstance.get(`/shipping/shiprocket/reverse/label/${orderId}`),

    // Live Tracking & Routes
    getOrderRoute: (orderId, params) => axiosInstance.get(`/orders/workflow/${orderId}/route`, { params }),
};
