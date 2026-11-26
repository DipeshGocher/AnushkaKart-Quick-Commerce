/**
 * Admin panel role-based access (screen side).
 *
 * This only decides what to SHOW: which menu items and which pages. The server is what really
 * protects the data (backend/app/config/adminAccess.js); a hidden page is never the only lock.
 *
 * `access` is what GET /admin/access returns:
 *   { isMainAdmin, permissions: ["wallet", ...], accessType: "write" | "read", roleName }
 */

/** True when `access` allows the module key (or any of the keys). No key = open to every admin. */
export function canUseModule(access, moduleKeys) {
  if (!access) return false;
  if (access.isMainAdmin) return true;
  if (moduleKeys === undefined || moduleKeys === null) return true;
  const needed = Array.isArray(moduleKeys) ? moduleKeys : [moduleKeys];
  if (needed.length === 0) return true;
  const owned = new Set(access.permissions || []);
  return needed.some((key) => owned.has(key));
}

/**
 * Menu filter. Menu items carry `module` (a key or a list of keys); a group may also carry it on each
 * child. `superOnly` items are for the main admin. Groups left with no child and section headers left
 * with nothing under them are removed.
 */
export function filterNavItems(items, access) {
  const visible = [];
  for (const item of items || []) {
    if (item?.type === "section") {
      visible.push(item);
      continue;
    }
    if (item?.superOnly) {
      if (access?.isMainAdmin) visible.push(item);
      continue;
    }
    if (Array.isArray(item?.children)) {
      const children = item.children.filter((child) =>
        canUseModule(access, child.module !== undefined ? child.module : item.module),
      );
      if (children.length > 0) visible.push({ ...item, children });
      continue;
    }
    if (canUseModule(access, item?.module)) visible.push(item);
  }
  return visible.filter((item, index) => {
    if (item.type !== "section") return true;
    const next = visible[index + 1];
    return Boolean(next) && next.type !== "section";
  });
}

/** The first page a person can land on: the first menu item (or child) with a path. */
export function firstAllowedPath(visibleItems) {
  for (const item of visibleItems || []) {
    if (item?.type === "section") continue;
    if (item.path) return item.path;
    if (Array.isArray(item.children)) {
      const child = item.children.find((c) => c.path);
      if (child) return child.path;
    }
  }
  return null;
}

const SUPER = "__super";

// First match wins. Anything not listed is not guarded here (redirects, the 404 page, My Profile).
const ROUTE_RULES = [
  [/^\/admin\/staff-access(\/|$)/, SUPER],
  [/^\/admin\/orders\/view\//, ["orders", "returns", "customers", "support_tickets", "wallet", "withdrawals"]],
  [/^\/admin\/orders(\/|$)/, "orders"],
  [/^\/admin\/returns(\/|$)/, "returns"],
  [/^\/admin\/categories(\/|$)/, "categories"],
  [/^\/admin\/products(\/|$)/, "products"],
  [/^\/admin\/(customers|users)(\/|$)/, "customers"],
  [/^\/admin\/sellers(\/|$)/, "sellers"],
  [/^\/admin\/delivery-boys(\/|$)/, "delivery_partners"],
  [/^\/admin\/sos-alerts(\/|$)/, "sos_alerts"],
  [/^\/admin\/delivery-pincodes(\/|$)/, "delivery_pincodes"],
  [/^\/admin\/employees(\/|$)/, "employees"],
  [/^\/admin\/support-tickets(\/|$)/, "support_tickets"],
  [/^\/admin\/moderation(\/|$)/, "reviews"],
  [/^\/admin\/notifications(\/|$)/, "notifications"],
  [/^\/admin\/(coupons|offers)(\/|$)/, "coupons"],
  [/^\/admin\/emi(\/|$)/, "emi"],
  [/^\/admin\/wallet(\/|$)/, "wallet"],
  [/^\/admin\/withdrawals(\/|$)/, "withdrawals"],
  [/^\/admin\/cash-collection(\/|$)/, "cash_collection"],
  [/^\/admin\/billing(\/|$)/, "billing"],
  [/^\/admin\/payment-modes(\/|$)/, "payment_modes"],
  [/^\/admin\/return-modes(\/|$)/, "return_modes"],
  [/^\/admin\/settings(\/|$)/, "settings"],
  [/^\/admin\/layout-branding(\/|$)/, "layout_branding"],
  [/^\/admin\/hero-categories(\/|$)/, "hero_banners"],
  [/^\/admin\/store-banners(\/|$)/, "store_banners"],
  [/^\/admin\/faqs(\/|$)/, "faqs"],
  [/^\/admin\/legal-pages(\/|$)/, "legal_pages"],
  [/^\/admin\/?$/, "dashboard"],
];

/** Module key(s) the page needs, "__super", or null when every admin may open it. */
export function modulesForPath(pathname) {
  const path = String(pathname || "").split("?")[0].toLowerCase();
  for (const [pattern, target] of ROUTE_RULES) {
    if (pattern.test(path)) return target;
  }
  return null;
}

export function canOpenPath(pathname, access) {
  if (!access) return false;
  const needed = modulesForPath(pathname);
  if (needed === null) return true;
  if (needed === SUPER) return Boolean(access.isMainAdmin);
  return canUseModule(access, needed);
}

/** "Orders (Active / Completed)" style grouping for the role form: [{ group, modules: [...] }]. */
export function groupModules(modules) {
  const groups = [];
  for (const mod of modules || []) {
    let bucket = groups.find((g) => g.group === mod.group);
    if (!bucket) {
      bucket = { group: mod.group, modules: [] };
      groups.push(bucket);
    }
    bucket.modules.push(mod);
  }
  return groups;
}

/** A password that passes the server rules (10+ characters, upper, lower, digit). */
export function generateStrongPassword(randomInt = defaultRandomInt) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const pick = (set) => set[randomInt(set.length)];
  const chars = [pick(upper), pick(lower), pick(digits)];
  while (chars.length < 12) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function defaultRandomInt(max) {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(1);
    cryptoObj.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/** Same rule the server uses, so the form can say what is wrong before sending. */
export function passwordProblem(password) {
  const value = String(password || "");
  if (value.length < 10) return "Password must be at least 10 characters long";
  if (!/[a-z]/.test(value)) return "Password needs a lowercase letter";
  if (!/[A-Z]/.test(value)) return "Password needs an uppercase letter";
  if (!/[0-9]/.test(value)) return "Password needs a number";
  return "";
}
