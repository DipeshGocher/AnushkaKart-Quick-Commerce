import {
  customerReturnLabel,
  customerReturnMinutes,
  firstOpenMode,
  labelFromMinutes,
  paymentFormFromSettings,
  paymentPayload,
  paymentProblem,
  returnFormFromSettings,
  returnPayload,
  returnProblem,
  visiblePaymentModes,
  windowLabel,
  windowMinutes,
  windowProblem,
} from "../shared/utils/platformRules.js";

describe("payment modes form", () => {
  it("fills every switch (courier COD included)", () => {
    expect(paymentFormFromSettings({})).toEqual({
      local: { cod: true, online: true, upiQr: true },
      shiprocket: { cod: true, online: true, upiQr: true },
    });
    const f = paymentFormFromSettings({ paymentModes: { local: { cod: false, online: true, upiQr: false }, shiprocket: { cod: true, online: false, upiQr: true } } });
    expect(f.local).toEqual({ cod: false, online: true, upiQr: false });
    expect(f.shiprocket).toEqual({ cod: true, online: false, upiQr: true });
  });

  it("cannot be saved with nothing on for a delivery type", () => {
    const f = paymentFormFromSettings({});
    expect(paymentProblem(f)).toBe("");
    expect(paymentProblem({ ...f, local: { cod: false, online: false, upiQr: false } })).toMatch(/Local delivery/);
    expect(paymentProblem({ ...f, shiprocket: { cod: false, online: false, upiQr: false } })).toMatch(/Shiprocket/);
    expect(paymentProblem({ ...f, local: { cod: true, online: false, upiQr: false } })).toBe("");
  });

  it("the payload carries courier COD like the other switches", () => {
    expect(paymentPayload(paymentFormFromSettings({}))).toEqual({
      local: { cod: true, online: true, upiQr: true },
      shiprocket: { cod: true, online: true, upiQr: true },
    });
  });
});

describe("which payment options the customer sees", () => {
  const settings = { paymentModes: { local: { cod: true, online: true, upiQr: false }, shiprocket: { cod: false, online: true, upiQr: true } } };

  it("the server's answer for this exact cart wins", () => {
    const preview = { allowedPaymentModes: { COD: false, ONLINE: true, UPI_QR: false } };
    expect(visiblePaymentModes({ preview, settings, fulfillmentType: "LOCAL" })).toEqual({ cod: false, online: true, upiQr: false });
  });

  it("without a preview answer, the admin's settings for the delivery type are used", () => {
    expect(visiblePaymentModes({ preview: null, settings, fulfillmentType: "LOCAL" })).toEqual({ cod: true, online: true, upiQr: false });
    expect(visiblePaymentModes({ preview: null, settings, fulfillmentType: "SHIPROCKET" })).toEqual({ cod: false, online: true, upiQr: true });
  });

  it("with nothing known, local and courier both show everything", () => {
    expect(visiblePaymentModes({ preview: null, settings: null, fulfillmentType: "LOCAL" })).toEqual({ cod: true, online: true, upiQr: true });
    expect(visiblePaymentModes({ preview: null, settings: null, fulfillmentType: "SHIPROCKET" }).cod).toBe(true);
  });

  it("the first section to open: online, then QR, then cash", () => {
    expect(firstOpenMode({ cod: true, online: true, upiQr: true })).toBe("online");
    expect(firstOpenMode({ cod: true, online: false, upiQr: true })).toBe("upi_qr");
    expect(firstOpenMode({ cod: true, online: false, upiQr: false })).toBe("cod");
    expect(firstOpenMode({ cod: false, online: false, upiQr: false })).toBeNull();
  });
});

describe("return windows form", () => {
  it("shows what is saved, or 4 hours / 7 days", () => {
    expect(returnFormFromSettings({})).toEqual({ local: { value: "4", unit: "hours" }, shiprocket: { value: "7", unit: "days" } });
    expect(returnFormFromSettings({ returnWindows: { local: { value: 2, unit: "days" }, shiprocket: { value: 12, unit: "hours" } } })).toEqual({
      local: { value: "2", unit: "days" },
      shiprocket: { value: "12", unit: "hours" },
    });
  });

  it("minutes", () => {
    expect(windowMinutes("4", "hours")).toBe(240);
    expect(windowMinutes("7", "days")).toBe(10080);
    expect(windowMinutes("x", "days")).toBeNaN();
  });

  it("only whole numbers of 1 or more, not above 90 days", () => {
    expect(windowProblem({ value: "4", unit: "hours" })).toBe("");
    expect(windowProblem({ value: "90", unit: "days" })).toBe("");
    expect(windowProblem({ value: "2160", unit: "hours" })).toBe("");
    expect(windowProblem({ value: "", unit: "hours" })).toMatch(/Type a number/);
    expect(windowProblem({ value: "0", unit: "hours" })).toMatch(/1 or more/);
    expect(windowProblem({ value: "1.5", unit: "hours" })).toMatch(/whole number/);
    expect(windowProblem({ value: "91", unit: "days" })).toMatch(/90 days/);
    expect(windowProblem({ value: "2161", unit: "hours" })).toMatch(/90 days/);
  });

  it("names the delivery type in the problem, and builds the payload with real numbers", () => {
    const f = returnFormFromSettings({});
    expect(returnProblem(f)).toBe("");
    expect(returnProblem({ ...f, local: { value: "0", unit: "hours" } })).toMatch(/^Local delivery:/);
    expect(returnProblem({ ...f, shiprocket: { value: "abc", unit: "days" } })).toMatch(/^Shiprocket:/);
    expect(returnPayload(f)).toEqual({ local: { value: 4, unit: "hours" }, shiprocket: { value: 7, unit: "days" } });
  });

  it("labels", () => {
    expect(windowLabel(1, "hours")).toBe("1 hour");
    expect(windowLabel(4, "hours")).toBe("4 hours");
    expect(windowLabel(1, "days")).toBe("1 day");
    expect(windowLabel(7, "days")).toBe("7 days");
    expect(labelFromMinutes(240)).toBe("4 hours");
    expect(labelFromMinutes(1440)).toBe("1 day");
    expect(labelFromMinutes(90)).toBe("90 minutes");
  });
});

describe("what the customer is told on an order", () => {
  const settings = { returnWindows: { local: { value: 6, unit: "hours" }, shiprocket: { value: 10, unit: "days" } } };

  it("uses the saved setting, or 4 hours / 7 days when unknown", () => {
    expect(customerReturnLabel(settings, false)).toBe("6 hours");
    expect(customerReturnLabel(settings, true)).toBe("10 days");
    expect(customerReturnLabel({}, false)).toBe("4 hours");
    expect(customerReturnLabel(null, true)).toBe("7 days");
    expect(customerReturnMinutes(settings, true)).toBe(14400);
  });

  it("an already-delivered order shows the window it was given, not today's setting", () => {
    const delivered = new Date("2026-11-20T10:00:00Z");
    const order = { deliveredAt: delivered, returnWindowExpiresAt: new Date(delivered.getTime() + 2 * 3600 * 1000) };
    expect(customerReturnLabel(settings, false, order)).toBe("2 hours");
    const courier = { deliveredAt: delivered, returnWindowExpiresAt: new Date(delivered.getTime() + 3 * 1440 * 60000) };
    expect(customerReturnLabel(settings, true, courier)).toBe("3 days");
  });
});
