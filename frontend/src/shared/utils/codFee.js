/**
 * COD fee on the payment page (the Flipkart-style "COD charges" line).
 *
 * The server quotes it with the checkout preview (`breakdown.codFeeQuote`): exactly what the courier charges
 * extra for Cash on Delivery on this parcel. It counts only while Cash on Delivery is the selected option, and
 * the server adds the same amount when the order is placed as COD, so the page and the order always agree.
 */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function getCodFeeView({ pricingPreview, selectedMode, finalAmountToPay }) {
  const quote = Number(pricingPreview?.breakdown?.codFeeQuote ?? pricingPreview?.codFeeQuote ?? 0);
  const codFeeQuote = Number.isFinite(quote) && quote > 0 ? round2(quote) : 0;
  const codFee = selectedMode === "cod" ? codFeeQuote : 0;
  const base = Number(finalAmountToPay || 0);
  return {
    codFeeQuote,
    codFee,
    payableAmount: round2(base + codFee),
  };
}
