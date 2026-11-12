import React, { useCallback, useEffect, useState } from "react";
import Card from "@shared/components/ui/Card";
import { Calculator, Download, Eye, EyeOff, Loader2, MessageCircle, Search, X } from "lucide-react";
import { useToast } from "@shared/components/ui/Toast";
import { adminEmiApi } from "../services/api/emiApi";
import { downloadEmiPdf, emiDate, emiMoney } from "@shared/utils/emiPdf";

const STATUS_TABS = [
  ["all", "All"],
  ["new", "New"],
  ["contacted", "Contacted"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["cancelled", "Cancelled"],
];

const STATUS_STYLE = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-extrabold uppercase border ${STATUS_STYLE[status] || STATUS_STYLE.new}`}>
      {status}
    </span>
  );
}

function Detail({ id, onClose, onChanged }) {
  const { showToast } = useToast();
  const [quote, setQuote] = useState(null);
  const [note, setNote] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (reveal) => {
      const res = await adminEmiApi.getEmiQuote(id, reveal);
      const q = res.data?.result;
      setQuote(q);
      setNote(q?.adminNote || "");
      return q;
    },
    [id],
  );

  useEffect(() => {
    load(false).catch((err) => showToast(err?.response?.data?.message || "Could not load quotation", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const update = async (patch, okMessage) => {
    setBusy(true);
    try {
      const res = await adminEmiApi.updateEmiQuote(id, patch);
      setQuote((q) => ({ ...q, ...res.data.result, customer: q.customer }));
      onChanged();
      showToast(okMessage, "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not update", "error");
    } finally {
      setBusy(false);
    }
  };

  const reveal = async () => {
    try {
      await load(true);
      setRevealed(true);
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not reveal", "error");
    }
  };

  const pdf = async () => {
    setBusy(true);
    try {
      const cfg = (await adminEmiApi.getEmiConfig()).data?.result || {};
      await downloadEmiPdf({
        quote: { quoteId: quote.quoteId, customer: quote.customer, product: quote.product, imei1: quote.imei1, imei2: quote.imei2, result: quote.result },
        print: { shop: cfg.shop, terms: cfg.terms, lateFee: cfg.lateFee },
      });
    } catch (err) {
      showToast(err?.message || "Could not create the PDF", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-xs font-bold text-slate-500">Quotation</p>
            <h2 className="text-lg font-black text-slate-900">{quote?.quoteId || "…"}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-100" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {!quote ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="animate-spin text-blue-600" size={30} />
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <section className="rounded-2xl border border-slate-100 p-4 space-y-1.5">
              <p className="text-sm font-extrabold text-slate-900">{quote.customer.name}</p>
              <p className="text-sm text-slate-600">{quote.customer.phone}</p>
              <p className="text-sm text-slate-600">
                PAN: <span className="font-mono font-bold">{revealed ? quote.customer.pan || "—" : quote.customer.panMasked || "—"}</span>
              </p>
              <p className="text-sm text-slate-600">
                Aadhaar: <span className="font-mono font-bold">{revealed ? quote.customer.aadhaar || "—" : quote.customer.aadhaarMasked || "—"}</span>
              </p>
              {(quote.customer.panMasked || quote.customer.aadhaarMasked) && !revealed && (
                <button type="button" onClick={reveal} className="text-xs font-bold text-blue-600 inline-flex items-center gap-1 pt-1">
                  <Eye size={13} /> Show full numbers
                </button>
              )}
              {revealed && (
                <button type="button" onClick={() => { setRevealed(false); load(false); }} className="text-xs font-bold text-slate-500 inline-flex items-center gap-1 pt-1">
                  <EyeOff size={13} /> Hide
                </button>
              )}
            </section>

            <section className="rounded-2xl border border-slate-100 p-4">
              <p className="text-sm font-extrabold text-slate-900">
                {quote.product.name}
                {quote.product.variantName ? ` (${quote.product.variantName})` : ""}
              </p>
              <p className="text-xs text-slate-500 mt-1">IMEI 1: {quote.imei1 || "—"} · IMEI 2: {quote.imei2 || "—"}</p>
              <div className="grid grid-cols-2 gap-2.5 mt-3 text-sm">
                {[
                  ["Product price", emiMoney(quote.result.price)],
                  ["Down payment", emiMoney(quote.result.downPayment)],
                  ["Finance amount", emiMoney(quote.result.financeAmount)],
                  ["Interest type", quote.result.interestType === "reducing" ? "Reducing" : "Flat"],
                  ["File charge", emiMoney(quote.result.fileCharge)],
                  ["Interest (after file charge)", emiMoney(quote.result.remainingInterest)],
                  ["Total payable", emiMoney(quote.result.totalPayable)],
                  ["Duration", `${quote.result.months} months`],
                  [quote.result.emiVaries ? "First EMI" : "Monthly EMI", emiMoney(quote.result.monthlyEmi)],
                  ["First EMI date", emiDate(quote.result.firstEmiDate)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-slate-50 p-2.5">
                    <p className="text-[11px] text-slate-500">{k}</p>
                    <p className="font-extrabold text-slate-900">{v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-[13px]">
                  <tbody>
                    {quote.result.schedule.map((s) => (
                      <tr key={s.no} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-1.5 text-slate-500">{s.no}</td>
                        <td className="px-3 py-1.5">{emiDate(s.dueDate)}</td>
                        <td className="px-3 py-1.5 text-right font-bold">{emiMoney(s.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Saved with: {quote.settingsSnapshot?.interestType} interest, {quote.settingsSnapshot?.interestRatePerMonth}% a month. Later setting changes do not affect this quotation.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-100 p-4 space-y-3">
              <p className="text-sm font-extrabold text-slate-900">Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_TABS.slice(1).map(([value, name]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={busy}
                    onClick={() => update({ status: value }, `Marked ${name.toLowerCase()}`)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border ${quote.status === value ? STATUS_STYLE[value] : "bg-white text-slate-500 border-slate-200"}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <textarea className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/25" rows={3} placeholder="Note for your team (not shown to the customer)" value={note} onChange={(e) => setNote(e.target.value)} />
              <button type="button" disabled={busy} onClick={() => update({ adminNote: note }, "Note saved")} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-60">
                Save note
              </button>
            </section>

            <div className="flex gap-2.5">
              <a
                href={`https://wa.me/91${String(quote.customer.phone).replace(/\D/g, "").slice(-10)}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 rounded-xl bg-[#25D366] text-white text-sm font-extrabold flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} /> WhatsApp customer
              </a>
              <button type="button" disabled={busy} onClick={pdf} className="flex-1 py-3 rounded-xl bg-slate-900 text-white text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-60">
                <Download size={16} /> PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const FinanceRequests = () => {
  const { showToast } = useToast();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1, newCount: 0 });
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminEmiApi.getEmiQuotes({ status, search: search.trim() || undefined, page, limit: 20 });
      setData(res.data?.result || { items: [], total: 0, totalPages: 1, newCount: 0 });
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not load quotations", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-5 pb-12">
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
          EMI Quotation Requests
          <span className="p-2 bg-blue-100 rounded-xl">
            <Calculator className="h-5 w-5 text-blue-600" />
          </span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Every quotation a customer sends from a product page is saved here, even if the WhatsApp message is never sent.
          {data.newCount > 0 && <span className="ml-1 font-bold text-blue-600">{data.newCount} new.</span>}
        </p>
      </div>

      <Card className="p-4 border-none ring-1 ring-slate-100 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map(([value, name]) => (
            <button
              key={value}
              type="button"
              onClick={() => { setStatus(value); setPage(1); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border ${status === value ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"}`}
            >
              {name}
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/25"
              placeholder="Search name, phone, ID, product"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="animate-spin text-blue-600" size={28} />
          </div>
        ) : data.items.length === 0 ? (
          <p className="py-14 text-center text-sm text-slate-500">No quotations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3">Quotation</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3 text-right">Finance</th>
                  <th className="py-2 pr-3 text-right">EMI</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((q) => (
                  <tr key={q._id} onClick={() => setOpenId(q._id)} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50">
                    <td className="py-3 pr-3">
                      <p className="font-mono font-bold text-slate-900">{q.quoteId}</p>
                      <p className="text-[11px] text-slate-500">{new Date(q.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <p className="font-bold text-slate-900">{q.customer.name}</p>
                      <p className="text-[11px] text-slate-500">{q.customer.phone}</p>
                    </td>
                    <td className="py-3 pr-3 max-w-[220px]">
                      <p className="truncate text-slate-800">{q.product.name}</p>
                      {q.product.variantName && <p className="text-[11px] text-slate-500 truncate">{q.product.variantName}</p>}
                    </td>
                    <td className="py-3 pr-3 text-right font-bold">{emiMoney(q.result.financeAmount)}</td>
                    <td className="py-3 pr-3 text-right">
                      <p className="font-bold">{emiMoney(q.result.monthlyEmi)}</p>
                      <p className="text-[11px] text-slate-500">× {q.result.months}</p>
                    </td>
                    <td className="py-3 pr-3"><StatusBadge status={q.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.totalPages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold disabled:opacity-40">Previous</button>
            <span className="text-xs text-slate-500">Page {data.page || page} of {data.totalPages}</span>
            <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold disabled:opacity-40">Next</button>
          </div>
        )}
      </Card>

      {openId && <Detail id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
};

export default FinanceRequests;
