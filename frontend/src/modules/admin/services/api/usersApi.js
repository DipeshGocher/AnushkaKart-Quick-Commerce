import axiosInstance from '@core/api/axios';

/**
 * Admin user, seller, warehouse, and reports endpoints.
 * Per-domain split (P4.5).
 */
export const adminUsersApi = {
    getStats: () => axiosInstance.get('/admin/stats'),
    getReports: () => axiosInstance.get('/admin/reports'),

    getUsers: (params) => axiosInstance.get('/admin/users', { params }),
    getUserById: (id) => axiosInstance.get(`/admin/users/${id}`),
    updateUserStatus: (id, data) =>
        axiosInstance.patch(`/admin/users/${id}/status`, data),
    sendUserNotification: (id, data) =>
        axiosInstance.post(`/admin/users/${id}/notify`, data),

    getSellers: (params) => axiosInstance.get('/admin/sellers', { params }),
    getSellerStoreBanners: (sellerId) =>
        axiosInstance.get(`/admin/sellers/${sellerId}/banners`),
    updateSellerStoreBanners: (sellerId, data) =>
        axiosInstance.put(`/admin/sellers/${sellerId}/banners`, data),
    getActiveSellers: (params) =>
        axiosInstance.get('/admin/sellers/active', { params }),
    getSellerLocations: (params) =>
        axiosInstance.get('/admin/sellers/locations', { params }),
    getPendingSellers: (params) =>
        axiosInstance.get('/admin/sellers/pending', { params }),
    approveSeller: (id) => axiosInstance.patch(`/admin/sellers/approve/${id}`),
    rejectSeller: (id, data) =>
        axiosInstance.delete(`/admin/sellers/reject/${id}`, { data }),

    // Warehouse management
    getPendingWarehouses: (params) =>
        axiosInstance.get('/admin/warehouses/pending', { params }),
    getActiveWarehouses: (params) =>
        axiosInstance.get('/admin/warehouses/active', { params }),
    approveWarehouse: (id) => axiosInstance.patch(`/admin/warehouses/approve/${id}`),
    rejectWarehouse: (id, data) =>
        axiosInstance.delete(`/admin/warehouses/reject/${id}`, { data }),
};

export default adminUsersApi;

