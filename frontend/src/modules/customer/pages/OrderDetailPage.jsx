import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import InvoiceModal from "../components/order/InvoiceModal";
import HelpModal from "../components/order/HelpModal";
import LiveTrackingMap from "../components/order/LiveTrackingMap";
import DeliveryOtpDisplay from "../components/DeliveryOtpDisplay";
import OrderProgressTracker from "../components/order/OrderProgressTracker";
import ReturnProgressTracker from "../components/order/ReturnProgressTracker";
import ProofImagePicker from "@shared/components/ProofImagePicker";
import { downloadQrAsPng } from "@shared/utils/qrDownload";
import { DISPUTE_REASON_MIN_LENGTH, getDisputeInfo } from "@shared/utils/returnQc";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import {
  ChevronLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  MapPin,
  CreditCard,
  Download,
  HelpCircle,
  Phone,
  MessageSquare,
  ArrowRight,
  User,
  Loader2,
  Store,
  Navigation2,
  Camera,
  X,
  Star,
  AlertCircle,
  QrCode,
  Copy,
  Check,
  MessageCircle,
  Banknote,
} from "lucide-react";
import QRCode from "react-qr-code";
import { cn } from "@/lib/utils";
import { useSettings } from "@core/context/SettingsContext";
import ReviewSubmissionModal from "../components/shared/ReviewSubmissionModal";
import { customerApi } from "../services/customerApi";
import { getCourierDeliveryDateText } from "../services/deliveryService";
import { toast } from "sonner";
import { subscribeToOrderLocation, subscribeToOrderTrail, subscribeToOrderRoute } from "@/core/services/trackingClient";
import {
  useOrderIdentifiers,
  resolveOrderIdentifiers,
} from "../hooks/useOrderIdentifiers";
import {
  getOrderSocket,
  joinOrderRoom,
  leaveOrderRoom,
  onOrderStatusUpdate,
  onCustomerOtp,
  onReturnPickupOtp,
  onReturnDropOtp,
} from "@/core/services/orderSocket";
import { getLegacyStatusFromOrder } from "@/shared/utils/orderStatus";
import { getPaymentDisplay as getPaymentInfo } from "@/shared/utils/paymentDisplay";
import { createSocketTokenReader } from "@core/utils/authStorage";
import { STORAGE_KEYS } from "@core/utils/storage";

