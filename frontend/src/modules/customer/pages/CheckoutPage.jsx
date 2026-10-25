import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCart, isRefurbishedItem } from "../context/CartContext";
import { useAuth } from "../../../core/context/AuthContext";
import { customerApi } from "../services/customerApi";
import { useLocation as useAppLocation } from "../context/LocationContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { useDeliveryDecision } from "../services/useDeliveryDecision";
import { getCourierDeliveryDateText, resolveItemDeliveryInfo } from "../services/deliveryService";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Phone,
  Truck,
  Zap,
  Star,
  Plus,
  Minus,
  Tag,
  Sparkles,
  ShieldCheck,
  Check,
  MapPin,
  Package,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@shared/components/ui/Toast";
import { useSettings } from "@core/context/SettingsContext";
import { getCachedGeocode, setCachedGeocode } from "@/core/utils/geocodeCache";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AddAddressModal from "../components/shared/AddAddressModal";
import LocationDrawer from "../components/shared/LocationDrawer";
import CheckoutCouponSection from "./checkout/components/CheckoutCouponSection";

const CheckoutPage = () => {
  const {
    groceryCart,
    groceryCartTotal,
    groceryCartCount,
    addToCart,
    updateQuantity,
    removeFromCart,
  } = useCart();
  const { showToast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const appName = settings?.storeName || settings?.brandName || "Anushka Store";

  const {
    savedAddresses: locationSavedAddresses,
    currentLocation,
    isLocationReady,
    refreshLocation,
    isFetchingLocation,
    updateLocation,
  } = useAppLocation();

  const navigate = useNavigate();
  const location = useLocation();

  // Direct Buy item from Buy Now button
  const [directBuyItem, setDirectBuyItem] = useState(() => {
    const item = location.state?.directBuyItem;
    if (item && !isRefurbishedItem(item)) {
      return item;
    }
    try {
      const saved = sessionStorage.getItem("direct_buy_item");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && !isRefurbishedItem(parsed)) return parsed;
      }
    } catch (e) {}
    return null;
  });

  const isDirectBuy = Boolean(directBuyItem);

  const cart = useMemo(() => {
    if (directBuyItem) return [directBuyItem];
    return groceryCart;
  }, [directBuyItem, groceryCart]);

  const hasNavigatedToPaymentRef = useRef(false);
  const directBuyProcessedRef = useRef(false);

  // Flipkart style Buy Now back handler:
  // When user backs out without completing purchase, add the direct buy item to cart
  // so it is not lost, and redirect directly to that product's detail page (not /cart).
  const handleBack = useCallback(() => {
    if (isDirectBuy && directBuyItem && !directBuyProcessedRef.current) {
      directBuyProcessedRef.current = true;

      // 1. Add direct buy item to cart so it is saved with existing cart items
      const productToAdd = directBuyItem.productData || {
        ...directBuyItem,
        id: directBuyItem.id || directBuyItem._id,
        _id: directBuyItem.id || directBuyItem._id,
      };

      try {
        addToCart(
          productToAdd,
          Number(directBuyItem.quantity || 1),
          directBuyItem.variantSku || "",
          { skipDeliveryCheck: true, isRefurbished: directBuyItem.conditionType === 'refurbished' }
        );
      } catch (err) {
        console.warn("Could not add directBuyItem to cart on back:", err);
      }

      // 2. Clear direct buy from session
      try {
        sessionStorage.removeItem("direct_buy_item");
        sessionStorage.removeItem("direct_buy_return_url");
      } catch (e) {}

      // 3. Determine the product detail URL to redirect to
      const targetReturnUrl =
        location.state?.returnProductUrl ||
        sessionStorage.getItem("direct_buy_return_url") ||
        (directBuyItem.slug || directBuyItem.id || directBuyItem._id
          ? `/?product=${encodeURIComponent(directBuyItem.slug || directBuyItem.id || directBuyItem._id)}`
          : "/");

      navigate(targetReturnUrl, { replace: true });
      return;
    }

    // Default back behavior
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  }, [isDirectBuy, directBuyItem, addToCart, showToast, location.state, navigate]);

  // Intercept browser back button / Android back gesture when in direct buy mode
  useEffect(() => {
    if (!isDirectBuy || !directBuyItem) return;

    window.history.pushState({ inCheckoutDirectBuy: true }, "");

    const onPopState = () => {
      if (hasNavigatedToPaymentRef.current || directBuyProcessedRef.current) return;
      handleBack();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [isDirectBuy, directBuyItem, handleBack]);

  const cartTotal = useMemo(() => {
    if (directBuyItem) {
      const p = Number(directBuyItem.price || directBuyItem.salePrice || 0);
      return p * Number(directBuyItem.quantity || 1);
    }
    return groceryCartTotal;
  }, [directBuyItem, groceryCartTotal]);

  const [currentAddress, setCurrentAddress] = useState({
    type: "Home",
    name: "",
    address: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
  });

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isLocationDrawerOpen, setIsLocationDrawerOpen] = useState(false);
  const [isAddAddressModalOpen, setIsAddAddressModalOpen] = useState(false);
  const [addressToEdit, setAddressToEdit] = useState(null);
  const [isResolvingAddressCoords, setIsResolvingAddressCoords] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [manualCode, setManualCode] = useState("");
  const [pricingPreviewState, setPricingPreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const previewDebounceRef = useRef(null);
  const addressSelectionRef = useRef(0);

  // Scroll to top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Fetch available coupons
  useEffect(() => {
    const fetchCoupons = customerApi.getActiveCoupons || customerApi.getCoupons;
    if (typeof fetchCoupons === "function") {
      fetchCoupons()
        .then((res) => {
          if (res?.data?.success) {
            const list = res.data.result?.coupons || res.data.result || [];
            setCoupons(Array.isArray(list) ? list : []);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Sync address from currentLocation or saved addresses
  useEffect(() => {
    const activeAddressText =
      currentLocation?.address ||
      currentLocation?.formattedAddress ||
      currentLocation?.name ||
      "";

    // 1. If we have saved addresses, see if any matches currentLocation (by id or text)
    let matchingSaved = null;
    if (locationSavedAddresses && locationSavedAddresses.length > 0) {
      if (currentLocation?.addressId) {
        matchingSaved = locationSavedAddresses.find(
          (a) => (a.id || a._id) === currentLocation.addressId
        );
      }
      if (!matchingSaved && activeAddressText) {
        const norm = activeAddressText.trim().toLowerCase();
        matchingSaved = locationSavedAddresses.find((a) => {
          if (!a.address) return false;
          const aNorm = a.address.trim().toLowerCase();
          return aNorm === norm || norm.includes(aNorm) || aNorm.includes(norm);
        });
      }
    }

    if (matchingSaved) {
      setCurrentAddress({
        id: matchingSaved.id || matchingSaved._id,
        type: matchingSaved.type || matchingSaved.label || "Home",
        name: matchingSaved.name || user?.name || "Customer",
        address: matchingSaved.address || activeAddressText,
        landmark: matchingSaved.landmark || "",
        city: matchingSaved.city || currentLocation?.city || "",
        state: matchingSaved.state || currentLocation?.state || "",
        pincode: matchingSaved.pincode || currentLocation?.pincode || "",
        phone: matchingSaved.phone || user?.phone || "",
        location: matchingSaved.location || null,
      });
      return;
    }

    // 2. If currentLocation has an address (e.g. searched or geocoded place from home/cart)
    if (activeAddressText) {
      setCurrentAddress({
        id: currentLocation.addressId || "current-location",
        type: currentLocation.type || currentLocation.label || "Home",
        name: currentLocation.receiverName || user?.name || "Customer",
        address: activeAddressText,
        landmark: currentLocation.landmark || "",
        city: currentLocation.city || "",
        state: currentLocation.state || "",
        pincode: currentLocation.pincode || "",
        phone: currentLocation.phone || user?.phone || "",
        location:
          currentLocation.latitude && currentLocation.longitude
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : currentLocation.location || null,
      });
      return;
    }

    // 3. Fallback: if currentLocation has nothing at all, use default address from saved addresses
    if (locationSavedAddresses && locationSavedAddresses.length > 0) {
      const defaultAddress =
        locationSavedAddresses.find((a) => a.isDefault) ||
        locationSavedAddresses[0];

      if (defaultAddress) {
        setCurrentAddress({
          id: defaultAddress.id || defaultAddress._id,
          type: defaultAddress.type || defaultAddress.label || "Home",
          name: defaultAddress.name || user?.name || "Customer",
          address: defaultAddress.address || "",
          landmark: defaultAddress.landmark || "",
          city: defaultAddress.city || "",
          state: defaultAddress.state || "",
          pincode: defaultAddress.pincode || "",
          phone: defaultAddress.phone || user?.phone || "",
          location: defaultAddress.location || null,
        });

        updateLocation(
          {
            name: defaultAddress.address,
            address: defaultAddress.address,
            formattedAddress: defaultAddress.address,
            time: "20-35 mins",
            city: defaultAddress.city || "",
            state: defaultAddress.state || "",
            pincode: defaultAddress.pincode || "",
            addressId: defaultAddress.id || defaultAddress._id,
            receiverName: defaultAddress.name,
            phone: defaultAddress.phone,
            type: defaultAddress.type || defaultAddress.label || "Home",
            landmark: defaultAddress.landmark || "",
            latitude: defaultAddress.location?.lat ?? null,
            longitude: defaultAddress.location?.lng ?? null,
          },
          { persist: true, updateSavedHome: false }
        );
      }
    }
  }, [locationSavedAddresses, currentLocation, user, updateLocation]);

  const activeDestinationPincode =
    currentAddress.pincode ||
    currentLocation?.pincode ||
    location.state?.destinationPincode ||
    "";

  // Delivery decision
  const {
    decision: deliveryDecision,
    loading: isDeliveryDecisionLoading,
    error: deliveryDecisionError,
    getItem: getDeliveryItem,
  } = useDeliveryDecision(cart, activeDestinationPincode);

  const unserviceableCartItems = useMemo(() => {
    if (!deliveryDecision?.items || !Array.isArray(deliveryDecision.items)) return [];
    return cart.filter((item) => {
      const entry = getDeliveryItem(item);
      return entry && entry.isDeliverable === false;
    });
  }, [cart, deliveryDecision, getDeliveryItem]);

  const resolvedFulfillmentType = useMemo(() => {
    if (deliveryDecision?.overallFulfillment) {
      return deliveryDecision.overallFulfillment === "LOCAL_RIDERS"
        ? "LOCAL"
        : deliveryDecision.overallFulfillment;
    }
    return location.state?.initialFulfillmentType || directBuyItem?.fulfillmentType || "LOCAL";
  }, [deliveryDecision, location.state, directBuyItem]);

  const previewAddressKey = JSON.stringify({
    checkoutAddress: currentAddress.address,
    checkoutPincode: currentAddress.pincode,
    items: cart.map((item) => [item.id || item._id, item.variantSku, item.quantity]),
    coupon: selectedCoupon?.code,
  });

  const pricingPreview =
    pricingPreviewState?.__previewKey === previewAddressKey
      ? pricingPreviewState
      : null;

  // Backend preview finance
  useEffect(() => {
    if (cart.length === 0) return;

    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current);
    }

    previewDebounceRef.current = setTimeout(async () => {
      setIsPreviewLoading(true);
      setPreviewError(null);
      try {
        const payload = {
          items: cart.map((item) => ({
            product: item.id || item._id,
            name: item.name,
            variantSku: String(item.variantSku || "").trim(),
            quantity: item.quantity,
            price: item.price,
            image: item.image,
            kitAddons: item.kitAddons || [],
          })),
          address: {
            address: currentAddress.address,
            pincode: currentAddress.pincode,
            city: currentAddress.city,
            state: currentAddress.state,
            location: currentAddress.location || null,
          },
          couponCode: selectedCoupon?.code || null,
          couponId: selectedCoupon?._id || selectedCoupon?.id || null,
          tipAmount: 0,
          walletAmount: 0,
        };

        const previewFn = customerApi.previewCheckoutFinance || customerApi.checkoutPreview;
        if (typeof previewFn === "function") {
          const res = await previewFn(payload);
          if (res?.data?.success && res.data.result) {
            const snapshot = res.data.result;
            setPricingPreview({
              ...snapshot,
              __previewKey: previewAddressKey,
            });
          }
        }
      } catch (err) {
        setPreviewError(err.response?.data?.message || err.message);
      } finally {
        setIsPreviewLoading(false);
      }
    }, 250);

    return () => {
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current);
      }
    };
  }, [previewAddressKey, cart, currentAddress, selectedCoupon]);

  const handleApplyCoupon = (coupon) => {
    setSelectedCoupon(coupon);
    setIsCouponModalOpen(false);
    showToast(`Coupon "${coupon.code}" applied!`, "success");
  };

  const handleApplyManualCode = (code) => {
    if (!code) return;
    const match = coupons.find(
      (c) => String(c.code).trim().toUpperCase() === String(code).trim().toUpperCase()
    );
    if (match) {
      handleApplyCoupon(match);
    } else {
      setSelectedCoupon({ code: code.toUpperCase() });
      setIsCouponModalOpen(false);
      showToast(`Coupon "${code.toUpperCase()}" applied!`, "success");
    }
  };

  // Quantity updates
  const handleItemIncrement = (item) => {
    if (isDirectBuy) {
      setDirectBuyItem((prev) => ({
        ...prev,
        quantity: Math.min(10, (prev.quantity || 1) + 1),
      }));
    } else {
      updateQuantity(item.id || item._id, 1, item.variantSku);
    }
  };

  const handleItemDecrement = (item) => {
    if (isDirectBuy) {
      if ((directBuyItem.quantity || 1) <= 1) {
        showToast("Minimum 1 item required", "warning");
        return;
      }
      setDirectBuyItem((prev) => ({
        ...prev,
        quantity: Math.max(1, (prev.quantity || 1) - 1),
      }));
    } else {
      if (item.quantity === 1) {
        removeFromCart(item.id || item._id, item.variantSku);
      } else {
        updateQuantity(item.id || item._id, -1, item.variantSku);
      }
    }
  };

  // Price calculations
  const totalMRP = useMemo(() => {
    return cart.reduce((acc, item) => {
      const mrp = Number(item.originalPrice || item.mrp || item.price || 0);
      return acc + mrp * Number(item.quantity || 1);
    }, 0);
  }, [cart]);

  const totalSellingPrice = useMemo(() => {
    return cart.reduce((acc, item) => {
      const sp = Number(item.price || item.salePrice || 0);
      return acc + sp * Number(item.quantity || 1);
    }, 0);
  }, [cart]);

  const discountOnMRP = Math.max(0, totalMRP - totalSellingPrice);

  // Directly connect to backend preview fields with safe fallbacks
  const itemTotal = Number(
    pricingPreview?.breakdown?.productSubtotal ??
    pricingPreview?.productSubtotal ??
    totalSellingPrice ??
    cartTotal
  );

  const shippingCharges = Number(
    pricingPreview?.breakdown?.deliveryFeeCharged ??
    pricingPreview?.deliveryFeeCharged ??
    0
  );

  const handlingFee = Number(
    pricingPreview?.breakdown?.handlingFeeCharged ??
    pricingPreview?.handlingFeeCharged ??
    0
  );

  const taxAmount = Number(
    pricingPreview?.breakdown?.taxTotal ??
    pricingPreview?.taxTotal ??
    0
  );

  const tipAmount = Number(
    pricingPreview?.breakdown?.tipTotal ??
    pricingPreview?.tipTotal ??
    0
  );

  const discountAmount = Number(
    pricingPreview?.breakdown?.discountTotal ??
    pricingPreview?.discountTotal ??
    (selectedCoupon ? Math.round(cartTotal * 0.1) : 0)
  );

  const walletAmount = Number(
    pricingPreview?.breakdown?.walletAmount ??
    pricingPreview?.walletAmount ??
    0
  );

  const customFees = Array.isArray(pricingPreview?.breakdown?.customFees)
    ? pricingPreview.breakdown.customFees
    : Array.isArray(pricingPreview?.customFees)
    ? pricingPreview.customFees
    : [];

  const finalAmountToPay = Number(
    pricingPreview?.breakdown?.grandTotal ??
    pricingPreview?.grandTotal ??
    Math.max(0, itemTotal + shippingCharges + handlingFee + taxAmount + tipAmount - discountAmount - walletAmount)
  );

  const totalSavings = discountOnMRP + discountAmount;

  const displayName = currentAddress.name || user?.name || "Customer";
  const displayPhone = currentAddress.phone || user?.phone || "";
  const displayAddress =
    currentAddress.address ||
    (currentAddress.city ? `${currentAddress.city}, ${currentAddress.state} - ${currentAddress.pincode}` : "") ||
    "Please select or add a delivery address";

  const deliveryDateText = useMemo(() => {
    if (pricingPreview?.deliveryEstimate) {
      const est = String(pricingPreview.deliveryEstimate);
      if (est.toLowerCase().includes("business day") || est.toLowerCase().includes("3-4")) {
        return getCourierDeliveryDateText(new Date(), 4);
      }
      return pricingPreview.deliveryEstimate;
    }
    if (resolvedFulfillmentType === "LOCAL") {
      return "20-25 mins";
    }
    return getCourierDeliveryDateText(new Date(), 4);
  }, [pricingPreview, resolvedFulfillmentType]);

  const hasMixedFulfillment = useMemo(() => {
    if (cart.length <= 1) return false;
    let hasQuick = false;
    let hasCourier = false;
    for (const item of cart) {
      const itemDecision = getDeliveryItem(item);
      const previewItem = pricingPreview?.items?.find(
        (p) => String(p.product || p.productId || p._id) === String(item.id || item._id)
      );
      const info = resolveItemDeliveryInfo(item, {
        itemDecision,
        previewItem,
        destinationPincode: activeDestinationPincode,
        defaultFulfillment: resolvedFulfillmentType,
      });
      if (info.isQuick) {
        hasQuick = true;
      } else {
        hasCourier = true;
      }
    }
    return hasQuick && hasCourier;
  }, [cart, getDeliveryItem, pricingPreview, activeDestinationPincode, resolvedFulfillmentType]);

  const handleSelectSavedAddress = async (addr) => {
    addressSelectionRef.current += 1;
    setIsResolvingAddressCoords(true);

    const updated = {
      id: addr.id || addr._id,
      type: addr.type || addr.label || "Home",
      name: addr.name || displayName,
      address: addr.address || "",
      landmark: addr.landmark || "",
      city: addr.city || "",
      state: addr.state || "",
      pincode: addr.pincode || "",
      phone: addr.phone || displayPhone,
      location: addr.location || null,
    };

    setCurrentAddress(updated);
    setIsAddressModalOpen(false);
    setIsResolvingAddressCoords(false);

    // Synchronize to LocationContext so Home page, Cart page, and headers update immediately!
    updateLocation(
      {
        name: updated.address,
        address: updated.address,
        formattedAddress: updated.address,
        fullAddress: updated.address,
        time: "20-35 mins",
        city: updated.city,
        state: updated.state,
        pincode: updated.pincode,
        addressId: updated.id,
        receiverName: updated.name,
        phone: updated.phone,
        type: updated.type,
        landmark: updated.landmark,
        latitude: updated.location?.lat ?? null,
        longitude: updated.location?.lng ?? null,
      },
      { persist: true, updateSavedHome: false }
    );

    showToast(`Delivering to ${addr.name || addr.type || addr.label || "Address"}`, "success");
  };

  const handleContinueToPayment = () => {
    if (!currentAddress.address || currentAddress.address.trim() === "") {
      showToast("Please provide a valid delivery address before proceeding.", "error");
      setIsAddressModalOpen(true);
      return;
    }
    if (!/^\d{6}$/.test(String(currentAddress.pincode || "").trim())) {
      showToast("Please enter a valid 6-digit delivery pincode.", "error");
      setIsAddressModalOpen(true);
      return;
    }

    if (Array.isArray(unserviceableCartItems) && unserviceableCartItems.length > 0) {
      showToast("Please remove undeliverable items before proceeding.", "error");
      return;
    }

    hasNavigatedToPaymentRef.current = true;

    const checkoutPayload = {
      orderAddress: currentAddress,
      currentAddress,
      displayName,
      displayPhone,
      displayAddress,
      cart,
      directBuyItem: isDirectBuy ? directBuyItem : null,
      pricingPreview,
      cartTotal,
      itemTotal,
      finalAmountToPay,
      discountAmount,
      couponDiscount: discountAmount,
      discountOnMRP,
      totalMRP,
      totalSavings,
      handlingFee,
      platformFee: handlingFee,
      shippingCharges,
      deliveryFee: shippingCharges,
      taxAmount,
      taxTotal: taxAmount,
      tipAmount,
      walletAmount,
      selectedCoupon,
      selectedTimeSlot: "now",
      walletAmountToUse: walletAmount,
      resolvedFulfillmentType,
    };

    try {
      sessionStorage.setItem("pending_checkout_data", JSON.stringify(checkoutPayload));
    } catch (e) {
      console.warn("Could not save to sessionStorage", e);
    }

    navigate("/payment", { state: checkoutPayload });
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <Package size={32} />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Your cart is empty</h2>
        <p className="text-xs text-slate-500 mb-6 max-w-xs">
          Explore our trending catalog and add items to your cart or select Buy Now.
        </p>
        <Link
          to="/"
          className="px-6 py-2.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-slate-800 transition"
        >
          Explore Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-28 font-sans select-none">
      {/* ── 1. Top Header with 3-Step Progress Bar — Matches Image 1 ── */}
      <header className="bg-white sticky top-0 z-40 border-b border-slate-100 shadow-2xs">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-1 -ml-1 text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            aria-label="Go Back"
          >
            <ChevronLeft size={24} className="stroke-[2.2]" />
          </button>
          <h1 className="text-[17px] font-bold text-slate-900 tracking-tight">
            Confirm details
          </h1>
        </div>

        {/* Stepper Progress Bar */}
        <div className="max-w-xl mx-auto px-8 pb-3 pt-1">
          <div className="flex items-center justify-between relative">
            {/* Step 1: Address (Done) */}
            <div className="flex flex-col items-center gap-1 z-10">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Check size={14} strokeWidth={3} />
              </div>
              <span className="text-[11px] font-semibold text-slate-700">Address</span>
            </div>

            {/* Connecting Line 1-2 (Active Blue) */}
            <div className="flex-1 h-0.5 bg-blue-600 -mt-4 mx-2" />

            {/* Step 2: Confirm details (Current Active) */}
            <div className="flex flex-col items-center gap-1 z-10">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[12px] shadow-xs">
                2
              </div>
              <span className="text-[11px] font-bold text-blue-900">Confirm details</span>
            </div>

            {/* Connecting Line 2-3 (Inactive Grey) */}
            <div className="flex-1 h-0.5 bg-slate-200 -mt-4 mx-2" />

            {/* Step 3: Payment (Next Step) */}
            <div className="flex flex-col items-center gap-1 z-10">
              <div className="w-6 h-6 rounded-full border-2 border-slate-300 text-slate-400 flex items-center justify-center font-bold text-[12px] bg-white">
                3
              </div>
              <span className="text-[11px] font-medium text-slate-400">Payment</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="max-w-xl mx-auto px-4 pt-3.5 space-y-3.5">
        {/* ── 2. Delivering to Section — Matches Image 1 ── */}
        <section className="space-y-2">
          <h2 className="text-[15px] font-bold text-slate-900 tracking-tight">
            Delivering to
          </h2>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Home size={18} className="text-slate-800" />
                <span className="font-bold text-[14.5px] text-slate-900">
                  {displayName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(true)}
                className="text-[13px] font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
              >
                Change
              </button>
            </div>
            <p className="text-[12.5px] text-slate-600 leading-relaxed font-normal">
              {displayAddress}
            </p>
            {displayPhone && (
              <div className="flex items-center gap-1.5 text-[12.5px] text-slate-700 font-medium pt-0.5">
                <Phone size={13} className="text-slate-500" />
                <span>{displayPhone}</span>
              </div>
            )}
          </div>
        </section>

        {/* ── 3. Buy Now / Cart Order Item Card — Matches Image 1 ── */}
        <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
          {hasMixedFulfillment && (
            <div className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-950 mb-1">
              <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="font-bold">Multi-Seller Order:</strong> Products will arrive in separate packages — Quick Commerce items in 20-25 mins and Courier items by {getCourierDeliveryDateText(new Date(), 4)}.
              </p>
            </div>
          )}
          {cart.map((item, idx) => {
            const itemOriginalPrice = Number(item.originalPrice || item.mrp || 0);
            const itemSellingPrice = Number(item.salePrice || item.price || 0);
            const itemDiscount =
              itemOriginalPrice > itemSellingPrice
                ? Math.round(((itemOriginalPrice - itemSellingPrice) / itemOriginalPrice) * 100)
                : null;

            const itemDecision = getDeliveryItem(item);
            const previewItem = pricingPreview?.items?.find(
              (p) => String(p.product || p.productId || p._id) === String(item.id || item._id)
            );
            const itemDeliveryInfo = resolveItemDeliveryInfo(item, {
              itemDecision,
              previewItem,
              destinationPincode: activeDestinationPincode,
              defaultFulfillment: resolvedFulfillmentType,
            });

            return (
              <div key={item.id || item._id || idx} className="space-y-3">
                <div className="flex gap-3.5">
                  {/* Thumbnail Image */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 p-1 border border-slate-100">
                    {item.image ? (
                      <img
                        src={applyCloudinaryTransform(item.image, "f_auto,q_auto,w_240")}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Package size={24} className="text-slate-400" />
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    {itemDiscount && (
                      <p className="text-[11.5px] font-bold text-emerald-700 mb-0.5">
                        Top Discount of the Sale
                      </p>
                    )}
                    <h3 className="text-[13.5px] font-semibold text-slate-900 line-clamp-1 leading-snug">
                      {item.name}
                    </h3>
                    {(item.variantName || item.unit) && (
                      <p className="text-[12px] text-slate-500 font-medium mt-0.5">
                        {item.variantName ? `Size: ${item.variantName}` : `Unit: ${item.unit}`}
                      </p>
                    )}

                    {/* Rating Badge */}
                    <div className="flex items-center gap-1 mt-1">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-700 text-white text-[10px] font-bold">
                        {item.rating || 4.2} <Star size={9} className="fill-white" />
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">(78)</span>
                    </div>

                    {/* Price Row: Discount % + MRP + Selling Price */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {itemDiscount && (
                        <span className="text-[13px] font-bold text-emerald-700 flex items-center">
                          ↓{itemDiscount}%
                        </span>
                      )}
                      {itemOriginalPrice > itemSellingPrice && (
                        <span className="text-[13px] text-slate-400 line-through">
                          ₹{itemOriginalPrice.toLocaleString('en-IN')}
                        </span>
                      )}
                      <span className="text-[15px] font-bold text-slate-900">
                        ₹{itemSellingPrice.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Inline Quantity Controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() => handleItemDecrement(item)}
                          className="w-7 h-7 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-90 transition cursor-pointer"
                        >
                          <Minus size={13} strokeWidth={2.5} />
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleItemIncrement(item)}
                          className="w-7 h-7 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-90 transition cursor-pointer"
                        >
                          <Plus size={13} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Date Row — Item-Specific Dynamic Estimate */}
                {itemDeliveryInfo.isQuick ? (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[12.5px]">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                      <Zap size={14} className="fill-amber-500 text-amber-500 shrink-0" />
                      <span>
                        Delivery in <strong className="text-emerald-950 font-bold">{itemDeliveryInfo.estimateText}</strong>
                      </span>
                    </div>
                    <span className="text-[10.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                      ⚡ Quick Commerce
                    </span>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[12.5px]">
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <Truck size={14} className="text-blue-600 shrink-0" />
                      <span>
                        Delivery by <strong className="text-slate-900 font-bold">{itemDeliveryInfo.estimateText}</strong>
                      </span>
                    </div>
                    <span className="text-[10.5px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full">
                      📦 Standard Courier
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* ── 4. Savings Zone Card — Matches Image 1 ── */}
        <section className="bg-blue-50/70 rounded-2xl p-3.5 border border-blue-200/70 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white">
              WOW!
            </span>
            <span className="text-sm font-bold text-blue-950">
              Savings zone
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsCouponModalOpen(true)}
            className="w-full bg-white rounded-xl p-3 border border-blue-100 flex items-center justify-between hover:bg-blue-50/50 transition cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-blue-600" />
              <span className="text-[13px] font-semibold text-slate-800">
                {selectedCoupon ? `Coupon Applied: ${selectedCoupon.code}` : "View all coupons and offers"}
              </span>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </button>
        </section>

        {/* ── 5. Price Details Card — Matches Image 2 ── */}
        <section className="space-y-2">
          <h2 className="text-[15px] font-bold text-slate-900 tracking-tight">
            Price Details
          </h2>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-[13.5px]">
              <span className="text-slate-600 font-medium">ITEM TOTAL</span>
              <span className="text-slate-900 font-medium">₹{itemTotal}</span>
            </div>

            <div className="flex items-center justify-between text-[13.5px]">
              <span className="text-slate-600 font-medium">SHIPPING CHARGES</span>
              <span className={`font-medium ${shippingCharges > 0 ? "text-slate-900" : "text-emerald-700 font-bold"}`}>
                {pricingPreview
                  ? shippingCharges === 0
                    ? "FREE"
                    : `₹${shippingCharges}`
                  : isPreviewLoading
                  ? "Calculating..."
                  : "FREE"}
              </span>
            </div>

            <div className="flex items-center justify-between text-[13.5px]">
              <span className="text-slate-600 font-medium">HANDLING FEE</span>
              <span className="text-slate-900 font-medium">₹{handlingFee}</span>
            </div>

            <div className="flex items-center justify-between text-[13.5px]">
              <span className="text-slate-600 font-medium">TAX</span>
              <span className="text-slate-900 font-medium">₹{taxAmount}</span>
            </div>

            {tipAmount > 0 && (
              <div className="flex items-center justify-between text-[13.5px]">
                <span className="text-slate-600 font-medium">DELIVERY TIP</span>
                <span className="text-slate-900 font-medium">₹{tipAmount}</span>
              </div>
            )}

            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-[13.5px] text-emerald-700 font-medium">
                <span>COUPON DISCOUNT {selectedCoupon?.code ? `(${selectedCoupon.code})` : ""}</span>
                <span>-₹{discountAmount}</span>
              </div>
            )}

            {walletAmount > 0 && (
              <div className="flex items-center justify-between text-[13.5px] text-emerald-700 font-medium">
                <span>WALLET APPLIED</span>
                <span>-₹{walletAmount}</span>
              </div>
            )}

            {customFees.map((fee, idx) => (
              <div key={idx} className="flex items-center justify-between text-[13.5px]">
                <span className="text-slate-600 font-medium uppercase">{fee.label || fee.name}</span>
                <span className="text-slate-900 font-medium">₹{fee.amount}</span>
              </div>
            ))}

            <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
              <div>
                <span className="text-[15px] font-bold text-slate-900 block leading-tight uppercase">
                  TOTAL PAYABLE
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Safe & Secure Payment
                </span>
              </div>
              <span className="text-[18px] font-black text-slate-900">
                ₹{finalAmountToPay}
              </span>
            </div>

            {/* Green Savings Pill */}
            {totalSavings > 0 && (
              <div className="bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-200/80 flex items-center gap-2 text-emerald-800 text-[12.5px] font-bold">
                <Sparkles size={15} className="text-emerald-600 shrink-0" />
                <span>You'll Save ₹{totalSavings} on this order</span>
              </div>
            )}
          </div>
        </section>

        {/* ── 6. Trust Badge & Legal Disclaimer — Matches Image 2 & 3 ── */}
        <div className="flex items-center gap-3 px-2 py-1 text-slate-500">
          <ShieldCheck size={28} className="text-slate-400 shrink-0" />
          <p className="text-[12px] leading-snug">
            Safe and secure payments. Easy returns. 100% Authentic products.
          </p>
        </div>

        <p className="text-[11px] text-slate-400 px-2 leading-relaxed">
          By proceeding, you confirm that you're above 18 years of age and you agree to {appName}'s{" "}
          <Link to="/terms" className="text-blue-600 underline">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-blue-600 underline">
            Privacy Policy
          </Link>
        </p>
      </main>

      {/* ── 7. Sticky Bottom Action Bar with Continue Button — Matches Image 3 ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200/90 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-50">
        {totalSavings > 0 && (
          <div className="bg-emerald-50 border-b border-emerald-100 py-1.5 px-4 text-center text-[12px] font-bold text-emerald-800 flex items-center justify-center gap-1.5">
            <span>You'll save ₹{totalSavings} on this order</span>
          </div>
        )}
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            {totalMRP > finalAmountToPay && (
              <span className="text-[12px] text-slate-400 line-through block leading-none">
                ₹{totalMRP}
              </span>
            )}
            <span className="text-[19px] font-black text-slate-900 tracking-tight leading-tight">
              ₹{finalAmountToPay}
            </span>
          </div>

          <button
            type="button"
            onClick={handleContinueToPayment}
            disabled={isResolvingAddressCoords || (Array.isArray(unserviceableCartItems) && unserviceableCartItems.length > 0)}
            className="bg-[#FFC200] hover:bg-[#F5B800] active:scale-95 text-slate-900 font-extrabold text-[15px] px-8 py-3 rounded-xl shadow-md shadow-amber-200/50 transition-all cursor-pointer flex-1 max-w-[220px]"
          >
            Continue
          </button>
        </div>
      </div>

      {/* ── Address Selection Modal ── */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Delivery Address</DialogTitle>
            <DialogDescription>
              Choose an address for your order.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-3 max-h-[60vh] overflow-y-auto">
            {(!locationSavedAddresses || locationSavedAddresses.length === 0) ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                <MapPin className="mx-auto mb-2 text-slate-400" size={24} />
                No saved addresses yet.
              </div>
            ) : (
              (locationSavedAddresses || []).map((addr) => (
                <button
                  key={addr.id || addr._id}
                  onClick={() => handleSelectSavedAddress(addr)}
                  disabled={isResolvingAddressCoords}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                    currentAddress.id === (addr.id || addr._id)
                      ? "border-blue-600 bg-blue-50/60 shadow-xs"
                      : "border-slate-100 bg-white hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="font-bold text-slate-900 text-[13.5px]">
                      {addr.name || displayName}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                      {addr.type || "Address"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {addr.address}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Phone: {addr.phone || displayPhone}
                  </p>
                </button>
              ))
            )}
          </div>
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAddressModalOpen(false);
                setIsLocationDrawerOpen(true);
              }}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <MapPin size={15} className="text-blue-600" />
              Search or Use Current Location
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddressModalOpen(false);
                setIsAddAddressModalOpen(true);
              }}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-blue-600 text-blue-600 font-bold text-xs hover:bg-blue-50 transition cursor-pointer"
            >
              + Add New Address
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Location Drawer for Checkout ── */}
      <LocationDrawer
        isOpen={isLocationDrawerOpen}
        onClose={() => setIsLocationDrawerOpen(false)}
      />

      {/* ── Add New Address Modal ── */}
      <AddAddressModal
        isOpen={isAddAddressModalOpen}
        onClose={() => {
          setIsAddAddressModalOpen(false);
          setAddressToEdit(null);
        }}
        onAddressSaved={(newAddr) => {
          setIsAddAddressModalOpen(false);
          if (newAddr) {
            handleSelectSavedAddress(newAddr);
          }
        }}
        onSuccess={(newAddr) => {
          setIsAddAddressModalOpen(false);
          if (newAddr) {
            handleSelectSavedAddress(newAddr);
          }
        }}
        addressToEdit={addressToEdit}
      />

      {/* ── Coupon Selection Modal ── */}
      <CheckoutCouponSection
        coupons={coupons}
        selectedCoupon={selectedCoupon}
        manualCode={manualCode}
        onApplyCoupon={handleApplyCoupon}
        onRemoveCoupon={() => setSelectedCoupon(null)}
        onManualCodeChange={setManualCode}
        isOpen={isCouponModalOpen}
        onOpenChange={setIsCouponModalOpen}
        onApplyManualCode={handleApplyManualCode}
      />
    </div>
  );
};

export default CheckoutPage;
