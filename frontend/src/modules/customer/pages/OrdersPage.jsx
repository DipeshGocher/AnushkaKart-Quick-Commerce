import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft,
  Search, 
  SlidersHorizontal, 
  ChevronRight, 
  Check, 
  Building2, 
  Package, 
  X, 
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { getOrderStatusLabel, getLegacyStatusFromOrder } from '@/shared/utils/orderStatus';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import PageSkeleton from '@/shared/components/PageSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import AccountDesktopLayout from '../components/layout/AccountDesktopLayout';

// Filter tabs matching user specification and Flipkart style
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'returned', label: 'Returned' },
  { id: 'pending', label: 'Pending' },
  { id: 'cancelled', label: 'Cancelled' },
];

const formatOrderDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = String(d.getDate()).padStart(2, '0');
  if (d.getFullYear() === now.getFullYear()) {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${d.getFullYear()}`;
};

const OrdersPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState('all');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await customerApi.getMyOrders();
        const payload = response?.data;
        const items =
          payload?.result?.items ||
          payload?.results ||
          [];
        setOrders(Array.isArray(items) ? items : []);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // Filtered orders based on selectedTab, searchQuery, and timeFilter
  const filteredOrders = useMemo(() => {
    let list = orders;

    // 1. Tab filter (All, Delivered, Returned, Pending, Cancelled)
    if (selectedTab !== 'all') {
      list = list.filter((order) => {
        const legacy = getLegacyStatusFromOrder(order);
        const rs = order?.returnStatus;
        const hasReturn = rs && rs !== 'none';
        const isRefunded = rs === 'refund_completed' || order.status === 'refunded' || order.isRefunded;

        if (selectedTab === 'delivered') {
          return legacy === 'delivered' && !hasReturn;
        }
        if (selectedTab === 'returned') {
          return hasReturn || isRefunded || legacy === 'returned';
        }
        if (selectedTab === 'pending') {
          return ['pending', 'confirmed', 'packed', 'out_for_delivery', 'created', 'seller_pending', 'seller_accepted', 'delivery_search', 'delivery_assigned', 'pickup_ready'].includes(legacy) && !hasReturn;
        }
        if (selectedTab === 'cancelled') {
          return legacy === 'cancelled';
        }
        return true;
      });
    }

    // 2. Time filter
    if (timeFilter !== 'all') {
      const currentYear = new Date().getFullYear();
      list = list.filter((order) => {
        const orderDate = new Date(order.createdAt);
        const orderYear = orderDate.getFullYear();
        if (timeFilter === 'last30') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return orderDate >= thirtyDaysAgo;
        }
        if (timeFilter === 'currentYear') {
          return orderYear === currentYear;
        }
        if (timeFilter === 'prevYear') {
          return orderYear === currentYear - 1;
        }
        if (timeFilter === 'older') {
          return orderYear < currentYear - 1;
        }
        return true;
      });
    }

    // 3. Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      list = list.filter((o) => {
        const orderIdMatch = o.orderId && o.orderId.toLowerCase().includes(query);
        const itemMatch = o.items && o.items.some((i) => i.name && i.name.toLowerCase().includes(query));
        return orderIdMatch || itemMatch;
      });
    }

    return list;
  }, [orders, selectedTab, timeFilter, searchQuery]);

  if (loading) {
    return <PageSkeleton variant="rows" />;
  }

  const mobileOrdersView = (
    <div className="min-h-screen bg-white font-sans antialiased text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center -ml-1.5 text-slate-900 active:scale-90 transition-transform cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft size={22} className="stroke-[2.2]" />
          </button>
          <h1 className="text-[18px] sm:text-[19px] font-bold text-slate-900 tracking-tight">
            My Orders
          </h1>
        </div>
      </header>

      {/* Search Bar & Filters Button */}
      <section className="px-4 pt-3 pb-2 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search your order..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2 bg-white rounded-xl border border-slate-200/90 text-[14px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <button
          onClick={() => setIsFilterModalOpen(true)}
          className="flex items-center gap-1.5 py-2 px-1 text-[13.5px] sm:text-[14px] font-medium text-slate-800 hover:text-slate-950 transition cursor-pointer shrink-0"
        >
          <SlidersHorizontal size={15} className="text-slate-700 stroke-[2]" />
          <span>Filters</span>
        </button>
      </section>

      {/* Upper Sorting / Filter Pills: All, Delivered, Returned, Pending, Cancelled */}
      <nav className="px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-gray-100">
        {TABS.map((tab) => {
          const isSelected = selectedTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap cursor-pointer select-none",
                isSelected
                  ? "bg-black text-white border border-black shadow-2xs"
                  : "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Orders Listing: Flipkart-Style Rows */}
      <main className="divide-y divide-gray-100 pb-24">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
              <Package size={30} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {searchQuery ? 'No matching orders found' : 'No orders found'}
            </h3>
            <p className="text-slate-500 text-xs sm:text-sm mb-5 max-w-[280px]">
              {searchQuery 
                ? 'Try searching with a different product name or order ID.' 
                : selectedTab !== 'all' 
                ? `You do not have any ${selectedTab} orders.` 
                : 'Start exploring products and place your first order.'
              }
            </p>
            {selectedTab !== 'all' || searchQuery ? (
              <button
                onClick={() => {
                  setSelectedTab('all');
                  setSearchQuery('');
                  setTimeFilter('all');
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-black hover:bg-slate-800 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                <span>Show All Orders</span>
              </button>
            ) : (
              <Link
                to="/"
                className="px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-black hover:bg-slate-800 transition active:scale-95 cursor-pointer"
              >
                Start Shopping
              </Link>
            )}
          </div>
        ) : (
          filteredOrders.map((order) => {
            const legacy = getLegacyStatusFromOrder(order);
            const firstItem = order.items?.[0] || {};
            const remainingCount = (order.items?.length || 1) - 1;
            const formattedDate = formatOrderDate(order.createdAt);
            const rs = order?.returnStatus;
            const isRefundCompleted = rs === 'refund_completed' || order.status === 'refunded' || order.isRefunded;
            const isReturned = rs && rs !== 'none';

            // Status title & subtitle logic matching Flipkart UI reference
            let statusTitle = `Delivered on ${formattedDate}`;
            let statusDesc = firstItem.name || 'Order Item';

            if (isRefundCompleted) {
              statusTitle = 'Refund Completed';
              statusDesc = firstItem.name || 'Order Item';
            } else if (isReturned) {
              statusTitle = getOrderStatusLabel(order);
              statusDesc = firstItem.name || 'Order Item';
            } else if (legacy === 'delivered') {
              statusTitle = `Delivered on ${formattedDate}`;
              statusDesc = firstItem.name || 'Order Item';
            } else if (legacy === 'cancelled') {
              statusTitle = `Cancelled on ${formattedDate}`;
              statusDesc = order.cancelReason || 'Your order was cancelled as per your request';
            } else if (legacy === 'out_for_delivery') {
              statusTitle = 'Out for Delivery';
              statusDesc = firstItem.name || 'Order Item';
            } else if (legacy === 'confirmed' || legacy === 'packed') {
              statusTitle = `Confirmed on ${formattedDate}`;
              statusDesc = firstItem.name || 'Order Item';
            } else {
              statusTitle = `Placed on ${formattedDate}`;
              statusDesc = firstItem.name || 'Order Item';
            }

            return (
              <Link
                to={`/orders/${order.orderId || order._id}`}
                key={order._id || order.orderId}
                className="block bg-white px-4 py-3.5 hover:bg-slate-50/70 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  {/* Left: Product Image Container (#F0F0F0 rounded-xl) */}
                  <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-[12px] bg-[#F0F0F0] flex items-center justify-center shrink-0 overflow-hidden p-1">
                    {firstItem.image ? (
                      <img
                        src={applyCloudinaryTransform(firstItem.image, 'f_auto,q_auto,w_200')}
                        alt={firstItem.name || 'Order Product'}
                        loading="lazy"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Package size={22} className="text-slate-400" />
                    )}
                  </div>

                  {/* Middle: Status & Product Description */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-[14.5px] sm:text-[15px] font-semibold text-slate-900 leading-tight">
                        {statusTitle}
                      </h3>
                      {order.fulfillmentType === "SHIPROCKET" && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          Courier
                        </span>
                      )}
                    </div>
                    <p className="text-[12.5px] sm:text-[13px] text-[#707070] font-normal truncate mt-1 leading-snug">
                      {statusDesc}
                      {remainingCount > 0 && !isRefundCompleted && legacy !== 'cancelled' ? ` + ${remainingCount} more` : ''}
                    </p>
                  </div>

                  {/* Right: Chevron */}
                  <ChevronRight size={17} className="text-slate-800 shrink-0 stroke-[2.2]" />
                </div>

                {/* Refund strip if refunded (matching reference screenshot) */}
                {isRefundCompleted && (
                  <div className="mt-2.5 bg-[#F9F9F9] rounded-lg px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border border-emerald-600 flex items-center justify-center">
                        <Check size={10} className="text-emerald-600 stroke-[3]" />
                      </div>
                      <span className="text-[12.5px] font-medium text-slate-800">
                        Refund of ₹{order.pricing?.total || order.refundAmount || 0}
                      </span>
                    </div>
                    <Building2 size={15} className="text-slate-600" />
                  </div>
                )}
              </Link>
            );
          })
        )}
      </main>
    </div>
  );

  const desktopOrdersContent = (
    <div className="space-y-4">
      {/* Search & Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search your orders here..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => {
            const isSelected = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                  isSelected
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
            <Package size={26} />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {searchQuery ? 'No matching orders found' : 'No orders found'}
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            {searchQuery ? 'Try searching with different keywords' : 'You have not placed any orders yet'}
          </p>
          {selectedTab !== 'all' || searchQuery ? (
            <button
              onClick={() => {
                setSelectedTab('all');
                setSearchQuery('');
                setTimeFilter('all');
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-black hover:bg-slate-800 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>Show All Orders</span>
            </button>
          ) : (
            <Link
              to="/"
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-black hover:bg-slate-800 transition active:scale-95 cursor-pointer"
            >
              Start Shopping
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const legacy = getLegacyStatusFromOrder(order);
            const firstItem = order.items?.[0] || {};
            const remainingCount = (order.items?.length || 1) - 1;
            const formattedDate = formatOrderDate(order.createdAt);
            const totalAmount = order.totalAmount || order.grandTotal || 0;

            return (
              <Link
                to={`/orders/${order.orderId || order._id}`}
                key={order._id || order.orderId}
                className="block bg-white rounded-xl border border-slate-200 hover:border-slate-300 p-4 transition-all hover:shadow-xs group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden p-1.5">
                    {firstItem.image ? (
                      <img
                        src={applyCloudinaryTransform(firstItem.image, 'f_auto,q_auto,w_200')}
                        alt={firstItem.name || 'Product'}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Package size={24} className="text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {firstItem.name || 'Order Item'}
                      {remainingCount > 0 && <span className="text-xs text-slate-400 font-normal"> + {remainingCount} more</span>}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">Order #{order.orderId || String(order._id).slice(-8)}</p>
                    <p className="text-xs font-semibold text-slate-600 mt-1">Total: <span className="font-bold text-slate-900">₹{totalAmount}</span></p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className={cn(
                        "w-2.5 h-2.5 rounded-full shrink-0",
                        legacy === 'delivered' ? "bg-emerald-500" : legacy === 'cancelled' ? "bg-red-500" : "bg-amber-500"
                      )} />
                      <span className="text-xs font-bold text-slate-800 capitalize">
                        {legacy === 'delivered' ? `Delivered on ${formattedDate}` : legacy === 'cancelled' ? 'Cancelled' : legacy}
                      </span>
                      {order.fulfillmentType === "SHIPROCKET" && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 ml-1">
                          Courier
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-blue-600 font-semibold mt-1 group-hover:underline">View Details →</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      <AccountDesktopLayout
        activeTab="orders"
        pageTitle="My Orders"
        mobileContent={mobileOrdersView}
      >
        {desktopOrdersContent}
      </AccountDesktopLayout>

      {/* Filters Modal / Bottom Sheet */}
      <AnimatePresence>
        {isFilterModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-end justify-center"
            onClick={() => setIsFilterModalOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="w-full max-w-md bg-white rounded-t-3xl p-5 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="text-[16px] font-bold text-slate-900">Filters</h4>
                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Status Section */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Order Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedTab(tab.id)}
                      className={cn(
                        "px-3 py-2 rounded-xl text-xs font-medium border text-left transition cursor-pointer",
                        selectedTab === tab.id
                          ? "bg-black text-white border-black"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Time Section */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Order Time
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'all', label: 'Any Time' },
                    { id: 'last30', label: 'Last 30 Days' },
                    { id: 'currentYear', label: `${new Date().getFullYear()}` },
                    { id: 'prevYear', label: `${new Date().getFullYear() - 1}` },
                    { id: 'older', label: 'Older' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTimeFilter(t.id)}
                      className={cn(
                        "px-3 py-2 rounded-xl text-xs font-medium border text-left transition cursor-pointer",
                        timeFilter === t.id
                          ? "bg-black text-white border-black"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setSelectedTab('all');
                    setTimeFilter('all');
                    setSearchQuery('');
                    setIsFilterModalOpen(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default OrdersPage;
