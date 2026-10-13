import express from "express";
import multer from "multer";
import {
    submitReview,
    getProductReviews,
    getPendingReviews,
    updateReviewStatus,
    checkReviewEligibility
} from "../controller/reviewController.js";
import { verifyToken, allowRoles, optionalVerifyToken } from "../middleware/authMiddleware.js";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per image
        files: 5 // Max 5 review photos
    }
});

const router = express.Router();

// Public routes
router.get("/product/:productId", optionalVerifyToken, getProductReviews);

// Authenticated Customer routes
router.get("/check-eligibility/:productId", verifyToken, checkReviewEligibility);
router.post("/submit", verifyToken, upload.array("images", 5), submitReview);

// Admin only routes
router.get("/admin/pending", verifyToken, allowRoles("admin"), getPendingReviews);
router.patch("/admin/status/:id", verifyToken, allowRoles("admin"), updateReviewStatus);

export default router;
