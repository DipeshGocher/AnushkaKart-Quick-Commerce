import Wallet from "../../models/wallet.js";
import Payout from "../../models/payout.js";
import Order from "../../models/order.js";
import User from "../../models/customer.js";
import Transaction from "../../models/transaction.js";
import {
  LEDGER_DIRECTION,
  LEDGER_TRANSACTION_TYPE,
  ORDER_PAYMENT_STATUS,
  OWNER_TYPE,
  PAYOUT_STATUS,
  PAYOUT_TYPE,
  WALLET_STATUS,
} from "../../constants/finance.js";
import { addMoney, clampMoney, roundCurrency } from "../../utils/money.js";
import { createLedgerEntry } from "./ledgerService.js";

function normalizeOwnerId(ownerType, ownerId) {
  if (ownerType === OWNER_TYPE.ADMIN) return null;
  return ownerId || null;
}

function assertPositiveAmount(amount) {
  const normalized = roundCurrency(amount);
  if (normalized <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  return normalized;
}

/**
 * Phase 4 P4-3 — keep the legacy `User.walletBalance` field in sync with
 * the canonical `Wallet({ownerType:"CUSTOMER"})` document whenever the
 * wallet is mutated for a customer.
 *
 * Old code paths that directly mutate `User.walletBalance` (e.g.
 * `orderPlacementService` line ~445 — wallet redemption at checkout) are
 * NOT affected by this helper; they continue to update the User document
 * themselves. Phase 4b will migrate those call sites to walletService and
 * the User-side write will then be the only authority.
 *
 * Callers that already mutate User.walletBalance can opt out by passing
 * `syncUserWalletBalance: false` to avoid double-counting.
 */
async function maybeSyncUserWalletBalance({
  ownerType,
  ownerId,
  signedDelta,
  syncUserWalletBalance,
  session,
}) {
  if (syncUserWalletBalance === false) return;
  if (ownerType !== OWNER_TYPE.CUSTOMER) return;
  if (!ownerId) return;
  if (!signedDelta || !Number.isFinite(signedDelta)) return;

  const inc = roundCurrency(signedDelta);
  if (inc === 0) return;

  // Use $inc so concurrent wallet movements compose correctly without
  // a read-modify-write race. We deliberately do NOT throw if the user
  // doesn't exist — the canonical Wallet write has already succeeded
  // and a missing user row is a pre-existing data anomaly that should
  // not abort the money flow.
  try {
    await User.updateOne(
      { _id: ownerId },
      { $inc: { walletBalance: inc } },
      session ? { session } : {},
    );
  } catch (error) {
    // Surface as a soft log only — the wallet (canonical) is already
    // correct. Drift will be caught by the P2-9 verifier.
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "[walletService] User.walletBalance sync failed; canonical Wallet is authoritative",
        { userId: String(ownerId), inc, error: error.message },
      );
    }
  }
}

/**
 * Phase 2 P2-1: helper that creates a paired LedgerEntry for a wallet
 * movement. Callers can opt-in by passing `ledgerType`. When `ledgerType`
 * is omitted the helper is a no-op so legacy callers (e.g. orderFinanceService
 * which writes its own ledger row right after the wallet save) keep working.
 *
 * Every field after `ledgerType` is optional and only forwarded if present.
 */
async function maybeWriteLedgerEntry({
  wallet,
  ownerType,
  ownerId,
  before,
  after,
  amount,
  direction,
  ledgerType,
  ledgerStatus,
  ledgerReference,
  ledgerDescription,
  orderId,
  payoutId,
  paymentMode,
  metadata,
  idempotencyKey,
  correlationId,
  session,
}) {
  if (!ledgerType) return null;
  return createLedgerEntry(
    {
      orderId: orderId || null,
      payoutId: payoutId || null,
      walletId: wallet?._id || null,
      actorType: ownerType,
      actorId: ownerId || null,
      type: ledgerType,
      direction,
      amount,
      ...(ledgerStatus ? { status: ledgerStatus } : {}),
      paymentMode: paymentMode || null,
      metadata: metadata || {},
      description: ledgerDescription || "",
      reference: ledgerReference || "",
      balanceBefore: before,
      balanceAfter: after,
      idempotencyKey: idempotencyKey || null,
      correlationId: correlationId || null,
    },
    { session },
  );
}

