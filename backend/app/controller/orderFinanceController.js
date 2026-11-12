import Order from "../models/order.js";
import handleResponse from "../utils/helper.js";
import {
  checkoutPreviewSchema,
  codMarkCollectedSchema,
  codReconcileSchema,
  createFinanceOrderSchema,
  deliveredSchema,
  verifyOnlinePaymentSchema,
} from "../validation/financeValidation.js";
import {
  handleCodOrderFinance,
  handleOnlineOrderFinance,
  reconcileCodCash,
  settleDeliveredOrder,
} from "../services/finance/orderFinanceService.js";
import { placeOrderAtomic } from "../services/orderPlacementService.js";
import { orderMatchQueryFromRouteParam, orderMatchQueryFlexible } from "../utils/orderLookup.js";
import { verifyClientPaymentCallback } from "../services/paymentService.js";
import { buildCheckoutPricingSnapshot } from "../services/checkoutPricingService.js";
import { afterPlaceOrderV2 } from "../services/orderWorkflowService.js";
import { DEFAULT_SELLER_TIMEOUT_MS, WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import logger from "../services/logger.js";
import { validateBody as validateWithJoi } from "../middleware/validate.js";
import { getErrorStatus } from "../utils/httpError.js";
import { expiryAfterUtrSubmitted, expiryWaitingForUtr } from "../utils/upiApprovalPolicy.js";

export const previewCheckoutFinance = async (req, res) => {
  try {
    const payload = validateWithJoi(checkoutPreviewSchema, req.body || {});
    const pricingSnapshot = await buildCheckoutPricingSnapshot({
      orderItems: payload.items,
      address: payload.address,
      tipAmount: 0,
      discountTotal: payload.discountTotal || 0,
      // Audit Phase 4 (C-1): forward walletAmount so the preview's
      // aggregate breakdown exposes a `payableAmount` (post-wallet) the
      // frontend can render directly. No-op when client sends 0 or omits.
      walletAmount: payload.walletAmount || 0,
      // Audit Phase 5 (C-2 + H-6): forward couponCode/couponId so the
      // preview returns the server-validated discount (and `freeDelivery`
      // rebate) without trusting any client-supplied `discountTotal`.
      // The `customerId` is read from auth so per-user limits are
      // enforced consistently between preview and place-order — and
      // the preview can refuse a coupon the user has already exhausted.
      couponCode: payload.couponCode || null,
      couponId: payload.couponId || null,
      customerId: req.user?.id || null,
    });

    const sellerBreakdowns = pricingSnapshot.sellerBreakdownEntries.map((entry) => ({
      sellerId: entry.sellerId,
      distanceKm: entry.distanceKm,
      breakdown: entry.breakdown,
    }));

    const distanceDebug = String(process.env.FINANCE_DEBUG_DISTANCE || "").toLowerCase() === "true"
      ? sellerBreakdowns.map((item) => ({
          sellerId: item.sellerId,
          distanceKmDerived: item.distanceKm,
        }))
      : undefined;

    return handleResponse(res, 200, "Checkout preview generated", {
      paymentMode: payload.paymentMode,
      breakdown: pricingSnapshot.aggregateBreakdown,
      sellerCount: pricingSnapshot.sellerCount,
      itemCount: pricingSnapshot.itemCount,
      sellerBreakdowns,
      fulfillmentType: pricingSnapshot.fulfillmentType,
      deliveryEstimate: pricingSnapshot.deliveryEstimate,
      isLocal: pricingSnapshot.isLocal,
      isSplitDelivery: pricingSnapshot.isSplitDelivery,
      splitDetails: pricingSnapshot.splitDetails,
      localDeliveryEstimate: pricingSnapshot.localDeliveryEstimate,
      shiprocketDeliveryEstimate: pricingSnapshot.shiprocketDeliveryEstimate,
      // Audit Phase 5: expose the resolved coupon snapshot so the
      // frontend can render "Coupon CODE applied — ₹X off" without
      // running its own math. `null` when no coupon was supplied or
      // SERVER_SIDE_COUPON_ENGINE is off.
      couponSnapshot: pricingSnapshot.couponSnapshot || null,
      freeDeliveryApplied: !!pricingSnapshot.freeDeliveryApplied,
      ...(distanceDebug ? { distanceDebug } : {}),
    });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const createOrderWithFinancialSnapshot = async (req, res) => {
  try {
    const customerId = req.user?.id;
    if (!customerId) {
      return handleResponse(res, 401, "Unauthorized");
    }

    const validated = validateWithJoi(createFinanceOrderSchema, req.body || {});
    const payload = {
      items: validated.items,
      address: validated.address,
      paymentMode: validated.paymentMode,
      timeSlot: validated.timeSlot || "now",
      tipAmount: 0,
      walletAmount: validated.walletAmount || 0,
      couponId: validated.couponId || null,
      // Audit Phase 5 (C-2 + H-7): forward couponCode so the placement
      // service can re-validate end-to-end. We deliberately DO NOT
      // forward `discountTotal`, `taxTotal`, or `pricing` from the
      // client — the controller has stripped those since Phase 4 to
      // prevent client-pricing tampering, and the new server-side
      // coupon engine fills the discount in via `couponCode`/`couponId`
      // instead.
      couponCode: validated.couponCode || null,
      utrNumber: validated.paymentMode === "UPI_QR" ? validated.utrNumber || null : null,
    };
    const idempotencyKey = String(req.headers["idempotency-key"] || "").trim() || null;

    const placement = await placeOrderAtomic({
      customerId,
      payload,
      idempotencyKey,
    });

    return handleResponse(
      res,
      placement.duplicate ? 200 : 201,
      placement.duplicate
        ? "Duplicate request resolved using existing order"
        : "Order created with financial snapshot",
      {
        order: placement.order,
        orders: placement.orders,
        checkoutGroup: placement.checkoutGroup,
        paymentRef:
          (Array.isArray(placement.orders) && placement.orders.length > 1
            ? placement.checkoutGroup?.checkoutGroupId
            : placement.order?.orderId) ||
          placement.checkoutGroup?.checkoutGroupId ||
          null,
      },
    );
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const verifyOnlineOrderPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = validateWithJoi(verifyOnlinePaymentSchema, req.body || {});
    const verification = await verifyClientPaymentCallback({
      orderRef: id,
      userId: req.user?.id,
      gatewayOrderId: payload.merchantOrderId,
      gatewayPaymentId: payload.transactionId || null,
      razorpayOrderId: payload.razorpayOrderId,
      gatewaySignature: payload.signature,
      correlationId: req.correlationId || null,
    });

    return handleResponse(res, 200, "Online payment verification processed", {
      paymentStatus: verification.status,
      publicOrderId: verification.payment.publicOrderId,
      merchantOrderId: verification.payment.gatewayOrderId,
      transactionId: verification.payment.gatewayPaymentId,
    });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const markCodCollectedAfterDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = validateWithJoi(codMarkCollectedSchema, req.body || {});
    const orderKey = orderMatchQueryFromRouteParam(id);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }
    const order = await Order.findOne(orderKey)
      .select("_id deliveryBoy seller status orderStatus paymentMode financeFlags")
      .lean();
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    if (order.paymentMode === "ONLINE") {
      return handleResponse(res, 400, "COD collection is only allowed for COD orders");
    }

    const isDelivered =
      order.status === "delivered" || order.orderStatus === "delivered";
    if (!isDelivered) {
      return handleResponse(res, 400, "COD collection is allowed only after delivery");
    }

    if (
      req.user?.role === "delivery" &&
      order.deliveryBoy &&
      String(order.deliveryBoy) !== String(req.user.id)
    ) {
      return handleResponse(res, 403, "Only assigned delivery partner can mark COD collection");
    }

    const deliveryPartnerId =
      payload.deliveryPartnerId ||
      order.deliveryBoy ||
      (req.user?.role === "delivery" ? req.user.id : null);

    if (order.financeFlags?.codMarkedCollected) {
      // Return the full order so retries get the same shape as the first call.
      const current = await Order.findById(order._id).lean();
      return handleResponse(res, 200, "COD amount already marked as collected", current);
    }

    const updated = await handleCodOrderFinance(order._id, {
      amount: payload.amount,
      deliveryPartnerId,
      actorId: req.user?.id || null,
    });

    return handleResponse(res, 200, "COD amount marked as collected", updated);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const markOrderDeliveredAndSettle = async (req, res) => {
  try {
    const { id } = req.params;
    validateWithJoi(deliveredSchema, req.body || {});
    const orderKey = orderMatchQueryFromRouteParam(id);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }
    const order = await Order.findOne(orderKey).select("_id deliveryBoy seller").lean();
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    if (
      req.user?.role === "delivery" &&
      order.deliveryBoy &&
      String(order.deliveryBoy) !== String(req.user.id)
    ) {
      return handleResponse(res, 403, "Only assigned delivery partner can mark this order delivered");
    }
    if (
      req.user?.role === "seller" &&
      order.seller &&
      String(order.seller) !== String(req.user.id)
    ) {
      return handleResponse(res, 403, "Only order seller can mark this order delivered");
    }

    const updated = await settleDeliveredOrder(order._id, {
      actorId: req.user?.id || null,
    });

    // For COD orders, "delivery" implies cash is collected by the assigned delivery partner.
    // This updates System Float (COD) as: grandTotal - riderPayoutTotal.
    if (
      updated?.paymentMode === "COD" &&
      updated?.deliveryBoy &&
      !updated?.financeFlags?.codMarkedCollected
    ) {
      const deliveryPartnerId = updated.deliveryBoy;
      const updatedWithCod = await handleCodOrderFinance(updated._id, {
        deliveryPartnerId,
        actorId: req.user?.id || null,
      });
      return handleResponse(res, 200, "Order delivered and COD cash collected", updatedWithCod);
    }

    return handleResponse(res, 200, "Order delivered and settlement queued", updated);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const reconcileCodCashSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = validateWithJoi(codReconcileSchema, req.body || {});
    const orderKey = orderMatchQueryFromRouteParam(id);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }
    const order = await Order.findOne(orderKey).select("_id deliveryBoy").lean();
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    if (
      req.user?.role === "delivery" &&
      order.deliveryBoy &&
      String(order.deliveryBoy) !== String(req.user.id)
    ) {
      return handleResponse(res, 403, "Only assigned delivery partner can reconcile COD cash");
    }

    const deliveryPartnerId =
      payload.deliveryPartnerId ||
      order.deliveryBoy ||
      (req.user?.role === "delivery" ? req.user.id : null);

    const updated = await reconcileCodCash(
      order._id,
      payload.amount,
      deliveryPartnerId,
      {
        actorId: req.user?.id || null,
        metadata: payload.metadata || {},
      },
    );

    return handleResponse(res, 200, "COD cash reconciled successfully", updated);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const submitOrderUtr = async (req, res) => {
  try {
    const { id } = req.params;
    const utrRaw = String(req.body?.utrNumber || "").trim();
    if (!/^\d{12}$/.test(utrRaw)) {
      return handleResponse(res, 400, "Please enter a valid 12-digit numeric UTR / Reference number");
    }

    const orderKey = orderMatchQueryFlexible(id) || orderMatchQueryFromRouteParam(id);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne(orderKey);
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    // Customer security check: user can only submit UTR for their own order (unless admin)
    if (req.user?.role !== "admin" && String(order.customer) !== String(req.user?.id)) {
      return handleResponse(res, 403, "Access denied. You can only submit payment for your own orders.");
    }

    // An order that was auto-cancelled (payment not verified in time) or already paid cannot take a UTR.
    if (order.status === "cancelled" || order.workflowStatus === WORKFLOW_STATUS.CANCELLED) {
      return handleResponse(
        res,
        400,
        "This order was cancelled because the payment was not verified in time. Please contact support if you have already paid.",
      );
    }
    if (order.paymentStatus === "PAID") {
      return handleResponse(res, 400, "Payment for this order is already verified.");
    }

    // Duplicate UTR check across orders (excluding this order and sibling orders in same checkout)
    const duplicateQuery = {
      _id: { $ne: order._id },
      utrNumber: utrRaw,
      paymentStatus: { $in: ["PAID", "AWAITING_VERIFICATION"] },
    };
    if (order.checkoutGroupId) {
      duplicateQuery.checkoutGroupId = { $ne: order.checkoutGroupId };
    }

    const duplicateOrder = await Order.findOne(duplicateQuery).select("orderId").lean();

    if (duplicateOrder) {
      return handleResponse(
        res,
        400,
        `This UTR (${utrRaw}) has already been submitted for another order. Please check your bank transaction details.`,
      );
    }

    const now = new Date();
    const approvalDeadline = expiryAfterUtrSubmitted(now);
    // Single conditional write: if the auto-cancel sweep cancelled the order a moment ago, this
    // matches nothing and the customer is told, instead of resurrecting a cancelled order's payment.
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: { $ne: "cancelled" },
        workflowStatus: { $ne: WORKFLOW_STATUS.CANCELLED },
        paymentStatus: { $in: ["AWAITING_VERIFICATION", "CREATED", "REJECTED"] },
      },
      {
        $set: {
          utrNumber: utrRaw,
          utrSubmittedAt: now,
          upiApprovalExpiresAt: approvalDeadline,
          paymentStatus: "AWAITING_VERIFICATION",
          paymentRejectedReason: null,
          "payment.method": "upi_qr",
          "payment.status": "pending",
          "payment.transactionId": utrRaw,
        },
      },
      { new: true },
    );
    if (!updatedOrder) {
      return handleResponse(
        res,
        409,
        "This order can no longer accept a payment reference (it was cancelled or already verified). Please refresh.",
      );
    }

    // If multi-seller order, sync sibling orders in the same checkout group
    if (order.checkoutGroupId) {
      await Order.updateMany(
        {
          checkoutGroupId: order.checkoutGroupId,
          _id: { $ne: order._id },
          status: { $ne: "cancelled" },
          paymentStatus: { $ne: "PAID" },
        },
        {
          $set: {
            utrNumber: utrRaw,
            utrSubmittedAt: now,
            upiApprovalExpiresAt: approvalDeadline,
            paymentStatus: "AWAITING_VERIFICATION",
            paymentRejectedReason: null,
            "payment.method": "upi_qr",
            "payment.status": "pending",
            "payment.transactionId": utrRaw,
          },
        },
      );
    }

    return handleResponse(res, 200, "UTR submitted successfully. Awaiting admin verification.", {
      orderId: updatedOrder.orderId,
      utrNumber: updatedOrder.utrNumber,
      paymentStatus: updatedOrder.paymentStatus,
      utrSubmittedAt: updatedOrder.utrSubmittedAt,
      upiApprovalExpiresAt: updatedOrder.upiApprovalExpiresAt,
    });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const approveUpiPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const orderKey = orderMatchQueryFlexible(id) || orderMatchQueryFromRouteParam(id);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne(orderKey);
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    if (order.status === "cancelled" || order.workflowStatus === WORKFLOW_STATUS.CANCELLED) {
      return handleResponse(res, 400, "Cannot approve payment for a cancelled order");
    }

    const utrToUse = String(req.body?.utrNumber || order.utrNumber || "").trim();

    // Find all orders that need approval (this order + siblings if checkoutGroupId exists)
    const ordersToApprove = order.checkoutGroupId
      ? await Order.find({ checkoutGroupId: order.checkoutGroupId })
      : [order];

    const now = new Date();
    const sellerTimeoutMs = DEFAULT_SELLER_TIMEOUT_MS();
    const sellerPendingUntil = new Date(now.getTime() + sellerTimeoutMs);

    let primaryCancelled = false;
    for (const ord of ordersToApprove) {
      // A sibling that was auto-cancelled must not be revived by approving the rest.
      if (ord.status === "cancelled" || ord.workflowStatus === WORKFLOW_STATUS.CANCELLED) {
        if (String(ord._id) === String(order._id)) primaryCancelled = true;
        continue;
      }
      if (ord.paymentStatus !== "PAID") {
        // 0. Lock the order against the auto-cancel sweep BEFORE any money moves. The sweep only
        //    claims orders whose deadline has passed, so clearing it (only if the order is still
        //    alive) means either we win, or the sweep already won and we stop here.
        const previousDeadline = ord.upiApprovalExpiresAt || null;
        const locked = await Order.updateOne(
          {
            _id: ord._id,
            status: { $ne: "cancelled" },
            workflowStatus: { $ne: WORKFLOW_STATUS.CANCELLED },
          },
          { $set: { upiApprovalExpiresAt: null } },
        );
        if (!locked.matchedCount) {
          if (String(ord._id) === String(order._id)) primaryCancelled = true;
          continue;
        }

        try {
        // 1. Process finance split and wallet capture
        await handleOnlineOrderFinance(ord._id, {
          actorId: req.user?.id || null,
          transactionId: utrToUse,
          metadata: {
            paymentType: "UPI_QR",
            approvedByAdmin: true,
            adminId: req.user?.id || null,
            utrNumber: utrToUse,
          },
        });

        // 2. Advance Order workflow
        ord.paymentMode = "UPI_QR";
        ord.paymentStatus = "PAID";
        ord.status = "confirmed";
        ord.orderStatus = "confirmed";
        ord.workflowStatus = WORKFLOW_STATUS.SELLER_PENDING;
        ord.sellerPendingExpiresAt = sellerPendingUntil;
        ord.expiresAt = sellerPendingUntil;
        if (utrToUse) {
          ord.utrNumber = utrToUse;
          ord.payment = {
            ...(ord.payment || {}),
            method: "upi_qr",
            status: "completed",
            transactionId: utrToUse,
          };
        }
        ord.paymentRejectedReason = null;
        ord.upiApprovalExpiresAt = null; // verified: nothing left to expire
        ord.upiApprovedAt = now;

        await ord.save();
        } catch (approveError) {
          // Approval did not complete: put the deadline back so the order is not stuck forever.
          await Order.updateOne(
            { _id: ord._id, paymentStatus: { $ne: "PAID" } },
            { $set: { upiApprovalExpiresAt: previousDeadline } },
          ).catch(() => {});
          throw approveError;
        }

        // 3. Trigger seller assignment / notification workflow
        void afterPlaceOrderV2(ord).catch((err) => {
          logger.warn("afterPlaceOrderV2 failed after UPI approval", {
            scope: "approveUpiPayment",
            orderId: ord.orderId,
            error: err.message,
          });
        });
      }
    }

    if (primaryCancelled) {
      return handleResponse(
        res,
        400,
        "Cannot approve payment for a cancelled order (it was auto-cancelled because the payment was not verified in time)",
      );
    }

    return handleResponse(res, 200, "UPI payment verified and order confirmed successfully", {
      orderId: order.orderId,
      paymentStatus: "PAID",
      status: "confirmed",
      workflowStatus: WORKFLOW_STATUS.SELLER_PENDING,
      utrNumber: utrToUse,
    });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const rejectUpiPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const orderKey = orderMatchQueryFlexible(id) || orderMatchQueryFromRouteParam(id);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne(orderKey);
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    const rejectedReason = String(reason || "Payment could not be verified in bank records").trim();

    if (order.status === "cancelled" || order.workflowStatus === WORKFLOW_STATUS.CANCELLED) {
      return handleResponse(res, 400, "This order is already cancelled");
    }
    if (order.paymentStatus === "PAID") {
      return handleResponse(res, 400, "Payment is already verified for this order");
    }

    // The customer gets a fresh window to send a correct UTR, then the order expires.
    const resubmitDeadline = expiryWaitingForUtr();
    const rejectedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: { $ne: "cancelled" },
        workflowStatus: { $ne: WORKFLOW_STATUS.CANCELLED },
        paymentStatus: { $ne: "PAID" },
      },
      {
        $set: {
          paymentStatus: "REJECTED",
          paymentRejectedReason: rejectedReason,
          upiApprovalExpiresAt: resubmitDeadline,
          "payment.status": "failed",
        },
      },
      { new: true },
    );
    if (!rejectedOrder) {
      return handleResponse(res, 409, "This order was cancelled or verified in the meantime. Please refresh.");
    }

    if (order.checkoutGroupId) {
      await Order.updateMany(
        {
          checkoutGroupId: order.checkoutGroupId,
          _id: { $ne: order._id },
          status: { $ne: "cancelled" },
          paymentStatus: { $ne: "PAID" },
        },
        {
          $set: {
            paymentStatus: "REJECTED",
            paymentRejectedReason: rejectedReason,
            upiApprovalExpiresAt: resubmitDeadline,
            "payment.status": "failed",
          },
        },
      );
    }

    return handleResponse(res, 200, "UPI payment marked as rejected", {
      orderId: rejectedOrder.orderId,
      paymentStatus: rejectedOrder.paymentStatus,
      paymentRejectedReason: rejectedOrder.paymentRejectedReason,
    });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};
