import express from "express";
import {
    listCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    validateCoupon,
} from "../controller/couponController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// The public list only ever shows coupons a customer can currently use.
const publicScope = (req, _res, next) => {
    req.couponScope = "public";
    next();
};

// Admin management
router.get("/admin/coupons", verifyToken, allowRoles("admin"), listCoupons);
router.post("/admin/coupons", verifyToken, allowRoles("admin"), createCoupon);
router.put("/admin/coupons/:id", verifyToken, allowRoles("admin"), updateCoupon);
router.delete("/admin/coupons/:id", verifyToken, allowRoles("admin"), deleteCoupon);

// Customer‑facing
router.post("/coupons/validate", validateCoupon);
router.get("/coupons", publicScope, listCoupons);

export default router;