export async function getOrCreateWallet(ownerType, ownerId, { session } = {}) {
  const normalizedOwnerId = normalizeOwnerId(ownerType, ownerId);
  const query = {
    ownerType,
    ownerId: normalizedOwnerId,
  };
  const options = {};
  if (session) options.session = session;

  let wallet = await Wallet.findOne(query, null, options);
  if (!wallet) {
    wallet = await Wallet.create(
      [
        {
          ownerType,
          ownerId: normalizedOwnerId,
          availableBalance: 0,
          pendingBalance: 0,
          cashInHand: 0,
          totalCredited: 0,
          totalDebited: 0,
          status: WALLET_STATUS.ACTIVE,
        },
      ],
      options,
    );
    wallet = wallet[0];
  }
  return wallet;
}

export async function creditWallet({
  ownerType,
  ownerId,
  amount,
  bucket = "available",
  session,
  // Phase 2 P2-1: opt-in ledger metadata. When `ledgerType` is provided
  // we emit a LedgerEntry inside the same session so the wallet save
  // and the ledger row commit (or roll back) together.
  ledgerType = null,
  ledgerStatus = null,
  ledgerReference = "",
  ledgerDescription = "",
  orderId = null,
  payoutId = null,
  paymentMode = null,
  metadata = null,
  idempotencyKey = null,
  correlationId = null,
  // Phase 4 P4-3: dual-write to legacy `User.walletBalance`. Default ON
  // (additive — no caller relied on the old behaviour); flip to `false`
  // if the caller already writes User.walletBalance directly.
  syncUserWalletBalance = true,
}) {
  const normalizedAmount = assertPositiveAmount(amount);
  const wallet = await getOrCreateWallet(ownerType, ownerId, { session });

  if (wallet.status !== WALLET_STATUS.ACTIVE) {
    throw new Error("Wallet is not active");
  }

  const before = wallet[`${bucket}Balance`];
  wallet[`${bucket}Balance`] = addMoney(before, normalizedAmount);
  wallet.totalCredited = addMoney(wallet.totalCredited, normalizedAmount);

  await wallet.save({ session });

  const beforeRounded = roundCurrency(before);
  const afterRounded = roundCurrency(wallet[`${bucket}Balance`]);

  const ledgerEntry = await maybeWriteLedgerEntry({
    wallet,
    ownerType,
    ownerId,
    before: beforeRounded,
    after: afterRounded,
    amount: normalizedAmount,
    direction: LEDGER_DIRECTION.CREDIT,
    ledgerType,
    ledgerStatus,
    ledgerReference,
    ledgerDescription,
    orderId,
    payoutId,
    paymentMode,
    metadata,
    idempotencyKey,
    correlationId,
    session,
  });

  // Phase 4 P4-3: legacy mirror. Only applies for the `available` bucket
  // since User.walletBalance only ever represented the available balance.
  if (bucket === "available") {
    await maybeSyncUserWalletBalance({
      ownerType,
      ownerId,
      signedDelta: normalizedAmount,
      syncUserWalletBalance,
      session,
    });
  }

  return {
    wallet,
    amount: normalizedAmount,
    before: beforeRounded,
    after: afterRounded,
    bucket,
    ledgerEntry,
  };
}

