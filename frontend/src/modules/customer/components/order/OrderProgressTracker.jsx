import React from "react";
import { motion } from "framer-motion";
import { Check, Clock, Truck } from "lucide-react";
import { getLegacyStatusFromOrder } from "@/shared/utils/orderStatus";

const OrderProgressTracker = ({
  order,
  estimatedArrivalText = "12:45 PM",
  arrivingInText = "8 mins",
  totalDistanceText = "—",
}) => {
  const status = getLegacyStatusFromOrder(order);
  const isShiprocket = order?.fulfillmentType === "SHIPROCKET";
  const shiprocket = order?.shiprocket || {};
  const srStatus = String(shiprocket.currentStatus || "").toUpperCase();

  const standardSteps = [
    { id: "pending", label: "Order Placed", subLabel: "We have received your order" },
    { id: "confirmed", label: "Order Confirmed", subLabel: "Your order has been confirmed" },
    { id: "packed", label: "Order Packed", subLabel: "Your order is packed and ready" },
    { id: "out_for_delivery", label: "Out for Delivery", subLabel: "Your order is on the way" },
    { id: "delivered", label: "Delivered", subLabel: "Order has been delivered" },
  ];

  const courierSteps = [
    { id: "pending", label: "Order Placed", subLabel: "We have received your order" },
    { id: "confirmed", label: "Order Confirmed", subLabel: "Seller confirmed order" },
    { id: "packed", label: "AWB Assigned", subLabel: shiprocket.awb ? `AWB: ${shiprocket.awb}` : "AWB generated & packed" },
    { id: "pickup_scheduled", label: "Pickup Scheduled", subLabel: "Courier pickup booked" },
    { id: "in_transit", label: "In Transit", subLabel: "Moving across courier hubs" },
    { id: "out_for_delivery", label: "Out for Delivery", subLabel: "Out for doorstep delivery" },
    { id: "delivered", label: "Delivered", subLabel: "Order safely delivered" },
  ];

  const getCourierStageIndex = () => {
    if (status === "delivered" || srStatus === "DELIVERED") return 6;
    if (status === "out_for_delivery" || srStatus === "OUT_FOR_DELIVERY") return 5;
    if (srStatus === "IN_TRANSIT") return 4;
    if (
      srStatus === "PICKUP_SCHEDULED" ||
      srStatus === "PICKUP_QUEUED" ||
      shiprocket.pickupScheduledAt ||
      shiprocket.history?.some((h) => String(h.status || "").toUpperCase() === "PICKUP_SCHEDULED")
    ) {
      return 3;
    }
    if (status === "packed" || shiprocket.awb) return 2;
    if (status === "confirmed") return 1;
    return 0;
  };

  const steps = isShiprocket ? courierSteps : standardSteps;
  const statusList = ["pending", "confirmed", "packed", "out_for_delivery", "delivered"];
  let currentStatusIndex = isShiprocket
    ? getCourierStageIndex()
    : statusList.indexOf(status);

  if (status === "cancelled") {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5">
        <p className="text-center text-rose-700 font-semibold">Order Cancelled</p>
      </div>
    );
  }

  // Fallback for unknown status
  if (currentStatusIndex === -1) currentStatusIndex = 0;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col gap-6"
      >
        {steps.map((step, index) => {
          const isCompleted = index <= currentStatusIndex;
          const isActive = index === currentStatusIndex && status !== "delivered";

          // Determine line color to the NEXT step
          const isLineActive = index < currentStatusIndex;

          return (
            <div key={step.id} className="relative flex items-start gap-4">
              {/* Connecting Line (drawn below the circle) */}
              {index < steps.length - 1 && (
                <div
                  className={`absolute left-[11px] top-6 bottom-[-24px] w-[2px] ${
                    isLineActive ? "bg-[#1e7145]" : "bg-slate-200"
                  }`}
                />
              )}

              {/* Status Indicator */}
              <div className="relative z-10 flex h-[24px] w-[24px] shrink-0 items-center justify-center bg-white">
                {isCompleted ? (
                  <div className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[#1e7145] text-white">
                    <Check size={12} strokeWidth={4} />
                  </div>
                ) : (
                  <div className="flex h-[20px] w-[20px] items-center justify-center rounded-full border-[2px] border-slate-300">
                  </div>
                )}
              </div>

              {/* Step Text */}
              <div className="flex flex-col pt-[2px]">
                <span
                  className={`text-[14px] font-bold leading-none ${
                    isActive
                      ? "text-[#1e7145]"
                      : isCompleted
                      ? "text-slate-800"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  {step.subLabel}
                </span>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* ETA Display */}
      {status !== "delivered" && (
        <div className="mt-8 pt-5 border-t border-slate-100">
          <div className={`flex items-center justify-between rounded-2xl p-4 gap-4 ${isShiprocket ? "bg-blue-50/70 border border-blue-100" : "bg-emerald-50"}`}>
            {status === "pending" && !isShiprocket ? (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Clock size={20} className="text-emerald-700" />
                </div>
                <p className="text-base font-black text-emerald-900">Waiting for Confirm...</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isShiprocket ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {isShiprocket ? <Truck size={20} className="text-blue-700" /> : <Clock size={20} className="text-emerald-700" />}
                  </div>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wider ${isShiprocket ? "text-blue-800" : "text-emerald-800"}`}>
                      {isShiprocket ? "Estimated Delivery" : "Estimated Time"}
                    </p>
                    <p className={`text-lg font-black ${isShiprocket ? "text-slate-900" : "text-emerald-900"}`}>{estimatedArrivalText}</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <div>
                    <p className={`text-xs font-semibold ${isShiprocket ? "text-blue-700" : "text-emerald-700"}`}>
                      {isShiprocket ? "Courier Partner" : "Arriving in"}
                    </p>
                    <p className={`${isShiprocket ? "text-sm font-black text-slate-800" : "text-2xl font-black text-emerald-900"}`}>
                      {isShiprocket ? (shiprocket.courierName || "Blue Dart Express") : arrivingInText}
                    </p>
                  </div>
                  <div className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold ${isShiprocket ? "bg-white text-blue-800 ring-1 ring-blue-200" : "bg-white/80 text-emerald-800 ring-1 ring-emerald-200"}`}>
                    {isShiprocket ? "Pan-India Surface Courier" : `Total distance: ${totalDistanceText}`}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderProgressTracker;
