import axiosInstance from '@core/api/axios';

/**
 * Admin order and return endpoints.
 * Per-domain split (P4.5).
 */
export const adminOrdersApi = {
    getOrders: (params) =>
        axiosInstance.get('/orders/seller-orders', { params }),
    getOrderDetails: (orderId) =>
        axiosInstance.get(`/orders/details/${orderId}`),
    updateOrderStatus: (orderId, data) =>
        axiosInstance.put(`/orders/status/${orderId}`, data),
    approveUpiPayment: (orderId, data) =>
        axiosInstance.post(`/orders/${orderId}/payment/approve-upi`, data || {}),
    rejectUpiPayment: (orderId, data) =>
        axiosInstance.post(`/orders/${orderId}/payment/reject-upi`, data || {}),

    getReturns: (params) =>
        axiosInstance.get('/orders/seller-returns', { params }),
    getReturnDetails: (orderId) =>
        axiosInstance.get(`/orders/${orderId}/returns`),
    approveReturn: (orderId, data) =>
        axiosInstance.put(`/orders/returns/${orderId}/approve`, data),
    rejectReturn: (orderId, data) =>
        axiosInstance.put(`/orders/returns/${orderId}/reject`, data),
    assignReturnDelivery: (orderId, data) =>
        axiosInstance.put(`/orders/returns/${orderId}/assign-delivery`, data),
    updateReturnQc: (orderId, data) =>
        axiosInstance.put(`/orders/returns/${orderId}/qc`, data),
    /** Rule on a customer's dispute of a failed QC. data = { decision: "customer" | "seller", note } */
    resolveReturnDispute: (orderId, data) =>
        axiosInstance.put(`/orders/returns/${orderId}/dispute/resolve`, data),

    /** Fetch the driving-route polyline for a live order (same endpoint used by customer & delivery apps). */
    getOrderRoute: (orderId, params) =>
        axiosInstance.get(`/orders/workflow/${orderId}/route`, { params }),
};

export default adminOrdersApi;
