/**
 * Calculate the customer delivery charge based on the finalized route distance.
 *
 * @param {Object} params
 * @param {number} params.distanceKm - Actual route distance in kilometers
 * @param {Object} params.settings - The delivery settings (from Setting model)
 * @returns {number} The calculated customer delivery charge
 */
export const calculateCustomerDeliveryCharge = ({ distanceKm, settings = {} }) => {
  // customerFixedCharge is what the admin Billing Charges page edits; fixedDeliveryFee
  // is always populated (schema default), so it must only win in legacy fixed_price mode.
  if (settings.customerPricingType === "fixed") {
    return Number(settings.customerFixedCharge ?? settings.fixedDeliveryFee ?? 0);
  }
  if (settings.deliveryPricingMode === "fixed_price") {
    return Number(settings.fixedDeliveryFee ?? settings.customerFixedCharge ?? 0);
  }

  const baseDistance = Number(settings.customerBaseDistance ?? settings.baseDistanceCapacityKm ?? 0);
  const baseCharge = Number(settings.customerBaseCharge ?? settings.customerBaseDeliveryFee ?? 0);
  const extraPerKm = Number(settings.customerExtraPerKm ?? settings.incrementalKmSurcharge ?? 0);

  if (distanceKm <= baseDistance) {
    return baseCharge;
  }

  const extraDistance = distanceKm - baseDistance;
  const extraKm = Math.ceil(extraDistance);

  return baseCharge + (extraKm * extraPerKm);
};
