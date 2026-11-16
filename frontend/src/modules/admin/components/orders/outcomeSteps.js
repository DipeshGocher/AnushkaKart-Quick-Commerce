const CANCELLED_BY = { customer: "the customer", seller: "the seller", admin: "admin", system: "the system" };

export const buildOutcomeSteps = (order) => {
  const status = String(order?.status || "").toLowerCase();
  const shiprocket = order?.fulfillmentType === "SHIPROCKET";
  const steps = [{ key: "placed", label: "Order placed", time: order?.createdAt }];

  if (status === "delivered") {
    steps.push({ key: "confirmed", label: "Order confirmed", time: order?.sellerAcceptedAt });
    steps.push({
      key: "ship",
      label: shiprocket ? "Handed to courier" : "Out for delivery",
      time: shiprocket ? order?.shiprocket?.shippedAt || order?.shiprocket?.pickupScheduledAt : order?.outForDeliveryAt,
    });
    steps.push({ key: "delivered", label: "Delivered", time: order?.deliveredAt || order?.shiprocket?.deliveredAt || order?.updatedAt });
    return steps.map((s) => ({ ...s, state: "done" }));
  }

  // cancelled: show only what really happened, then the cancellation
  if (order?.sellerAcceptedAt) steps.push({ key: "confirmed", label: "Order confirmed", time: order.sellerAcceptedAt });
  const by = CANCELLED_BY[order?.cancelledBy];
  steps.push({
    key: "cancelled",
    label: by ? `Cancelled by ${by}` : "Order cancelled",
    time: order?.updatedAt,
    note: order?.cancelReason,
    state: "cancelled",
  });
  return steps.map((s) => ({ state: "done", ...s }));
};

