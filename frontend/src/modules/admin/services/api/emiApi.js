import axiosInstance from '@core/api/axios';

/** Admin API for the EMI / finance feature (settings + customer quotations). */
export const adminEmiApi = {
    getEmiConfig: () => axiosInstance.get('/emi/admin/config'),
    saveEmiConfig: (data) => axiosInstance.put('/emi/admin/config', data),
    getEmiQuotes: (params) => axiosInstance.get('/emi/admin/quotes', { params }),
    getEmiQuote: (id, reveal = false) =>
        axiosInstance.get(`/emi/admin/quotes/${encodeURIComponent(id)}`, { params: reveal ? { reveal: 'true' } : {} }),
    updateEmiQuote: (id, data) => axiosInstance.patch(`/emi/admin/quotes/${encodeURIComponent(id)}`, data),
    deleteEmiQuote: (id) => axiosInstance.delete(`/emi/admin/quotes/${encodeURIComponent(id)}`),
};

export default adminEmiApi;