export async function debitWallet({
  ownerType,
  ownerId,
  amount,
  bucket = "available",
  session,
  ledgerType = null,
  ledgerStatus = null,
  ledgerReference = "",
  ledgerDescription = "",
  orderId = null,
  payoutId = null,
  paymentMode = null,
  metadata = null,
  idempotencyKey = null,
  correlationId = null,
  // Phase 4 P4-3: dual-write to legacy `User.walletBalance`. See creditWallet.
  syncUserWalletBalance = true,
}) {
  const normalizedAmount = assertPositiveAmount(amount);
  const wallet = await getOrCreateWallet(ownerType, ownerId, { session });

  if (wallet.status !== WALLET_STATUS.ACTIVE) {
    throw new Error("Wallet is not active");
  }

  const field = `${bucket}Balance`;
  const before = roundCurrency(wallet[field] || 0);
  if (before < normalizedAmount) {
    throw new Error(`Insufficient ${bucket} balance`);
  }

  wallet[field] = roundCurrency(before - normalizedAmount);
  wallet.totalDebited = addMoney(wallet.totalDebited, normalizedAmount);
  await wallet.save({ session });

  const afterRounded = roundCurrency(wallet[field]);

  const ledgerEntry = await maybeWriteLedgerEntry({
    wallet,
    ownerType,
    ownerId,
    before,
    after: afterRounded,
    amount: normalizedAmount,
    direction: LEDGER_DIRECTION.DEBIT,
    ledgerType,
    ledgerStatus,
    ledgerReference,
    ledgerDescription,
    orderId,
    payoutId,
    paymentMode,
    metadata,
    idempotencyKey,
    correlationId,
    session,
  });

  if (bucket === "available") {
    await maybeSyncUserWalletBalance({
      ownerType,
      ownerId,
      signedDelta: -normalizedAmount,
      syncUserWalletBalance,
      session,
    });
  }

  return {
    wallet,
    amount: normalizedAmount,
    before,
    after: afterRounded,
    bucket,
    ledgerEntry,
  };
}

/**
 * Debits as much of `amount` as the owner's available balance can cover and records the rest as
 * money still owed (wallet.recoverableDue), which is taken from their next payouts. The balance never
 * goes below zero and the caller's transaction never fails because the owner is short of money
 * (used when a seller has to give back a returned order's money).
 * @returns {{ debited: number, shortfall: number }}
 */
export async function debitWalletUpTo({
  ownerType,
  ownerId,
  amount,
  session,
  ledgerType = null,
  ledgerReference = "",
  ledgerDescription = "",
  orderId = null,
  metadata = null,
  idempotencyKey = null,
  correlationId = null,
  // When true, what was really taken goes to the PLATFORM wallet (it is money coming back to the platform:
  // a refund the platform already paid, a courier charge, ...). Without it the money would just disappear.
  creditAdmin = false,
}) {
  const wanted = assertPositiveAmount(amount);
  const wallet = await getOrCreateWallet(ownerType, ownerId, { session });
  if (wallet.status !== WALLET_STATUS.ACTIVE) {
    throw new Error("Wallet is not active");
  }
  const available = roundCurrency(wallet.availableBalance || 0);
  const take = Math.min(available, wanted);

  let debited = 0;
  if (take > 0) {
    await debitWallet({
      ownerType,
      ownerId,
      amount: take,
      session,
      ledgerType,
      ledgerReference,
      ledgerDescription,
      orderId,
      metadata,
      idempotencyKey,
      correlationId,
    });
    debited = take;
    if (creditAdmin) {
      await creditWallet({
        ownerType: OWNER_TYPE.ADMIN,
        ownerId: null,
        amount: take,
        bucket: "available",
        session,
        ledgerType: LEDGER_TRANSACTION_TYPE.RECOVERY_RECEIVED,
        ledgerReference,
        ledgerDescription: ledgerDescription || "Money taken back from a seller / partner",
        orderId,
        idempotencyKey: idempotencyKey ? `${idempotencyKey}-ADM` : null,
        metadata: { ...(metadata || {}), from: String(ownerId) },
      });
    }
  }

  const shortfall = roundCurrency(wanted - debited);
  if (shortfall > 0) {
    const fresh = await getOrCreateWallet(ownerType, ownerId, { session });
    fresh.recoverableDue = roundCurrency((fresh.recoverableDue || 0) + shortfall);
    await fresh.save({ session });
    await createLedgerEntry(
      {
        orderId,
        walletId: fresh._id,
        actorType: ownerType,
        actorId: ownerId,
        type: LEDGER_TRANSACTION_TYPE.RETURN_RECOVERY_DUE,
        direction: LEDGER_DIRECTION.DEBIT,
        amount: shortfall,
        description: ledgerDescription || "Amount owed after a return; taken from the next payouts",
        reference: ledgerReference,
        metadata: { ...(metadata || {}), shortfall },
      },
      { session },
    );
  }
  return { debited, shortfall };
}

