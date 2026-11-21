/**
 * Customer wallet = refund money. The only thing a customer can do with it is have it sent to their
 * own bank account or UPI id (it cannot be spent at checkout).
 *
 *   1. A refund (return accepted, or a paid order cancelled) is credited to the customer's wallet.
 *   2. The customer asks to withdraw: the amount leaves the wallet AT ONCE and a withdrawal request
 *      (status "pending") is created, so the same money can never be requested twice.
 *   3. The admin sends the money from their bank and marks the request "paid" with the transfer
 *      reference (the admin wallet / ledger records the money leaving the platform), or refuses it
 *      with a reason and the amount goes back into the wallet.
 *
 * Every money movement runs inside one Mongo transaction together with its ledger row, and a request
 * can be paid or rejected only once (conditional update on status "pending").
 */
import mongoose from "mongoose";
import User from "../../models/customer.js";
import Wallet from "../../models/wallet.js";
import Transaction from "../../models/transaction.js";
import LedgerEntry from "../../models/ledgerEntry.js";
import Admin from "../../models/admin.js";
import CustomerWithdrawal from "../../models/customerWithdrawal.js";
import {
  LEDGER_DIRECTION,
  LEDGER_TRANSACTION_TYPE,
  OWNER_TYPE,
} from "../../constants/finance.js";
import { encryptPii, decryptPii } from "../../utils/piiCrypto.js";
import { roundCurrency } from "../../utils/money.js";
import { creditWallet, debitWallet, getOrCreateWallet } from "./walletService.js";
import { createLedgerEntry } from "./ledgerService.js";
import { emitNotificationEvent } from "../../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../../modules/notifications/notification.constants.js";
import logger from "../logger.js";

export const MIN_WITHDRAWAL = 1;
export const MIN_REFERENCE_LENGTH = 4;
export const MIN_REASON_LENGTH = 5;

function err(message, statusCode = 400) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}

const idStr = (v) => String((v && v._id) || v || "");

/* ───────────────────────────── validation (pure) ───────────────────────────── */

const NAME_RE = /^[A-Za-z][A-Za-z .'-]{1,79}$/;
const ACCOUNT_RE = /^\d{9,18}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_RE = /^[a-z0-9._-]{2,64}@[a-z][a-z0-9.-]{1,63}$/;

/**
 * Checks what the customer typed as their payout account and returns it cleaned.
 * { method: "bank", holderName, bankName, accountNumber, ifsc }  or  { method: "upi", upiId, holderName? }
 */
export function validateAccountInput(input) {
  const method = String(input?.method || "").toLowerCase();
  if (method === "upi") {
    const upiId = String(input?.upiId || "").trim().toLowerCase();
    if (!UPI_RE.test(upiId)) throw err("Enter a valid UPI ID, like name@bank.");
    const holderName = String(input?.holderName || "").trim();
    if (holderName && !NAME_RE.test(holderName)) throw err("Enter the name as it is on your UPI account.");
    return { method: "upi", upiId, holderName };
  }
  if (method === "bank") {
    const holderName = String(input?.holderName || "").trim();
    if (!NAME_RE.test(holderName)) throw err("Enter the account holder name as it is in the bank.");
    const bankName = String(input?.bankName || "").trim();
    if (bankName.length < 2 || bankName.length > 80) throw err("Enter your bank name.");
    const accountNumber = String(input?.accountNumber || "").replace(/\s+/g, "");
    if (!ACCOUNT_RE.test(accountNumber)) throw err("Enter a valid bank account number (9 to 18 digits).");
    const ifsc = String(input?.ifsc || "").trim().toUpperCase();
    if (!IFSC_RE.test(ifsc)) throw err("Enter a valid IFSC code (like SBIN0001234).");
    return { method: "bank", holderName, bankName, accountNumber, ifsc };
  }
  throw err("Choose Bank account or UPI.");
}

/** The amount a customer asks for: a number, at least ₹1, at most 2 decimals, at most what the wallet holds. */
export function parseWithdrawAmount(value, available) {
  const raw = typeof value === "string" ? value.trim() : value;
  const amount = Number(raw);
  if (raw === "" || raw === null || raw === undefined || !Number.isFinite(amount)) {
    throw err("Enter the amount you want to withdraw.");
  }
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    throw err("The amount can have at most 2 decimal places.");
  }
  if (amount < MIN_WITHDRAWAL) throw err(`The smallest amount you can withdraw is ₹${MIN_WITHDRAWAL}.`);
  const cents = roundCurrency(amount);
  if (cents > roundCurrency(available)) {
    throw err(`You only have ₹${roundCurrency(available)} in your wallet.`);
  }
  return cents;
}

