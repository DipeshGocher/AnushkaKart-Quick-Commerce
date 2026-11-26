import axiosInstance from '@core/api/axios';

/**
 * Admin panel role-based access: what the signed-in admin may open, and (main admin only)
 * the roles and staff logins.
 */
export const adminStaffApi = {
    getMyAccess: () => axiosInstance.get('/admin/access'),

    getStaffModules: () => axiosInstance.get('/admin/staff/modules'),

    listStaffRoles: () => axiosInstance.get('/admin/staff/roles'),
    createStaffRole: (data) => axiosInstance.post('/admin/staff/roles', data),
    updateStaffRole: (id, data) => axiosInstance.put(`/admin/staff/roles/${id}`, data),
    deleteStaffRole: (id) => axiosInstance.delete(`/admin/staff/roles/${id}`),

    listStaffMembers: () => axiosInstance.get('/admin/staff/members'),
    createStaffMember: (data) => axiosInstance.post('/admin/staff/members', data),
    updateStaffMember: (id, data) => axiosInstance.put(`/admin/staff/members/${id}`, data),
    deleteStaffMember: (id) => axiosInstance.delete(`/admin/staff/members/${id}`),
};

export default adminStaffApi;
