import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Bell, Tag, Camera, TrendingUp, Sparkles, 
  MessageSquare, CheckCheck, ShoppingBag, ShieldCheck, ChevronRight,
  Clock, ArrowDownRight, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  getC2CNotifications, 
  markC2CNotificationAsRead, 
  markAllC2CNotificationsAsRead 
} from '../data/c2cMockData';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MarketplaceNotificationPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'selling', 'buying'

  useEffect(() => {
    setNotifications(getC2CNotifications());
  }, []);

  const handleMarkAllRead = () => {
    const updated = markAllC2CNotificationsAsRead();
    setNotifications(updated);
    toast.success('All notifications marked as read');
  };

  const handleNotificationClick = (item) => {
    const updated = markC2CNotificationAsRead(item.id);
    setNotifications(updated);

    if (item.actionLink) {
      navigate(item.actionLink);
    }
  };

  const sellingCount = useMemo(() => {
    return notifications.filter(n => n.type === 'selling').length;
  }, [notifications]);

  const buyingCount = useMemo(() => {
    return notifications.filter(n => n.type === 'buying').length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'selling') {
      return notifications.filter(n => n.type === 'selling');
    }
    if (activeTab === 'buying') {
      return notifications.filter(n => n.type === 'buying');
    }
    return notifications;
  }, [notifications, activeTab]);

  const getNotificationIcon = (iconType, type) => {
    switch (iconType) {
      case 'tag':
        return <Tag size={18} className="text-amber-600" />;
      case 'camera':
        return <Camera size={18} className="text-[#0F4C81]" />;
      case 'trending':
        return <TrendingUp size={18} className="text-emerald-600" />;
      case 'price-drop':
        return <ArrowDownRight size={18} className="text-rose-600" />;
      case 'message':
        return <MessageSquare size={18} className="text-blue-600" />;
      default:
        return type === 'selling' 
          ? <Package size={18} className="text-[#0F4C81]" />
          : <ShoppingBag size={18} className="text-amber-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-900 font-sans pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 py-3 shadow-2xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-800 transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
            </button>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Bell size={20} className="text-[#0F4C81]" />
              Notifications
            </h1>
          </div>

          {notifications.some(n => n.unread) && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs font-bold text-[#0F4C81] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-3 sm:px-4 pt-3 space-y-3">
        {/* Category Filter Tabs (Selling vs Buying) */}
        <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-2xs flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer",
              activeTab === 'all'
                ? "bg-[#0F4C81] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            All ({notifications.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('selling')}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              activeTab === 'selling'
                ? "bg-[#0F4C81] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Package size={14} />
            <span>Selling ({sellingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('buying')}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              activeTab === 'buying'
                ? "bg-[#0F4C81] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <ShoppingBag size={14} />
            <span>Buying ({buyingCount})</span>
          </button>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length > 0 ? (
          <div className="space-y-2.5">
            {filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={cn(
                  "p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 bg-white shadow-2xs hover:shadow-xs",
                  notif.unread
                    ? "border-[#0F4C81]/30 bg-blue-50/20"
                    : "border-slate-200 opacity-90 hover:opacity-100"
                )}
              >
                {/* Icon Badge */}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs border",
                  notif.type === 'selling' 
                    ? "bg-amber-50 border-amber-200" 
                    : "bg-blue-50 border-blue-200"
                )}>
                  {getNotificationIcon(notif.icon, notif.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
                        notif.type === 'selling' 
                          ? "bg-amber-100 text-amber-800" 
                          : "bg-blue-100 text-[#0F4C81]"
                      )}>
                        {notif.type}
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {notif.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-slate-400">
                      <Clock size={11} />
                      <span>{notif.time}</span>
                      {notif.unread && (
                        <span className="w-2 h-2 rounded-full bg-[#0F4C81] ml-0.5" />
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mt-1">
                    {notif.message}
                  </p>

                  {notif.actionLink && (
                    <div className="mt-2.5 flex items-center gap-1 text-xs font-bold text-[#0F4C81] hover:underline">
                      <span>View details</span>
                      <ChevronRight size={13} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-3 shadow-2xs my-6">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Bell size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                No {activeTab !== 'all' ? activeTab : ''} notifications
              </h3>
              <p className="text-xs text-slate-500">
                Updates regarding your listings, price changes, and messages will appear here.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MarketplaceNotificationPage;