/** Account as the customer may see it (no full account number). */
export function maskAccount(acc) {
  if (!acc || !acc.method) return null;
  if (acc.method === "upi") return { method: "upi", upiId: acc.upiId, holderName: acc.holderName || "" };
  return {
    method: "bank",
    holderName: acc.holderName,
    bankName: acc.bankName,
    accountMasked: acc.accountLast4 ? `XXXXXX${acc.accountLast4}` : "",
    ifsc: acc.ifsc,
  };
}

function toStoredAccount(clean) {
  if (clean.method === "upi") {
    return { method: "upi", upiId: clean.upiId, holderName: clean.holderName || "" };
  }
  return {
    method: "bank",
    holderName: clean.holderName,
    bankName: clean.bankName,
    accountNumberEnc: encryptPii(clean.accountNumber),
    accountLast4: clean.accountNumber.slice(-4),
    ifsc: clean.ifsc,
  };
}

/* ───────────────────────────── wallet ───────────────────────────── */

/**
 * Old customers may have a balance only on User.walletBalance (from before the Wallet collection existed).
 * Copies that balance into the Wallet once (same idempotency key the checkout used to use).
 */
async function ensureCanonicalWallet(customerId, { session } = {}) {
  const key = `WLT-SEED-${String(customerId)}`;
  const seeded = await LedgerEntry.findOne({ idempotencyKey: key }, { _id: 1 }, session ? { session } : {});
  if (seeded) return 0;
  const user = await User.findById(customerId, { walletBalance: 1 }, session ? { session } : {}).lean();
  const wallet = await getOrCreateWallet(OWNER_TYPE.CUSTOMER, customerId, { session });
  const gap = roundCurrency((user?.walletBalance || 0) - (wallet.availableBalance || 0));
  if (gap <= 0) return 0;
  await creditWallet({
    ownerType: OWNER_TYPE.CUSTOMER,
    ownerId: customerId,
    amount: gap,
    bucket: "available",
    session,
    ledgerType: LEDGER_TRANSACTION_TYPE.ADJUSTMENT,
    ledgerReference: key,
    ledgerDescription: "Copy of the old wallet balance into the wallet record",
    idempotencyKey: key,
    metadata: { reason: "legacy_user_walletbalance_seed" },
    syncUserWalletBalance: false, // the user row already holds this balance
  });
  return gap;
}