// Look for each payment kind / status tone (data only; logic lives in paymentDisplay.js)
const PAYMENT_KIND_STYLE = {
  upi: { icon: QrCode, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  cod: { icon: Banknote, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  online: { icon: CreditCard, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
};
const PAYMENT_TONE_STYLE = {
  success: { badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200", dotClass: "bg-emerald-500" },
  warning: { badgeClass: "bg-amber-50 text-amber-700 border-amber-200", dotClass: "bg-amber-500" },
  danger: { badgeClass: "bg-rose-50 text-rose-700 border-rose-200", dotClass: "bg-rose-500" },
  info: { badgeClass: "bg-sky-50 text-sky-700 border-sky-200", dotClass: "bg-sky-500" },
};
const getPaymentDisplay = (order) => {
  const info = getPaymentInfo(order);
  return { ...info, ...PAYMENT_KIND_STYLE[info.kind], ...PAYMENT_TONE_STYLE[info.tone] };
};

const coordsToLatLng = (coords) => {
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
};

const hasValidLatLng = (location) =>
  location &&
  typeof location.lat === "number" &&
  typeof location.lng === "number" &&
  Number.isFinite(location.lat) &&
  Number.isFinite(location.lng);

const DEFAULT_CITY_SPEED_KMPH = 24;
const ROUTE_REFRESH_THRESHOLD_M = 150;
const ROUTE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const toRadians = (value) => (value * Math.PI) / 180;

const distanceMeters = (from, to) => {
  if (!hasValidLatLng(from) || !hasValidLatLng(to)) return null;
  const r = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatArrivalTime = (arrivalMs) =>
  new Date(arrivalMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

const formatArrivingIn = (minutes) => {
  if (!Number.isFinite(minutes) || minutes < 0) return "Soon";
  const rounded = Math.max(1, Math.round(minutes));
  return `${rounded} min${rounded === 1 ? "" : "s"}`;
};

const formatDistance = (meters) => {
  if (!Number.isFinite(meters) || meters <= 0) return "—";
  if (meters < 1000) {
    return `${Math.max(50, Math.round(meters / 10) * 10)} m`;
  }
  return `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} km`;
};

const estimateMinutesFromDistance = (meters) => {
  if (!Number.isFinite(meters) || meters <= 0) return null;
  return (meters * 60) / (DEFAULT_CITY_SPEED_KMPH * 1000);
};

const getTrackingRoutePhase = (order) => {
  if (!order) return "pickup";

  const workflowStatus = String(order.workflowStatus || "").toUpperCase();
  const legacyStatus = String(order.status || "").toLowerCase();
  const riderStep = Number(order.deliveryRiderStep) || 0;

  const isDeliveryPhase =
    workflowStatus === "OUT_FOR_DELIVERY" ||
    workflowStatus === "DELIVERED" ||
    legacyStatus === "out_for_delivery" ||
    legacyStatus === "delivered" ||
    riderStep >= 3 ||
    Boolean(order.pickupConfirmedAt);

  return isDeliveryPhase ? "delivery" : "pickup";
};

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

const matchesOrderIdentifier = (payloadOrderId, identifiers = []) => {
  const normalizedPayloadId = String(payloadOrderId || "").trim().toUpperCase();
  if (!normalizedPayloadId) return false;
  return identifiers
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean)
    .some((id) => {
      if (id === normalizedPayloadId) return true;
      if (normalizedPayloadId.endsWith(id) || id.endsWith(normalizedPayloadId)) return true;
      return false;
    });
};

const OrderDetailPage = () => {
  const { orderId } = useParams();
  const [showInvoice, setShowInvoice] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [returnDetails, setReturnDetails] = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeImages, setDisputeImages] = useState([]);
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [requestingReturn, setRequestingReturn] = useState(false);
  const [selectedReturnItems, setSelectedReturnItems] = useState({});
  const [returnReason, setReturnReason] = useState("");
  const [returnReasonDetail, setReturnReasonDetail] = useState("");
  const [returnConditionAssurance, setReturnConditionAssurance] = useState(false);
  const [returnImages, setReturnImages] = useState([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const [reviewModalProduct, setReviewModalProduct] = useState(null);
  const [reviewedProductIds, setReviewedProductIds] = useState([]);
  const [liveLocation, setLiveLocation] = useState(null);
  const [trail, setTrail] = useState([]);
  const { settings } = useSettings();
  const [isUtrModalOpen, setIsUtrModalOpen] = useState(false);
  const [utrModalInput, setUtrModalInput] = useState("");
  const [isSubmittingUtr, setIsSubmittingUtr] = useState(false);
  const [isCopiedUpi, setIsCopiedUpi] = useState(false);

  const upiId = settings?.upiId || "anushkaconnect@okaxis";
  const upiDisplayName = settings?.upiDisplayName || "Anushka Connect";
  const supportWhatsapp = settings?.supportWhatsappNumber || settings?.whatsappNumber || "8209224481";

  const orderQrWrapRef = useRef(null);
  const [isDownloadingQr, setIsDownloadingQr] = useState(false);
  const handleDownloadQr = async () => {
    const svgEl = orderQrWrapRef.current?.querySelector("svg");
    if (!svgEl || isDownloadingQr) return;
    setIsDownloadingQr(true);
    try {
      const outcome = await downloadQrAsPng(svgEl, "payment-qr-" + (order?.pricing?.total ?? "") + ".png");
      if (outcome === "downloaded") toast.success("QR saved. Open it from your gallery in any UPI app.");
    } catch (error) {
      if (error?.name !== "AbortError") toast.error("Could not save the QR. Please take a screenshot instead.");
    } finally {
      setIsDownloadingQr(false);
    }
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setIsCopiedUpi(true);
    toast.success("UPI ID copied to clipboard");
    setTimeout(() => setIsCopiedUpi(false), 2500);
  };

  const [isCopiedOrderId, setIsCopiedOrderId] = useState(false);
  const handleCopyOrderId = async (value) => {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for non-secure contexts / older WebViews
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setIsCopiedOrderId(true);
      toast.success("Order ID copied");
      setTimeout(() => setIsCopiedOrderId(false), 2500);
    } catch {
      toast.error("Could not copy. Please copy it manually.");
    }
  };

  const handleUtrSubmit = async (e) => {
    if (e) e.preventDefault();
    const cleanUtr = String(utrModalInput || "").trim();
    if (!/^\d{12}$/.test(cleanUtr)) {
      toast.error("Please enter a valid 12-digit numeric UTR");
      return;
    }
    setIsSubmittingUtr(true);
    try {
      const targetId = order?.orderId || orderId;
      const res = await customerApi.submitOrderUtr(targetId, { utrNumber: cleanUtr });
      if (res.data?.success) {
        toast.success("UTR submitted successfully! Awaiting admin verification.");
        setIsUtrModalOpen(false);
        setUtrModalInput("");
        customerApi.getOrderDetails(orderId).then((r) => {
          if (r.data?.result) setOrder(r.data.result);
        });
      } else {
        toast.error(res.data?.message || "Failed to submit UTR");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit UTR");
    } finally {
      setIsSubmittingUtr(false);
    }
  };

  const cleanWhatsappDigits = String(supportWhatsapp).replace(/\D/g, "");
  const whatsappPhone = cleanWhatsappDigits.length === 10 ? `91${cleanWhatsappDigits}` : cleanWhatsappDigits;
  const whatsappSupportUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
    `Hi Admin, my payment for Order #${order?.orderId} of ₹${order?.pricing?.total} was rejected. UTR: ${order?.utrNumber || 'N/A'}. Please help verify.`
  )}`;
  const [routePolyline, setRoutePolyline] = useState(null);
  const [handoffOtp, setHandoffOtp] = useState(null);
  const [clockTick, setClockTick] = useState(Date.now());
  const isShiprocketOrder = order?.fulfillmentType === "SHIPROCKET";
  const returnWindowLabel = isShiprocketOrder ? "7 days" : "4 hours";
  const routeOriginRef = useRef(null);
  const routeRequestRef = useRef({ phase: "", startedAt: 0 });
  const [returnCountdown, setReturnCountdown] = useState(null);

  const effectiveWindowExpiresAt = useMemo(() => {
    if (returnDetails?.returnWindowExpiresAt) return new Date(returnDetails.returnWindowExpiresAt).getTime();
    if (order?.returnWindowExpiresAt) return new Date(order.returnWindowExpiresAt).getTime();
    if (order?.deliveredAt) {
      const windowMs = isShiprocketOrder ? 7 * 24 * 60 * 60 * 1000 : 4 * 60 * 60 * 1000;
      return new Date(order.deliveredAt).getTime() + windowMs;
    }
    return null;
  }, [returnDetails?.returnWindowExpiresAt, order?.returnWindowExpiresAt, order?.deliveredAt, isShiprocketOrder]);

  useEffect(() => {
    if (!effectiveWindowExpiresAt) {
      setReturnCountdown(null);
      return;
    }
    const updateCountdown = () => {
      const now = Date.now();
      const diff = effectiveWindowExpiresAt - now;
      if (diff <= 0) {
        setReturnCountdown("Expired");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (days > 0) {
        setReturnCountdown(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setReturnCountdown(`${hours}h ${minutes}m`);
      } else {
        setReturnCountdown(`${Math.max(1, minutes)}m`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 30000);
    return () => clearInterval(interval);
  }, [effectiveWindowExpiresAt]);

  const refreshRef = useRef({ inFlight: false, lastAt: 0 });
  const extraRoomRef = useRef("");

  // Single source of truth for the various ids that may refer to this
  // order (URL param vs canonical order.orderId vs checkoutGroupId). The
  // hook exposes:
  //   - canonicalOrderId : id to use for realtime fan-out (RTDB + sockets)
  //   - identifiersRef   : .current array kept in sync for socket callbacks
  //   - extraRoomId      : canonical id when it differs from the URL param
  // `lookupId` is also available from the hook for callers that need a
  // REST-friendly id; this page derives it ad hoc via `resolveOrderLookupId`
  // because the value is needed against freshly-fetched data before state
  // settles, which the pure helper handles directly.
  const {
    canonicalOrderId,
    identifiersRef,
    extraRoomId,
  } = useOrderIdentifiers(orderId, order);

  const navigate = useNavigate();
  // Pure helper for resolving the lookup id from a freshly-fetched order
  // before React state has settled (e.g. inside the initial fetch effect).
  const resolveOrderLookupId = (ord) =>
    resolveOrderIdentifiers(ord, orderId).lookupId || "";

  const handleBack = () => {
    const idx = window?.history?.state?.idx;
    if (typeof idx === "number" && idx > 0) {
      navigate(-1);
      return;
    }
    navigate("/orders");
  };

  // Scroll to top on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const isInvalid = !orderId || orderId === "undefined" || orderId === "null";
    if (isInvalid) {
      console.warn(`[OrderDetailPage] Invalid orderId from URL: ${orderId}. Redirecting...`);
      navigate("/orders", { replace: true });
      return;
    }

    const fetchOrderDetails = async () => {
      try {
        refreshRef.current.inFlight = true;
        const response = await customerApi.getOrderDetails(orderId);
        const ord = response.data.result;
        setOrder(ord);

        try {
          const retRes = await customerApi.getReturnDetails(resolveOrderLookupId(ord));
          const ret = retRes.data.result;
          setReturnDetails(ret);
          if (ret?.returnPickupOtp) {
            setHandoffOtp(ret.returnPickupOtp);
          }
        } catch {
          setReturnDetails(null);
        }
      } catch (error) {
        console.error("Failed to fetch order details:", error);
        toast.error("Failed to load order details");
      } finally {
        refreshRef.current.inFlight = false;
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return undefined;
    const getToken = createSocketTokenReader(STORAGE_KEYS.AUTH_CUSTOMER);
    getOrderSocket(getToken);
    joinOrderRoom(orderId, getToken);

    // Also join using the canonical order.orderId once loaded (may differ from URL param)
    if (order?.orderId && order.orderId !== orderId) {
      joinOrderRoom(order.orderId, getToken);
    }

    const refresh = () => {
      const now = Date.now();
      if (refreshRef.current.inFlight) return;
      if (now - refreshRef.current.lastAt < 2000) return;
      refreshRef.current.lastAt = now;
      refreshRef.current.inFlight = true;
      customerApi
        .getOrderDetails(orderId)
        .then(async (r) => {
          const ord = r.data.result;
          setOrder(ord);
          try {
            const retRes = await customerApi.getReturnDetails(resolveOrderLookupId(ord));
            setReturnDetails(retRes.data.result);
          } catch {
            setReturnDetails(null);
          }
        })
        .catch(() => { })
        .finally(() => {
          refreshRef.current.inFlight = false;
        });
    };

    const offStatus = onOrderStatusUpdate(getToken, (payload) => {
      // Immediately update order state from socket payload — no waiting for API re-fetch
      const ws = String(payload?.workflowStatus || "").toUpperCase();
      if (ws || payload?.status || payload?.shiprocket) {
        setOrder((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            ...(ws && { workflowStatus: ws }),
            ...(payload?.status && { status: payload.status }),
            // "Packed" is a flag on local orders; without it the page would show
            // "Confirmed" while the delivery workflow is still searching/assigned.
            ...(payload?.pickupReadyAt && { pickupReadyAt: payload.pickupReadyAt }),
            // Keep legacy status in sync for components that read order.status
            ...(ws === "DELIVERED" && { status: "delivered" }),
            ...(ws === "DELIVERY_SEARCH" && { status: "confirmed" }),
            ...(ws === "PICKUP_READY" && { status: "packed" }),
            ...(ws === "OUT_FOR_DELIVERY" && { status: "out_for_delivery" }),
            ...(ws === "CANCELLED" && { status: "cancelled" }),
            ...(payload?.shiprocket && {
              shiprocket: {
                ...(prev.shiprocket || {}),
                ...payload.shiprocket,
              },
            }),
          };
        });
      }
      refresh();
    });
    const offOtp = onCustomerOtp(getToken, (payload) => {
      if (matchesOrderIdentifier(payload?.orderId, identifiersRef.current) && (payload?.code || payload?.otp)) {
        setHandoffOtp(payload.code || payload.otp);
        toast.info("Delivery OTP received — share with rider if asked.");
      }
    });
    const offReturnOtp = onReturnPickupOtp(getToken, (payload) => {
      if (matchesOrderIdentifier(payload?.orderId, identifiersRef.current) && payload?.otp) {
        setHandoffOtp(payload.otp);
        toast.info("Return pickup OTP received — share with rider.");
      }
    });

    return () => {
      offStatus();
      offOtp();
      offReturnOtp();
      leaveOrderRoom(orderId, getToken);
    };
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return undefined;
    const getToken = createSocketTokenReader(STORAGE_KEYS.AUTH_CUSTOMER);

    const nextExtraRoom = extraRoomId;

    if (extraRoomRef.current && extraRoomRef.current !== nextExtraRoom) {
      leaveOrderRoom(extraRoomRef.current, getToken);
      extraRoomRef.current = "";
    }

    if (nextExtraRoom && extraRoomRef.current !== nextExtraRoom) {
      joinOrderRoom(nextExtraRoom, getToken);
      extraRoomRef.current = nextExtraRoom;
    }

    return () => {
      if (extraRoomRef.current) {
        leaveOrderRoom(extraRoomRef.current, getToken);
        extraRoomRef.current = "";
      }
    };
  }, [orderId, extraRoomId]);

  // ── Firebase RTDB: live rider location + cached route polyline ─────────────
  useEffect(() => {
    if (!orderId) return undefined;
    if (status === "delivered" || status === "cancelled") return undefined;

    const unsubLoc = subscribeToOrderLocation(orderId, (loc) => {
      if (
        loc &&
        Number.isFinite(loc.lat) &&
        Number.isFinite(loc.lng)
      ) {
        setLiveLocation({ lat: loc.lat, lng: loc.lng });
      }
    });

    const unsubRoute = subscribeToOrderRoute(orderId, (routeData) => {
      if (routeData?.polyline) {
        setRoutePolyline(routeData);
      }
    });

    return () => {
      unsubLoc();
      unsubRoute();
    };
    // Re-subscribe if the canonical id or status changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, canonicalOrderId]);

  useEffect(() => {
    const iv = setInterval(() => setClockTick(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);


  const handleOpenInMaps = () => {
    const loc = order?.address?.location;
    const dest =
      loc &&
        typeof loc.lat === "number" &&
        typeof loc.lng === "number" &&
        Number.isFinite(loc.lat) &&
        Number.isFinite(loc.lng)
        ? loc
        : null;

    const rider =
      liveLocation &&
        typeof liveLocation.lat === "number" &&
        typeof liveLocation.lng === "number"
        ? liveLocation
        : null;

    if (rider && dest) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&origin=${rider.lat},${rider.lng}&destination=${dest.lat},${dest.lng}`,
        "_blank",
      );
      return;
    }

    if (dest) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`,
        "_blank",
      );
      return;
    }

    window.open("https://maps.google.com", "_blank");
  };

  const status = order ? getLegacyStatusFromOrder(order) : null;

  // A scheduler may cancel an expired seller alert in a separate process,
  // where no order-room socket event is available to this API process.
  useEffect(() => {
    if (!orderId || status !== "pending" || order?.workflowStatus === "CREATED") {
      return undefined;
    }
    let active = true;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      customerApi.getOrderDetails(orderId)
        .then((response) => {
          if (active && response.data?.result) setOrder(response.data.result);
        })
        .catch(() => {});
    }, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [orderId, status, order?.workflowStatus]);

  /**
   * mapStatus — what we tell LiveTrackingMap.
   *
   * getLegacyStatusFromOrder maps DELIVERY_ASSIGNED → "confirmed" which makes
   * the map show the "Searching for delivery partner" animation even though a
   * rider IS assigned.  Override that: if a deliveryBoy exists OR workflowStatus
   * indicates a rider is on their way, promote to "out_for_delivery" for the
   * map so it shows the actual Google Maps view with the rider marker.
   */
  const mapStatus = useMemo(() => {
    if (!order) return status;
    const ws = String(order.workflowStatus || "").toUpperCase();
    const riderActive =
      Boolean(order.deliveryBoy) ||
      ws === "DELIVERY_ASSIGNED" ||
      ws === "PICKUP_READY" ||
      ws === "OUT_FOR_DELIVERY" ||
      ws === "DELIVERED" ||
      (Number(order.deliveryRiderStep) || 0) >= 1;
    if (riderActive && status === "confirmed") return "out_for_delivery";
    return status;
  }, [order, status]);

  const isAwaitingOnlinePayment = useMemo(() => {
    if (!order) return false;
    const isOnline =
      order.paymentMode === "ONLINE" ||
      order.paymentMode === "online" ||
      order.payment?.method === "online";
    const isPaid =
      order.paymentStatus === "PAID" ||
      order.paymentStatus === "completed" ||
      order.payment?.status === "completed";
    const isCancelled =
      status === "cancelled" ||
      order.status === "cancelled" ||
      order.workflowStatus === "CANCELLED";
    return isOnline && !isPaid && !isCancelled;
  }, [order, status]);

  // 15-Minute Online Payment Expiry Countdown Timer
  const [paymentTimeLeft, setPaymentTimeLeft] = useState(null);
  const [isPaymentWindowExpired, setIsPaymentWindowExpired] = useState(false);

  useEffect(() => {
    if (!isAwaitingOnlinePayment || !order) {
      setPaymentTimeLeft(null);
      setIsPaymentWindowExpired(false);
      return;
    }

    const expiryTime =
      order.expiresAt
        ? new Date(order.expiresAt).getTime()
        : order.stockReservation?.expiresAt
        ? new Date(order.stockReservation.expiresAt).getTime()
        : order.createdAt
        ? new Date(order.createdAt).getTime() + 15 * 60 * 1000
        : null;

    if (!expiryTime) {
      setPaymentTimeLeft(null);
      return;
    }

    const tick = () => {
      const remainingMs = expiryTime - Date.now();
      if (remainingMs <= 0) {
        setPaymentTimeLeft("00:00");
        setIsPaymentWindowExpired(true);
        return;
      }
      setIsPaymentWindowExpired(false);
      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);
      setPaymentTimeLeft(
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isAwaitingOnlinePayment, order]);
  const sellerLocation =
    coordsToLatLng(order?.seller?.location?.coordinates) ||
    order?.delivery?.pickupLocation ||
    null;
  const routePhase = getTrackingRoutePhase(order);
  const routeMatchesPhase =
    routePhase === "pickup"
      ? routePolyline?.phase
        ? routePolyline.phase === routePhase
        : !!routePolyline?.polyline
      : routePolyline?.phase === routePhase;
  const activeRoutePolyline = routeMatchesPhase ? routePolyline : null;
  const estimatedArrival = useMemo(() => {
    if (!order) {
      return {
        arrivalTimeText: "--",
        arrivingInText: "--",
      };
    }

    if (status === "delivered") {
      return {
        arrivalTimeText: "Arrived",
        arrivingInText: "Delivered",
      };
    }

    if (order?.fulfillmentType === "SHIPROCKET") {
      const fallbackDate = getCourierDeliveryDateText(order?.createdAt || new Date(), 4);
      return {
        arrivalTimeText: order?.shiprocket?.etd || `Delivery by ${fallbackDate}`,
        arrivingInText: order?.deliveryEstimate && !order.deliveryEstimate.toLowerCase().includes("day") ? order.deliveryEstimate : fallbackDate,
        totalDistanceText: "Standard Courier",
      };
    }

    const targetLocation =
      routePhase === "delivery" ? order?.address?.location : sellerLocation;

    let minutes = null;
    const routeDurationSeconds = Number(activeRoutePolyline?.duration);
    if (Number.isFinite(routeDurationSeconds) && routeDurationSeconds > 0) {
      minutes = routeDurationSeconds / 60;
    } else {
      const routeDistanceMeters = Number(activeRoutePolyline?.distanceMeters);
      minutes =
        estimateMinutesFromDistance(routeDistanceMeters) ??
        estimateMinutesFromDistance(distanceMeters(liveLocation, targetLocation));
    }

    if (!Number.isFinite(minutes) || minutes <= 0) {
      minutes = status === "confirmed" ? 12 : 8;
    }

    const arrivalMs = clockTick + minutes * 60 * 1000;
    const savedRouteDistanceMeters = Number(order?.delivery?.routeDistanceMeters);
    const savedRouteDistanceKm = Number(order?.delivery?.routeDistanceKm);
    const roadDistanceMeters =
      Number.isFinite(savedRouteDistanceMeters) && savedRouteDistanceMeters > 0
        ? savedRouteDistanceMeters
        : Number.isFinite(savedRouteDistanceKm) && savedRouteDistanceKm > 0
          ? savedRouteDistanceKm * 1000
          : null;
    const directDistanceMeters = roadDistanceMeters
      ? null
      : distanceMeters(
          sellerLocation,
          order?.delivery?.customerLocation || order?.address?.location,
        );
    const totalDistanceText = roadDistanceMeters
      ? formatDistance(roadDistanceMeters)
      : directDistanceMeters > 0
        ? `~${formatDistance(directDistanceMeters)}`
        : "Unavailable";
    return {
      arrivalTimeText: formatArrivalTime(arrivalMs),
      arrivingInText: formatArrivingIn(minutes),
      totalDistanceText,
    };
  }, [
    activeRoutePolyline?.distanceMeters,
    activeRoutePolyline?.duration,
    liveLocation,
    order,
    routePhase,
    sellerLocation,
    status,
    clockTick,
  ]);

  useEffect(() => {
    if (!orderId || status === "delivered" || status === "cancelled" || order?.fulfillmentType === "SHIPROCKET") return;

    // If rider location isn't available yet, fallback to seller location so we can at least show the polyline
    const currentOrigin = hasValidLatLng(liveLocation)
      ? { lat: liveLocation.lat, lng: liveLocation.lng }
      : sellerLocation;

    if (!currentOrigin || !hasValidLatLng(currentOrigin)) return;

    const originDrift =
      routeOriginRef.current && hasValidLatLng(routeOriginRef.current)
        ? distanceMeters(routeOriginRef.current, currentOrigin)
        : null;
    const routeIsFresh =
      activeRoutePolyline?.polyline &&
      originDrift !== null &&
      originDrift < ROUTE_REFRESH_THRESHOLD_M &&
      routePhase === activeRoutePolyline?.phase;

    if (routeIsFresh) return;

    const now = Date.now();
    if (
      routeRequestRef.current.phase === routePhase &&
      now - routeRequestRef.current.startedAt < ROUTE_REFRESH_INTERVAL_MS &&
      (originDrift === null || originDrift < ROUTE_REFRESH_THRESHOLD_M)
    ) {
      return;
    }

    routeRequestRef.current = { phase: routePhase, startedAt: now };
    let ignore = false;

    customerApi
      .getOrderRoute(orderId, {
        phase: routePhase,
        originLat: currentOrigin.lat,
        originLng: currentOrigin.lng,
        _t: now,
      })
      .then((response) => {
        if (ignore) return;
        const nextRoute = response.data?.result;
        if (nextRoute?.polyline) {
          setRoutePolyline(nextRoute);
          routeOriginRef.current = currentOrigin;
        }
      })
      .catch(() => { });

    return () => {
      ignore = true;
    };
  }, [
    activeRoutePolyline?.polyline,
    liveLocation,
    orderId,
    routePhase,
    status,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    );
  }

  const canRequestReturn = () => {
    if (!order) return false;
    if (order.status === "cancelled") return false;
    if (order.status !== "delivered") return false;
    if (
      returnDetails &&
      returnDetails.returnStatus &&
      returnDetails.returnStatus !== "none" &&
      returnDetails.returnStatus !== null
    ) {
      return false;
    }

    if (effectiveWindowExpiresAt && Date.now() > effectiveWindowExpiresAt) {
      return false;
    }

    // Check if at least one item in order is returnable
    const hasReturnableItem = Array.isArray(order.items) && order.items.some(
      (item) => item.isReturnable !== false && item.product?.isReturnable !== false
    );
    return hasReturnableItem;
  };

  const toggleItemSelection = (index) => {
    const item = order?.items?.[index];
    if (item && (item.isReturnable === false || item.product?.isReturnable === false)) {
      toast.error(`"${item.name}" is a non-returnable item.`);
      return;
    }
    setSelectedReturnItems((prev) => {
      const next = { ...prev };
      if (next[index]) {
        delete next[index];
      } else {
        next[index] = { quantity: order.items[index].quantity };
      }
      return next;
    });
  };

  const handleReturnSubmit = async () => {
    if (!order) return;
    if (!Object.keys(selectedReturnItems).length) {
      toast.error("Please select at least one item to return.");
      return;
    }
    if (!returnReason.trim()) {
      toast.error("Please provide a reason for return.");
      return;
    }
    if (!returnConditionAssurance) {
      toast.error("Please confirm that the product is in good condition with accessories.");
      return;
    }
    if (returnImages.length === 0) {
      toast.error("Please upload at least 1 image of the product.");
      return;
    }

    const payload = {
      items: Object.entries(selectedReturnItems).map(([idx, val]) => ({
        itemIndex: Number(idx),
        quantity: val.quantity,
      })),
      reason: returnReason,
      reasonDetail: returnReasonDetail,
      conditionAssurance: returnConditionAssurance,
      images: returnImages,
    };

    try {
      setRequestingReturn(true);
      await customerApi.requestReturn(order.orderId, payload);
      toast.success("Return request submitted");
      setShowReturnModal(false);
      setSelectedReturnItems({});
      setReturnReason("");
      setReturnReasonDetail("");
      setReturnConditionAssurance(false);
      setReturnImages([]);

      const [orderRes, retRes] = await Promise.all([
        customerApi.getOrderDetails(orderId),
        customerApi.getReturnDetails(resolveOrderLookupId(order)),
      ]);
      setOrder(orderRes.data.result);
      setReturnDetails(retRes.data.result);
    } catch (error) {
      console.error("Failed to submit return request", error);
      toast.error(
        error.response?.data?.message || "Failed to submit return request",
      );
    } finally {
      setRequestingReturn(false);
    }
  };

  const handleDisputeSubmit = async () => {
    if (!order) return;
    if (disputeReason.trim().length < DISPUTE_REASON_MIN_LENGTH) {
      toast.error("Please tell us why you disagree (at least " + DISPUTE_REASON_MIN_LENGTH + " characters).");
      return;
    }
    try {
      setSubmittingDispute(true);
      await customerApi.raiseReturnDispute(resolveOrderLookupId(order), {
        reason: disputeReason.trim(),
        images: disputeImages,
      });
      toast.success("Dispute submitted. Our team will review it.");
      setShowDisputeModal(false);
      setDisputeReason("");
      setDisputeImages([]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not submit your dispute.");
    } finally {
      // Always re-read: the window may have closed or someone may have decided meanwhile.
      try {
        const retRes = await customerApi.getReturnDetails(resolveOrderLookupId(order));
        setReturnDetails(retRes.data.result);
      } catch {
        /* keep the old view */
      }
      setSubmittingDispute(false);
    }
  };

  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = 5 - returnImages.length;
    const toProcess = files.slice(0, remaining);

    setIsUploadingImage(true);
    const newImages = [];

    for (const file of toProcess) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        let url;
        try {
          const { default: axiosInstance } = await import("@core/api/axios");
          const uploadRes = await axiosInstance.post("/media/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          url =
            uploadRes.data?.result?.url ||
            uploadRes.data?.data?.url ||
            uploadRes.data?.url;
        } catch {
          url = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
          });
        }
        if (url) newImages.push(url);
      } catch (err) {
        toast.error("Failed to process image.");
      }
    }

    setReturnImages((prev) => [...prev, ...newImages].slice(0, 5));
    setIsUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index) => {
    setReturnImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRetryPayment = async () => {
    try {
      if (!order) return;
      const paymentRef =
        Number(order.checkoutGroupSize || 1) > 1
          ? (order.checkoutGroupId || order.orderId)
          : order.orderId;
      
      const toastId = toast.loading("Initiating payment...");
      
      const response = await customerApi.createPaymentOrder({
        orderRef: paymentRef,
      });
      
      if (!response.data.success) {
        toast.error(response.data.message || "Failed to initiate payment", { id: toastId });
        return;
      }
      
      const paymentData = response.data.result?.payment;
      const merchantOrderId = paymentData?.gatewayOrderId;
      const amountPaise = paymentData?.amount;
      const razorpayOrderId = paymentData?.rawGatewayResponse?.razorpayOrderId;
      const razorpayKeyId = paymentData?.rawGatewayResponse?.keyId;

      if (!razorpayOrderId || !razorpayKeyId) {
        toast.error("Razorpay checkout is not configured correctly", { id: toastId });
        return;
      }

      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        toast.error("Razorpay SDK failed to load. Are you online?", { id: toastId });
        return;
      }

      toast.dismiss(toastId);

      const options = {
        key: razorpayKeyId,
        amount: amountPaise,
        currency: "INR",
        name: "Anushka Connect",
        description: `Payment for Order ${paymentRef}`,
        order_id: razorpayOrderId,
        handler: async function (response) {
          try {
            await customerApi.verifyOnlineOrderPayment(order.orderId, {
              merchantOrderId,
              transactionId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
            });
          } catch (error) {
            toast.error(error.response?.data?.message || "Payment is awaiting confirmation. Check status before retrying.");
          }
          navigate(`/payment-status?merchantOrderId=${encodeURIComponent(merchantOrderId)}`);
        },
        prefill: {
          contact: order?.deliveryAddress?.phone || "",
        },
        theme: {
          color: "#000000",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response) {
        toast.error(response.error.description || "Payment failed");
      });
      rzp.open();
      
    } catch (err) {
      console.error("[OrderDetailPage] Retry payment error:", err);
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Unable to start payment. Please try again later.",
      );
    }
  };

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <Package size={64} className="text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-800">Order not found</h3>
        <Link to="/orders" className="text-brand-600 font-bold mt-4 hover:text-brand-700">
          Back to my orders
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24 font-sans">
      {/* Minimal Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b border-slate-100">
        <button
          type="button"
          onClick={handleBack}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft size={24} className="text-slate-800" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-base font-bold text-slate-800">Order</h1>
          <p className="text-xs text-slate-500 font-medium">#{order.orderId.slice(-8)}</p>
        </div>
        <div className="w-10" />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Payment Required Card - Only for Online Pending Orders */}
        {isAwaitingOnlinePayment && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 rounded-3xl p-5 shadow-sm border border-amber-200 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <CreditCard size={64} className="text-amber-800" />
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h3 className="text-sm font-black text-amber-900 uppercase tracking-tight">
                    {isPaymentWindowExpired ? "Payment Window Expired" : "Payment Pending"}
                  </h3>
                  {paymentTimeLeft && !isPaymentWindowExpired && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                      <Clock size={12} className="stroke-[2.2]" /> Expires in {paymentTimeLeft}
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  {isPaymentWindowExpired
                    ? "The 15-minute payment window has expired. Reserved items will be released."
                    : `Complete your payment of ₹${order.pricing?.total || order.total || 0} to proceed with this order.`}
                </p>
              </div>
              {!isPaymentWindowExpired && (
                <button
                  onClick={handleRetryPayment}
                  className="bg-black hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-amber-200 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wide shrink-0 cursor-pointer"
                >
                  Pay Now <ArrowRight size={14} />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Awaiting Payment notice card - shown while payment is pending */}
        {isAwaitingOnlinePayment && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
              <Truck size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-[14px] font-bold text-slate-800">
                {order.fulfillmentType === "SHIPROCKET"
                  ? "Courier Shipment on Hold"
                  : "Order Dispatch on Hold"}
              </h4>
              <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
                Awaiting payment. Complete payment to dispatch your {order.fulfillmentType === "SHIPROCKET" ? "shipment via Courier" : "order"}.
              </p>
            </div>
          </div>
        )}

        {/* Order Progress Tracker */}
        {!isAwaitingOnlinePayment && (
          <OrderProgressTracker
            order={order}
            estimatedArrivalText={estimatedArrival.arrivalTimeText}
            arrivingInText={estimatedArrival.arrivingInText}
            totalDistanceText={estimatedArrival.totalDistanceText}
          />
        )}

        {/* Order ID - separate field under the status, with copy (customer uses it to track the order) */}
        <div className="bg-white rounded-3xl px-5 py-4 shadow-sm border border-slate-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order ID</p>
            <p className="font-mono font-black text-slate-900 text-sm mt-1 break-all select-all">{order.orderId}</p>
          </div>
          <button
            type="button"
            onClick={() => handleCopyOrderId(order.orderId)}
            aria-label="Copy order ID"
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition",
              isCopiedOrderId
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-blue-50 hover:bg-blue-100 text-blue-700",
            )}
          >
            {isCopiedOrderId ? <Check size={14} /> : <Copy size={14} />}
            <span>{isCopiedOrderId ? "Copied" : "Copy"}</span>
          </button>
        </div>

        {/* Live Tracking Map removed per user request */}

        {/* Proximity-based Delivery OTP Display - Only for Local Quick Commerce orders when payment is complete */}
        {!isAwaitingOnlinePayment && order.fulfillmentType !== "SHIPROCKET" && (
          <DeliveryOtpDisplay
            orderId={order?.orderId || orderId}
            checkoutGroupId={order?.checkoutGroupId || orderId}
            initialOtp={order?.deliveryOtp || order?.handoffOtp || (handoffOtp ? { code: handoffOtp } : null)}
          />
        )}

        {/* Courier shipment card - only once a courier/AWB is really assigned (nothing to show before that) */}
        {!isAwaitingOnlinePayment && order.fulfillmentType === "SHIPROCKET" && order.shiprocket?.awb && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    Shipment Details
                  </h3>
                  {order.shiprocket?.courierName && (
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {order.shiprocket.courierName}
                    </p>
                  )}
                </div>
              </div>
              {order.shiprocket?.statusLabel && (
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  order.shiprocket.currentStatus === "DELIVERED"
                    ? "bg-emerald-100 text-emerald-800"
                    : order.shiprocket.currentStatus === "OUT_FOR_DELIVERY"
                    ? "bg-purple-100 text-purple-800"
                    : order.shiprocket.currentStatus === "IN_TRANSIT"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-amber-100 text-amber-800"
                }`}>
                  {order.shiprocket.statusLabel}
                </span>
              )}
            </div>

            {/* The tracking number stays behind this button - customers don't need to read or copy it. */}
            <a
              href={order.shiprocket.trackingUrl || `https://shiprocket.co/tracking/${order.shiprocket.awb}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <span>Track Package</span>
              <ArrowRight size={13} />
            </a>

            {/* Event history timeline */}
            {Array.isArray(order.shiprocket?.history) && order.shiprocket.history.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Shipment Tracking Updates
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {order.shiprocket.history.slice().reverse().map((ev, i) => (
                    <div key={i} className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100/80 flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-800">{ev.status}</span>
                        {ev.location && <span className="text-slate-500"> • {ev.location}</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(ev.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Delivery Partner Card - Only for Local Rider Orders */}
        {order.deliveryBoy && order.fulfillmentType !== "SHIPROCKET" && status !== "delivered" && status !== "cancelled" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-14 w-14 rounded-full bg-slate-100 overflow-hidden border-2 border-white shadow-sm">
                  <img
                    src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&auto=format&fit=crop&q=60"
                    alt="Rider"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm border border-white">
                  4.8 ★
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Your Courier</p>
                <h3 className="font-bold text-slate-900 text-lg leading-tight">{order.deliveryBoy?.name || "Delivery Partner"}</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">On the way to you</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={`sms:${order.deliveryBoy?.phone || ''}`} className="h-10 w-10 rounded-full bg-brand-50 flex items-center justify-center hover:bg-brand-100 transition-colors border border-brand-100">
                  <MessageSquare size={18} className="text-primary" />
                </a>
                <a href={`tel:${order.deliveryBoy?.phone || ''}`} className="h-10 w-10 rounded-full bg-brand-50 flex items-center justify-center hover:bg-brand-100 transition-colors border border-brand-100">
                  <Phone size={18} className="text-primary" />
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {/* Pickup Location Card - local orders only (courier orders ship from the seller's private address) */}
        {order.fulfillmentType !== "SHIPROCKET" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center flex-shrink-0">
              <Store size={24} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-bold text-primary uppercase tracking-wider">Pickup Location</p>
              </div>
              <h4 className="font-bold text-slate-900 text-base mb-1">{order.seller?.shopName || "Store Location"}</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                {order.seller?.address || "Address not available"}
              </p>
            </div>
            <button
              onClick={handleOpenInMaps}
              className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0"
            >
              <Navigation2 size={18} className="text-slate-700" />
            </button>
          </div>
        </motion.div>
        )}

        {/* Delivery Address Card - Redesigned */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center flex-shrink-0">
              <MapPin size={24} className="text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-bold text-brand-600 uppercase tracking-wider">Delivery Address</p>
                <span className="bg-brand-50 text-brand-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {order.address.type}
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-base mb-1">{order.address.name}</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                {[order.address.address, order.address.city].filter(Boolean).join(", ") || "Address not available"}
              </p>
              {order.address?.location &&
                typeof order.address.location.lat === "number" &&
                typeof order.address.location.lng === "number" && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-1 rounded-lg">
                    <CheckCircle size={14} className="text-brand-600" />
                    Precise location confirmed
                  </p>
                )}
              <p className="text-sm text-slate-800 font-semibold mt-3 flex items-center gap-2">
                <Phone size={16} className="text-slate-400" />
                {order.address.phone}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Order Items - Compact Design */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
        >
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Package size={18} className="text-slate-400" />
            Order Items
          </h3>
          <div className="space-y-3">
            {order.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                <div className="h-14 w-14 bg-slate-50 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100">
                  <img
                    src={applyCloudinaryTransform(item.image)}
                    alt={item.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-800 text-sm mb-0.5 truncate">
                    {item.name}
                  </h4>
                  <p className="text-slate-500 text-xs font-medium">
                    Qty: {item.quantity}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end">
                  <p className="font-bold text-slate-900">
                    ₹{item.price * item.quantity}
                  </p>
                  {(status === "delivered" || order?.status === "delivered" || order?.workflowStatus === "DELIVERED") && (
                    <button
                      type="button"
                      onClick={() => {
                        const pid = String(item.product?._id || (typeof item.product === "string" ? item.product : "") || item._id || "");
                        setReviewModalProduct({
                          ...item,
                          productId: pid,
                          name: item.name || item.product?.title || "Product",
                          image: item.image || item.product?.image || item.product?.images?.[0],
                        });
                      }}
                      className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      <Star size={11} className="fill-amber-500 text-amber-500" />
                      {reviewedProductIds.includes(String(item.product?._id || item.product || item.id)) ? "Reviewed" : "Rate & Review"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Kit Add-On Items */}
        {order.kitAddons && order.kitAddons.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.27 }}
            className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
          >
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Package size={18} className="text-orange-400" />
              Add-On Items
            </h3>
            <div className="space-y-3">
              {order.kitAddons.map((addon, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-orange-50/50 border border-orange-100"
                >
                  <div className="h-12 w-12 bg-white rounded-xl overflow-hidden flex-shrink-0 border border-orange-100">
                    {addon.image ? (
                      <img src={addon.image} alt={addon.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-orange-50">
                        <Package size={16} className="text-orange-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-800 text-sm truncate">{addon.name}</h4>
                    <p className="text-slate-500 text-xs font-medium">
                      {addon.unit} · Qty: {addon.quantity}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-slate-900">₹{addon.subtotal || addon.quantity * addon.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Bill Summary - Cleaner Design */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
        >
          <h3 className="text-base font-bold text-slate-800 mb-4">Bill Summary</h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Item Total</span>
              <span className="font-semibold">₹{order.pricing.subtotal}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery Fee</span>
              <span
                className={
                  order.pricing.deliveryFee === 0 ? "text-brand-600 font-bold" : "font-semibold"
                }>
                {order.pricing.deliveryFee === 0
                  ? "FREE"
                  : `₹${order.pricing.deliveryFee}`}
              </span>
            </div>
            {order.pricing.tip > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tip</span>
                <span className="font-semibold">₹{order.pricing.tip}</span>
              </div>
            )}
            <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between items-center">
              <span className="text-base font-bold text-slate-900">
                Total Amount
              </span>
              <span className="text-xl font-black text-brand-600">
                ₹{order.pricing.total}
              </span>
            </div>
          </div>

          {/* Payment: one clean row - how the customer pays + a plain-language status */}
          {(() => {
            const pay = getPaymentDisplay(order);
            const PayIcon = pay.icon;
            return (
          <div className="mt-4 bg-slate-50 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", pay.iconBg)}>
                  <PayIcon size={19} className={pay.iconColor} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid via</p>
                  <p className="text-sm font-extrabold text-slate-900 leading-tight">{pay.methodLabel}</p>
                  {pay.showUtr && order.utrNumber && (
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">UTR {order.utrNumber}</p>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              <span className={cn(
                "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border",
                pay.badgeClass
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", pay.dotClass)} />
                {pay.statusLabel}
              </span>
            </div>

            {/* UPI QR Specific State Information */}
            {order.paymentMode === 'UPI_QR' && (
              <div className="pt-2 border-t border-slate-200/60 space-y-2.5">
                {/* Case 1: Verification In Progress */}
                {(order.paymentStatus === 'AWAITING_VERIFICATION' || order.paymentStatus === 'CREATED') && order.utrNumber && (
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-amber-900">Verifying your payment</span>
                      <span className="shrink-0 text-[11px] font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-amber-200">
                        UTR {order.utrNumber}
                      </span>
                    </div>
                    {order.upiApprovalExpiresAt && (
                      <p className="text-[11px] text-amber-800 leading-snug">
                        Order cancels if not verified by{" "}
                        <span className="font-bold">
                          {new Date(order.upiApprovalExpiresAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        .
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setUtrModalInput(order.utrNumber || "");
                        setIsUtrModalOpen(true);
                      }}
                      className="text-xs font-bold text-amber-900 hover:text-amber-950 underline cursor-pointer"
                    >
                      Need to update UTR?
                    </button>
                  </div>
                )}

                {/* Case 2: Awaiting UTR Submission */}
                {(order.paymentStatus === 'AWAITING_VERIFICATION' || order.paymentStatus === 'CREATED') && !order.utrNumber && (
                  <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 space-y-2">
                    <p className="text-[11px] text-blue-900 font-medium">
                      Please scan the UPI QR code or pay via your UPI app, then submit the 12-digit UTR to confirm your order.
                      {order.upiApprovalExpiresAt && (
                        <> Your order is held until <span className="font-bold">{order.upiApprovalExpiresAt ? new Date(order.upiApprovalExpiresAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span>; after that it is cancelled.</>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setUtrModalInput("");
                        setIsUtrModalOpen(true);
                      }}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <QrCode size={16} />
                      Pay via UPI QR / Submit UTR
                    </button>
                  </div>
                )}

                {/* Case 3: Rejected Payment (Safety Net) */}
                {order.paymentStatus === 'REJECTED' && (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-rose-700 font-black text-xs uppercase tracking-wider">
                      <AlertCircle size={15} />
                      <span>Payment Verification Failed</span>
                    </div>
                    {order.paymentRejectedReason && (
                      <p className="text-xs text-rose-600">
                        <b>Reason:</b> {order.paymentRejectedReason}
                      </p>
                    )}
                    {order.utrNumber && (
                      <p className="text-[11px] font-mono text-slate-600">
                        Submitted UTR: <b>{order.utrNumber}</b>
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <a
                        href={whatsappSupportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 no-underline transition-all shadow-sm"
                      >
                        <MessageCircle size={15} />
                        Chat on WhatsApp
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setUtrModalInput(order.utrNumber || "");
                          setIsUtrModalOpen(true);
                        }}
                        className="py-2.5 px-3 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Re-enter UTR
                      </button>
                    </div>
                  </div>
                )}

                {/* Paid: nothing extra to show - the green "Paid" badge above says it all */}
              </div>
            )}
          </div>
            );
          })()}
        </motion.div>

        {/* Action Buttons - Redesigned */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="grid grid-cols-2 gap-3"
        >
          <button
            onClick={() => setShowInvoice(true)}
            className="py-3.5 rounded-2xl bg-white border-2 border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow-md active:scale-[0.98]">
            <Download size={18} /> Invoice
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="py-3.5 rounded-2xl bg-white border-2 border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow-md active:scale-[0.98]">
            <HelpCircle size={18} /> Help
          </button>
        </motion.div>

        {/* Return Section - Only if applicable */}
        {(canRequestReturn() || (returnDetails && returnDetails.returnStatus && returnDetails.returnStatus !== "none")) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-800">
                Return & Refund
              </h3>
              {canRequestReturn() && returnCountdown !== 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold ring-1 ring-amber-200">
                  <Clock size={12} />
                  Ends in {returnCountdown}
                </div>
              )}
            </div>

            {returnDetails &&
              returnDetails.returnStatus &&
              returnDetails.returnStatus !== "none" ? (
              <div className="space-y-4 text-sm">
                <ReturnProgressTracker returnStatus={returnDetails.returnStatus} />

                {/* Return OTP / Courier Pickup Display */}
                {returnDetails.returnStatus === "return_pickup_assigned" && (
                  isShiprocketOrder ? (
                    <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-8 w-8 rounded-full bg-sky-100 flex items-center justify-center">
                          <Truck size={16} className="text-sky-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-sky-900">Courier Reverse Pickup Scheduled</p>
                          <p className="text-xs text-sky-700">Shiprocket Return Partner: {order?.shiprocket?.reverseCourierName || returnDetails?.shiprocket?.reverseCourierName || "Delhivery / Ecom Express"}</p>
                        </div>
                      </div>
                      <div className="ml-11 mt-2 text-xs text-slate-600 space-y-1">
                        <p>Reverse AWB: <span className="font-mono font-bold text-slate-900">{order?.shiprocket?.reverseAwb || returnDetails?.shiprocket?.reverseAwb || "AWB Generating"}</span></p>
                        <p className="text-[11px] text-slate-500">Please pack the item securely in original packaging. The courier executive will collect it from your doorstep.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-brand-50 rounded-2xl p-4 border border-brand-100">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center">
                          <Truck size={16} className="text-brand-600" />
                        </div>
                        <p className="text-sm font-bold text-brand-900">Return Pickup Assigned</p>
                      </div>
                      <p className="text-xs text-brand-700 mb-3 ml-11">
                        A delivery partner is coming to collect your return. Please share this OTP when they arrive:
                      </p>
                      <div className="ml-11 flex items-center gap-2">
                        {handoffOtp ? (
                          <div className="flex gap-2">
                            {handoffOtp.split('').map((digit, i) => (
                              <div key={i} className="h-10 w-8 bg-white border-2 border-brand-200 rounded-lg flex items-center justify-center text-lg font-black text-brand-700 shadow-sm">
                                {digit}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs font-bold text-slate-400 italic">Waiting for rider to request OTP...</p>
                        )}
                      </div>
                    </div>
                  )
                )}

                {/* Return In Transit */}
                {returnDetails.returnStatus === "return_in_transit" && (
                  <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 rounded-full bg-sky-100 flex items-center justify-center">
                        <Truck size={16} className="text-sky-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-sky-900">Return Package In Transit</p>
                        <p className="text-xs text-sky-700">
                          {isShiprocketOrder
                            ? `Courier Partner: ${order?.shiprocket?.reverseCourierName || returnDetails?.shiprocket?.reverseCourierName || "Delhivery / Ecom Express"}`
                            : "Local Delivery Partner"}
                        </p>
                      </div>
                    </div>
                    <div className="ml-11 mt-2 text-xs text-slate-600 space-y-1">
                      {(order?.shiprocket?.reverseAwb || returnDetails?.shiprocket?.reverseAwb) && (
                        <p>Reverse AWB: <span className="font-mono font-bold text-slate-900">{order?.shiprocket?.reverseAwb || returnDetails?.shiprocket?.reverseAwb}</span></p>
                      )}
                      <p className="text-[11px] text-slate-500">
                        {isShiprocketOrder
                          ? "Your returned item has been collected and is safely on its way to the seller hub."
                          : "Package picked up and returning to seller store."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Returned & Delivered to Seller */}
                {returnDetails.returnStatus === "returned" && (
                  <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle size={16} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-900">Package Delivered to Seller</p>
                        <p className="text-xs text-emerald-700">Quality check and refund inspection in progress</p>
                      </div>
                    </div>
                    <div className="ml-11 mt-1 text-xs text-slate-600 space-y-1">
                      {(order?.shiprocket?.reverseAwb || returnDetails?.shiprocket?.reverseAwb) && (
                        <p>Reverse AWB: <span className="font-mono font-bold text-slate-900">{order?.shiprocket?.reverseAwb || returnDetails?.shiprocket?.reverseAwb}</span></p>
                      )}
                      <p className="text-[11px] text-slate-500">
                        The seller has received your returned package and will inspect it within {returnDetails?.qc?.policy?.dueHours || 48} hours. Your refund is processed right after. If the seller does not inspect it in time, your refund is approved automatically.
                      </p>
                    </div>
                  </div>
                )}

                {/* QC Inspection States */}
                {returnDetails.returnStatus === "qc_passed" && (
                  <div className="bg-teal-50 rounded-2xl p-4 border border-teal-100">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                        <CheckCircle size={16} className="text-teal-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-teal-900">
                          {returnDetails.returnQcAutoPassed ? "Return Approved" : "Quality Check Passed"}
                        </p>
                        <p className="text-xs text-teal-700">
                          {returnDetails.returnQcAutoPassed
                            ? "Your return was approved automatically. Your refund is being processed..."
                            : "The returned item passed quality check. Your refund is being processed..."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {returnDetails.returnStatus === "qc_failed" && (
                  <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center">
                        <AlertCircle size={16} className="text-rose-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-rose-900">Quality Check Failed</p>
                        <p className="text-xs text-rose-700">{returnDetails.returnQcNote || "Item did not match acceptable return conditions."}</p>
                      </div>
                    </div>
                    {Array.isArray(returnDetails.returnQcEvidenceImages) && returnDetails.returnQcEvidenceImages.length > 0 && (
                      <div className="mt-3 ml-11">
                        <p className="text-[11px] font-bold text-rose-800 mb-1">Seller&apos;s photos</p>
                        <div className="flex flex-wrap gap-2">
                          {returnDetails.returnQcEvidenceImages.map((url, i) => (
                            <a key={url + i} href={url} target="_blank" rel="noreferrer">
                              <img src={url} alt={"Inspection photo " + (i + 1)} className="h-14 w-14 rounded-lg object-cover border border-rose-200" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {(() => {
                      const dispute = getDisputeInfo(returnDetails);
                      if (!dispute) return null;
                      const endsAt = returnDetails?.qc?.disputeWindowEndsAt
                        ? new Date(returnDetails.qc.disputeWindowEndsAt)
                        : null;
                      return (
                        <div className="mt-3 ml-11 space-y-2">
                          {dispute.status === "window" && (
                            <>
                              <p className="text-xs text-rose-800">
                                Think this is wrong? You can raise a dispute until{" "}
                                <span className="font-bold">
                                  {endsAt ? endsAt.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "the deadline"}
                                </span>
                                .
                              </p>
                              <button
                                onClick={() => setShowDisputeModal(true)}
                                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 active:scale-95 transition"
                              >
                                Raise a dispute
                              </button>
                            </>
                          )}
                          {dispute.status === "open" && (
                            <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                              Your dispute is with our team. We will update you here.
                            </p>
                          )}
                          {dispute.status === "upheld" && (
                            <p className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                              We reviewed your dispute and the quality check result stands.
                              {returnDetails.returnDispute?.resolutionNote ? " " + returnDetails.returnDispute.resolutionNote : ""}
                            </p>
                          )}
                          {dispute.status === "closed" && (
                            <p className="text-[11px] text-slate-500">The time to dispute this result is over.</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {returnDetails.returnStatus === "return_rejected" && (
                  <p className="text-sm text-rose-600 font-medium bg-rose-50 p-3 rounded-xl border border-rose-100">
                    Return request rejected:{" "}
                    {returnDetails.returnRejectedReason || "No reason provided"}
                  </p>
                )}
                {returnDetails.returnRefundAmount > 0 &&
                  returnDetails.returnStatus === "refund_completed" && (
                    <div className="bg-brand-50 p-4 rounded-2xl border border-brand-100">
                      <p className="text-xs font-bold text-brand-800 uppercase tracking-wider mb-1">Refund Successful</p>
                      <p className="text-sm text-brand-700 font-medium">
                        ₹{returnDetails.returnRefundAmount} has been credited to your {order.paymentMethod === 'cod' ? 'hand (Cash)' : 'wallet'}.
                      </p>
                    </div>
                  )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                You can request a return within {returnWindowLabel} of delivery.
              </p>
            )}

            {canRequestReturn() && (
              <button
                onClick={() => setShowReturnModal(true)}
                className="w-full py-4 rounded-2xl bg-slate-900 text-white text-sm font-bold shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-[0.98]">
                Request Return
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <InvoiceModal
        isOpen={showInvoice}
        onClose={() => setShowInvoice(false)}
        order={order}
      />
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {/* Dispute a failed quality check */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !submittingDispute && setShowDisputeModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4"
          >
            <h3 className="text-lg font-black text-slate-900">Raise a dispute</h3>
            <p className="text-xs text-slate-500">
              Tell us why the quality check result is wrong. Our team will review your message and photos. You can raise a dispute only once.
            </p>
            <textarea
              className="w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
              rows={4}
              placeholder="e.g. The item was in perfect condition when I handed it over..."
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
            />
            <p className="text-[11px] text-slate-500">
              {disputeReason.trim().length}/{DISPUTE_REASON_MIN_LENGTH} characters minimum
            </p>
            <ProofImagePicker
              images={disputeImages}
              onChange={setDisputeImages}
              onError={(m) => toast.error(m)}
              label="Photos (optional)"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowDisputeModal(false)}
                disabled={submittingDispute}
                className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDisputeSubmit}
                disabled={submittingDispute || disputeReason.trim().length < DISPUTE_REASON_MIN_LENGTH}
                className="flex-1 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold disabled:opacity-50"
              >
                {submittingDispute ? "Submitting..." : "Submit dispute"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Return Request Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !requestingReturn && setShowReturnModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4"
          >
            <h3 className="text-lg font-black text-slate-900">
              Request Return
            </h3>
            <p className="text-xs text-slate-500">
              Select the items you want to return and tell us why.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-3">
              {order.items.map((item, idx) => {
                const isItemNonReturnable = item.isReturnable === false || item.product?.isReturnable === false;
                const checked = !!selectedReturnItems[idx];
                return (
                  <label
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                      isItemNonReturnable
                        ? "border-rose-100 bg-rose-50/60 opacity-80 cursor-not-allowed"
                        : "border-slate-100 hover:bg-slate-50 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isItemNonReturnable}
                      onChange={() => !isItemNonReturnable && toggleItemSelection(idx)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 disabled:opacity-40"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {item.name}
                        </p>
                        {isItemNonReturnable && (
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                            Non-Returnable
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        Qty: {item.quantity} • ₹{item.price * item.quantity}
                        {isItemNonReturnable && (
                          <span className="text-rose-600 block text-[11px] font-medium mt-0.5">
                            {item.returnPolicyNote || item.product?.returnPolicyNote || "Perishable or hygiene item"}
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">
                  Reason for return
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="" disabled>Select a reason...</option>
                  <option value="Defective product">Defective product</option>
                  <option value="Wrong item delivered">Wrong item delivered</option>
                  <option value="Not as expected">Not as expected</option>
                  <option value="Size issue">Size issue</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">
                  Detailed Issue Mention
                </label>
                <textarea
                  rows={2}
                  value={returnReasonDetail}
                  onChange={(e) => setReturnReasonDetail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                  placeholder="Describe the issue with the product..."
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-600 uppercase">
                  Photos ({returnImages.length}/5) *
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {returnImages.map((img, index) => (
                    <div key={index} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                      <img src={img} alt="proof" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center cursor-pointer hover:bg-black/80"
                      >
                        <X size={12} className="text-white" />
                      </button>
                    </div>
                  ))}
                  {returnImages.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors shrink-0"
                    >
                      {isUploadingImage ? (
                        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              <label className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={returnConditionAssurance}
                  onChange={(e) => setReturnConditionAssurance(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600"
                />
                <span className="text-xs font-semibold text-amber-900 leading-tight">
                  I confirm the product is returned with proper accessories and is in good condition.
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => !requestingReturn && setShowReturnModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                disabled={requestingReturn}>
                Cancel
              </button>
              <button
                onClick={handleReturnSubmit}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-70 transition-all"
                disabled={requestingReturn}>
                {requestingReturn ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Review & Rating Modal for Delivered Item */}
      <ReviewSubmissionModal
        isOpen={Boolean(reviewModalProduct)}
        onClose={() => setReviewModalProduct(null)}
        product={reviewModalProduct}
        onReviewSubmitted={(pid) => setReviewedProductIds((prev) => [...prev, pid])}
      />

      {/* UPI QR & UTR Modal for Customer */}
      <AnimatePresence>
        {isUtrModalOpen && order && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto relative text-left"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <QrCode size={20} className="text-emerald-600" />
                    Pay With QR
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                    Order #{order.orderId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUtrModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Locked Amount */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between text-emerald-900">
                <span className="text-xs font-bold uppercase tracking-wider">Exact Amount</span>
                <span className="text-xl font-black text-emerald-700">₹{order.pricing?.total}</span>
              </div>

              {/* Dynamic QR Code */}
              <div className="text-center bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="relative inline-block">
                  <div ref={orderQrWrapRef} className="bg-white p-3.5 rounded-2xl shadow-sm inline-block border border-slate-200">
                    <QRCode
                      value={`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiDisplayName)}&am=${order.pricing?.total}&cu=INR&tn=${encodeURIComponent(`Order_${order.orderId}`)}`}
                      size={170}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    disabled={isDownloadingQr}
                    className="absolute -top-2 -right-2 h-9 w-9 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition cursor-pointer disabled:opacity-60"
                    title="Save QR to gallery"
                    aria-label="Save QR to gallery"
                  >
                    {isDownloadingQr ? <Loader2 size={16} className="animate-spin" /> : <Download size={17} />}
                  </button>
                </div>

                {/* UPI ID copy */}
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono">
                  <span className="text-slate-600 truncate">{upiId}</span>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="flex items-center gap-1 text-[11px] font-sans font-bold text-blue-600 hover:text-blue-700 shrink-0 ml-2 cursor-pointer"
                  >
                    {isCopiedUpi ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{isCopiedUpi ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleUtrSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    12-Digit UTR / Reference No. <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    value={utrModalInput}
                    onChange={(e) => setUtrModalInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 402938491029"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono text-base font-bold tracking-widest text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-center"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingUtr || utrModalInput.length !== 12}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold text-[15px] py-3.5 px-6 rounded-xl shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingUtr ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-white" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      <span>Submit Payment Proof</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrderDetailPage;
