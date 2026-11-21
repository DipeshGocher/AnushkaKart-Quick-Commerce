import handleResponse from "../utils/helper.js";
import { getErrorStatus } from "../utils/httpError.js";
import {
  getWalletSummary,
  requestWithdrawal,
  saveAccount,
} from "../services/finance/customerWithdrawalService.js";

/** GET /customer/wallet - balance, money waiting to be paid, saved account (masked) and history. */
export const getMyWallet = async (req, res) => {
  try {
    return handleResponse(res, 200, "Wallet fetched", await getWalletSummary(req.user.id));
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

/** PUT /customer/wallet/account - save the bank account / UPI id money should be sent to. */
export const saveMyPayoutAccount = async (req, res) => {
  try {
    const account = await saveAccount(req.user.id, req.body || {});
    return handleResponse(res, 200, "Account saved", { account });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

/** POST /customer/wallet/withdraw  { amount, account? } - ask for wallet money to be sent to the bank / UPI. */
export const withdrawMyWallet = async (req, res) => {
  try {
    const { amount, account } = req.body || {};
    const result = await requestWithdrawal(req.user.id, { amount, account });
    return handleResponse(res, 201, "Withdrawal requested", result);
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};
