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
    { id: "packed", label: "Shipment Booked", subLabel: "Packed and handed to courier" },
    { id: "pickup_scheduled", label: "Pickup Scheduled", subLabel: "Courier pickup booked" },
    { id: "in_transit", label: "Shipped", subLabel: "On its way to your city" },
    { id: "out_for_delivery", label: "Out for Delivery", subLabel: "Out for doorstep delivery" },
    { id: "delivered", label: "Delivered", subLabel: "Order safely delivered" },
  ];

  const getCourierStageIndex = () => {
    if (status === "delivered" || srStatus === "DELIVERED") return 6;
    if (status === "out_for_delivery" || srStatus === "OUT_FOR_DELIVERY") return 5;
    if (["IN_TRANSIT", "PICKED_UP", "SHIPPED", "REACHED_AT_DESTINATION_HUB"].includes(srStatus)) return 4;
    if (
      srStatus === "PICKUP_SCHEDULED" ||
      srStatus === "PICKUP_QUEUED" ||
      shiprocket.pickupScheduledAt ||
      shiprocket.history?.some((h) => String(h.code || h.status || "").toUpperCase() === "PICKUP_SCHEDULED")
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
        <div className="mt-6 pt-5 border-t border-slate-100">
          {status === "pending" && !isShiprocket ? (
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-slate-400 shrink-0" />
              <p className="text-sm font-medium text-slate-600">Waiting for the seller to confirm</p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  {isShiprocket ? <Truck size={17} /> : <Clock size={17} />}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">
                    {isShiprocket ? "Expected delivery" : "Arriving by"}
                  </p>
                  <p className="text-base font-bold text-slate-900 leading-tight">{estimatedArrivalText}</p>
                </div>
              </div>

              {/* Courier orders: show the courier only once one is really assigned. */}
              {(!isShiprocket || shiprocket.courierName) && (
                <div className="text-right shrink-0">
                  {isShiprocket ? (
                    <>
                      <p className="text-[11px] font-medium text-slate-500">Delivery partner</p>
                      <p className="text-sm font-semibold text-slate-800 leading-tight">{shiprocket.courierName}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-bold text-[#1e7145] leading-tight">{arrivingInText}</p>
                      {totalDistanceText && totalDistanceText !== "—" && (
                        <p className="text-[11px] font-medium text-slate-500">{totalDistanceText} away</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderProgressTracker;
