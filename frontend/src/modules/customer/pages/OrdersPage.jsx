import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Package, ChevronRight, CheckCircle2, Loader2, ChevronLeft, 
  Search, SlidersHorizontal, ShoppingBag, 
  X, RotateCcw, AlertCircle, Clock
} from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { getOrderStatusLabel, getLegacyStatusFromOrder } from '@/shared/utils/orderStatus';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

const PROMO_BANNERS = [
  {
    id: 1,
    badge: 'SUPER SAVINGS',
    title: 'Get 10% Extra Savings',
    subtitle: 'On your next Grocery & Daily Essentials order',
    bg: 'from-orange-600 via-amber-600 to-slate-900',
    btnText: 'Shop Deals',
    link: '/offers'
  }
];

const OrdersPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

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

  // Counts
  const counts = useMemo(() => {
    return {
      all: orders.length,
    };
  }, [orders]);

  // Filtered orders based on search query
  const filteredOrders = useMemo(() => {
    let list = orders;

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      list = list.filter((o) => {
        const orderIdMatch = o.orderId && o.orderId.toLowerCase().includes(query);
        const itemMatch = o.items && o.items.some((i) => i.name && i.name.toLowerCase().includes(query));
        return orderIdMatch || itemMatch;
      });
    }

    return list;
  }, [orders, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white font-sans">
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white shadow-md border border-slate-100">
          <Loader2 className="animate-spin text-orange-600" size={24} />
          <span className="text-sm font-semibold text-slate-700">Loading your orders…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f4f8] pb-24 font-sans antialiased text-slate-900">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1 cursor-pointer"
          >
            <ChevronLeft size={24} className="text-slate-800" />
          </button>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">My Orders</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-3.5 sm:px-4 pt-3 space-y-3.5">
        {/* Flipkart Promo Banner Carousel */}
        {PROMO_BANNERS.length > 0 && (
          <div className="relative rounded-2xl overflow-hidden shadow-sm border border-slate-200/60 bg-gradient-to-r p-4 sm:p-5 text-white transition-all bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-950">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1 max-w-[70%]">
                <span className="inline-block bg-amber-400 text-slate-950 font-black text-[10px] uppercase px-2 py-0.5 rounded-full tracking-wider">
                  {PROMO_BANNERS[activeBannerIdx].badge}
                </span>
                <h3 className="font-extrabold text-base sm:text-lg leading-tight text-white tracking-tight">
                  {PROMO_BANNERS[activeBannerIdx].title}
                </h3>
                <p className="text-xs text-slate-300 font-medium line-clamp-1">
                  {PROMO_BANNERS[activeBannerIdx].subtitle}
                </p>
              </div>
              <button
                onClick={() => navigate(PROMO_BANNERS[activeBannerIdx].link)}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap"
              >
                {PROMO_BANNERS[activeBannerIdx].btnText} →
              </button>
            </div>

            {/* Carousel Dots */}
            <div className="flex justify-center gap-1.5 mt-3">
              {PROMO_BANNERS.map((b, idx) => (
                <button
                  key={b.id}
                  onClick={() => setActiveBannerIdx(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    activeBannerIdx === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search your order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-white rounded-xl border border-slate-200/90 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 shadow-2xs transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button
            onClick={() => setSearchQuery('')}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200/90 rounded-xl text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer shrink-0"
          >
            <SlidersHorizontal size={14} className="text-slate-600" />
            <span>Filters</span>
          </button>
        </div>

        {/* Orders List */}
        <div className="space-y-3 pt-1">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Package size={32} className="text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                {searchQuery ? 'No matching orders found' : 'No orders yet'}
              </h3>
              <p className="text-slate-500 text-xs sm:text-sm mb-5 max-w-[280px]">
                {searchQuery 
                  ? 'Try searching with a different product name or order ID.' 
                  : 'Start shopping your favorite groceries and everyday essentials.'
                }
              </p>
              <Link
                to="/"
                className="px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all text-white cursor-pointer bg-orange-600 hover:bg-orange-700"
              >
                Shop Groceries
              </Link>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const legacy = getLegacyStatusFromOrder(order);
              const firstItem = order.items?.[0] || {};
              const remainingCount = (order.items?.length || 1) - 1;
              const formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',
              });

              // Status line text & color like Flipkart
              let statusText = `Placed on ${formattedDate}`;
              let statusDotColor = 'bg-amber-500';

              if (legacy === 'delivered') {
                statusText = `Delivered on ${formattedDate}`;
                statusDotColor = 'bg-emerald-600';
              } else if (legacy === 'cancelled') {
                statusText = `Cancelled on ${formattedDate}`;
                statusDotColor = 'bg-rose-500';
              } else if (legacy === 'out_for_delivery') {
                statusText = 'Out for Delivery';
                statusDotColor = 'bg-blue-600';
              } else if (legacy === 'confirmed') {
                statusText = `Confirmed on ${formattedDate}`;
                statusDotColor = 'bg-orange-500';
              }

              return (
                <Link
                  to={`/orders/${order.orderId}`}
                  key={order._id || order.orderId}
                  className="block bg-white rounded-2xl p-4 shadow-2xs border border-slate-200/80 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    {/* Left: Product Image Box */}
                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                      {firstItem.image ? (
                        <img
                          src={applyCloudinaryTransform(firstItem.image)}
                          alt={firstItem.name || 'Order product'}
                          loading="lazy"
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <Package size={24} className="text-slate-400" />
                      )}
                    </div>

                    {/* Middle: Content */}
                    <div className="flex-1 min-w-0">
                      {/* Status Line with Dot */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`w-2 h-2 rounded-full ${statusDotColor} shrink-0`} />
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight truncate">
                          {statusText}
                        </h4>
                      </div>

                      {/* Product Name */}
                      <p className="text-xs text-slate-600 font-medium line-clamp-1 leading-snug">
                        {firstItem.name || 'Order Item'}
                        {remainingCount > 0 ? ` + ${remainingCount} more item${remainingCount > 1 ? 's' : ''}` : ''}
                      </p>

                      {/* Section & Total Meta Line */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200/70 text-[10.5px] font-extrabold px-2 py-0.5 rounded-md">
                          <ShoppingBag size={10} className="text-orange-600" />
                          Grocery
                        </span>

                        <span className="text-slate-300 text-xs">•</span>
                        <span className="text-xs font-bold text-slate-900">
                          ₹{order.pricing?.total || 0}
                        </span>
                        <span className="text-slate-300 text-xs">•</span>
                        <span className="text-[11px] font-medium text-slate-500">
                          #{order.orderId?.slice(-6)}
                        </span>
                      </div>
                    </div>

                    {/* Right: Chevron */}
                    <div className="shrink-0 pl-1 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all">
                      <ChevronRight size={18} />
                    </div>
                  </div>

                  {/* Refund/Return info strip if order was refunded or returned */}
                  {order.returnStatus && order.returnStatus !== 'none' && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50 -mx-4 -mb-4 px-4 py-2 rounded-b-2xl">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                        <CheckCircle2 size={13} />
                        <span>Return {order.returnStatus}</span>
                      </div>
                      <span className="text-slate-500 font-semibold text-[11px]">
                        Ref: #{order.orderId?.slice(-6)}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;
