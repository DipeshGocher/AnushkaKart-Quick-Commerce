import React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Truck,
  PackageCheck,
  Wallet,
  XCircle,
} from "lucide-react";

const RETURN_STEPS = [
  { id: "return_requested", label: "Return Requested", icon: ClipboardCheck },
  { id: "return_approved", label: "Return Approved", icon: CheckCircle2 },
  { id: "return_pickup_assigned", label: "Pickup Assigned", icon: Truck },
  { id: "return_in_transit", label: "In Transit", icon: Truck },
  { id: "returned", label: "Delivered to Store", icon: PackageCheck },
  { id: "refund_completed", label: "Refund Completed", icon: Wallet },
];

const STATUS_INDEX = {
  ...RETURN_STEPS.reduce((acc, step, idx) => {
    acc[step.id] = idx;
    return acc;
  }, {}),
  return_drop_pending: 3,
  returned: 4,
  qc_passed: 4,
  refund_completed: 5,
};

const ReturnProgressTracker = ({ returnStatus }) => {
  const status = String(returnStatus || "").trim();
  if (!status || status === "none") return null;

  const isRejected = status === "return_rejected";
  const isQcFailed = status === "qc_failed";
  const currentIndex =
    typeof STATUS_INDEX[status] === "number" ? STATUS_INDEX[status] : 0;

  const rejectedSteps = [
    { id: "return_requested", label: "Return Requested", icon: ClipboardCheck },
    { id: "return_rejected", label: "Return Rejected", icon: XCircle },
  ];

  const qcFailedSteps = [
    { id: "return_requested", label: "Return Requested", icon: ClipboardCheck },
    { id: "return_approved", label: "Return Approved", icon: CheckCircle2 },
    { id: "returned", label: "Delivered to Store Hub", icon: PackageCheck },
    { id: "qc_failed", label: "QC Inspection Failed", icon: XCircle },
  ];

  const steps = isRejected ? rejectedSteps : isQcFailed ? qcFailedSteps : RETURN_STEPS;

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
      <h4 className="text-sm font-bold text-slate-800 mb-4">Return Status</h4>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isFailedStep = (isRejected && step.id === "return_rejected") || (isQcFailed && step.id === "qc_failed");
          const isCompleted = isRejected
            ? true
            : isQcFailed
              ? index < steps.length - 1
              : status === "refund_completed"
                ? true
                : index < currentIndex;
          const isActive = isFailedStep
            ? true
            : status !== "refund_completed" && index === currentIndex;

          return (
            <div
              key={step.id}
              className="relative transition-opacity duration-200">
              <div className="flex items-center gap-3">
                <div
                  className={`relative z-10 h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isFailedStep
                      ? "bg-rose-100 text-rose-600 border border-rose-300"
                      : isCompleted
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : isActive
                          ? "bg-amber-100 text-amber-700 border border-amber-300"
                          : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isFailedStep ? (
                    <XCircle size={18} />
                  ) : isCompleted ? (
                    <CheckCircle2 size={18} />
                  ) : isActive ? (
                    <Icon size={18} />
                  ) : (
                    <Circle size={18} />
                  )}
                </div>

                <div className="flex-1">
                  <p
                    className={`text-sm font-bold ${
                      isFailedStep
                        ? "text-rose-700"
                        : isCompleted
                          ? "text-slate-900"
                          : isActive
                            ? "text-amber-700"
                            : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              </div>

              {index < steps.length - 1 && (
                <div className="absolute left-5 top-10 bottom-0 w-0.5 -mb-4">
                  <div
                    className={`h-full w-full ${
                      isCompleted ? "bg-primary" : "bg-slate-200"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default ReturnProgressTracker;

