import React, { useState, useEffect } from "react";
import {
  Bell,
  Star,
  TrendingUp,
  Package,
  MapPin,
  CheckCircle,
  XCircle,
  IndianRupee,
  AlertCircle,
  Home,
  CheckSquare,
  UserX,
  Sun,
  Flame,
  ChevronRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";

import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { deliveryApi } from "../services/deliveryApi";
import DeliveryFooter from "../components/DeliveryFooter";
import Lottie from "lottie-react";
import deliveryRidingAnimation from "@/assets/lottie/Ey2fgNNOKZ.json";
import OrderOfferModal from "../components/OrderOfferModal";
import { getOrderSocket } from "@core/services/orderSocket";
import { createSocketTokenReader } from "@core/utils/authStorage";
import { STORAGE_KEYS } from "@core/utils/storageKeys";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { settings } = useSettings();
  const [isOnline, setIsOnline] = useState(user?.isOnline || false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState("delivery"); // 'delivery' or 'return'
  const [availableOrders, setAvailableOrders] = useState([]);
  const [checkinStatus, setCheckinStatus] = useState(null);
  const [pendingOffer, setPendingOffer] = useState(null); // active queue order offer
  const [earnings, setEarnings] = useState({
    today: 0,
    deliveries: 0,
    pendingDeliveries: 0,
    cancelledDeliveries: 0,
    incentives: 0,
    cashCollected: 0,
  });

  // Sync isOnline with user profile from context
  useEffect(() => {
    if (user) {
      setIsOnline(user.isOnline);
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const response = await deliveryApi.getStats();
      if (response.data.success) {
        console.log("Stats Fetched:", response.data.result);
        setEarnings((prev) => ({
          ...prev,
          ...response.data.result,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch statistics:", error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await deliveryApi.getNotifications();
      if (response.data.success && response.data.result) {
        setUnreadCount(response.data.result.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications");
    }
  };

  const fetchAvailableOrders = async () => {
    try {
      const response = await deliveryApi.getAvailableOrders({ type: activeTab });
      if (response.data.success) {
        let fetchedOrders = [];
        if (Array.isArray(response.data.results)) fetchedOrders = response.data.results;
        else if (Array.isArray(response.data.result)) fetchedOrders = response.data.result;
        else if (response.data.result && Array.isArray(response.data.result.orders)) {
          fetchedOrders = response.data.result.orders;
        }
        setAvailableOrders(fetchedOrders);
      }
    } catch (error) {
      console.error("Failed to fetch available orders:", error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchNotifications();
    fetchCheckinStatus();
    if (isOnline) fetchAvailableOrders();
  }, [isOnline, activeTab]);

  // Fetch warehouse check-in status
  const fetchCheckinStatus = async () => {
    try {
      const res = await deliveryApi.getCheckinStatus();
      setCheckinStatus(res.data?.data);
    } catch { /* non-fatal */ }
  };

  // Listen for queue order offers from socket
  useEffect(() => {
    const getToken = createSocketTokenReader(STORAGE_KEYS.AUTH_DELIVERY);
    const socket = getOrderSocket(getToken);
    if (!socket) return;
    const handleOffer = (offer) => {
      toast.info(`📦 New order offered! You have 5 minutes to respond`);
      setPendingOffer(offer);
    };
    const handleExpired = () => {
      setPendingOffer(null);
      toast.warning("Order offer expired — moving to next rider");
    };
    const handleBroadcast = (payload) => {
      if (payload.type === "RETURN_PICKUP") {
        toast.info(`📦 New Return Pickup available!`);
        setPendingOffer({
          ...payload,
          countdown: 300,
          isReturn: true,
        });
      } else {
        toast.info(`📦 New delivery order available!`);
        setPendingOffer({
          ...payload,
          countdown: 300,
          isReturn: false,
        });
      }
    };
    
    socket.on("queue:order_offered", handleOffer);
    socket.on("queue:order_offer_expired", handleExpired);
    socket.on("delivery:broadcast", handleBroadcast);
    return () => {
      socket.off("queue:order_offered", handleOffer);
      socket.off("queue:order_offer_expired", handleExpired);
      socket.off("delivery:broadcast", handleBroadcast);
    };
  }, []);

  const handleOfferAccept = async (orderId) => {
    if (pendingOffer?.isReturn) {
      await handleAcceptReturn(orderId);
      setPendingOffer(null);
    } else if (pendingOffer?.countdown) {
      if (pendingOffer.warehouseId) {
        // Queue assignment response
        const getToken = createSocketTokenReader(STORAGE_KEYS.AUTH_DELIVERY);
        const socket = getOrderSocket(getToken);
        socket?.emit("queue:offer_response", { orderId, accepted: true });
        setPendingOffer(null);
        toast.success("Order accepted! Preparing for pickup...");
        navigate(`/delivery/order-details/${orderId}`);
      } else {
        // Broadcast fallback accept
        acceptOrder(orderId);
      }
    }
  };

  const handleOfferReject = (reason) => {
    if (pendingOffer?.isReturn) {
      setPendingOffer(null);
      if (reason !== "timeout") toast.info("Return skipped.");
    } else {
      if (pendingOffer?.orderId) {
        const getToken = createSocketTokenReader(STORAGE_KEYS.AUTH_DELIVERY);
        const socket = getOrderSocket(getToken);
        socket?.emit("queue:offer_response", { orderId: pendingOffer.orderId, accepted: false });
      }
      setPendingOffer(null);
      if (reason !== "timeout") toast.info("Order declined.");
    }
  };

  const handleOnlineToggle = async () => {
    const newStatus = !isOnline;
    try {
      await deliveryApi.updateProfile({ isOnline: newStatus });
      await refreshUser(); // Refresh global auth state
      setIsOnline(newStatus);
      if (newStatus) {
        toast.success("You are now ONLINE. Finding orders...");
      } else {
        toast.info("You are now OFFLINE. No new orders.");
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleAcceptReturn = async (orderId) => {
    try {
      const response = await deliveryApi.acceptReturnPickup(orderId);
      if (response.data.success) {
        toast.success("Return pickup accepted!");
        fetchAvailableOrders();
        // Option: navigate to details
        navigate(`/delivery/order-details/${orderId}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to accept return");
    }
  };

  return (
    <div className="bg-[#f1f4f8] min-h-screen pb-24 font-sans">
      {/* Queue Order Offer Modal */}
      {pendingOffer && (
        <OrderOfferModal
          offer={pendingOffer}
          onAccept={handleOfferAccept}
          onReject={handleOfferReject}
        />
      )}
      {/* Header */}
      <header
        style={{
          background: "linear-gradient(180deg, rgba(255, 87, 34, 0.90) 0%, rgba(255, 112, 67, 0.42) 35%, rgba(255, 255, 255, 0.88) 75%, rgba(255, 255, 255, 0.95) 100%)"
        }}
        className="px-6 pt-12 pb-4 flex justify-between items-center sticky top-0 z-30 transition-all duration-300 border-b border-orange-200/50 shadow-2xs backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <img src={settings?.logoUrl || "/logo.png"} alt="Logo" className="h-8 object-contain drop-shadow-xs" />
          <h1 className="text-lg font-bold text-gray-900 tracking-tight ml-1">{user?.name || "Delivery Partner"}</h1>
        </div>
        <div
          className="relative p-2.5 bg-white/90 border border-orange-200/60 rounded-full hover:bg-white transition-colors cursor-pointer group shadow-2xs"
          onClick={() => navigate("/delivery/notifications")}>
          <Bell
            size={20}
            className="text-gray-700 group-hover:text-[#FF5722] transition-colors"
          />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
          )}
        </div>
      </header>

      {/* Online/Offline Toggle */}
      <div className="px-6 py-4">
        <div className="bg-white rounded-2xl p-3.5 flex justify-between items-center border border-orange-200/80 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isOnline ? "bg-[#FF5722]/10 text-[#FF5722]" : "bg-gray-100 text-gray-400"}`}>
              {isOnline ? <Sun size={20} strokeWidth={2.5} /> : <XCircle size={20} strokeWidth={2.5} />}
            </div>
            <span className={`text-sm font-bold ${isOnline ? "text-[#FF5722]" : "text-gray-500"}`}>
              {isOnline ? "You are Online" : "You are Offline"}
            </span>
          </div>
          
          <button 
            onClick={handleOnlineToggle}
            className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ease-in-out flex items-center ${isOnline ? 'bg-[#FF5722] shadow-sm' : 'bg-gray-300'}`}
          >
            <motion.div 
              className="w-6 h-6 bg-white rounded-full shadow-md"
              animate={{ x: isOnline ? 24 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </div>


      {/* Tabs */}
      <div className="px-6 mb-2">
        <div className="bg-gray-100/80 p-1.5 rounded-2xl flex gap-1 border border-gray-200/80">
          <button
            onClick={() => setActiveTab("delivery")}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl text-center text-xs font-black transition-all duration-300 uppercase tracking-widest",
              activeTab === "delivery"
                ? "bg-[#FF5722] text-white shadow-md"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
            )}
          >
            Deliveries
          </button>
          <button
            onClick={() => setActiveTab("return")}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl text-center text-xs font-black transition-all duration-300 uppercase tracking-widest",
              activeTab === "return"
                ? "bg-[#FF5722] text-white shadow-md"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
            )}
          >
            Returns
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 space-y-5">
        {/* Earnings Card */}
        <div className="bg-gradient-to-br from-[#FF5722] via-[#EA580C] to-[#C2410C] rounded-[24px] p-5 shadow-xl relative overflow-hidden text-white flex justify-between border border-white/20">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full -ml-16 -mb-16 blur-lg"></div>

          <div className="relative z-10 flex-1">
            <h3 className="text-xs font-bold text-white/90 uppercase tracking-wider mb-2">
              Today's Earnings
            </h3>

            <div className="mb-2">
              <span className="text-[2.2rem] font-black tracking-tight leading-none">
                ₹{earnings.today?.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center text-[10px] font-bold text-yellow-200 mb-5">
              <Flame size={13} className="mr-1 fill-yellow-300 text-yellow-300" /> 5% more than yesterday
            </div>

            <button 
              onClick={() => navigate("/delivery/earnings")}
              className="text-xs font-extrabold text-white hover:text-orange-100 transition-colors flex items-center bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full w-fit shadow-sm border border-white/25"
            >
              View Details <ChevronRight size={14} className="ml-1" />
            </button>
          </div>

          <div className="relative z-10 flex flex-col items-end justify-between shrink-0 ml-4">
            <span className="text-white bg-white/25 text-[10px] font-black flex items-center px-2.5 py-1 rounded-full border border-white/30 backdrop-blur-md mb-2 shadow-2xs">
              <TrendingUp size={12} className="mr-1 text-white" /> +12% ⇧
            </span>
            <div className="w-[80px] h-[70px] mt-auto">
                <img 
                    src="/wallet iamge .png" 
                    alt="Wallet" 
                    className="w-full h-full object-contain drop-shadow-md opacity-95"
                />
            </div>
          </div>
        </div>

        {/* Orders Summary Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-slate-200/70 flex flex-col items-center justify-between">
            <p className="text-[10px] font-black text-gray-700 uppercase tracking-wider mb-2">Completed</p>
            <div className="flex justify-center mb-1 text-[#FF5722] bg-orange-50 rounded-xl p-2">
              <CheckSquare size={20} strokeWidth={2.5} />
            </div>
            <p className="text-xl font-black text-gray-900 mb-0.5">{earnings.deliveries}</p>
            <p className="text-[10px] text-gray-400 font-bold">Orders</p>
          </div>
          
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-slate-200/70 flex flex-col items-center justify-between">
            <p className="text-[10px] font-black text-gray-700 uppercase tracking-wider mb-2">Pending</p>
            <div className="flex justify-center mb-1 text-amber-600 bg-amber-50 rounded-xl p-2">
              <Package size={20} strokeWidth={2.5} />
            </div>
            <p className="text-xl font-black text-gray-900 mb-0.5">{earnings.pendingDeliveries || 0}</p>
            <p className="text-[10px] text-gray-400 font-bold">Orders</p>
          </div>
          
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-slate-200/70 flex flex-col items-center justify-between">
            <p className="text-[10px] font-black text-gray-700 uppercase tracking-wider mb-2">Cancelled</p>
            <div className="flex justify-center mb-1 text-slate-500 bg-slate-100 rounded-xl p-2">
              <UserX size={20} strokeWidth={2.5} />
            </div>
            <p className="text-xl font-black text-gray-900 mb-0.5">{earnings.cancelledDeliveries || 0}</p>
            <p className="text-[10px] text-gray-400 font-bold">Orders</p>
          </div>
        </div>

        {/* Incentive Zone (Tips) */}
        <div className="bg-gradient-to-r from-orange-50/80 via-amber-50/60 to-orange-50/80 rounded-[20px] p-4 border border-orange-200/50 shadow-sm flex items-center justify-between overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-full -mr-16 -mt-16 blur-xl"></div>
          
          <div className="relative z-10 pl-2">
            <h3 className="text-[#FF5722] font-black text-sm mb-1 uppercase tracking-tight">Customer Tips</h3>
            <p className="text-[11px] text-gray-600 font-medium leading-tight max-w-[140px]">
              You have earned an extra <br/><span className="font-extrabold text-[#FF5722] text-sm">₹{earnings.incentiveData?.tipsReceived || 0}</span> in tips today
            </p>
          </div>
          
          <div className="relative z-10 w-[100px] h-[90px] shrink-0 flex items-center justify-center -mr-2">
            <img src="/tip image.png" alt="Tips Received" className="w-full h-full object-contain drop-shadow-sm" />
          </div>
        </div>

        {/* Active Order / Status */}
        <AnimatePresence mode="wait">
          {!isOnline ? (
            <motion.div
              key="offline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-100">
                <AlertCircle size={32} className="text-gray-400" />
              </div>
              <h3 className="ds-h3 mb-2">You are Offline</h3>
              <p className="text-sm text-gray-500 max-w-[250px] mx-auto">
                Go online to start receiving delivery requests and earning
                money.
              </p>
            </motion.div>
          ) : activeTab === 'delivery' ? (
            availableOrders.length > 0 ? (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 border-2 border-[#FF5722]/30 shadow-md shadow-[#FF5722]/10 text-center">
                <div className="flex justify-center mb-3">
                  <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center border border-orange-100">
                    <Package className="text-[#FF5722]" size={24} />
                  </div>
                </div>
                <h3 className="ds-h3 text-gray-900 mb-1 font-extrabold">
                  {availableOrders.length === 1
                    ? "1 order waiting"
                    : `${availableOrders.length} orders waiting`}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed px-1">
                  A fullscreen alert will open with <strong>Accept</strong> and{" "}
                  <strong>Reject</strong>. Use that to respond before the timer
                  ends.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <span className="w-2 h-2 bg-[#FF5722] rounded-full animate-pulse" />
                  Listening for assignments
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="searching"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-gray-200 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-50/50 to-purple-50/50 opacity-50"></div>
                <div className="relative z-10">
                  <div className="relative w-40 h-40 mx-auto mb-2 flex items-center justify-center">
                    <Lottie animationData={deliveryRidingAnimation} loop={true} />
                  </div>
                  <h3 className="ds-h3 mb-2 text-gray-800">
                    Finding Orders Nearby...
                  </h3>
                  <p className="text-sm text-gray-500 max-w-[220px] mx-auto mb-6">
                    We're looking for delivery requests in your area. Stay
                    online!
                  </p>
                </div>
              </motion.div>
            )
          ) : (
            <motion.div
              key="returns-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-bold text-gray-800 tracking-tight">Available Return Pickups</h3>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase italic">Open for Acceptance</span>
              </div>
              {availableOrders.length > 0 ? (
                availableOrders.map((order) => (
                  <Card key={order._id} className="p-4 border-2 border-primary/5 hover:border-primary/20 transition-all shadow-sm card-left-pill-orange">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-1 block">Return Task</span>
                        <h4 className="font-bold text-gray-900">#{order.orderId}</h4>
                      </div>
                      <div className="text-right">
                        <span className="block font-black text-brand-600 text-lg">₹{order.returnDeliveryCommission || 0}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Commission</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-5">
                      <div className="flex items-center text-xs text-gray-600">
                        <MapPin size={12} className="mr-2 text-gray-400" />
                        <span className="truncate">{order.seller?.shopName || "Store"}</span>
                      </div>
                      <div className="flex items-center text-[11px] text-gray-500 font-medium">
                        <Package size={12} className="mr-2 text-gray-400" />
                        <span>Pickup from Customer & Return to Store</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                       <Button 
                        variant="primary" 
                        size="sm" 
                        className="flex-1 font-black text-[10px] tracking-widest uppercase h-10 shadow-lg shadow-primary/20"
                        onClick={() => handleAcceptReturn(order.orderId)}
                      >
                        Accept Pickup
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="px-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 hover:bg-gray-100 h-10"
                        onClick={() => navigate(`/delivery/order-details/${order.orderId}`)}
                      >
                        View
                      </Button>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-gray-100 flex flex-col items-center">
                  <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100 opacity-60">
                    <Package size={20} className="text-gray-400" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-800 mb-1">No returns nearby</h4>
                  <p className="text-[11px] text-gray-400">Keep checking back for new return tasks.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <DeliveryFooter />
    </div>
  );
};

export default Dashboard;
