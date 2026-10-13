import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, Upload, Image as ImageIcon, Loader2, Camera, CheckCircle2 } from 'lucide-react';
import { customerApi } from '../../services/customerApi';
import { useToast } from '@shared/components/ui/Toast';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

const RATING_LABELS = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent'
};

const ReviewSubmissionModal = ({ isOpen, onClose, product, onReviewSubmitted }) => {
    const { showToast } = useToast();
    const fileInputRef = useRef(null);

    const [rating, setRating] = useState(5);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen || !product) return null;

    const productId = product.productId || product.product || product._id || product.id;
    const productName = product.name || product.title || 'Product';
    const productImage = product.image || product.images?.[0] || product.mainImage;

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Max 5 images
        const availableSlots = 5 - selectedFiles.length;
        if (availableSlots <= 0) {
            showToast('You can upload a maximum of 5 images', 'warning');
            return;
        }

        const validFiles = files.slice(0, availableSlots).filter(file => {
            if (!file.type.startsWith('image/')) {
                showToast(`"${file.name}" is not a valid image`, 'warning');
                return false;
            }
            if (file.size > 10 * 1024 * 1024) {
                showToast(`"${file.name}" exceeds 10MB limit`, 'warning');
                return false;
            }
            return true;
        });

        const newPreviews = validFiles.map(file => URL.createObjectURL(file));

        setSelectedFiles(prev => [...prev, ...validFiles]);
        setPreviewUrls(prev => [...prev, ...newPreviews]);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setPreviewUrls(prev => {
            URL.revokeObjectURL(prev[index]);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!comment.trim()) {
            showToast('Please share your experience / write a review', 'warning');
            return;
        }

        if (!rating) {
            showToast('Please select a rating', 'warning');
            return;
        }

        try {
            setSubmitting(true);

            const formData = new FormData();
            formData.append('productId', String(productId));
            formData.append('rating', String(rating));
            formData.append('comment', comment.trim());

            selectedFiles.forEach(file => {
                formData.append('images', file);
            });

            const res = await customerApi.submitReview(formData);

            if (res.data?.success) {
                showToast('Review submitted! It will appear once verified by admin.', 'success');
                if (onReviewSubmitted) {
                    onReviewSubmitted(productId);
                }
                onClose();
            } else {
                showToast(res.data?.message || 'Failed to submit review', 'error');
            }
        } catch (error) {
            console.error('Review submit error:', error);
            const msg = error.response?.data?.message || 'Failed to submit review';
            showToast(msg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col"
                >
                    {/* Header */}
                    <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight">Rate & Review Product</h3>
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">Delivered Order Verification</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content (Scrollable) */}
                    <div className="p-6 overflow-y-auto space-y-5">
                        {/* Product Strip */}
                        <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                            <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0">
                                <img
                                    src={applyCloudinaryTransform(productImage)}
                                    alt={productName}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-slate-900 truncate">{productName}</h4>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-0.5">
                                    <CheckCircle2 size={13} className="text-emerald-600" />
                                    Delivered & Verified Purchase
                                </span>
                            </div>
                        </div>

                        {/* Interactive Stars */}
                        <div className="text-center py-2 space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                                Overall Rating
                            </label>
                            <div className="flex items-center justify-center gap-2">
                                {[1, 2, 3, 4, 5].map((star) => {
                                    const active = star <= (hoverRating || rating);
                                    return (
                                        <button
                                            key={star}
                                            type="button"
                                            onMouseEnter={() => setHoverRating(star)}
                                            onMouseLeave={() => setHoverRating(0)}
                                            onClick={() => setRating(star)}
                                            className="p-1 text-slate-200 hover:scale-115 active:scale-95 transition-all"
                                        >
                                            <Star
                                                size={32}
                                                className={cn(
                                                    "transition-colors",
                                                    active
                                                        ? "text-emerald-500 fill-emerald-500"
                                                        : "text-slate-200 fill-transparent"
                                                )}
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                            <span className="inline-block text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                                {RATING_LABELS[hoverRating || rating] || 'Select rating'}
                            </span>
                        </div>

                        {/* Comment Textarea */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">
                                Your Review <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                rows={4}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Share your experience... How is the quality, packaging, and performance?"
                                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                            />
                        </div>

                        {/* Multiple Image Upload */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <Camera size={15} className="text-slate-500" />
                                    Add Photos (Optional)
                                </label>
                                <span className="text-[11px] font-semibold text-slate-400">
                                    {selectedFiles.length}/5 photos
                                </span>
                            </div>

                            {/* Image Previews */}
                            <div className="flex flex-wrap gap-2.5 pt-1">
                                {previewUrls.map((url, idx) => (
                                    <div key={idx} className="relative w-20 h-20 rounded-2xl overflow-hidden border border-slate-200 group shadow-xs">
                                        <img src={url} alt={`preview-${idx}`} className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFile(idx)}
                                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}

                                {selectedFiles.length < 5 && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary/50 bg-slate-50 hover:bg-slate-100/70 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-primary transition-all cursor-pointer"
                                    >
                                        <Upload size={18} />
                                        <span className="text-[10px] font-bold">Upload</span>
                                    </button>
                                )}
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 transition active:scale-95 disabled:opacity-50"
                        >
                            {submitting && <Loader2 size={14} className="animate-spin" />}
                            <span>{submitting ? 'Submitting...' : 'Submit for Review'}</span>
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ReviewSubmissionModal;
