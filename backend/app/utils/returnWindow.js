/**
 * Single source of truth for return-window business rules.
 *
 * The window length now comes from the admin dashboard ("Return Modes" page): a number of
 * hours or days, separately for local delivery and Shiprocket. Until the admin saves something,
 * the old env variables (LOCAL_RETURN_WINDOW_MINUTES / RETURN_WINDOW_MINUTES /
 * SHIPROCKET_RETURN_WINDOW_DAYS) and the 4 hours / 7 days defaults apply, so nothing changes on deploy.
 *
 * The window is worked out ONCE, when the order is delivered, and stored on the order
 * (returnWindowExpiresAt). Changing the setting later therefore only affects orders delivered after
 * the change; an order that is already delivered keeps the window it was given.
 */
import { getReturnWindowFor } from "../services/platformRulesService.js";

export function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return fallback;
}

export function getReturnEligibilityDelayMinutes() {
  return parsePositiveInt(process.env.RETURN_ELIGIBILITY_DELAY_MINUTES, 0);
}

/** The configured window (in minutes) for this order's delivery type. */
export async function getReturnWindowMinutes(order = null) {
  const win = await getReturnWindowFor(order?.fulfillmentType === "SHIPROCKET" ? "SHIPROCKET" : "LOCAL");
  return win.minutes;
}

/** "4 hours", "1 hour", "7 days", "2 days", "90 minutes" ... for messages shown to people. */
export function formatWindow(minutes) {
  const m = Math.round(Number(minutes) || 0);
  if (m >= 1440 && m % 1440 === 0) {
    const d = m / 1440;
    return `${d} ${d === 1 ? "day" : "days"}`;
  }
  if (m >= 60 && m % 60 === 0) {
    const h = m / 60;
    return `${h} ${h === 1 ? "hour" : "hours"}`;
  }
  return `${m} minutes`;
}

/**
 * Order-aware variant: prefers persisted timestamps on the order and falls
 * back to deliveredAt -> createdAt -> now. Returns the configured delay/window
 * values alongside the computed dates for use in user-facing error messages.
 */
export async function computeReturnWindowForOrder(order) {
  const base = order?.deliveredAt || order?.createdAt || new Date();
  const deliveredAt = base instanceof Date ? base : new Date(base);
  const eligibleDelay = getReturnEligibilityDelayMinutes();
  const windowMinutes = await getReturnWindowMinutes(order);
  const eligibleAt =
    order?.returnEligibleAt ||
    new Date(deliveredAt.getTime() + eligibleDelay * 60 * 1000);
  let windowExpiresAt =
    order?.returnWindowExpiresAt ||
    new Date(deliveredAt.getTime() + windowMinutes * 60 * 1000);
  if (windowExpiresAt < eligibleAt) {
    windowExpiresAt = eligibleAt;
  }

  // When the window was stored on the order at delivery, show THAT length, not today's setting.
  const storedMinutes = order?.returnWindowExpiresAt
    ? Math.max(0, Math.round((new Date(order.returnWindowExpiresAt).getTime() - deliveredAt.getTime()) / 60000))
    : windowMinutes;
  const displayWindow = formatWindow(storedMinutes);

  return {
    eligibleAt,
    windowExpiresAt,
    eligibleDelay,
    windowMinutes: storedMinutes,
    displayWindow,
  };
}

/**
 * Date-only variant: derives the window strictly from a deliveredAt input,
 * ignoring any persisted order-level overrides. Used by the finance service
 * when stamping a freshly-delivered order.
 */
export async function computeReturnWindowDates(deliveredAt, order = null) {
  const eligibleDelay = getReturnEligibilityDelayMinutes();
  const windowMinutes = await getReturnWindowMinutes(order);
  const start = deliveredAt instanceof Date ? deliveredAt : new Date();
  const eligibleAt = new Date(start.getTime() + eligibleDelay * 60 * 1000);
  const windowExpiresAt = new Date(start.getTime() + windowMinutes * 60 * 1000);

  return {
    eligibleAt,
    windowExpiresAt,
  };
}
