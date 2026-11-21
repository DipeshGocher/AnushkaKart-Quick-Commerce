import {
  allowedPaymentModesFor,
  assertPaymentModeAllowed,
  normalizePaymentModes,
  normalizeReturnWindows,
  validatePaymentModes,
  validateReturnWindows,
  windowToMinutes,
} from "../app/services/platformRulesService.js";
import { computeReturnWindowDates, formatWindow } from "../app/utils/returnWindow.js";

const allOn = { local: { cod: true, online: true, upiQr: true }, shiprocket: { cod: true, online: true, upiQr: true } };

describe("payment modes: what is effective", () => {
  it("a settings document with nothing saved: everything on, for local and for courier", () => {
    expect(normalizePaymentModes({})).toEqual({
      local: { cod: true, online: true, upiQr: true },
      shiprocket: { cod: true, online: true, upiQr: true },
    });
    expect(normalizePaymentModes(null).shiprocket.cod).toBe(true);
  });

  it("falls back to the old three switches until the admin saves the new page", () => {
    const m = normalizePaymentModes({ codEnabled: false, onlineEnabled: true, upiEnabled: false });
    expect(m.local).toEqual({ cod: false, online: true, upiQr: false });
    expect(m.shiprocket).toEqual({ cod: false, online: true, upiQr: false });
  });

  it("saved values win over the old switches (courier COD included)", () => {
    const m = normalizePaymentModes({
      codEnabled: false,
      paymentModes: { local: { cod: true, online: false, upiQr: true }, shiprocket: { cod: true, online: true, upiQr: false } },
    });
    expect(m.local).toEqual({ cod: true, online: false, upiQr: true });
    expect(m.shiprocket).toEqual({ cod: true, online: true, upiQr: false });
  });

  it("a half-saved document fills the gaps from the old switches", () => {
    const m = normalizePaymentModes({ upiEnabled: false, paymentModes: { local: { cod: false } } });
    expect(m.local).toEqual({ cod: false, online: true, upiQr: false });
  });
});

describe("payment modes: what the admin may save", () => {
  it("accepts a normal grid and keeps courier COD as the admin set it", () => {
    expect(validatePaymentModes(allOn)).toEqual(allOn);
    const noCod = validatePaymentModes({ ...allOn, shiprocket: { cod: false, online: true, upiQr: true } });
    expect(noCod.shiprocket.cod).toBe(false);
  });

  it("refuses to switch every local mode off", () => {
    const r = () => validatePaymentModes({ ...allOn, local: { cod: false, online: false, upiQr: false } });
    expect(r).toThrow(/Local delivery: keep at least one/);
    try { r(); } catch (e) { expect(e.statusCode).toBe(400); }
  });

  it("refuses to switch every courier mode off, but courier may be COD only", () => {
    expect(() => validatePaymentModes({ ...allOn, shiprocket: { cod: false, online: false, upiQr: false } })).toThrow(/Shiprocket: keep at least one/);
    expect(() => validatePaymentModes({ ...allOn, shiprocket: { cod: true, online: false, upiQr: false } })).not.toThrow();
  });

  it("local may be just one mode, e.g. COD only", () => {
    expect(() => validatePaymentModes({ ...allOn, local: { cod: true, online: false, upiQr: false } })).not.toThrow();
  });

  it("refuses missing or non on/off values", () => {
    expect(() => validatePaymentModes({})).toThrow(/missing/);
    expect(() => validatePaymentModes({ local: { cod: "yes", online: true, upiQr: true }, shiprocket: allOn.shiprocket })).toThrow(/on or off/);
    expect(() => validatePaymentModes({ local: allOn.local, shiprocket: { online: true, upiQr: true } })).toThrow(/on or off/);
  });
});

