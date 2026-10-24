import axiosInstance from '@core/api/axios';

/**
 * Admin catalog endpoints: categories and products (moderation included).
 * Per-domain split (P4.5).
 */
export const adminCatalogApi = {
    // Category Management - always bypass browser cache with unique query timestamp
    getCategories: (params) =>
        axiosInstance.get('/admin/categories', {
            params: { ...params, _t: Date.now() },
        }),
    getCategoryTree: (params) =>
        axiosInstance.get('/admin/categories?tree=true', {
            params: { ...params, _t: Date.now() },
        }),
    createCategory: (formData) =>
        axiosInstance.post('/admin/categories', formData),
    updateCategory: (id, formData) =>
        axiosInstance.put(`/admin/categories/${id}`, formData),
    deleteCategory: (id) => axiosInstance.delete(`/admin/categories/${id}`),
    getParentUnits: () =>
        axiosInstance.get('/admin/categories?flat=true', {
            params: { _t: Date.now() },
        }),

    // Product Management
    getProducts: (params) => axiosInstance.get('/products', { params }),
    getProductModerationList: (params) =>
        axiosInstance.get('/products/moderation', { params }),
    approveProductModeration: (id, data = {}) =>
        axiosInstance.patch(`/products/moderation/${id}/approve`, data),
    rejectProductModeration: (id, data = {}) =>
        axiosInstance.patch(`/products/moderation/${id}/reject`, data),
    createProduct: (formData) => axiosInstance.post('/products', formData),
    updateProduct: (id, formData) =>
        axiosInstance.put(`/products/${id}`, formData),
    deleteProduct: (id) => axiosInstance.delete(`/products/${id}`),

    // Dynamic Attributes Management
    getAttributes: (params) => axiosInstance.get('/attributes', { params }),
    getCategoryAttributes: (categoryId) => axiosInstance.get(`/attributes/category/${categoryId}`),
    createAttribute: (data) => axiosInstance.post('/attributes', data),
    updateAttribute: (id, data) => axiosInstance.put(`/attributes/${id}`, data),
    deleteAttribute: (id) => axiosInstance.delete(`/attributes/${id}`),
};

export default adminCatalogApi;
