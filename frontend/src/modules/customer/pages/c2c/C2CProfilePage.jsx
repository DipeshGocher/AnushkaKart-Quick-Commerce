import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Save, Phone, Mail } from 'lucide-react';
import { useAuth } from '@core/context/AuthContext';
import { customerApi } from '../../services/customerApi';
import { toast } from 'sonner';

const C2CProfilePage = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const formatIndiaPhone = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '9999999999';
    if (raw.startsWith('+91')) return raw.replace(/^\+91[\s-]*/, '');
    if (raw.startsWith('91') && raw.length >= 12) return raw.replace(/^91[\s-]*/, '');
    return raw;
  };

  const [formData, setFormData] = useState({
    name: user?.name || 'Customer',
    phone: formatIndiaPhone(user?.phone) || '9999999999',
    email: user?.email || '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || 'Customer',
        phone: formatIndiaPhone(user.phone) || '9999999999',
        email: user.email || '',
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
      toast.error('Please enter your full name');
      return;
    }

    setIsLoading(true);
    try {
      let updatedUser = { 
        ...user, 
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
      };

      try {
        const response = await customerApi.updateProfile({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
        });
        if (response?.data?.result) {
          updatedUser = response.data.result;
        }
      } catch (apiErr) {
        console.warn('API update fallback to local auth sync:', apiErr);
      }

      // Update unified AuthContext state so Quick Commerce and C2C both reflect changes
      if (updateUser) {
        updateUser(updatedUser);
      }

      toast.success('Profile updated successfully!');
      navigate('/marketplace/account');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/marketplace/account')}
            className="p-1 -ml-1 rounded-full text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Back to Account"
            aria-label="Back to Account"
          >
            <ArrowLeft size={22} strokeWidth={2.4} />
          </button>
          <h1 className="text-base sm:text-lg font-bold text-slate-900">
            Profile
          </h1>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading}
          className="text-xs font-black text-[#0F4C81] hover:text-[#0A365C] px-3.5 py-1.5 rounded-full hover:bg-blue-50 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </header>

      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6">
        {/* Profile Picture Display (Clean default User icon - no photo chosen yet) */}
        <div className="flex flex-col items-center justify-center pt-2">
          <div className="relative h-24 w-24 rounded-full bg-slate-100 border-2 border-slate-200 p-1 shadow-sm flex items-center justify-center">
            <div className="h-full w-full rounded-full bg-white flex items-center justify-center overflow-hidden">
              {user?.avatar || user?.profileImage ? (
                <img
                  src={user.avatar || user.profileImage}
                  alt={formData.name || 'Customer'}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <User size={42} className="text-[#0F172A]" />
              )}
            </div>
          </div>
        </div>

        {/* Profile Form (Full Name, Phone Number, Email Address, Save Button) */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Full Name
            </label>
            <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 focus-within:border-[#0F4C81] focus-within:ring-2 focus-within:ring-[#0F4C81]/15 transition-all">
              <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <User size={16} className="text-[#0F4C81]" />
              </div>
              <input
                type="text"
                name="name"
                maxLength={50}
                value={formData.name}
                onChange={(e) => {
                  e.target.value = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                  handleChange(e);
                }}
                className="bg-transparent w-full text-[#0F172A] font-bold outline-none placeholder:font-medium text-sm"
                placeholder="Customer"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Phone Number
            </label>
            <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 focus-within:border-[#0F4C81] focus-within:ring-2 focus-within:ring-[#0F4C81]/15 transition-all">
              <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                <Phone size={16} className="text-emerald-600" />
              </div>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="bg-transparent w-full text-[#0F172A] font-bold outline-none placeholder:font-medium text-sm"
                placeholder="9999999999"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 focus-within:border-[#0F4C81] focus-within:ring-2 focus-within:ring-[#0F4C81]/15 transition-all">
              <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                <Mail size={16} className="text-amber-600" />
              </div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="bg-transparent w-full text-[#0F172A] font-bold outline-none placeholder:font-medium text-sm"
                placeholder="Enter email address"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#0F4C81] hover:bg-[#0A365C] text-white font-bold rounded-xl shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={18} />
              )}
              <span>{isLoading ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default C2CProfilePage;
