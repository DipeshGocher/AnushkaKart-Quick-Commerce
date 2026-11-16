/**
 * Simple order timeline for FINISHED orders (delivered or cancelled).
 * Only real data from the order is shown: each step appears only if it happened.
 * Works the same for local-rider and Shiprocket orders.
 */
import { Check, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildOutcomeSteps } from "./outcomeSteps";

const fmt = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

export default function AdminOrderOutcomeSection({ order }) {
  const steps = buildOutcomeSteps(order);
  return (
    <div className="bg-white rounded-xl shadow-xl ring-1 ring-slate-100 p-6" data-testid="order-outcome">
      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Order Timeline</h3>
      <ol className="relative ml-4 space-y-6">
        <div className="absolute top-2 bottom-2 left-[11px] w-0.5 bg-slate-100" />
        {steps.map((s) => {
          const bad = s.state === "cancelled";
          return (
            <li key={s.key} className="flex gap-5 relative" data-testid={`outcome-step-${s.key}`}>
              <div className={cn("h-6 w-6 rounded-full flex items-center justify-center z-10 ring-4 ring-white", bad ? "bg-rose-500" : "bg-emerald-600")}>
                {bad ? <X className="h-3.5 w-3.5 text-white" /> : <Check className="h-3.5 w-3.5 text-white" />}
              </div>
              <div>
                <p className={cn("text-sm font-bold", bad ? "text-rose-700" : "text-slate-900")}>{s.label}</p>
                {s.time && (
                  <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" /> {fmt(s.time)}
                  </p>
                )}
                {s.note && <p className="text-xs font-medium text-slate-500 mt-1">Reason: {s.note}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
