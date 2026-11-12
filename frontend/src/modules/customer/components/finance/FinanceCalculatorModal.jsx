import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calculator, ChevronDown, Download, Loader2, MessageCircle, X } from "lucide-react";
import { customerApi } from "../../services/customerApi";
import { useAuth } from "@core/context/AuthContext";
import { useToast } from "@shared/components/ui/Toast";
import { downloadEmiPdf, emiDate, emiMoney } from "@shared/utils/emiPdf";
import { validateEmiForm } from "@shared/utils/emiForm";
import { openWhatsappChat, isMobileDevice } from "@shared/utils/whatsappLink";
import { copyText } from "@shared/utils/clipboard";
import { toast } from "sonner";

const inputCls =
  "w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-white text-[15px] text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder:text-slate-400";
const labelCls = "block text-[12px] font-semibold text-slate-600 mb-1.5";

function Stat({ label, value, tone = "default" }) {
  return (
    <div className={tone === "good" ? "rounded-xl bg-emerald-50 p-3" : "rounded-xl bg-slate-50 p-3"}>
      <p className="text-[11px] text-slate-500 mb-1">{label}</p>
      <p className={`text-[17px] font-extrabold leading-tight ${tone === "good" ? "text-emerald-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

/**
 * Finance (EMI) calculator for one product. The product, variant and price come from the
 * server (auto-filled, not editable); the customer enters the down payment and duration and
 * sees the full breakdown, then sends the quotation on WhatsApp or downloads it as a PDF.
 */
export default function FinanceCalculatorModal({ productId, variantKey, onClose }) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [info, setInfo] = useState(null); // { available, reason, config, product }
  const [infoError, setInfoError] = useState("");

  const [downPayment, setDownPayment] = useState("");
  const [months, setMonths] = useState("");
  const [imei1, setImei1] = useState("");
  const [imei2, setImei2] = useState("");
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(String(user?.phone || "").replace(/\D/g, "").slice(-10));
  const [pan, setPan] = useState("");
  const [aadhaar, setAadhaar] = useState("");

  const [calc, setCalc] = useState({ loading: false, result: null, error: "" });
  const [working, setWorking] = useState(null); // "whatsapp" | "pdf" | null
  const [showSchedule, setShowSchedule] = useState(false);
  const calcSeq = useRef(0);
  const quoteCache = useRef({ key: "", data: null });

  // Lock page scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Product details, auto-filled from the server.
  useEffect(() => {
    let alive = true;
    setInfo(null);
    setInfoError("");
    customerApi
      .getEmiProductInfo(productId, variantKey)
      .then((res) => alive && setInfo(res.data?.result || null))
      .catch((err) => alive && setInfoError(err?.response?.data?.message || "Could not load finance details. Please try again."));
    return () => {
      alive = false;
    };
  }, [productId, variantKey]);

  // Live calculation (the server does the maths).
  useEffect(() => {
    if (!info?.available || !months || downPayment === "") {
      setCalc({ loading: false, result: null, error: "" });
      return undefined;
    }
    const seq = ++calcSeq.current;
    setCalc((c) => ({ ...c, loading: true, error: "" }));
    const timer = setTimeout(async () => {
      try {
        const res = await customerApi.calculateEmi({
          productId,
          variantSku: variantKey,
          downPayment: Number(downPayment),
          months: Number(months),
        });
        if (seq === calcSeq.current) setCalc({ loading: false, result: res.data?.result || null, error: "" });
      } catch (err) {
        if (seq === calcSeq.current) {
          setCalc({ loading: false, result: null, error: err?.response?.data?.message || "Could not calculate. Please try again." });
        }
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [info, productId, variantKey, downPayment, months]);

  const form = useMemo(() => ({ name, phone, pan, aadhaar, imei1, imei2 }), [name, phone, pan, aadhaar, imei1, imei2]);

  /** One saved quotation per set of inputs, shared by both buttons. */
  const ensureQuote = async () => {
    const key = JSON.stringify([productId, variantKey, downPayment, months, form]);
    if (quoteCache.current.key === key && quoteCache.current.data) return quoteCache.current.data;
    const res = await customerApi.createEmiQuote({
      productId,
      variantSku: variantKey,
      downPayment: Number(downPayment),
      months: Number(months),
      imei1: form.imei1,
      imei2: form.imei2,
      customer: { name: form.name, phone: form.phone, pan: form.pan, aadhaar: form.aadhaar },
    });
    const data = res.data?.result;
    quoteCache.current = { key, data };
    return data;
  };

  const precheck = () => {
    const problem = validateEmiForm(form, { hasResult: Boolean(calc.result) });
    if (problem) {
      showToast(problem, "error");
      return false;
    }
    return true;
  };

  const sendWhatsapp = async () => {
    if (working || !precheck()) return;
    setWorking("whatsapp");
    try {
      const data = await ensureQuote();
      // Copy the message first (a tab that is not in focus cannot write to the clipboard). If WhatsApp
      // opens the chat without the text, which some installed WhatsApp Web apps do, it can just be pasted.
      const copied = await copyText(data.message);
      // Straight into the shop's chat with the quotation typed: the WhatsApp app on a phone,
      // WhatsApp Web on a computer. The customer only has to press Send.
      openWhatsappChat(data.whatsappUrl);
      if (copied && !isMobileDevice()) {
        toast.success("Quotation saved and copied. WhatsApp is opening - press Send. If the chat opens empty, paste with Ctrl+V.", { duration: 10000 });
      } else {
        showToast("Quotation saved. WhatsApp is opening - press Send.", "success");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not create the quotation. Please try again.", "error");
    } finally {
      setWorking(null);
    }
  };

  const savePdf = async () => {
    if (working || !precheck()) return;
    setWorking("pdf");
    try {
      const data = await ensureQuote();
      await downloadEmiPdf({ quote: data.quote, print: data.print });
      showToast("PDF downloaded.", "success");
    } catch (err) {
      console.error("[EMI] PDF failed:", err);
      showToast(err?.response?.data?.message || "Could not create the PDF. Please try again.", "error");
    } finally {
      setWorking(null);
    }
  };

  const r = calc.result;
  const interestLabel = info?.config?.interestType === "reducing" ? "Reducing" : "Flat";

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]" onClick={() => !working && onClose()} />
      <div className="relative w-full sm:max-w-lg max-h-[94vh] bg-[#F5F7FA] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calculator size={19} />
            </div>
            <div>
              <h2 className="text-[16px] font-extrabold text-slate-900 leading-tight">EMI / Finance Calculator</h2>
              <p className="text-[11.5px] text-slate-500">Check your EMI and send the quotation to the shop</p>
            </div>
          </div>
          <button type="button" onClick={() => !working && onClose()} className="p-2 rounded-full hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 space-y-3.5">
          {!info && !infoError && (
            <div className="py-14 flex justify-center">
              <Loader2 className="animate-spin text-blue-600" size={30} />
            </div>
          )}

          {infoError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">{infoError}</p>}

          {info && !info.available && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">{info.reason || "Finance is not available for this product."}</p>
          )}

          {info?.available && (
            <>
              {/* Product (auto-filled) */}
              <section className="bg-white rounded-2xl p-3.5 border border-slate-100 flex items-center gap-3">
                {info.product.image ? (
                  <img src={info.product.image} alt="" className="h-16 w-16 rounded-xl object-cover bg-slate-100 shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-slate-100 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-slate-900 leading-snug line-clamp-2">{info.product.name}</p>
                  {info.product.variantName && <p className="text-[12px] text-slate-500 mt-0.5">{info.product.variantName}</p>}
                  <p className="text-[16px] font-extrabold text-slate-900 mt-1">{emiMoney(info.product.price)}</p>
                </div>
              </section>

              {/* Inputs */}
              <section className="bg-white rounded-2xl p-4 border border-slate-100 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Product price</label>
                    <input className={`${inputCls} bg-slate-50 font-semibold`} value={emiMoney(info.product.price)} readOnly aria-readonly="true" />
                  </div>
                  <div>
                    <label className={labelCls}>Down payment (₹) *</label>
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      placeholder="Amount you pay now"
                      value={downPayment}
                      onChange={(e) => setDownPayment(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>EMI duration *</label>
                    <select className={inputCls} value={months} onChange={(e) => setMonths(e.target.value)}>
                      <option value="">Choose months</option>
                      {info.config.tenures.map((t) => (
                        <option key={t} value={t}>
                          {t} {t === 1 ? "month" : "months"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Interest type</label>
                    <input className={`${inputCls} bg-slate-50 font-semibold`} value={interestLabel} readOnly aria-readonly="true" />
                  </div>
                  <div>
                    <label className={labelCls}>IMEI 1 (optional)</label>
                    <input className={inputCls} inputMode="numeric" maxLength={15} placeholder="15 digits" value={imei1} onChange={(e) => setImei1(e.target.value.replace(/\D/g, ""))} />
                  </div>
                  <div>
                    <label className={labelCls}>IMEI 2 (optional)</label>
                    <input className={inputCls} inputMode="numeric" maxLength={15} placeholder="15 digits" value={imei2} onChange={(e) => setImei2(e.target.value.replace(/\D/g, ""))} />
                  </div>
                </div>
                {info.config.minDownPaymentPercent > 0 && (
                  <p className="text-[11.5px] text-slate-500">
                    Minimum down payment is {info.config.minDownPaymentPercent}% of the price ({emiMoney((info.product.price * info.config.minDownPaymentPercent) / 100)}).
                  </p>
                )}
              </section>

              {/* Result */}
              <section className="bg-white rounded-2xl p-4 border border-slate-100">
                <h3 className="text-[14px] font-extrabold text-slate-900 mb-3">Your EMI</h3>
                {!r && !calc.loading && !calc.error && (
                  <p className="text-[13px] text-slate-500">Enter the down payment and choose the duration to see your EMI.</p>
                )}
                {calc.loading && (
                  <div className="py-3 flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="animate-spin" size={16} /> Calculating…
                  </div>
                )}
                {calc.error && !calc.loading && <p className="text-[13px] text-rose-600">{calc.error}</p>}
                {r && !calc.loading && (
                  <>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Stat label="Finance amount" value={emiMoney(r.financeAmount)} />
                      <Stat label="EMI duration" value={`${r.months} months`} />
                      <Stat label="File charge" value={emiMoney(r.fileCharge)} />
                      <Stat label="Interest" value={emiMoney(r.remainingInterest)} />
                      <Stat label={r.emiVaries ? "First EMI" : "Monthly EMI"} value={emiMoney(r.monthlyEmi)} tone="good" />
                      <Stat label="First EMI date" value={emiDate(r.firstEmiDate)} tone="good" />
                    </div>
                    <p className="text-[12px] text-slate-500 mt-2.5">
                      Total payable: <span className="font-bold text-slate-800">{emiMoney(r.totalPayable)}</span> (includes file charge)
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowSchedule((s) => !s)}
                      className="mt-2 text-[12.5px] font-bold text-blue-600 inline-flex items-center gap-1"
                    >
                      {showSchedule ? "Hide" : "Show"} all instalments
                      <ChevronDown size={14} className={showSchedule ? "rotate-180" : ""} />
                    </button>
                    {showSchedule && (
                      <div className="mt-2 rounded-xl border border-slate-100 overflow-hidden">
                        <table className="w-full text-[12.5px]">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold">#</th>
                              <th className="text-left px-3 py-2 font-semibold">Due date</th>
                              <th className="text-right px-3 py-2 font-semibold">EMI</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.schedule.map((s) => (
                              <tr key={s.no} className="border-t border-slate-100">
                                <td className="px-3 py-1.5">{s.no}</td>
                                <td className="px-3 py-1.5">{emiDate(s.dueDate)}</td>
                                <td className="px-3 py-1.5 text-right font-semibold">{emiMoney(s.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* Customer details */}
              <section className="bg-white rounded-2xl p-4 border border-slate-100 space-y-3">
                <h3 className="text-[14px] font-extrabold text-slate-900">Your details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Full name *</label>
                    <input className={inputCls} autoComplete="name" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Mobile number *</label>
                    <input className={inputCls} inputMode="numeric" autoComplete="tel" maxLength={10} placeholder="10 digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
                  </div>
                  <div>
                    <label className={labelCls}>PAN (optional)</label>
                    <input className={`${inputCls} uppercase`} maxLength={10} placeholder="ABCDE1234F" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
                  </div>
                  <div>
                    <label className={labelCls}>Aadhaar (optional)</label>
                    <input className={inputCls} inputMode="numeric" maxLength={12} placeholder="12 digits" value={aadhaar} onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ""))} />
                  </div>
                </div>
                <p className="text-[11.5px] text-slate-500 leading-relaxed">
                  PAN and Aadhaar are stored encrypted and only the last digits are shown in the WhatsApp message.
                </p>
              </section>
            </>
          )}
        </div>

        {info?.available && (
          <div className="px-4 py-3 bg-white border-t border-slate-100 grid grid-cols-2 gap-2.5 shrink-0">
            <button
              type="button"
              onClick={sendWhatsapp}
              disabled={Boolean(working) || !r}
              className="py-3.5 rounded-xl bg-[#25D366] text-white font-extrabold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition"
            >
              {working === "whatsapp" ? <Loader2 size={17} className="animate-spin" /> : <MessageCircle size={17} />}
              Send on WhatsApp
            </button>
            <button
              type="button"
              onClick={savePdf}
              disabled={Boolean(working) || !r}
              className="py-3.5 rounded-xl bg-slate-900 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition"
            >
              {working === "pdf" ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
              Download PDF
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

