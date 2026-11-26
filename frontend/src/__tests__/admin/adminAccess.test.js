import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canUseModule,
  filterNavItems,
  firstAllowedPath,
  modulesForPath,
  canOpenPath,
  groupModules,
  generateStrongPassword,
  passwordProblem,
} from "../../modules/admin/utils/adminAccess.js";
import { ADMIN_MODULES, MODULE_KEYS } from "../../../../backend/app/config/adminAccess.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const main = { isMainAdmin: true, permissions: [], accessType: "write" };
const support = { isMainAdmin: false, permissions: ["support_tickets"], accessType: "write" };
const manager = { isMainAdmin: false, permissions: ["wallet", "withdrawals", "cash_collection"], accessType: "write" };

const nav = [
  { label: "Dashboard", path: "/admin", module: "dashboard" },
  { label: "Orders", module: "orders", children: [{ label: "Active", path: "/admin/orders/active" }] },
  {
    label: "Customer Support",
    children: [
      { label: "Help Tickets", path: "/admin/support-tickets", module: "support_tickets" },
      { label: "Review Content", path: "/admin/moderation", module: "reviews" },
    ],
  },
  { label: "Wallet", path: "/admin/wallet", module: "wallet" },
  { label: "Money Requests", path: "/admin/withdrawals", module: "withdrawals" },
  { label: "My Profile", path: "/admin/profile" },
  { type: "section", label: "Admin CMS" },
  { label: "FAQs", path: "/admin/faqs", module: "faqs" },
  { label: "Staff & Roles", path: "/admin/staff-access", superOnly: true },
];

describe("canUseModule", () => {
  it("main admin can use everything", () => {
    expect(canUseModule(main, "wallet")).toBe(true);
    expect(canUseModule(main, ["a", "b"])).toBe(true);
  });
  it("staff need the key (or any key of a list)", () => {
    expect(canUseModule(support, "support_tickets")).toBe(true);
    expect(canUseModule(support, "wallet")).toBe(false);
    expect(canUseModule(support, ["wallet", "support_tickets"])).toBe(true);
  });
  it("an item with no module is open to every admin, but nobody without access data is let in", () => {
    expect(canUseModule(support, undefined)).toBe(true);
    expect(canUseModule(null, "wallet")).toBe(false);
  });
});

describe("filterNavItems", () => {
  const labels = (items) => items.map((i) => i.label);

  it("shows the main admin every item, including Staff & Roles", () => {
    expect(labels(filterNavItems(nav, main))).toEqual(labels(nav));
  });

  it("shows a support employee only Help Tickets and My Profile", () => {
    const items = filterNavItems(nav, support);
    expect(labels(items)).toEqual(["Customer Support", "My Profile"]);
    expect(items[0].children.map((c) => c.label)).toEqual(["Help Tickets"]);
  });

  it("shows a manager only the money pages, and hides the empty CMS header", () => {
    const items = filterNavItems(nav, manager);
    expect(labels(items)).toEqual(["Wallet", "Money Requests", "My Profile"]);
  });

  it("keeps the CMS header only while something is under it", () => {
    const cms = { isMainAdmin: false, permissions: ["faqs"], accessType: "write" };
    expect(labels(filterNavItems(nav, cms))).toEqual(["My Profile", "Admin CMS", "FAQs"]);
  });

  it("hides Staff & Roles from staff", () => {
    expect(labels(filterNavItems(nav, support))).not.toContain("Staff & Roles");
  });

  it("does not change the original list", () => {
    const before = JSON.stringify(nav);
    filterNavItems(nav, support);
    expect(JSON.stringify(nav)).toBe(before);
  });
});

describe("firstAllowedPath", () => {
  it("lands a staff login on its first page", () => {
    expect(firstAllowedPath(filterNavItems(nav, support))).toBe("/admin/support-tickets");
    expect(firstAllowedPath(filterNavItems(nav, manager))).toBe("/admin/wallet");
  });
  it("returns null when there is nothing to open", () => {
    expect(firstAllowedPath([])).toBeNull();
  });
});

