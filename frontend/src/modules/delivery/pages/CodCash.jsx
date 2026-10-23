import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  IndianRupee,
  RotateCw,
  ChevronLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  ArrowRight,
  X,
  FileText,
  ShieldCheck,
  Receipt
} from "lucide-react";
import { toast } from "sonner";
import Card from "@/shared/components/ui/Card";
import Button from "@/shared/components/ui/Button";
import { deliveryApi } from "../services/deliveryApi";

const RUPEE = "\u20B9";

function safeMoney(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

const CodCash = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [handoverNote, setHandoverNote] = useState("");
  const [data, setData] = useState({
    systemFloatCOD: 0,
    cashInHand: 0,
    toCollect: [],
    toRemit: [],
    pendingHandover: null,
    recentSettlements: [],
  });

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await deliveryApi.getCodCashSummary();
      if (res.data?.success && res.data?.result) {
        const result = res.data.result;
        setData({
          systemFloatCOD: safeMoney(result.systemFloatCOD),
          cashInHand: safeMoney(result.cashInHand),
          toCollect: Array.isArray(result.toCollect) ? result.toCollect : [],
          toRemit: Array.isArray(result.toRemit) ? result.toRemit : [],
          pendingHandover: result.pendingHandover || null,
          recentSettlements: Array.isArray(result.recentSettlements)
            ? result.recentSettlements
            : [],
        });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load COD cash details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const pendingOrdersCount =
    (Array.isArray(data.toCollect) ? data.toCollect.length : 0) +
    (Array.isArray(data.toRemit) ? data.toRemit.length : 0);

  const payableNowAmount = (Array.isArray(data.toRemit) ? data.toRemit : []).reduce(
    (sum, row) => sum + safeMoney(row.amountNetPending),
    0
  );

  const effectiveCashInHand = Math.max(data.cashInHand, payableNowAmount);

  const handleCreateHandoverSlip = async () => {
    if (submitting) return;
    if (payableNowAmount <= 0 && effectiveCashInHand <= 0) {
      toast.error("No cash in hand to submit.");
      return;
    }

    try {
      setSubmitting(true);
      const amountToSubmit = payableNowAmount > 0 ? payableNowAmount : effectiveCashInHand;
      const res = await deliveryApi.payCodCashToAdmin({
        amount: amountToSubmit,
        notes: handoverNote.trim() || undefined,
      });

      if (res.data?.success) {
        toast.success(
          res.data.result?.reference
            ? `Handover Slip #${res.data.result.reference} generated!`
            : "Cash handover request created!"
        );
        setIsHandoverModalOpen(false);
        setHandoverNote("");
        await fetchSummary();
      } else {
        toast.error(res.data?.message || "Failed to generate handover request");
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to submit cash handover");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#f1f4f8] min-h-screen pb-36 font-['Outfit',_sans-serif]">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 pt-4 pb-2 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2 -ml-1">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors"
            aria-label="Back"
          >
            <ChevronLeft size={22} className="text-slate-800" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
              COD Cash & Payments
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              Hub deposit & cash handover
            </p>
          </div>
        </div>

        <button
          onClick={fetchSummary}
          disabled={loading}
          className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Refresh"
        >
          <RotateCw size={18} className={loading ? "animate-spin text-slate-400" : ""} />
        </button>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* 1. Top Single Clear Card (No 3-times duplication) */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs relative overflow-hidden card-left-pill-orange">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Total Cash in Hand
              </p>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-1.5 tracking-tight leading-none">
                {RUPEE}{effectiveCashInHand.toLocaleString()}
              </h2>
              <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                {data.toRemit.length > 0
                  ? `Collected from ${data.toRemit.length} COD order${data.toRemit.length > 1 ? "s" : ""}. Please hand over this physical cash at your assigned Hub counter.`
                  : "You have ₹0 pending cash in hand. All collected COD cash is safely settled with Hub."}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100/70 flex items-center justify-center text-[#6666FF] shrink-0">
              <IndianRupee size={22} strokeWidth={2.5} />
            </div>
          </div>

          {/* Badges Row */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100 text-[11px] font-bold">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/50">
              <Clock size={13} />
              <span>{data.toRemit.length} Orders to Hand Over</span>
            </div>

            {data.toCollect.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/50">
                <AlertCircle size={13} />
                <span>{data.toCollect.length} In-Transit Orders</span>
              </div>
            )}

            {effectiveCashInHand === 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                <CheckCircle2 size={13} />
                <span>All Settled With Hub</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Handover Slip or Deposit Action */}
        {data.pendingHandover ? (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-3xl border border-amber-200 p-5 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-500 text-white shadow-2xs uppercase tracking-wider">
                <Clock size={12} />
                Waiting for Hub Confirmation
              </span>
              <span className="font-mono text-xs font-bold text-slate-500">
                {data.pendingHandover.createdAt
                  ? new Date(data.pendingHandover.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : ""}
              </span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Deposit Handover Slip
              </p>
              <div className="flex items-baseline justify-between mt-1">
                <p className="text-2xl font-black text-slate-900 tracking-tight">
                  {RUPEE}{data.pendingHandover.amount?.toLocaleString()}
                </p>
                <span className="text-xs font-mono font-black text-[#6666FF] bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                  Ref: #{data.pendingHandover.reference}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                Show this deposit reference code to the Hub Manager. Once they count and accept the physical cash, your balance will clear automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs card-left-pill-orange">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Hub Cash Handover
                </p>
                <h4 className="text-base font-bold text-slate-900 mt-0.5">
                  Ready to Deposit at Hub Counter?
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate slip when you reach the Hub office counter.
                </p>
              </div>

              <button
                onClick={() => {
                  if (effectiveCashInHand <= 0) {
                    return toast.info("No cash in hand to submit. All cleared!");
                  }
                  setIsHandoverModalOpen(true);
                }}
                disabled={effectiveCashInHand <= 0}
                className="h-10 px-4 rounded-full bg-gradient-to-r from-[#2e7d32] to-[#1b5e20] hover:from-[#2e7d32]/95 hover:to-[#1b5e20]/95 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs hover:scale-105 active:scale-95 transition-all select-none disabled:opacity-50 disabled:pointer-events-none shrink-0"
              >
                <span>Submit to Hub Counter</span>
                <ArrowRight size={13} strokeWidth={3} />
              </button>
            </div>
          </div>
        )}

        {/* 3. Orders To Submit to Platform */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden card-left-pill-orange">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">To Submit To Platform</h3>
              <p className="text-[11px] text-slate-500">
                Orders marked as collected. Net cash to be handed over at Hub.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {data.toRemit.length}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {data.toRemit.length > 0 ? (
              data.toRemit.map((row) => (
                <div
                  key={`remit-${row.orderId}`}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">Order #{row.orderId}</p>
                    <p className="text-[11px] font-medium text-slate-500">
                      Collected from Customer • Net platform cash
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">
                      {RUPEE}{safeMoney(row.amountNetPending).toLocaleString()}
                    </p>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      PENDING HANDOVER
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center px-4">
                <CheckCircle2 className="mx-auto text-emerald-500 mb-1.5" size={28} />
                <p className="text-xs font-bold text-slate-700">All cash handed over & verified by Admin</p>
                <p className="text-[11px] text-slate-400 mt-0.5">No pending COD orders to remit</p>
              </div>
            )}
          </div>
        </div>

        {/* 4. To Collect From Customer (In-Transit) */}
        {data.toCollect.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">To Collect From Customer</h3>
              <p className="text-[11px] text-slate-500">
                Active in-transit COD orders not yet marked as collected.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {data.toCollect.map((row) => (
                <div
                  key={`collect-${row.orderId}`}
                  className="px-5 py-3.5 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">Order #{row.orderId}</p>
                    <p className="text-[11px] font-medium text-slate-500">
                      Collect {RUPEE}{safeMoney(row.amountGross).toLocaleString()} (gross)
                    </p>
                  </div>
                  <p className="text-sm font-extrabold text-[#6666FF]">
                    {RUPEE}{safeMoney(row.amountNetExpected).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Settlement History Section (Recent Cash Submissions) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden card-left-pill-orange">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Recent Cash Submissions</h3>
              <p className="text-[11px] text-slate-500">
                Past COD settlements verified & received by Admin at Hub.
              </p>
            </div>
            <Receipt size={18} className="text-slate-400" />
          </div>

          <div className="divide-y divide-slate-100">
            {data.recentSettlements.length > 0 ? (
              data.recentSettlements.map((item, idx) => {
                const itemRef = item.reference || item.id || `CSH-SET-${idx}`;
                const formattedDate = item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Recent";

                return (
                  <div
                    key={itemRef}
                    className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">
                          {RUPEE}{safeMoney(item.amount).toLocaleString()}
                        </h4>
                        <p className="text-[11px] font-medium text-slate-500">
                          {formattedDate} • Ref: {itemRef}
                        </p>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-50 text-emerald-700 uppercase">
                      SETTLED AT HUB
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center px-4">
                <Receipt className="mx-auto text-slate-300 mb-1.5" size={28} />
                <p className="text-xs font-semibold text-slate-500">No past cash submissions recorded yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Handover Modal */}
      <AnimatePresence>
        {isHandoverModalOpen && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHandoverModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-sm relative z-10 overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Building2 size={18} className="text-[#6666FF]" />
                  Hub Cash Handover
                </h3>
                <button
                  onClick={() => setIsHandoverModalOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Amount to Deposit
                  </p>
                  <p className="text-3xl font-black text-slate-900 mt-1">
                    {RUPEE}{effectiveCashInHand.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Total from {data.toRemit.length} collected COD orders
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">
                    Hub Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main Hub counter / Cashier name"
                    value={handoverNote}
                    onChange={(e) => setHandoverNote(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none focus:border-[#6666FF] focus:ring-1 focus:ring-[#6666FF]/20 transition-all"
                  />
                </div>

                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100/60 text-[11px] text-amber-800 leading-relaxed font-medium">
                  <ShieldCheck size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Submitting will generate a Handover Reference Slip. Please show it to the Hub Manager to count and verify the cash.
                  </span>
                </div>

                <Button
                  onClick={handleCreateHandoverSlip}
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl font-bold text-sm shadow-md bg-gradient-to-r from-[#2e7d32] to-[#1b5e20] hover:from-[#2e7d32]/95 hover:to-[#1b5e20]/95 text-white"
                >
                  {submitting ? <RotateCw className="animate-spin mr-2" size={16} /> : null}
                  {submitting ? "GENERATING SLIP..." : "CONFIRM & GENERATE SLIP"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CodCash;
