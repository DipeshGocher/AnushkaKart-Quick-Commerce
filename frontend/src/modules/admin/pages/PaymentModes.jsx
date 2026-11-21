import React, { useEffect, useState } from "react";
import Card from "@shared/components/ui/Card";
import { Loader2, Save, Lock, CreditCard } from "lucide-react";
import { useToast } from "@shared/components/ui/Toast";
import { adminSettingsApi } from "../services/api/settingsApi";
import { paymentFormFromSettings, paymentProblem, paymentPayload } from "@shared/utils/platformRules";

function Switch({ checked, onChange, disabled, testId, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-testid={testId}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors duration-200 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${checked ? "bg-emerald-600" : "bg-slate-300"}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
          checked ? "translate-x-8" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ModeRow({ title, hint, checked, onChange, locked, lockedNote, testId }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/60">
      <div className="min-w-0">
        <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
          {title}
          {locked && <Lock size={13} className="text-slate-400" />}
        </h4>
        <p className="text-xs text-slate-500 mt-0.5">{locked ? lockedNote : hint}</p>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <span
          data-testid={`${testId}-state`}
          className={`text-xs font-black w-8 text-right ${checked ? "text-emerald-700" : "text-slate-400"}`}
        >
          {checked ? "ON" : "OFF"}
        </span>
        <Switch checked={checked} onChange={onChange} disabled={locked} testId={testId} label={title} />
      </div>
    </div>
  );
}

const PaymentModes = () => {
  const { showToast } = useToast();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    adminSettingsApi
      .getSettings()
      .then((res) => alive && setForm(paymentFormFromSettings(res.data?.result || {})))
      .catch((err) => showToast(err?.response?.data?.message || "Could not load payment modes", "error"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSide = (side, key, value) => setForm((f) => ({ ...f, [side]: { ...f[side], [key]: value } }));
  const problem = form ? paymentProblem(form) : "";

  const save = async () => {
    if (problem) {
      showToast(problem, "error");
      return;
    }
    setSaving(true);
    try {
      const res = await adminSettingsApi.savePaymentModes(paymentPayload(form));
      setForm(paymentFormFromSettings({ paymentModes: res.data?.result?.paymentModes }));
      showToast("Payment modes saved", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not save payment modes", "error");
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

  const localOff = !form.local.cod && !form.local.online && !form.local.upiQr;
  const shipOff = !form.shiprocket.cod && !form.shiprocket.online && !form.shiprocket.upiQr;

  return (
    <div className="space-y-5 pb-24 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            Payment Modes
            <span className="p-2 bg-emerald-100 rounded-xl">
              <CreditCard className="h-5 w-5 text-emerald-700" />
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Choose how customers can pay. Local delivery and Shiprocket (courier) have separate switches. Changes apply to the
            next order a customer places.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || Boolean(problem)}
          data-testid="payment-save"
          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save
        </button>
      </div>

      <Card className="p-5 space-y-3 border-none ring-1 ring-slate-100">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Local delivery</h2>
          <p className="text-xs text-slate-500 mt-0.5">Orders delivered by your own riders.</p>
        </div>
        <ModeRow
          title="Cash on Delivery"
          hint="The customer pays the rider in cash (or UPI) at the door."
          checked={form.local.cod}
          onChange={(v) => setSide("local", "cod", v)}
          testId="local-cod"
        />
        <ModeRow
          title="Online payment"
          hint="Card, UPI app, NetBanking through the payment gateway."
          checked={form.local.online}
          onChange={(v) => setSide("local", "online", v)}
          testId="local-online"
        />
        <ModeRow
          title="UPI QR"
          hint="The customer scans your QR and you approve the payment."
          checked={form.local.upiQr}
          onChange={(v) => setSide("local", "upiQr", v)}
          testId="local-upi"
        />
        {localOff && (
          <p data-testid="local-warning" className="text-xs font-bold text-rose-600">
            Keep at least one mode on, or customers cannot order.
          </p>
        )}
      </Card>

      <Card className="p-5 space-y-3 border-none ring-1 ring-slate-100">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Shiprocket (courier)</h2>
          <p className="text-xs text-slate-500 mt-0.5">Orders sent anywhere in India by courier.</p>
        </div>
        <ModeRow
          title="Cash on Delivery"
          hint="The courier collects the cash and pays it to you later. Mark it received on the order page when it reaches your bank."
          checked={form.shiprocket.cod}
          onChange={(v) => setSide("shiprocket", "cod", v)}
          testId="ship-cod"
        />
        <ModeRow
          title="Online payment"
          hint="Card, UPI app, NetBanking through the payment gateway."
          checked={form.shiprocket.online}
          onChange={(v) => setSide("shiprocket", "online", v)}
          testId="ship-online"
        />
        <ModeRow
          title="UPI QR"
          hint="The customer scans your QR and you approve the payment."
          checked={form.shiprocket.upiQr}
          onChange={(v) => setSide("shiprocket", "upiQr", v)}
          testId="ship-upi"
        />
        {shipOff && (
          <p data-testid="ship-warning" className="text-xs font-bold text-rose-600">
            Keep at least one mode on, or customers cannot order courier items.
          </p>
        )}
      </Card>

      <p className="text-xs text-slate-500">
        If a customer&apos;s cart has both local and courier items, only the modes that are ON for both are offered.
      </p>
    </div>
  );
};

export default PaymentModes;
