import axiosInstance from '@core/api/axios';

/**
 * Admin support tickets, notifications, and reviews moderation endpoints.
 * Per-domain split (P4.5).
 */
export const adminSupportApi = {
    // Support Tickets (these are the routes the backend really has: /tickets/admin/all, /tickets/admin/status/:id, /tickets/reply/:id)
    getTickets: (params) => axiosInstance.get('/tickets/admin/all', { params }),
    updateTicketStatus: (id, status) =>
        axiosInstance.patch(`/tickets/admin/status/${id}`, { status }),
    replyTicket: (id, text, options = {}) => {
        const { mediaUrl = '', mediaType = '', mimeType = '' } = options || {};
        return axiosInstance.post(`/tickets/reply/${id}`, {
            text,
            isAdmin: true,
            mediaUrl,
            mediaType,
            mimeType,
        });
    },

    // FAQs
    getFaqs: (params) => axiosInstance.get('/admin/faqs', { params }),
    createFaq: (data) => axiosInstance.post('/admin/faqs', data),
    updateFaq: (id, data) => axiosInstance.put(`/admin/faqs/${id}`, data),
    deleteFaq: (id) => axiosInstance.delete(`/admin/faqs/${id}`),

    // Notifications
    getNotifications: () => axiosInstance.get('/notifications'),
    markNotificationRead: (id) =>
        axiosInstance.put(`/notifications/${id}/read`),
    markAllNotificationsRead: () =>
        axiosInstance.put('/notifications/mark-all-read'),
    broadcastNotification: (data) =>
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
