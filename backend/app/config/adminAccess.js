/**
 * Admin panel role-based access.
 *
 * - ADMIN_MODULES: the pages the client can tick when building a role. One key per admin menu page.
 * - ACCESS_RULES: which admin API call needs which module. The check runs inside verifyToken for
 *   every admin token, so a staff member cannot reach a page's data by calling the API directly.
 *
 * A "super admin" is an Admin document without an `adminRole` (all existing admins), and it
 * is always allowed. A staff admin has an `adminRole` and may only use the modules in it.
 *
 * Anything that is not listed in ACCESS_RULES is DENIED for staff (deny by default). When you add a
 * new admin API route, add a rule here, otherwise only the super admin can use it.
 */

export const ADMIN_MODULES = [
  { key: "dashboard", label: "Dashboard", group: "Overview" },

  { key: "orders", label: "Orders (Active / Completed)", group: "Orders & Returns" },
  { key: "returns", label: "Returns (Active / Completed)", group: "Orders & Returns" },

  { key: "products", label: "Products", group: "Catalog" },
  { key: "categories", label: "Categories", group: "Catalog" },

  { key: "customers", label: "Customers", group: "People" },
  { key: "sellers", label: "Sellers", group: "People" },
  { key: "delivery_partners", label: "Delivery Drivers", group: "People" },
  { key: "sos_alerts", label: "SOS Alerts", group: "People" },
  { key: "delivery_pincodes", label: "Delivery Pincodes", group: "People" },
  { key: "employees", label: "Employees (Referral)", group: "People" },

  { key: "support_tickets", label: "Help Tickets", group: "Customer Support" },
  { key: "reviews", label: "Review Content", group: "Customer Support" },

  { key: "notifications", label: "Send Notifications", group: "Marketing" },
  { key: "coupons", label: "Coupons & Promos", group: "Marketing" },
  { key: "emi", label: "Finance (EMI)", group: "Marketing" },

  { key: "wallet", label: "Wallet", group: "Money" },
  { key: "withdrawals", label: "Money Requests", group: "Money" },
  { key: "cash_collection", label: "Collect Cash", group: "Money" },
  { key: "billing", label: "Fees & Charges", group: "Money" },
  { key: "payment_modes", label: "Payment Modes", group: "Money" },
  { key: "return_modes", label: "Return Modes", group: "Money" },

  { key: "settings", label: "Settings", group: "Store Setup" },
  { key: "layout_branding", label: "Layout & Branding", group: "Website Content" },
  { key: "hero_banners", label: "Hero & Page Banners", group: "Website Content" },
  { key: "store_banners", label: "Seller Store Banners", group: "Website Content" },
  { key: "faqs", label: "FAQs", group: "Website Content" },
  { key: "legal_pages", label: "Legal Pages", group: "Website Content" },
];

export const MODULE_KEYS = ADMIN_MODULES.map((m) => m.key);
const MODULE_KEY_SET = new Set(MODULE_KEYS);

