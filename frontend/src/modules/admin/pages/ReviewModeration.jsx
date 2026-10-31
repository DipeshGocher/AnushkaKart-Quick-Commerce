import React, { useState, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import {
    HiOutlineStar,
    HiOutlineTrash,
    HiOutlineShieldCheck,
    HiOutlineExclamationTriangle,
    HiOutlineChatBubbleBottomCenterText,
    HiOutlineMagnifyingGlass,
    HiOutlineBuildingStorefront,
    HiOutlineXMark,
    HiOutlineArrowPath
} from 'react-icons/hi2';
import { useToast } from '@shared/components/ui/Toast';
import Modal from '@shared/components/ui/Modal';
import { cn } from '@/lib/utils';
import { Loader2, MessageSquare, Clock, CheckCircle2, XCircle } from 'lucide-react';

const TABS = [
    { id: 'all', label: 'All Reviews', countKey: 'all' },
    { id: 'pending', label: 'Pending Approval', countKey: 'pending', badgeClass: 'bg-amber-100 text-amber-800' },
    { id: 'approved', label: 'Approved & Live', countKey: 'approved', badgeClass: 'bg-emerald-100 text-emerald-800' },
    { id: 'rejected', label: 'Rejected', countKey: 'rejected', badgeClass: 'bg-rose-100 text-rose-800' },
];

const ReviewModeration = () => {
    const { showToast } = useToast();
    const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
    const [selectedReview, setSelectedReview] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [loading, setLoading] = useState(true);
    const [reviews, setReviews] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);

    const fetchReviews = async (requestedPage = 1, currentTab = activeTab, search = searchQuery) => {
        try {
            setLoading(true);
            const params = {
                page: requestedPage,
                limit: pageSize,
                status: currentTab,
                search: search.trim() || undefined
            };
            const res = await adminApi.getPendingReviews(params);
            if (res.data.success) {
                const payload = res.data.result || {};
                const data = Array.isArray(payload.items) ? payload.items : (res.data.results || []);
                setReviews(data.map(r => ({
                    ...r,
                    id: r._id,
                    user: r.userId?.name || "Anonymous",
                    userContact: r.userId?.email || r.userId?.phone || "",
                    userAvatar: r.userId?.profileImage || r.userId?.image,
                    store: r.productId?.sellerId?.shopName || r.productId?.sellerId?.name || "Anushka Connect Store",
                    item: r.productId?.name || "Deleted Product",
                    itemImage: r.productId?.images?.[0] || "",
                    itemPrice: r.productId?.price,
                    itemSlug: r.productId?.slug,
                    images: Array.isArray(r.images) ? r.images : [],
                    date: new Date(r.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    }),
                    status: r.status || 'pending',
                    tags: []
                })));
                setTotal(typeof payload.total === 'number' ? payload.total : data.length);
                setPage(typeof payload.page === 'number' ? payload.page : requestedPage);
                if (payload.counts) {
                    setCounts(payload.counts);
                }
            }
        } catch (error) {
            console.error("Fetch Reviews Error:", error);
            showToast(error?.response?.data?.message || error?.message || "Failed to load reviews", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews(1, activeTab, searchQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setPage(1);
        fetchReviews(1, tabId, searchQuery);
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1);
        fetchReviews(1, activeTab, searchQuery);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setPage(1);
        fetchReviews(1, activeTab, '');
    };

    const handleUpdateStatus = async (id, newStatus) => {
        try {
            const res = await adminApi.updateReviewStatus(id, newStatus);
            if (res.data.success) {
                showToast(`Review ${newStatus === 'approved' ? 'approved & published to store' : 'marked as ' + newStatus}`, 'success');
                fetchReviews(page, activeTab, searchQuery);
            }
        } catch (error) {
            showToast("Failed to update review status", "error");
        }
    };

    const handleDeletePermanently = async (id) => {
        if (!window.confirm('Are you sure you want to permanently delete this review? This action cannot be undone.')) return;
        try {
            const res = await adminApi.deleteReview(id);
            if (res.data.success) {
                showToast('Review permanently deleted', 'success');
                fetchReviews(page, activeTab, searchQuery);
            }
        } catch (error) {
            showToast("Failed to delete review", "error");
        }
    };

    const handleReplyClick = (review) => {
        setSelectedReview(review);
        setIsReplyModalOpen(true);
    };

    const submitReply = () => {
        if (!replyText.trim()) return;
        showToast(`Official reply recorded for ${selectedReview?.user}`, 'success');
        setIsReplyModalOpen(false);
        setReplyText('');
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 font-outfit">
            {/* Header & Filter Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1 mb-6">
                <div>
                    <h1 className="ds-h1 flex items-center gap-2">
                        <MessageSquare className="h-6 w-6 text-primary" />
                        <span>Review Content & Moderation</span>
                    </h1>
                    <p className="ds-description mt-0.5">
                        Manage customer reviews, inspect attached photos, approve or unpublish reviews across products.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Search box */}
                    <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
                        <HiOutlineMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search in reviews..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-xs"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <HiOutlineXMark className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </form>

                    <button
                        type="button"
                        onClick={() => fetchReviews(page, activeTab, searchQuery)}
                        title="Refresh Reviews"
                        className="p-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl shadow-xs transition-colors"
                    >
                        <HiOutlineArrowPath className={cn("h-4 w-4", loading && "animate-spin text-primary")} />
                    </button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-4 border-b border-slate-200/80">
                {TABS.map((tab) => {
                    const count = counts[tab.countKey] ?? 0;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
                                isActive
                                    ? "bg-slate-900 text-white shadow-sm"
                                    : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80"
                            )}
                        >
                            <span>{tab.label}</span>
                            <span
                                className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-extrabold",
                                    isActive
                                        ? "bg-white/20 text-white"
                                        : (tab.badgeClass || "bg-slate-100 text-slate-600")
                                )}
                            >
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Content List */}
            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs font-semibold">Loading reviews...</span>
                </div>
            ) : reviews.length === 0 ? (
                <Card className="p-12 text-center border border-dashed border-slate-200 rounded-2xl bg-white shadow-xs">
                    <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                        <MessageSquare className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 mb-1">
                        {activeTab === 'pending'
                            ? "No Pending Reviews"
                            : activeTab === 'approved'
                            ? "No Approved Reviews"
                            : activeTab === 'rejected'
                            ? "No Rejected Reviews"
                            : "No Reviews Found"}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {activeTab === 'pending'
                            ? "Great job! All customer reviews have been moderated."
                            : searchQuery
                            ? `No reviews match "${searchQuery}". Try clearing search.`
                            : "Reviews submitted by verified customers will appear here."}
                    </p>
                    {searchQuery && (
                        <button
                            onClick={handleClearSearch}
                            className="mt-4 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                        >
                            Clear Search
                        </button>
                    )}
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-5">
                    {reviews.map((r) => (
                        <Card key={r.id} className="p-5 border border-slate-200 shadow-sm bg-white rounded-2xl group overflow-hidden relative hover:border-slate-300 transition-all">
                            <HiOutlineChatBubbleBottomCenterText className="absolute -top-6 -right-6 h-32 w-32 text-slate-100 opacity-20 pointer-events-none group-hover:scale-110 transition-transform duration-700" />

                            <div className="flex flex-col lg:flex-row gap-5 relative z-10">
                                {/* Left column: User info & Rating */}
                                <div className="lg:w-64 shrink-0 space-y-3.5 border-b lg:border-b-0 lg:border-r border-slate-100 pb-4 lg:pb-0 lg:pr-5">
                                    <div className="flex items-center gap-3">
                                        <div className="h-11 w-11 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-primary font-bold text-base shadow-xs shrink-0 overflow-hidden">
                                            {r.userAvatar ? (
                                                <img src={r.userAvatar} alt={r.user} className="w-full h-full object-cover" />
                                            ) : (
                                                (r.user[0] || 'U').toUpperCase()
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-sm font-bold text-slate-900 truncate">{r.user}</h4>
                                            {r.userContact && (
                                                <p className="text-[11px] text-slate-400 truncate">{r.userContact}</p>
                                            )}
                                            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{r.date}</p>
                                        </div>
                                    </div>

                                    {/* Star Rating */}
                                    <div className="flex items-center gap-1.5 bg-amber-50/70 border border-amber-100/80 px-2.5 py-1 rounded-lg w-fit">
                                        <div className="flex items-center gap-0.5">
                                            {[...Array(5)].map((_, i) => (
                                                <HiOutlineStar
                                                    key={i}
                                                    className={cn("h-3.5 w-3.5", i < r.rating ? "text-amber-500 fill-amber-500" : "text-slate-300")}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-xs font-extrabold text-amber-700">{r.rating}.0</span>
                                    </div>

                                    {/* Product and Store Info */}
                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                            <HiOutlineBuildingStorefront className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                            <span className="font-semibold truncate">{r.store}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                            {r.itemImage ? (
                                                <img
                                                    src={r.itemImage}
                                                    alt={r.item}
                                                    className="w-9 h-9 rounded-lg object-cover bg-white border border-slate-200 shrink-0"
                                                />
                                            ) : (
                                                <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                                                    Item
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">
                                                    {r.item}
                                                </p>
                                                {r.itemPrice && (
                                                    <span className="text-[10px] font-bold text-slate-500">₹{r.itemPrice}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Middle column: Comment & Photos & Status */}
                                <div className="flex-1 space-y-3.5">
                                    {/* Status Badge */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {r.status === 'approved' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                <CheckCircle2 size={13} className="text-emerald-600" />
                                                <span>Approved & Live on Product Page</span>
                                            </span>
                                        )}
                                        {r.status === 'pending' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                <Clock size={13} className="text-amber-600" />
                                                <span>Pending Moderation</span>
                                            </span>
                                        )}
                                        {r.status === 'rejected' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                                <XCircle size={13} className="text-rose-600" />
                                                <span>Rejected & Hidden from Store</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Comment Quote */}
                                    <blockquote className="text-sm font-medium text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-xl border-l-4 border-primary">
                                        &quot;{r.comment}&quot;
                                    </blockquote>

                                    {/* Attached Customer Photos */}
                                    {Array.isArray(r.images) && r.images.length > 0 && (
                                        <div className="space-y-1.5 pt-1">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                Attached Customer Photos ({r.images.length})
                                            </p>
                                            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
                                                {r.images.map((imgUrl, imgIdx) => (
                                                    <a
                                                        key={imgIdx}
                                                        href={imgUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="relative group/img block w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-slate-200 shadow-xs shrink-0 bg-slate-100 hover:border-primary transition-colors"
                                                    >
                                                        <img
                                                            src={imgUrl}
                                                            alt="Customer attached review"
                                                            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                                                        />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right column: Action Buttons */}
                                <div className="lg:w-44 flex lg:flex-col items-center justify-center gap-2 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-5 shrink-0">
                                    {r.status !== 'approved' && (
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateStatus(r.id, 'approved')}
                                            className="flex-1 w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
                                        >
                                            <HiOutlineShieldCheck className="h-4 w-4" />
                                            <span>APPROVE</span>
                                        </button>
                                    )}

                                    {r.status === 'approved' && (
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateStatus(r.id, 'rejected')}
                                            className="flex-1 w-full flex items-center justify-center gap-1.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
                                            title="Unpublish this review from product page"
                                        >
                                            <HiOutlineExclamationTriangle className="h-4 w-4" />
                                            <span>UNPUBLISH</span>
                                        </button>
                                    )}

                                    {r.status === 'rejected' && (
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateStatus(r.id, 'approved')}
                                            className="flex-1 w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
                                            title="Re-approve this review"
                                        >
                                            <HiOutlineShieldCheck className="h-4 w-4" />
                                            <span>RE-APPROVE</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => handleDeletePermanently(r.id)}
                                        className="flex-1 w-full flex items-center justify-center gap-1.5 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98"
                                        title="Delete review permanently"
                                    >
                                        <HiOutlineTrash className="h-3.5 w-3.5" />
                                        <span>DELETE</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleReplyClick(r)}
                                        className="flex-1 w-full flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98"
                                    >
                                        <span>REPLY</span>
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {total > pageSize && (
                <div className="mt-6 flex justify-center">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchReviews(p, activeTab, searchQuery)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={loading}
                    />
                </div>
            )}

            {/* Reply Modal */}
            <Modal
                isOpen={isReplyModalOpen}
                onClose={() => setIsReplyModalOpen(false)}
                title="Send Public Response"
            >
                <div className="space-y-4">
                    {selectedReview && (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Review from {selectedReview.user}</p>
                            <p className="text-xs font-medium text-slate-700 italic">&quot;{selectedReview.comment}&quot;</p>
                        </div>
                    )}
                    <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your official response..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-semibold min-h-[120px] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setIsReplyModalOpen(false)}
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={submitReply}
                            className="flex-1 py-3 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:bg-primary/90 transition-all cursor-pointer"
                        >
                            Publish Reply
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ReviewModeration;
