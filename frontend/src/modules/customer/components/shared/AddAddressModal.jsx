import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Search,
  MapPin,
  Building2,
  ChevronRight,
  Check,
  User,
  Phone,
  Home,
  Briefcase,
  Navigation,
  ArrowLeft,
  Loader2,
  Contact2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/core/context/AuthContext";
import { useLocation } from "../../context/LocationContext";
import { customerApi } from "../../services/customerApi";
import { loadGoogleMaps } from "@/core/services/googleMapsLoader";
import { getCachedGeocode, setCachedGeocode } from "@/core/utils/geocodeCache";

// Calculate distance between two coordinates in km / m
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  if (d < 1) return `${Math.round(d * 1000)} m`;
  return `${d.toFixed(1)} km`;
}

export default function AddAddressModal({
  isOpen,
  onClose,
  onAddressSaved,
  initialAddress = null,
}) {
  const { user } = useAuth();
  const { currentLocation, updateLocation, refreshAddresses } = useLocation();

  // Primary form state
  const [addressType, setAddressType] = useState("home"); // 'home' | 'work' | 'other'
  const [contactMode, setContactMode] = useState("myself"); // 'myself' | 'someone_else'
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [completeAddress, setCompleteAddress] = useState("");
  const [landmark, setLandmark] = useState("");

  // Location details auto-filled by Google Maps
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedPincode, setSelectedPincode] = useState("");
  const [selectedCoords, setSelectedCoords] = useState(null); // { lat, lng }
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [formattedAddress, setFormattedAddress] = useState("");

  // Sub-modal state: Google Places Search sheet
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [placePredictions, setPlacePredictions] = useState([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState("");
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);
  const [saving, setSaving] = useState(false);

  // Google Maps services refs
  const mapsReadyRef = useRef(false);
  const autocompleteServiceRef = useRef(null);
  const geocoderRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const latestRequestRef = useRef(0);
  const searchInputRef = useRef(null);

  // Initialize form when opening
  useEffect(() => {
    if (!isOpen) return;

    if (initialAddress) {
      setReceiverName(initialAddress.name || initialAddress.receiverName || "");
      const rawPhone = initialAddress.phone || initialAddress.receiverPhone || "";
      setReceiverPhone(rawPhone.replace(/^\+91/, "").trim());
      setContactMode("myself");

      let parsedCity = initialAddress.city || "";
      let parsedPin = initialAddress.pincode || "";
      const pinMatch = parsedCity.match(/\b\d{6}\b/);
      if (pinMatch) {
        if (!parsedPin) parsedPin = pinMatch[0];
        parsedCity = parsedCity.replace(/\b\d{6}\b/, "").trim();
      }

      setSelectedCity(parsedCity);
      setSelectedState(initialAddress.state || "");
      setSelectedPincode(parsedPin);
      setSelectedArea(initialAddress.area || initialAddress.street || initialAddress.areaName || initialAddress.address || "");
      setSelectedCoords(initialAddress.location || null);
      setSelectedPlaceId(initialAddress.placeId || "");
      setFormattedAddress(initialAddress.formattedAddress || initialAddress.address || "");
      setCompleteAddress(initialAddress.address || initialAddress.fullAddress || "");
      setLandmark(initialAddress.landmark || "");
      setAddressType(
        (initialAddress.type || initialAddress.label || "home").toLowerCase()
      );
    } else {
      // "+ Add new address" -> EVERYTHING EMPTY
      setReceiverName("");
      setReceiverPhone("");
      setContactMode("myself");
      setCompleteAddress("");
      setLandmark("");
      setSelectedArea("");
      setSelectedCity("");
      setSelectedState("");
      setSelectedPincode("");
      setSelectedCoords(null);
      setSelectedPlaceId("");
      setFormattedAddress("");
      setAddressType("home");
    }

    setIsSearchSheetOpen(false);
    setSearchQuery("");
    setPlacePredictions([]);
  }, [isOpen, initialAddress]);

  // Handle contactMode change
  const handleContactModeChange = (mode) => {
    setContactMode(mode);
    if (mode === "myself") {
      setReceiverName(user?.name || "");
      setReceiverPhone((user?.phone || "").replace(/^\+91/, "").trim());
    } else {
      setReceiverName("");
      setReceiverPhone("");
    }
  };

  // Init Google Maps Places
  const initGooglePlaces = useCallback(async () => {
    if (mapsReadyRef.current && autocompleteServiceRef.current && geocoderRef.current) {
      return true;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setPlacesError("Google Maps API key is missing");
      return false;
    }

    try {
      await loadGoogleMaps(apiKey);
      if (!window.google?.maps?.places) {
        setPlacesError("Google Places library is unavailable");
        return false;
      }
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      geocoderRef.current = new window.google.maps.Geocoder();
      mapsReadyRef.current = true;
      return true;
    } catch (err) {
      setPlacesError(err?.message || "Failed to load Google Maps");
      return false;
    }
  }, []);

  // Open Search Sheet and focus input
  const openSearchSheet = async () => {
    setIsSearchSheetOpen(true);
    await initGooglePlaces();
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);
  };

  // Google Places query search with debounce
  useEffect(() => {
    if (!isSearchSheetOpen) return;

    const query = searchQuery.trim();
    if (query.length < 2) {
      setPlacePredictions([]);
      setIsSearchingPlaces(false);
      setPlacesError("");
      return;
    }

    const timer = setTimeout(async () => {
      const ready = await initGooglePlaces();
      if (!ready || !autocompleteServiceRef.current) return;

      const requestId = latestRequestRef.current + 1;
      latestRequestRef.current = requestId;
      setIsSearchingPlaces(true);
      setPlacesError("");

      if (!sessionTokenRef.current && window.google?.maps?.places?.AutocompleteSessionToken) {
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      }

      const request = {
        input: query,
        componentRestrictions: { country: "in" },
        sessionToken: sessionTokenRef.current,
      };

      const lat = Number(currentLocation?.latitude);
      const lng = Number(currentLocation?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        request.location = new window.google.maps.LatLng(lat, lng);
        request.radius = 40000; // 40 km bias
      }

      autocompleteServiceRef.current.getPlacePredictions(request, (predictions, status) => {
        if (requestId !== latestRequestRef.current) return;
        setIsSearchingPlaces(false);

        if (status === window.google?.maps?.places?.PlacesServiceStatus?.OK && Array.isArray(predictions)) {
          setPlacePredictions(predictions.slice(0, 8));
        } else if (status === window.google?.maps?.places?.PlacesServiceStatus?.ZERO_RESULTS) {
          setPlacePredictions([]);
        } else {
          setPlacePredictions([]);
          // Try backend geocode as fallback if Google autocomplete fails
          customerApi
            .geocodeAddress(query)
            .then((res) => {
              const loc = res.data?.result?.location;
              if (loc && typeof loc.lat === "number") {
                setPlacePredictions([
                  {
                    place_id: res.data?.result?.placeId || `fallback-${Date.now()}`,
                    description: res.data?.result?.formattedAddress || query,
                    structured_formatting: {
                      main_text: query,
                      secondary_text: res.data?.result?.formattedAddress || "",
                    },
                    _fallbackLocation: loc,
                  },
                ]);
              }
            })
            .catch(() => {});
        }
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearchSheetOpen, currentLocation, initGooglePlaces]);

  // Helper to extract component from geocoder results
  const getComponent = (components, types) => {
    return components?.find((c) => types.some((t) => c.types.includes(t)))?.long_name || "";
  };

  // Handle selecting a place from search predictions
  const handleSelectPlace = async (prediction) => {
    setIsResolvingPlace(true);
    setPlacesError("");

    try {
      let resolvedLoc = null;
      let city = "";
      let state = "";
      let pincode = "";
      let area = "";
      let fullFormatted = "";

      if (prediction._fallbackLocation) {
        resolvedLoc = prediction._fallbackLocation;
        fullFormatted = prediction.description;
        area = prediction.structured_formatting?.main_text || prediction.description;
      } else if (prediction.place_id && geocoderRef.current) {
        const results = await new Promise((resolve) => {
          geocoderRef.current.geocode({ placeId: prediction.place_id }, (res, status) => {
            if (status === "OK" && Array.isArray(res) && res[0]) {
              resolve(res[0]);
            } else {
              resolve(null);
            }
          });
        });

        if (results) {
          const comps = results.address_components || [];
          city =
            getComponent(comps, ["locality"]) ||
            getComponent(comps, ["administrative_area_level_2"]) ||
            getComponent(comps, ["sublocality_level_1"]);
          state = getComponent(comps, ["administrative_area_level_1"]);
          pincode = getComponent(comps, ["postal_code"]);
          area =
            getComponent(comps, ["sublocality_level_1"]) ||
            getComponent(comps, ["sublocality"]) ||
            getComponent(comps, ["neighborhood"]) ||
            prediction.structured_formatting?.main_text ||
            "";
          fullFormatted = results.formatted_address || prediction.description;

          if (results.geometry?.location) {
            resolvedLoc = {
              lat: results.geometry.location.lat(),
              lng: results.geometry.location.lng(),
            };
          }
        }
      }

      // If Geocoder didn't return complete pincode, extract 6-digit pin from string
      if (!pincode) {
        const pinMatch = fullFormatted.match(/\b\d{6}\b/) || prediction.description.match(/\b\d{6}\b/);
        if (pinMatch) pincode = pinMatch[0];
      }

      // If still missing coordinates, call server geocode
      if (!resolvedLoc && prediction.description) {
        try {
          const geoRes = await customerApi.geocodeAddress(prediction.description);
          const loc = geoRes.data?.result?.location;
          if (loc?.lat && loc?.lng) {
            resolvedLoc = { lat: loc.lat, lng: loc.lng };
          }
        } catch {
          // ignore
        }
      }

      // Update state with resolved location details
      setSelectedArea(area || prediction.structured_formatting?.main_text || prediction.description);
      if (city) setSelectedCity(city);
      if (state) setSelectedState(state);
      if (pincode) setSelectedPincode(pincode);
      if (resolvedLoc) setSelectedCoords(resolvedLoc);
      setSelectedPlaceId(prediction.place_id || "");
      setFormattedAddress(fullFormatted || prediction.description);

      // Close search sheet
      setIsSearchSheetOpen(false);
      setSearchQuery("");
      setPlacePredictions([]);
      sessionTokenRef.current = null;
    } catch (err) {
      setPlacesError("Could not resolve location details. Please try again.");
    } finally {
      setIsResolvingPlace(false);
    }
  };

  // Submit and save new address
  const handleSaveAddress = async () => {
    const trimmedAddress = completeAddress.trim();
    const trimmedName = receiverName.trim();
    const cleanPhone = receiverPhone.replace(/\D/g, "");

    if (!selectedArea && !selectedCity) {
      toast.error("Please click 'Select an area, street' to pick your location first");
      return;
    }

    if (!trimmedAddress) {
      toast.error("Please enter complete address (Flat/House No., Building, etc.)");
      return;
    }

    if (!trimmedName) {
      toast.error("Please enter receiver's name");
      return;
    }

    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    setSaving(true);
    try {
      // 1. Build unified full address string
      const fullAddressParts = [
        trimmedAddress,
        selectedArea,
        landmark.trim(),
        selectedCity,
        selectedState,
        selectedPincode,
      ].filter(Boolean);
      const unifiedFullAddress = fullAddressParts.join(", ");

      const newAddrObject = {
        label: addressType.toLowerCase(),
        fullAddress: unifiedFullAddress,
        formattedAddress: formattedAddress || unifiedFullAddress,
        landmark: landmark.trim() || undefined,
        city: selectedCity || undefined,
        state: selectedState || undefined,
        pincode: selectedPincode || undefined,
        location: selectedCoords || undefined,
        placeId: selectedPlaceId || undefined,
        receiverName: trimmedName,
        receiverPhone: cleanPhone.startsWith("91") && cleanPhone.length > 10 ? `+${cleanPhone}` : `+91${cleanPhone.slice(-10)}`,
      };

      // 2. Fetch existing profile addresses
      let currentAddresses = [];
      try {
        const { data } = await customerApi.getProfile();
        const profile = data?.result ?? data?.data ?? data;
        if (Array.isArray(profile?.addresses)) {
          currentAddresses = profile.addresses;
        }
      } catch {
        currentAddresses = [];
      }

      // If editing existing address, update it in place; otherwise add new address to top
      let updatedAddresses;
      const targetId = initialAddress?.id || initialAddress?._id;
      if (targetId) {
        let found = false;
        updatedAddresses = currentAddresses.map((a, i) => {
          if (a._id === targetId || a.id === targetId || String(i) === String(targetId)) {
            found = true;
            return { ...a, ...newAddrObject };
          }
          return a;
        });
        if (!found) {
          updatedAddresses = [newAddrObject, ...currentAddresses];
        }
      } else {
        updatedAddresses = [newAddrObject, ...currentAddresses];
      }

      // 3. Save to backend customer profile
      await customerApi.updateProfile({
        name: trimmedName,
        phone: newAddrObject.receiverPhone,
        addresses: updatedAddresses,
      });

      // 4. Update LocationContext so Header, Pincode & Coordinates update everywhere immediately!
      updateLocation(
        {
          name: unifiedFullAddress,
          time: "20-35 mins",
          city: selectedCity,
          state: selectedState,
          pincode: selectedPincode,
          latitude: selectedCoords?.lat,
          longitude: selectedCoords?.lng,
          addressId: targetId || `addr-${Date.now()}`,
        },
        { persist: true, updateSavedHome: addressType === "home" }
      );

      await refreshAddresses?.();

      toast.success(initialAddress ? "Delivery address updated successfully!" : "Delivery address saved successfully!");

      if (onAddressSaved) {
        onAddressSaved({
          ...newAddrObject,
          id: targetId || `addr-${Date.now()}`,
          phone: newAddrObject.receiverPhone,
          name: trimmedName,
          address: unifiedFullAddress,
        });
      }

      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end md:items-center justify-center pointer-events-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Modal / Bottom Sheet */}
          <motion.div
            initial={{ y: "100%", opacity: 0.9 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="relative z-10 w-full max-w-lg bg-[#f8f9fb] rounded-t-[28px] md:rounded-[24px] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
          >
            {/* Header (Matching Image 3) */}
            <div className="bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-base font-bold text-slate-800">
                  {initialAddress ? "Edit address details" : "Add address details"}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
              {/* Section 1: Address details */}
              <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-100 space-y-3">
                <h3 className="text-sm font-bold text-slate-800">Address details</h3>

                {/* Card 1: City (Auto-filled from selected area) */}
                <div
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/70 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                      <Building2 size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400 font-medium">City</p>
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {selectedCity || "Auto-detected when area is selected"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card 2: Select an area, street (Images 3, 4, 5 trigger) */}
                <div
                  onClick={openSearchSheet}
                  className="flex items-center justify-between p-3.5 rounded-xl border-2 border-emerald-500/80 hover:border-emerald-600 bg-emerald-50/20 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                      <MapPin size={22} className="fill-amber-500 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-emerald-700 font-semibold">Area / Street location</p>
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {selectedArea || "Select an area, street"}
                      </p>
                    </div>
                  </div>
                  <span className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors shrink-0 shadow-2xs">
                    {selectedArea ? "Change" : "Select"}
                  </span>
                </div>

                {/* Auto-filled details pill (shows pincode + state once resolved from area) */}
                {Boolean(selectedArea && (selectedPincode || selectedCity || selectedState)) && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[11.5px] font-medium text-slate-600">
                    <Check size={14} className="text-emerald-600 shrink-0 stroke-[3]" />
                    <span className="truncate">
                      Auto-detected:{" "}
                      <strong>
                        {[selectedPincode && `PIN ${selectedPincode}`, selectedCity, selectedState]
                          .filter(Boolean)
                          .join(", ")}
                      </strong>
                    </span>
                  </div>
                )}

                {/* Input: Enter complete address* */}
                <div className="space-y-1 pt-1">
                  <input
                    type="text"
                    placeholder="Enter complete address* (Flat No., Building, Floor)"
                    value={completeAddress}
                    onChange={(e) => setCompleteAddress(e.target.value)}
                    className="w-full h-12 px-3.5 rounded-xl border border-slate-200 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                </div>

              {/* Input: Nearest Landmark (optional) */}
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Nearest Landmark (optional) / Google maps note"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Section 2: Contact details (Matching Image 3) */}
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-100 space-y-3.5">
              <h3 className="text-sm font-bold text-slate-800">Contact details</h3>

              {/* Myself vs Someone else radio toggle */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="contactMode"
                    value="myself"
                    checked={contactMode === "myself"}
                    onChange={() => handleContactModeChange("myself")}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-700">Myself</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="contactMode"
                    value="someone_else"
                    checked={contactMode === "someone_else"}
                    onChange={() => handleContactModeChange("someone_else")}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-700">Someone else</span>
                </label>
              </div>

              {/* Receiver's name */}
              <div>
                <input
                  type="text"
                  placeholder="Receiver's name*"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Receiver's phone number */}
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs font-bold text-slate-500 select-none">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="Receiver's phone number*"
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value.replace(/\D/g, ""))}
                  className="w-full h-11 pl-12 pr-10 rounded-xl border border-slate-200 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                />
                <Contact2 size={18} className="absolute right-3.5 text-slate-400 pointer-events-none" />
              </div>

              {/* Save as address tags */}
              <div className="pt-1">
                <p className="text-xs font-medium text-slate-500 mb-2">Save as address (optional)</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAddressType("home")}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      addressType === "home"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-2xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Home size={14} /> Home
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddressType("work")}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      addressType === "work"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-2xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Briefcase size={14} /> Work
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddressType("other")}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      addressType === "other"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-2xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <MapPin size={14} /> Other
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Button (Matching Image 3) */}
          <div className="bg-white p-4 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={handleSaveAddress}
              disabled={saving}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> {initialAddress ? "Updating Address..." : "Saving Address..."}
                </>
              ) : (
                initialAddress ? "Update Address & Deliver Here" : "Save Address & Deliver Here"
              )}
            </button>
          </div>

          {/* Sub-Modal / Bottom Sheet: Select an area, street (Images 4 & 5) */}
          <AnimatePresence>
            {isSearchSheetOpen && (
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="absolute inset-0 z-50 bg-white flex flex-col rounded-t-[28px] md:rounded-[24px] overflow-hidden"
              >
                {/* Search Sheet Header */}
                <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <h3 className="text-base font-bold text-slate-900">Select an area, street</h3>
                  <button
                    type="button"
                    onClick={() => setIsSearchSheetOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-black transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Search Input Bar */}
                <div className="p-4 border-b border-slate-100 shrink-0">
                  <div className="relative flex items-center">
                    <Search size={18} className="absolute left-3.5 text-emerald-600 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search for area, street name.."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-11 pl-10 pr-9 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setPlacePredictions([]);
                          searchInputRef.current?.focus();
                        }}
                        className="absolute right-3 w-5 h-5 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center hover:bg-slate-400 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Search Results List (Images 4 & 5 Design) */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 no-scrollbar">
                  {isSearchingPlaces && placePredictions.length === 0 && (
                    <div className="p-6 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
                      <Loader2 size={20} className="animate-spin text-emerald-600" />
                      Searching locations with Google Maps...
                    </div>
                  )}

                  {isResolvingPlace && (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-2 justify-center">
                      <Loader2 size={16} className="animate-spin" /> Resolving location details & pincode...
                    </div>
                  )}

                  {placePredictions.map((item) => {
                    // Calculate distance if available
                    const distString =
                      currentLocation?.latitude && currentLocation?.longitude
                        ? calculateDistance(
                            currentLocation.latitude,
                            currentLocation.longitude,
                            item._fallbackLocation?.lat,
                            item._fallbackLocation?.lng
                          )
                        : null;

                    const title = item.structured_formatting?.main_text || item.description;
                    const subtitle = item.structured_formatting?.secondary_text || item.description;

                    return (
                      <div
                        key={item.place_id || item.description}
                        onClick={() => handleSelectPlace(item)}
                        className="flex items-center gap-3.5 p-3 rounded-2xl border border-slate-100 hover:border-slate-300 bg-white hover:bg-slate-50/80 transition-all cursor-pointer shadow-2xs group"
                      >
                        {/* Left Pin Box with Distance Badge (Matching Images 4 & 5) */}
                        <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-between overflow-hidden shrink-0">
                          <div className="flex-1 flex items-center justify-center pt-0.5">
                            <MapPin size={20} className="fill-amber-400 text-amber-500" />
                          </div>
                          <div className="w-full bg-slate-700 text-white text-[8.5px] font-bold text-center py-0.5 leading-none">
                            {distString || "Location"}
                          </div>
                        </div>

                        {/* Right Content: Title & Subtitle */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[13.5px] font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                            {title}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed truncate mt-0.5">
                            {subtitle}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {!isSearchingPlaces && placePredictions.length === 0 && searchQuery.trim().length >= 2 && (
                    <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                      No locations found for &quot;{searchQuery}&quot;. Try typing an area name or landmark.
                    </div>
                  )}

                  {!searchQuery && (
                    <div className="p-8 text-center text-slate-400 text-xs font-medium space-y-1">
                      <p className="font-bold text-slate-600">Search for your locality</p>
                      <p>Type area name, colony, landmark or pincode (e.g. &quot;aranya nagar&quot; or &quot;161&quot;)</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);
}
