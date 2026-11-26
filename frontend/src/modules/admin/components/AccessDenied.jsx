import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, LogOut, RefreshCw } from "lucide-react";

/** Shown inside the panel when a staff login opens a page its role does not include. */
const AccessDenied = ({ landingPath }) => (
  <div className="flex min-h-[60vh] items-center justify-center p-6">
    <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <ShieldAlert size={28} />
      </div>
      <h1 className="text-xl font-bold text-gray-900">You do not have access to this page</h1>
      <p className="mt-2 text-sm text-gray-500">
        Your role does not include this section. Please ask the main admin if you need it.
      </p>
      {landingPath && (
        <Link
          to={landingPath}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary/90"
        >
          Go to my pages
        </Link>
      )}
    </div>
  </div>
);

/** Shown instead of the panel when the server did not give this login any access (switched off, network). */
export const AccessLoadError = ({ error, onLogout }) => {
  const blocked = error?.status === 401 || error?.status === 403;
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFDD0] p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <ShieldAlert size={28} />
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          {blocked ? "This admin login cannot open the panel" : "Could not load your access"}
        </h1>
        <p className="mt-2 text-sm text-gray-500">{error?.message || "Please try again."}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {!blocked && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary/90"
            >
              <RefreshCw size={16} /> Try again
            </button>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
