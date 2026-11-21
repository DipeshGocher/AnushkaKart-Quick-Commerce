/**
 * Two rules the admin controls from the dashboard instead of the server's .env file:
 *
 *   1. PAYMENT MODES - which of Cash on Delivery / Online / UPI QR a customer may use, separately
 *      for LOCAL (own rider) and SHIPROCKET (courier) delivery. Courier cash-on-delivery is a normal
 *      switch; its cash is booked as "with the courier" at delivery and credited to the admin wallet
 *      when the admin marks it received (orderFinanceService.recordCourierCodCollected / remitCourierCod).
 *   2. RETURN WINDOWS - how long after delivery a customer may ask for a return, separately for
 *      LOCAL and SHIPROCKET, as "number + hours/days".
 *
 * Both live on the single Setting document. An older document that has neither is read through
 * the old switches / env variables, so deploying this changes nothing until the admin saves.
 */
import mongoose from "mongoose";

const HOUR = 60;
const DAY = 24 * 60;
export const MAX_RETURN_WINDOW_DAYS = 90;

export const PAYMENT_MODE_KEY = Object.freeze({ COD: "cod", ONLINE: "online", UPI_QR: "upiQr" });

const isBool = (v) => typeof v === "boolean";
const asObject = (doc) => (doc && typeof doc.toObject === "function" ? doc.toObject() : doc || {});

function err(message, statusCode = 400) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}

/* ───────────────────────────── payment modes ───────────────────────────── */

/** The effective payment-mode grid for a settings document (stored values, else the legacy switches). */
export function normalizePaymentModes(rawSettings) {
  const raw = asObject(rawSettings);
  const stored = raw.paymentModes || {};
  const legacy = {
    cod: isBool(raw.codEnabled) ? raw.codEnabled : true,
    online: isBool(raw.onlineEnabled) ? raw.onlineEnabled : true,
    upiQr: isBool(raw.upiEnabled) ? raw.upiEnabled : true,
  };
  const pick = (side, key) => (isBool(side?.[key]) ? side[key] : legacy[key]);
  return {
    local: {
      cod: pick(stored.local, "cod"),
      online: pick(stored.local, "online"),
      upiQr: pick(stored.local, "upiQr"),
    },
    shiprocket: {
      cod: pick(stored.shiprocket, "cod"),
      online: pick(stored.shiprocket, "online"),
      upiQr: pick(stored.shiprocket, "upiQr"),
    },
  };
}

/** Validates what the admin page sends. Returns the clean grid or throws a 400. */
export function validatePaymentModes(input) {
  const local = input?.local;
  const ship = input?.shiprocket;
  for (const [name, side, keys] of [
    ["Local delivery", local, ["cod", "online", "upiQr"]],
    ["Shiprocket", ship, ["cod", "online", "upiQr"]],
  ]) {
    if (!side || typeof side !== "object") throw err(`${name}: payment modes are missing.`);
    for (const k of keys) {
      if (!isBool(side[k])) throw err(`${name}: "${k}" must be on or off.`);
    }
  }
  const clean = {
    local: { cod: local.cod, online: local.online, upiQr: local.upiQr },
    shiprocket: { cod: ship.cod, online: ship.online, upiQr: ship.upiQr },
  };
  if (!clean.local.cod && !clean.local.online && !clean.local.upiQr) {
    throw err("Local delivery: keep at least one payment mode on, or customers cannot order.");
  }
  if (!clean.shiprocket.cod && !clean.shiprocket.online && !clean.shiprocket.upiQr) {
    throw err("Shiprocket: keep at least one payment mode on, or customers cannot order courier items.");
  }
  return clean;
}

/**
 * Modes allowed for a checkout. Items for different delivery types share ONE payment mode, so a mode
 * has to be allowed for every delivery type in the cart.
 * @param {string[]} fulfillmentTypes "LOCAL" / "SHIPROCKET" per seller shipment
 */
export function allowedPaymentModesFor(fulfillmentTypes, modes) {
  const types = new Set((fulfillmentTypes || []).map((t) => (t === "SHIPROCKET" ? "SHIPROCKET" : "LOCAL")));
  if (types.size === 0) types.add("LOCAL");
  const result = { COD: true, ONLINE: true, UPI_QR: true };
  for (const t of types) {
    const side = t === "SHIPROCKET" ? modes.shiprocket : modes.local;
    result.COD = result.COD && Boolean(side.cod);
    result.ONLINE = result.ONLINE && Boolean(side.online);
    result.UPI_QR = result.UPI_QR && Boolean(side.upiQr);
  }
  return result;
}

const MODE_LABEL = { COD: "Cash on Delivery", ONLINE: "Online payment", UPI_QR: "UPI QR payment" };

