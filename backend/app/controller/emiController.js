import handleResponse from "../utils/helper.js";
import { getErrorStatus } from "../utils/httpError.js";
import * as emi from "../services/finance/emiService.js";

/* ───────── public (customer) ───────── */

/** GET /emi/enabled-headers  -> which header categories show the finance button */
export const getEnabledHeaders = async (req, res) => {
  try {
    return handleResponse(res, 200, "OK", await emi.listEnabledHeaders());
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

/** GET /emi/product/:productId?variant=...  -> is finance offered here, and the product details to auto-fill. */
export const getProductFinanceInfo = async (req, res) => {
  try {
    const config = await emi.getConfig();
    const info = await emi.loadFinanceProduct(req.params.productId, req.query.variant, config);
    return handleResponse(res, 200, "OK", {
      available: info.available,
      reason: info.reason,
      config: emi.publicConfig(config),
      product: {
        id: String(info.product._id),
        name: info.product.name,
        variantName: info.variant?.name || "",
        variantSku: info.variant?.sku || "",
        price: info.price,
        image: (info.variant?.images && info.variant.images[0]) || info.product.mainImage || "",
      },
    });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

/** POST /emi/calculate */
export const calculate = async (req, res) => {
  try {
    const { productId, variantSku, downPayment, months } = req.body || {};
    const { result } = await emi.calculateForProduct({ productId, variantSku, downPayment, months });
    return handleResponse(res, 200, "OK", result);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

/** POST /emi/quotes  -> saves the quotation, returns the WhatsApp link + data for the PDF */
export const createQuotation = async (req, res) => {
  try {
    const body = req.body || {};
    const created = await emi.createQuote({
      productId: body.productId,
      variantSku: body.variantSku,
      downPayment: body.downPayment,
      months: body.months,
      customer: body.customer,
      imei1: body.imei1,
      imei2: body.imei2,
      userId: req.user?.role === "user" || req.user?.role === "customer" ? req.user.id : null,
    });
    return handleResponse(res, 201, "Quotation created", created);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

/* ───────── admin ───────── */

export const getAdminConfig = async (req, res) => {
  try {
    const config = await emi.getConfig();
    return handleResponse(res, 200, "OK", config);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const saveAdminConfig = async (req, res) => {
  try {
    const config = await emi.saveConfig(req.body || {});
    return handleResponse(res, 200, "Finance settings saved", config);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const listAdminQuotes = async (req, res) => {
  try {
    const result = await emi.listQuotes({
      status: req.query.status,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });
    return handleResponse(res, 200, "OK", result);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const getAdminQuote = async (req, res) => {
  try {
    const reveal = String(req.query.reveal || "") === "true";
    const quote = await emi.getQuote(req.params.id, { reveal });
    return handleResponse(res, 200, "OK", quote);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const deleteAdminQuote = async (req, res) => {
  try {
    const removed = await emi.deleteQuote(req.params.id);
    return handleResponse(res, 200, "Quotation deleted", removed);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const updateAdminQuote = async (req, res) => {
  try {
    const updated = await emi.updateQuote(req.params.id, {
      status: req.body?.status,
      adminNote: req.body?.adminNote,
    });
    return handleResponse(res, 200, "Updated", updated);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};