/**
 * Money that goes BACK to a seller / partner (a charge that was waived or lowered): it comes out of the platform
 * wallet (as far as the wallet holds; it never goes below zero) and lands in theirs.
 */
export async function payBackFromAdmin({
  ownerType,
  ownerId,
  amount,
  session,
  ledgerType,
  ledgerReference = "",
  ledgerDescription = "",
  orderId = null,
  idempotencyKey = null,
  metadata = null,
  bucket = "available",
}) {
  const back = assertPositiveAmount(amount);
  const adminWallet = await getOrCreateWallet(OWNER_TYPE.ADMIN, null, { session });
  const take = Math.min(roundCurrency(adminWallet.availableBalance || 0), back);
  if (take > 0) {
    await debitWallet({
      ownerType: OWNER_TYPE.ADMIN,
      ownerId: null,
      amount: take,
      bucket: "available",
      session,
      ledgerType: LEDGER_TRANSACTION_TYPE.RECOVERY_GIVEN_BACK,
      ledgerReference,
      ledgerDescription: ledgerDescription || "Money given back to a seller / partner",
      orderId,
      idempotencyKey: idempotencyKey ? `${idempotencyKey}-ADM` : null,
      metadata: { ...(metadata || {}), to: String(ownerId) },
    });
  }
  return creditWallet({
    ownerType,
    ownerId,
    amount: back,
    bucket,
    session,
    ledgerType,
    ledgerReference,
    ledgerDescription,
    orderId,
    idempotencyKey,
    metadata,
  });
}

/**
 * Takes what an owner still owes (wallet.recoverableDue) out of `amount` (a payout about to be
 * created). Returns how much was taken (0 when nothing is owed).
 */
export async function applyRecoverableDue({
  ownerType,
  ownerId,
  amount,
  session,
  orderId = null,
  reference = "",
}) {
  const gross = roundCurrency(amount);
  if (gross <= 0 || !ownerId) return 0;
  const wallet = await getOrCreateWallet(ownerType, ownerId, { session });
  const due = roundCurrency(wallet.recoverableDue || 0);
  const take = Math.min(due, gross);
  if (take <= 0) return 0;
  wallet.recoverableDue = roundCurrency(due - take);
  await wallet.save({ session });
  await createLedgerEntry(
    {
      orderId,
      walletId: wallet._id,
      actorType: ownerType,
      actorId: ownerId,
      type: LEDGER_TRANSACTION_TYPE.RETURN_RECOVERY_APPLIED,
      direction: LEDGER_DIRECTION.DEBIT,
      amount: take,
      description: "Owed return amount recovered from this payout",
      reference,
    },
    { session },
  );
  return take;
}

export async function movePendingToAvailable({
  ownerType,
  ownerId,
  amount,
  session,
  ledgerType = null,
  ledgerStatus = null,
  ledgerReference = "",
  ledgerDescription = "",
  orderId = null,
  payoutId = null,
  paymentMode = null,
  metadata = null,
  idempotencyKey = null,
  correlationId = null,
  // Phase 4 P4-3: dual-write to legacy `User.walletBalance`. See creditWallet.
  syncUserWalletBalance = true,
}) {
  const normalizedAmount = assertPositiveAmount(amount);
  const wallet = await getOrCreateWallet(ownerType, ownerId, { session });

  if (wallet.pendingBalance < normalizedAmount) {
    throw new Error("Insufficient pending balance");
  }

  const pendingBefore = roundCurrency(wallet.pendingBalance);
  const availableBefore = roundCurrency(wallet.availableBalance);

  wallet.pendingBalance = roundCurrency(wallet.pendingBalance - normalizedAmount);
  wallet.availableBalance = roundCurrency(wallet.availableBalance + normalizedAmount);
  await wallet.save({ session });

  // Phase 4 P4-3: legacy mirror — pending→available is a net increase
  // to the available bucket which is what `User.walletBalance` tracks.
  await maybeSyncUserWalletBalance({
    ownerType,
    ownerId,
    signedDelta: normalizedAmount,
    syncUserWalletBalance,
    session,
  });

  const ledgerEntry = await maybeWriteLedgerEntry({
    wallet,
    ownerType,
    ownerId,
    // For a pending-to-available move we report the available-bucket
    // before/after — that's the bucket the customer/admin actually sees.
    before: availableBefore,
    after: roundCurrency(wallet.availableBalance),
    amount: normalizedAmount,
    direction: LEDGER_DIRECTION.CREDIT,
    ledgerType,
    ledgerStatus,
    ledgerReference,
    ledgerDescription,
    orderId,
    payoutId,
    paymentMode,
    metadata: {
      ...(metadata || {}),
      bucket: "pending->available",
      pendingBefore,
      pendingAfter: roundCurrency(wallet.pendingBalance),
    },
    idempotencyKey,
    correlationId,
    session,
  });

  return {
    wallet,
    amount: normalizedAmount,
    pendingBefore,
    pendingAfter: roundCurrency(wallet.pendingBalance),
    availableBefore,
    availableAfter: roundCurrency(wallet.availableBalance),
    ledgerEntry,
  };
}

