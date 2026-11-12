import express from "express";
import {
    getProducts,
    getHeaderProducts,
    getSellerProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    bulkDeleteProducts,
    getProductById,
    getModerationProducts,
    approveProduct,
    rejectProduct,
} from "../controller/productController.js";
import { adjustStock, getStockHistory } from "../controller/stockController.js";
import {
    verifyToken,
    allowRoles,
    optionalVerifyToken,
    requireApprovedSeller,
} from "../middleware/authMiddleware.js";
import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

// Public routes with optional auth (to detect admin/seller vs customer)
router.get("/", optionalVerifyToken, getProducts);
router.get("/header-products", optionalVerifyToken, getHeaderProducts);

// Seller protected routes
router.get("/seller/me", verifyToken, allowRoles("seller"), requireApprovedSeller, getSellerProducts);
router.get("/stock-history", verifyToken, allowRoles("seller"), requireApprovedSeller, getStockHistory);
router.post("/adjust-stock", verifyToken, allowRoles("seller"), requireApprovedSeller, adjustStock);
router.get("/moderation", verifyToken, allowRoles("admin"), getModerationProducts);
router.patch("/moderation/:id/approve", verifyToken, allowRoles("admin"), approveProduct);
router.patch("/moderation/:id/reject", verifyToken, allowRoles("admin"), rejectProduct);
router.get("/:id", optionalVerifyToken, getProductById);

router.post(
    "/",
    verifyToken,
    allowRoles("seller", "admin"),
    requireApprovedSeller,
    upload.any(),
    createProduct
);

router.put(
    "/:id",
    verifyToken,
    allowRoles("seller", "admin"),
    requireApprovedSeller,
    upload.any(),
    updateProduct
);

// Bulk delete products (safe delete)
router.post(
    "/bulk-delete",
    verifyToken,
    allowRoles("seller", "admin"),
    requireApprovedSeller,
    bulkDeleteProducts
);
router.delete(
    "/bulk",
    verifyToken,
    allowRoles("seller", "admin"),
    requireApprovedSeller,
    bulkDeleteProducts
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles("seller", "admin"),
    requireApprovedSeller,
    deleteProduct
);

export default router;
