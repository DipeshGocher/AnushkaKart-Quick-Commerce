import express from "express";
import multer from "multer";
import {
  uploadBannerImage,
  getPublicHeroConfig,
  getAdminHeroConfig,
  upsertHeroConfig,
} from "../controller/experienceController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Admin hero config (Used by Hero & Page Banners) - MUST be defined before /admin/experience/:id
router.get(
  "/admin/experience/hero",
  verifyToken,
  allowRoles("admin"),
  getAdminHeroConfig
);
router.put(
  "/admin/experience/hero",
  verifyToken,
  allowRoles("admin"),
  upsertHeroConfig
);

router.post(
  "/admin/experience/upload-banner",
  verifyToken,
  allowRoles("admin"),
  upload.single("image"),
  uploadBannerImage
);

// Legacy Experience Studio endpoints - Return empty success to maintain safety
router.get("/admin/experience", verifyToken, allowRoles("admin"), (req, res) => {
  res.json({ success: true, results: [], result: [] });
});
router.post("/admin/experience", verifyToken, allowRoles("admin"), (req, res) => {
  res.json({ success: true, message: "Experience sections deprecated" });
});
router.put("/admin/experience/reorder", verifyToken, allowRoles("admin"), (req, res) => {
  res.json({ success: true, message: "Experience sections deprecated" });
});
router.put("/admin/experience/:id", verifyToken, allowRoles("admin"), (req, res) => {
  res.json({ success: true, message: "Experience sections deprecated" });
});
router.delete("/admin/experience/:id", verifyToken, allowRoles("admin"), (req, res) => {
  res.json({ success: true, message: "Experience section deleted" });
});

// Fast, responsive headers for public experience data (no stale browser caching)
const instantPublicHeader = (req, res, next) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
};

router.get("/experience", instantPublicHeader, (req, res) => {
  res.json({ success: true, results: [], result: [] });
});
router.get("/experience/hero", instantPublicHeader, getPublicHeroConfig);

export default router;
