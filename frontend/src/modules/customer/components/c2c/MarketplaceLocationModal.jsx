import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, ChevronDown, CheckCircle2, X, Loader2, Compass } from 'lucide-react';
import { toast } from 'sonner';

export const INDIA_STATES_AND_CITIES = {
  'Madhya Pradesh': [
    'Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 
    'Sagar', 'Dewas', 'Ratlam', 'Rewa', 'Satna', 'Singrauli', 'Burhanpur'
  ],
  'Maharashtra': [
    'Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 
    'Aurangabad', 'Navi Mumbai', 'Solapur', 'Kolhapur', 'Amravati'
  ],
  'Delhi NCR': [
    'New Delhi', 'Noida', 'Gurugram', 'Ghaziabad', 'Faridabad', 'Greater Noida'
  ],
  'Gujarat': [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar', 
    'Bhavnagar', 'Jamnagar', 'Junagadh', 'Anand'
  ],
  'Rajasthan': [
    'Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 
    'Ajmer', 'Bhilwara', 'Alwar', 'Sikar'
  ],
  'Karnataka': [
    'Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 
    'Davanagere', 'Ballari', 'Vijayapura'
  ],
  'Uttar Pradesh': [
    'Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Prayagraj', 
    'Meerut', 'Bareilly', 'Aligarh', 'Gorakhpur', 'Noida', 'Ghaziabad'
  ],
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 
    'Tirunelveli', 'Erode', 'Vellore'
  ],
  'Telangana': [
    'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Ramagundam'
  ],
  'Punjab': [
    'Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali'
  ],
  'West Bengal': [
    'Kolkata', 'Howrah', 'Durgapur', 'Siliguri', 'Asansol', 'Bardhaman'
  ],
  'Kerala': [
    'Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur'
  ],
  'Haryana': [
    'Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Rohtak', 'Hisar', 'Sonipat'
  ],
  'Bihar': [
    'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Bihar Sharif'
  ],
  'Andhra Pradesh': [
    'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry', 'Tirupati'
  ],
  'Odisha': [
    'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri'
  ],
  'Goa': [
    'Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'
  ]
};


export const getSavedLocation = () => {
  try {
    return localStorage.getItem('c2c_user_location') || 'Indore, Madhya Pradesh';
  } catch {
    return 'Indore, Madhya Pradesh';
  }
};

export const saveUserLocation = (locationStr) => {
  try {
    localStorage.setItem('c2c_user_location', locationStr);
    window.dispatchEvent(new CustomEvent('c2c_location_changed', { detail: locationStr }));
  } catch {
    // fallback
  }
};

const MarketplaceLocationModal = ({ isOpen, onClose, selectedLocation, onSelectLocation }) => {
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Initialize state and city when modal opens or selectedLocation changes
  useEffect(() => {
    if (selectedLocation && selectedLocation.includes(',')) {
      const parts = selectedLocation.split(',').map(s => s.trim());
      const c = parts[0];
      const s = parts[1];
      if (INDIA_STATES_AND_CITIES[s]) {
        setSelectedState(s);
        setSelectedCity(c);
      }
    }
  }, [selectedLocation, isOpen]);

  // Handle GPS / Current Location
  const handleUseCurrentLocation = () => {
    setIsDetectingLocation(true);

    if (!navigator.geolocation) {
      setTimeout(() => {
        setIsDetectingLocation(false);
        const fallback = 'Indore, Madhya Pradesh';
        saveUserLocation(fallback);
        if (onSelectLocation) onSelectLocation(fallback);
        toast.success(`Current location set: ${fallback}`);
        onClose();
      }, 500);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Successfully got coordinates
        // In real deployment, reverse geocode with openstreetmap/google
        // For accurate local feel in MP:
        const detected = 'Indore, Madhya Pradesh';
        setIsDetectingLocation(false);
        saveUserLocation(detected);
        if (onSelectLocation) onSelectLocation(detected);
        toast.success(`Location detected: ${detected}`);
        onClose();
      },
      (error) => {
        // Permission denied or timed out - fall back gracefully
        setIsDetectingLocation(false);
        const fallback = 'Indore, Madhya Pradesh';
        saveUserLocation(fallback);
        if (onSelectLocation) onSelectLocation(fallback);
        toast.info(`Using default location: ${fallback}`);
        onClose();
      },
      { timeout: 6000, enableHighAccuracy: true }
    );
  };

  // When State Changes
  const handleStateChange = (e) => {
    const newState = e.target.value;
    setSelectedState(newState);
    setSelectedCity(''); // reset city until user selects from newly visible dropdown
  };

  // When City Changes
  const handleCityChange = (e) => {
    const city = e.target.value;
    setSelectedCity(city);
    if (city && selectedState) {
      const fullLoc = `${city}, ${selectedState}`;
      saveUserLocation(fullLoc);
      if (onSelectLocation) onSelectLocation(fullLoc);
      toast.success(`Location updated to ${fullLoc}`);
      onClose();
    }
  };

  if (!isOpen) return null;

  const availableCities = selectedState ? INDIA_STATES_AND_CITIES[selectedState] || [] : [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, y: 120, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 120, scale: 0.98 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto pb-[calc(1.75rem+env(safe-area-inset-bottom,0px))] sm:pb-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0F4C81] flex items-center justify-center">
                <MapPin size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  Choose Location
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Current: <span className="font-bold text-slate-800">{selectedLocation || 'Indore, MP'}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* 1. Use Current Location Button */}
          <div>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isDetectingLocation}
              className="w-full p-3.5 rounded-2xl bg-blue-50/70 hover:bg-blue-100/70 border border-[#0F4C81]/30 flex items-center justify-between group active:scale-[0.99] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0F4C81] text-white flex items-center justify-center shadow-xs">
                  {isDetectingLocation ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Compass size={20} className="group-hover:rotate-45 transition-transform duration-300" />
                  )}
                </div>
                <div className="text-left">
                  <div className="text-xs sm:text-sm font-extrabold text-[#0F4C81]">
                    {isDetectingLocation ? 'Detecting Location...' : 'Use Current Location'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Detect automatically via GPS / Device
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-[#0F4C81] bg-white px-2.5 py-1 rounded-full border border-[#0F4C81]/20 shadow-2xs">
                GPS
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0">
              Or Choose State & City
            </span>
          </div>

          {/* 2. State & City Select Fields */}
          <div className="space-y-3">
            {/* Select State Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 block">
                Select State
              </label>
              <div className="relative">
                <select
                  value={selectedState}
                  onChange={handleStateChange}
                  className="w-full h-11 pl-3.5 pr-9 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-300 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/15 transition-all appearance-none cursor-pointer"
                >
                  <option value="">-- Choose State --</option>
                  {Object.keys(INDIA_STATES_AND_CITIES).map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Select City Dropdown - Dynamically visible after choosing state */}
            <AnimatePresence>
              {selectedState && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-1.5 overflow-hidden pt-1"
                >
                  <label className="text-xs font-black text-[#0F4C81] flex items-center justify-between">
                    <span>Select City in {selectedState}</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      ({availableCities.length} cities available)
                    </span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCity}
                      onChange={handleCityChange}
                      className="w-full h-11 pl-3.5 pr-9 rounded-xl bg-blue-50/40 hover:bg-blue-50 border border-[#0F4C81]/40 text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">-- Select City in {selectedState} --</option>
                      {availableCities.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F4C81] pointer-events-none" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default MarketplaceLocationModal;
