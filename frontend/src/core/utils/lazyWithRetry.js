import React from "react";

/**
 * Wraps dynamic React.lazy imports with auto-retry and cache-busting logic.
 * Solves "Failed to fetch dynamically imported module" errors in Vite/Webpack SPAs.
 */
export function lazyWithRetry(componentImport) {
  return React.lazy(async () => {
    const storageKey = "retry_lazy_" + window.location.pathname;
    const hasRetried = sessionStorage.getItem(storageKey);

    try {
      const module = await componentImport();
      sessionStorage.removeItem(storageKey);
      return module;
    } catch (error) {
      const isImportError =
        error?.message?.includes("Failed to fetch dynamically imported module") ||
        error?.message?.includes("Importing a module script failed") ||
        error?.name === "ChunkLoadError";

      if (isImportError && !hasRetried) {
        sessionStorage.setItem(storageKey, "true");
        window.location.reload();
        return new Promise(() => {}); // Hold until reload
      }

      sessionStorage.removeItem(storageKey);
      throw error;
    }
  });
}

export default lazyWithRetry;