describe("page access by address", () => {
  it("maps addresses to the module they need", () => {
    expect(modulesForPath("/admin/support-tickets")).toBe("support_tickets");
    expect(modulesForPath("/admin/Wallet")).toBe("wallet");
    expect(modulesForPath("/admin/orders/active")).toBe("orders");
    expect(modulesForPath("/admin/returns/completed")).toBe("returns");
    expect(modulesForPath("/admin/customers/123")).toBe("customers");
    expect(modulesForPath("/admin")).toBe("dashboard");
    expect(modulesForPath("/admin/")).toBe("dashboard");
    expect(modulesForPath("/admin/profile")).toBeNull();
  });

  it("support employee can open tickets and profile but not wallet, orders or staff pages", () => {
    expect(canOpenPath("/admin/support-tickets", support)).toBe(true);
    expect(canOpenPath("/admin/profile", support)).toBe(true);
    expect(canOpenPath("/admin/wallet", support)).toBe(false);
    expect(canOpenPath("/admin/orders/active", support)).toBe(false);
    expect(canOpenPath("/admin", support)).toBe(false);
    expect(canOpenPath("/admin/staff-access", support)).toBe(false);
  });

  it("an order's detail page opens from the money, support and orders pages", () => {
    expect(canOpenPath("/admin/orders/view/ORD1", support)).toBe(true);
    expect(canOpenPath("/admin/orders/view/ORD1", manager)).toBe(true);
    expect(canOpenPath("/admin/orders/active", manager)).toBe(false);
  });

  it("only the main admin opens Staff & Roles", () => {
    expect(canOpenPath("/admin/staff-access", main)).toBe(true);
    expect(canOpenPath("/admin/staff-access", manager)).toBe(false);
  });
});

describe("role form helpers", () => {
  it("groups modules in their original order", () => {
    const groups = groupModules([
      { key: "a", group: "One" },
      { key: "b", group: "Two" },
      { key: "c", group: "One" },
    ]);
    expect(groups).toEqual([
      { group: "One", modules: [{ key: "a", group: "One" }, { key: "c", group: "One" }] },
      { group: "Two", modules: [{ key: "b", group: "Two" }] },
    ]);
  });

  it("generated passwords always pass the password rule", () => {
    for (let i = 0; i < 200; i += 1) {
      const pwd = generateStrongPassword();
      expect(pwd).toHaveLength(12);
      expect(passwordProblem(pwd)).toBe("");
    }
  });

  it("explains a weak password", () => {
    expect(passwordProblem("short")).toMatch(/10 characters/);
    expect(passwordProblem("alllowercase1")).toMatch(/uppercase/);
    expect(passwordProblem("ALLUPPERCASE1")).toMatch(/lowercase/);
    expect(passwordProblem("NoNumbersHere")).toMatch(/number/);
    expect(passwordProblem("GoodPassw0rd")).toBe("");
  });
});

describe("menu and server stay in step", () => {
  const routesSource = fs.readFileSync(path.join(here, "../../modules/admin/routes/index.jsx"), "utf8");
  const menuKeys = [...routesSource.matchAll(/module:\s*"([a-z_]+)"/g)].map((m) => m[1]);

  it("every module key used in the menu exists on the server", () => {
    expect(menuKeys.length).toBeGreaterThan(20);
    const unknown = [...new Set(menuKeys)].filter((k) => !MODULE_KEYS.includes(k));
    expect(unknown).toEqual([]);
  });

  it("every page a role can be given has a menu item, so it can be opened", () => {
    const menuSet = new Set(menuKeys);
    const unreachable = MODULE_KEYS.filter((k) => !menuSet.has(k));
    expect(unreachable).toEqual([]);
  });

  it("every module has a label and a group for the role form", () => {
    for (const m of ADMIN_MODULES) {
      expect(m.label).toBeTruthy();
      expect(m.group).toBeTruthy();
    }
  });

  it("the route guard knows every module", () => {
    const sample = {
      dashboard: "/admin",
      orders: "/admin/orders/active",
      returns: "/admin/returns/active",
      products: "/admin/products",
      categories: "/admin/categories/hierarchy",
      customers: "/admin/customers",
      sellers: "/admin/sellers/active",
      delivery_partners: "/admin/delivery-boys/active",
      sos_alerts: "/admin/sos-alerts",
      delivery_pincodes: "/admin/delivery-pincodes",
      employees: "/admin/employees",
      support_tickets: "/admin/support-tickets",
      reviews: "/admin/moderation",
      notifications: "/admin/notifications",
      coupons: "/admin/coupons",
      emi: "/admin/emi/settings",
      wallet: "/admin/wallet",
      withdrawals: "/admin/withdrawals",
      cash_collection: "/admin/cash-collection",
      billing: "/admin/billing",
      payment_modes: "/admin/payment-modes",
      return_modes: "/admin/return-modes",
      settings: "/admin/settings",
      layout_branding: "/admin/layout-branding",
      hero_banners: "/admin/hero-categories",
      store_banners: "/admin/store-banners",
      faqs: "/admin/faqs",
      legal_pages: "/admin/legal-pages",
    };
    for (const key of MODULE_KEYS) {
      expect([key, sample[key]]).not.toEqual([key, undefined]);
      expect([key, modulesForPath(sample[key])]).toEqual([key, key]);
    }
  });
});
