/**
 * Calculate the delivery boy earning based on the finalized route distance.
 *
 * @param {Object} params
 * @param {number} params.distanceKm - Actual route distance in kilometers
 * @param {Object} params.settings - The delivery settings (from Setting model)
 * @returns {number} The calculated rider earning
 */
export const calculateRiderEarning = ({ distanceKm, settings = {} }) => {
  const isFixed = settings.riderEarningType === "fixed" || settings.deliveryPricingMode === "fixed_price";
  if (isFixed) {
    return Number(settings.fixedRiderPayout ?? settings.riderFixedEarning ?? 0);
  }

  const baseDistance = Number(settings.riderBaseDistance ?? settings.baseDistanceCapacityKm ?? 0);
  const baseEarning = Number(settings.riderBaseEarning ?? settings.riderBasePayout ?? 0);
  const extraPerKm = Number(settings.riderExtraPerKm ?? settings.deliveryPartnerRatePerKm ?? 0);

  if (distanceKm <= baseDistance) {
    return baseEarning;
  }

  const extraDistance = distanceKm - baseDistance;
  const extraKm = Math.ceil(extraDistance);

  return baseEarning + (extraKm * extraPerKm);
};
