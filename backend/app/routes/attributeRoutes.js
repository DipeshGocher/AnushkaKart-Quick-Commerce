import express from "express";
import {
  getAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  getCategoryAttributes,
} from "../controller/attributeController.js";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public / Seller / Admin can read attributes
router.get("/", getAttributes);
router.get("/category/:categoryId", getCategoryAttributes);

// Admin only management
router.post("/", verifyToken, allowRoles("admin"), createAttribute);
router.put("/:id", verifyToken, allowRoles("admin"), updateAttribute);
router.delete("/:id", verifyToken, allowRoles("admin"), deleteAttribute);

export default router;
