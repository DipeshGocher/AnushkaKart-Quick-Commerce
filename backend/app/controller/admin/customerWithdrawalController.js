import handleResponse from "../../utils/helper.js";
import { getErrorStatus } from "../../utils/httpError.js";
import {
  listWithdrawals,
  markPaid,
  rejectWithdrawal,
} from "../../services/finance/customerWithdrawalService.js";

/** GET /admin/customer-withdrawals?status=pending|paid|rejected|all&search=&page=&limit= */
export const getCustomerWithdrawals = async (req, res) => {
  try {
    const { status, search, page, limit } = req.query || {};
    return handleResponse(res, 200, "Customer withdrawals fetched", await listWithdrawals({ status, search, page, limit }));
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

/** PUT /admin/customer-withdrawals/:id/pay  { reference } - the money was sent from the admin's bank. */
export const payCustomerWithdrawal = async (req, res) => {
  try {
    const result = await markPaid(req.params.id, { adminId: req.user?.id, reference: req.body?.reference });
    return handleResponse(res, 200, "Marked as paid", result);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

/** PUT /admin/customer-withdrawals/:id/reject  { reason } - money goes back to the customer's wallet. */
export const rejectCustomerWithdrawal = async (req, res) => {
  try {
    const result = await rejectWithdrawal(req.params.id, { adminId: req.user?.id, reason: req.body?.reason });
    return handleResponse(res, 200, "Request rejected", result);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};
