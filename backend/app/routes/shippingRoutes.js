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
} from "../controller/shippingController.js";

const router = express.Router();

/* Public serviceability check */
router.get("/check-serviceability", checkPincodeServiceability);
router.get("/local-pincodes", getPublicLocalPincodes);
router.post("/validate-cart", validateCartDelivery);

/* Public webhook endpoint for Shiprocket callbacks */
router.post("/webhook/shiprocket", shiprocketWebhookHandler);

/* Shiprocket status check */
router.get("/shiprocket/status", verifyToken, allowRoles("admin"), getShiprocketStatus);

/* Admin: Local delivery pincodes CRUD */
router.get("/pincodes", verifyToken, allowRoles("admin"), getPincodes);
router.post("/pincodes", verifyToken, allowRoles("admin"), createPincode);
router.put("/pincodes/:id", verifyToken, allowRoles("admin"), updatePincode);
router.delete("/pincodes/:id", verifyToken, allowRoles("admin"), deletePincode);
router.patch("/pincodes/:id/toggle", verifyToken, allowRoles("admin"), togglePincode);

/* Admin: Shiprocket Fulfillment operations */
router.post("/shiprocket/process/:orderId", verifyToken, allowRoles("admin"), processShiprocket);
router.post("/shiprocket/pickup/:orderId", verifyToken, allowRoles("admin"), scheduleShiprocketPickup);
router.get("/shiprocket/label/:orderId", verifyToken, allowRoles("admin"), fetchShiprocketLabel);
router.post("/shiprocket/manual-status/:orderId", verifyToken, allowRoles("admin"), updateShiprocketStatusManual);

export default router;
