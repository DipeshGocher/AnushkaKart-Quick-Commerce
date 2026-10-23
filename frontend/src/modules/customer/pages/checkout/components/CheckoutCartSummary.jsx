import React from "react";
import { Plus, Minus, Ban } from "lucide-react";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { resolveVariantStock } from "@/modules/customer/context/CartContext";
import { cn } from "@/lib/utils";

/**
 * CheckoutCartSummary
 *
 * Props:
 *   cart              – array of cart items
 *   onUpdateQuantity  – (id, delta, variantSku) => void
 *   onRemoveFromCart  – (id, variantSku) => void
 *   onMoveToWishlist  – (item) => void
 *   showAll           – boolean (currently unused — all items shown)
 *   onToggleShowAll   – () => void
 */
const CheckoutCartSummary = React.memo(function CheckoutCartSummary({
  cart,
  onUpdateQuantity,
  onRemoveFromCart,
  onMoveToWishlist,
  getDeliveryItem,
  isDeliveryLoading,
  deliveryError,
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
      {cart.map((item) => (
        <React.Fragment key={`${item.id}::${String(item.variantSku || "").trim()}`}>
        <div
          className="flex items-start gap-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
          <div className="h-20 w-20 rounded-xl overflow-hidden bg-slate-50 flex-shrink-0">
            <img
              src={applyCloudinaryTransform(item.image)}
              alt={item.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-slate-800 mb-1">{item.name}</h4>
            {(item.variantName || item.variantSku) && (
              <p className="text-xs text-slate-500 mb-1">
                Variant: {item.variantName || item.variantSku}
              </p>
            )}
            {(() => {
              const check = getDeliveryItem?.(item);
              if (isDeliveryLoading || !check) {
                return <div className="text-[10px] font-bold text-slate-500 mb-1">{deliveryError || "Checking delivery..."}</div>;
              }
              if (!check.isDeliverable) {
                return (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mb-1.5 rounded-md bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold">
                    <Ban size={11} className="shrink-0" />
                    <span>This item is only delivered in local areas</span>
                  </div>
                );
              }
              if (check) {
                const isLocal = check.fulfillmentType === "LOCAL_RIDERS";
                return (
                  <div className={`text-[10px] font-extrabold uppercase tracking-wide mb-1 ${isLocal ? "text-emerald-700" : "text-blue-700"}`}>
                    {isLocal ? "⚡ Quick (20-35 Mins)" : "📦 Standard (3-4 Days)"}
                  </div>
                );
              }
              return null;
            })()}
            <button
              onClick={() => onMoveToWishlist(item)}
              className="text-xs text-slate-500 underline hover:text-primary transition-colors">
              Move to wishlist
            </button>
          </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 bg-primary rounded-lg px-2 py-1">
                <button
                  onClick={() => {
                    if (item.quantity <= 1) return;
                    const productId = item.id || item._id;
                    onUpdateQuantity(productId, -1, item.variantSku);
                  }}
                  disabled={item.quantity <= 1}
                  className={cn(
                    "p-1 rounded transition-colors",
                    item.quantity <= 1
                      ? "opacity-30 cursor-not-allowed text-white/50"
                      : "text-white hover:bg-white/20 cursor-pointer"
                  )}
                  title={item.quantity <= 1 ? "Minimum quantity is 1" : "Decrease quantity"}
                >
                  <Minus size={14} strokeWidth={3} />
                </button>
                <span className="text-white font-bold min-w-[20px] text-center">
                  {item.quantity}
                </span>
                {(() => {
                  const itemStock = resolveVariantStock(item, String(item.variantSku || '').trim());
                  const maxAllowed = itemStock > 0 ? Math.min(itemStock, 10) : 0;
                  const isMax = item.quantity >= maxAllowed;
                  return (
                    <button
                      onClick={() => {
                        if (isMax) return;
                        onUpdateQuantity(item.id || item._id, 1, item.variantSku);
                      }}
                      disabled={isMax}
                      className={cn(
                        "p-1 rounded transition-colors",
                        isMax
                          ? "opacity-30 cursor-not-allowed text-white/50"
                          : "text-white hover:bg-white/20 cursor-pointer"
                      )}
                      title={
                        item.quantity >= itemStock
                          ? `Max available stock reached (${itemStock} units)`
                          : isMax
                          ? "Max allowed quantity reached (10 units)"
                          : "Increase quantity"
                      }
                    >
                      <Plus size={14} strokeWidth={3} />
                    </button>
                  );
                })()}
              </div>
            {(() => {
              const mrp = Number(item.price || 0);
              const sale = Number(item.salePrice || 0);
              const qty = Math.max(0, Number(item.quantity || 0));
              const hasDiscount =
                Number.isFinite(mrp) &&
                Number.isFinite(sale) &&
                sale > 0 &&
                sale < mrp;
              let unit = hasDiscount ? sale : mrp;
              
              let addonsTotal = 0;
              if (item.kitAddons && Array.isArray(item.kitAddons) && item.kitAddons.length > 0) {
                addonsTotal = item.kitAddons.reduce((sum, addon) => sum + (Number(addon.price) * Number(addon.quantity)), 0);
                unit += addonsTotal;
              }

              const total = Math.round(unit * qty);
              const totalMrp = Math.round((mrp + addonsTotal) * qty);
              
              return (
                <div className="text-right leading-tight">
                  <p className="text-base font-black text-slate-800">₹{total}</p>
                  {hasDiscount && (
                    <p className="text-[11px] font-bold text-slate-400 line-through">
                      ₹{totalMrp}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
        
        {/* Render Kit Addons if any */}
        {item.kitAddons && Array.isArray(item.kitAddons) && item.kitAddons.length > 0 && (
          <div className="ml-[92px] -mt-2 mb-4 bg-brand-50/50 rounded-xl p-3 border border-brand-100">
            <h5 className="text-[10px] font-black text-brand-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Plus size={10} className="text-primary" /> Included Add-ons
            </h5>
            <div className="space-y-1.5">
              {item.kitAddons.map((addon) => (
                <div key={addon.addonId} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">{addon.name}</span>
                    <span className="text-[10px] bg-white px-1.5 py-0.5 rounded text-slate-500 font-bold border border-slate-100">
                      x{addon.quantity}
                    </span>
                  </div>
                  <span className="font-bold text-slate-700">₹{addon.price * addon.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </React.Fragment>
      ))}
    </div>
  );
});

export default CheckoutCartSummary;
