import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Calendar,
  MapPin,
  Clock,
  ChevronRight,
  Filter,
  Package,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Card from "@/shared/components/ui/Card";
import { deliveryApi } from "../services/deliveryApi";
import { toast } from "sonner";
import DeliveryFooter from "../components/DeliveryFooter";
import { getOrderSocket } from "@core/services/orderSocket";
import { createSocketTokenReader } from "@core/utils/authStorage";
import { STORAGE_KEYS } from "@core/utils/storageKeys";

const displayOrderStatus = (order) => {
  if (order?.taskStatus) {
    if (order.taskStatus === "returned") return "returned to store";
    return order.taskStatus;
  }
  if (order?.isReturnTask || order?.taskType === "RETURN") {
    if (order?.returnStatus === "returned" || order?.returnStatus === "refund_completed")
      return "returned to store";
    if (order?.returnStatus === "return_in_transit") return "in transit";
    if (order?.returnStatus === "return_pickup_assigned") return "pickup assigned";
    return order?.returnStatus || "return";
  }
  if (order?.workflowStatus === "DELIVERED" || order?.status === "delivered")
    return "delivered";
  if (order?.workflowStatus === "CANCELLED" || order?.status === "cancelled")
    return "cancelled";
  return order?.status || "active";
};

const getOrderEarnings = (order) => {
  if (order?.taskEarnings != null) {
    return order.taskEarnings;
  }
  if (order?.isReturnTask || order?.taskType === "RETURN") {
    return order.returnDeliveryCommission ?? order.returnCommission ?? 0;
  }
  if (order?.workflowStatus === "CANCELLED" || order?.status === "cancelled") {
    return 0;
  }
  if (order?.riderEarnings != null) return order.riderEarnings;
  if (order?.delivery?.riderEarning != null) return order.delivery.riderEarning;
  return Math.round((order?.pricing?.total || 0) * 0.1);
};

const getOrderDistanceText = (order) => {
  if (order?.delivery?.routeDistanceKm) {
    return `${order.delivery.routeDistanceKm} km`;
  }
  if (order?.delivery?.routeDistanceMeters) {
    return `${(order.delivery.routeDistanceMeters / 1000).toFixed(1)} km`;
  }
  return null;
};

const getOrderDurationText = (order) => {
  if (order?.delivery?.routeDurationMinutes) {
    return `${order.delivery.routeDurationMinutes} min`;
  }
  return null;
};

