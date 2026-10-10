import React from "react";
import { Clipboard, Tag, Heart, Wallet } from "lucide-react";
import { motion } from "framer-motion";

/**
 * CheckoutPricingBreakdown
 *
 * Props:
 *   pricingPreview    – breakdown object from the preview API (or null)
 *   isPreviewLoading  – boolean
 *   previewError      – string | null when preview failed
 *   selectedTip       – number
 *   onSelectTip       – (value) => void
 *   tipAmounts        – array of { value, label }
 *   walletAmountToUse – number
 *   finalAmountToPay  – number
 *   cartTotal         – number (fallback when preview is loading)
 *   selectedCoupon    – coupon object or null
 *   discountAmount    – number
 */
const CheckoutPricingBreakdown = React.memo(function CheckoutPricingBreakdown({
  pricingPreview,
  isPreviewLoading,
  previewError,
  selectedTip,
  onSelectTip,
  tipAmounts,
  walletAmountToUse,
  finalAmountToPay,
  cartTotal,
  selectedCoupon,
  discountAmount,
}) {
  const deliveryFee = pricingPreview?.deliveryFeeCharged || 0;
  const handlingFee = pricingPreview?.handlingFeeCharged || 0;
  const tipAmount = pricingPreview?.tipTotal || selectedTip || 0;
  const taxAmount = pricingPreview?.taxTotal || 0;
  const isWalletCovered =
    !!pricingPreview && walletAmountToUse > 0 && finalAmountToPay === 0;

  return (
    <>
      {/* Tip for Partner */}
      <motion.div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 lg:p-3 border border-orange-100">
        <div className="flex items-center gap-2 mb-2 lg:mb-1.5">
          <Heart size={18} className="text-orange-500 fill-orange-500 lg:w-4 lg:h-4" />
          <h3 className="font-black text-slate-800 text-sm lg:text-xs">Tip your delivery partner</h3>
        </div>
        <p className="text-xs lg:text-[11px] text-slate-600 mb-2.5 lg:mb-2">100% of the tip goes to them</p>
        <div className="grid grid-cols-4 gap-2">
          {tipAmounts.map((tip) => (
            <button
              key={tip.value}
              onClick={() => onSelectTip(tip.value)}
              className={`py-2 lg:py-1.5 rounded-xl border-2 transition-all font-bold text-sm lg:text-xs ${
                selectedTip === tip.value
                  ? "border-orange-500 bg-orange-100 text-orange-700"
                  : "border-orange-200 bg-white text-slate-700 hover:border-orange-300"
              }`}>
              {tip.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Bill Details */}
      <motion.div className="bg-white rounded-[2rem] lg:rounded-2xl p-6 lg:p-4 shadow-xl shadow-gray-200/50 lg:shadow-xs border border-slate-100">
        <div className="flex items-center gap-2 mb-6 lg:mb-3">
          <div className="h-10 w-10 lg:h-8 lg:w-8 rounded-2xl lg:rounded-xl bg-brand-50 flex items-center justify-center">
            <Clipboard size={20} className="text-primary lg:w-4 lg:h-4" />
          </div>
          <h3 className="font-[1000] text-slate-800 text-xl lg:text-sm tracking-tight uppercase">
            Order Summary
          </h3>
        </div>

        {previewError && !isPreviewLoading && (
          <div className="mb-4 lg:mb-2 px-3 py-3 lg:py-2 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs font-semibold leading-relaxed">
            {previewError}
          </div>
        )}

        <div className="space-y-4 lg:space-y-2">
          <div className="flex justify-between items-center px-2">
            <span className="text-slate-500 font-bold text-[13px] lg:text-xs uppercase tracking-wider">
              Item Total
            </span>
            <span className="font-black text-slate-800 text-sm lg:text-xs">
              ₹{pricingPreview?.productSubtotal ?? cartTotal}
            </span>
          </div>
          <div className="flex justify-between items-center px-2">
            <span className="text-slate-500 font-bold text-[13px] lg:text-xs uppercase tracking-wider">
              {pricingPreview?.fulfillmentType === "SHIPROCKET"
                ? "Courier Shipping"
                : "Delivery Fee (Express)"}
            </span>
            <span className="font-black text-slate-800 text-sm lg:text-xs">
              {pricingPreview ? (deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`) : isPreviewLoading ? "…" : "—"}
            </span>
          </div>
          {pricingPreview?.fulfillmentType === "SHIPROCKET" && (
            <div className="px-2 -mt-3 lg:-mt-1 flex items-center justify-between text-[11px] lg:text-[10px] font-semibold text-sky-600">
              <span>📦 Standard Courier (Shiprocket 3-4 days)</span>
              {deliveryFee === 0 && <span className="text-emerald-600 font-bold">FREE Above ₹499</span>}
            </div>
          )}
          {pricingPreview?.fulfillmentType === "LOCAL" && (
            <div className="px-2 -mt-3 lg:-mt-1 flex items-center justify-between text-[11px] lg:text-[10px] font-semibold text-emerald-600">
              <span>⚡ Local Express Delivery ({pricingPreview.deliveryEstimate || "12-15 mins"})</span>
              {deliveryFee === 0 && <span className="text-emerald-600 font-bold">FREE</span>}
            </div>
          )}
          {pricingPreview &&
            typeof pricingPreview.distanceKmActual === "number" &&
            typeof pricingPreview.distanceKmRounded === "number" && (
              <div className="px-2 -mt-3 lg:-mt-1 flex items-center justify-between text-[11px] lg:text-[10px] font-semibold text-slate-400">
                <span>
                  Distance: {pricingPreview.distanceKmActual.toFixed(2)} km
                  {pricingPreview.distanceKmRounded
                    ? ` (billed ${pricingPreview.distanceKmRounded.toFixed(2)} km)`
                    : ""}
                </span>
                <span className="uppercase tracking-wider">
                  {pricingPreview?.snapshots?.deliverySettings?.deliveryPricingMode ||
                    pricingPreview?.snapshots?.deliverySettings?.pricingMode ||
                    ""}
                </span>
              </div>
            )}
          <div className="flex justify-between items-center px-2">
            <span className="text-slate-500 font-bold text-[13px] lg:text-xs uppercase tracking-wider">
              Handling Fee
            </span>
            <span className="font-black text-slate-800 text-sm lg:text-xs">
              {pricingPreview ? `₹${handlingFee}` : isPreviewLoading ? "…" : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center px-2">
            <span className="text-slate-500 font-bold text-[13px] lg:text-xs uppercase tracking-wider">
              Tax
            </span>
            <span className="font-black text-slate-800 text-sm lg:text-xs">
              {pricingPreview ? `₹${taxAmount}` : isPreviewLoading ? "…" : "—"}
            </span>
          </div>

          {selectedCoupon && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-between items-center px-3 py-2 bg-brand-50 rounded-xl border border-brand-100">
              <span className="text-primary font-black text-xs flex items-center gap-2 uppercase tracking-wider">
                <Tag size={14} />
                Coupon Reserved
              </span>
              <span className="font-black text-primary">-₹{discountAmount}</span>
            </motion.div>
          )}

          {tipAmount > 0 && (
            <div className="flex justify-between items-center px-3 py-2 bg-orange-50 rounded-xl border border-orange-100 italic">
              <span className="text-orange-600 font-bold text-xs flex items-center gap-2">
                <Heart size={14} className="fill-orange-500" />
                Partner Support
              </span>
              <span className="font-black text-orange-600">₹{tipAmount}</span>
            </div>
          )}

          {walletAmountToUse > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-between items-center px-3 py-2 bg-brand-50 rounded-xl border border-brand-100 mb-2">
              <span className="text-primary font-black text-[11px] flex items-center gap-2 uppercase tracking-tight">
                <Wallet size={14} />
                Wallet Applied
              </span>
              <span className="font-black text-primary">-₹{walletAmountToUse}</span>
            </motion.div>
          )}

          <div className="mt-4 pt-6 lg:mt-3 lg:pt-3 border-t-2 border-dashed border-slate-100">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="font-[1000] text-slate-800 text-lg lg:text-sm uppercase tracking-tight">
                  {isWalletCovered ? "Fully Covered" : "Total Payable"}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                  {isWalletCovered
                    ? "Paid via Wallet"
                    : previewError
                      ? "Fix address to continue"
                      : "Safe & Secure Payment"}
                </span>
              </div>
              <span className="font-[1000] text-primary text-3xl lg:text-2xl tracking-tighter italic">
                {isPreviewLoading
                  ? "Calculating..."
                  : pricingPreview
                    ? `₹${Math.ceil(finalAmountToPay)}`
                    : "—"}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
});

export default CheckoutPricingBreakdown;
