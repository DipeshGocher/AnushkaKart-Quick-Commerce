import { useEffect, useMemo, useState } from "react";
import { customerApi } from "./customerApi";

// The server reads each product's actual seller/warehouse pincode and the
// current admin pincode list. Never infer a courier from incomplete cart data.
export function useDeliveryDecision(items, pincode) {
  const productKey = useMemo(() =>
    [...new Set(items.map((item) => String(item.id || item._id || "")).filter(Boolean))].sort().join("|"),
  [items]);
  const cleanPincode = String(pincode || "").trim();
  const requestKey = `${cleanPincode}:${productKey}`;
  const [result, setResult] = useState(null);
  const [requestError, setRequestError] = useState(null);

  useEffect(() => {
    if (!/^\d{6}$/.test(cleanPincode) || !productKey) return;
    let active = true;
    customerApi.validateCartDelivery({
      customerPincode: cleanPincode,
      items: productKey.split("|").map((productId) => ({ productId })),
    }).then((response) => {
      if (active) setResult({ key: requestKey, data: response.data?.result || null });
    }).catch((err) => {
      if (active) {
        setResult(null);
        setRequestError({ key: requestKey, message: err?.response?.data?.message || "Could not check delivery for this address. Please retry." });
      }
    });
    return () => { active = false; };
  }, [requestKey, cleanPincode, productKey]);

  const decision = result?.key === requestKey ? result.data : null;
  const error = requestError?.key === requestKey ? requestError.message : "";
  return {
    decision,
    loading: /^\d{6}$/.test(cleanPincode) && Boolean(productKey) && !decision && !error,
    error,
    getItem: (item) => decision?.items?.find((entry) =>
      String(entry.productId) === String(item.id || item._id)
    ) || null,
  };
}