/** Throws a 400 when `paymentMode` is not allowed for these delivery types. */
export function assertPaymentModeAllowed({ paymentMode, fulfillmentTypes, modes }) {
  const allowed = allowedPaymentModesFor(fulfillmentTypes, modes);
  if (allowed[paymentMode]) return allowed;
  const hasCourier = (fulfillmentTypes || []).includes("SHIPROCKET");
  if (paymentMode === "COD" && hasCourier && !modes.shiprocket.cod) {
    throw err("Cash on Delivery is not available for courier-delivered items. Please pay online or by UPI QR.");
  }
  const options = Object.entries(allowed)
    .filter(([, on]) => on)
    .map(([mode]) => MODE_LABEL[mode]);
  throw err(
    `${MODE_LABEL[paymentMode] || "This payment mode"} is not available for this order.` +
      (options.length ? ` Please choose: ${options.join(" or ")}.` : ""),
  );
}

/* ───────────────────────────── return windows ───────────────────────────── */

const parseEnvInt = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function windowToMinutes(win) {
  const value = Number(win?.value);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * (win?.unit === "days" ? DAY : HOUR));
}

function describeMinutes(minutes) {
  if (minutes % DAY === 0) return { value: minutes / DAY, unit: "days" };
  return { value: Math.round((minutes / HOUR) * 100) / 100, unit: "hours" };
}

/** Effective windows: what the admin saved, else the old env variables, else 4 hours / 7 days. */
export function normalizeReturnWindows(rawSettings) {
  const raw = asObject(rawSettings);
  const stored = raw.returnWindows || {};
  const fromStored = (side) => {
    const minutes = windowToMinutes(side);
    if (minutes === null || !["hours", "days"].includes(side?.unit)) return null;
    return { value: Number(side.value), unit: side.unit, minutes, source: "admin" };
  };

  const envLocalMinutes = parseEnvInt(process.env.LOCAL_RETURN_WINDOW_MINUTES) ?? parseEnvInt(process.env.RETURN_WINDOW_MINUTES) ?? 4 * HOUR;
  const envShipDays = parseEnvInt(process.env.SHIPROCKET_RETURN_WINDOW_DAYS) ?? 7;

  return {
    local:
      fromStored(stored.local) || { ...describeMinutes(envLocalMinutes), minutes: envLocalMinutes, source: "default" },
    shiprocket:
      fromStored(stored.shiprocket) || { value: envShipDays, unit: "days", minutes: envShipDays * DAY, source: "default" },
  };
}

/** Validates what the admin page sends. Returns the clean windows or throws a 400. */
export function validateReturnWindows(input) {
  const clean = {};
  for (const [key, name] of [["local", "Local delivery"], ["shiprocket", "Shiprocket"]]) {
    const side = input?.[key];
    if (!side || typeof side !== "object") throw err(`${name}: return window is missing.`);
    const value = Number(side.value);
    if (!Number.isFinite(value) || value < 1 || !Number.isInteger(value)) {
      throw err(`${name}: type a whole number of 1 or more.`);
    }
    if (!["hours", "days"].includes(side.unit)) throw err(`${name}: choose Hours or Days.`);
    const minutes = windowToMinutes({ value, unit: side.unit });
    if (minutes > MAX_RETURN_WINDOW_DAYS * DAY) {
      throw err(`${name}: the return window cannot be longer than ${MAX_RETURN_WINDOW_DAYS} days.`);
    }
    clean[key] = { value, unit: side.unit };
  }
  return clean;
}

/* ───────────────────────────── loading ───────────────────────────── */

const CACHE_MS = 10 * 1000;
let cache = { at: 0, doc: null };

export function invalidatePlatformRulesCache() {
  cache = { at: 0, doc: null };
}

async function loadSettingsDoc() {
  const fresh = Date.now() - cache.at < CACHE_MS;
  if (fresh) return cache.doc;
  // Without a database connection (unit tests, early start-up) just use the defaults instead of
  // waiting for mongoose's buffering timeout.
  if (mongoose?.connection?.readyState !== 1) return null;
  // Imported on first use so that loading this file (it is pulled in by the return-window helpers)
  // never needs the model layer.
  const { default: Setting } = await import("../models/setting.js");
  const doc = await Setting.findOne({ $or: [{ tenantId: null }, { tenantId: { $exists: false } }] })
    .select("paymentModes returnWindows codEnabled onlineEnabled upiEnabled")
    .lean();
  cache = { at: Date.now(), doc: doc || null };
  return cache.doc;
}

/** @returns {Promise<{paymentModes: ReturnType<typeof normalizePaymentModes>, returnWindows: ReturnType<typeof normalizeReturnWindows>}>} */
export async function getPlatformRules() {
  let doc = null;
  try {
    doc = await loadSettingsDoc();
  } catch {
    doc = null; // a settings read problem must never block ordering or returns: use the defaults
  }
  return { paymentModes: normalizePaymentModes(doc), returnWindows: normalizeReturnWindows(doc) };
}

export async function getReturnWindowFor(fulfillmentType) {
  const { returnWindows } = await getPlatformRules();
  return fulfillmentType === "SHIPROCKET" ? returnWindows.shiprocket : returnWindows.local;
}