export async function updateCashInHand({
  ownerType,
  ownerId,
  deltaAmount,
  session,
  ledgerType = null,
  ledgerStatus = null,
  ledgerReference = "",
  ledgerDescription = "",
  orderId = null,
  payoutId = null,
  paymentMode = null,
  metadata = null,
  idempotencyKey = null,
  correlationId = null,
}) {
  const wallet = await getOrCreateWallet(ownerType, ownerId, { session });
  const delta = roundCurrency(deltaAmount || 0);
  if (delta === 0) {
    return {
      wallet,
      before: roundCurrency(wallet.cashInHand || 0),
      after: roundCurrency(wallet.cashInHand || 0),
      delta: 0,
      ledgerEntry: null,
    };
  }

  const before = roundCurrency(wallet.cashInHand || 0);
  wallet.cashInHand = clampMoney(before + delta, 0);
  await wallet.save({ session });

  const afterRounded = roundCurrency(wallet.cashInHand);

  const ledgerEntry = await maybeWriteLedgerEntry({
    wallet,
    ownerType,
    ownerId,
    before,
    after: afterRounded,
    amount: Math.abs(delta),
    direction: delta >= 0 ? LEDGER_DIRECTION.CREDIT : LEDGER_DIRECTION.DEBIT,
    ledgerType,
    ledgerStatus,
    ledgerReference,
    ledgerDescription,
    orderId,
    payoutId,
    paymentMode,
    metadata: { ...(metadata || {}), bucket: "cashInHand", delta },
    idempotencyKey,
    correlationId,
    session,
  });

  return {
    wallet,
    before,
    after: afterRounded,
    delta,
    ledgerEntry,
  };
}

