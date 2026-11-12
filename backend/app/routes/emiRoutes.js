import express from "express";
import { verifyToken, optionalVerifyToken, allowRoles } from "../middleware/authMiddleware.js";
import { createRateLimiter, getClientIp } from "../middleware/rateLimiter.js";
import {
  getEnabledHeaders,
  getProductFinanceInfo,
  calculate,
  createQuotation,
  getAdminConfig,
  saveAdminConfig,
  listAdminQuotes,
  getAdminQuote,
  updateAdminQuote,
  deleteAdminQuote,
} from "../controller/emiController.js";

const router = express.Router();

const calcLimiter = createRateLimiter({
  namespace: "emi_calc",
  windowMs: 10 * 60 * 1000,
  max: parseInt(process.env.EMI_CALC_RATE_LIMIT_MAX || "120", 10),
  message: "Too many requests. Please wait a moment.",
});

// A quotation is saved and opens WhatsApp: keep it hard to spam (per IP + phone number).
const quoteLimiter = createRateLimiter({
  namespace: "emi_quote",
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.EMI_QUOTE_RATE_LIMIT_MAX || "10", 10),
  keyGenerator: (req) => {
    const phone = String(req.body?.customer?.phone || "").replace(/\D/g, "").slice(-10);
    return `${getClientIp(req)}:${phone}`;
  },
  message: "You have sent too many quotations. Please try again later.",
});

// Customer (no login needed)
router.get("/enabled-headers", calcLimiter, getEnabledHeaders);
router.get("/product/:productId", calcLimiter, getProductFinanceInfo);
router.post("/calculate", calcLimiter, calculate);
router.post("/quotes", optionalVerifyToken, quoteLimiter, createQuotation);

// Admin
router.get("/admin/config", verifyToken, allowRoles("admin"), getAdminConfig);
router.put("/admin/config", verifyToken, allowRoles("admin"), saveAdminConfig);
router.get("/admin/quotes", verifyToken, allowRoles("admin"), listAdminQuotes);
router.get("/admin/quotes/:id", verifyToken, allowRoles("admin"), getAdminQuote);
router.patch("/admin/quotes/:id", verifyToken, allowRoles("admin"), updateAdminQuote);
router.delete("/admin/quotes/:id", verifyToken, allowRoles("admin"), deleteAdminQuote);

export default router;
