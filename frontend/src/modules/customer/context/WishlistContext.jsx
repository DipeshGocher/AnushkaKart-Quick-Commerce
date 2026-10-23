import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { customerApi } from "../services/customerApi";
import { useAuth } from "../../../core/context/AuthContext";
import { getJSON, setJSON, remove as removeStorage, STORAGE_KEYS } from "@core/utils/storage";

import { isRefurbishedItem } from "./CartContext";

const WishlistContext = createContext();

const loadGuestWishlist = () => {
  const parsed = getJSON(STORAGE_KEYS.WISHLIST, []);
  if (!Array.isArray(parsed)) {
    removeStorage(STORAGE_KEYS.WISHLIST);
    return [];
  }
  return parsed.map((item) => {
    const isRefurb = isRefurbishedItem(item);
    return {
      ...item,
      conditionType: isRefurb ? 'refurbished' : 'new',
    };
  });
};

const mapWishlistProduct = (p) => {
  if (!p) return null;
  const isRefurb = isRefurbishedItem(p);
  return {
    ...p,
    id: p._id ? String(p._id) : (p.id || ""),
    conditionType: isRefurb ? 'refurbished' : 'new',
    image: p.mainImage || p.image,
  };
};

export const useWishlist = () => useContext(WishlistContext);

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [wishlist, setWishlist] = useState(() => loadGuestWishlist());

  const [loading, setLoading] = useState(false);
  const [isFullDataFetched, setIsFullDataFetched] = useState(false);

  // Fetch wishlist from backend on mount or authentication change
  const fetchWishlistIds = async () => {
    if (isAuthenticated) {
      setLoading(true);
      try {
        const response = await customerApi.getWishlist({ idsOnly: true });
        // Handle both populated and unpopulated products for flexibility
        const products = response.data.result.products || [];
        const backendWishlist = products.map((product) => {
          if (typeof product === "string") {
            return { id: product, _id: product };
          }
          return mapWishlistProduct(product);
        }).filter(Boolean);
        setWishlist(backendWishlist);
        setIsFullDataFetched(false);
      } catch (error) {
        console.error("Failed to fetch wishlist from backend", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const fetchFullWishlist = async () => {
    if (isAuthenticated) {
      setLoading(true);
      try {
        const response = await customerApi.getWishlist({ idsOnly: false });
        const products = response.data.result.products || [];
        const backendWishlist = products.map(mapWishlistProduct).filter(Boolean);
        setWishlist(backendWishlist);
        setIsFullDataFetched(true);
      } catch (error) {
        console.error("Failed to fetch full wishlist from backend", error);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      // Drop the guest blob — backend is now the source of truth and we
      // don't want stale state to resurface on logout for another user on
      // the same browser.
      removeStorage(STORAGE_KEYS.WISHLIST);
      fetchWishlistIds();
    } else {
      setWishlist(loadGuestWishlist());
      setIsFullDataFetched(true); // Local storage always has full data
    }
  }, [isAuthenticated]);

  // Save local wishlist to localStorage (fallback/guest mode)
  useEffect(() => {
    if (!isAuthenticated) {
      setJSON(STORAGE_KEYS.WISHLIST, wishlist);
    }
  }, [wishlist, isAuthenticated]);

  const addToWishlist = async (product) => {
    const isRefurb = isRefurbishedItem(product) || (product?.conditionType !== 'new' && typeof window !== 'undefined' && (window.location.pathname.startsWith('/marketplace') || window.location.pathname.startsWith('/refurbished')));
    const id = product?.id || product?._id || (typeof product === 'string' ? product : null);
    if (!id) return;

    if (isAuthenticated) {
      try {
        const response = await customerApi.addToWishlist({
          productId: String(id),
        });
        const backendWishlist = (response.data.result.products || []).map(mapWishlistProduct).filter(Boolean);
        setWishlist(backendWishlist);
        setIsFullDataFetched(true);
      } catch (error) {
        console.error("Error adding to wishlist on backend", error);
      }
    } else {
      setWishlist((prev) => {
        if (prev.some((item) => String(item?.id || item?._id || "").trim() === String(id).trim())) return prev;
        return [...prev, { ...(typeof product === 'object' ? product : {}), id: String(id), _id: String(id), conditionType: isRefurb ? 'refurbished' : 'new' }];
      });
    }
  };

  const removeFromWishlist = async (productId) => {
    const id = productId?.id || productId?._id || (typeof productId === 'string' ? productId : null);
    if (!id) return;

    if (isAuthenticated) {
      try {
        const response = await customerApi.removeFromWishlist(String(id));
        const backendWishlist = (response.data.result.products || []).map(mapWishlistProduct).filter(Boolean);
        setWishlist(backendWishlist);
        setIsFullDataFetched(true);
      } catch (error) {
        console.error("Error removing from wishlist on backend", error);
      }
    } else {
      setWishlist((prev) =>
        prev.filter((item) => String(item?.id || item?._id || "").trim() !== String(id).trim()),
      );
    }
  };

  const toggleWishlist = async (product) => {
    const id = product?.id || product?._id || (typeof product === 'string' ? product : null);
    if (!id) return;
    const isRefurb = isRefurbishedItem(product) || (product?.conditionType !== 'new' && typeof window !== 'undefined' && (window.location.pathname.startsWith('/marketplace') || window.location.pathname.startsWith('/refurbished')));
    const currentlyInWishlist = isInWishlist(id);

    // Optimistic UI update for instant visual feedback on heart icon
    setWishlist((prev) => {
      if (currentlyInWishlist) {
        return prev.filter((item) => {
          const itemId = String(item?.id || item?._id || item?.productId || (typeof item === 'string' ? item : "")).trim();
          return itemId !== String(id).trim();
        });
      } else {
        return [
          ...prev,
          {
            ...(typeof product === 'object' ? product : {}),
            id: String(id),
            _id: String(id),
            conditionType: isRefurb ? 'refurbished' : (product?.conditionType || 'new'),
          },
        ];
      }
    });

    if (isAuthenticated) {
      try {
        const response = await customerApi.toggleWishlist({ productId: String(id) });
        const backendWishlist = (response.data.result.products || []).map(mapWishlistProduct).filter(Boolean);
        setWishlist(backendWishlist);
        setIsFullDataFetched(true);
      } catch (error) {
        console.error("Error toggling wishlist on backend", error);
        fetchWishlistIds();
      }
    }
  };

  const isInWishlist = (productId) => {
    if (!productId) return false;
    const target = (typeof productId === 'object'
      ? String(productId?._id || productId?.id || "")
      : String(productId)
    ).trim();
    if (!target) return false;
    return wishlist.some((item) => {
      const itemId = String(item?.id || item?._id || item?.productId || (typeof item === 'string' ? item : "")).trim();
      return itemId && itemId === target;
    });
  };

  const clearWishlist = async () => {
    // Clearing wishlist might not have a dedicated API, usually it's individual removes
    // or a clear endpoint. If no clear endpoint, we can't easily sync but let's assume local clearing first.
    setWishlist([]);
  };

  const groceryWishlist = useMemo(() => wishlist.filter((item) => !isRefurbishedItem(item)), [wishlist]);
  const refurbishedWishlist = useMemo(() => wishlist.filter((item) => isRefurbishedItem(item)), [wishlist]);

  const wishlistValue = useMemo(() => ({
    wishlist,
    groceryWishlist,
    refurbishedWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    isInWishlist,
    clearWishlist,
    fetchFullWishlist,
    isFullDataFetched,
    count: wishlist.length,
    groceryWishlistCount: groceryWishlist.length,
    refurbishedWishlistCount: refurbishedWishlist.length,
    loading,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [wishlist, groceryWishlist, refurbishedWishlist, isFullDataFetched, loading]);

  return (
    <WishlistContext.Provider value={wishlistValue}>
      {children}
    </WishlistContext.Provider>
  );
};