/** Drops anything that is not a real module (also hides keys that were removed later). */
export function sanitizePermissions(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const key = String(raw || "").trim();
    if (MODULE_KEY_SET.has(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

export const ACCESS_TYPES = ["write", "read"];

const ANY = "__any"; // every signed-in admin (own profile, shared helpers, public data)
const SUPER = "__super"; // only the super admin

const READ = ["GET", "HEAD"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// [methods ("*" = all), path regex (after /api), module key(s)]
// FIRST MATCH WINS, so keep the specific rules above the general ones.
const RULES = [
  // ── Staff & roles management: super admin only ──
  ["*", /^\/admin\/staff(\/|$)/, SUPER],

  // ── Every admin ──
  [READ, /^\/admin\/access$/, ANY],
  ["*", /^\/admin\/profile(\/password)?$/, ANY],
  [READ, /^\/orders\/admin-nav-counts$/, ANY],
  [READ, /^\/orders\/return-reasons$/, ANY],
  ["*", /^\/push(\/|$)/, ANY],
  ["*", /^\/translate(\/|$)/, ANY],
  ["*", /^\/maps(\/|$)/, ANY],
  ["*", /^\/media(\/|$)/, ANY],
  [READ, /^\/employees\/validate\//, ANY],

  // ── Notifications ──
  ["*", /^\/notifications\/(broadcast|history|stats|campaigns)(\/|$)/, "notifications"],
  ["*", /^\/notifications(\/|$)/, ANY], // an admin's own bell / read marks

  // ── Customer support ──
  ["*", /^\/tickets\/admin(\/|$)/, "support_tickets"],
  ["*", /^\/admin\/tickets(\/|$)/, "support_tickets"],
  ["POST", /^\/tickets\/reply\/[^/]+$/, "support_tickets"],
  ["*", /^\/reviews\/admin(\/|$)/, "reviews"],

  // ── Orders & returns ──
  ["*", /^\/orders\/(seller-returns|returns\/|return-status\/)/, "returns"],
  [READ, /^\/orders\/[^/]+\/returns$/, ["orders", "returns"]],
  ["*", /^\/orders\/workflow\/[^/]+\/return-/, "returns"],
  [READ, /^\/orders\/workflow\/[^/]+\/route$/, ["orders", "returns"]],
  [READ, /^\/orders\/details\/[^/]+$/, ["orders", "returns", "customers", "support_tickets", "wallet", "withdrawals"]],
  [
    "*",
    /^\/orders\/(seller-orders|status\/|available$|accept\/|skip\/|workflow\/|[^/]+\/(payment\/(approve|reject)-upi|cod\/|delivered$))/,
    "orders",
  ],
  ["*", /^\/shipping\/shiprocket\/reverse(\/|$)/, "returns"],
  ["*", /^\/shipping\/shiprocket(\/|$)/, "orders"],
  ["*", /^\/shipping\/pincodes(\/|$)/, "delivery_pincodes"],

  // ── Catalog ──
  [READ, /^\/products\/moderation(\/|$)/, "products"],
  [["POST", "PUT", "PATCH", "DELETE"], /^\/products(\/|$)/, "products"],
  [["POST", "PUT", "PATCH", "DELETE"], /^\/attributes(\/|$)/, ["products", "categories"]],
  [READ, /^\/admin\/categories(\/|$)/, ["categories", "products"]],
  ["*", /^\/admin\/categories(\/|$)/, "categories"],

  // ── Marketing ──
  ["*", /^\/admin\/coupons(\/|$)/, "coupons"],
  ["*", /^\/admin-offers(\/|$)/, "coupons"],
  ["*", /^\/emi\/admin(\/|$)/, "emi"],

  // ── People ──
  ["*", /^\/admin\/users(\/|$)/, "customers"],
  ["*", /^\/admin\/sellers\/[^/]+\/banners$/, ["sellers", "store_banners"]],
  ["*", /^\/admin\/sellers(\/|$)/, "sellers"],
  [READ, /^\/admin\/delivery-partners(\/|$)/, ["delivery_partners", "orders", "returns"]],
  ["*", /^\/admin\/delivery-partners(\/|$)/, "delivery_partners"],
  ["*", /^\/admin\/sos-alerts(\/|$)/, "sos_alerts"],
  ["*", /^\/employees(\/|$)/, "employees"],

  // ── Money ──
  ["*", /^\/admin\/(wallet-data|seller-transactions)$/, "wallet"],
  ["*", /^\/admin\/finance(\/|$)/, "wallet"],
  ["*", /^\/admin\/(seller-withdrawals|delivery-withdrawals|customer-withdrawals|withdrawals)(\/|$)/, "withdrawals"],
  ["*", /^\/admin\/(delivery-cash|rider-cash-details|settle-cash|cash-history)(\/|$)/, "cash_collection"],
  ["*", /^\/admin\/settings\/(platform|delivery)$/, ["billing", "settings"]],
  ["PUT", /^\/settings\/payment-modes$/, "payment_modes"],
  ["PUT", /^\/settings\/return-windows$/, "return_modes"],

  // ── Store setup & website content ──
  ["POST", /^\/settings\/upload$/, ["settings", "layout_branding", "hero_banners", "store_banners"]],
  ["PUT", /^\/settings$/, ["settings", "layout_branding", "hero_banners"]],
  ["*", /^\/admin\/experience(\/|$)/, "hero_banners"],
  ["*", /^\/admin\/faqs(\/|$)/, "faqs"],
  ["PUT", /^\/legal$/, "legal_pages"],

  // ── Dashboard ──
  [READ, /^\/admin\/(stats|reports|dashboard)$/, "dashboard"],

  // ── Public data (read only) that the admin screens also load ──
  [READ, /^\/emi\/(?!admin(\/|$))/, ANY],
  [READ, /^\/(settings|categories|products|attributes|legal|experience|offers|public|reviews|shipping\/check-serviceability)(\/|$)/, ANY],
];

function methodMatches(methods, method) {
  if (methods === "*") return true;
  return (Array.isArray(methods) ? methods : [methods]).includes(method);
}

/**
 * "/api/Orders/x/?a=1" -> "/orders/x"
 * Lower-cased on purpose: Express matches routes case-insensitively, so "/notifications/BROADCAST"
 * reaches the broadcast handler and must be judged by the same rule as "/notifications/broadcast".
 */
export function normalizeApiPath(rawUrl) {
  let path = String(rawUrl || "").split("?")[0].split("#")[0].toLowerCase();
  path = path.replace(/\/{2,}/g, "/");
  path = path.replace(/^\/api(?=\/|$)/, "");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

/** The rule for this call, or null when nothing is listed for it. */
export function findAccessRule(method, rawUrl) {
  const verb = String(method || "GET").toUpperCase();
  const path = normalizeApiPath(rawUrl);
  for (const [methods, pattern, target] of RULES) {
    if (!methodMatches(methods, verb)) continue;
    if (!pattern.test(path)) continue;
    return { target, path };
  }
  return null;
}

/**
 * Decide if an admin may make this call.
 * access: { isSuper, permissions: string[], accessType: "write" | "read" }
 * Returns { allowed: true } or { allowed: false, reason: "forbidden" | "read_only" | "no_rule" | "super_only" }.
 */
export function decideAdminAccess(access, method, rawUrl) {
  if (access?.isSuper) return { allowed: true };

  const rule = findAccessRule(method, rawUrl);
  if (!rule) return { allowed: false, reason: "no_rule" };
  if (rule.target === ANY) return { allowed: true };
  if (rule.target === SUPER) return { allowed: false, reason: "super_only" };

  const needed = Array.isArray(rule.target) ? rule.target : [rule.target];
  const owned = new Set(access?.permissions || []);
  if (!needed.some((key) => owned.has(key))) return { allowed: false, reason: "forbidden" };

  const verb = String(method || "GET").toUpperCase();
  if (access?.accessType === "read" && !SAFE_METHODS.has(verb)) {
    return { allowed: false, reason: "read_only" };
  }
  return { allowed: true };
}

export const ACCESS_DENIED_MESSAGES = {
  forbidden: "You do not have access to this section.",
  no_rule: "You do not have access to this section.",
  super_only: "Only the main admin can manage staff and roles.",
  read_only: "Your role has view-only access. You cannot change anything.",
};
