import React, { useEffect, useState } from "react";
import Card from "@shared/components/ui/Card";
import { Loader2, Plus, Save, Trash2, Calculator } from "lucide-react";
import { useToast } from "@shared/components/ui/Toast";
import { adminEmiApi } from "../services/api/emiApi";

const TENURE_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 24, 30, 36];

const field =
  "w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400";
const label = "block text-xs font-bold text-slate-600 mb-1.5";

function Section({ title, hint, children }) {
  return (
    <Card className="p-5 space-y-4 border-none ring-1 ring-slate-100">
      <div>
        <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

/** Turn the saved config into plain strings so every input stays editable while typing. */
function toForm(c) {
  return {
    enabled: c.enabled !== false,
    interestType: c.interestType || "flat",
    interestRatePerMonth: String(c.interestRatePerMonth ?? 5),
    fileChargeSlabs: (c.fileChargeSlabs || []).map((s) => ({ upTo: s.upTo == null ? "" : String(s.upTo), fileCharge: String(s.fileCharge ?? 0) })),
    tenures: [...(c.tenures || [])],
    dueDateRules: (c.dueDateRules || []).map((r) => ({ fromDay: String(r.fromDay), toDay: String(r.toDay), dueDay: String(r.dueDay) })),
    lateFee: String(c.lateFee ?? 0),
    minDownPaymentPercent: String(c.minDownPaymentPercent ?? 0),
    whatsappNumber: c.whatsappNumber || "",
    shop: { name: c.shop?.name || "", address: c.shop?.address || "", phone: c.shop?.phone || "" },
    terms: (c.terms || []).join("\n"),
  };
}

function toPayload(f) {
  return {
    enabled: f.enabled,
    interestType: f.interestType,
    interestRatePerMonth: f.interestRatePerMonth,
    fileChargeSlabs: f.fileChargeSlabs.map((s, i, arr) => ({
      upTo: i === arr.length - 1 ? null : s.upTo,
      fileCharge: s.fileCharge,
    })),
    tenures: f.tenures,
    dueDateRules: f.dueDateRules,
    lateFee: f.lateFee,
    minDownPaymentPercent: f.minDownPaymentPercent,
    whatsappNumber: f.whatsappNumber,
    shop: f.shop,
    terms: f.terms.split("\n"),
  };
}

const FinanceSettings = () => {
  const { showToast } = useToast();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    adminEmiApi
      .getEmiConfig()
      .then((res) => alive && setForm(toForm(res.data?.result || {})))
      .catch((err) => showToast(err?.response?.data?.message || "Could not load finance settings", "error"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminEmiApi.saveEmiConfig(toPayload(form));
      setForm(toForm(res.data?.result || {}));
      showToast("Finance settings saved", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const slabs = form.fileChargeSlabs;
  const updateSlab = (i, patch) => set({ fileChargeSlabs: slabs.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const addSlab = () => {
    const last = slabs[slabs.length - 1];
    const prevLimit = Number(slabs[slabs.length - 2]?.upTo || 0);
    set({ fileChargeSlabs: [...slabs.slice(0, -1), { upTo: String(prevLimit + 10000), fileCharge: "0" }, last] });
  };
  const removeSlab = (i) => set({ fileChargeSlabs: slabs.filter((_, idx) => idx !== i) });

  const rules = form.dueDateRules;
  const updateRule = (i, patch) => set({ dueDateRules: rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });

  const toggleTenure = (t) =>
    set({ tenures: form.tenures.includes(t) ? form.tenures.filter((x) => x !== t) : [...form.tenures, t].sort((a, b) => a - b) });

  return (
    <div className="space-y-5 pb-24 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            Finance (EMI) Settings
            <span className="p-2 bg-blue-100 rounded-xl">
              <Calculator className="h-5 w-5 text-blue-600" />
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Set the interest, file charges and dates once. Customers see the result on the product page. Turn finance on for a
            category (like Mobile) from Categories → Header Categories.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save settings
        </button>
      </div>

      <Section title="Finance on / off" hint="Switch off to hide the EMI button on every product without changing anything else.">
        <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
          <input type="checkbox" className="h-5 w-5" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          <span className="text-sm font-bold text-slate-800">Finance is {form.enabled ? "ON" : "OFF"}</span>
        </label>
      </Section>

      <Section title="Interest" hint="Customers see the type (Flat / Reducing) but not the rate.">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <span className={label}>Interest type</span>
            <div className="flex gap-2">
              {[
                ["flat", "Flat", "Same interest every month on the full amount"],
                ["reducing", "Reducing", "Interest on the remaining amount, so EMIs fall"],
              ].map(([value, name, desc]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set({ interestType: value })}
                  className={`flex-1 text-left p-3 rounded-xl border-2 ${form.interestType === value ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}
                >
                  <span className="block text-sm font-extrabold text-slate-900">{name}</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">{desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={label}>Interest rate (% per month)</label>
            <input className={field} inputMode="decimal" value={form.interestRatePerMonth} onChange={(e) => set({ interestRatePerMonth: e.target.value.replace(/[^0-9.]/g, "") })} />
          </div>
        </div>
      </Section>

      <Section
        title="File charge"
        hint="Picked by the finance amount (price minus down payment). The file charge is taken out of the interest, it is not added on top. If the interest is smaller than the file charge, the customer pays the file charge."
      >
        <div className="space-y-2">
          {slabs.map((s, i) => {
            const isLast = i === slabs.length - 1;
            return (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-600 w-44 shrink-0">
                  {isLast ? "Finance amount above that" : "Finance amount below ₹"}
                </span>
                {!isLast && (
                  <input className={`${field} w-32`} inputMode="numeric" value={s.upTo} onChange={(e) => updateSlab(i, { upTo: e.target.value.replace(/\D/g, "") })} />
                )}
                <span className="text-sm text-slate-600">→ file charge ₹</span>
                <input className={`${field} w-28`} inputMode="numeric" value={s.fileCharge} onChange={(e) => updateSlab(i, { fileCharge: e.target.value.replace(/\D/g, "") })} />
                {!isLast && slabs.length > 1 && (
                  <button type="button" onClick={() => removeSlab(i)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg" aria-label="Remove slab">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <button type="button" onClick={addSlab} className="text-sm font-bold text-blue-600 inline-flex items-center gap-1">
          <Plus size={15} /> Add another slab
        </button>
      </Section>

      <Section title="EMI durations" hint="The months a customer can choose from.">
        <div className="flex flex-wrap gap-2">
          {TENURE_CHOICES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTenure(t)}
              className={`px-3.5 py-2 rounded-xl text-sm font-bold border ${form.tenures.includes(t) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}
            >
              {t} {t === 1 ? "month" : "months"}
            </button>
          ))}
        </div>
      </Section>

      <Section title="First EMI date" hint="Based on the day of the month the finance is taken. The first EMI is always in the next month. The rules must cover days 1 to 31.">
        <div className="space-y-2">
          {rules.map((r, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap text-sm text-slate-600">
              <span>If finance is taken from day</span>
              <input className={`${field} w-20`} inputMode="numeric" value={r.fromDay} onChange={(e) => updateRule(i, { fromDay: e.target.value.replace(/\D/g, "") })} />
              <span>to day</span>
              <input className={`${field} w-20`} inputMode="numeric" value={r.toDay} onChange={(e) => updateRule(i, { toDay: e.target.value.replace(/\D/g, "") })} />
              <span>→ first EMI on day</span>
              <input className={`${field} w-20`} inputMode="numeric" value={r.dueDay} onChange={(e) => updateRule(i, { dueDay: e.target.value.replace(/\D/g, "") })} />
              <span>(1 to 28) of next month</span>
              {rules.length > 1 && (
                <button type="button" onClick={() => set({ dueDateRules: rules.filter((_, idx) => idx !== i) })} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg" aria-label="Remove rule">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => set({ dueDateRules: [...rules, { fromDay: String((Number(rules[rules.length - 1]?.toDay) || 0) + 1), toDay: "31", dueDay: "1" }] })}
          className="text-sm font-bold text-blue-600 inline-flex items-center gap-1"
        >
          <Plus size={15} /> Add a date rule
        </button>
      </Section>

      <Section title="Other rules">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Late fee (₹, printed in the terms)</label>
            <input className={field} inputMode="numeric" value={form.lateFee} onChange={(e) => set({ lateFee: e.target.value.replace(/\D/g, "") })} />
          </div>
          <div>
            <label className={label}>Minimum down payment (% of price)</label>
            <input className={field} inputMode="decimal" value={form.minDownPaymentPercent} onChange={(e) => set({ minDownPaymentPercent: e.target.value.replace(/[^0-9.]/g, "") })} />
          </div>
        </div>
      </Section>

      <Section title="WhatsApp and shop details" hint="Quotations are sent to this WhatsApp number. The shop details are printed at the top of the PDF.">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>WhatsApp number for quotations</label>
            <input className={field} inputMode="numeric" placeholder="10 digit number" value={form.whatsappNumber} onChange={(e) => set({ whatsappNumber: e.target.value.replace(/\D/g, "").slice(0, 13) })} />
          </div>
          <div>
            <label className={label}>Shop name</label>
            <input className={field} value={form.shop.name} onChange={(e) => set({ shop: { ...form.shop, name: e.target.value } })} />
          </div>
          <div>
            <label className={label}>Shop address</label>
            <input className={field} value={form.shop.address} onChange={(e) => set({ shop: { ...form.shop, address: e.target.value } })} />
          </div>
          <div>
            <label className={label}>Shop phone</label>
            <input className={field} value={form.shop.phone} onChange={(e) => set({ shop: { ...form.shop, phone: e.target.value } })} />
          </div>
        </div>
      </Section>

      <Section title="Terms and conditions" hint="One term per line. Printed on the PDF.">
        <textarea className={`${field} min-h-[170px] leading-relaxed`} value={form.terms} onChange={(e) => set({ terms: e.target.value })} />
      </Section>

      <div className="fixed bottom-0 left-0 right-0 sm:left-auto sm:right-6 sm:bottom-6 p-3 sm:p-0 z-30">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-blue-600 text-white text-sm font-extrabold shadow-xl flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save settings
        </button>
      </div>
    </div>
  );
};

export default FinanceSettings;
