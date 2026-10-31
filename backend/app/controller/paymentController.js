import handleResponse from "../utils/helper.js";
import {
  createPaymentOrderForOrderRef,
  verifyPaymentGatewayStatus,
  processGatewayWebhook,
} from "../services/paymentService.js";
import {
  createPaymentOrderSchema,
  verifyPaymentClientSchema,
  validateSchema,
} from "../validation/paymentValidation.js";
import logger from "../services/logger.js";
import { getErrorStatus } from "../utils/httpError.js";

function resolvePaymentErrorMessage(error) {
  const directMessage = String(error?.message || "").trim();
  if (directMessage) return directMessage;

  const responseStatusText = String(error?.response?.statusText || "").trim();
  if (responseStatusText) return `Payment gateway error: ${responseStatusText}`;

  const causeCode = String(error?.cause?.code || error?.code || "").trim();
  if (causeCode) return `Payment gateway request failed (${causeCode})`;

  return "Unable to initiate payment with the gateway right now";
}

export const createPaymentOrder = async (req, res) => {
  try {
    const payload = validateSchema(createPaymentOrderSchema, req.body || {});
    const result = await createPaymentOrderForOrderRef({
      orderRef: payload.orderRef || payload.orderId,
      userId: req.user?.id,
      idempotencyKey: req.headers["idempotency-key"] || null,
      correlationId: req.correlationId || null,
    });

    return handleResponse(
      res,
      result.duplicate ? 200 : 201,
      result.duplicate ? "Re-using existing payment" : "Payment initiated",
      {
        payment: result.payment,
        redirectUrl: result.redirectUrl,
        merchantOrderId: result.payment.gatewayOrderId,
      },
    );
  } catch (error) {
    logger.error("createPaymentOrder failed", {
      scope: "PaymentController.createPaymentOrder",
      message: error?.message,
      statusCode: error?.statusCode || error?.status || 500,
      code: error?.code || error?.cause?.code || null,
      responseStatus: error?.response?.status || null,
      responseStatusText: error?.response?.statusText || null,
      orderRef: req.body?.orderRef || req.body?.orderId || null,
      userId: req.user?.id || null,
      correlationId: req.correlationId || null,
    });
    return handleResponse(
      res,
      error.statusCode || error.status || 500,
      resolvePaymentErrorMessage(error),
    );
  }
};

export const verifyPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const merchantOrderId = id || req.query.merchantOrderId;
    
    if (!merchantOrderId) {
        return handleResponse(res, 400, "merchantOrderId is required");
    }

    const verification = await verifyPaymentGatewayStatus({
      merchantOrderId,
      userId: req.user?.id,
      correlationId: req.correlationId || null,
    });

    return handleResponse(res, 200, "Payment status verified", {
      status: verification.status,
      payment: verification.payment,
    });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const authorization = req.headers["x-razorpay-signature"];
    const rawBody = req.body;

    if (!authorization) {
        logger.warn("Razorpay webhook missing signature header", {
          scope: "PaymentController.handleRazorpayWebhook",
          correlationId: req.correlationId || null,
          ip: req.ip,
        });
        return handleResponse(res, 401, "Missing webhook signature");
    }

    const result = await processGatewayWebhook({
      rawBody,
      authorization,
      correlationId: req.correlationId || null,
    });

    if (result.accepted) {
      return handleResponse(res, 200, "Webhook accepted");
    }

    return handleResponse(res, 400, "Webhook rejected");
  } catch (error) {
    logger.error("Razorpay webhook processing failed", {
      scope: "PaymentController.handleRazorpayWebhook",
      correlationId: req.correlationId || null,
      message: error?.message,
      error,
    });
    // A 5xx makes Razorpay retry; the message stays generic on purpose.
    return error?.statusCode === 401
      ? handleResponse(res, 401, "Invalid webhook signature")
      : handleResponse(res, 500, "Webhook processing failed");
  }
};

export const getPaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const merchantOrderId = id;
    
        const verification = await verifyPaymentGatewayStatus({
          merchantOrderId,
          userId: req.user?.id,
          correlationId: req.correlationId || null,
        });
    
        return handleResponse(res, 200, "Payment status retrieved", {
          status: verification.status,
          merchantOrderId: verification.payment.gatewayOrderId,
          amount: verification.payment.amount,
          currency: verification.payment.currency,
        });
      } catch (error) {
        return handleResponse(res, getErrorStatus(error), error.message);
      }
};
