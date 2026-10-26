import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
  Building2,
  CreditCard,
} from "lucide-react";
import { sellerApi } from "../services/sellerApi";
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
    shopName: "",
    phone: "",
    email: "",
    lat: null,
    lng: null,
    radius: 5,
    address: "",
    locality: "",
    pincode: "",
    city: "",
    state: "",
    bankName: "",
    accountNumber: "",
    ifsc: "",
    accountHolder: "",
    upiId: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await sellerApi.getProfile();
      const data = response.data.result || response.data.data;
      const bank = data?.bankDetails || {};
      setProfile(data);
      setFormData({
        name: data.name || "",
        shopName: data.shopName || "",
        phone: data.phone || "",
        email: data.email || "",
        lat: data.location?.coordinates[1] || null,
        lng: data.location?.coordinates[0] || null,
        radius: data.serviceRadius || 5,
        address: data.address || "",
        locality: data.locality || "",
        pincode: data.pincode || "",
        city: data.city || "",
        state: data.state || "",
        bankName: bank.bankName || data.bankName || "",
        accountNumber: bank.accountNumber || data.accountNumber || "",
        ifsc: bank.ifscCode || bank.ifsc || data.ifsc || "",
        accountHolder: bank.accountHolderName || bank.accountHolder || data.accountHolder || data.name || "",
        upiId: bank.upiId || "",
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
      address: location.address || prev.address,
      pincode: location.pincode || prev.pincode,
      city: location.city || prev.city,
      state: location.state || prev.state,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "name") {
      // Disallow numbers in seller name
      const cleaned = value.replace(/[0-9]/g, "");
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "phone") {
      // Allow only digits, max 10 characters
      const digitsOnly = value.replace(/[^0-9]/g, "").slice(0, 10);
      setFormData({ ...formData, [name]: digitsOnly });
    } else if (name === "pincode") {
      const digitsOnly = value.replace(/[^0-9]/g, "").slice(0, 6);
      setFormData({ ...formData, [name]: digitsOnly });
    } else if (name === "email") {
      // Trim spaces, keep as-is otherwise; HTML5 type=email will help validate shape
      setFormData({ ...formData, [name]: value.trimStart() });
    } else if (name === "ifsc") {
      setFormData({ ...formData, [name]: value.toUpperCase().trim() });
    } else if (name === "accountNumber") {
      const digitsOnly = value.replace(/[^0-9]/g, "");
      setFormData({ ...formData, [name]: digitsOnly });
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
    // Strict pincode validation if entered
    if (formData.pincode && !/^[1-9][0-9]{5}$/.test(formData.pincode)) {
      toast.error("Please enter a valid 6-digit Indian postal pincode.");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        lat: formData.lat,
        lng: formData.lng,
        radius: formData.radius,
        bankDetails: {
          bankName: formData.bankName,
          accountNumber: formData.accountNumber,
          ifsc: formData.ifsc,
          ifscCode: formData.ifsc,
          accountHolder: formData.accountHolder,
          accountHolderName: formData.accountHolder,
          upiId: formData.upiId,
        },
      };
      await sellerApi.updateProfile(payload);
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
      await sellerApi.updateProfile({ isActive: newStatus });
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
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 font-['Outfit'] space-y-6 md:space-y-8">
      {/* Header Section */}
      <div className="relative">
        {/* Banner Background & Content */}
        <div className="bg-gradient-to-r from-[#0B132B] via-[#1C2541] to-[#6666FF] rounded-3xl shadow-2xl relative overflow-hidden border border-white/10 p-5 sm:p-8 md:p-10 md:min-h-[240px] flex flex-col justify-end">
          <div className="absolute inset-0 opacity-40 pointer-events-none">
            <div className="absolute top-0 left-0 w-80 h-80 bg-[#6666FF]/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#0047AB]/40 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
            <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-amber-500/20 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />
          </div>

          {/* Profile Info Row */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-[140px_minmax(0,1fr)_auto] lg:grid-cols-[160px_minmax(0,1fr)_auto] items-center md:items-end gap-5 md:gap-8">
            {/* Avatar Container */}
            <div className="h-28 w-28 sm:h-36 sm:w-36 md:h-36 md:w-36 lg:h-40 lg:w-40 rounded-full p-[3px] md:p-[4px] bg-gradient-to-tr from-[#7777FF] via-[#6666FF] to-[#5555EE] shadow-[0_20px_50px_rgba(102,102,255,0.35)] shrink-0 mx-auto md:mx-0">
              <div className="h-full w-full rounded-full bg-white flex items-center justify-center border-4 border-white shadow-inner overflow-hidden">
                <span className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black bg-gradient-to-br from-[#7777FF] via-[#6666FF] to-[#0B132B] bg-clip-text text-transparent">
                  {profile?.name?.charAt(0)}
                </span>
              </div>
            </div>

            {/* Info Block */}
            <div className="min-w-0 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                <span className="px-3 sm:px-4 py-1 sm:py-1.5 bg-[#6666FF]/20 backdrop-blur-xl text-brand-200 text-[10px] font-black uppercase tracking-[2px] rounded-full border border-[#6666FF]/40 shadow-sm flex items-center gap-1.5">
                  <Store size={12} className="text-[#6666FF]" /> {profile?.role || "Seller"}
                </span>
                <button
                  onClick={toggleStatus}
                  className={`group flex items-center gap-2 px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] font-black uppercase tracking-[2px] rounded-full border transition-all hover:scale-105 active:scale-95 ${
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
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-md mb-2 break-words">
                {profile?.name}
              </h1>
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-white font-bold tracking-[0.5px] text-xs sm:text-sm shadow-sm">
                <Store size={16} className="text-[#6666FF]" />
                <span className="text-brand-200 font-extrabold">{profile?.shopName || "Seller Store"}</span>
              </div>
            </div>

            {/* Action Button */}
            <div className="w-full md:w-auto shrink-0 flex justify-center md:justify-end">
              {!isEditing ? (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="w-full md:w-auto bg-gradient-to-r from-[#7777FF] to-[#6666FF] hover:from-[#6666FF] hover:to-[#4F4FDD] text-white border border-[#6666FF]/40 transition-all rounded-xl px-6 lg:px-8 py-3.5 md:py-4 flex items-center justify-center gap-2.5 font-black tracking-[2px] text-xs shadow-[0_15px_35px_rgba(102,102,255,0.4)] hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap">
                  <Edit2 size={16} /> EDIT PROFILE
                </Button>
              ) : (
                <div className="w-full md:w-auto flex gap-2 sm:gap-3 justify-center md:justify-end">
                  <Button
                    onClick={() => setIsEditing(false)}
                    variant="outline"
                    className="h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center bg-white/10 text-white border border-white/30 hover:bg-white hover:text-slate-900 rounded-xl shadow-lg transition-all backdrop-blur-md">
                    <X size={20} className="stroke-[2.5]" />
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSaving}
                    className="flex-1 md:flex-none bg-gradient-to-r from-[#7777FF] to-[#6666FF] text-white hover:from-[#6666FF] hover:to-[#4F4FDD] rounded-xl px-5 sm:px-8 py-3.5 sm:py-4 font-black tracking-[2px] text-xs flex items-center justify-center gap-2.5 shadow-[0_20px_40px_rgba(102,102,255,0.35)] h-12 sm:h-14 whitespace-nowrap">
                    {isSaving ? (
                      "UPDATING..."
                    ) : (
                      <>
                        <Save size={18} /> SAVE CHANGES
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        {/* Main Info Columns */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          {/* Business Profile Card */}
          <Card className="p-5 sm:p-7 md:p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-2xl border-t-4 border-t-[#6666FF] bg-white">
            <div className="flex items-center gap-3 mb-6 sm:mb-8 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-100 text-[#6666FF] flex items-center justify-center font-bold shadow-sm">
                <Store size={20} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Business Profile
                </h3>
                <p className="text-xs text-slate-500 font-medium">Basic contact and shop credentials</p>
              </div>
            </div>

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 ml-0.5">
                    Full Name *
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#6666FF] transition-colors">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      name="name"
                      maxLength={50}
                      value={formData.name}
                      onChange={(e) => {
                        e.target.value = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                        handleChange(e);
                      }}
                      disabled={!isEditing}
                      placeholder="e.g. Harsh Sharma"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#6666FF] focus:ring-4 focus:ring-[#6666FF]/10 transition-all disabled:opacity-75"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 ml-0.5">
                    Store Name *
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#6666FF] transition-colors">
                      <Store size={18} />
                    </div>
                    <input
                      type="text"
                      name="shopName"
                      value={formData.shopName}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="e.g. Harsh's Hub"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#6666FF] focus:ring-4 focus:ring-[#6666FF]/10 transition-all disabled:opacity-75"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 ml-0.5">
                    Phone Number *
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#6666FF] transition-colors">
                      <Phone size={18} />
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      maxLength={10}
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="10-digit mobile number"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#6666FF] focus:ring-4 focus:ring-[#6666FF]/10 transition-all disabled:opacity-75"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 ml-0.5">
                    Email Address *
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#6666FF] transition-colors">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="seller@domain.com"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#6666FF] focus:ring-4 focus:ring-[#6666FF]/10 transition-all disabled:opacity-75"
                    />
                  </div>
                </div>
              </div>
            </form>
          </Card>

          {/* Bank Account & Payout Details Card */}
          <Card className="p-5 sm:p-7 md:p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-2xl border-t-4 border-t-emerald-500 bg-white">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6 sm:mb-8 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold shadow-sm shrink-0">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    Bank Account & Payout Details
                    {formData.accountNumber && formData.bankName ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle size={10} /> Linked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                        Missing
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Bank details used for withdrawing your settled earnings</p>
                </div>
              </div>
              {!isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-slate-900 text-white hover:bg-black rounded-lg px-5 py-2 text-[10px] font-black tracking-[2px] shrink-0">
                  {formData.accountNumber ? "EDIT BANK" : "ADD BANK"}
                </Button>
              )}
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 ml-0.5">
                    Bank Name *
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                      <Building2 size={18} />
                    </div>
                    <input
                      type="text"
                      name="bankName"
                      value={formData.bankName}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="e.g. HDFC Bank, State Bank of India, ICICI"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all disabled:opacity-75"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 ml-0.5">
                    Account Holder Name *
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      name="accountHolder"
                      value={formData.accountHolder}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Name as per bank passbook"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all disabled:opacity-75"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 ml-0.5">
                    Bank Account Number *
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                      <CreditCard size={18} />
                    </div>
                    <input
                      type={isEditing ? "text" : "password"}
                      name="accountNumber"
                      value={formData.accountNumber}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Enter bank account number"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-mono font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all disabled:opacity-75"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 ml-0.5">
                    IFSC Code *
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                      <Shield size={18} />
                    </div>
                    <input
                      type="text"
                      name="ifsc"
                      maxLength={11}
                      value={formData.ifsc}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="e.g. HDFC0001234"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-mono font-semibold uppercase text-slate-800 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all disabled:opacity-75"
                    />
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 ml-0.5">
                    UPI ID / VPA (Optional)
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                      <Globe size={18} />
                    </div>
                    <input
                      type="text"
                      name="upiId"
                      value={formData.upiId}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="e.g. mobile@okhdfcbank"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all disabled:opacity-75"
                    />
                  </div>
                </div>
              </div>

              {/* Informational Banner */}
              <div className="flex items-start gap-3 p-4 bg-emerald-50/80 rounded-xl border border-emerald-100">
                <Shield size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-900 font-medium leading-relaxed">
                  Payout funds are transferred directly to this account upon withdrawal approval. Make sure the Account Number and IFSC Code exactly match your bank passbook/statement.
                </p>
              </div>
            </div>
          </Card>

          {/* Location & Delivery Settings Card */}
          <Card className="p-5 sm:p-7 md:p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-2xl border-t-4 border-t-[#0047AB] bg-white">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6 sm:mb-8 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#0047AB] flex items-center justify-center font-bold shadow-sm shrink-0">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Location & Delivery Settings
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">GPS pin for local orders & courier pickup address</p>
                </div>
              </div>
              {!isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-slate-900 text-white hover:bg-black rounded-lg px-5 py-2 text-[10px] font-black tracking-[2px] shrink-0">
                  MANAGE
                </Button>
              )}
            </div>

            <div className="space-y-6">
              {/* Store Map Location Pin Box */}
              <div className="bg-gradient-to-r from-brand-50/80 to-blue-50/50 p-4 sm:p-6 rounded-2xl border border-brand-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div
                      className={`h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                        formData.lat
                          ? "bg-gradient-to-tr from-[#7777FF] to-[#6666FF] text-white shadow-lg shadow-[#6666FF]/25"
                          : "bg-white text-slate-400 shadow-sm"
                      }`}>
                      <MapPin size={22} />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">
                        {formData.lat ? "Store Map Location Pin" : "Location Not Defined"}
                      </p>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed break-words">
                        {formData.address ||
                          "Click change pin to precisely mark your shop coordinates on the map."}
                      </p>
                    </div>
                  </div>
                  {isEditing && (
                    <Button
                      type="button"
                      onClick={() => setIsMapOpen(true)}
                      className="w-full sm:w-auto bg-white text-[#6666FF] border border-[#6666FF]/40 hover:border-[#6666FF] rounded-xl px-5 py-2.5 text-xs font-bold tracking-wider shadow-sm hover:shadow transition-all whitespace-nowrap shrink-0">
                      CHANGE PIN
                    </Button>
                  )}
                </div>

                {formData.lat && (
                  <div className="pt-4 border-t border-slate-200/60 flex flex-wrap gap-4 sm:gap-8">
                    <div className="flex items-center gap-2 bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200/60 text-xs">
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                        Latitude:
                      </span>
                      <span className="font-semibold text-slate-700 tabular-nums">
                        {formData.lat.toFixed(6)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200/60 text-xs">
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                        Longitude:
                      </span>
                      <span className="font-semibold text-slate-700 tabular-nums">
                        {formData.lng.toFixed(6)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Courier Pickup Address Box */}
              <div className="bg-slate-50/60 p-5 sm:p-6 rounded-2xl border border-slate-200/80 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Store size={17} className="text-[#6666FF]" />
                      Courier Pickup Address
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Shiprocket couriers will pick up Pan-India customer parcels and return packages from this address.
                    </p>
                  </div>
                  {profile?.shiprocketPickupLocation && (
                    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200/80 px-3 py-1.5 rounded-full text-indigo-700 text-xs font-bold shrink-0 self-start sm:self-auto">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      Shiprocket Code: {profile.shiprocketPickupLocation}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Street Address */}
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-xs font-bold text-slate-700">
                      Street Address *
                    </label>
                    <input
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-[#6666FF] focus:ring-4 focus:ring-[#6666FF]/10 transition-all disabled:opacity-75"
                      placeholder="e.g. Shop No. 12, Commercial Complex, Main Road"
                    />
                  </div>

                  {/* 2-Column Responsive Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 flex flex-col">
                      <label className="text-xs font-bold text-slate-700">
                        Locality / Landmark
                      </label>
                      <input
                        name="locality"
                        value={formData.locality}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-[#6666FF] focus:ring-4 focus:ring-[#6666FF]/10 transition-all disabled:opacity-75"
                        placeholder="e.g. Near Bus Stand / Metro Station"
                      />
                    </div>

                    <div className="space-y-1.5 flex flex-col">
                      <label className="text-xs font-bold text-slate-700">
                        City *
                      </label>
                      <input
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-[#6666FF] focus:ring-4 focus:ring-[#6666FF]/10 transition-all disabled:opacity-75"
                        placeholder="e.g. Indore"
                      />
                    </div>

                    <div className="space-y-1.5 flex flex-col">
                      <label className="text-xs font-bold text-slate-700">
                        State *
                      </label>
                      <input
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-[#6666FF] focus:ring-4 focus:ring-[#6666FF]/10 transition-all disabled:opacity-75"
                        placeholder="e.g. Madhya Pradesh"
                      />
                    </div>

                    <div className="space-y-1.5 flex flex-col">
                      <label className="text-xs font-bold text-slate-700">
                        Postal Code (Pincode) *
                      </label>
                      <input
                        name="pincode"
                        maxLength={6}
                        value={formData.pincode}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-mono font-semibold text-slate-800 outline-none focus:border-[#6666FF] focus:ring-4 focus:ring-[#6666FF]/10 transition-all disabled:opacity-75"
                        placeholder="e.g. 452001"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Info Banner */}
              <div className="flex items-start gap-3 p-4 bg-emerald-50/80 rounded-xl border border-emerald-100">
                <Shield size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-900 font-medium leading-relaxed">
                  Your store location and registered pincode determine local quick delivery availability.
                  Pan-India customers across all other pincodes can still order via Shiprocket courier.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar Security & Trust Card */}
        <div className="space-y-6">
          <Card className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-[#0B132B] via-[#1C2541] to-[#0A1128] text-white border-t-4 border-t-[#6666FF] shadow-xl relative overflow-hidden">
            {/* Background Accent Glows */}
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-[#6666FF]/25 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-blue-600/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10 relative z-10">
              <h4 className="text-xs font-black uppercase tracking-[2px] text-brand-300 flex items-center gap-2">
                <Shield size={18} className="text-[#6666FF]" /> Security & Trust
              </h4>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black tracking-wider border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle size={12} /> SECURE
              </span>
            </div>

            <div className="space-y-3.5 relative z-10">
              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-[#7777FF] to-[#6666FF] text-white shadow-lg shadow-[#6666FF]/30 flex items-center justify-center shrink-0">
                  <Shield size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-300">
                    Verification Status
                  </p>
                  <p className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
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

              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center shrink-0">
                  <Rocket size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">
                    Partner Tier
                  </p>
                  <p className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
                    Standard Growth
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md font-bold border border-blue-400/30">PRO</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center shrink-0">
                  <Globe size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                    Coverage Region
                  </p>
                  <p className="text-sm font-bold text-white mt-0.5">Pan India Reach</p>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <div className="p-3 rounded-xl bg-gradient-to-r from-[#6666FF]/10 to-blue-500/10 border border-white/10 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#6666FF]/20 text-[#6666FF] shrink-0">
                    <Shield size={16} />
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium leading-tight">
                    256-Bit Encrypted Data & Store Identity Verification Active
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 px-1 text-xs font-bold text-slate-400">
                  <Link to="/seller/terms" target="_blank" className="hover:text-white transition-colors underline">
                    Seller Terms
                  </Link>
                  <span>•</span>
                  <Link to="/seller/privacy" target="_blank" className="hover:text-white transition-colors underline">
                    Seller Privacy Policy
                  </Link>
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
