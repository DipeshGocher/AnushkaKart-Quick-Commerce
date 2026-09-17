import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Store,
  Shield,
  Edit2,
  Save,
  X,
  Rocket,
  Globe,
  MapPin,
  CheckCircle,
} from "lucide-react";
import { warehouseApi } from "../services/warehouseApi";
import { toast } from "sonner";
import Card from "@shared/components/ui/Card";
import Button from "@shared/components/ui/Button";
import MapPicker from "../../../shared/components/MapPicker";

const SellerProfile = () => {
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    warehouseName: "",
    phone: "",
    email: "",
    lat: null,
    lng: null,
    radius: 5,
    address: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await warehouseApi.getProfile();
      const data = response.data.result;
      setProfile(data);
      setFormData({
        name: data.name,
        warehouseName: data.warehouseName,
        phone: data.phone,
        email: data.email,
        lat: data.location?.coordinates[1] || null,
        lng: data.location?.coordinates[0] || null,
        radius: data.serviceRadius || 5,
        address: data.address || "",
      });
    } catch (error) {
      toast.error("Failed to fetch profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSelect = (location) => {
    setFormData((prev) => ({
      ...prev,
      lat: location.lat,
      lng: location.lng,
      radius: location.radius,
      address: location.address,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "name") {
      // Disallow numbers in Warehouse name
      const cleaned = value.replace(/[0-9]/g, "");
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "phone") {
      // Allow only digits, max 10 characters
      const digitsOnly = value.replace(/[^0-9]/g, "").slice(0, 10);
      setFormData({ ...formData, [name]: digitsOnly });
    } else if (name === "email") {
      // Trim spaces, keep as-is otherwise; HTML5 type=email will help validate shape
      setFormData({ ...formData, [name]: value.trimStart() });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Basic phone validation: must be exactly 10 digits
    if (!/^[0-9]{10}$/.test(formData.phone)) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }
    // Basic email validation
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        lat: formData.lat,
        lng: formData.lng,
        radius: formData.radius,
      };
      await warehouseApi.updateProfile(payload);
      toast.success("Profile updated successfully");
      setIsEditing(false);
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async () => {
    try {
      const newStatus = !profile.isActive;
      await warehouseApi.updateProfile({ isActive: newStatus });
      setProfile((prev) => ({ ...prev, isActive: newStatus }));
      toast.success(`Shop is now ${newStatus ? "Active" : "Inactive"}`);
    } catch (error) {
      toast.error("Failed to update shop status");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 font-['Outfit']">
      {/* Header Section */}
      <div className="relative mb-24 px-4">
        {/* Banner Background */}
        <div className="bg-gradient-to-r from-[#0B132B] via-[#1C2541] to-[#FF5722] h-64 rounded-3xl shadow-2xl relative overflow-hidden border border-white/10">
          <div className="absolute inset-0 opacity-40">
            <div className="absolute top-0 left-0 w-80 h-80 bg-[#FF5722]/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#0047AB]/40 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
            <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-amber-500/20 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Profile Info Row */}
        <div className="absolute bottom-8 left-4 right-4 md:left-8 md:right-8 lg:left-12 lg:right-12 grid grid-cols-1 md:grid-cols-[176px_minmax(0,1fr)_auto] items-center md:items-end gap-6 md:gap-8">
          {/* Avatar Container */}
          <div className="h-44 w-44 rounded-full p-[4px] bg-gradient-to-tr from-[#FF5722] via-[#F97316] to-[#0047AB] shadow-[0_20px_50px_rgba(255,87,34,0.35)] flex-shrink-0 mx-auto md:mx-0">
            <div className="h-full w-full rounded-full bg-white flex items-center justify-center border-4 border-white shadow-inner overflow-hidden">
              <span className="text-7xl font-black bg-gradient-to-br from-[#FF5722] via-[#EA580C] to-[#0B132B] bg-clip-text text-transparent">
                {profile?.name?.charAt(0)}
              </span>
            </div>
          </div>

          {/* Info Block */}
          <div className="min-w-0 pb-2 md:pb-4 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-3">
              <span className="px-4 py-1.5 bg-[#FF5722]/20 backdrop-blur-xl text-orange-200 text-[10px] font-black uppercase tracking-[2px] rounded-full border border-[#FF5722]/40 shadow-sm flex items-center gap-1.5">
                <Store size={12} className="text-[#FF5722]" /> {profile?.role}
              </span>
              <button
                onClick={toggleStatus}
                className={`group flex items-center gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-[2px] rounded-full border transition-all hover:scale-105 active:scale-95 ${
                  profile?.isActive
                    ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                    : "bg-rose-500 text-white border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                }`}>
                <div
                  className={`w-2 h-2 rounded-full animate-pulse ${
                    profile?.isActive ? "bg-emerald-200" : "bg-rose-200"
                  }`}
                />
                {profile?.isActive ? "Active Store" : "Inactive"}
              </button>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter drop-shadow-md mb-2 break-words">
              {profile?.name}
            </h1>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-white font-bold tracking-[0.5px] text-base shadow-sm">
              <Store size={18} className="text-[#FF5722]" />
              <span className="text-orange-200 font-extrabold">{profile?.shopName || profile?.warehouseName || "Harsh's Hub"}</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="pb-2 md:pb-4 w-full md:w-auto">
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                className="w-full md:w-auto bg-gradient-to-r from-[#FF5722] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white border border-orange-400/40 transition-all rounded-xl px-6 lg:px-10 py-4 md:py-5 flex items-center justify-center gap-3 md:gap-4 font-black tracking-[2px] md:tracking-[3px] text-xs shadow-[0_15px_35px_rgba(255,87,34,0.4)] hover:scale-[1.03] active:scale-[0.95] whitespace-nowrap">
                <Edit2 size={18} /> EDIT PROFILE
              </Button>
            ) : (
              <div className="w-full md:w-auto flex gap-3 md:gap-4 justify-center md:justify-end">
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="h-[64px] w-[64px] flex items-center justify-center bg-white/10 text-white border border-white/30 hover:bg-white hover:text-slate-900 rounded-xl shadow-lg transition-all backdrop-blur-md">
                  <X size={24} className="stroke-[2.5]" />
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="min-w-0 max-w-full bg-gradient-to-r from-[#FF5722] to-[#EA580C] text-white hover:from-[#EA580C] hover:to-[#C2410C] rounded-xl px-5 md:px-8 lg:px-10 py-4 md:py-5 font-black tracking-[2px] md:tracking-[3px] text-xs flex items-center gap-3 md:gap-4 shadow-[0_20px_40px_rgba(255,87,34,0.35)] h-[64px] whitespace-nowrap">
                  {isSaving ? (
                    "UPDATING..."
                  ) : (
                    <>
                      <Save size={20} /> SAVE CHANGES
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Info Card */}
        <div className="md:col-span-2 space-y-8">
          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-2xl border-t-4 border-t-[#FF5722]">
            <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF5722] flex items-center justify-center font-bold shadow-sm">
                <Store size={20} />
              </div>
              <h3 className="text-xl font-black text-slate-900">
                Business Profile
              </h3>
            </div>

            <form className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Seller Identity
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#FF5722] transition-colors">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      name="name"
                      maxLength={50}
                      pattern="[a-zA-Z\s]*"
                      value={formData.name}
                      onChange={(e) => {
                          e.target.value = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                          handleChange(e);
                      }}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50/80 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-[#FF5722] focus:ring-4 focus:ring-[#FF5722]/10 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Store Name
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#FF5722] transition-colors">
                      <Store size={18} />
                    </div>
                    <input
                      type="text"
                      name="shopName"
                      value={formData.shopName || formData.warehouseName}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50/80 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-[#FF5722] focus:ring-4 focus:ring-[#FF5722]/10 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Contact Number
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#FF5722] transition-colors">
                      <Phone size={18} />
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50/80 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-[#FF5722] focus:ring-4 focus:ring-[#FF5722]/10 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Email Address
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#FF5722] transition-colors">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50/80 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-[#FF5722] focus:ring-4 focus:ring-[#FF5722]/10 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>
              </div>
            </form>
          </Card>

          {/* Location & Radius Settings Card */}
          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-2xl border-t-4 border-t-[#0047AB]">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#0047AB] flex items-center justify-center font-bold shadow-sm">
                  <MapPin size={20} />
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  Location & Service Settings
                </h3>
              </div>
              {!isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-slate-900 text-white hover:bg-black rounded-lg px-6 py-2 text-[10px] font-black tracking-[2px]">
                  MANAGE
                </Button>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-r from-orange-50/80 to-blue-50/50 p-6 rounded-2xl border-2 border-orange-100/70 space-y-6">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${
                        formData.lat
                          ? "bg-gradient-to-tr from-[#FF5722] to-[#F97316] text-white shadow-lg shadow-orange-500/25"
                          : "bg-white text-slate-400 shadow-sm"
                      }`}>
                      <MapPin size={24} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900">
                        {formData.lat
                          ? "Store Location Pin"
                          : "Location Not Defined"}
                      </p>
                      <p className="text-xs text-slate-500 font-medium max-w-[400px] leading-relaxed">
                        {formData.address ||
                          "Click change to precisely mark your shop location on the map for delivery accuracy."}
                      </p>
                    </div>
                  </div>
                  {isEditing && (
                    <Button
                      type="button"
                      onClick={() => setIsMapOpen(true)}
                      className="bg-white text-[#FF5722] border-2 border-[#FF5722]/30 hover:border-[#FF5722] rounded-xl px-8 py-3 text-[10px] font-black tracking-[2px] shadow-sm hover:shadow-md transition-all whitespace-nowrap">
                      CHANGE PIN
                    </Button>
                  )}
                </div>

                {formData.lat && (
                  <div className="pt-6 border-t border-slate-200/60 flex flex-wrap gap-8">
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Service Radius
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-slate-900">
                          {formData.radius}
                        </span>
                        <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2.5 py-0.5 rounded-md">
                          KM
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Latitude
                      </span>
                      <span className="text-sm font-bold text-slate-700 tabular-nums">
                        {formData.lat.toFixed(6)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Longitude
                      </span>
                      <span className="text-sm font-bold text-slate-700 tabular-nums">
                        {formData.lng.toFixed(6)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <Shield size={16} className="text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-700 font-medium leading-relaxed">
                  Your shop location and service radius determine which
                  customers can view your products. Ensure the marker is placed
                  exactly at your physical storefront for accurate delivery
                  assignments.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar Card */}
        <div className="space-y-8">
          <Card className="p-7 rounded-3xl bg-gradient-to-br from-[#0B132B] via-[#1C2541] to-[#0A1128] text-white border-t-4 border-t-[#FF5722] shadow-[0_25px_60px_-15px_rgba(15,23,42,0.4)] relative overflow-hidden">
            {/* Background Accent Glows */}
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-[#FF5722]/25 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-blue-600/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between pb-5 mb-6 border-b border-white/10 relative z-10">
              <h4 className="text-xs font-black uppercase tracking-[3px] text-orange-400 flex items-center gap-2">
                <Shield size={18} className="text-[#FF5722]" /> Security & Trust
              </h4>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black tracking-wider border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle size={12} /> SECURE
              </span>
            </div>

            <div className="space-y-4 relative z-10">
              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-[#FF5722] to-[#F97316] text-white shadow-lg shadow-orange-500/30 flex items-center justify-center shrink-0">
                  <Shield size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-300">
                    Verification Status
                  </p>
                  <p className="text-sm font-black text-white flex items-center gap-1.5 mt-0.5">
                    {profile?.isVerified ? (
                      <>
                        <span className="text-emerald-400">Verified Merchant</span>
                        <CheckCircle size={14} className="text-emerald-400 inline" />
                      </>
                    ) : (
                      <span className="text-amber-400">Verification Pending</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center shrink-0">
                  <Rocket size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">
                    Partner Tier
                  </p>
                  <p className="text-sm font-black text-white mt-0.5 flex items-center gap-1.5">
                    Standard Growth
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md font-bold border border-blue-400/30">PRO</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center shrink-0">
                  <Globe size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                    Coverage Region
                  </p>
                  <p className="text-sm font-black text-white mt-0.5">Pan India Reach</p>
                </div>
              </div>

              <div className="pt-2">
                <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-blue-500/10 border border-white/10 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#FF5722]/20 text-[#FF5722] shrink-0">
                    <Shield size={16} />
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium leading-tight">
                    256-Bit Encrypted Data & Store Identity Verification Active
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {isMapOpen && (
        <MapPicker
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onConfirm={handleLocationSelect}
          initialLocation={
            formData.lat ? { lat: formData.lat, lng: formData.lng } : null
          }
          initialRadius={formData.radius}
        />
      )}
    </div>
  );
};

export default SellerProfile;

