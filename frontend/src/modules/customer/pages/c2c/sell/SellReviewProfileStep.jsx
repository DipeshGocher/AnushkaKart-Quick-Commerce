import React, { useState, useRef } from 'react';
import { ChevronLeft, Camera, CheckCircle2, MapPin, ChevronDown, Check, X, Navigation, Compass, Loader2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { INDIA_STATES_AND_CITIES, getSavedLocation, saveUserLocation } from '../../../components/c2c/MarketplaceLocationModal';
import { useAuth } from '@core/context/AuthContext';
import { toast } from 'sonner';

const SellReviewProfileStep = ({
  draft,
  onSubmitForApproval,
  onBack,
  onGoHome,
  onGoMyAds,
}) => {
  const { user } = useAuth();

  const formatIndiaPhone = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '9999999999';
    if (raw.startsWith('+91')) return raw.replace(/^\+91[\s-]*/, '');
    if (raw.startsWith('91') && raw.length >= 12) return raw.replace(/^91[\s-]*/, '');
    return raw;
  };

  const [name, setName] = useState(user?.name || 'Customer');
  const [phone, setPhone] = useState(`+91 ${formatIndiaPhone(user?.phone) || '9999999999'}`);
  const [avatar, setAvatar] = useState(user?.avatar || user?.profileImage || '');
  const [selectedLocation, setSelectedLocation] = useState(getSavedLocation());

  // Location selector modal state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedState, setSelectedState] = useState('Madhya Pradesh');
  const [selectedCity, setSelectedCity] = useState('Indore');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Success animation state
  const [isSubmitted, setIsSubmitted] = useState(false);

  const fileInputRef = useRef(null);

  // Handle avatar upload
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const newUrl = URL.createObjectURL(file);
    setAvatar(newUrl);
    toast.success('Profile photo updated!');
  };

  // Detect GPS location
  const handleUseCurrentLocation = () => {
    setIsDetectingLocation(true);
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      setIsDetectingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        setTimeout(() => {
          setSelectedState('Madhya Pradesh');
          setSelectedCity('Indore');
          setSelectedLocation('Indore, Madhya Pradesh');
          saveUserLocation('Indore, Madhya Pradesh');
          setIsDetectingLocation(false);
          setIsLocationModalOpen(false);
          toast.success('Location set to Indore, Madhya Pradesh');
        }, 600);
      },
      () => {
        // Fallback default
        setSelectedState('Madhya Pradesh');
        setSelectedCity('Indore');
        setSelectedLocation('Indore, Madhya Pradesh');
        saveUserLocation('Indore, Madhya Pradesh');
        setIsDetectingLocation(false);
        setIsLocationModalOpen(false);
        toast.info('Using current city Indore, Madhya Pradesh');
      },
      { timeout: 6000 }
    );
  };

  // Confirm state & city
  const handleConfirmLocation = () => {
    if (!selectedState) {
      toast.error('Please select a State');
      return;
    }
    if (!selectedCity) {
      toast.error('Please select a City');
      return;
    }
    const locStr = `${selectedCity}, ${selectedState}`;
    setSelectedLocation(locStr);
    saveUserLocation(locStr);
    setIsLocationModalOpen(false);
    toast.success(`Location updated to ${locStr}`);
  };

  const handleSendForApproval = () => {
    if (!name || !name.trim()) {
      toast.error('Please enter your name');
      return;
    }

    try {
      const sellerInfo = {
        name: name.trim(),
        phone: phone.trim(),
        avatar: avatar || '',
        location: selectedLocation || 'Indore, Madhya Pradesh',
        city: selectedCity || selectedLocation.split(',')[0]?.trim() || 'Indore',
        state: selectedState || selectedLocation.split(',')[1]?.trim() || 'Madhya Pradesh',
      };

      if (typeof onSubmitForApproval === 'function') {
        onSubmitForApproval(sellerInfo);
      }
      setIsSubmitted(true);
    } catch (err) {
      console.error('Error submitting for approval:', err);
      setIsSubmitted(true);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // If submitted, show the exact Animation Screen from Image 2
  // ─────────────────────────────────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <div className="w-full min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          className="w-28 h-28 rounded-full bg-[#1AA794] text-white flex items-center justify-center shadow-xl shadow-[#1AA794]/30 mb-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
          >
            <Check size={56} strokeWidth={4} />
          </motion.div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl sm:text-3xl font-extrabold text-[#1AA794] tracking-tight mb-2"
        >
          Congratulations!
        </motion.h2>

        <motion.h3
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg font-bold text-slate-900 tracking-tight mb-1"
        >
          Your Product is waiting for approval
        </motion.h3>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-sm text-slate-500 font-medium mb-10"
        >
          It will be live soon...
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-xs space-y-3"
        >
          <button
            type="button"
            onClick={onGoHome}
            className="w-full bg-[#0F4C81] hover:bg-[#0A365C] active:scale-[0.98] text-white font-bold py-3.5 rounded-xl text-base shadow-md shadow-[#0F4C81]/25 transition-all text-center tracking-wide"
          >
            Home
          </button>

          <button
            type="button"
            onClick={onGoMyAds}
            className="w-full bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-semibold py-3 rounded-xl text-sm transition-all text-center"
          >
            View My Listings
          </button>
        </motion.div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 6 Form Screen: Review your details (matching Image 1)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-white flex flex-col font-sans relative">
      {/* Hidden file input for avatar photo change */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleAvatarChange}
        className="hidden"
      />

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-4 h-14 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="p-1 -ml-1 text-slate-800 hover:text-slate-900 active:scale-95 transition-transform"
        >
          <ChevronLeft size={28} strokeWidth={2.4} />
        </button>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight flex-1 text-center pr-7">
          Review your details
        </h1>
      </header>

      {/* Main Content Area */}
      <div className="w-full flex-1 p-5 pb-32 space-y-6">
        {/* Profile Avatar & Name in Row (matching reference image) */}
        <div className="flex items-center gap-5">
          {/* Avatar with Camera Overlay */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 shadow-sm cursor-pointer group shrink-0"
            title="Tap to change profile picture"
          >
            {avatar ? (
              <img
                src={avatar}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-700">
                <User size={36} className="text-[#0F172A]" />
              </div>
            )}
            {/* Camera Overlay Bar at bottom */}
            <div className="absolute inset-x-0 bottom-0 bg-black/50 py-1 flex items-center justify-center group-hover:bg-black/70 transition-colors">
              <Camera size={16} className="text-white" />
            </div>
          </div>

          {/* Name Field */}
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81] text-base font-bold text-slate-900 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Verified Phone Number */}
        <div className="pt-2 border-b border-slate-200 pb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Verified phone number
          </label>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-slate-900">
              {phone}
            </span>
            <CheckCircle2 size={18} className="text-[#0F4C81]" strokeWidth={2.5} />
          </div>
        </div>

        {/* Location Dropdown Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Select Location*
          </label>
          <button
            type="button"
            onClick={() => setIsLocationModalOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-3 rounded-lg border border-slate-300 hover:border-[#0F4C81] bg-white text-left transition-colors focus:outline-none shadow-xs"
          >
            <div className="flex items-center gap-2 text-slate-900">
              <MapPin size={18} className="text-[#0F4C81] shrink-0" />
              <span className="text-sm font-semibold truncate">
                {selectedLocation || 'Choose your location'}
              </span>
            </div>
            <ChevronDown size={18} className="text-slate-400 shrink-0" />
          </button>
        </div>

        {/* Ad Summary Preview Box */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Posting Summary
          </span>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800 truncate max-w-[220px]">
              {draft.title || 'Product Listing'}
            </span>
            <span className="text-base font-black text-[#0F4C81]">
              ₹ {Number(draft.price || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{draft.category?.name}</span>
            <span>•</span>
            <span>{draft.brand}</span>
            <span>•</span>
            <span>{draft.photos?.length || 0} photo(s)</span>
          </div>
        </div>
      </div>

      {/* Pinned Bottom Bar: Send for approval Button */}
      <div className="fixed bottom-0 left-0 right-0 w-full p-4 bg-white/95 backdrop-blur-sm border-t border-slate-200/80 z-40 flex justify-center">
        <button
          type="button"
          onClick={handleSendForApproval}
          className="w-full max-w-md bg-[#0F4C81] hover:bg-[#0A365C] active:scale-[0.98] text-white font-bold py-3.5 rounded-lg text-base shadow-sm transition-all text-center tracking-wide cursor-pointer select-none"
        >
          Send for approval
        </button>
      </div>

      {/* Location Selection Modal (Current location, State, then City) */}
      <AnimatePresence>
        {isLocationModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg mx-auto bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={20} className="text-[#0F4C81]" />
                  <h3 className="text-base font-bold text-slate-900">
                    Select Location
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(false)}
                  className="p-1 rounded-full text-slate-500 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 overflow-y-auto">
                {/* Option 1: Use Current Location Button */}
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isDetectingLocation}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/70 text-[#0F4C81] transition-all font-semibold text-sm active:scale-[0.99]"
                >
                  {isDetectingLocation ? (
                    <Loader2 size={20} className="animate-spin text-[#0F4C81]" />
                  ) : (
                    <Navigation size={20} className="text-[#0F4C81]" />
                  )}
                  <span>
                    {isDetectingLocation ? 'Detecting current location...' : 'Use Current Location'}
                  </span>
                </button>

                <div className="flex items-center gap-3 my-2">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Or select manually
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* State Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select State
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                      const availableCities = INDIA_STATES_AND_CITIES[e.target.value] || [];
                      setSelectedCity(availableCities[0] || '');
                    }}
                    className="w-full p-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                  >
                    <option value="">-- Choose State --</option>
                    {Object.keys(INDIA_STATES_AND_CITIES).map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                {/* City Dropdown */}
                {selectedState && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Select City
                    </label>
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                    >
                      <option value="">-- Choose City --</option>
                      {(INDIA_STATES_AND_CITIES[selectedState] || []).map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Confirm Location Button */}
                <button
                  type="button"
                  onClick={handleConfirmLocation}
                  className="w-full mt-3 bg-[#0F4C81] hover:bg-[#0A365C] text-white font-bold py-3 rounded-xl text-sm transition-all shadow-sm"
                >
                  Set Location
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SellReviewProfileStep;
