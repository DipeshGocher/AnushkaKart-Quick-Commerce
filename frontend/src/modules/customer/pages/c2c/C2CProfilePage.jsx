import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Share2, ChevronRight, Calendar, Users, Phone, Mail, 
  MapPin, Edit3, ShieldCheck, CheckCircle2, User as UserIcon
} from 'lucide-react';
import { useAuth } from '@core/context/AuthContext';
import { toast } from 'sonner';

const C2CProfilePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Format member since date matching Image 1
  const memberSinceFormatted = useMemo(() => {
    if (!user?.createdAt) return 'Member since SEP. 2020';
    try {
      const d = new Date(user.createdAt);
      const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
      const year = d.getFullYear();
      return `Member since ${month}. ${year}`;
    } catch {
      return 'Member since SEP. 2020';
    }
  }, [user]);

  // Share profile handler
  const handleShareProfile = async () => {
    const shareData = {
      title: `${user?.name || 'Customer'}'s Marketplace Profile`,
      text: `Check out ${user?.name || 'my'} profile on Anushka Marketplace!`,
      url: window.location.href,
    };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Profile link copied to clipboard!');
    }
  };

  const displayName = user?.name || 'Dipesh';
  const displayPhone = user?.phone ? `+91 ${user.phone.replace('+91', '').trim().slice(-10)}` : '+91 98260 12345';
  const displayEmail = user?.email || 'dipesh@example.com';
  const displayBio = user?.bio || 'Verified member on Anushka Marketplace. Ready to buy & sell authentic pre-owned items safely.';
  const displayCity = user?.city || user?.location || 'Indore, MP';

  return (
    <div className="min-h-screen bg-white pb-28 text-slate-900 font-sans selection:bg-[#0F4C81]/15">
      {/* Top Header matching Image 1 */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/marketplace/account')}
          className="p-1 rounded-full text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Back to Account"
          aria-label="Back to Account"
        >
          <ArrowLeft size={22} strokeWidth={2.4} />
        </button>

        <h1 className="text-base font-bold text-slate-900">
          Account
        </h1>

        <button
          type="button"
          onClick={handleShareProfile}
          className="p-1 rounded-full text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Share Profile"
          aria-label="Share Profile"
        >
          <Share2 size={20} strokeWidth={2.2} />
        </button>
      </header>

      {/* Gold Profile Completion Banner matching Image 1 */}
      <div 
        onClick={() => navigate('/marketplace/profile/edit')}
        className="bg-[#f7a800] hover:bg-[#e69c00] transition-colors px-4 py-2.5 flex items-center justify-between text-slate-950 font-bold text-xs sm:text-[13px] cursor-pointer shadow-xs select-none"
      >
        <span>You have 3 steps left. Complete your profile!</span>
        <ChevronRight size={18} strokeWidth={2.8} />
      </div>

      <div className="max-w-xl mx-auto px-4 pt-5 space-y-6">
        {/* User Identity Section matching Image 1 */}
        <section className="space-y-4">
          <div className="flex items-start gap-4">
            {/* User Avatar */}
            <div className="relative w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden shrink-0 shadow-sm">
              {user?.avatar || user?.profileImage ? (
                <img
                  src={user.avatar || user.profileImage}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-[#0F4C81] to-[#0A365C] text-white flex items-center justify-center text-3xl font-black">
                  {displayName[0]?.toUpperCase() || 'D'}
                </div>
              )}
            </div>

            {/* User Meta Information */}
            <div className="flex-1 min-w-0 pt-0.5 space-y-1">
              <h2 className="text-2xl font-bold text-slate-950 tracking-tight truncate">
                {displayName}
              </h2>

              <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                <Calendar size={14} className="text-slate-500 shrink-0" />
                <span>{memberSinceFormatted}</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-700 font-medium pt-0.5">
                <Users size={14} className="text-slate-500 shrink-0" />
                <span>0 Followers</span>
                <span className="text-slate-300">|</span>
                <span>0 Followings</span>
              </div>

              <div className="pt-1 text-[11px] text-slate-600 font-medium flex items-center gap-1">
                <span>User logged in with</span>
                <span className="inline-flex items-center gap-0.5 font-bold text-slate-900">
                  <Phone size={11} className="text-[#0F4C81]" />
                  {displayPhone}
                </span>
              </div>
            </div>
          </div>

          {/* Edit Profile Full-width Solid Blue Button matching Image 1 */}
          <button
            type="button"
            onClick={() => navigate('/marketplace/profile/edit')}
            className="w-full py-2.5 px-4 rounded-md bg-[#0F4C81] hover:bg-[#0A365C] active:scale-[0.99] text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Edit3 size={16} />
            <span>Edit Profile</span>
          </button>
        </section>

        {/* Detailed User Information Card */}
        <section className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Personal Information
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 size={12} />
              Synchronized Profile
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <UserIcon size={14} className="text-slate-400" /> Full Name
              </span>
              <span className="font-bold text-slate-900">{displayName}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Phone size={14} className="text-slate-400" /> Mobile Number
              </span>
              <span className="font-bold text-slate-900">{displayPhone}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Mail size={14} className="text-slate-400" /> Email Address
              </span>
              <span className="font-bold text-slate-900">{displayEmail}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <MapPin size={14} className="text-slate-400" /> Location / City
              </span>
              <span className="font-bold text-slate-900">{displayCity}</span>
            </div>

            {displayBio && (
              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-slate-500 font-medium block mb-1">About / Bio</span>
                <p className="text-slate-700 font-normal leading-relaxed">{displayBio}</p>
              </div>
            )}
          </div>
        </section>

        {/* Verification Status Card */}
        <section className="bg-gradient-to-r from-blue-50/80 to-indigo-50/50 rounded-2xl border border-blue-200/70 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F4C81] text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                Verified Community Member
              </h4>
              <p className="text-[11px] text-slate-500">
                Your phone number is verified for C2C transactions
              </p>
            </div>
          </div>
          <span className="text-[11px] font-black text-emerald-700 bg-white px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
            Active
          </span>
        </section>
      </div>
    </div>
  );
};

export default C2CProfilePage;
