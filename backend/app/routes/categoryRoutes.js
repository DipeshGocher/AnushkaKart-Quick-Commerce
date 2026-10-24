import express from "express";
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
} from "../controller/categoryController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

// Cache control: Admin routes must NEVER be cached by browser/proxies.
// Public routes use short freshness with revalidation so admin edits reflect immediately.
const cacheControlMiddleware = (req, res, next) => {
  const isAdmin = Boolean(
    req.baseUrl?.includes("/admin") ||
    req.originalUrl?.includes("/admin") ||
    req.headers["x-admin-request"]
  );

  if (isAdmin) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
  } else {
    res.set("Cache-Control", "public, max-age=15, stale-while-revalidate=30");
  }
  next();
};

router.get("/", cacheControlMiddleware, getCategories);

// Admin only routes
router.post(
    "/",
    verifyToken,
    allowRoles("admin"),
    upload.single("image"),
    createCategory
);

router.put(
    "/:id",
    verifyToken,
    allowRoles("admin"),
    upload.single("image"),
    updateCategory
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles("admin"),
    deleteCategory
);

export default router;
