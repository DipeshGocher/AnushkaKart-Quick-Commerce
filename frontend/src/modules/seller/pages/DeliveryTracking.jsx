import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlineMagnifyingGlass,
  HiOutlineTruck,
  HiOutlinePhone,
  HiOutlineMapPin,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineUser,
  HiOutlineInformationCircle,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineXMark,
} from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";

import { sellerApi } from "../services/sellerApi";
import { useToast } from "@shared/components/ui/Toast";
import { Loader2, Navigation } from "lucide-react";
import Pagination from "@shared/components/ui/Pagination";
import LiveTrackingMap from "@/modules/customer/components/order/LiveTrackingMap";
import {
  subscribeToOrderLocation,
  subscribeToOrderRoute,
} from "@/core/services/trackingClient";

const getStatusVariant = (status) => {
  switch (status) {
    case "Out for Delivery":
    case "On the Way":
      return "info";
    case "Rider at Store":
    case "Pickup Scheduled":
    case "In Transit":
      return "primary";
    case "Rider Heading to Store":
    case "Finding Rider":
    case "AWB Generated":
    case "At Store":
      return "warning";
    case "Delivered":
      return "success";
    default:
      return "neutral";
  }
};

const coordsToLatLng = (coords) => {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const DeliveryCard = React.memo(function DeliveryCard({ dlv, onAction }) {
  return (
    <div className="group relative bg-white rounded-2xl border border-slate-100 p-2 sm:p-2.5 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-300 min-w-0">
      <div className="flex flex-col lg:flex-row items-stretch gap-2">
        {/* Partner Info Section */}
        <div className="lg:w-64 p-3 bg-slate-50/70 rounded-xl border border-slate-100/80 group-hover:bg-primary/[0.02] group-hover:border-primary/10 transition-all min-w-0">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {dlv.isShiprocket ? (
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-sky-500/20">
                  <HiOutlineTruck className="h-5 w-5" />
                </div>
              ) : dlv.status === "Finding Rider" ? (
                <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-black relative overflow-hidden shadow-sm">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-30" />
                  <Loader2 className="h-5 w-5 animate-spin text-amber-600 relative z-10" />
                </div>
              ) : dlv.deliveryBoy?.image ? (
                <div className="h-11 w-11 rounded-xl overflow-hidden ring-2 ring-white shadow-sm">
                  <img
                    src={dlv.deliveryBoy.image}
                    alt={dlv.deliveryBoy.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                </div>
              ) : (
                <div className="h-11 w-11 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-black text-xs shadow-sm">
                  {dlv.deliveryBoy ? dlv.deliveryBoy.avatar : <HiOutlineUser className="h-5 w-5 text-slate-400" />}
                </div>
              )}

              {!dlv.isShiprocket && dlv.deliveryBoy && (
                <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-brand-500 rounded-sm border-[1px] border-white flex items-center justify-center text-white text-[7px] font-black shadow-sm">
                  {dlv.deliveryBoy.rating}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-[8px] font-black text-primary uppercase tracking-[0.1em]">
                  {dlv.isShiprocket ? "Courier Partner" : "Delivery Fleet"}
                </p>
                {dlv.isShiprocket && (
                  <span className="text-[8px] px-1 py-0 bg-sky-100 text-sky-700 font-black rounded uppercase">
                    Shiprocket
                  </span>
                )}
                {!dlv.isShiprocket && dlv.status === "Finding Rider" && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                  </span>
                )}
              </div>

              <h3 className="text-xs font-black text-slate-900 leading-tight truncate">
                {dlv.isShiprocket
                  ? dlv.courierName
                  : dlv.deliveryBoy
                  ? dlv.deliveryBoy.name
                  : "Finding Rider..."}
              </h3>

              {dlv.isShiprocket ? (
                <p className="text-[9px] font-bold text-slate-500 truncate mt-0.5 font-mono">
                  {dlv.awb ? `AWB: ${dlv.awb}` : "AWB Pending"}
                </p>
              ) : dlv.deliveryBoy?.phone ? (
                <a
                  href={`tel:${dlv.deliveryBoy.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold text-slate-600 hover:text-primary transition-colors"
                >
                  <HiOutlinePhone className="h-2.5 w-2.5 shrink-0 text-brand-600" />
                  <span className="truncate">{dlv.deliveryBoy.phone}</span>
                </a>
              ) : (
                <p className="text-[9px] font-bold text-amber-600 mt-0.5">
                  Searching nearby partners
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Order Info Section */}
        <div className="flex-1 p-2 sm:p-2.5 flex flex-col justify-between min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 mb-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[11px] font-black text-slate-900 tracking-tight font-mono">
                  #{dlv.orderId}
                </span>

                {/* Status Badges with Custom Icons */}
                {dlv.status === "Finding Rider" ? (
                  <span className="inline-flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    <span>Finding Rider</span>
                  </span>
                ) : dlv.status === "Rider Heading to Store" ? (
                  <span className="inline-flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200">
                    <Navigation className="h-2.5 w-2.5 animate-pulse text-brand-600" />
                    <span>Rider Heading to Store</span>
                  </span>
                ) : dlv.status === "Rider at Store" ? (
                  <span className="inline-flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <HiOutlineMapPin className="h-2.5 w-2.5 text-emerald-600" />
                    <span>Rider at Store (Ready)</span>
                  </span>
                ) : (
                  <Badge
                    variant={getStatusVariant(dlv.status)}
                    className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0"
                  >
                    {dlv.status}
                  </Badge>
                )}

                {dlv.isShiprocket && (
                  <Badge
                    variant="outline"
                    className="text-[7px] font-bold px-1.5 py-0 rounded uppercase tracking-wider text-sky-700 border-sky-200 bg-sky-50/50"
                  >
                    Pan-India Courier
                  </Badge>
                )}
              </div>

              <h4 className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 flex-wrap">
                <HiOutlineUser className="h-3 w-3 text-slate-400 shrink-0" />
                <span className="text-slate-900 capitalize font-black">{dlv.customerName}</span>
                {dlv.customerPhone && (
                  <span className="text-slate-500 font-medium">({dlv.customerPhone})</span>
                )}
              </h4>
            </div>

            <div className="sm:text-right shrink-0 mt-1 sm:mt-0">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
                Order Timing
              </p>
              <p className="text-[10px] font-black text-primary tracking-tight mt-0.5">
                {dlv.startTime || "—"}
              </p>
            </div>
          </div>

          <div className="bg-slate-50/60 px-3 py-1.5 rounded-xl border border-slate-100 min-w-0 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold text-slate-600 leading-tight truncate">
              <HiOutlineMapPin className="inline h-2.5 w-2.5 text-primary mr-1 -mt-0.5 shrink-0" />
              {dlv.address || "Customer Address"}
            </p>
            <span className="text-[9px] font-bold text-slate-500 shrink-0">
              ETA: {dlv.estimatedDelivery}
            </span>
          </div>
        </div>

        {/* Action Button Section */}
        <div className="lg:w-20 flex items-center justify-center p-2 shrink-0">
          <button
            type="button"
            onClick={() => onAction(dlv)}
            title={
              dlv.isShiprocket && dlv.trackingUrl
                ? "Open Shiprocket Live Tracking"
                : "Open Live GPS Fleet Map"
            }
            className="w-full h-11 lg:h-full bg-slate-900 hover:bg-primary group-hover:bg-primary rounded-xl flex flex-col items-center justify-center text-white transition-all duration-300 shadow-md shadow-slate-900/10 hover:shadow-primary/30 gap-0.5"
          >
            {dlv.isShiprocket && dlv.trackingUrl ? (
              <>
                <HiOutlineArrowTopRightOnSquare className="h-4 w-4 transition-transform group-hover:scale-110" />
                <span className="text-[8px] font-black uppercase tracking-wider">Track</span>
              </>
            ) : (
              <>
                <HiOutlineTruck className="h-4 w-4 transition-transform group-hover:scale-110" />
                <span className="text-[8px] font-black uppercase tracking-wider">Live Map</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

const isCompletedToday = (dateValue) => {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

const DeliveryTracking = () => {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("Active");
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Live Map Modal State
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [selectedTrackingOrder, setSelectedTrackingOrder] = useState(null);
  const [modalRiderLocation, setModalRiderLocation] = useState(null);
  const [modalRoutePolyline, setModalRoutePolyline] = useState(null);

  useEffect(() => {
    fetchDeliveries();
  }, []);

  // Subscribe to live rider location & route when modal opens
  useEffect(() => {
    if (!isMapModalOpen || !selectedTrackingOrder?.orderId || selectedTrackingOrder.isShiprocket) {
      setModalRiderLocation(null);
      setModalRoutePolyline(null);
      return undefined;
    }

    const orderId = selectedTrackingOrder.orderId;
    const unsubLoc = subscribeToOrderLocation(orderId, (loc) => {
      if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
        setModalRiderLocation({ lat: loc.lat, lng: loc.lng });
      }
    });

    const unsubRoute = subscribeToOrderRoute(orderId, (routeData) => {
      if (routeData?.polyline) {
        setModalRoutePolyline(routeData);
      }
    });

    // Fetch initial driving route if available
    sellerApi
      .getOrderRoute(orderId, {
        phase: selectedTrackingOrder.status === "Out for Delivery" ? "delivery" : "pickup",
      })
      .then((res) => {
        if (res.data?.result?.polyline || res.data?.polyline) {
          setModalRoutePolyline(res.data.result || res.data);
        }
      })
      .catch(() => {
        // Non-fatal if initial route is not cached
      });

    return () => {
      unsubLoc();
      unsubRoute();
    };
  }, [isMapModalOpen, selectedTrackingOrder]);

  const handleAction = (dlv) => {
    if (dlv.isShiprocket && dlv.trackingUrl) {
      window.open(dlv.trackingUrl, "_blank", "noopener,noreferrer");
    } else {
      setSelectedTrackingOrder(dlv);
      setIsMapModalOpen(true);
    }
  };

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const response = await sellerApi.getOrders({
        page: 1,
        limit: 100,
      });
      const payload = response.data?.result || {};
      const collectedOrders = Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(response.data?.results)
        ? response.data.results
        : [];

      // Only show orders that are confirmed, packed, out for delivery, or delivered
      const formattedDeliveries = collectedOrders
        .filter((order) => order.status !== "pending" && order.status !== "cancelled")
        .map((order) => {
          const isShiprocket = order.fulfillmentType === "SHIPROCKET";
          const courierName = order.shiprocket?.courierName || "Shiprocket Courier";
          const awb = order.shiprocket?.awb || null;
          const trackingUrl =
            order.shiprocket?.trackingUrl ||
            (awb ? `https://shiprocket.co/tracking/${awb}` : null);
          const srStatus = String(order.shiprocket?.currentStatus || "").toUpperCase();

          let uiStatus = "Finding Rider";

          if (isShiprocket) {
            // Shiprocket Courier Lifecycle: AWB Generated -> Pickup Scheduled -> In Transit -> Out for Delivery -> Delivered
            if (order.status === "delivered" || srStatus === "DELIVERED") {
              uiStatus = "Delivered";
            } else if (order.status === "out_for_delivery" || srStatus === "OUT_FOR_DELIVERY") {
              uiStatus = "Out for Delivery";
            } else if (srStatus === "IN_TRANSIT") {
              uiStatus = "In Transit";
            } else if (srStatus === "PICKUP_SCHEDULED" || order.status === "packed") {
              uiStatus = "Pickup Scheduled";
            } else if (srStatus === "AWB_ASSIGNED" || order.status === "confirmed") {
              uiStatus = "AWB Generated";
            } else {
              uiStatus = "Pending Shipment";
            }
          } else {
            // Local Delivery Lifecycle: Finding Rider -> Rider Heading to Store -> Rider at Store -> Out for Delivery -> Delivered
            if (order.status === "delivered") {
              uiStatus = "Delivered";
            } else if (
              order.status === "out_for_delivery" ||
              (Number(order.deliveryRiderStep) >= 3 && order.status !== "delivered")
            ) {
              uiStatus = "Out for Delivery";
            } else if (order.deliveryBoy) {
              if (
                Number(order.deliveryRiderStep) === 2 ||
                (order.status === "packed" && Number(order.deliveryRiderStep) >= 2)
              ) {
                uiStatus = "Rider at Store";
              } else {
                uiStatus = "Rider Heading to Store";
              }
            } else {
              uiStatus = "Finding Rider";
            }
          }

          const sellerLoc =
            coordsToLatLng(order.seller?.location?.coordinates) ||
            (order.seller?.location?.lat && order.seller?.location?.lng
              ? { lat: order.seller.location.lat, lng: order.seller.location.lng }
              : null);

          const destLoc = order.address?.location
            ? { lat: order.address.location.lat, lng: order.address.location.lng }
            : null;

          const riderLoc =
            coordsToLatLng(order.deliveryBoy?.location?.coordinates) ||
            (order.deliveryBoy?.location?.lat && order.deliveryBoy?.location?.lng
              ? { lat: order.deliveryBoy.location.lat, lng: order.deliveryBoy.location.lng }
              : null);

          return {
            id: order._id,
            orderId: order.orderId,
            status: uiStatus,
            rawStatus: order.status,
            workflowStatus: order.workflowStatus,
            fulfillmentType: order.fulfillmentType || "LOCAL",
            isShiprocket,
            courierName,
            awb,
            trackingUrl,
            shiprocketStatus: srStatus,
            partnerName: isShiprocket
              ? courierName
              : order.deliveryBoy?.name || "Finding Rider...",
            deliveryBoy:
              !isShiprocket && order.deliveryBoy
                ? {
                    name: order.deliveryBoy.name,
                    phone: order.deliveryBoy.phone,
                    avatar: order.deliveryBoy.name?.charAt(0) || "?",
                    image: order.deliveryBoy.profileImage || order.deliveryBoy.image || null,
                    rating: order.deliveryBoy.rating || 4.8,
                    vehicleType: order.deliveryBoy.vehicleType || "bike",
                    location: riderLoc,
                  }
                : null,
            location:
              order.status === "delivered" && (order.deliveredAt || order.updatedAt)
                ? `Delivered at ${new Date(order.deliveredAt || order.updatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "In Transit",
            orderDate: order.createdAt
              ? new Date(order.createdAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })
              : "",
            startTime: order.createdAt
              ? new Date(order.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "",
            deliveredAt: order.deliveredAt || null,
            updatedAt: order.updatedAt || null,
            estimatedDelivery: order.deliveryEstimate || (isShiprocket ? "3-4 days" : "20-30 mins"),
            customerName: order.customer?.name || "Customer",
            customerPhone: order.address?.phone || order.customer?.phone || "",
            address: order.address
              ? `${order.address.address || ""}, ${order.address.city || ""}`.trim()
              : "",
            sellerLocation: sellerLoc,
            destinationLocation: destLoc,
            deliveryBoyLocation: riderLoc,
          };
        });

      setDeliveries(formattedDeliveries);
    } catch (error) {
      console.error("Tracking Error:", error);
      showToast("Failed to fetch tracking data", "error");
    } finally {
      setLoading(false);
    }
  };

  const tabs = ["Active", "Completed", "All"];

  const filteredDeliveries = useMemo(() => {
    const result = deliveries.filter((dlv) => {
      const searchTarget = `${dlv.orderId} ${dlv.partnerName || ""} ${dlv.customerName || ""} ${dlv.awb || ""}`.toLowerCase();
      const matchesSearch = !searchTerm || searchTarget.includes(searchTerm.toLowerCase());

      const isCompleted = dlv.status === "Delivered";
      if (activeTab === "Active") return matchesSearch && !isCompleted;
      if (activeTab === "Completed") return matchesSearch && isCompleted;
      return matchesSearch;
    });

    const totalPages = Math.max(1, Math.ceil(result.length / pageSize));
    if (page > totalPages) {
      setPage(1);
    }
    return result;
  }, [deliveries, searchTerm, activeTab, page, pageSize]);

  const paginatedDeliveries = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredDeliveries.slice(start, end);
  }, [filteredDeliveries, page, pageSize]);

  const stats = useMemo(
    () => [
      {
        label: "On the Way",
        value: deliveries.filter(
          (d) => d.status === "On the Way" || d.status === "Out for Delivery" || d.status === "In Transit"
        ).length,
        icon: HiOutlineTruck,
        color: "text-brand-600",
        bg: "bg-brand-50",
      },
      {
        label: "At Store",
        value: deliveries.filter((d) =>
          [
            "At Store",
            "Finding Rider",
            "Rider Heading to Store",
            "Rider at Store",
            "AWB Generated",
            "Pickup Scheduled",
            "Pending Shipment",
          ].includes(d.status)
        ).length,
        icon: HiOutlineMapPin,
        color: "text-amber-600",
        bg: "bg-amber-50",
      },
      {
        label: "Completed Today",
        value: deliveries.filter(
          (d) => d.status === "Delivered" && isCompletedToday(d.deliveredAt || d.updatedAt)
        ).length,
        icon: HiOutlineCheckCircle,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
      },
    ],
    [deliveries],
  );

  return (
    <div className="space-y-6 pb-16">
      <BlurFade delay={0.1}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              Delivery Tracking
              <Badge
                variant="primary"
                className="text-[9px] px-2 py-0.5 font-bold tracking-wider uppercase bg-brand-100 text-brand-700"
              >
                Live Fleet
              </Badge>
            </h1>
            <p className="text-slate-600 text-sm mt-0.5 font-medium">
              Monitor active deliveries, assigned partners, and real-time fleet movement.
            </p>
          </div>
        </div>
      </BlurFade>

      {/* Stats Grid */}
      {loading ? (
        <div className="min-h-[400px] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 shadow-sm">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-slate-600 font-bold mt-4 uppercase tracking-widest text-xs">
            Tracking Fleet...
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.map((stat, i) => (
              <BlurFade key={i} delay={0.1 + i * 0.05}>
                <MagicCard
                  className="border-none shadow-sm ring-1 ring-slate-100 p-0 overflow-hidden group bg-white"
                  gradientColor={
                    stat.color === "text-brand-600"
                      ? "#e0f2fe"
                      : stat.color === "text-amber-600"
                      ? "#fef3c7"
                      : "#dcfce7"
                  }
                >
                  <div className="flex items-center gap-4 p-5 relative z-10">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 duration-500 shadow-sm",
                        stat.bg,
                        stat.color
                      )}
                    >
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                        {stat.label}
                      </p>
                      <h4 className="text-xl font-black text-slate-900 tracking-tight leading-none mt-0.5">
                        {stat.value}
                      </h4>
                    </div>
                  </div>
                </MagicCard>
              </BlurFade>
            ))}
          </div>

          <BlurFade delay={0.3}>
            <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-2xl bg-white">
              {/* Tabs & Search */}
              <div className="border-b border-slate-100 bg-slate-50/30">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between px-4">
                  <div className="flex items-center">
                    {tabs.map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                          "relative py-3.5 px-5 text-[9px] font-black uppercase tracking-widest transition-all duration-300",
                          activeTab === tab
                            ? "text-primary bg-white/50"
                            : "text-slate-600 hover:text-slate-700"
                        )}
                      >
                        {tab}
                        {activeTab === tab && (
                          <motion.div
                            layoutId="tab-underline-tracking"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full mx-4"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="py-2 lg:py-0 w-full lg:w-64">
                    <div className="relative group">
                      <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-primary transition-all" />
                      <input
                        type="text"
                        placeholder="Search ID, Partner or AWB..."
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-100/50 border-none rounded-lg text-xs font-bold text-slate-700 placeholder:text-slate-400 focus:ring-1 focus:ring-primary/10 transition-all outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery List */}
              <div className="p-4 sm:p-6 space-y-3">
                {paginatedDeliveries.map((dlv) => (
                  <DeliveryCard key={dlv.id} dlv={dlv} onAction={handleAction} />
                ))}

                {filteredDeliveries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-3">
                      <HiOutlineTruck className="h-8 w-8 text-slate-300" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900">
                      No tracking orders found
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      No active dispatches matching current filter or search.
                    </p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {filteredDeliveries.length > 0 && (
                <div className="px-4 sm:px-6 pb-4">
                  <Pagination
                    page={page}
                    totalPages={Math.max(1, Math.ceil(filteredDeliveries.length / pageSize))}
                    total={filteredDeliveries.length}
                    pageSize={pageSize}
                    onPageChange={(newPage) => setPage(newPage)}
                    onPageSizeChange={(newSize) => {
                      setPageSize(newSize);
                      setPage(1);
                    }}
                    loading={loading}
                  />
                </div>
              )}
            </Card>
          </BlurFade>
        </>
      )}

      {/* Live Map Modal for Local Delivery */}
      <AnimatePresence>
        {isMapModalOpen && selectedTrackingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shadow-sm">
                    <HiOutlineTruck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">
                        Live Fleet Tracking • #{selectedTrackingOrder.orderId}
                      </h3>
                      <Badge
                        variant={getStatusVariant(selectedTrackingOrder.status)}
                        className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full"
                      >
                        {selectedTrackingOrder.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate max-w-md">
                      Customer: <span className="text-slate-800 font-bold">{selectedTrackingOrder.customerName}</span> ({selectedTrackingOrder.address})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMapModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <HiOutlineXMark className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body: Map & Rider Status */}
              <div className="flex-1 overflow-y-auto">
                <div className="w-full h-80 sm:h-96 relative bg-slate-100">
                  <LiveTrackingMap
                    status={selectedTrackingOrder.rawStatus || selectedTrackingOrder.status}
                    eta={selectedTrackingOrder.estimatedDelivery || "15 mins"}
                    riderName={selectedTrackingOrder.deliveryBoy?.name || "Rider"}
                    riderPhone={selectedTrackingOrder.deliveryBoy?.phone}
                    riderLocation={modalRiderLocation || selectedTrackingOrder.deliveryBoyLocation}
                    sellerLocation={selectedTrackingOrder.sellerLocation}
                    destinationLocation={selectedTrackingOrder.destinationLocation}
                    routePhase={
                      selectedTrackingOrder.status === "Out for Delivery" ? "delivery" : "pickup"
                    }
                    routePolyline={modalRoutePolyline}
                  />
                </div>

                {/* Partner & Handover Status Footer */}
                <div className="p-4 sm:p-5 bg-white border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  {/* Rider Info Card */}
                  <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50/70 border border-slate-100">
                    <div className="h-11 w-11 rounded-xl bg-slate-200 overflow-hidden flex items-center justify-center font-black text-slate-600 text-sm ring-1 ring-slate-300">
                      {selectedTrackingOrder.deliveryBoy?.image ? (
                        <img
                          src={selectedTrackingOrder.deliveryBoy.image}
                          alt={selectedTrackingOrder.deliveryBoy.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        selectedTrackingOrder.deliveryBoy?.avatar || (
                          <HiOutlineUser className="h-5 w-5 text-slate-400" />
                        )
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-black uppercase text-brand-600 tracking-wider block">
                        Assigned Partner
                      </span>
                      <h4 className="text-xs font-black text-slate-900 truncate">
                        {selectedTrackingOrder.deliveryBoy?.name || "Assigning Rider..."}
                      </h4>
                      {selectedTrackingOrder.deliveryBoy?.phone ? (
                        <p className="text-[10px] text-slate-500 font-bold truncate">
                          {selectedTrackingOrder.deliveryBoy.phone}
                        </p>
                      ) : (
                        <p className="text-[10px] text-amber-600 font-bold truncate">
                          Searching nearby fleet
                        </p>
                      )}
                    </div>
                    {selectedTrackingOrder.deliveryBoy?.phone && (
                      <a
                        href={`tel:${selectedTrackingOrder.deliveryBoy.phone}`}
                        className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition"
                      >
                        <HiOutlinePhone className="h-3 w-3" />
                        <span>Call</span>
                      </a>
                    )}
                  </div>

                  {/* Handover Instruction / Live Status */}
                  <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100/80">
                    <span className="text-[9px] font-black uppercase text-amber-700 tracking-wider block mb-1">
                      Store Dispatch Status
                    </span>
                    <p className="text-xs text-slate-700 font-medium">
                      {selectedTrackingOrder.status === "Finding Rider"
                        ? "Looking for available delivery partners nearby. Once accepted, live GPS route will appear on the map."
                        : selectedTrackingOrder.status === "Rider Heading to Store"
                        ? "Rider is en route to your store. Keep the packed order ready at the counter."
                        : selectedTrackingOrder.status === "Rider at Store"
                        ? "Rider has arrived at your store! Hand over the parcel and confirm dispatch."
                        : selectedTrackingOrder.status === "Out for Delivery"
                        ? "Parcel picked up! Rider is on the way to the customer destination."
                        : "Order delivery completed successfully."}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DeliveryTracking;
