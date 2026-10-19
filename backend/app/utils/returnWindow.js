/**
 * Single source of truth for return-window business rules.
 *
 * Replaces previously-duplicated copies of:
 *   - parsePositiveInt()
 *   - getReturnEligibilityDelayMinutes()
 *   - getReturnWindowMinutes()
 *   - computeReturnWindowForOrder()   (controller variant)
 *   - computeReturnWindowDates()      (finance-service variant)
 *
 * Both variants are preserved here under their original names so existing
 * callers can be migrated with a one-line import change, with zero behavior
 * difference.
 */

export function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return fallback;
}

export function getReturnEligibilityDelayMinutes() {
  return parsePositiveInt(process.env.RETURN_ELIGIBILITY_DELAY_MINUTES, 0);
}

export function getReturnWindowMinutes(order = null) {
  if (order?.fulfillmentType === "SHIPROCKET") {
    // Shiprocket Pan-India Courier order: default 7 days (7 * 24 * 60 = 10080 minutes)
    const courierDays = parsePositiveInt(process.env.SHIPROCKET_RETURN_WINDOW_DAYS, 7);
    return courierDays * 24 * 60;
  }
  // Local Quick Delivery: default 4 hours (240 minutes) or LOCAL_RETURN_WINDOW_MINUTES / RETURN_WINDOW_MINUTES
  const localMinutes = parsePositiveInt(process.env.LOCAL_RETURN_WINDOW_MINUTES, null);
  if (localMinutes !== null) return localMinutes;
  return parsePositiveInt(process.env.RETURN_WINDOW_MINUTES, 240);
}

/**
 * Order-aware variant: prefers persisted timestamps on the order and falls
 * back to deliveredAt → createdAt → now. Returns the configured delay/window
 * values alongside the computed dates for use in user-facing error messages.
 *
 * Matches the previous `computeReturnWindowForOrder` in orderController.js.
 */
export function computeReturnWindowForOrder(order) {
  const base = order?.deliveredAt || order?.createdAt || new Date();
  const deliveredAt = base instanceof Date ? base : new Date(base);
  const eligibleDelay = getReturnEligibilityDelayMinutes();
  const windowMinutes = getReturnWindowMinutes(order);
  const eligibleAt =
    order?.returnEligibleAt ||
    new Date(deliveredAt.getTime() + eligibleDelay * 60 * 1000);
  let windowExpiresAt =
    order?.returnWindowExpiresAt ||
    new Date(deliveredAt.getTime() + windowMinutes * 60 * 1000);
  if (windowExpiresAt < eligibleAt) {
    windowExpiresAt = eligibleAt;
  }

  const isCourier = order?.fulfillmentType === "SHIPROCKET";
  const displayWindow = isCourier
    ? `${Math.round(windowMinutes / (24 * 60))} days`
    : windowMinutes >= 60
    ? `${Math.round(windowMinutes / 60)} hours`
    : `${windowMinutes} minutes`;

  return {
    eligibleAt,
    windowExpiresAt,
    eligibleDelay,
    windowMinutes,
    displayWindow,
  };
}

/**
 * Date-only variant: derives the window strictly from a deliveredAt input,
 * ignoring any persisted order-level overrides. Used by the finance service
 * when stamping a freshly-delivered order.
 *
 * Matches the previous `computeReturnWindowDates` in orderFinanceService.js.
 */
export function computeReturnWindowDates(deliveredAt, order = null) {
  const eligibleDelay = getReturnEligibilityDelayMinutes();
  const windowMinutes = getReturnWindowMinutes(order);
  const start = deliveredAt instanceof Date ? deliveredAt : new Date();
  const eligibleAt = new Date(start.getTime() + eligibleDelay * 60 * 1000);
  const windowExpiresAt = new Date(start.getTime() + windowMinutes * 60 * 1000);

  return {
    eligibleAt,
    windowExpiresAt,
  };
}
