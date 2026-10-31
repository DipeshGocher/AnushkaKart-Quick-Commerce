import axiosInstance from '@core/api/axios';

/**
 * Admin support tickets, notifications, and reviews moderation endpoints.
 * Per-domain split (P4.5).
 */
export const adminSupportApi = {
    // Tickets
    getTickets: (params) => axiosInstance.get('/admin/tickets', { params }),
    getTicketById: (id) => axiosInstance.get(`/admin/tickets/${id}`),
    updateTicketStatus: (id, status) =>
        axiosInstance.patch(`/admin/tickets/${id}/status`, { status }),
    replyTicket: (id, message) =>
        axiosInstance.post(`/admin/tickets/${id}/reply`, { message }),
    assignTicket: (id, assignedTo) =>
        axiosInstance.patch(`/admin/tickets/${id}/assign`, { assignedTo }),

    // FAQs
    getFaqs: (params) => axiosInstance.get('/admin/faqs', { params }),
    createFaq: (data) => axiosInstance.post('/admin/faqs', data),
    updateFaq: (id, data) => axiosInstance.put(`/admin/faqs/${id}`, data),
    deleteFaq: (id) => axiosInstance.delete(`/admin/faqs/${id}`),

    // Notifications
    getNotifications: (params) =>
        axiosInstance.get('/notifications/history', { params }),
    sendNotification: (data) =>
        axiosInstance.post('/notifications/broadcast', data),
    getNotificationStats: () =>
        axiosInstance.get('/notifications/stats'),
    getNotificationCampaigns: (params) =>
        axiosInstance.get('/notifications/campaigns', { params }),
    createNotificationCampaign: (data) =>
        axiosInstance.post('/notifications/broadcast', data),
    getBroadcastAudienceStats: () =>
        axiosInstance.get('/notifications/broadcast/audience-stats'),

    // Reviews moderation
    getPendingReviews: (params) =>
        axiosInstance.get('/reviews/admin/pending', { params }),
    getReviews: (params) =>
        axiosInstance.get('/reviews/admin/pending', { params }),
    updateReviewStatus: (id, status) =>
        axiosInstance.patch(`/reviews/admin/status/${id}`, { status }),
    deleteReview: (id) =>
        axiosInstance.delete(`/reviews/admin/${id}`),
};

export default adminSupportApi;
