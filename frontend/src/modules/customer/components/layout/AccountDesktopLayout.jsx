import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Package,
  User,
  MapPin,
  Wallet,
  CreditCard,
  Heart,
  LifeBuoy,
  LogOut,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Home
} from 'lucide-react';
import { useAuth } from '@core/context/AuthContext';
import { customerApi } from '../../services/customerApi';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const NAV_GROUPS = [
  {
    title: null,
    items: [
      {
        id: 'orders',
        label: 'MY ORDERS',
        path: '/orders',
        icon: Package,
        matchPrefix: '/orders'
      }
    ]
  },
  {
    title: 'ACCOUNT SETTINGS',
    items: [
      {
        id: 'profile',
        label: 'Profile Information',
        path: '/profile',
        icon: User,
        matchExact: true
      },
      {
        id: 'addresses',
        label: 'Manage Addresses',
        path: '/addresses',
        icon: MapPin,
        matchPrefix: '/addresses'
      }
    ]
  },
  {
    title: 'PAYMENTS',
    items: [
      {
        id: 'wallet',
        label: 'Wallet',
        path: '/wallet',
        icon: Wallet,
        matchPrefix: '/wallet'
      },
      {
        id: 'transactions',
        label: 'Transactions',
        path: '/transactions',
        icon: CreditCard,
        matchPrefix: '/transactions'
      }
    ]
  },
  {
    title: 'MY STUFF',
    items: [
      {
        id: 'wishlist',
        label: 'My Wishlist',
        path: '/wishlist',
        icon: Heart,
        matchPrefix: '/wishlist'
      },
      {
        id: 'help',
        label: 'Help & Support',
        path: '/help',
        icon: LifeBuoy,
        matchPrefix: '/help'
      }
    ]
  }
];

const AccountDesktopLayout = ({
  activeTab,
  pageTitle,
  children,
  mobileContent
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const formatIndiaPhone = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('+91')) return raw.replace(/^\+91[\s-]*/, '');
    if (raw.startsWith('91') && raw.length >= 12) return raw.replace(/^91[\s-]*/, '');
    return raw;
  };

  const handleLogout = () => {
    logout();
    setShowLogoutModal(false);
    toast.success('Logged out successfully');
    navigate('/');
  };

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <>
      {/* ── MOBILE VIEW (< 1024px / lg): 100% UNTOUCHED ── */}
      <div className="lg:hidden">
        {mobileContent || children}
      </div>

      {/* ── DESKTOP VIEW (>= 1024px / lg): Flipkart-inspired 2-Column Split ── */}
      <div className="hidden lg:block min-h-screen bg-[#f1f4f8] py-6 font-['Outfit',_sans-serif]">
        <div className="max-w-7xl mx-auto px-4 md:px-6">

          {/* Top Navigation & Breadcrumbs Bar with Back Button */}
          <div className="flex items-center justify-between mb-5 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-200 text-xs font-bold transition-all cursor-pointer group active:scale-95 shadow-2xs"
                title="Go Back"
              >
                <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
                <span>Back</span>
              </button>
              
              <div className="h-4 w-[1px] bg-slate-200" />

              {/* Breadcrumb */}
              <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Link to="/" className="hover:text-blue-600 transition-colors flex items-center gap-1 font-semibold">
                  <Home size={13} />
                  <span>Home</span>
                </Link>
                <ChevronRight size={12} className="text-slate-400" />
                <span className="text-slate-600 font-semibold">My Account</span>
                {pageTitle && (
                  <>
                    <ChevronRight size={12} className="text-slate-400" />
                    <span className="text-blue-600 font-bold">{pageTitle}</span>
                  </>
                )}
              </nav>
            </div>
          </div>

          <div className="flex items-start gap-6">
            
            {/* LEFT SIDEBAR (~280px) */}
            <aside className="w-72 shrink-0 space-y-4">
              {/* User Identity Card */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
                <div className="h-13 w-13 rounded-full bg-gradient-to-tr from-orange-500 via-amber-400 to-blue-600 border-2 border-orange-200 flex items-center justify-center p-0.5 shadow-2xs shrink-0">
                  <div className="h-full w-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                    {user?.avatar || user?.profileImage ? (
                      <img
                        src={user.avatar || user.profileImage}
                        alt={user?.name || 'Customer'}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="font-bold text-slate-800 text-lg">
                        {(user?.name || 'Customer').trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400 font-semibold leading-tight">Hello,</p>
                  <h2 className="text-base font-bold text-slate-900 truncate leading-tight mt-0.5">
                    {user?.name || 'Customer'}
                  </h2>
                  {user?.phone && (
                    <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                      +91 {formatIndiaPhone(user.phone)}
                    </p>
                  )}
                </div>
              </div>

              {/* Navigation Menu Groups */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden divide-y divide-slate-100">
                {NAV_GROUPS.map((group, gIdx) => (
                  <div key={gIdx} className="py-2">
                    {group.title && (
                      <div className="px-4 py-2">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          {group.title}
                        </span>
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isMatch = activeTab === item.id || 
                          (item.matchExact ? location.pathname === item.path : location.pathname.startsWith(item.path));

                        return (
                          <Link
                            key={item.id}
                            to={item.path}
                            className={cn(
                              "flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition-all group",
                              isMatch
                                ? "bg-blue-50/80 text-blue-600 font-bold border-l-4 border-blue-600"
                                : "text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Icon
                                size={17}
                                className={cn(
                                  "shrink-0 transition-colors",
                                  isMatch ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                                )}
                              />
                              <span className="truncate">{item.label}</span>
                            </div>
                            <ChevronRight
                              size={15}
                              className={cn(
                                "shrink-0 transition-transform",
                                isMatch ? "text-blue-600 translate-x-0.5" : "text-slate-300 group-hover:text-slate-400"
                              )}
                            />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Logout Action */}
                <div className="p-2">
                  <button
                    onClick={() => setShowLogoutModal(true)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50/70 rounded-xl transition-colors cursor-pointer"
                  >
                    <LogOut size={17} className="text-red-500 shrink-0" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </aside>

            {/* RIGHT PANEL (flex-1) */}
            <main className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
              {pageTitle && (
                <div className="border-b border-slate-100 pb-4 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="p-2 -ml-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-all cursor-pointer flex items-center justify-center group active:scale-95 shadow-2xs"
                      title="Go Back"
                      aria-label="Go Back"
                    >
                      <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform text-slate-600" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                      {pageTitle}
                    </h1>
                  </div>
                </div>
              )}
              {children}
            </main>

          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Confirm Logout</h3>
            <p className="text-sm text-slate-600">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AccountDesktopLayout;