describe("payment modes: checkout check", () => {
  const modes = normalizePaymentModes({});

  it("local: COD, online and QR all work by default", () => {
    expect(allowedPaymentModesFor(["LOCAL"], modes)).toEqual({ COD: true, ONLINE: true, UPI_QR: true });
    for (const mode of ["COD", "ONLINE", "UPI_QR"]) {
      expect(() => assertPaymentModeAllowed({ paymentMode: mode, fulfillmentTypes: ["LOCAL"], modes })).not.toThrow();
    }
  });

  it("Shiprocket: everything works by default; with COD switched off it is refused with a clear message", () => {
    expect(allowedPaymentModesFor(["SHIPROCKET"], modes)).toEqual({ COD: true, ONLINE: true, UPI_QR: true });
    for (const mode of ["COD", "ONLINE", "UPI_QR"]) {
      expect(() => assertPaymentModeAllowed({ paymentMode: mode, fulfillmentTypes: ["SHIPROCKET"], modes })).not.toThrow();
    }
    const noCod = normalizePaymentModes({ paymentModes: { shiprocket: { cod: false, online: true, upiQr: true } } });
    expect(allowedPaymentModesFor(["SHIPROCKET"], noCod)).toEqual({ COD: false, ONLINE: true, UPI_QR: true });
    let caught;
    try { assertPaymentModeAllowed({ paymentMode: "COD", fulfillmentTypes: ["SHIPROCKET"], modes: noCod }); } catch (e) { caught = e; }
    expect(caught.statusCode).toBe(400);
    expect(caught.message).toMatch(/Cash on Delivery is not available for courier-delivered items/);
  });

  it("a cart with both kinds only gets the modes that are on for both", () => {
    expect(allowedPaymentModesFor(["LOCAL", "SHIPROCKET"], modes)).toEqual({ COD: true, ONLINE: true, UPI_QR: true });
    const noQrOnCourier = normalizePaymentModes({ paymentModes: { shiprocket: { cod: true, online: true, upiQr: false } } });
    expect(allowedPaymentModesFor(["LOCAL", "SHIPROCKET"], noQrOnCourier)).toEqual({ COD: true, ONLINE: true, UPI_QR: false });
    const noCodOnCourier = normalizePaymentModes({ paymentModes: { shiprocket: { cod: false, online: true, upiQr: true } } });
    expect(allowedPaymentModesFor(["LOCAL", "SHIPROCKET"], noCodOnCourier)).toEqual({ COD: false, ONLINE: true, UPI_QR: true });
  });

  it("a mode the admin switched off is refused and the message names what is left", () => {
    const noCod = normalizePaymentModes({ paymentModes: { local: { cod: false, online: true, upiQr: true } } });
    let caught;
    try { assertPaymentModeAllowed({ paymentMode: "COD", fulfillmentTypes: ["LOCAL"], modes: noCod }); } catch (e) { caught = e; }
    expect(caught.statusCode).toBe(400);
    expect(caught.message).toMatch(/Cash on Delivery is not available for this order\. Please choose: Online payment or UPI QR payment/);
  });

  it("no delivery type known is treated as local", () => {
    expect(allowedPaymentModesFor([], modes).COD).toBe(true);
  });
});