async function pendingTotal(customerId) {
  const rows = await CustomerWithdrawal.aggregate([
    { $match: { customer: new mongoose.Types.ObjectId(idStr(customerId)), status: "pending" } },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { amount: roundCurrency(rows[0]?.total || 0), count: rows[0]?.count || 0 };
}

const STATUS_NOTE = { pending: "Waiting for payment", paid: "Sent to you", rejected: "Not paid, money is back in your wallet" };

/** Everything the customer's Wallet page shows. */
export async function getWalletSummary(customerId) {
  try {
    await ensureCanonicalWallet(customerId);
  } catch (error) {
    logger.warn("Wallet balance copy failed", { scope: "CustomerWallet", customerId: idStr(customerId), error: error.message });
  }
  const user = await User.findById(customerId).select("+payoutAccount walletBalance").lean();
  if (!user) throw err("Customer not found", 404);
  const wallet = await Wallet.findOne({ ownerType: OWNER_TYPE.CUSTOMER, ownerId: customerId }).lean();
  const balance = roundCurrency(wallet ? wallet.availableBalance || 0 : user.walletBalance || 0);
  const inProcess = await pendingTotal(customerId);

  const [refunds, withdrawals] = await Promise.all([
    Transaction.find({ user: customerId, userModel: "User", type: { $in: ["Refund", "Wallet Refund", "Wallet Payment"] } })
      .sort({ createdAt: -1 })
      .limit(60)
      .populate("order", "orderId")
      .lean(),
    CustomerWithdrawal.find({ customer: customerId }).sort({ createdAt: -1 }).limit(60).lean(),
  ]);

  const history = [
    ...refunds.map((t) => ({
      id: `t-${t._id}`,
      kind: t.type === "Wallet Payment" ? "payment" : "refund",
      type: t.type === "Wallet Payment" ? "debit" : "credit",
      title: t.type === "Wallet Payment" ? "Paid for an order" : "Refund",
      amount: Math.abs(t.amount),
      status: "completed",
      date: t.createdAt,
      orderId: t.order?.orderId || null,
    })),
    ...withdrawals.map((w) => ({
      id: `w-${w._id}`,
      kind: "withdrawal",
      type: "debit",
      title: w.method === "upi" ? "Withdraw to UPI" : "Withdraw to bank",
      amount: w.amount,
      status: w.status,
      statusNote: STATUS_NOTE[w.status],
      reference: w.status === "paid" ? w.reference : "",
      reason: w.status === "rejected" ? w.rejectionReason : "",
      date: w.createdAt,
      orderId: null,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    balance,
    inProcess: inProcess.amount,
    inProcessCount: inProcess.count,
    minWithdrawal: MIN_WITHDRAWAL,
    account: maskAccount(user.payoutAccount),
    history: history.slice(0, 60),
  };
}

/** Saves (or replaces) the account the customer wants money sent to. */
export async function saveAccount(customerId, input) {
  const clean = validateAccountInput(input);
  const stored = { ...toStoredAccount(clean), updatedAt: new Date() };
  const res = await User.updateOne({ _id: customerId }, { $set: { payoutAccount: stored } });
  if (!res.matchedCount) throw err("Customer not found", 404);
  return maskAccount(stored);
}

/**
 * The customer asks to withdraw `amount`. `account` is optional: without it the saved account is used.
 * The amount leaves the wallet right now.
 */
export async function requestWithdrawal(customerId, { amount, account } = {}) {
  const user = await User.findById(customerId).select("+payoutAccount name isActive").lean();
  if (!user) throw err("Customer not found", 404);
  if (user.isActive === false) throw err("Your account has been blocked. Please contact support.", 403);

  let stored;
  let saveNew = false;
  if (account && typeof account === "object" && Object.keys(account).length) {
    stored = toStoredAccount(validateAccountInput(account));
    saveNew = true;
  } else if (user.payoutAccount?.method) {
    stored = {
      method: user.payoutAccount.method,
      holderName: user.payoutAccount.holderName,
      bankName: user.payoutAccount.bankName,
      accountNumberEnc: user.payoutAccount.accountNumberEnc,
      accountLast4: user.payoutAccount.accountLast4,
      ifsc: user.payoutAccount.ifsc,
      upiId: user.payoutAccount.upiId,
    };
  } else {
    throw err("Add your bank account or UPI ID first.");
  }

  const id = new mongoose.Types.ObjectId();
  let created;
  let finalAmount;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(
      async () => {
        await ensureCanonicalWallet(customerId, { session });
        const wallet = await getOrCreateWallet(OWNER_TYPE.CUSTOMER, customerId, { session });
        finalAmount = parseWithdrawAmount(amount, wallet.availableBalance || 0);

        await debitWallet({
          ownerType: OWNER_TYPE.CUSTOMER,
          ownerId: customerId,
          amount: finalAmount,
          bucket: "available",
          session,
          ledgerType: LEDGER_TRANSACTION_TYPE.WITHDRAWAL,
          ledgerReference: `WDR-${id}`,
          ledgerDescription: "Wallet money withdrawal requested",
          idempotencyKey: `WDR-REQ-${id}`,
          metadata: { withdrawalId: String(id), method: stored.method },
        });

        const [doc] = await CustomerWithdrawal.create(
          [{ _id: id, customer: customerId, amount: finalAmount, method: stored.method, account: stored, status: "pending" }],
          { session },
        );
        created = doc;

        if (saveNew) {
          await User.updateOne({ _id: customerId }, { $set: { payoutAccount: { ...stored, updatedAt: new Date() } } }, { session });
        }
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } finally {
    session.endSession();
  }

  try {
    const admins = await Admin.find().select("_id").lean();
    emitNotificationEvent(NOTIFICATION_EVENTS.WALLET_WITHDRAWAL_REQUESTED, {
      customerId,
      adminIds: admins.map((a) => a._id),
      data: { amount: finalAmount, method: stored.method },
    });
  } catch (error) {
    logger.warn("Withdrawal notification failed", { scope: "CustomerWallet", error: error.message });
  }

  const wallet = await Wallet.findOne({ ownerType: OWNER_TYPE.CUSTOMER, ownerId: customerId }).lean();
  return {
    withdrawal: {
      id: String(created._id),
      amount: created.amount,
      status: created.status,
      method: created.method,
      account: maskAccount({ ...(created.account?.toObject ? created.account.toObject() : created.account), method: created.method }),
      createdAt: created.createdAt,
    },
    balance: roundCurrency(wallet?.availableBalance || 0),
  };
}

/* ───────────────────────────── admin side ───────────────────────────── */

function adminView(w) {
  const acc = w.account || {};
  return {
    id: String(w._id),
    status: w.status,
    amount: w.amount,
    method: w.method,
    customer: w.customer && w.customer._id ? { id: String(w.customer._id), name: w.customer.name || "", phone: w.customer.phone || "" } : { id: idStr(w.customer), name: "", phone: "" },
    account:
      w.method === "upi"
        ? { upiId: acc.upiId, holderName: acc.holderName || "" }
        : { holderName: acc.holderName, bankName: acc.bankName, accountNumber: decryptPii(acc.accountNumberEnc), ifsc: acc.ifsc },
    reference: w.reference || "",
    rejectionReason: w.rejectionReason || "",
    requestedAt: w.createdAt,
    processedAt: w.processedAt || null,
    adminWalletDebited: w.adminWalletDebited || 0,
  };
}

export async function listWithdrawals({ status = "all", search = "", page = 1, limit = 25 } = {}) {
  const filter = {};
  if (["pending", "paid", "rejected"].includes(status)) filter.status = status;
  const term = String(search || "").trim();
  if (term) {
    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User.find({ $or: [{ name: rx }, { phone: rx }] }).select("_id").limit(200).lean();
    filter.$or = [{ customer: { $in: users.map((u) => u._id) } }, { reference: rx }];
  }
  const perPage = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const pageNo = Math.max(1, parseInt(page, 10) || 1);
  const [rows, total, stats] = await Promise.all([
    CustomerWithdrawal.find(filter).sort({ createdAt: -1 }).skip((pageNo - 1) * perPage).limit(perPage).populate("customer", "name phone").lean(),
    CustomerWithdrawal.countDocuments(filter),
    CustomerWithdrawal.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } }]),
  ]);
  const by = Object.fromEntries(stats.map((s) => [s._id, s]));
  return {
    items: rows.map(adminView),
    total,
    page: pageNo,
    stats: {
      pendingCount: by.pending?.count || 0,
      pendingAmount: roundCurrency(by.pending?.amount || 0),
      paidCount: by.paid?.count || 0,
      paidAmount: roundCurrency(by.paid?.amount || 0),
      rejectedCount: by.rejected?.count || 0,
    },
  };
}

/** The admin has sent the money: marks the request paid and records the money leaving the platform. */
export async function markPaid(withdrawalId, { adminId, reference } = {}) {
  const ref = String(reference || "").trim();
  if (ref.length < MIN_REFERENCE_LENGTH) {
    throw err(`Type the bank transfer reference / UTR (at least ${MIN_REFERENCE_LENGTH} characters).`);
  }
  if (!mongoose.Types.ObjectId.isValid(withdrawalId)) throw err("Request not found", 404);

  let paid;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(
      async () => {
        const w = await CustomerWithdrawal.findOneAndUpdate(
          { _id: withdrawalId, status: "pending" },
          { $set: { status: "paid", reference: ref, processedAt: new Date(), processedBy: adminId || null } },
          { new: true, session },
        );
        if (!w) {
          const exists = await CustomerWithdrawal.exists({ _id: withdrawalId }).session(session);
          throw err(exists ? "This request was already paid or rejected." : "Request not found", exists ? 409 : 404);
        }

        // The money leaves the platform now. The admin wallet balance never goes below zero, so it is
        // reduced by what it holds; the ledger row always records the full amount.
        const adminWallet = await getOrCreateWallet(OWNER_TYPE.ADMIN, null, { session });
        const before = roundCurrency(adminWallet.availableBalance || 0);
        const take = Math.min(before, w.amount);
        if (take > 0) {
          await debitWallet({ ownerType: OWNER_TYPE.ADMIN, ownerId: null, amount: take, bucket: "available", session });
        }
        await createLedgerEntry(
          {
            walletId: adminWallet._id,
            actorType: OWNER_TYPE.ADMIN,
            actorId: null,
            type: LEDGER_TRANSACTION_TYPE.CUSTOMER_WITHDRAWAL_PAID,
            direction: LEDGER_DIRECTION.DEBIT,
            amount: w.amount,
            description: "Customer refund money sent to their bank / UPI",
            reference: ref,
            balanceBefore: before,
            balanceAfter: roundCurrency(before - take),
            idempotencyKey: `WDR-PAID-${w._id}`,
            metadata: { withdrawalId: String(w._id), customerId: String(w.customer), paidBy: adminId ? String(adminId) : null, adminWalletDebited: take, notCoveredByAdminWallet: roundCurrency(w.amount - take) },
          },
          { session },
        );
        await CustomerWithdrawal.updateOne({ _id: w._id }, { $set: { adminWalletDebited: take } }, { session });
        w.adminWalletDebited = take;
        paid = w;
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } finally {
    session.endSession();
  }

  emitNotificationEvent(NOTIFICATION_EVENTS.WALLET_WITHDRAWAL_PAID, {
    customerId: paid.customer,
    userId: paid.customer,
    data: { amount: paid.amount, method: paid.method, reference: ref },
  });
  return adminView({ ...paid.toObject(), customer: paid.customer });
}

/** The admin refuses: the amount goes back into the customer's wallet. */
export async function rejectWithdrawal(withdrawalId, { adminId, reason } = {}) {
  const why = String(reason || "").trim();
  if (why.length < MIN_REASON_LENGTH) throw err(`Please tell the customer why (at least ${MIN_REASON_LENGTH} characters).`);
  if (!mongoose.Types.ObjectId.isValid(withdrawalId)) throw err("Request not found", 404);

  let rejected;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(
      async () => {
        const w = await CustomerWithdrawal.findOneAndUpdate(
          { _id: withdrawalId, status: "pending" },
          { $set: { status: "rejected", rejectionReason: why, processedAt: new Date(), processedBy: adminId || null } },
          { new: true, session },
        );
        if (!w) {
          const exists = await CustomerWithdrawal.exists({ _id: withdrawalId }).session(session);
          throw err(exists ? "This request was already paid or rejected." : "Request not found", exists ? 409 : 404);
        }
        await creditWallet({
          ownerType: OWNER_TYPE.CUSTOMER,
          ownerId: w.customer,
          amount: w.amount,
          bucket: "available",
          session,
          ledgerType: LEDGER_TRANSACTION_TYPE.CUSTOMER_WITHDRAWAL_REJECTED,
          ledgerReference: `WDR-${w._id}`,
          ledgerDescription: "Withdrawal not paid: money put back in the wallet",
          idempotencyKey: `WDR-REJ-${w._id}`,
          metadata: { withdrawalId: String(w._id), reason: why },
        });
        rejected = w;
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } finally {
    session.endSession();
  }

  emitNotificationEvent(NOTIFICATION_EVENTS.WALLET_WITHDRAWAL_REJECTED, {
    customerId: rejected.customer,
    userId: rejected.customer,
    data: { amount: rejected.amount, reason: why },
  });
  return adminView({ ...rejected.toObject(), customer: rejected.customer });
}
