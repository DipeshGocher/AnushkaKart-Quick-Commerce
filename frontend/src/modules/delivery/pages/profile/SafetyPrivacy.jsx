import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Phone,
  Trash2,
  Shield,
  AlertTriangle,
  PhoneCall,
  UserPlus,
  Loader2,
  Ambulance,
  Headphones,
  CheckCircle2,
  X,
  MapPin,
  Flame
} from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@core/context/SettingsContext";
import { useAuth } from "@core/context/AuthContext";
import { deliveryApi } from "../../services/deliveryApi";
import Card from "@/shared/components/ui/Card";
import Button from "@/shared/components/ui/Button";

const SafetyPrivacy = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { user, refreshUser } = useAuth();

  const [contacts, setContacts] = useState(user?.emergencyContacts || []);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [showAddContact, setShowAddContact] = useState(false);
  const [savingContacts, setSavingContacts] = useState(false);

  // SOS state
  const [triggeringSOS, setTriggeringSOS] = useState(false);
  const [sosTriggered, setSOSTriggered] = useState(false);
  const [sosDetails, setSosDetails] = useState(null);

  // Long press handling
  const longPressTimer = useRef(null);
  const progressInterval = useRef(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [longPressProgress, setLongPressProgress] = useState(0);

  useEffect(() => {
    if (user?.emergencyContacts) {
      setContacts(user.emergencyContacts);
    }
  }, [user]);

  // Persist contacts to backend
  const persistContacts = useCallback(
    async (updatedContacts) => {
      setSavingContacts(true);
      try {
        await deliveryApi.updateEmergencyContacts({
          contacts: updatedContacts.map((c) => ({
            name: c.name.trim(),
            phone: c.phone.trim(),
          })),
        });
        if (typeof refreshUser === "function") refreshUser();
      } catch (err) {
        console.error("Failed to save contacts:", err);
        toast.error("Failed to save contacts to server");
      } finally {
        setSavingContacts(false);
      }
    },
    [refreshUser]
  );

  const handleAddContact = async () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      toast.error("Please enter both Name and Phone number");
      return;
    }
    const cleanPhone = newContact.phone.trim().replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    const updated = [
      ...contacts,
      { name: newContact.name.trim(), phone: newContact.phone.trim() },
    ];
    setContacts(updated);
    setNewContact({ name: "", phone: "" });
    setShowAddContact(false);
    toast.success("Emergency contact saved!");
    await persistContacts(updated);
  };

  const handleRemoveContact = async (index) => {
    const updated = contacts.filter((_, i) => i !== index);
    setContacts(updated);
    toast.success("Contact removed");
    await persistContacts(updated);
  };

  // Get current device GPS location
  const getCurrentLocation = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ latitude: 0, longitude: 0 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        () => resolve({ latitude: 0, longitude: 0 }),
        { enableHighAccuracy: true, timeout: 6000 }
      );
    });

  // Direct 1-Hold Instant SOS Execution
  const executeInstantSOS = async () => {
    if (triggeringSOS) return;
    setTriggeringSOS(true);
    try {
      const location = await getCurrentLocation();
      await deliveryApi.triggerSOS(location);
      setSOSTriggered(true);
      setSosDetails({
        triggeredAt: new Date(),
        latitude: location.latitude,
        longitude: location.longitude,
      });

      // Haptic feedback
      if (navigator.vibrate) {
        try {
          navigator.vibrate([300, 150, 300, 150, 300]);
        } catch (e) {}
      }

      toast.error("🚨 EMERGENCY SOS DISPATCHED TO ADMIN!", {
        description: "Your live GPS coordinates and emergency contacts have been alerted to the Admin Operations Desk.",
        duration: 7000,
      });
    } catch (err) {
      console.error("SOS trigger error:", err);
      toast.error("Network issue. Please dial 112 directly!");
    } finally {
      setTriggeringSOS(false);
    }
  };

  // SOS button press handlers
  const startLongPress = (e) => {
    if (triggeringSOS || sosTriggered) return;
    setIsLongPressing(true);
    setLongPressProgress(0);

    const startTime = Date.now();
    const duration = 1500; // 1.5 seconds

    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setLongPressProgress(progress);
    }, 25);

    longPressTimer.current = setTimeout(async () => {
      clearInterval(progressInterval.current);
      setIsLongPressing(false);
      setLongPressProgress(100);
      await executeInstantSOS();
    }, duration);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (progressInterval.current) clearInterval(progressInterval.current);
    setIsLongPressing(false);
    setLongPressProgress(0);
  };

  const supportPhone = settings?.supportPhone || settings?.phone || "18001234567";

  return (
    <div className="min-h-screen bg-[#f1f4f8] pb-36 font-['Outfit',_sans-serif] select-none">
      {/* Top Header */}
      <div className="bg-white/95 backdrop-blur-md sticky top-0 z-30 px-4 pt-4 pb-2 border-b border-slate-100 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1"
          aria-label="Back"
        >
          <ChevronLeft size={22} className="text-slate-800" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
            Emergency & Safety
          </h1>
          <p className="text-[11px] text-slate-500 font-medium">
            Instant SOS, Emergency contacts & Helplines
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-5">
        {/* Active Alert Banner if SOS was triggered */}
        {sosTriggered && (
          <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-3xl p-5 shadow-xl shadow-red-500/25 border border-red-500 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                <h3 className="font-black text-sm tracking-wide uppercase">
                  🚨 SOS Alert Dispatched!
                </h3>
              </div>
              <span className="text-[11px] font-mono font-bold bg-white/20 px-2 py-0.5 rounded-md">
                {sosDetails?.triggeredAt
                  ? new Date(sosDetails.triggeredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "Active"}
              </span>
            </div>

            <p className="text-xs text-white/90 mt-2 leading-relaxed font-medium">
              Admin Operations Desk has received your live alert with GPS location. Help is on the way.
            </p>

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/20">
              <a
                href="tel:112"
                className="flex-1 py-2.5 px-3 bg-white text-red-700 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform"
              >
                <PhoneCall size={14} />
                <span>Call 112 Police</span>
              </a>
              <button
                onClick={() => setSOSTriggered(false)}
                className="py-2.5 px-3.5 bg-white/20 hover:bg-white/30 text-white rounded-xl font-bold text-xs active:scale-95 transition-transform"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* 1. Instant SOS Trigger (Real 1-Hold Action) */}
        <div className="bg-gradient-to-br from-rose-50 via-red-50 to-orange-50/60 rounded-3xl p-6 border border-red-200/80 shadow-xs relative overflow-hidden card-left-pill-orange">
          <div className="relative z-10 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-red-700 bg-red-100/80 px-3 py-1 rounded-full uppercase tracking-wider mb-2">
              <AlertTriangle size={14} />
              <span>Emergency SOS</span>
            </div>

            <p className="text-xs text-red-800 font-medium max-w-xs mx-auto leading-relaxed">
              Press and hold the button for 1.5 seconds. Your live GPS coordinates will be instantly dispatched to the Admin Operations Desk.
            </p>

            {/* Circular Hold SOS Button */}
            <div className="flex justify-center mt-6 mb-2">
              <div className="relative w-36 h-36 flex items-center justify-center">
                {/* Background Ring / Glow */}
                <div
                  className={`absolute inset-0 rounded-full transition-all duration-300 ${
                    isLongPressing
                      ? "scale-110 bg-red-500/20 shadow-2xl shadow-red-500/50"
                      : "bg-red-500/10 shadow-lg shadow-red-500/10"
                  }`}
                />

                {/* SVG Progress Ring */}
                <svg
                  className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                  viewBox="0 0 144 144"
                >
                  <circle
                    cx="72"
                    cy="72"
                    r="68"
                    fill="none"
                    stroke={isLongPressing ? "rgba(239, 68, 68, 0.25)" : "transparent"}
                    strokeWidth="5"
                  />
                  {isLongPressing && (
                    <circle
                      cx="72"
                      cy="72"
                      r="68"
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth="5"
                      strokeDasharray={427}
                      strokeDashoffset={427 - (longPressProgress / 100) * 427}
                      strokeLinecap="round"
                    />
                  )}
                </svg>

                {/* Actual Button */}
                <button
                  onMouseDown={startLongPress}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={startLongPress}
                  onTouchEnd={cancelLongPress}
                  onTouchCancel={cancelLongPress}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={triggeringSOS}
                  className={`relative w-28 h-28 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white shadow-xl shadow-red-600/40 flex flex-col items-center justify-center select-none active:scale-95 transition-transform ${
                    isLongPressing ? "scale-95 ring-4 ring-red-400" : ""
                  }`}
                  style={{
                    WebkitTouchCallout: "none",
                    WebkitUserSelect: "none",
                  }}
                  aria-label="Hold SOS Button for 1.5 seconds"
                >
                  {triggeringSOS ? (
                    <Loader2 size={32} className="animate-spin text-white mb-1" />
                  ) : (
                    <Flame size={32} className="mb-0.5 text-white drop-shadow" />
                  )}

                  <span className="text-sm font-black tracking-wider leading-none mt-0.5">
                    {triggeringSOS ? "SENDING..." : "SOS"}
                  </span>
                  <span className="text-[9px] font-bold opacity-90 uppercase tracking-tighter mt-1">
                    {isLongPressing ? `${Math.round(longPressProgress)}%` : "HOLD 1.5s"}
                  </span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-red-600/80 font-bold tracking-tight">
              {isLongPressing ? "Keep holding to confirm emergency..." : "Single tap does nothing • Hold to trigger"}
            </p>
          </div>
        </div>

        {/* 2. Emergency Contacts (Family / Friends) */}
        <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs card-left-pill-orange">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#6666FF] flex items-center justify-center">
                <Shield size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Emergency Contacts</h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Family/friends notified during emergency
                </p>
              </div>
            </div>

            {savingContacts && (
              <Loader2 size={16} className="animate-spin text-slate-400" />
            )}
          </div>

          <div className="space-y-2.5 mt-4">
            {contacts.length > 0 ? (
              contacts.map((contact, idx) => (
                <div
                  key={contact._id || idx}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between gap-3 hover:bg-slate-100/70 transition-colors"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm truncate">
                      {contact.name}
                    </h4>
                    <p className="text-xs font-mono text-slate-500 flex items-center mt-0.5">
                      <Phone size={11} className="mr-1 text-slate-400" />
                      {contact.phone}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Direct 1-Tap Call Button */}
                    <a
                      href={`tel:${contact.phone}`}
                      className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-xs active:scale-95 transition-all"
                      title={`Call ${contact.name}`}
                    >
                      <PhoneCall size={15} />
                    </a>

                    {/* Delete button */}
                    <button
                      onClick={() => handleRemoveContact(idx)}
                      disabled={savingContacts}
                      className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors"
                      title="Remove contact"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 px-4 border border-dashed border-slate-200 rounded-2xl">
                <Shield className="mx-auto text-slate-300 mb-1.5" size={26} />
                <p className="text-xs font-bold text-slate-600">No emergency contacts added yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Add 1-3 contacts (parents, spouse, brother) for road safety.
                </p>
              </div>
            )}

            {/* Add Contact Form or Button */}
            {showAddContact ? (
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3 mt-3">
                <p className="text-xs font-bold text-slate-700">Add New Contact</p>
                <input
                  type="text"
                  placeholder="Name (e.g. Papa, Brother, Friend)"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-medium outline-none focus:border-[#6666FF] transition-all"
                />
                <input
                  type="tel"
                  placeholder="10-digit Phone Number"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-mono font-medium outline-none focus:border-[#6666FF] transition-all"
                />
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleAddContact}
                    disabled={savingContacts}
                    className="flex-1 bg-[#6666FF] hover:bg-[#5555EE] text-white text-xs font-bold py-2 rounded-xl"
                  >
                    {savingContacts ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                    Save Contact
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddContact(false);
                      setNewContact({ name: "", phone: "" });
                    }}
                    className="flex-1 text-xs text-slate-500 py-2 rounded-xl hover:bg-slate-200/50"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddContact(true)}
                className="w-full py-2.5 px-4 rounded-2xl border border-dashed border-slate-300 text-slate-600 hover:border-[#6666FF] hover:text-[#6666FF] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors mt-2"
              >
                <UserPlus size={15} />
                <span>Add Emergency Contact</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. Quick Helplines (1-Tap Emergency Dials) */}
        <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs card-left-pill-orange">
          <div className="mb-3">
            <h3 className="font-bold text-slate-900 text-sm">Quick Helplines</h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Immediate national emergency numbers & rider support
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Police / National Emergency (112) */}
            <a
              href="tel:112"
              className="p-3.5 rounded-2xl bg-slate-900 text-white flex items-center justify-between sm:flex-col sm:items-start gap-2 hover:bg-slate-800 transition-colors active:scale-95 shadow-xs"
            >
              <div className="flex items-center gap-2.5 sm:flex-col sm:items-start">
                <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                  <PhoneCall size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black tracking-wide">National Police</h4>
                  <p className="text-[11px] text-slate-300 font-mono font-bold">112</p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
                Call Now
              </span>
            </a>

            {/* Medical / Ambulance (108) */}
            <a
              href="tel:108"
              className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between sm:flex-col sm:items-start gap-2 hover:bg-rose-100/70 transition-colors active:scale-95 shadow-xs"
            >
              <div className="flex items-center gap-2.5 sm:flex-col sm:items-start">
                <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
                  <Ambulance size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black tracking-wide">Ambulance</h4>
                  <p className="text-[11px] text-rose-700 font-mono font-bold">108</p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-rose-200/80 text-rose-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Call Now
              </span>
            </a>

            {/* Partner Support Desk */}
            <a
              href={`tel:${supportPhone}`}
              className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 flex items-center justify-between sm:flex-col sm:items-start gap-2 hover:bg-indigo-100/70 transition-colors active:scale-95 shadow-xs"
            >
              <div className="flex items-center gap-2.5 sm:flex-col sm:items-start">
                <div className="w-8 h-8 rounded-xl bg-[#6666FF] text-white flex items-center justify-center shrink-0">
                  <Headphones size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black tracking-wide">Partner Support</h4>
                  <p className="text-[11px] text-indigo-700 font-mono font-bold truncate max-w-[120px]">
                    Help Desk
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-indigo-200/80 text-indigo-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Call Now
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafetyPrivacy;