describe("return windows", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("converts to minutes", () => {
    expect(windowToMinutes({ value: 4, unit: "hours" })).toBe(240);
    expect(windowToMinutes({ value: 7, unit: "days" })).toBe(10080);
    expect(windowToMinutes({ value: 1, unit: "days" })).toBe(1440);
    expect(windowToMinutes({ value: -1, unit: "days" })).toBeNull();
    expect(windowToMinutes({})).toBeNull();
  });

  it("nothing saved: 4 hours local, 7 days courier", () => {
    delete process.env.LOCAL_RETURN_WINDOW_MINUTES;
    delete process.env.RETURN_WINDOW_MINUTES;
    delete process.env.SHIPROCKET_RETURN_WINDOW_DAYS;
    const w = normalizeReturnWindows({});
    expect(w.local).toMatchObject({ value: 4, unit: "hours", minutes: 240, source: "default" });
    expect(w.shiprocket).toMatchObject({ value: 7, unit: "days", minutes: 10080, source: "default" });
  });

  it("nothing saved but the old env variables are set: they still apply", () => {
    process.env.LOCAL_RETURN_WINDOW_MINUTES = "90";
    process.env.SHIPROCKET_RETURN_WINDOW_DAYS = "10";
    const w = normalizeReturnWindows({});
    expect(w.local.minutes).toBe(90);
    expect(w.shiprocket).toMatchObject({ value: 10, unit: "days", minutes: 14400 });
    process.env.LOCAL_RETURN_WINDOW_MINUTES = "1440";
    expect(normalizeReturnWindows({}).local).toMatchObject({ value: 1, unit: "days" });
  });

  it("what the admin saved wins over env", () => {
    process.env.LOCAL_RETURN_WINDOW_MINUTES = "90";
    const w = normalizeReturnWindows({ returnWindows: { local: { value: 2, unit: "days" }, shiprocket: { value: 12, unit: "hours" } } });
    expect(w.local).toMatchObject({ value: 2, unit: "days", minutes: 2880, source: "admin" });
    expect(w.shiprocket).toMatchObject({ value: 12, unit: "hours", minutes: 720, source: "admin" });
  });

  it("a half-saved or broken stored value falls back instead of breaking returns", () => {
    delete process.env.LOCAL_RETURN_WINDOW_MINUTES;
    const w = normalizeReturnWindows({ returnWindows: { local: { value: 3 }, shiprocket: { value: "x", unit: "days" } } });
    expect(w.local.minutes).toBe(240);
    expect(w.shiprocket.minutes).toBe(10080);
  });

  it("validation: whole number 1 or more, hours or days, at most 90 days", () => {
    const ok = validateReturnWindows({ local: { value: 4, unit: "hours" }, shiprocket: { value: 7, unit: "days" } });
    expect(ok).toEqual({ local: { value: 4, unit: "hours" }, shiprocket: { value: 7, unit: "days" } });
    const bad = (local, shiprocket = { value: 7, unit: "days" }) => () => validateReturnWindows({ local, shiprocket });
    expect(bad({ value: 0, unit: "hours" })).toThrow(/whole number of 1 or more/);
    expect(bad({ value: -3, unit: "hours" })).toThrow(/whole number/);
    expect(bad({ value: 1.5, unit: "hours" })).toThrow(/whole number/);
    expect(bad({ value: "abc", unit: "hours" })).toThrow(/whole number/);
    expect(bad({ value: 4, unit: "weeks" })).toThrow(/Hours or Days/);
    expect(bad({ value: 91, unit: "days" })).toThrow(/90 days/);
    expect(bad({ value: 2161, unit: "hours" })).toThrow(/90 days/);
    expect(bad({ value: 90, unit: "days" })).not.toThrow();
    expect(bad({ value: 2160, unit: "hours" })).not.toThrow();
    expect(bad({ value: 4, unit: "hours" }, undefined)).not.toThrow();
    expect(() => validateReturnWindows({ local: { value: 4, unit: "hours" } })).toThrow(/Shiprocket: return window is missing/);
  });

  it("window text for messages", () => {
    expect(formatWindow(240)).toBe("4 hours");
    expect(formatWindow(60)).toBe("1 hour");
    expect(formatWindow(10080)).toBe("7 days");
    expect(formatWindow(1440)).toBe("1 day");
    expect(formatWindow(90)).toBe("90 minutes");
  });

  it("the window is counted from delivery, with no database (defaults)", async () => {
    delete process.env.LOCAL_RETURN_WINDOW_MINUTES;
    delete process.env.RETURN_WINDOW_MINUTES;
    delete process.env.SHIPROCKET_RETURN_WINDOW_DAYS;
    const delivered = new Date("2026-11-20T10:00:00.000Z");
    const local = await computeReturnWindowDates(delivered, { fulfillmentType: "LOCAL" });
    expect(local.windowExpiresAt.toISOString()).toBe("2026-11-20T14:00:00.000Z");
    const ship = await computeReturnWindowDates(delivered, { fulfillmentType: "SHIPROCKET" });
    expect(ship.windowExpiresAt.toISOString()).toBe("2026-11-27T10:00:00.000Z");
  });
});
