import axiosInstance from '@core/api/axios';

/**
 * Admin delivery-partner endpoints (lifecycle, active fleet).
 * Per-domain split (P4.5).
 */
export const adminDeliveryApi = {
    getDeliveryPartners: (params) =>
        axiosInstance.get('/admin/delivery-partners', { params }),
    approveDeliveryPartner: (id) =>
        axiosInstance.patch(`/admin/delivery-partners/approve/${id}`),
    updateDeliveryPartnerStatus: (id, data) =>
        axiosInstance.patch(`/admin/delivery-partners/${id}/status`, data),
    deleteDeliveryPartner: (id) =>
        axiosInstance.delete(`/admin/delivery-partners/${id}`),
    rejectDeliveryPartner: (id) =>
        axiosInstance.delete(`/admin/delivery-partners/reject/${id}`),
};

export default adminDeliveryApi;
