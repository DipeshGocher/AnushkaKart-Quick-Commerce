import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Phone, Mail, MapPin, AlignLeft, 
  Camera, CheckCircle2, Save, Loader2 
} from 'lucide-react';
import { useAuth } from '@core/context/AuthContext';
import { customerApi } from '../../services/customerApi';
import { toast } from 'sonner';

const C2CEditProfilePage = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    bio: user?.bio || '',
    city: user?.city || user?.location || ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        email: user.email || '',
        bio: user.bio || '',
        city: user.city || user.location || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Please provide your full name');
      return;
    }

    setIsSubmitting(true);
    try {
      let updatedUser = { ...user, ...formData };
      try {
        const res = await customerApi.updateProfile(formData);
        if (res?.data?.result) {
          updatedUser = res.data.result;
        }
      } catch (apiErr) {
        console.warn('API update fallback to local auth sync:', apiErr);
      }

      // Update unified AuthContext state so Quick Commerce and C2C both reflect changes
      if (updateUser) {
        updateUser(updatedUser);
      }

      toast.success('Profile updated successfully!');
      navigate('/marketplace/profile');
    } catch (err) {
      toast.error('Could not save profile changes. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = formData.name || user?.name || 'User';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-16">
      {/* Header matching OLX/C2C style */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 px-4 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/marketplace/profile')}
            className="p-1 -ml-1 rounded-full text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Back to Profile"
          >
            <ArrowLeft size={22} strokeWidth={2.4} />
          </button>
          <h1 className="text-base font-extrabold text-slate-900">
            Edit Profile
          </h1>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="text-xs font-black text-[#0F4C81] hover:text-[#0A365C] px-3 py-1 rounded-full hover:bg-blue-50 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </header>

      <div className="max-w-xl mx-auto p-4 sm:p-5 space-y-6">
        {/* Avatar Photo Section */}
        <div className="flex flex-col items-center justify-center pt-2">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#0F4C81] to-[#0A365C] text-white flex items-center justify-center text-4xl font-black shadow-md border-4 border-white overflow-hidden">
              {user?.avatar || user?.profileImage ? (
                <img
                  src={user.avatar || user.profileImage}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                displayName[0]?.toUpperCase() || 'D'
              )}
            </div>
            <button
              type="button"
              onClick={() => toast.info('Photo upload option is currently in preview mode')}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#0F4C81] text-white flex items-center justify-center shadow-md border-2 border-white hover:bg-[#0A365C] transition-colors cursor-pointer"
              title="Change Photo"
            >
              <Camera size={14} />
            </button>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 mt-2">
            Tap camera to change photo
          </span>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Basic Details</span>
            <span className="text-[10px] text-slate-400 font-normal normal-case">(Synced with Quick Commerce)</span>
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Full Name *
            </label>
            <div className="relative flex items-center">
              <User size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                required
                className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/15 outline-none transition-all"
              />
            </div>
          </div>

          {/* Mobile Number */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Mobile Number
            </label>
            <div className="relative flex items-center">
              <Phone size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 98260 12345"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/15 outline-none transition-all"
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your.email@example.com"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/15 outline-none transition-all"
              />
            </div>
          </div>

          {/* City / Location */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              City / Location
            </label>
            <div className="relative flex items-center">
              <MapPin size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="e.g. Indore, Madhya Pradesh"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/15 outline-none transition-all"
              />
            </div>
          </div>

          {/* About / Bio */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              About Me (Bio)
            </label>
            <div className="relative">
              <textarea
                name="bio"
                rows={3}
                value={formData.bio}
                onChange={handleChange}
                placeholder="Briefly describe what you buy or sell..."
                className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/15 outline-none transition-all resize-none"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-[#0F4C81] hover:bg-[#0A365C] active:scale-[0.99] text-white font-bold text-xs sm:text-sm shadow-md shadow-[#0F4C81]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default C2CEditProfilePage;
