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

// Public route to get categories with fast browser/edge caching and stale-while-revalidate
const publicCacheHeader = (maxAge = 60, swr = 300) => (req, res, next) => {
  res.set("Cache-Control", `public, max-age=${maxAge}, stale-while-revalidate=${swr}`);
  next();
};

router.get("/", publicCacheHeader(60, 300), getCategories);

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