const OrderHistory = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const prevFilterRef = useRef(filter);
  const fetchSeqRef = useRef(0);
  const visibilityAbortRef = useRef(null);

  useEffect(() => {
    visibilityAbortRef.current?.abort();
    const filterChanged = prevFilterRef.current !== filter;
    prevFilterRef.current = filter;
    if (filterChanged) {
      setOrders([]);
    }

    const abortController = new AbortController();
    const runSeq = ++fetchSeqRef.current;

    setLoading(true);
    (async () => {
      try {
        const response = await deliveryApi.getOrderHistory(
          { status: filter },
          { signal: abortController.signal },
        );
        if (runSeq !== fetchSeqRef.current) return;
        const list =
          response.data?.results ?? response.data?.result ?? [];
        setOrders(Array.isArray(list) ? list : []);
      } catch (error) {
        if (
          error?.code === "ERR_CANCELED" ||
          error?.name === "CanceledError" ||
          error?.name === "AbortError"
        ) {
          return;
        }
        if (runSeq !== fetchSeqRef.current) return;
        toast.error("Failed to fetch order history");
      } finally {
        if (runSeq === fetchSeqRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      abortController.abort();
      visibilityAbortRef.current?.abort();
    };
  }, [filter]);

  useEffect(() => {
    let sawHidden = false;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        sawHidden = true;
        return;
      }
      if (!sawHidden || document.visibilityState !== "visible") return;
      sawHidden = false;

      visibilityAbortRef.current?.abort();
      const ac = new AbortController();
      visibilityAbortRef.current = ac;
      const runSeq = ++fetchSeqRef.current;
      setLoading(true);
      (async () => {
        try {
          const response = await deliveryApi.getOrderHistory(
            { status: filter },
            { signal: ac.signal },
          );
          if (runSeq !== fetchSeqRef.current) return;
          const list =
            response.data?.results ?? response.data?.result ?? [];
          setOrders(Array.isArray(list) ? list : []);
        } catch (error) {
          if (
            error?.code === "ERR_CANCELED" ||
            error?.name === "CanceledError" ||
            error?.name === "AbortError"
          ) {
            return;
          }
          if (runSeq !== fetchSeqRef.current) return;
          toast.error("Failed to fetch order history");
        } finally {
          if (runSeq === fetchSeqRef.current) {
            setLoading(false);
          }
        }
      })();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      visibilityAbortRef.current?.abort();
    };
  }, [filter]);

  // Live socket updates for order status changes across orders
  useEffect(() => {
    const getToken = createSocketTokenReader(STORAGE_KEYS.AUTH_DELIVERY);
    const socket = getOrderSocket(getToken);
    if (!socket) return;

    const handleStatusUpdate = (payload) => {
      if (!payload?.orderId) return;
      const targetId = String(payload.orderId);
      const ws = payload.workflowStatus;
      const st = payload.status;

      setOrders((prev) =>
        prev.map((ord) => {
          const ordId = String(ord.orderId || ord._id || "");
          if (ordId === targetId || ordId.endsWith(targetId) || targetId.endsWith(ordId)) {
            return {
              ...ord,
              ...payload,
              status: st || (ws ? ws.toLowerCase() : ord.status),
              workflowStatus: ws || ord.workflowStatus,
            };
          }
          return ord;
        }),
      );
    };

    socket.on("order:status:update", handleStatusUpdate);
    return () => {
      socket.off("order:status:update", handleStatusUpdate);
    };
  }, []);

  const initialLoading = loading && orders.length === 0;
  const refreshing = loading && orders.length > 0;

  const filteredOrders = (orders || []).filter((order) => {
    const q = searchQuery.toLowerCase();
    const oid = String(order.orderId ?? order.originalOrderId ?? "");
    const taskType = String(order.taskType ?? "");
    return (
      oid.toLowerCase().includes(q) ||
      taskType.toLowerCase().includes(q) ||
      order.customer?.name?.toLowerCase().includes(q) ||
      order.seller?.shopName?.toLowerCase().includes(q)
    );
  });

  const openOrderDetail = (order) => {
    const id = order.orderId || order.originalOrderId || order.orderMongoId || order._id;
    if (!id) {
      toast.error("Missing order reference");
      return;
    }
    navigate(`/delivery/order-details/${encodeURIComponent(String(id))}`);
  };

  return (
    <div className="bg-[#f1f4f8] min-h-screen pb-24">
      {/* Header */}
      <div 
        style={{
          background: "linear-gradient(180deg, rgba(102, 102, 255, 0.90) 0%, rgba(136, 136, 255, 0.42) 35%, rgba(255, 255, 255, 0.88) 75%, rgba(255, 255, 255, 0.95) 100%)"
        }}
        className="p-4 sticky top-0 z-30 backdrop-blur-md border-b border-[#6666FF]/20 shadow-2xs">
        <h1 className="ds-h2 text-gray-900 mb-4">Order History</h1>

        {/* Search & Filter */}
        <div className="mb-4">
          <div className="relative flex-1 min-w-0">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search Order ID, Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6666FF]/50 transition-all border border-transparent focus:border-[#6666FF]/20"
            />
          </div>
        </div>

        {/* Status Filters */}
        <div className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory">
          {["All", "Delivered", "Cancelled", "Returns"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status.toLowerCase())}
              className={`snap-start h-9 px-4 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${filter === status.toLowerCase()
                ? "bg-[#6666FF] text-white border-transparent shadow-md font-black"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {refreshing && (
          <div className="flex items-center justify-center gap-2 py-1 text-xs font-medium text-[#6666FF]">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#6666FF] border-t-transparent" />
            <span>Updating…</span>
          </div>
        )}
        {initialLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6666FF]"></div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredOrders.length > 0 ? filteredOrders.map((order) => {
              const isReturn = Boolean(order.isReturnTask || order.taskType === "RETURN");
              const statusText = displayOrderStatus(order);
              const dateToDisplay = order.taskDate || order.createdAt;

              return (
                <motion.div
                  key={order._id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}>
                  <Card
                    role="button"
                    tabIndex={0}
                    onClick={() => openOrderDetail(order)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openOrderDetail(order);
                      }
                    }}
                    className="card-left-pill-orange hover:shadow-md transition-all cursor-pointer group rounded-2xl border border-slate-100 bg-white">
                    <div className="p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 min-w-0 flex-wrap">
                            {isReturn ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wider flex items-center gap-1">
                                🔄 Return Task
                              </span>
                            ) : (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider flex items-center gap-1">
                                📦 Forward Delivery
                              </span>
                            )}
                            <span className="font-bold text-[#6666FF] text-sm group-hover:text-[#5555EE] transition-colors break-all">
                              #{order.orderId}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                statusText === "delivered"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : statusText === "returned to store" || statusText === "returned"
                                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                                    : statusText === "cancelled"
                                      ? "bg-red-50 text-red-600 border border-red-100"
                                      : "bg-[#EEEEFF] text-[#6666FF] border border-[#6666FF]/20"
                              }`}>
                              {statusText}
                            </span>
                          </div>
                          <div className="flex items-center text-gray-400 text-xs">
                            <Calendar size={12} className="mr-1" />
                            {new Date(dateToDisplay).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}, {new Date(dateToDisplay).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                          <span className={`block font-black text-lg whitespace-nowrap ${statusText === "cancelled" ? "text-gray-400" : "text-slate-900"}`}>
                            ₹{getOrderEarnings(order)}
                          </span>
                          <span className="ds-caption text-gray-400">
                            {statusText === "cancelled" ? "No Earnings" : "Earnings"}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-3 border border-[#6666FF]/15 shadow-2xs my-3 space-y-2">
                        <div className="flex items-start">
                          <div className="w-2 h-2 rounded-full bg-[#6666FF] mt-1.5 mr-2 flex-shrink-0 shadow-[0_0_8px_rgba(102,102,255,0.5)]"></div>
                          <div>
                            <p className="ds-caption text-gray-500 mb-0.5">
                              {isReturn ? "Pickup (Customer)" : "Store (Pickup)"}
                            </p>
                            <p className="text-sm font-medium text-gray-800 line-clamp-1">
                              {isReturn ? (order.customer?.name || "Customer") : (order.seller?.shopName || "Unknown Store")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start border-t border-[#6666FF]/10 pt-2">
                          <div className="w-2 h-2 rounded-full bg-[#5555EE] mt-1.5 mr-2 flex-shrink-0 shadow-[0_0_8px_rgba(85,85,238,0.5)]"></div>
                          <div>
                            <p className="ds-caption text-gray-500 mb-0.5">
                              {isReturn ? "Drop (Store)" : "Customer (Drop)"}
                            </p>
                            <p className="text-sm font-medium text-gray-800 line-clamp-1">
                              {isReturn ? (order.seller?.shopName || "Store") : (order.customer?.name || "Customer")}
                            </p>
                          </div>
                        </div>
                      </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center text-xs text-gray-500">
                      <div className="flex flex-wrap items-center gap-2">
                        {displayOrderStatus(order) === "cancelled" ? (
                          <span className="flex items-center bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 font-bold text-[11px]">
                            Cancelled Order
                          </span>
                        ) : (
                          <>
                            {getOrderDistanceText(order) && (
                              <span className="flex items-center bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                <MapPin size={12} className="mr-1 text-gray-400" />{" "}
                                {getOrderDistanceText(order)}
                              </span>
                            )}
                            {getOrderDurationText(order) && (
                              <span className="flex items-center bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                <Clock size={12} className="mr-1 text-gray-400" />{" "}
                                {getOrderDurationText(order)}
                              </span>
                            )}
                            <span className="flex items-center bg-gray-50 px-2 py-1 rounded border border-gray-100">
                              <Package size={12} className="mr-1 text-gray-400" />{" "}
                              {(order.items?.length || 1)} {(order.items?.length || 1) === 1 ? "item" : "items"}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center text-[#6666FF] font-bold group-hover:underline self-end sm:self-auto">
                        View Details <ChevronRight size={14} className="ml-0.5" />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          }) : (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter size={32} className="text-gray-400" />
                </div>
                <h3 className="ds-h3 text-gray-900">No Orders Found</h3>
                <p className="text-gray-500 text-sm">Try changing your filters.</p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
      <DeliveryFooter />
    </div>
  );
};

export default OrderHistory;