export async function getAdminFinanceSummary() {
  const adminWallet = await getOrCreateWallet(OWNER_TYPE.ADMIN, null);

  const [
    onlineCollection,
    codReconciled,
    adminEarning,
    pendingPayouts,
    systemFloatCOD,
    platformGross,
  ] =
    await Promise.all([
      Order.aggregate([
        {
          $match: {
            paymentMode: "ONLINE",
            paymentStatus: ORDER_PAYMENT_STATUS.PAID,
          },
        },
        { $group: { _id: null, amount: { $sum: "$paymentBreakdown.grandTotal" } } },
      ]),
      Order.aggregate([
        { $match: { paymentMode: "COD" } },
        { $group: { _id: null, amount: { $sum: "$paymentBreakdown.codRemittedAmount" } } },
      ]),
      Order.aggregate([
        // Total Admin Earning = what the platform really earns (commission + fees, minus rider / courier
        // costs and coupons, returns taken into account). Delivered orders and returned ones (a returned order
        // keeps its delivery fee and has costs), online and cash alike; older orders fall back to the old figure.
        { $match: { status: { $in: ["delivered", "returned"] } } },
        {
          $group: {
            _id: null,
            amount: { $sum: { $ifNull: ["$platformEarning.net", "$paymentBreakdown.platformTotalEarning"] } },
            cashPending: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ["$paymentMode", "COD"] }, { $gt: ["$paymentBreakdown.codPendingAmount", 0] }] },
                  { $ifNull: ["$platformEarning.net", "$paymentBreakdown.platformTotalEarning"] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      Payout.aggregate([
        { $match: { status: { $in: [PAYOUT_STATUS.PENDING, PAYOUT_STATUS.PROCESSING] } } },
        { $group: { _id: "$payoutType", amount: { $sum: "$amount" } } },
      ]),
      // Physical Cash with Riders (Pending remittance to admin):
      // Exact net sum of (Cash Collected by Riders - Cash Settled/Deposited to Admin).
      Transaction.aggregate([
        {
          $match: {
            userModel: "Delivery",
            type: { $in: ["Cash Collection", "Cash Settlement"] },
            status: { $ne: "Failed" },
          },
        },
        {
          $group: {
            _id: "$user",
            collected: {
              $sum: {
                $cond: [{ $eq: ["$type", "Cash Collection"] }, { $abs: "$amount" }, 0],
              },
            },
            settled: {
              $sum: {
                $cond: [{ $eq: ["$type", "Cash Settlement"] }, { $abs: "$amount" }, 0],
              },
            },
          },
        },
        {
          $project: {
            inHand: { $max: [{ $subtract: ["$collected", "$settled"] }, 0] },
          },
        },
        {
          $group: {
            _id: null,
            amount: { $sum: "$inHand" },
          },
        },
      ]),
      // Total Platform Earning card (UI label: "Total money collected") should reflect total checkout
      // value placed by customers across COD + ONLINE orders (regardless of remittance/capture).
      // This updates immediately on order placement.
      Order.aggregate([
        {
          $match: {
            status: { $ne: "cancelled" },
            orderStatus: { $ne: "cancelled" },
          },
        },
        {
          $group: {
            _id: null,
            amount: {
              $sum: {
                $ifNull: ["$paymentBreakdown.grandTotal", "$pricing.total"],
              },
            },
          },
        },
      ]),
    ]);

  const sellerPendingPayouts =
    pendingPayouts.find((row) => row._id === PAYOUT_TYPE.SELLER)?.amount || 0;
  const riderPendingPayouts =
    pendingPayouts.find((row) => row._id === PAYOUT_TYPE.DELIVERY_PARTNER)?.amount || 0;

  const totalPlatformEarning = roundCurrency(platformGross[0]?.amount || 0);
  // "Available Balance" in the admin wallet UI is the platform's free cash:
  // funds actually held (captured online payments + remitted COD, less processed
  // payouts) minus payout liabilities already owed to sellers and riders.
  const availableBalanceVirtual = roundCurrency(
    Math.max(
      roundCurrency(adminWallet.availableBalance || 0) -
        roundCurrency(sellerPendingPayouts) -
        roundCurrency(riderPendingPayouts),
      0,
    ),
  );

  return {
    totalPlatformEarning,
    totalAdminEarning: roundCurrency(adminEarning[0]?.amount || 0),
    // part of that earning on cash orders whose cash has not reached the platform yet
    adminEarningCashPending: roundCurrency(adminEarning[0]?.cashPending || 0),
    availableBalance: availableBalanceVirtual,
    walletAvailableBalance: roundCurrency(adminWallet.availableBalance || 0),
    systemFloatCOD: roundCurrency(systemFloatCOD[0]?.amount || 0),
    sellerPendingPayouts: roundCurrency(sellerPendingPayouts),
    deliveryPendingPayouts: roundCurrency(riderPendingPayouts),
    reconciledOnlineInflows: roundCurrency(onlineCollection[0]?.amount || 0),
    reconciledCODInflows: roundCurrency(codReconciled[0]?.amount || 0),
  };
}

/**
 * The four plain numbers of the admin Wallet page (everything in rupees):
 *
 *   platformHolds   money the platform is holding: its own wallet + the sellers' and riders' wallets (money
 *                   already moved to them but not withdrawn yet) + withdrawals asked and not paid yet.
 *                   (Customer refund-wallet balances sit inside the platform wallet figure.)
 *   owedToPartners  what sellers and riders can still claim: payouts not processed yet (this includes seller
 *                   money held for the return window) + their wallet balances + withdrawals waiting.
 *   riderCash       cash that riders collected from customers and have not handed over yet.
 *   ourEarning      what the platform really earned (commission + fees - rider / courier cost - coupons).
 *
 * platformHolds - owedToPartners is the platform's own free money (the old "available balance").
 * `summary` is the result of getAdminFinanceSummary() (passed in so nothing is queried twice).
 */
export async function getAdminMoneyOverview(summary) {
  const base = summary || (await getAdminFinanceSummary());
  const [walletRows, withdrawalRows, courierRows] = await Promise.all([
    Wallet.aggregate([
      { $match: { ownerType: { $in: [OWNER_TYPE.SELLER, OWNER_TYPE.DELIVERY_PARTNER] } } },
      { $group: { _id: "$ownerType", amount: { $sum: "$availableBalance" } } },
    ]),
    // withdrawals that were already taken out of the partner's wallet and wait for the admin to pay
    Transaction.aggregate([
      {
        $match: {
          type: "Withdrawal",
          userModel: { $in: ["Seller", "Delivery"] },
          status: { $in: ["Pending", "Processing"] },
          "meta.walletDebited": true,
        },
      },
      { $group: { _id: "$userModel", amount: { $sum: { $abs: "$amount" } } } },
    ]),
    // cash of courier (Shiprocket) COD orders that the courier has not paid to us yet
    Order.aggregate([
      { $match: { paymentMode: "COD", fulfillmentType: "SHIPROCKET", "paymentBreakdown.codPendingAmount": { $gt: 0 } } },
      { $group: { _id: null, amount: { $sum: "$paymentBreakdown.codPendingAmount" } } },
    ]),
  ]);
  const pick = (rows, id) => roundCurrency(rows.find((row) => row._id === id)?.amount || 0);

  const sellerWallets = pick(walletRows, OWNER_TYPE.SELLER);
  const riderWallets = pick(walletRows, OWNER_TYPE.DELIVERY_PARTNER);
  const sellerWithdrawals = pick(withdrawalRows, "Seller");
  const riderWithdrawals = pick(withdrawalRows, "Delivery");

  const owedToSellers = roundCurrency((base.sellerPendingPayouts || 0) + sellerWallets + sellerWithdrawals);
  const owedToRiders = roundCurrency((base.deliveryPendingPayouts || 0) + riderWallets + riderWithdrawals);
  const platformHolds = roundCurrency(
    (base.walletAvailableBalance || 0) + sellerWallets + riderWallets + sellerWithdrawals + riderWithdrawals,
  );

  return {
    platformHolds,
    owedToPartners: roundCurrency(owedToSellers + owedToRiders),
    owedToSellers,
    owedToRiders,
    riderCash: roundCurrency(base.systemFloatCOD || 0),
    courierCash: roundCurrency(courierRows[0]?.amount || 0),
    ourEarning: roundCurrency(base.totalAdminEarning || 0),
    ourEarningCashPending: roundCurrency(base.adminEarningCashPending || 0),
  };
}

/**
 * Phase 4 P4-2 — canonical reader for "what's the customer's wallet
 * balance". Reads from the Wallet collection first (authoritative); if
 * no Wallet row exists yet for this user (legacy customers from before
 * the Wallet refactor), falls back to `User.walletBalance`.
 *
 * Returns 0 if neither source has a record. Never throws.
 *
 * Callers that previously read `user.walletBalance` directly can switch
 * to this helper; once every caller has migrated, the User.walletBalance
 * field can be removed (Phase 7).
 */
export async function getCustomerBalance(userId, { session } = {}) {
  if (!userId) return 0;
  try {
    const wallet = await Wallet.findOne(
      { ownerType: OWNER_TYPE.CUSTOMER, ownerId: userId },
      { availableBalance: 1 },
      session ? { session } : {},
    ).lean();
    if (wallet) return roundCurrency(wallet.availableBalance || 0);
  } catch {
    // fall through to legacy
  }

  try {
    const user = await User.findById(
      userId,
      { walletBalance: 1 },
      session ? { session } : {},
    ).lean();
    return roundCurrency(user?.walletBalance || 0);
  } catch {
    return 0;
  }
}
