import { getCodFeeView } from "../../shared/utils/codFee.js";

const preview = (codFeeQuote) => ({ breakdown: { codFeeQuote, grandTotal: 176 } });

describe("COD fee line on the payment page", () => {
  it("COD selected: the quoted fee is added to the amount (Flipkart-style 'COD fee' line)", () => {
    expect(getCodFeeView({ pricingPreview: preview(35), selectedMode: "cod", finalAmountToPay: 176 })).toEqual({
      codFeeQuote: 35,
      codFee: 35,
      payableAmount: 211,
    });
  });

  it("online, UPI QR, EMI or nothing selected: no COD fee, the amount is unchanged", () => {
    for (const mode of ["online", "upi_qr", "emi", null]) {
      const v = getCodFeeView({ pricingPreview: preview(35), selectedMode: mode, finalAmountToPay: 176 });
      expect(v.codFee).toBe(0);
      expect(v.payableAmount).toBe(176);
      expect(v.codFeeQuote).toBe(35); // still known, so switching to COD shows it at once
    }
  });

  it("no quote (local delivery, Shiprocket unreachable, old server): nothing is added even on COD", () => {
    for (const p of [preview(0), preview(undefined), {}, null, undefined, { breakdown: { codFeeQuote: "abc" } }, preview(-5)]) {
      const v = getCodFeeView({ pricingPreview: p, selectedMode: "cod", finalAmountToPay: 176 });
      expect(v).toEqual({ codFeeQuote: 0, codFee: 0, payableAmount: 176 });
    }
  });

  it("reads the quote from a flat preview as well, and keeps paise exact", () => {
    expect(getCodFeeView({ pricingPreview: { codFeeQuote: 35.5 }, selectedMode: "cod", finalAmountToPay: 100.1 }).payableAmount).toBe(135.6);
  });

  it("the wallet-reduced amount still gets the fee on top", () => {
    expect(getCodFeeView({ pricingPreview: preview(35), selectedMode: "cod", finalAmountToPay: 76 }).payableAmount).toBe(111);
  });
});
