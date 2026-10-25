import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Banknote,
  Calendar,
  Lock,
  Plus,
  HelpCircle,
  Smile,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";
import { customerApi } from "../services/customerApi";
import { useCart } from "../context/CartContext";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { useToast } from "@shared/components/ui/Toast";
import CheckoutOrderSuccess from "./checkout/components/CheckoutOrderSuccess";
import { createSocketTokenReader } from "@core/utils/authStorage";
import { STORAGE_KEYS } from "@core/utils/storage";
import { getOrderSocket, joinOrderRoom } from "@/core/services/orderSocket";

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const PaymentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const { clearCartSection, removeFromCart, cart } = useCart();

  const appName = settings?.storeName || settings?.brandName || "Anushka Store";

  // Retrieve checkout state from route state or sessionStorage backup
  const checkoutData = useMemo(() => {
    if (location.state && (location.state.orderAddress || location.state.currentAddress || location.state.cart)) {
      return location.state;
    }
    try {
      const saved = sessionStorage.getItem("pending_checkout_data");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.orderAddress || parsed.currentAddress || parsed.cart)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to parse cached checkout data", e);
    }
    return null;
  }, [location.state]);

  const [openAccordion, setOpenAccordion] = useState("online"); // 'online' | 'cod' | null
  const [isPriceDropdownOpen, setIsPriceDropdownOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const postOrderNavigateRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Redirect to checkout if data is completely missing
  useEffect(() => {
    if (!checkoutData) {
      showToast("Please review your order details before payment.", "info");
      navigate("/checkout", { replace: true });
    }
  }, [checkoutData, navigate, showToast]);

  if (!checkoutData) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
        <Loader2 className="animate-spin text-blue-600" size={36} />
      </div>
    );
  }

  const {
    orderAddress: rawOrderAddress,
    currentAddress: rawCurrentAddress,
    cart: orderItems = [],
    directBuyItem = null,
    pricingPreview = null,
    finalAmountToPay = 0,
    cartTotal = 0,
    itemTotal: rawItemTotal = 0,
    discountAmount: rawDiscountAmount = 0,
    discountOnMRP = 0,
    couponDiscount = 0,
    handlingFee: rawHandlingFee = 0,
    platformFee: rawPlatformFee = 0,
    shippingCharges: rawShippingCharges = 0,
    deliveryFee: rawDeliveryFee = 0,
    taxAmount: rawTaxAmount = 0,
    taxTotal: rawTaxTotal = 0,
    tipAmount: rawTipAmount = 0,
    walletAmount: rawWalletAmount = 0,
    totalSavings = 0,
    selectedCoupon = null,
    selectedTimeSlot = "now",
    walletAmountToUse = 0,
  } = checkoutData;

  const itemTotal = Number(
    rawItemTotal ||
    pricingPreview?.breakdown?.productSubtotal ||
    pricingPreview?.productSubtotal ||
    cartTotal ||
    0
  );
  const shippingCharges = Number(
    rawShippingCharges ||
    rawDeliveryFee ||
    pricingPreview?.breakdown?.deliveryFeeCharged ||
    pricingPreview?.deliveryFeeCharged ||
    0
  );
  const handlingFee = Number(
    rawHandlingFee ||
    rawPlatformFee ||
    pricingPreview?.breakdown?.handlingFeeCharged ||
    pricingPreview?.handlingFeeCharged ||
    0
  );
  const taxAmount = Number(
    rawTaxAmount ||
    rawTaxTotal ||
    pricingPreview?.breakdown?.taxTotal ||
    pricingPreview?.taxTotal ||
    0
  );
  const tipAmount = Number(
    rawTipAmount ||
    pricingPreview?.breakdown?.tipTotal ||
    pricingPreview?.tipTotal ||
    0
  );
  const discountTotal = Number(
    rawDiscountAmount ||
    couponDiscount ||
    pricingPreview?.breakdown?.discountTotal ||
    pricingPreview?.discountTotal ||
    0
  );
  const discountAmount = discountTotal;
  const walletAmount = Number(
    rawWalletAmount ||
    walletAmountToUse ||
    pricingPreview?.breakdown?.walletAmount ||
    pricingPreview?.walletAmount ||
    0
  );
  const customFees = Array.isArray(pricingPreview?.breakdown?.customFees)
    ? pricingPreview.breakdown.customFees
    : Array.isArray(pricingPreview?.customFees)
    ? pricingPreview.customFees
    : [];

  const orderAddress = rawOrderAddress || rawCurrentAddress;

  const whatsAppEmiUrl = useMemo(() => {
    const rawPhone = settings?.whatsappNumber || settings?.supportPhone || settings?.phone || "8209224481";
    const cleanDigits = String(rawPhone).replace(/[^\d]/g, "");
    const phoneWithCountry = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const message = `Hello, I want to inquire about No Cost EMI for my order of ₹${finalAmountToPay} on ${appName}.`;
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
  }, [settings?.whatsappNumber, settings?.supportPhone, settings?.phone, finalAmountToPay, appName]);

  const handleWhatsAppEMI = (e) => {
    try {
      window.open(whatsAppEmiUrl, "_blank", "noopener,noreferrer");
    } catch (_) {
      window.location.href = whatsAppEmiUrl;
    }
  };

  const handlePlaceOrder = async (mode) => {
    if (isPlacingOrder) return;

    if (!orderAddress || !orderAddress.address) {
      showToast("Delivery address is missing. Please select an address.", "error");
      navigate("/checkout");
      return;
    }

    setIsPlacingOrder(true);

    try {
      const taxAmount = pricingPreview?.taxTotal || 0;
      const orderData = {
        address: orderAddress,
        paymentMode: mode === "online" ? "ONLINE" : "COD",
        discountTotal,
        taxTotal: taxAmount,
        tipAmount: 0,
        timeSlot: selectedTimeSlot,
        walletAmount: walletAmountToUse,
        couponCode: selectedCoupon?.code || null,
        couponId: selectedCoupon?._id || selectedCoupon?.id || null,
        items: (orderItems.length > 0 ? orderItems : cart).map((item) => ({
          product: item.id || item._id,
          name: item.name,
          variantSku: String(item.variantSku || "").trim(),
          quantity: item.quantity,
          price: item.price,
          image: item.image,
          kitAddons: item.kitAddons || [],
        })),
      };

      const response = await customerApi.createOrder(orderData);

      if (response.data.success) {
        const result = response.data.result;
        const mainOrder =
          result.order ||
          (Array.isArray(result.orders) ? result.orders[0] : null);
        const mainOrderId = mainOrder?.orderId || result.orderId;
        const paymentRef =
          result.paymentRef || result.checkoutGroupId || mainOrderId;

        const isMultiOrder = Array.isArray(result.orders) && result.orders.length > 1;
        const postExitRoute = isMultiOrder ? "/orders" : `/orders/${mainOrderId}`;

        if (!mainOrderId) {
          setIsPlacingOrder(false);
          showToast("Order created. Checking your orders...", "warning");
          navigate("/orders");
          return;
        }

        // Online (Razorpay) Flow
        if (mode === "online") {
          try {
            const paymentRes = await customerApi.createPaymentOrder({
              orderRef: paymentRef,
              orderId: mainOrderId,
            });

            if (paymentRes.data.success) {
              const paymentData = paymentRes.data.result.payment;
              const razorpayOrderId = paymentData?.rawGatewayResponse?.razorpayOrderId;
              const razorpayKeyId = paymentData?.rawGatewayResponse?.keyId;
              const amountPaise = paymentData?.amount;
              const merchantOrderId = paymentData?.gatewayOrderId;

              if (!razorpayOrderId || !razorpayKeyId) {
                throw new Error("Razorpay checkout is not configured correctly. Please retry later.");
              }

              const isLoaded = await loadRazorpayScript();
              if (!isLoaded) {
                throw new Error("Razorpay SDK failed to load. Are you online?");
              }

              const options = {
                key: razorpayKeyId,
                amount: amountPaise,
                currency: "INR",
                name: appName,
                description: isMultiOrder
                  ? `Orders ${result.orders.map((o) => o.orderId).join(", ")}`
                  : `Order ${mainOrderId}`,
                order_id: razorpayOrderId,
                handler: async function (paymentResponse) {
                  try {
                    const confirmation = await customerApi.verifyOnlineOrderPayment(mainOrderId, {
                      merchantOrderId,
                      transactionId: paymentResponse.razorpay_payment_id,
                      razorpayOrderId: paymentResponse.razorpay_order_id,
                      signature: paymentResponse.razorpay_signature,
                    });
                    if (confirmation.data?.result?.paymentStatus === "CAPTURED") {
                      if (directBuyItem) {
                        removeFromCart(directBuyItem.id || directBuyItem._id, directBuyItem.variantSku);
                      } else {
                        clearCartSection("grocery");
                      }
                      sessionStorage.removeItem("pending_checkout_data");
                      sessionStorage.removeItem("direct_buy_item");
                    }
                  } catch (error) {
                    showToast(
                      error.response?.data?.message ||
                        "Payment is awaiting confirmation. Check its status before retrying.",
                      "warning"
                    );
                  }
                  navigate(`/payment-status?merchantOrderId=${encodeURIComponent(merchantOrderId)}`);
                },
                prefill: {
                  name: user?.name || orderAddress.name || "",
                  contact: user?.phone || orderAddress.phone || "",
                },
                theme: {
                  color: "#2875E8",
                },
                modal: {
                  ondismiss: function () {
                    setIsPlacingOrder(false);
                    showToast("Payment cancelled. You can retry from your orders list.", "warning");
                    navigate(postExitRoute);
                  },
                },
              };

              const rzp = new window.Razorpay(options);

              rzp.on("payment.failed", function (failResponse) {
                setIsPlacingOrder(false);
                showToast(`Payment failed: ${failResponse.error?.description || "Gateway error"}`, "error");
                navigate(postExitRoute);
              });

              rzp.open();
              return;
            } else {
              throw new Error(paymentRes.data.message || "Failed to initiate payment gateway");
            }
          } catch (payError) {
            setIsPlacingOrder(false);
            showToast(
              payError.message || "Order created but payment gateway failed. Please pay from order details.",
              "error"
            );
            navigate(postExitRoute);
            return;
          }
        }

        // Cash on Delivery (COD) Flow
        if (directBuyItem) {
          removeFromCart(directBuyItem.id || directBuyItem._id, directBuyItem.variantSku);
        } else {
          clearCartSection("grocery");
        }
        sessionStorage.removeItem("pending_checkout_data");
        sessionStorage.removeItem("direct_buy_item");
        showToast("Order placed successfully!", "success");
        setOrderId(mainOrderId);
        setShowSuccess(true);

        if (postOrderNavigateRef.current) {
          clearTimeout(postOrderNavigateRef.current);
        }
        postOrderNavigateRef.current = setTimeout(() => {
          postOrderNavigateRef.current = null;
          setIsPlacingOrder(false);
          navigate(postExitRoute);
        }, 2800);
      } else {
        setIsPlacingOrder(false);
        showToast(response.data.message || "Could not place order.", "error");
      }
    } catch (error) {
      setIsPlacingOrder(false);
      showToast(
        error.response?.data?.message || error.message || "Failed to place order. Please try again.",
        "error"
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20 font-sans select-none">
      {/* Order Success Animation Modal */}
      <CheckoutOrderSuccess orderId={orderId} show={showSuccess} />

      {/* Header — Matches Image 4 */}
      <header className="bg-white sticky top-0 z-40 border-b border-slate-100 shadow-2xs">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-1 -ml-1 text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ChevronLeft size={24} className="stroke-[2.2]" />
            </button>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider leading-none">
                Step 3 of 3
              </p>
              <h1 className="text-[17px] font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
                Payments
              </h1>
            </div>
          </div>

          {/* 100% Secure Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
            <Lock size={12} className="stroke-[2.4]" />
            <span>100% Secure</span>
          </div>
        </div>
      </header>

      {/* Main Payment Container */}
      <main className="max-w-xl mx-auto px-4 pt-3.5 space-y-3.5">
        {/* Total Amount Dropdown Bar — Matches Image 4 */}
        <div className="bg-[#EBF3FF] border border-[#D0E2FF] rounded-2xl p-4 transition-all shadow-2xs">
          <button
            type="button"
            onClick={() => setIsPriceDropdownOpen(!isPriceDropdownOpen)}
            className="w-full flex items-center justify-between text-left cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-blue-700 font-bold text-[14.5px]">
              <span>Total Amount</span>
              {isPriceDropdownOpen ? (
                <ChevronUp size={16} className="stroke-[2.5]" />
              ) : (
                <ChevronDown size={16} className="stroke-[2.5]" />
              )}
            </div>
            <span className="text-[17px] font-black text-blue-700 tracking-tight">
              ₹{finalAmountToPay}
            </span>
          </button>

          {/* Collapsible Quick Price Breakdown */}
          {isPriceDropdownOpen && (
            <div className="mt-3 pt-3 border-t border-blue-200/70 text-[12.5px] space-y-1.5 animate-in fade-in-50 duration-200">
              <div className="flex justify-between text-slate-600">
                <span>ITEM TOTAL</span>
                <span>₹{itemTotal}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SHIPPING CHARGES</span>
                <span className={shippingCharges > 0 ? "text-slate-900 font-medium" : "text-emerald-700 font-bold"}>
                  {shippingCharges > 0 ? `₹${shippingCharges}` : "FREE"}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>HANDLING FEE</span>
                <span>₹{handlingFee}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>TAX</span>
                <span>₹{taxAmount}</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>DELIVERY TIP</span>
                  <span>₹{tipAmount}</span>
                </div>
              )}
              {discountTotal > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>COUPON DISCOUNT {selectedCoupon?.code ? `(${selectedCoupon.code})` : ""}</span>
                  <span>-₹{discountTotal}</span>
                </div>
              )}
              {walletAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>WALLET APPLIED</span>
                  <span>-₹{walletAmount}</span>
                </div>
              )}
              {customFees.map((fee, idx) => (
                <div key={idx} className="flex justify-between text-slate-600">
                  <span className="uppercase">{fee.label || fee.name}</span>
                  <span>₹{fee.amount}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-blue-200/50">
                <span>TOTAL PAYABLE</span>
                <span>₹{finalAmountToPay}</span>
              </div>
            </div>
          )}
        </div>

        {/* Payment Options Accordion */}
        <div className="space-y-3">
          {/* Option 1: Credit / Debit / ATM Card / UPI (Pay Online) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setOpenAccordion(openAccordion === "online" ? null : "online")}
              className="w-full p-4 flex items-start gap-3.5 text-left cursor-pointer hover:bg-slate-50/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0 mt-0.5">
                <CreditCard size={20} strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14.5px] font-bold text-slate-900 leading-snug">
                    Credit / Debit / ATM Card / UPI
                  </h3>
                  {openAccordion === "online" ? (
                    <ChevronUp size={18} className="text-slate-500 shrink-0 ml-1 stroke-[2.2]" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-500 shrink-0 ml-1 stroke-[2.2]" />
                  )}
                </div>
                <p className="text-[12px] text-slate-500 font-normal mt-0.5">
                  Add and secure cards as per RBI guidelines
                </p>
              </div>
            </button>

            {/* Expanded Content with Yellow Place Order Button */}
            {openAccordion === "online" && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-blue-50/70 rounded-xl text-[12px] text-slate-700 border border-blue-100">
                  <p className="text-slate-600 text-[11.5px] leading-relaxed">
                    UPI (Google Pay, PhonePe, Paytm), Visa, MasterCard, RuPay, NetBanking & Wallets supported.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handlePlaceOrder("online")}
                  disabled={isPlacingOrder}
                  className="w-full bg-[#FFC200] hover:bg-[#F5B800] active:scale-[0.98] text-slate-900 font-extrabold text-[15px] py-3.5 px-6 rounded-xl shadow-md shadow-amber-200/60 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isPlacingOrder ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-slate-900" />
                      <span>Initiating Payment...</span>
                    </>
                  ) : (
                    <span>Pay Online ₹{finalAmountToPay}</span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Option 2: Cash on Delivery — Matches Image 4 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setOpenAccordion(openAccordion === "cod" ? null : "cod")}
              className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                  <Banknote size={20} strokeWidth={2.2} />
                </div>
                <h3 className="text-[14.5px] font-bold text-slate-900 leading-snug">
                  Cash on Delivery
                </h3>
              </div>
              {openAccordion === "cod" ? (
                <ChevronUp size={18} className="text-slate-500 shrink-0 stroke-[2.2]" />
              ) : (
                <ChevronDown size={18} className="text-slate-500 shrink-0 stroke-[2.2]" />
              )}
            </button>

            {/* Expanded Content with Clean COD Note and Place Order Button */}
            {openAccordion === "cod" && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-slate-50 rounded-xl text-[12px] text-slate-600 leading-relaxed border border-slate-200/60">
                  Pay with cash or UPI at the time of delivery at your doorstep.
                </div>

                <button
                  type="button"
                  onClick={() => handlePlaceOrder("cod")}
                  disabled={isPlacingOrder}
                  className="w-full bg-[#FFC200] hover:bg-[#F5B800] active:scale-[0.98] text-slate-900 font-extrabold text-[15px] py-3.5 px-6 rounded-xl shadow-md shadow-amber-200/60 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isPlacingOrder ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-slate-900" />
                      <span>Placing Order...</span>
                    </>
                  ) : (
                    <span>Place Order</span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Option 3: No Cost EMI */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setOpenAccordion(openAccordion === "emi" ? null : "emi")}
              className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                  <Calendar size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="text-[14.5px] font-bold text-slate-900 leading-snug">
                    No Cost EMI
                  </h3>
                </div>
              </div>
              {openAccordion === "emi" ? (
                <ChevronUp size={18} className="text-slate-500 shrink-0 stroke-[2.2]" />
              ) : (
                <ChevronDown size={18} className="text-slate-500 shrink-0 stroke-[2.2]" />
              )}
            </button>

            {/* Expanded Content with Yellow WhatsApp Contact Button */}
            {openAccordion === "emi" && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-emerald-50/70 rounded-xl text-[12px] text-slate-700 border border-emerald-100">
                  <p className="text-slate-600 text-[11.5px] leading-relaxed">
                    Contact our admin directly on WhatsApp to check your eligibility and activate easy No Cost EMI on this order.
                  </p>
                </div>

                <a
                  href={whatsAppEmiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleWhatsAppEMI}
                  className="w-full bg-[#FFC200] hover:bg-[#F5B800] active:scale-[0.98] text-slate-900 font-extrabold text-[15px] py-3.5 px-6 rounded-xl shadow-md shadow-amber-200/60 transition-all flex items-center justify-center gap-2 cursor-pointer no-underline text-center"
                >
                  <MessageCircle size={19} className="text-slate-900 stroke-[2.4]" />
                  <span>Contact on WhatsApp for EMI</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Trust Footer */}
        <div className="pt-8 pb-4 text-center space-y-2">
          <p className="text-[14px] font-bold text-slate-400 tracking-tight">
            So many happy customers and counting!
          </p>
          <div className="flex justify-center text-slate-300">
            <Smile size={32} strokeWidth={1.8} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default PaymentPage;
