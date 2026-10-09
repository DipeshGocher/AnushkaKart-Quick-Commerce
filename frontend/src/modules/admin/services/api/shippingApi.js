import axiosInstance from '@core/api/axios';

/**
 * Admin API service for Hybrid Delivery & Shiprocket fulfillment
 */
export const adminShippingApi = {
  // Local delivery pincodes
  getPincodes: (params) => axiosInstance.get('/shipping/pincodes', { params }),
  createPincode: (data) => axiosInstance.post('/shipping/pincodes', data),
  updatePincode: (id, data) => axiosInstance.put(`/shipping/pincodes/${id}`, data),
  deletePincode: (id) => axiosInstance.delete(`/shipping/pincodes/${id}`),
  togglePincode: (id) => axiosInstance.patch(`/shipping/pincodes/${id}/toggle`),
  checkServiceability: (pincode) => axiosInstance.get(`/shipping/check-serviceability`, { params: { pincode } }),

  // Shiprocket fulfillment operations
  getShiprocketStatus: () => axiosInstance.get('/shipping/shiprocket/status'),
  processShiprocketOrder: (orderId) => axiosInstance.post(`/shipping/shiprocket/process/${orderId}`),
  scheduleShiprocketPickup: (orderId) => axiosInstance.post(`/shipping/shiprocket/pickup/${orderId}`),
  getShiprocketLabel: (orderId) => axiosInstance.get(`/shipping/shiprocket/label/${orderId}`),
  updateShiprocketManualStatus: (orderId, data) => axiosInstance.post(`/shipping/shiprocket/manual-status/${orderId}`, data),
};

export default adminShippingApi;
