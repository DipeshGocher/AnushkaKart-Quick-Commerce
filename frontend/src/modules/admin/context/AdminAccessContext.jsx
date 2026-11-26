import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { adminStaffApi } from "../services/api/staffApi";
import { canUseModule } from "../utils/adminAccess";

/**
 * What the signed-in admin may open (role-based access). Loaded from the server when the admin panel
 * opens and again whenever the tab comes back into focus, so a role edited by the main admin shows up
 * without logging in again. The server still checks every request; this only drives the screens.
 */
const AdminAccessContext = createContext(null);

export const useAdminAccess = () => useContext(AdminAccessContext);

function normalizeAccess(result) {
  return {
    isMainAdmin: Boolean(result?.isMainAdmin),
    permissions: Array.isArray(result?.permissions) ? result.permissions : [],
    accessType: result?.accessType === "read" ? "read" : "write",
    roleName: result?.roleName || "",
    name: result?.name || "",
    email: result?.email || "",
  };
}

export const AdminAccessProvider = ({ children }) => {
  const [state, setState] = useState({ status: "loading", access: null, error: null });

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((prev) => (prev.access ? prev : { status: "loading", access: null, error: null }));
    try {
      const res = await adminStaffApi.getMyAccess();
      const result = res?.data?.result;
      if (!res?.data?.success || !result) throw new Error("Your access could not be loaded");
      setState({ status: "ready", access: normalizeAccess(result), error: null });
    } catch (err) {
      const httpStatus = err?.response?.status;
      const blocked = httpStatus === 401 || httpStatus === 403;
      // A quiet refresh that fails because of the network keeps the screen as it is.
      if (silent && !blocked) return;
      setState({
        status: "error",
        access: null,
        error: {
          status: httpStatus || 0,
          message: err?.response?.data?.message || err?.message || "Could not load your access",
        },
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refreshQuietly = () => {
      if (document.visibilityState === "visible") load({ silent: true });
    };
    document.addEventListener("visibilitychange", refreshQuietly);
    window.addEventListener("focus", refreshQuietly);
    return () => {
      document.removeEventListener("visibilitychange", refreshQuietly);
      window.removeEventListener("focus", refreshQuietly);
    };
  }, [load]);

  const value = useMemo(() => {
    const access = state.access;
    return {
      status: state.status,
      error: state.error,
      ready: state.status === "ready",
      access,
      isMainAdmin: Boolean(access?.isMainAdmin),
      roleName: access?.roleName || "",
      readOnly: Boolean(access && !access.isMainAdmin && access.accessType === "read"),
      can: (moduleKeys) => canUseModule(access, moduleKeys),
      refresh: () => load({ silent: true }),
    };
  }, [state, load]);

  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
};

export default AdminAccessContext;
