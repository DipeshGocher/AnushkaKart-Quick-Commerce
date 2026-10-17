const DEFAULT_API_PORT = "5000";
const DEFAULT_API_PATH = "/api";

function normalizeOrigin(origin) {
  return origin.replace(/\/+$/, "");
}

function ensureApiPath(pathname) {
  if (!pathname || pathname === "/") return DEFAULT_API_PATH;
  return pathname.endsWith("/api") ? pathname : `${pathname.replace(/\/+$/, "")}/api`;
}

function isLocalHostname(hostname) {
  return (
    !hostname ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local")
  );
}

function buildLocalApiUrl(hostname) {
  const protocol = typeof window !== "undefined" && window.location.protocol ? window.location.protocol : "http:";
  return `${protocol}//${hostname || "localhost"}:${DEFAULT_API_PORT}${DEFAULT_API_PATH}`;
}

function parseEnvUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const baseOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5000";
    const parsed = new URL(rawUrl, baseOrigin);
    return `${normalizeOrigin(parsed.origin)}${ensureApiPath(parsed.pathname)}`;
  } catch {
    return null;
  }
}

export function resolveApiBaseUrl() {
  const envUrl =
    parseEnvUrl(import.meta.env.VITE_API_URL) ||
    parseEnvUrl(import.meta.env.VITE_API_BASE_URL);

  const browserHostname = typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "";
  const browserOrigin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "";

  // Production / remote domain (e.g. anushkaconnect.com)
  if (browserHostname && !isLocalHostname(browserHostname)) {
    // If envUrl is explicitly provided and points to a valid external host, inspect it
    if (envUrl) {
      try {
        const parsed = new URL(envUrl);
        // If envUrl was accidentally baked as localhost or has internal port 5000/7000 on the same domain,
        // sanitize it to use the current origin + /api
        if (!isLocalHostname(parsed.hostname)) {
          if (parsed.hostname === browserHostname) {
            return `${browserOrigin}${DEFAULT_API_PATH}`;
          }
          return `${normalizeOrigin(parsed.origin)}${ensureApiPath(parsed.pathname)}`;
        }
      } catch {
        // fallback to browserOrigin
      }
    }
    // Standard production routing: route /api through reverse proxy on the current origin
    return `${browserOrigin}${DEFAULT_API_PATH}`;
  }

  // Local development
  if (!envUrl) {
    const fallbackHost = browserHostname || "localhost";
    return buildLocalApiUrl(fallbackHost);
  }

  try {
    const parsed = new URL(envUrl);
    return `${normalizeOrigin(parsed.origin)}${ensureApiPath(parsed.pathname)}`;
  } catch {
    const fallbackHost = browserHostname || "localhost";
    return buildLocalApiUrl(fallbackHost);
  }
}

export function resolveSocketBaseUrl() {
  const explicitSocketUrl = parseEnvUrl(import.meta.env.VITE_SOCKET_URL);
  if (explicitSocketUrl) {
    return explicitSocketUrl.replace(/\/api$/, "");
  }
  return resolveApiBaseUrl().replace(/\/api$/, "");
}
