import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Truck,
  Package,
  Clock,
  CheckCircle2,
  Check,
  ExternalLink,
  Copy,
  ArrowRight,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COURIER_STAGES = [
  { id: "placed", label: "Order Placed", desc: "Customer placed order" },
  { id: "confirmed", label: "Order Confirmed", desc: "Seller accepted & verified" },
  { id: "packed", label: "Packed & AWB Assigned", desc: "AWB generated & label ready" },
  { id: "pickup_scheduled", label: "Pickup Scheduled", desc: "Courier partner pickup booked" },
  { id: "in_transit", label: "In Transit", desc: "Moving across courier hubs" },
  { id: "out_for_delivery", label: "Out for Delivery", desc: "Out for doorstep delivery" },
  { id: "delivered", label: "Delivered", desc: "Delivered to customer" },
];

export default function AdminShiprocketTrackingSection({ orderId, order }) {
  const [copied, setCopied] = useState(false);
  const shiprocket = order?.shiprocket || {};
  const currentStatus = String(shiprocket?.currentStatus || order?.status || "CONFIRMED").toUpperCase();

  // Determine stage progression index (0 to 6)
  const getStageIndex = () => {
    if (currentStatus === "DELIVERED" || String(order?.status).toLowerCase() === "delivered") return 6;
    if (currentStatus === "OUT_FOR_DELIVERY" || String(order?.status).toLowerCase() === "out_for_delivery") return 5;
    if (currentStatus === "IN_TRANSIT") return 4;
    if (
      currentStatus === "PICKUP_SCHEDULED" ||
      currentStatus === "PICKUP_QUEUED" ||
      shiprocket.pickupScheduledAt ||
      shiprocket.history?.some(h => String(h.status || "").toUpperCase() === "PICKUP_SCHEDULED")
    ) return 3;
    if (shiprocket.awb || String(order?.status).toLowerCase() === "packed") return 2;
    if (String(order?.status).toLowerCase() === "confirmed") return 1;
    return 0;
  };

  const activeIndex = getStageIndex();
  const courierName = shiprocket.courierName || "Blue Dart Express";
  const awbCode = shiprocket.awb || null;
  const etd = shiprocket.etd || order?.deliveryEstimate || "3-5 Business Days";
  const trackingUrl = shiprocket.trackingUrl || (awbCode ? `https://shiprocket.co/tracking/${awbCode}` : null);

  const handleCopyAwb = () => {
    if (!awbCode) return;
    navigator.clipboard.writeText(awbCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Header Bar */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
          <Truck className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            Pan-India Courier Pipeline
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100/80 text-blue-700 border border-blue-200">
              Shiprocket Logistics
            </span>
          </h3>
          <p className="text-[11px] font-semibold text-slate-500">
            {courierName} • Surface Doorstep Delivery
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-200/60 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
          <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider">
            {currentStatus}
          </span>
        </div>
      </div>

      {/* Courier Timeline Stepper */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 relative">
          {COURIER_STAGES.map((stage, idx) => {
            const isCompleted = idx <= activeIndex;
            const isCurrent = idx === activeIndex;

            return (
              <div key={stage.id} className="flex flex-col items-center text-center relative group">
                {/* Connecting horizontal line */}
                {idx < COURIER_STAGES.length - 1 && (
                  <div
                    className={cn(
                      "hidden lg:block absolute top-4 left-1/2 w-full h-0.5 z-0",
                      idx < activeIndex ? "bg-emerald-500" : "bg-slate-200"
                    )}
                  />
                )}

                {/* Circle Icon */}
                <div
                  className={cn(
                    "relative z-10 h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-xs",
                    isCompleted
                      ? "bg-emerald-600 text-white ring-4 ring-emerald-50"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4 stroke-[3]" />
                  ) : (
                    <span className="text-[11px] font-bold">{idx + 1}</span>
                  )}
                </div>

                {/* Text Labels */}
                <div className="mt-2.5">
                  <p
                    className={cn(
                      "text-[12px] font-bold leading-tight",
                      isCurrent
                        ? "text-emerald-700 font-extrabold"
                        : isCompleted
                        ? "text-slate-800 font-bold"
                        : "text-slate-400"
                    )}
                  >
                    {stage.label}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">
                    {stage.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Courier Estimate Banner */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-50/80 via-sky-50/40 to-slate-50 p-4 rounded-2xl border border-blue-100/60">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                Delivery Estimate
              </p>
              <h4 className="text-lg font-black text-slate-900 tracking-tight">
                {etd}
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Standard Courier Delivery ({courierName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {awbCode && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  AWB:
                </span>
                <span className="font-mono font-black text-xs text-slate-800">
                  {awbCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyAwb}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition"
                  title="Copy AWB"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            )}

            {trackingUrl && (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <span>Track on Carrier</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
