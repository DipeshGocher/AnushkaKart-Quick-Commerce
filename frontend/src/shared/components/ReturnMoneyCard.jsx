import React from "react";
import { cn } from "@/lib/utils";

const rupees = (n) =>
  "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TITLE = {
  if_qc_passes: "If the quality check passes",
  applied: "What happened with the money",
  not_refunded: "No refund for this return",
};

function Row({ label, value, note, tone = "default", testId }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5" data-testid={testId}>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        {note && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{note}</p>}
      </div>
      <p
        className={cn(
          "text-xs font-black shrink-0",
          tone === "minus" ? "text-rose-600" : tone === "plus" ? "text-emerald-700" : "text-slate-900",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * "Paisa ka hisaab" of a return: who gets / gives how much. `money` comes from the server
 * (`returnMoney`); `role` decides which side is shown (a seller never sees the admin's commission).
 */
export default function ReturnMoneyCard({ money, role = "admin", className }) {
  if (!money) return null;
  const isAdmin = role === "admin";
  const done = money.status === "applied";
  const none = money.status === "not_refunded";
  const sellerPays = money.pickupFeePayer === "seller";

  const sellerNote = (() => {
    const parts = [];
    if (done) {
      if (money.fromPendingPayout > 0) parts.push(`${rupees(money.fromPendingPayout)} taken off the unpaid payout`);
      if (money.fromWallet > 0) parts.push(`${rupees(money.fromWallet)} from the wallet`);
      if (money.owedBySeller > 0) parts.push(`${rupees(money.owedBySeller)} still owed (taken from the next payouts)`);
      return parts.join(" · ");
    }
    return `What the seller earned on the returned items (${rupees(money.sellerShare)})${sellerPays ? ` + ${rupees(money.pickupFee)} pickup fee (seller's fault)` : ""}`;
  })();

  return (
    <div data-testid="return-money-card" className={cn("rounded-2xl border border-slate-200 bg-white p-3.5", className)}>
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Money breakdown</p>
      <p className="text-[11px] font-semibold text-slate-500 mb-2" data-testid="return-money-status">
        {TITLE[money.status] || ""}
      </p>

      {none ? (
        <p className="text-xs text-slate-600">The customer is not refunded; nothing is taken from the seller or the admin.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {role === "customer" ? (
            <Row label="Refund to your wallet" value={rupees(money.refundAmount)} tone="plus" testId="rm-customer" />
          ) : (
            <>
              <Row
                label="Customer is refunded"
                note="Price of the returned items, to the customer's wallet (delivery and platform fees are not refunded)"
                value={rupees(money.refundAmount)}
                tone="plus"
                testId="rm-customer"
              />
              <Row
                label={role === "seller" ? "Taken back from you" : "Taken back from the seller"}
                note={sellerNote}
                value={`− ${rupees(money.sellerCharged)}`}
                tone="minus"
                testId="rm-seller"
              />
              {isAdmin && (
                <Row
                  label="Admin commission given back"
                  note={
                    money.adminCommission > 0 && money.adminCommissionReversed === 0
                      ? "Not taken back: COD orders never booked this commission"
                      : "Commission earned on the returned items (delivery / platform fee stays with the admin)"
                  }
                  value={`− ${rupees(money.adminCommissionReversed)}`}
                  tone="minus"
                  testId="rm-admin"
                />
              )}
              <Row
                label="Return pickup fee"
                note={sellerPays ? "Paid by the seller (the return is the seller's fault)" : "Paid by the platform"}
                value={rupees(money.pickupFee)}
                testId="rm-pickup"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
