import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Share2, ChevronRight, Users, Heart, 
  Settings, HelpCircle, Phone, Mail, Edit3, Lock, 
  LogOut, Trash2, X, Check, Eye, EyeOff, Smartphone, Bell, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getC2CAds, getC2CFavorites, getC2CChats } from '../../data/c2cMockData';
import { useAuth } from '@core/context/AuthContext';
import { customerApi } from '../../services/customerApi';
import { toast } from 'sonner';

const C2CAccountPage = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();

  // User active listings state
  const [userAds, setUserAds] = useState([]);

  useEffect(() => {
    try {
      const ads = getC2CAds();
      const myAds = ads.filter(a => a.isUserAd || a.seller?.id === 'seller-user' || a.id === 'c2c-1');
      setUserAds(myAds);
    } catch {
      // fallback
    }
  }, []);

  // Modals for settings
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showCommunicationModal, setShowCommunicationModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showLogoutAllModal, setShowLogoutAllModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // C2C Independent Settings (stored separately for C2C section)
  const [c2cNotifications, setC2cNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('c2c_settings_notifications');
      return saved ? JSON.parse(saved) : {
        recommendations: true,
        specialOffers: true,
        chatAlerts: true,
        priceDrops: true
      };
    } catch {
      return { recommendations: true, specialOffers: true, chatAlerts: true, priceDrops: true };
    }
  });

  const [c2cCommPreferences, setC2cCommPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('c2c_settings_comm_preferences');
      return saved ? JSON.parse(saved) : {
        inAppChat: true,
        phoneCalls: true,
        whatsapp: false
      };
    } catch {
      return { inAppChat: true, phoneCalls: true, whatsapp: false };
    }
  });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);

  // Save C2C Independent Notification Settings
  const toggleNotification = (key) => {
    const updated = { ...c2cNotifications, [key]: !c2cNotifications[key] };
    setC2cNotifications(updated);
    localStorage.setItem('c2c_settings_notifications', JSON.stringify(updated));
    toast.success('C2C notification preference updated');
  };

  // Save C2C Communication Preferences
  const toggleCommPreference = (key) => {
    const updated = { ...c2cCommPreferences, [key]: !c2cCommPreferences[key] };
    setC2cCommPreferences(updated);
    localStorage.setItem('c2c_settings_comm_preferences', JSON.stringify(updated));
    toast.success('C2C communication preference updated');
  };

  const displayName = user?.name || 'Dipesh';

  return (
    <div className="min-h-screen bg-white pb-32 text-slate-900 font-sans selection:bg-[#0F4C81]/15">
      {/* Top Header Bar matching Image 2 ("My Account") */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-3.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/marketplace')}
          className="p-1 -ml-1 rounded-full text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Back to Marketplace"
        >
          <ArrowLeft size={22} strokeWidth={2.4} />
        </button>

        <h1 className="text-base sm:text-lg font-bold text-slate-950">
          My Account
        </h1>

        <div className="w-8" />
      </header>

      <div className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* Section 1: My Profile Header Row */}
        <section className="space-y-2.5">
          <div className="px-1">
            <span className="text-sm font-semibold text-slate-500">
              My Profile
            </span>
          </div>

          {/* Profile Card (Clickable -> routes to /marketplace/profile) */}
          <div
            onClick={() => navigate('/marketplace/profile')}
            className="w-full bg-white rounded-2xl border border-amber-300/80 p-3.5 sm:p-4 flex items-center gap-3.5 shadow-2xs hover:border-amber-400 hover:shadow-xs transition-all cursor-pointer select-none"
          >
            <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0 border-2 border-amber-400/80 p-0.5 bg-amber-50">
              {user?.avatar || user?.profileImage ? (
                <img
                  src={user.avatar || user.profileImage}
                  alt={displayName}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#0F4C81] to-[#0A365C] text-white flex items-center justify-center text-xl font-black">
                  {displayName[0]?.toUpperCase() || 'D'}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-950 truncate leading-tight">
                {displayName}
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                Tap to view full profile & details
              </span>
            </div>

            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </div>
        </section>

        {/* Section 2: Account Menu Options */}
        <section className="bg-white rounded-2xl divide-y divide-slate-100/80">
          {/* 1. My Listings */}
          <button
            type="button"
            onClick={() => navigate('/marketplace/my-listings')}
            className="w-full py-3.5 px-1 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-[#0F4C81] shrink-0">
                <Package size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    My Listings
                  </h3>
                  <span className="bg-blue-100 text-[#0F4C81] text-[10px] font-black px-2 py-0.5 rounded-full">
                    {userAds.length} {userAds.length === 1 ? 'Product' : 'Products'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Products you listed for sale and their details
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>

          {/* 2. My Network */}
          <button
            type="button"
            onClick={() => toast.info('Network feature: 0 Followers • 0 Following')}
            className="w-full py-3.5 px-1 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 group-hover:text-[#0F4C81] shrink-0">
                <Users size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  My Network
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Followers, following and find friends
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>

          {/* 3. Wishlist */}
          <button
            type="button"
            onClick={() => navigate('/marketplace/wishlist')}
            className="w-full py-3.5 px-1 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 group-hover:text-rose-600 shrink-0">
                <Heart size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  Wishlist
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  View your liked items here
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>

          {/* 4. Settings */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="w-full py-3.5 px-1 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 group-hover:text-[#0F4C81] shrink-0">
                <Settings size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  Settings
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Privacy and logout
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>

          {/* 5. Help and Support */}
          <button
            type="button"
            onClick={() => navigate('/help')}
            className="w-full py-3.5 px-1 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 group-hover:text-[#0F4C81] shrink-0">
                <HelpCircle size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  Help and Support
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  FAQs, safety tips & live chat
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>
        </section>

        {/* Thin Divider Line */}
        <hr className="border-slate-200" />

        {/* Section 3: At the end, "Start selling" graphic matching Image 3 */}
        <section className="pt-2 pb-6">
          <div className="flex flex-col items-center justify-center text-center py-4 px-4 space-y-4">
            {/* Bicycle and colorful 3D shapes graphic matching Image 3 */}
            <div className="relative w-44 h-32 flex items-center justify-center">
              {/* House roof & blocks */}
              <div className="absolute top-1 w-10 h-10 bg-amber-400 rounded-sm rotate-45 flex items-center justify-center shadow-sm" />
              <div className="absolute top-3 w-7 h-7 bg-slate-900 rounded-sm shadow-xs" />
              <div className="absolute top-5 right-9 w-10 h-14 bg-cyan-400 rounded-md -rotate-12 shadow-sm" />

              {/* Bicycle wheels and frame */}
              <div className="absolute bottom-2 flex items-center gap-6 z-10">
                <div className="w-12 h-12 rounded-full border-4 border-slate-900 bg-white shadow-sm flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-slate-900 bg-white shadow-sm flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                </div>
              </div>
              <div className="absolute bottom-8 w-16 h-1 bg-blue-600 z-10 rotate-12" />
              <div className="absolute bottom-7 left-16 w-1 bg-blue-600 h-8 z-10" />
            </div>

            <div className="space-y-1 max-w-xs">
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                You haven't listed anything yet
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Let go of what you don't use anymore
              </p>
            </div>

            {/* Start Selling Button matching Image 3 */}
            <button
              type="button"
              onClick={() => navigate('/marketplace/sell')}
              className="px-8 py-2.5 rounded-md bg-[#0F4C81] hover:bg-[#0A365C] active:scale-95 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
            >
              Start selling
            </button>
          </div>
        </section>
      </div>

      {/* Settings Modal Drawer */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900">Settings</h3>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {/* Notifications */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    setShowNotificationsModal(true);
                  }}
                  className="w-full py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
                >
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Notifications</h4>
                    <p className="text-xs text-slate-500">Recommendations & special alerts</p>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </button>

                {/* Communication Preferences */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    setShowCommunicationModal(true);
                  }}
                  className="w-full py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
                >
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Communication Preferences</h4>
                    <p className="text-xs text-slate-500">Chat, calls & buyer messages</p>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </button>

                {/* Privacy & Password */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    setShowPrivacyModal(true);
                  }}
                  className="w-full py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
                >
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Privacy</h4>
                    <p className="text-xs text-slate-500">Change password & credentials</p>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </button>

                {/* Logout */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    setShowLogoutModal(true);
                  }}
                  className="w-full py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
                >
                  <h4 className="text-sm font-bold text-slate-900">Logout</h4>
                  <ChevronRight size={18} className="text-slate-400" />
                </button>

                {/* Logout from all devices */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    setShowLogoutAllModal(true);
                  }}
                  className="w-full py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
                >
                  <h4 className="text-sm font-bold text-slate-900">Logout from all devices</h4>
                  <ChevronRight size={18} className="text-slate-400" />
                </button>

                {/* Delete Account */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    setShowDeleteModal(true);
                  }}
                  className="w-full py-3 flex items-center justify-between hover:bg-red-50/50 transition-colors text-left text-red-600 cursor-pointer"
                >
                  <h4 className="text-sm font-bold">Delete account</h4>
                  <ChevronRight size={18} className="text-red-400" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications Modal */}
      <AnimatePresence>
        {showNotificationsModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900">Notification Settings</h3>
                <button onClick={() => setShowNotificationsModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'recommendations', title: 'Recommendations', desc: 'Personalized ads based on your search & browsing' },
                  { key: 'specialOffers', title: 'Special Offers', desc: 'Promotions and festive sale deals' },
                  { key: 'chatAlerts', title: 'Chat & Message Alerts', desc: 'Instant push notifications for owner/buyer messages' },
                  { key: 'priceDrops', title: 'Price Drop Alerts', desc: 'Notifies when items in your Wishlist get discounted' }
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="pr-3">
                      <h5 className="text-xs font-bold text-slate-900">{item.title}</h5>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNotification(item.key)}
                      className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer ${
                        c2cNotifications[item.key] ? 'bg-[#0F4C81]' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                        c2cNotifications[item.key] ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Communication Preferences Modal */}
      <AnimatePresence>
        {showCommunicationModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900">Communication Preferences</h3>
                <button onClick={() => setShowCommunicationModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'inAppChat', title: 'In-App Chat', desc: 'Allow buyers to start chats on your active listings' },
                  { key: 'phoneCalls', title: 'Direct Phone Calls', desc: 'Display call button to verified buyers' },
                  { key: 'whatsapp', title: 'WhatsApp Inquiries', desc: 'Receive quick bargain requests via WhatsApp' }
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="pr-3">
                      <h5 className="text-xs font-bold text-slate-900">{item.title}</h5>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCommPreference(item.key)}
                      className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer ${
                        c2cCommPreferences[item.key] ? 'bg-[#0F4C81]' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                        c2cCommPreferences[item.key] ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy / Password Change Modal */}
      <AnimatePresence>
        {showPrivacyModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900">Privacy & Password</h3>
                <button onClick={() => setShowPrivacyModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                  <X size={20} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (passwordForm.newPass !== passwordForm.confirm) {
                    toast.error('New passwords do not match');
                    return;
                  }
                  toast.success('Password updated successfully');
                  setShowPrivacyModal(false);
                  setPasswordForm({ current: '', newPass: '', confirm: '' });
                }}
                className="space-y-3"
              >
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Current Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs focus:border-[#0F4C81] outline-none"
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">New Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordForm.newPass}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs focus:border-[#0F4C81] outline-none"
                    placeholder="At least 6 characters"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Confirm New Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs focus:border-[#0F4C81] outline-none"
                    placeholder="Re-enter new password"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="showPass"
                    checked={showPassword}
                    onChange={() => setShowPassword(!showPassword)}
                    className="rounded text-[#0F4C81]"
                  />
                  <label htmlFor="showPass" className="text-xs text-slate-600 font-medium cursor-pointer">
                    Show passwords
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-[#0F4C81] hover:bg-[#0A365C] text-white font-bold text-xs shadow-md transition-all mt-2 cursor-pointer"
                >
                  Update Password
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-xl text-center"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
                <LogOut size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-slate-900">Confirm Logout</h4>
                <p className="text-xs text-slate-500">
                  Are you sure you want to log out of your marketplace account?
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (logout) await logout();
                    toast.success('Logged out');
                    setShowLogoutModal(false);
                    navigate('/marketplace');
                  }}
                  className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 font-bold text-xs text-white"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Logout All Confirmation Modal */}
      <AnimatePresence>
        {showLogoutAllModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-xl text-center"
            >
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <Smartphone size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-slate-900">Logout All Devices</h4>
                <p className="text-xs text-slate-500">
                  This will invalidate all active sessions on other phones and web browsers.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutAllModal(false)}
                  className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (logout) await logout();
                    toast.success('All sessions logged out');
                    setShowLogoutAllModal(false);
                    navigate('/marketplace');
                  }}
                  className="flex-1 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-xl text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 size={22} />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-slate-900">Delete Account?</h4>
                <p className="text-xs text-slate-500">
                  This action is permanent and will remove your marketplace listings, chats, and favorites.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toast.error('Account deletion request sent to support');
                    setShowDeleteModal(false);
                  }}
                  className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 font-bold text-xs text-white"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default C2CAccountPage;
