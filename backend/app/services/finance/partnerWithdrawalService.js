/**
 * Seller and delivery-partner withdrawals, paid out of the same WALLET that the payout system fills.
 *
 *   delivery -> a payout is created (seller: held until the return window closes) -> the payout job moves
 *   it into the partner's wallet (available balance) -> the partner asks to withdraw -> the amount leaves
 *   their wallet at once -> the admin sends the money from the bank and marks it Settled (the admin wallet is not
 *   touched again: it was debited when the payout was processed), or marks it Failed and the amount goes back into the wallet.
 *
 * So the balance a seller can withdraw is only money whose return window has closed and that no return
 * has taken back. The withdrawal itself is still a Transaction row of type "Withdrawal" (that is what the
 * admin "Money Requests" page lists); `meta.walletDebited` marks the ones that were taken from the wallet.
 */
import mongoose from "mongoose";
import Transaction from "../../models/transaction.js";
import { LEDGER_TRANSACTION_TYPE, OWNER_TYPE } from "../../constants/finance.js";
import { roundCurrency } from "../../utils/money.js";
import { creditWallet, debitWallet, getOrCreateWallet } from "./walletService.js";

function err(message, statusCode = 400) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}

const OWNER_BY_MODEL = { Seller: OWNER_TYPE.SELLER, Delivery: OWNER_TYPE.DELIVERY_PARTNER };

/**
 * Takes `amount` out of the partner's wallet and records the withdrawal request (status Pending).
 * @param {{userModel: "Seller"|"Delivery", userId: any, amount: number, referencePrefix: string, meta?: object, notes?: string}} p
 */
export async function requestPartnerWithdrawal({ userModel, userId, amount, referencePrefix, meta = {}, notes = "" }) {
  const ownerType = OWNER_BY_MODEL[userModel];
  if (!ownerType) throw err("Unsupported account type");
  const value = roundCurrency(Number(amount));
  if (!Number.isFinite(value) || value <= 0) throw err("Please enter a valid amount");

  const id = new mongoose.Types.ObjectId();
  let created;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(
      async () => {
        const wallet = await getOrCreateWallet(ownerType, userId, { session });
        const available = roundCurrency(wallet.availableBalance || 0);
        if (value > available) {
          throw err(`Insufficient balance. Available: ₹${available.toLocaleString("en-IN")}`);
        }
        await debitWallet({
          ownerType,
          ownerId: userId,
          amount: value,
          bucket: "available",
          session,
          ledgerType: LEDGER_TRANSACTION_TYPE.WITHDRAWAL,
          ledgerReference: `${referencePrefix}${id}`,
          ledgerDescription: "Withdrawal requested",
          idempotencyKey: `PWDR-REQ-${id}`,
          metadata: { transactionId: String(id) },
        });
        const [doc] = await Transaction.create(
          [
            {
              _id: id,
              user: userId,
              userModel,
              type: "Withdrawal",
              amount: -value,
              status: "Pending",
              reference: `${referencePrefix}${Date.now()}`,
              meta: { ...meta, walletDebited: true, requestedAt: new Date() },
              notes,
            },
          ],
          { session },
        );
        created = doc;
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } finally {
    session.endSession();
  }
  return created;
}

/**
 * The admin moves a withdrawal to Processing / Settled / Failed. Withdrawals that were taken from the wallet
 * are handled exactly once: Settled records the money leaving the platform, Failed puts it back.
 * Returns the transaction, or null when it does not exist.
 */
export async function updatePartnerWithdrawalStatus({ id, status, reason }) {
  if (!["Settled", "Failed", "Processing"].includes(status)) throw err("Invalid status");
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  const existing = await Transaction.findById(id).lean();
  if (!existing || existing.type !== "Withdrawal") return null;
  // Older requests (made before withdrawals were taken from the wallet) are handled by the caller.
  if (!existing.meta?.walletDebited) return { legacy: true };

  const ownerType = OWNER_BY_MODEL[existing.userModel];
  if (!ownerType) throw err("Unsupported account type");

  if (status === "Processing") {
    const t = await Transaction.findOneAndUpdate(
      { _id: id, status: { $in: ["Pending", "Processing"] } },
      { $set: { status: "Processing" } },
      { new: true },
    );
    if (!t) throw err("This request was already settled or failed.", 409);
    return t;
  }

  let result;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(
      async () => {
        const set = { status };
        if (reason) {
          set.notes = reason;
          set["meta.reason"] = reason;
        }
        const t = await Transaction.findOneAndUpdate(
          { _id: id, status: { $in: ["Pending", "Processing"] } },
          { $set: set },
          { new: true, session },
        );
        if (!t) throw err("This request was already settled or failed.", 409);
        const amount = roundCurrency(Math.abs(t.amount));

        if (status === "Settled") {
          // The admin sent the money from the bank. NOTHING is taken from the admin wallet here: that money
          // already left the admin wallet when the payout was processed into the partner's wallet (taking it
          // again would count the same money twice). The partner's wallet was reduced when they asked.
          // (Customer refunds are different: they are credited to the customer's wallet without touching the
          // admin wallet, so THEIR payout does reduce it.)
        } else {
          await creditWallet({
            ownerType,
            ownerId: t.user,
            amount,
            bucket: "available",
            session,
            ledgerType: LEDGER_TRANSACTION_TYPE.PARTNER_WITHDRAWAL_REJECTED,
            ledgerReference: String(t._id),
            ledgerDescription: "Withdrawal not paid: money put back in the wallet",
            idempotencyKey: `PWDR-REJ-${t._id}`,
            metadata: { transactionId: String(t._id), reason: reason || "" },
          });
        }
        result = t;
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } finally {
    session.endSession();
  }
  return result;
}
