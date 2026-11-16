import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calculator, ChevronDown, Download, Loader2, MessageCircle, X } from "lucide-react";
import { customerApi } from "../../services/customerApi";
import { useAuth } from "@core/context/AuthContext";
import { useToast } from "@shared/components/ui/Toast";
import { downloadEmiPdf, emiDate, emiMoney } from "@shared/utils/emiPdf";
import { validateEmiForm, checkDownPayment, minDownPaymentAmount } from "@shared/utils/emiForm";
import { openWhatsappChat, isMobileDevice } from "@shared/utils/whatsappLink";
import { copyText } from "@shared/utils/clipboard";
import { toast } from "sonner";

const inputCls =
  "w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-white text-[15px] text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder:text-slate-400";
const labelCls = "block text-[12px] font-semibold text-slate-600 mb-1.5";

/** 10 digit mobile number from the customer's account (it may be stored with +91). */
const accountPhone = (u) => String(u?.phone || u?.mobile || u?.phoneNumber || "").replace(/\D/g, "").slice(-10);
const accountName = (u) => String(u?.name || u?.fullName || [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "").trim();

/**
 * Finance (EMI) calculator for one product. The product, variant and price come from the
 * server (auto-filled, not editable); the customer enters the down payment and duration and
 * sees the full breakdown, then sends the quotation on WhatsApp or downloads it as a PDF.
 */
export default function FinanceCalculatorModal({ productId, variantKey, onClose }) {
  const { user, authData } = useAuth();
  const { showToast } = useToast();

  const [info, setInfo] = useState(null); // { available, reason, config, product }
  const [infoError, setInfoError] = useState("");

  const [downPayment, setDownPayment] = useState("");
  const [months, setMonths] = useState("");
  // Name and phone come from the customer's account. The profile can arrive after this window
  // opens, so they are filled again when it does (unless the customer already typed over them).
  const [name, setName] = useState(accountName(user));
  const [phone, setPhone] = useState(accountPhone(user));
  const edited = useRef({ name: false, phone: false });
  const [pan, setPan] = useState("");
  const [aadhaar, setAadhaar] = useState("");

  const [calc, setCalc] = useState({ loading: false, options: null, error: "" });
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

  useEffect(() => {
    const n = accountName(user);
    if (!edited.current.name && n) setName(n);
    const p = accountPhone(user);
    if (!edited.current.phone && p) setPhone(p);
  }, [user]);

  // If the shared login state has not produced the profile (it can be late or missing for this
  // window), read the customer's own profile directly. Only when a customer is actually logged in,
  // so a guest never triggers a login-required request.
  const customerLoggedIn = Boolean(authData?.customer);
  useEffect(() => {
    if (!customerLoggedIn) return undefined;
    let alive = true;
    customerApi
      .getProfile()
      .then((res) => {
        const u = res?.data?.result;
        if (!alive || !u) return;
        const n = accountName(u);
        const p = accountPhone(u);
        if (!edited.current.name && n) setName((cur) => cur || n);
        if (!edited.current.phone && p) setPhone((cur) => cur || p);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [customerLoggedIn]);

  // Product details, auto-filled from the server.
  useEffect(() => {
    let alive = true;
    setInfo(null);
    setInfoError("");
    customerApi
      .getEmiProductInfo(productId, variantKey)
      .then((res) => {
        if (!alive) return;
        const data = res.data?.result || null;
        setInfo(data);
        // Down payment starts at the admin's minimum; the customer may only go up from there.
        if (data?.available) setDownPayment(String(minDownPaymentAmount(data.product.price, data.config.minDownPaymentPercent)));
      })
      .catch((err) => alive && setInfoError(err?.response?.data?.message || "Could not load finance details. Please try again."));
    return () => {
      alive = false;
    };
  }, [productId, variantKey]);

  const price = info?.product?.price || 0;
  const minPercent = info?.config?.minDownPaymentPercent || 0;
  const dp = useMemo(() => checkDownPayment(price, minPercent, downPayment), [price, minPercent, downPayment]);

  // Live calculation of every duration the admin allows (the server does the maths).
  // Nothing is requested while the down payment is invalid (the error is already on screen).
  useEffect(() => {
    if (!info?.available || !dp.ok) {
      calcSeq.current += 1;
      setCalc({ loading: false, options: null, error: "" });
      return undefined;
    }
    const seq = ++calcSeq.current;
    setCalc((c) => ({ ...c, loading: true, error: "" }));
    const timer = setTimeout(async () => {
      try {
        const res = await customerApi.calculateEmiOptions({ productId, variantSku: variantKey, downPayment: Number(downPayment) });
        if (seq === calcSeq.current) setCalc({ loading: false, options: res.data?.result?.options || [], error: "" });
      } catch (err) {
        if (seq === calcSeq.current) {
          setCalc({ loading: false, options: null, error: err?.response?.data?.message || "Could not calculate. Please try again." });
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [info, productId, variantKey, downPayment, dp.ok]);

  // The option the customer tapped; it carries the full breakdown the quotation is built from.
  const selected = useMemo(
    () => (calc.options || []).find((o) => String(o.months) === String(months)) || null,
    [calc.options, months],
  );

  const form = useMemo(() => ({ name, phone, pan, aadhaar }), [name, phone, pan, aadhaar]);

  /** One saved quotation per set of inputs, shared by both buttons. */
  const ensureQuote = async () => {
    const key = JSON.stringify([productId, variantKey, downPayment, months, form]);
    if (quoteCache.current.key === key && quoteCache.current.data) return quoteCache.current.data;
    const res = await customerApi.createEmiQuote({
      productId,
      variantSku: variantKey,
      downPayment: Number(downPayment),
      months: Number(months),
      customer: { name: form.name, phone: form.phone, pan: form.pan, aadhaar: form.aadhaar },
    });
    const data = res.data?.result;
    quoteCache.current = { key, data };
    return data;
  };

  const precheck = () => {
    const problem = validateEmiForm(form, { hasResult: Boolean(selected && !calc.loading) });
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

  const r = calc.loading ? null : selected?.result || null;
  const loanAmount = dp.ok ? price - Number(downPayment) : null;
  const fileCharge = dp.ok && calc.options?.length ? calc.options[0].result.fileCharge : null;

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
                <div className="space-y-3.5">
                  <div>
                    <label className={labelCls}>Product Cost (₹)</label>
                    <input className={`${inputCls} bg-slate-50 font-semibold`} value={price} readOnly aria-readonly="true" />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Down Payment (₹) {minPercent > 0 && <>• Auto {minPercent}%</>} *
                    </label>
                    <input
                      className={`${inputCls} ${dp.error ? "!border-rose-400 !ring-2 !ring-rose-500/20" : ""}`}
                      inputMode="numeric"
                      placeholder="Amount you pay now"
                      aria-invalid={Boolean(dp.error)}
                      value={downPayment}
                      onChange={(e) => setDownPayment(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    />
                    {dp.error && (
                      <p role="alert" className="text-[12px] text-rose-600 mt-1.5">
                        {dp.error}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-emerald-50 p-3 text-center">
                      <p className="text-[11px] text-slate-500 mb-0.5">Down Payment</p>
                      <p className="text-[16px] font-extrabold text-emerald-800">{downPayment === "" ? "—" : `${dp.percent.toFixed(2)}%`}</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-3 text-center">
                      <p className="text-[11px] text-slate-500 mb-0.5">Minimum ({minPercent}%)</p>
                      <p className="text-[16px] font-extrabold text-emerald-800">{emiMoney(dp.minAmount)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-emerald-50 p-3.5 text-center">
                      <p className="text-[11.5px] text-slate-500 mb-0.5">Loan Amount</p>
                      <p className="text-[19px] font-extrabold text-emerald-800" data-testid="loan-amount">
                        {loanAmount === null ? "—" : emiMoney(loanAmount)}
                      </p>
                    </div>
                    {/* The file charge depends only on the loan amount, so it is the same for every duration. */}
                    <div className="rounded-xl bg-emerald-50 p-3.5 text-center">
                      <p className="text-[11.5px] text-slate-500 mb-0.5">File Charge</p>
                      <p className="text-[19px] font-extrabold text-emerald-800" data-testid="file-charge">
                        {fileCharge === null ? "—" : emiMoney(fileCharge)}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* EMI options: one card per duration the admin allows */}
              <section className="bg-white rounded-2xl p-4 border border-slate-100">
                <h3 className="text-[14px] font-extrabold text-slate-900 mb-3 rounded-xl bg-emerald-50 px-3 py-2.5">EMI Details</h3>
                {!dp.ok && <p className="text-[13px] text-slate-500">Enter a valid down payment to see your EMI options.</p>}
                {dp.ok && calc.loading && !calc.options && (
                  <div className="py-3 flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="animate-spin" size={16} /> Calculating…
                  </div>
                )}
                {calc.error && !calc.loading && <p className="text-[13px] text-rose-600">{calc.error}</p>}
                {dp.ok && calc.options && (
                  <div className={`space-y-2.5 transition-opacity ${calc.loading ? "opacity-50" : ""}`}>
                    <p className="text-[12px] text-slate-500">Tap a duration to choose it.</p>
                    {calc.options.map((o) => {
                      const active = String(o.months) === String(months);
                      return (
                        <button
                          key={o.months}
                          type="button"
                          data-testid={`emi-option-${o.months}`}
                          aria-pressed={active}
                          onClick={() => setMonths(String(o.months))}
                          className={`w-full grid grid-cols-3 items-center gap-2 rounded-xl border px-3 py-3 text-center transition ${
                            active ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30" : "border-slate-200 bg-white"
                          }`}
                        >
                          <span className="text-[12.5px] text-slate-600">
                            {o.months} {o.months === 1 ? "Month" : "Months"}
                          </span>
                          <span>
                            <span className="block text-[10.5px] text-slate-500">Interest</span>
                            <span className="block text-[14px] font-extrabold text-emerald-800">{emiMoney(o.interest ?? o.result.interest)}</span>
                          </span>
                          <span>
                            <span className="block text-[10.5px] text-slate-500">{o.result.emiVaries ? "First EMI" : "Monthly EMI"}</span>
                            <span className="block text-[14px] font-extrabold text-emerald-800">{emiMoney(o.result.monthlyEmi)}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* The chosen duration: total payable, then the instalment list */}
                {r && (
                  <div className="mt-3.5">
                    <p className="text-[12.5px] text-slate-500" data-testid="total-payable">
                      Total payable: <span className="font-bold text-slate-800">{emiMoney(r.totalPayable)}</span> (loan + interest + file charge)
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
                  </div>
                )}
              </section>

              {/* Customer details */}
              <section className="bg-white rounded-2xl p-4 border border-slate-100 space-y-3">
                <h3 className="text-[14px] font-extrabold text-slate-900">Your details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Full name *</label>
                    <input className={inputCls} autoComplete="name" placeholder="Your full name" value={name} onChange={(e) => { edited.current.name = true; setName(e.target.value); }} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Mobile number *</label>
                    <input className={inputCls} inputMode="numeric" autoComplete="tel" maxLength={10} placeholder="10 digit mobile number" value={phone} onChange={(e) => { edited.current.phone = true; setPhone(e.target.value.replace(/\D/g, "")); }} />
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

