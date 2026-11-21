/**
 * What the PLATFORM really earns on one order. Pure: no database.
 *
 *   earns:  admin commission + delivery fee + handling fee
 *   costs:  rider commission (local) or the courier's freight (Shiprocket)
 *           the coupon discount (the platform pays it, not the seller)
 *   returns (when a return was refunded):
 *           the commission on the returned items is given back, the returned items' share of the coupon is
 *           given back to the platform (the customer was not refunded it), and the return pickup
 *           (rider commission / courier freight) is a cost unless the seller paid it
 *
 * The courier freight is the real figure when it is known (Shiprocket's charge, or one the admin typed in);
 * until then the delivery fee the customer was charged is used as the estimate (so a courier order shows
 * about zero courier margin instead of the whole fee as profit), and `estimated` says so.
 */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function computePlatformEarning(order) {
  const b = order?.paymentBreakdown || {};
  const isCourier = order?.fulfillmentType === "SHIPROCKET";
  const isCod = order?.paymentMode === "COD";

  const commission = num(b.adminProductCommissionTotal);
  const deliveryFee = num(b.deliveryFeeCharged);
  const handlingFee = num(b.handlingFeeCharged);
  const couponCost = Math.max(0, num(b.discountTotal));

  let riderCost = 0;
  let freightCost = 0;
  let freightEstimated = false;
  if (isCourier) {
    const known = order?.shiprocket?.freightCharge;
    if (known !== null && known !== undefined && Number.isFinite(Number(known))) {
      freightCost = num(known);
    } else {
      freightCost = num(b.courierDeliveryFee ?? deliveryFee);
      freightEstimated = true;
    }
  } else {
    riderCost = num(b.riderPayoutTotal);
  }

  let net = commission + deliveryFee + handlingFee - riderCost - freightCost - couponCost;

  const parts = {
    commission: round2(commission),
    deliveryFee: round2(deliveryFee),
    handlingFee: round2(handlingFee),
    riderCost: round2(-riderCost),
    freightCost: round2(-freightCost),
    couponCost: round2(-couponCost),
    commissionReturned: 0,
    couponGivenBack: 0,
    returnPickupCost: 0,
    returnPickupRecovered: 0,
    freightEstimated,
    cashPending: isCod && num(b.codPendingAmount) > 0 ? round2(num(b.codPendingAmount)) : 0,
  };

  const rf = order?.returnFinance;
  if (rf && rf.appliedAt) {
    parts.commissionReturned = round2(-num(rf.adminCommissionReversed));
    parts.couponGivenBack = round2(num(rf.discountShare));
    // The pickup of a return is a cost for the platform; the seller pays it back when it was their fault.
    // For a courier return the real freight (typed in or reported later) replaces the figure known at refund time.
    const courierFreightKnown = isCourier && order?.returnFreightCharge !== null && order?.returnFreightCharge !== undefined;
    const pickup = courierFreightKnown ? num(order.returnFreightCharge) : num(rf.pickupFee);
    const recovered = courierFreightKnown ? num(order.returnFreightApplied) : num(rf.pickupFee);
    parts.returnPickupCost = round2(-pickup);
    parts.returnPickupRecovered = rf.pickupFeePayer === "seller" ? round2(recovered) : 0;
    net += parts.commissionReturned + parts.couponGivenBack + parts.returnPickupCost + parts.returnPickupRecovered;
  }

  return { net: round2(net), parts };
}
