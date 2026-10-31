import mongoose from "mongoose";
import Review from "../models/review.js";
import Order from "../models/order.js";
import User from "../models/customer.js";
import Product from "../models/product.js";
import Seller from "../models/seller.js";
import handleResponse from "../utils/helper.js";
import getPagination from "../utils/pagination.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { getErrorStatus } from "../utils/httpError.js";

// Check if customer is eligible to review a product
export const checkReviewEligibility = async (req, res) => {
    try {
        let { productId } = req.params;
        const userId = req.user.id;

        if (productId && typeof productId === "object") {
            productId = productId._id || productId.id || productId.productId;
        }
        productId = String(productId || "").trim();

        if (!productId || productId === "[object Object]" || !mongoose.Types.ObjectId.isValid(productId)) {
            return handleResponse(res, 400, "Valid Product ID is required");
        }

        const [hasPurchased, existingReview] = await Promise.all([
            Order.findOne({
                customer: userId,
                "items.product": new mongoose.Types.ObjectId(productId),
                $or: [
                    { orderStatus: { $regex: /^delivered$/i } },
                    { status: { $regex: /^delivered$/i } },
                    { workflowStatus: "DELIVERED" }
                ]
            }).select("_id deliveredAt createdAt"),
            Review.findOne({ userId, productId }).select("_id rating comment images status createdAt")
        ]);

        return handleResponse(res, 200, "Eligibility checked", {
            canReview: !!hasPurchased && !existingReview,
            hasPurchased: !!hasPurchased,
            hasReviewed: !!existingReview,
            existingReview: existingReview || null
        });
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};

// Submit a review (Customer)
export const submitReview = async (req, res) => {
    try {
        let { productId, rating, comment } = req.body;
        const userId = req.user.id;

        if (productId && typeof productId === "object") {
            productId = productId._id || productId.id || productId.productId;
        }
        productId = String(productId || "").trim();

        if (!productId || productId === "[object Object]") {
            return handleResponse(res, 400, "Product ID is required");
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return handleResponse(res, 400, "Invalid Product ID format");
        }

        // Check if the user has purchased and received the product
        const hasPurchased = await Order.findOne({
            customer: userId,
            "items.product": new mongoose.Types.ObjectId(productId),
            $or: [
                { orderStatus: { $regex: /^delivered$/i } },
                { status: { $regex: /^delivered$/i } },
                { workflowStatus: "DELIVERED" }
            ]
        });

        if (!hasPurchased) {
            return handleResponse(res, 403, "You can only review products you have purchased and received");
        }

        // Check if user already reviewed this product
        const existingReview = await Review.findOne({ userId, productId });
        if (existingReview) {
            return handleResponse(res, 400, "You have already reviewed this product");
        }

        const uploadedImageUrls = [];

        // 1. Process files uploaded through multipart form
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const url = await uploadToCloudinary(file.buffer, 'reviews', {
                        mimeType: file.mimetype,
                        resourceType: 'image'
                    });
                    if (url) uploadedImageUrls.push(url);
                } catch (uploadErr) {
                    console.error("Cloudinary upload failed for review image, using data URI fallback:", uploadErr.message);
                    const fallbackUrl = `data:${file.mimetype || 'image/jpeg'};base64,${file.buffer.toString('base64')}`;
                    uploadedImageUrls.push(fallbackUrl);
                }
            }
        }

        // 2. Also support image URLs or base64 passed via req.body.images
        if (req.body.images) {
            let bodyImages = req.body.images;
            if (typeof bodyImages === 'string') {
                try {
                    bodyImages = JSON.parse(bodyImages);
                } catch {
                    bodyImages = [bodyImages];
                }
            }
            if (Array.isArray(bodyImages)) {
                bodyImages.forEach(img => {
                    if (typeof img === 'string' && img.trim()) {
                        uploadedImageUrls.push(img.trim());
                    }
                });
            }
        }

        const parsedRating = Number(rating) || 5;

        const newReview = new Review({
            userId,
            productId,
            orderId: hasPurchased._id,
            rating: Math.min(5, Math.max(1, parsedRating)),
            comment: String(comment || '').trim(),
            images: uploadedImageUrls,
            status: "pending", // Always pending until admin approves
        });

        await newReview.save();
        return handleResponse(res, 201, "Review submitted and pending approval", newReview);
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};

// Get approved reviews for a product (Public)
export const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const query = { productId, status: "approved" };
        if (req.user && req.user.id) {
            query.$or = [
                { status: "approved" },
                { userId: req.user.id }
            ];
            delete query.status;
        }

        const reviews = await Review.find(query)
            .populate("userId", "name image profileImage")
            .sort({ createdAt: -1 });

        return handleResponse(res, 200, "Reviews fetched successfully", reviews);
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};

// Admin: Get all reviews with status & search filters
export const getPendingReviews = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req, { defaultLimit: 25, maxLimit: 200 });
        const { status = "all", search = "" } = req.query;

        const query = {};

        // Status filter: "all", "pending", "approved", "rejected"
        if (status && status !== "all") {
            query.status = status;
        }

        // Search in comments
        if (search && search.trim()) {
            query.comment = { $regex: search.trim(), $options: "i" };
        }

        const [reviews, total, allCount, pendingCount, approvedCount, rejectedCount] = await Promise.all([
            Review.find(query)
                .populate("userId", "name email phone image profileImage")
                .populate({
                    path: "productId",
                    select: "name images price slug sellerId",
                    populate: { path: "sellerId", select: "shopName name" }
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Review.countDocuments(query),
            Review.countDocuments({}),
            Review.countDocuments({ status: "pending" }),
            Review.countDocuments({ status: "approved" }),
            Review.countDocuments({ status: "rejected" }),
        ]);

        return handleResponse(res, 200, "Reviews fetched successfully", {
            items: reviews,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
            counts: {
                all: allCount,
                pending: pendingCount,
                approved: approvedCount,
                rejected: rejectedCount,
            }
        });
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};

// Admin: Update review status (Approve/Reject)
export const updateReviewStatus = async (req, res) => {
    try {
        const { status } = req.body; // approved or rejected
        const { id } = req.params;

        if (!["approved", "rejected", "pending"].includes(status)) {
            return handleResponse(res, 400, "Invalid status. Allowed values: pending, approved, rejected");
        }

        const review = await Review.findByIdAndUpdate(id, { status }, { new: true });
        if (!review) return handleResponse(res, 404, "Review not found");

        return handleResponse(res, 200, `Review status updated to ${status} successfully`, review);
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};

// Admin: Delete review permanently
export const deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        const review = await Review.findByIdAndDelete(id);
        if (!review) return handleResponse(res, 404, "Review not found");

        return handleResponse(res, 200, "Review deleted permanently");
    } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
    }
};
