import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Lottie from "lottie-react";
import { useInViewAnimation } from "@/core/hooks/useInViewAnimation";
import { useCart, isRefurbishedItem } from "../context/CartContext";
import { useAuth } from "../../../core/context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import { customerApi } from "../services/customerApi";
import { useLocation as useAppLocation } from "../context/LocationContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import {
  MapPin,
  Clock,
  CreditCard,
  Banknote,
  ChevronRight,
  ChevronLeft,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Heart,
  Truck,
  Tag,
  Sparkles,
  Plus,
  Minus,
  CheckCircle2,
  Shield,
  RotateCcw,
  Check,
  AlertCircle,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@shared/components/ui/Toast";
import { useSettings } from "@core/context/SettingsContext";
import SlideToPay from "../components/shared/SlideToPay";
import { getCachedGeocode, setCachedGeocode } from "@/core/utils/geocodeCache";
import { getJSON, setJSON, STORAGE_KEYS } from "@core/utils/storage";
import { createSocketTokenReader } from "@core/utils/authStorage";
import {
  getOrderSocket,
  joinOrderRoom,
  leaveOrderRoom,
  onOrderStatusUpdate,
} from "@/core/services/orderSocket";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Sub-components
import CheckoutAddressSection from "./checkout/components/CheckoutAddressSection";
import CheckoutPricingBreakdown from "./checkout/components/CheckoutPricingBreakdown";
import CheckoutPaymentSelector from "./checkout/components/CheckoutPaymentSelector";
import CheckoutCouponSection from "./checkout/components/CheckoutCouponSection";
import CheckoutOrderSuccess from "./checkout/components/CheckoutOrderSuccess";

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

