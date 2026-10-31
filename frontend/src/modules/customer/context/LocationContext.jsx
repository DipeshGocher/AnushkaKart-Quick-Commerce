import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { customerApi } from "../services/customerApi";
import { hasValidStoredAuthToken } from "@core/utils/authStorage";
import { getJSON, setJSON, STORAGE_KEYS } from "@core/utils/storage";

const LocationContext = createContext(undefined);
const STORAGE_KEY = STORAGE_KEYS.LOCATION;
// 30 days — refresh the cached coordinates if a user comes back to a stale tab
// after roughly a month so we don't keep serving locations from a previous
// address indefinitely.
const LOCATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const LocationProvider = ({ children }) => {
  // Default location (used until we can resolve a better one)
  const [currentLocation, setCurrentLocation] = useState(() => {
    const parsed = getJSON(STORAGE_KEY, null);
    const addressName = parsed?.address || parsed?.name || parsed?.formattedAddress;
    const isRawCoordName = addressName && /^Lat\s*[-+]?\d/i.test(addressName);

    if (parsed && addressName && !isRawCoordName) {
      return {
        name: addressName,
        address: addressName,
        formattedAddress: addressName,
        fullAddress: addressName,
        time: parsed.time && parsed.time !== "12-15 mins" ? parsed.time : "20-35 mins",
        city: parsed.city || "Indore",
        state: parsed.state || "Madhya Pradesh",
        pincode: parsed.pincode || "452018",
        latitude: parsed.latitude ?? 22.711140989838025,
        longitude: parsed.longitude ?? 75.9001552518043,
        addressId: parsed.addressId || null,
        type: parsed.type || "Home",
        receiverName: parsed.receiverName || "",
        phone: parsed.phone || "",
        landmark: parsed.landmark || "",
      };
    }

    return {
      name: "214, Rajshri Palace Colony, Pipliyahana, Indore, Madhya Pradesh 452018, India",
      address: "214, Rajshri Palace Colony, Pipliyahana, Indore, Madhya Pradesh 452018, India",
      formattedAddress: "214, Rajshri Palace Colony, Pipliyahana, Indore, Madhya Pradesh 452018, India",
      fullAddress: "214, Rajshri Palace Colony, Pipliyahana, Indore, Madhya Pradesh 452018, India",
      time: "20-35 mins",
      city: "Indore",
      state: "Madhya Pradesh",
      pincode: "452018",
      latitude: 22.711140989838025,
      longitude: 75.9001552518043,
      type: "Home",
    };
  });

  // Address list for drawer UI – will be hydrated from profile API.
  const [savedAddresses, setSavedAddresses] = useState([]);

  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isLocationReady, setIsLocationReady] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Update the current location.
  // By default this does NOT change saved addresses; only explicit
  // address actions should touch the saved list.
  const updateLocation = (
    newLoc,
    { persist = true, updateSavedHome = false } = {},
  ) => {
    if (!newLoc) return;
    setIsLocationReady(true);
    setCurrentLocation((prev) => {
      const addressText =
        newLoc.address ||
        newLoc.formattedAddress ||
        newLoc.fullAddress ||
        newLoc.name ||
        prev.address ||
        prev.formattedAddress ||
        prev.name ||
        "";

      const addressChanged =
        (newLoc.name !== undefined && newLoc.name !== prev.name) ||
        (newLoc.address !== undefined && newLoc.address !== prev.address) ||
        (newLoc.pincode !== undefined && newLoc.pincode !== prev.pincode) ||
        (newLoc.addressId !== undefined && newLoc.addressId !== prev.addressId);

      const merged = {
        ...prev,
        ...(addressChanged ? { addressId: null, latitude: null, longitude: null } : {}),
        ...newLoc,
        name: addressText,
        address: addressText,
        formattedAddress: addressText,
        fullAddress: addressText,
        type: newLoc.type || newLoc.label || prev.type || "Home",
        receiverName: newLoc.receiverName || newLoc.nameUser || prev.receiverName,
        phone: newLoc.phone || newLoc.receiverPhone || prev.phone,
        landmark: newLoc.landmark !== undefined ? newLoc.landmark : (prev.landmark || ""),
      };

      if (persist) {
        const payload = {
          address: merged.address,
          name: merged.name,
          formattedAddress: merged.formattedAddress,
          city: merged.city,
          state: merged.state,
          pincode: merged.pincode,
          latitude: merged.latitude,
          longitude: merged.longitude,
          addressId: merged.addressId,
          time: merged.time,
          receiverName: merged.receiverName,
          phone: merged.phone,
          type: merged.type,
          landmark: merged.landmark,
        };
        setJSON(STORAGE_KEY, payload, { ttlMs: LOCATION_TTL_MS });
      }
      return merged;
    });

    if (updateSavedHome && (newLoc?.name || newLoc?.address)) {
      const addrStr = newLoc.address || newLoc.name;
      setSavedAddresses((prev) =>
        prev.map((addr) =>
          addr.label === "Home" ? { ...addr, address: addrStr } : addr,
        ),
      );
    }
  };

  const addAddress = (newAddress) => {
    setSavedAddresses((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        label: newAddress.label || "Other",
        address: newAddress.address || newAddress.fullAddress,
        city: newAddress.city,
        state: newAddress.state,
        pincode: newAddress.pincode,
        landmark: newAddress.landmark,
        location: newAddress.location,
        placeId: newAddress.placeId,
        name: newAddress.receiverName || newAddress.name,
        phone: newAddress.receiverPhone || newAddress.phone || "N/A",
        isCurrent: false,
      },
    ]);
  };

  // Resolve location once using browser geolocation + Google Maps Geocoding.
  // Must be called directly from a user gesture (click/tap) for the browser to show the permission prompt.
  const fetchAndCacheLocation = () =>
    new Promise((resolve) => {
      if (
        typeof window === "undefined" ||
        !("navigator" in window) ||
        !navigator.geolocation
      ) {
        resolve({
          ok: false,
          error: "Geolocation is not supported on this device",
        });
        return;
      }

      setIsFetchingLocation(true);
      setLocationError(null);

      const fallbackFromCoords = (latitude, longitude) => {
        const existingCity = currentLocation?.city || "Indore";
        const hasValidExistingName = currentLocation?.name && !/^Lat\s*[-+]?\d/i.test(currentLocation.name);
        return {
          name: hasValidExistingName ? currentLocation.name : `Near ${existingCity}`,
          time: "20-35 mins",
          city: existingCity,
          state: currentLocation?.state || "Madhya Pradesh",
          pincode: currentLocation?.pincode || "452018",
          latitude,
          longitude,
        };
      };

      const handleLocationSuccess = async (latitude, longitude) => {
        try {
          let resolvedLocation = null;

          // 1. Backend Reverse Geocode API (Google Maps with server key & caching, no CORS issues)
          try {
            const res = await customerApi.reverseGeocode({ lat: latitude, lng: longitude });
            const data = res?.data?.result || res?.data;
            if (data && (data.friendlyName || data.formattedAddress)) {
              resolvedLocation = {
                name: data.friendlyName || data.formattedAddress,
                time: "20-35 mins",
                city: data.city || "Indore",
                state: data.state || "Madhya Pradesh",
                pincode: data.pincode || "452018",
                latitude: Number(latitude),
                longitude: Number(longitude),
              };
            }
          } catch (backendErr) {
            console.warn("[LocationContext] Backend reverse geocode failed:", backendErr?.message);
          }

          // 2. Google Maps JS SDK Geocoder (if loaded on window)
          if (!resolvedLocation && typeof window !== "undefined" && window.google?.maps?.Geocoder) {
            try {
              const geocoder = new window.google.maps.Geocoder();
              const googleRes = await new Promise((res, rej) => {
                geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
                  if (status === "OK" && results?.[0]) res(results[0]);
                  else rej(new Error(status));
                });
              });

              if (googleRes) {
                const components = googleRes.address_components || [];
                const getComponent = (types) =>
                  components.find((c) => types.every((t) => c.types.includes(t)))?.long_name;

                const premise = getComponent(["premise"]);
                const neighborhood = getComponent(["neighborhood"]);
                const sublocality = getComponent(["sublocality_level_1", "sublocality"]);
                const locality = getComponent(["locality"]);
                const state = getComponent(["administrative_area_level_1"]);
                const pincode = getComponent(["postal_code"]);

                const displayParts = [];
                if (premise) displayParts.push(premise);
                if (neighborhood) displayParts.push(neighborhood);
                if (sublocality && sublocality !== neighborhood) displayParts.push(sublocality);
                if (locality && !displayParts.includes(locality)) displayParts.push(locality);

                let friendlyName = displayParts.join(", ");
                if (!friendlyName) {
                  const parts = (googleRes.formatted_address || "").split(",");
                  friendlyName = parts.slice(0, 2).join(",").trim() || "Current Location";
                }

                resolvedLocation = {
                  name: friendlyName,
                  time: "20-35 mins",
                  city: locality || "Indore",
                  state: state || "Madhya Pradesh",
                  pincode: pincode || "452018",
                  latitude: Number(latitude),
                  longitude: Number(longitude),
                };
              }
            } catch (jsMapsErr) {
              console.warn("[LocationContext] Google Maps JS reverse geocode failed:", jsMapsErr?.message);
            }
          }

          // 3. Free client-side reverse geocode API (BigDataCloud - reliable in all mobile web & WebViews)
          if (!resolvedLocation) {
            try {
              const bdcRes = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
              );
              if (bdcRes.ok) {
                const bdcData = await bdcRes.json();
                const locality = bdcData.locality || bdcData.city || "";
                const state = bdcData.principalSubdivision || "";
                const pincode = bdcData.postcode || "";
                const displayParts = [];
                if (bdcData.locality && bdcData.locality !== bdcData.city) {
                  displayParts.push(bdcData.locality);
                }
                if (bdcData.city) {
                  displayParts.push(bdcData.city);
                }
                let friendlyName = displayParts.join(", ");
                if (!friendlyName) friendlyName = locality || state || "Current Location";

                resolvedLocation = {
                  name: friendlyName,
                  time: "20-35 mins",
                  city: locality || "Indore",
                  state: state || "Madhya Pradesh",
                  pincode: pincode || "452018",
                  latitude: Number(latitude),
                  longitude: Number(longitude),
                };
              }
            } catch (bdcErr) {
              console.warn("[LocationContext] BigDataCloud reverse geocode failed:", bdcErr?.message);
            }
          }

          // 4. Safe fallback that never outputs lat/lng numbers
          if (!resolvedLocation) {
            resolvedLocation = fallbackFromCoords(latitude, longitude);
          }

          updateLocation(resolvedLocation, {
            persist: true,
            updateSavedHome: false,
          });
          resolve({ ok: true, location: resolvedLocation });
        } catch (err) {
          const loc = fallbackFromCoords(latitude, longitude);
          updateLocation(loc, { persist: true, updateSavedHome: false });
          resolve({
            ok: true,
            location: loc,
            warning: err?.message || "Unable to fetch address",
          });
        } finally {
          setIsFetchingLocation(false);
        }
      };

      const handleLocationError = (error) => {
        const message = typeof error === 'string' ? error : (error.message || "Location permission denied");
        setLocationError(message);
        setIsFetchingLocation(false);
        resolve({ ok: false, error: message });
      };

      // Native Flutter Bridge
      if (window.Flutter) {
        import("../../../lib/appZetoBridge").then(async (m) => {
          const AppZetoBridge = m.default;
          const coords = await AppZetoBridge.getLocation();
          if (coords && coords.lat && coords.lng) {
            handleLocationSuccess(coords.lat, coords.lng);
          } else {
            handleLocationError("Native location failed");
          }
        }).catch(() => handleLocationError("Bridge not found"));
        return;
      }

      // Standard Browser Geolocation
      navigator.geolocation.getCurrentPosition(
        (position) => handleLocationSuccess(position.coords.latitude, position.coords.longitude),
        handleLocationError,
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        },
      );
    });

  const refreshAddresses = useCallback(async () => {
    // Skip if user is not logged in – getProfile would 401 and trigger axios reload loop
    if (!hasValidStoredAuthToken("auth_customer")) return;
    try {
      const { data } = await customerApi.getProfile();
      const profile = data?.result ?? data?.data ?? data;
      const raw = Array.isArray(profile?.addresses) ? profile.addresses : [];
      setSavedAddresses(
        raw.map((addr, idx) => ({
          id: addr._id ?? String(idx),
          label:
            (addr.label || "Home").charAt(0).toUpperCase() +
            (addr.label || "home").slice(1),
          address:
            addr.fullAddress ||
            [addr.landmark, addr.city, addr.state, addr.pincode]
              .filter(Boolean)
              .join(", ") ||
            "",
          city: addr.city || (addr.fullAddress?.toLowerCase().includes("mauranipur") ? "Jhansi" : undefined),
          state: addr.state || (addr.fullAddress?.toLowerCase().includes("mauranipur") ? "Uttar Pradesh" : undefined),
          pincode: addr.pincode || (addr.fullAddress?.toLowerCase().includes("mauranipur") ? "284204" : undefined),
          landmark: addr.landmark,
          name: addr.receiverName || profile?.name || "",
          location:
            addr?.location &&
            typeof addr.location.lat === "number" &&
            typeof addr.location.lng === "number" &&
            Number.isFinite(addr.location.lat) &&
            Number.isFinite(addr.location.lng)
              ? { lat: addr.location.lat, lng: addr.location.lng }
              : null,
          placeId: typeof addr?.placeId === "string" ? addr.placeId : null,
          phone: addr.receiverPhone || profile?.phone || "",
          isCurrent: idx === 0,
        })),
      );
    } catch {
      // If API fails, keep existing in-memory addresses.
    }
  }, []);

  // On mount: hydrate saved addresses from profile (only when customer is logged in)
  useEffect(() => {
    refreshAddresses();
  }, [refreshAddresses]);

  // On mount: only restore from cache. Do NOT auto-fetch – browsers block the
  // location prompt unless it's triggered by a user gesture (e.g. tap).
  useEffect(() => {
    const parsed = getJSON(STORAGE_KEY, null);
    const addressName = parsed?.address || parsed?.name || parsed?.formattedAddress;
    const isRawCoordName = addressName && /^Lat\s*[-+]?\d/i.test(addressName);

    if (parsed && addressName && !isRawCoordName) {
      updateLocation(
        {
          name: addressName,
          address: addressName,
          formattedAddress: addressName,
          time: parsed.time && parsed.time !== "12-15 mins" ? parsed.time : "20-35 mins",
          addressId: parsed.addressId,
          city: parsed.city,
          state: parsed.state,
          pincode: parsed.pincode,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          receiverName: parsed.receiverName,
          phone: parsed.phone,
          type: parsed.type || "Home",
          landmark: parsed.landmark,
        },
        { persist: false, updateSavedHome: false },
      );
      setIsLocationReady(true);
    } else {
      // If cached name is a raw coordinate string (e.g. "Lat 22.71737, Lng 75.87162") from earlier bug:
      if (parsed?.latitude && parsed?.longitude) {
        customerApi.reverseGeocode({ lat: parsed.latitude, lng: parsed.longitude })
          .then((res) => {
            const data = res?.data?.result || res?.data;
            if (data && (data.friendlyName || data.formattedAddress)) {
              const resName = data.friendlyName || data.formattedAddress;
              updateLocation({
                name: resName,
                address: resName,
                formattedAddress: resName,
                time: "20-35 mins",
                city: data.city || parsed.city || "Indore",
                state: data.state || parsed.state || "Madhya Pradesh",
                pincode: data.pincode || parsed.pincode || "452018",
                latitude: parsed.latitude,
                longitude: parsed.longitude,
              });
            } else {
              updateLocation(currentLocation, { persist: true, updateSavedHome: false });
            }
          })
          .catch(() => {
            updateLocation(currentLocation, { persist: true, updateSavedHome: false });
          });
      } else {
        updateLocation(currentLocation, { persist: true, updateSavedHome: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locationValue = useMemo(() => ({
    currentLocation,
    isLocationReady,
    savedAddresses,
    updateLocation,
    addAddress,
    refreshAddresses,
    isFetchingLocation,
    locationError,
    refreshLocation: fetchAndCacheLocation,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [currentLocation, isLocationReady, savedAddresses, isFetchingLocation, locationError, refreshAddresses]);

  return (
    <LocationContext.Provider value={locationValue}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};

export const useLocationContext = useLocation;

/** Like useLocation, but returns null outside a LocationProvider instead of throwing. */
export const useOptionalLocation = () => useContext(LocationContext) ?? null;
