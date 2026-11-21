import React, { useEffect, useState } from "react";
import Card from "@shared/components/ui/Card";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { useToast } from "@shared/components/ui/Toast";
import { adminSettingsApi } from "../services/api/settingsApi";
import {
  returnFormFromSettings,
  returnProblem,
  returnPayload,
  windowProblem,
  windowLabel,
  MAX_RETURN_WINDOW_DAYS,
} from "@shared/utils/platformRules";

const inputBase =
  "px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400";

function WindowCard({ title, subtitle, side, onChange, testId }) {
  const problem = windowProblem(side);
  return (
    <Card className="p-5 space-y-3 border-none ring-1 ring-slate-100">
      <div>
        <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <input
          type="text"
          inputMode="numeric"
          data-testid={`${testId}-value`}
          value={side.value}
          onChange={(e) => onChange({ ...side, value: e.target.value.replace(/[^0-9]/g, "") })}
          className={`${inputBase} w-28 text-lg font-bold text-center ${problem ? "border-rose-400" : ""}`}
          placeholder="4"
        />
        <select
          data-testid={`${testId}-unit`}
          value={side.unit}
          onChange={(e) => onChange({ ...side, unit: e.target.value })}
          className={`${inputBase} w-32 font-bold`}
        >
          <option value="hours">Hours</option>
          <option value="days">Days</option>
        </select>
      </div>
      {problem ? (
        <p data-testid={`${testId}-error`} className="text-xs font-bold text-rose-600">
          {problem}
        </p>
      ) : (
        <p data-testid={`${testId}-summary`} className="text-xs text-slate-600">
          Customers can ask for a return up to <b>{windowLabel(side.value, side.unit)}</b> after delivery.
        </p>
      )}
    </Card>
  );
}

const ReturnModes = () => {
  const { showToast } = useToast();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    adminSettingsApi
      .getSettings()
      .then((res) => alive && setForm(returnFormFromSettings(res.data?.result || {})))
      .catch((err) => showToast(err?.response?.data?.message || "Could not load return settings", "error"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const problem = form ? returnProblem(form) : "";

  const save = async () => {
    if (problem) {
      showToast(problem, "error");
      return;
    }
    setSaving(true);
    try {
      const res = await adminSettingsApi.saveReturnWindows(returnPayload(form));
      setForm(returnFormFromSettings({ returnWindows: res.data?.result?.returnWindows }));
      showToast("Return windows saved", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not save return windows", "error");
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

  return (
    <div className="space-y-5 pb-24 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            Return Modes
            <span className="p-2 bg-amber-100 rounded-xl">
              <RotateCcw className="h-5 w-5 text-amber-700" />
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Set how long a customer has to ask for a return after delivery. Type a number, choose Hours or Days, and save.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || Boolean(problem)}
          data-testid="return-save"
          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save
        </button>
      </div>

      <WindowCard
        title="Local delivery"
        subtitle="Orders delivered by your own riders. Example: 4 Hours."
        side={form.local}
        onChange={(local) => setForm((f) => ({ ...f, local }))}
        testId="local-window"
      />
      <WindowCard
        title="Shiprocket (courier)"
        subtitle="Orders sent by courier. Example: 7 Days."
        side={form.shiprocket}
        onChange={(shiprocket) => setForm((f) => ({ ...f, shiprocket }))}
        testId="ship-window"
      />

      <Card className="p-4 space-y-1.5 border-none ring-1 ring-amber-100 bg-amber-50/50 text-xs text-slate-700">
        <p>
          <b>Only new deliveries are affected.</b> An order that is already delivered keeps the window it was given when it was
          delivered.
        </p>
        <p>
          <b>The seller&apos;s payout waits for this window.</b> The seller is paid after the return window ends, so a longer window
          means the seller is paid later.
        </p>
        <p>The longest window you can set is {MAX_RETURN_WINDOW_DAYS} days.</p>
      </Card>
    </div>
  );
};

export default ReturnModes;