const RefurbishedCheckoutPage = () => {
  const {
    refurbishedCart,
    refurbishedCartTotal,
    refurbishedCartCount,
    groceryCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCartSection,
  } = useCart();
  const { wishlist, addToWishlist } = useWishlist();
  const { showToast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const appName = settings?.appName || "AnushkaKart";
  const {
    savedAddresses: locationSavedAddresses,
    currentLocation,
    refreshLocation,
    isFetchingLocation,
    updateLocation,
  } = useAppLocation();

  // Support direct buy item if passed from refurbished details
  const directBuyItem = useMemo(() => {
    const item = location.state?.directBuyItem;
    if (item && isRefurbishedItem(item)) {
      return item;
    }
    return null;
  }, [location.state]);

  const cart = useMemo(() => {
    if (directBuyItem) return [directBuyItem];
    return refurbishedCart;
  }, [directBuyItem, refurbishedCart]);

  const cartTotal = useMemo(() => {
    if (directBuyItem) {
      const p = Number(directBuyItem.salePrice || directBuyItem.price || 0);
      return p * Number(directBuyItem.quantity || 1);
    }
    return refurbishedCartTotal;
  }, [directBuyItem, refurbishedCartTotal]);

  const cartCount = useMemo(() => {
    if (directBuyItem) {
      return Number(directBuyItem.quantity || 1);
    }
    return refurbishedCartCount;
  }, [directBuyItem, refurbishedCartCount]);

  // State management
  const [selectedPayment, setSelectedPayment] = useState("cash");
  const [selectedTip, setSelectedTip] = useState(0);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isResolvingAddressCoords, setIsResolvingAddressCoords] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [walletAmountToUse, setWalletAmountToUse] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [pricingPreview, setPricingPreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const postOrderNavigateRef = useRef(null);
  const previewDebounceRef = useRef(null);

  const [currentAddress, setCurrentAddress] = useState({
    type: "Home",
    name: "",
    address: "",
    landmark: "",
    city: "",
    phone: "",
  });
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
  const [editAddressForm, setEditAddressForm] = useState({
    type: "Home",
    name: "",
    address: "",
    landmark: "",
    city: "",
    phone: "",
  });
  const [showRecipientForm, setShowRecipientForm] = useState(false);
  const [recipientData, setRecipientData] = useState({
    completeAddress: "",
    landmark: "",
    pincode: "",
    name: "",
    phone: "",
  });
  const [savedRecipient, setSavedRecipient] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [manualCode, setManualCode] = useState("");
  const [emptyBoxData, setEmptyBoxData] = useState(null);
  const { ref: emptyCartAnimRef, isVisible: emptyCartVisible } = useInViewAnimation();

  useEffect(() => {
    if (cart.length === 0) {
      import("../../../assets/lottie/Empty box.json")
        .then((m) => setEmptyBoxData(m.default))
        .catch(() => {});
    }
  }, [cart.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const addressInitializedRef = useRef(false);

  useEffect(() => {
    if (user && !addressInitializedRef.current) {
      const savedAddr = (locationSavedAddresses && locationSavedAddresses.length > 0)
        ? locationSavedAddresses[0]
        : (user.addresses && user.addresses.length > 0)
          ? user.addresses[0]
          : null;

      if (savedAddr || user.name || user.phone) {
        const defaultAddr = {
          type: savedAddr?.label ? (savedAddr.label.charAt(0).toUpperCase() + savedAddr.label.slice(1)) : "Home",
          name: user.name || "Customer",
          address: savedAddr?.fullAddress || "",
          landmark: savedAddr?.landmark || "",
          city: `${savedAddr?.city || ""} ${savedAddr?.pincode || ""}`.trim() || "",
          phone: user.phone || "",
          location: savedAddr?.location || currentLocation || undefined,
        };

        setCurrentAddress(defaultAddr);
        setEditAddressForm(defaultAddr);
        addressInitializedRef.current = true;
      }
    }
  }, [user, locationSavedAddresses, currentLocation]);

  const paymentMethods = [
    ...(settings?.onlineEnabled === false
      ? []
      : [
          {
            id: "online",
            label: "Pay Online",
            icon: CreditCard,
            sublabel: "UPI / Cards / NetBanking",
          },
        ]),
    ...(settings?.codEnabled === false
      ? []
      : [
          {
            id: "cash",
            label: "Cash on Delivery",
            icon: Banknote,
            sublabel: "Pay cash at delivery",
          },
        ]),
  ];

  const tipAmounts = [{ value: 0, label: "No Tip" }];

  const discountAmount = selectedCoupon
    ? selectedCoupon.discountAmount || selectedCoupon.discount || 0
    : 0;

  const RECIPIENT_STORAGE_KEY = STORAGE_KEYS.RECIPIENT_ADDRESS;

  const displayName = savedRecipient?.name || currentAddress.name || user?.name || "Customer";
  const displayPhone = savedRecipient?.phone || currentAddress.phone || user?.phone || "";
  const displayAddress = savedRecipient
    ? `${savedRecipient.completeAddress}${savedRecipient.landmark ? `, ${savedRecipient.landmark}` : ""}${savedRecipient.pincode ? ` - ${savedRecipient.pincode}` : ""}`
    : `${currentAddress.address}${currentAddress.landmark ? `, ${currentAddress.landmark}` : ""}${currentAddress.city ? `, ${currentAddress.city}` : ""}`;

  useEffect(() => {
    if (!paymentMethods.length) return;
    const exists = paymentMethods.some((method) => method.id === selectedPayment);
    if (!exists) {
      setSelectedPayment(paymentMethods[0].id);
    }
  }, [paymentMethods, selectedPayment]);

  useEffect(() => {
    if (useWallet && user?.walletBalance && pricingPreview?.grandTotal) {
      const maxAvailable = Number(user.walletBalance || 0);
      const totalToPay = Number(pricingPreview.grandTotal || 0);
      setWalletAmountToUse(Math.min(maxAvailable, totalToPay));
    } else {
      setWalletAmountToUse(0);
    }
  }, [useWallet, user?.walletBalance, pricingPreview?.grandTotal]);

  const finalAmountToPay = Math.max(0, (pricingPreview?.grandTotal || 0) - walletAmountToUse);

  const buildAddressForOrder = () => {
    if (savedRecipient) {
      return {
        type: "Other",
        name: savedRecipient.name,
        address: savedRecipient.completeAddress,
        landmark: savedRecipient.landmark || "",
        city: savedRecipient.pincode ? `${savedRecipient.pincode}` : "",
        phone: savedRecipient.phone,
        location:
          currentLocation?.latitude && currentLocation?.longitude
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : undefined,
      };
    }

    const addrLoc = currentAddress?.location;
    const hasAddrLoc =
      addrLoc &&
      typeof addrLoc.lat === "number" &&
      typeof addrLoc.lng === "number" &&
      Number.isFinite(addrLoc.lat) &&
      Number.isFinite(addrLoc.lng);

    return {
      ...currentAddress,
      location: hasAddrLoc ? { lat: addrLoc.lat, lng: addrLoc.lng } : undefined,
    };
  };

  const handleSaveRecipient = () => {
    if (
      !recipientData.completeAddress ||
      !recipientData.name ||
      recipientData.phone.length !== 10
    ) {
      showToast("Please fill all required fields", "error");
      return;
    }
    setSavedRecipient(recipientData);
    setShowRecipientForm(false);
    setJSON(RECIPIENT_STORAGE_KEY, recipientData);
    showToast("Recipient details saved!", "success");
  };

  const handleMoveToWishlist = (item) => {
    addToWishlist(item);
    removeFromCart(item.id || item._id, item.variantSku);
    showToast(`${item.name} moved to wishlist`, "success");
  };

  const handleOpenEditAddress = () => {
    setEditAddressForm(currentAddress);
    setIsEditAddressOpen(true);
  };

  const isValidLatLng = (loc) =>
    loc &&
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng);

  const resolveAddressCoords = async (addressText) => {
    const q = String(addressText || "").trim();
    if (!q) return null;

    const cacheKey = `addr:${q}`;
    const cached = getCachedGeocode(cacheKey);
    if (cached?.location?.lat && cached?.location?.lng) {
      return cached.location;
    }

    try {
      const resp = await customerApi.geocodeAddress(q);
      const loc = resp.data?.result?.location;
      if (isValidLatLng(loc)) {
        setCachedGeocode(cacheKey, { location: { lat: loc.lat, lng: loc.lng } });
        return { lat: loc.lat, lng: loc.lng };
      }
    } catch (e) {
      const serverMsg =
        e?.response?.data?.message ||
        e?.response?.data?.error?.message ||
        e?.message ||
        null;
      const err = new Error(serverMsg || "Could not geocode address");
      err.__serverMsg = serverMsg;
      throw err;
    }
    return null;
  };

  const handleSelectSavedAddress = async (addr) => {
    const rawText = addr?.address || "";
    const addrLoc = addr?.location;
    const hasLoc = isValidLatLng(addrLoc);
    const pid = typeof addr?.placeId === "string" ? addr.placeId.trim() : "";

    setIsResolvingAddressCoords(true);
    try {
      let resolvedLoc = null;
      try {
        if (hasLoc) {
          resolvedLoc = addrLoc;
        } else if (pid) {
          const cacheKey = `pid:${pid}`;
          const cached = getCachedGeocode(cacheKey);
          if (cached?.location?.lat && cached?.location?.lng) {
            resolvedLoc = cached.location;
          } else {
            const resp = await customerApi.geocodePlaceId(pid);
            const loc = resp.data?.result?.location;
            if (isValidLatLng(loc)) {
              resolvedLoc = { lat: loc.lat, lng: loc.lng };
              setCachedGeocode(cacheKey, { location: resolvedLoc });
            }
          }
        } else {
          resolvedLoc = await resolveAddressCoords(rawText);
        }
      } catch (e) {
        showToast(
          e?.__serverMsg ||
            e?.message ||
            "Could not fetch coordinates for this address.",
          "error",
        );
      }

      if (!resolvedLoc) {
        showToast(
          "Could not fetch coordinates for this address. Please edit the address or choose a different one.",
          "error",
        );
        return;
      }

      setCurrentAddress({
        type: addr.label,
        name: user?.name || currentAddress.name,
        address: rawText,
        city: "",
        phone: addr.phone || currentAddress.phone,
        landmark: "",
        ...(pid ? { placeId: pid } : {}),
        ...(resolvedLoc ? { location: resolvedLoc } : {}),
      });

      if (resolvedLoc) {
        updateLocation(
          {
            name: rawText,
            time: currentLocation?.time || "2-3 days",
            city: currentLocation?.city,
            state: currentLocation?.state,
            pincode: currentLocation?.pincode,
            latitude: resolvedLoc.lat,
            longitude: resolvedLoc.lng,
          },
          { persist: true, updateSavedHome: false },
        );
      }

      setIsAddressModalOpen(false);
    } finally {
      setIsResolvingAddressCoords(false);
    }
  };

  const handleSaveEditedAddress = async () => {
    if (
      !editAddressForm.name.trim() ||
      !editAddressForm.address.trim() ||
      !editAddressForm.city.trim()
    ) {
      showToast("Please fill name, address and city", "error");
      return;
    }

    let location = null;
    let placeId = null;
    let formattedAddress = null;
    try {
      const query = [
        editAddressForm.address,
        editAddressForm.landmark,
        editAddressForm.city,
      ]
        .filter(Boolean)
        .join(", ");
      const resp = await customerApi.geocodeAddress(query);
      const loc = resp.data?.result?.location;
      if (
        loc &&
        typeof loc.lat === "number" &&
        typeof loc.lng === "number" &&
        Number.isFinite(loc.lat) &&
        Number.isFinite(loc.lng)
      ) {
        location = { lat: loc.lat, lng: loc.lng };
        placeId = resp.data?.result?.placeId || null;
        formattedAddress = resp.data?.result?.formattedAddress || null;
        updateLocation(
          {
            name: resp.data?.result?.formattedAddress || query,
            time: currentLocation?.time || "2-3 days",
            city: currentLocation?.city,
            state: currentLocation?.state,
            pincode: currentLocation?.pincode,
            latitude: loc.lat,
            longitude: loc.lng,
          },
          { persist: true, updateSavedHome: false },
        );
      }
    } catch (e) {
      showToast(
        e.response?.data?.message || "Could not fetch coordinates for this address.",
        "error",
      );
    }

    setCurrentAddress({
      ...editAddressForm,
      ...(location ? { location } : {}),
      ...(placeId ? { placeId } : {}),
      ...(formattedAddress ? { formattedAddress } : {}),
    });
    setIsEditAddressOpen(false);
    showToast("Delivery address updated", "success");
  };

  const handleUseCurrentLiveLocation = async () => {
    const result = await refreshLocation();
    if (result?.ok && result.location) {
      const liveLocation = result.location;
      setCurrentAddress((prev) => ({
        ...prev,
        address: liveLocation.name,
        landmark: "",
        city: [liveLocation.city, liveLocation.state, liveLocation.pincode]
          .filter(Boolean)
          .join(", "),
        ...(typeof liveLocation.latitude === "number" &&
        typeof liveLocation.longitude === "number"
          ? { location: { lat: liveLocation.latitude, lng: liveLocation.longitude } }
          : {}),
      }));
      showToast("Using your current live location", "success");
      return;
    }

    if (currentLocation?.name) {
      setCurrentAddress((prev) => ({
        ...prev,
        address: currentLocation.name,
        landmark: "",
        city: [currentLocation.city, currentLocation.state, currentLocation.pincode]
          .filter(Boolean)
          .join(", "),
        ...(typeof currentLocation.latitude === "number" &&
        typeof currentLocation.longitude === "number"
          ? { location: { lat: currentLocation.latitude, lng: currentLocation.longitude } }
          : {}),
      }));
      showToast("Using your last detected location", "success");
      return;
    }

    showToast(result?.error || "Unable to detect current location", "error");
  };

  const handleApplyCoupon = async (coupon) => {
    try {
      const payload = {
        code: coupon.code,
        cartTotal,
        items: cart,
        customerId: user?._id,
      };
      const res = await customerApi.validateCoupon(payload);
      if (res.data.success) {
        const data = res.data.result;
        setSelectedCoupon({
          ...coupon,
          ...data,
        });
        setIsCouponModalOpen(false);
        showToast(`Coupon ${coupon.code} applied!`, "success");
      } else {
        showToast(res.data.message || "Unable to apply coupon", "error");
      }
    } catch (error) {
      showToast(
        error.response?.data?.message || "Unable to apply coupon",
        "error",
      );
    }
  };

  const handleApplyManualCode = async () => {
    if (!manualCode.trim()) {
      showToast("Please enter a coupon code", "error");
      return;
    }
    try {
      const res = await customerApi.validateCoupon({
        code: manualCode.trim(),
        cartTotal,
        items: cart,
        customerId: user?._id,
      });
      if (res.data.success) {
        const data = res.data.result;
        setSelectedCoupon({
          code: manualCode.trim(),
          description: "Applied manually",
          ...data,
        });
        showToast(`Coupon ${manualCode.trim()} applied!`, "success");
      } else {
        showToast(res.data.message || "Invalid coupon", "error");
      }
    } catch (error) {
      showToast(
        error.response?.data?.message || "Invalid coupon",
        "error",
      );
    }
  };

  // Fetch coupons on mount
  useEffect(() => {
    const parsed = getJSON(RECIPIENT_STORAGE_KEY, null);
    if (parsed && parsed.completeAddress && parsed.name && parsed.phone) {
      setRecipientData(parsed);
      setSavedRecipient(parsed);
    }

    const fetchCoupons = async () => {
      try {
        const res = await customerApi.getActiveCoupons();
        if (res.data.success) {
          const list = res.data.result || res.data.results || [];
          setCoupons(list);
        }
      } catch {
        // silently ignore
      }
    };
    fetchCoupons();
  }, []);

  // Debounced checkoutPreview
  useEffect(() => {
    if (!isAuthenticated || cart.length === 0) {
      setPricingPreview(null);
      setPreviewError(null);
      return;
    }

    const buildPreviewPayload = () => ({
      items: cart.map((item) => ({
        product: item.id || item._id,
        name: item.name,
        variantSku: String(item.variantSku || "").trim(),
        quantity: item.quantity,
        price: item.price,
        image: item.image,
        kitAddons: item.kitAddons || [],
      })),
      address: buildAddressForOrder(),
      discountTotal: discountAmount,
      taxTotal: 0,
      tipAmount: selectedTip,
      paymentMode: selectedPayment === "online" ? "ONLINE" : "COD",
      timeSlot: "standard_courier",
    });

    const fetchPreview = async () => {
      try {
        setIsPreviewLoading(true);
        setPreviewError(null);
        const res = await customerApi.checkoutPreview(buildPreviewPayload());
        if (res.data?.success) {
          setPricingPreview(res.data.result?.breakdown ?? null);
          setPreviewError(null);
        } else {
          setPricingPreview(null);
          setPreviewError(res.data?.message || "Unable to calculate order total");
        }
      } catch (error) {
        console.error("Refurbished checkout preview failed", error);
        setPricingPreview(null);
        const message =
          error?.response?.data?.message ||
          error?.message ||
          "Unable to calculate order total. Please check your delivery address.";
        setPreviewError(message);
      } finally {
        setIsPreviewLoading(false);
      }
    };

    clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(fetchPreview, 400);

    return () => clearTimeout(previewDebounceRef.current);
  }, [
    isAuthenticated,
    cart,
    selectedPayment,
    selectedTip,
    discountAmount,
    savedRecipient,
    currentAddress,
    currentLocation,
  ]);

  const handlePlaceOrder = async () => {
    const orderAddress = buildAddressForOrder();

    if (!orderAddress?.address || orderAddress.address.trim() === "") {
      showToast("Please provide a valid delivery address before placing your order.", "error");
      return;
    }

    setIsPlacingOrder(true);
    try {
      const taxAmount = pricingPreview?.taxTotal || 0;
      const orderData = {
        address: orderAddress,
        paymentMode: selectedPayment === "online" ? "ONLINE" : "COD",
        discountTotal: discountAmount,
        taxTotal: taxAmount,
        tipAmount: selectedTip,
        timeSlot: "standard_courier",
        walletAmount: walletAmountToUse,
        items: cart.map((item) => ({
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

        if (!mainOrderId) {
          setIsPlacingOrder(false);
          showToast(
            "Order placed but ID not received. Checking order history...",
            "warning"
          );
          navigate("/orders");
          return;
        }

        if (selectedPayment === "online") {
          try {
            const paymentRes = await customerApi.createPaymentOrder({
              orderRef: paymentRef,
              orderId: mainOrderId,
            });

            if (paymentRes.data.success) {
              const paymentData = paymentRes.data.result.payment;
              const razorpayOrderId = paymentData?.rawGatewayResponse?.razorpayOrderId;
              const amountPaise = paymentData?.amount;
              const merchantOrderId = paymentData?.gatewayOrderId;

              if (!razorpayOrderId) {
                throw new Error("Razorpay Order ID not received from backend");
              }

              const isLoaded = await loadRazorpayScript();
              if (!isLoaded) {
                throw new Error("Razorpay SDK failed to load. Are you online?");
              }

              const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_b0PSRa7kNhbHj3",
                amount: amountPaise,
                currency: "INR",
                name: "AnushkaKart Refurbished",
                description: `Refurbished Order ${mainOrderId}`,
                order_id: razorpayOrderId,
                handler: function (response) {
                  if (directBuyItem) {
                    removeFromCart(directBuyItem.id || directBuyItem._id, directBuyItem.variantSku);
                  } else {
                    clearCartSection('refurbished');
                  }
                  showToast("Payment Successful! Verifying order...", "success");
                  navigate(`/payment-status?merchantOrderId=${merchantOrderId}&paymentId=${response.razorpay_payment_id}`);
                },
                prefill: {
                  name: user?.name || orderAddress.name || "",
                  contact: user?.phone || orderAddress.phone || "",
                },
                theme: {
                  color: "#2874F0", // Refurbished Flipkart Royal Blue
                },
                modal: {
                  ondismiss: function() {
                    setIsPlacingOrder(false);
                    showToast("Payment cancelled. You can complete payment from orders.", "warning");
                    navigate(`/orders/${mainOrderId}`);
                  }
                }
              };

              const rzp = new window.Razorpay(options);

              rzp.on('payment.failed', function (response){
                setIsPlacingOrder(false);
                showToast(`Payment failed: ${response.error.description}`, "error");
                navigate(`/orders/${mainOrderId}`);
              });

              rzp.open();
              return;
            } else {
              throw new Error(
                paymentRes.data.message || "Failed to initiate payment gateway"
              );
            }
          } catch (payError) {
            setIsPlacingOrder(false);
            showToast(
              payError.message ||
                "Order created but payment gateway failed. Please pay from order details.",
              "error"
            );
            navigate(`/orders/${mainOrderId}`);
            return;
          }
        }

        // COD flow
        if (directBuyItem) {
          removeFromCart(directBuyItem.id || directBuyItem._id, directBuyItem.variantSku);
        } else {
          clearCartSection('refurbished');
        }
        showToast("Refurbished Order placed successfully!", "success");
        setOrderId(mainOrderId);
        setShowSuccess(true);

        if (postOrderNavigateRef.current) {
          clearTimeout(postOrderNavigateRef.current);
        }
        postOrderNavigateRef.current = setTimeout(() => {
          postOrderNavigateRef.current = null;
          setIsPlacingOrder(false);
          navigate(`/orders/${mainOrderId}`);
        }, 3000);
      } else {
        setIsPlacingOrder(false);
        showToast(response.data.message || "Could not place refurbished order.", "error");
      }
    } catch (error) {
      setIsPlacingOrder(false);
      showToast(
        error.response?.data?.message ||
          "Failed to place order. Please try again.",
        "error"
      );
    }
  };

  // WebSocket order status listener
  useEffect(() => {
    if (!orderId || !showSuccess) return undefined;

    const getToken = createSocketTokenReader(STORAGE_KEYS.AUTH_CUSTOMER);
    getOrderSocket(getToken);
    joinOrderRoom(orderId, getToken);

    const applyCancelled = (order) => {
      if (order.workflowStatus === "CANCELLED" || order.status === "cancelled") {
        if (postOrderNavigateRef.current) {
          clearTimeout(postOrderNavigateRef.current);
          postOrderNavigateRef.current = null;
        }
        setShowSuccess(false);
        showToast("Order cancelled by seller.", "error");
        navigate(`/orders/${orderId}`, { replace: true });
        return true;
      }
      return false;
    };

    customerApi
      .getOrderDetails(orderId)
      .then((r) => {
        if (r.data?.result) applyCancelled(r.data.result);
      })
      .catch(() => {});

    const off = onOrderStatusUpdate(getToken, (order) => applyCancelled(order));

    return () => {
      off();
      leaveOrderRoom(orderId, getToken);
    };
  }, [orderId, showSuccess]);

  // Empty Cart State
  if (cart.length === 0 && !showSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-50/60 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-100/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="relative z-10 flex flex-col items-center text-center max-w-sm mx-auto">
          <div ref={emptyCartAnimRef} className="relative w-56 h-56 md:w-64 md:h-64 mb-8 flex items-center justify-center">
            <motion.div
              animate={emptyCartVisible ? { y: [-8, 8, -8] } : { y: 0 }}
              transition={emptyCartVisible ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
              className="relative z-10 rounded-[2rem] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-blue-100">
              {emptyBoxData ? (
                <Lottie animationData={emptyBoxData} loop className="h-36 w-36 md:h-44 md:w-44" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center">
                  <Package size={64} className="text-blue-300" />
                </div>
              )}
            </motion.div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">Refurbished Cart Empty</h2>
          <p className="text-slate-500 mb-6 leading-relaxed font-medium text-sm">
            Grab unboxed, certified & warranty-backed smartphones and gadgets at up to 70% off!
          </p>
          <Link
            to="/refurbished"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-[#2874F0] hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-95 text-sm">
            <span>Explore Refurbished Deals</span>
            <ChevronRight size={18} className="ml-1" />
          </Link>

          {/* Grocery cross-navigation if grocery items exist */}
          {groceryCart.length > 0 && (
            <div className="mt-5 w-full p-4 rounded-2xl bg-orange-50/80 border border-orange-100 text-center">
              <p className="text-xs font-bold text-orange-900 mb-2">
                You have {groceryCart.length} item{groceryCart.length > 1 ? 's' : ''} in your Grocery Cart!
              </p>
              <Link
                to="/checkout"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#FF5722] hover:bg-orange-600 text-white rounded-xl text-xs font-black shadow-sm transition-all"
              >
                Go to Grocery Checkout <ChevronRight size={14} />
              </Link>
            </div>
          )}

          <div className="mt-8 flex gap-6 text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-white rounded-2xl shadow-xs"><ShieldCheck size={20} className="text-blue-600" /></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">32-Pt Check</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-white rounded-2xl shadow-xs"><RotateCcw size={20} className="text-blue-600" /></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">7-Day Return</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-white rounded-2xl shadow-xs"><Shield size={20} className="text-blue-600" /></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">1-Yr Warranty</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f4f8] pb-32 font-sans">
      <CheckoutOrderSuccess orderId={orderId} show={showSuccess} />

      {/* Blue / Refurbished Themed Top Header */}
      <div className="bg-white border-b border-slate-200/80 py-3.5 sticky top-0 z-50 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between relative">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1 hover:bg-slate-100 rounded-full transition-all cursor-pointer">
            <ChevronLeft size={24} className="text-slate-800" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <h1 className="text-base md:text-lg font-black text-slate-900 tracking-tight">Refurbished Checkout</h1>
            </div>
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mt-0.5">
              {cartCount} {cartCount === 1 ? "Device" : "Devices"} • Certified Genuine
            </p>
          </div>
          <div className="w-8 h-8" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-5 relative z-20">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">

          {/* Left Column: Delivery, Address, Items */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4 pb-8">

            {/* Courier Delivery Banner (Refurbished 2-3 Days) */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-3.5 relative z-10">
                <div className="h-12 w-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
                  <Truck size={24} className="text-blue-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-base">Standard Courier Delivery (2-3 Days)</h3>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-400/30 uppercase">
                      Free Shipping
                    </span>
                  </div>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Safe door-to-door transit via insured express logistics
                  </p>
                </div>
              </div>
            </div>

            {/* 32-Point Quality Trust Strip */}
            <div className="bg-blue-50/80 border border-blue-100 rounded-2xl p-3 flex items-center justify-around text-center gap-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800">32-Point Inspection</span>
              </div>
              <div className="h-4 w-px bg-blue-200" />
              <div className="flex items-center gap-1.5">
                <RotateCcw size={15} className="text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800">7 Days Replacement</span>
              </div>
              <div className="h-4 w-px bg-blue-200" />
              <div className="flex items-center gap-1.5">
                <Shield size={15} className="text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800">1-Year Warranty</span>
              </div>
            </div>

            {/* Address Section */}
            <CheckoutAddressSection
              currentAddress={currentAddress}
              savedRecipient={savedRecipient}
              savedAddresses={locationSavedAddresses}
              onSelectAddress={() => setIsAddressModalOpen(true)}
              onEditAddress={handleOpenEditAddress}
              onUseCurrentLocation={handleUseCurrentLiveLocation}
              isFetchingLocation={isFetchingLocation}
              showRecipientForm={showRecipientForm}
              onToggleRecipientForm={() => setShowRecipientForm((v) => !v)}
              recipientData={recipientData}
              onRecipientDataChange={setRecipientData}
              onSaveRecipient={handleSaveRecipient}
              onRemoveRecipient={() => setSavedRecipient(null)}
              displayName={displayName}
              displayPhone={displayPhone}
              displayAddress={displayAddress}
            />

            {/* Refurbished Items Summary Card */}
            <div className="bg-white rounded-2xl p-4 md:p-5 shadow-2xs border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-900 text-sm md:text-base flex items-center gap-2">
                  <span>Selected Refurbished Items</span>
                  <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-black">
                    {cartCount}
                  </span>
                </h3>
                <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                  Inspected & Certified
                </span>
              </div>

              {cart.map((item) => {
                const mrp = Number(item.price || 0);
                const sale = Number(item.salePrice || 0);
                const hasDiscount = sale > 0 && sale < mrp;
                const unitPrice = hasDiscount ? sale : mrp;
                const totalItemPrice = unitPrice * Number(item.quantity || 1);
                const discountPercent = mrp > 0 && hasDiscount ? Math.round(((mrp - sale) / mrp) * 100) : 0;

                return (
                  <div
                    key={`${item.id || item._id}::${String(item.variantSku || "").trim()}`}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="h-20 w-20 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 p-1 flex-shrink-0">
                        <img
                          src={applyCloudinaryTransform(item.image)}
                          alt={item.name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] font-extrabold px-2 py-0.5 rounded-md border border-blue-100">
                            Grade A (Superb)
                          </span>
                          {(item.variantName || item.variantSku) && (
                            <span className="text-xs text-slate-500 font-semibold">
                              {item.variantName || item.variantSku}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            onClick={() => handleMoveToWishlist(item)}
                            className="text-xs text-slate-500 hover:text-blue-600 font-semibold transition-colors cursor-pointer flex items-center gap-1">
                            <Heart size={12} />
                            <span>Wishlist</span>
                          </button>
                          <span className="text-slate-300">•</span>
                          <button
                            onClick={() => removeFromCart(item.id || item._id, item.variantSku)}
                            className="text-xs text-rose-500 hover:text-rose-700 font-semibold transition-colors cursor-pointer">
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0">
                      {/* Blue Quantity Counter */}
                      <div className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-2.5 py-1 shadow-sm">
                        <button
                          onClick={() => {
                            const pid = item.id || item._id;
                            item.quantity > 1
                              ? updateQuantity(pid, -1, item.variantSku)
                              : removeFromCart(pid, item.variantSku);
                          }}
                          className="hover:bg-white/20 p-0.5 rounded transition-colors cursor-pointer">
                          <Minus size={13} strokeWidth={3} />
                        </button>
                        <span className="font-black text-xs min-w-[16px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id || item._id, 1, item.variantSku)}
                          className="hover:bg-white/20 p-0.5 rounded transition-colors cursor-pointer">
                          <Plus size={13} strokeWidth={3} />
                        </button>
                      </div>

                      {/* Pricing */}
                      <div className="text-right">
                        <p className="text-base font-black text-slate-900">
                          ₹{totalItemPrice}
                        </p>
                        {hasDiscount && (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs text-slate-400 line-through">
                              ₹{mrp * Number(item.quantity || 1)}
                            </span>
                            <span className="text-[11px] font-bold text-emerald-600">
                              {discountPercent}% off
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Pricing & Checkout Button */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto no-scrollbar pb-32 lg:pb-8">

            {/* Coupons Section */}
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

            {/* Pricing Breakdown */}
            <CheckoutPricingBreakdown
              pricingPreview={pricingPreview}
              isPreviewLoading={isPreviewLoading}
              previewError={previewError}
              selectedTip={selectedTip}
              onSelectTip={setSelectedTip}
              tipAmounts={tipAmounts}
              walletAmountToUse={walletAmountToUse}
              finalAmountToPay={finalAmountToPay}
              cartTotal={cartTotal}
              selectedCoupon={selectedCoupon}
              discountAmount={discountAmount}
            />

            {/* Payment Method Selector */}
            <CheckoutPaymentSelector
              paymentMethods={paymentMethods}
              selectedPayment={selectedPayment}
              onSelectPayment={setSelectedPayment}
              useWallet={useWallet}
              onToggleWallet={() => setUseWallet((v) => !v)}
              walletBalance={user?.walletBalance || 0}
              walletAmountToUse={walletAmountToUse}
            />

            {/* Desktop Pay Button */}
            <div className="hidden lg:block space-y-3">
              <Button
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder || isPreviewLoading || !pricingPreview}
                className="w-full h-14 rounded-2xl bg-[#2874F0] hover:bg-blue-700 active:scale-[0.99] text-white font-black text-base shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isPlacingOrder ? (
                  <span>Processing Order...</span>
                ) : (
                  <>
                    <span>Pay ₹{finalAmountToPay} • Place Order</span>
                    <ChevronRight size={18} strokeWidth={3} />
                  </>
                )}
              </Button>
              <p className="text-center text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>100% Safe & Secure Refurbished Checkout</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Pay Footer */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 rounded-t-3xl">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Payable</p>
            <p className="text-lg font-black text-slate-900 leading-tight">
              ₹{finalAmountToPay}
            </p>
          </div>
          <Button
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder || isPreviewLoading || !pricingPreview}
            className="flex-1 h-12 bg-[#2874F0] hover:bg-blue-700 active:scale-95 text-white font-black text-sm rounded-xl shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isPlacingOrder ? "Processing..." : `Place Order (₹${finalAmountToPay})`}
          </Button>
        </div>
      </div>

      {/* Address Selection Modal */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Delivery Address</DialogTitle>
            <DialogDescription>Choose where you want your device delivered.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto no-scrollbar">
            {locationSavedAddresses && locationSavedAddresses.length > 0 ? (
              locationSavedAddresses.map((addr) => (
                <div
                  key={addr._id || addr.id}
                  onClick={() => handleSelectSavedAddress(addr)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    currentAddress.address === addr.address
                      ? "border-blue-600 bg-blue-50/40"
                      : "border-slate-100 hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-slate-800 capitalize">
                      {addr.label}
                    </span>
                    {currentAddress.address === addr.address && (
                      <Check size={16} className="text-blue-600" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{addr.address}</p>
                  {addr.phone && (
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      Phone: {addr.phone}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-slate-500 py-4">No saved addresses found</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddressModalOpen(false);
                handleOpenEditAddress();
              }}
              className="w-full"
            >
              Add / Edit Address Manually
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Address Modal */}
      <Dialog open={isEditAddressOpen} onOpenChange={setIsEditAddressOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Delivery Address</DialogTitle>
            <DialogDescription>Update your delivery details for courier shipment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label htmlFor="rf-edit-name">Full Name</Label>
              <Input
                id="rf-edit-name"
                value={editAddressForm.name}
                onChange={(e) => setEditAddressForm({ ...editAddressForm, name: e.target.value })}
                placeholder="Receiver full name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rf-edit-phone">Contact Number</Label>
              <Input
                id="rf-edit-phone"
                value={editAddressForm.phone}
                onChange={(e) => setEditAddressForm({ ...editAddressForm, phone: e.target.value })}
                placeholder="10-digit mobile number"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rf-edit-address">Delivery Address</Label>
              <Input
                id="rf-edit-address"
                value={editAddressForm.address}
                onChange={(e) => setEditAddressForm({ ...editAddressForm, address: e.target.value })}
                placeholder="Flat / House / Street"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="rf-edit-landmark">Landmark</Label>
                <Input
                  id="rf-edit-landmark"
                  value={editAddressForm.landmark}
                  onChange={(e) => setEditAddressForm({ ...editAddressForm, landmark: e.target.value })}
                  placeholder="Near park, etc."
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rf-edit-city">City & Pincode</Label>
                <Input
                  id="rf-edit-city"
                  value={editAddressForm.city}
                  onChange={(e) => setEditAddressForm({ ...editAddressForm, city: e.target.value })}
                  placeholder="City, Pincode"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEditedAddress} className="w-full bg-[#2874F0] hover:bg-blue-700 text-white font-bold">
              Save Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RefurbishedCheckoutPage;
