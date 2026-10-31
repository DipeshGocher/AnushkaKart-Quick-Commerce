import { useState, useEffect, useMemo } from "react";
import { useOptionalLocation } from "../context/LocationContext";
import {
  loadLocalPincodes,
  evaluateProductDelivery,
} from "../services/deliveryService";

/**
 * Hook to evaluate real-time delivery eligibility for a product based on customer's selected pincode.
 *
 * @param {Object} product
 * @returns {Object} { isDeliverable, canAddToCart, badge, warning, deliveryEstimate, fulfillmentType, customerPincode }
 */
export function useDeliveryEligibility(product) {
  // Null when rendered outside LocationProvider.
  const locationCtx = useOptionalLocation();
  const currentLocation = locationCtx?.currentLocation;
  const [pincodesReady, setPincodesReady] = useState(false);

  useEffect(() => {
    loadLocalPincodes(true).then(() => {
      setPincodesReady(true);
    });
  }, []);

  const customerPincode = currentLocation?.pincode ? String(currentLocation.pincode).trim() : "";

  const evaluation = useMemo(() => {
    return evaluateProductDelivery(product, customerPincode);
  }, [product, customerPincode, pincodesReady]);

  return {
    ...evaluation,
    customerPincode,
  };
}
