import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  checkPincodeServiceability,
  validateCartDelivery,
  getPublicLocalPincodes,
  getPincodes,
  createPincode,
  updatePincode,
  deletePincode,
  togglePincode,
  processShiprocket,
  scheduleShiprocketPickup,
  fetchShiprocketLabel,
  updateShiprocketStatusManual,
  shiprocketWebhookHandler,
  getShiprocketStatus,
  recordDiscrepancy,
  scheduleShiprocketReversePickupHandler,
  fetchShiprocketReverseLabel,
  updateShiprocketReverseStatusManual,
} from "../controller/shippingController.js";

const router = express.Router();

/* Public serviceability check */
router.get("/check-serviceability", checkPincodeServiceability);
router.get("/local-pincodes", getPublicLocalPincodes);
router.post("/validate-cart", validateCartDelivery);

/* Public webhook endpoint for Shiprocket callbacks */
router.post("/webhook/shiprocket", shiprocketWebhookHandler);
router.post("/webhook/courier", shiprocketWebhookHandler);

/* Shiprocket status check */
router.get("/shiprocket/status", verifyToken, allowRoles("admin"), getShiprocketStatus);

/* Admin: Local delivery pincodes CRUD */
router.get("/pincodes", verifyToken, allowRoles("admin"), getPincodes);
router.post("/pincodes", verifyToken, allowRoles("admin"), createPincode);
router.put("/pincodes/:id", verifyToken, allowRoles("admin"), updatePincode);
router.delete("/pincodes/:id", verifyToken, allowRoles("admin"), deletePincode);
router.patch("/pincodes/:id/toggle", verifyToken, allowRoles("admin"), togglePincode);

/* Shiprocket Fulfillment operations (Admin & Seller / Warehouse) */
router.post("/shiprocket/process/:orderId", verifyToken, allowRoles("admin", "seller", "warehouse"), processShiprocket);
router.post("/shiprocket/pickup/:orderId", verifyToken, allowRoles("admin", "seller", "warehouse"), scheduleShiprocketPickup);
router.get("/shiprocket/label/:orderId", verifyToken, allowRoles("admin", "seller", "warehouse"), fetchShiprocketLabel);
router.post("/shiprocket/manual-status/:orderId", verifyToken, allowRoles("admin"), updateShiprocketStatusManual);
router.post("/shiprocket/discrepancy/:orderId", verifyToken, allowRoles("admin"), recordDiscrepancy);

/* Shiprocket Reverse Courier Operations (Admin & Seller / Warehouse) */
router.post("/shiprocket/reverse/pickup/:orderId", verifyToken, allowRoles("admin", "seller", "warehouse"), scheduleShiprocketReversePickupHandler);
router.post("/shiprocket/reverse/manual-status/:orderId", verifyToken, allowRoles("admin", "seller", "warehouse"), updateShiprocketReverseStatusManual);
router.get("/shiprocket/reverse/label/:orderId", verifyToken, allowRoles("admin", "seller", "warehouse"), fetchShiprocketReverseLabel);

export default router;
