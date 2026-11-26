import { decideAdminAccess, findAccessRule, normalizeApiPath, sanitizePermissions, MODULE_KEYS } from "../app/config/adminAccess.js";

const mainAdmin = { isSuper: true, permissions: MODULE_KEYS, accessType: "write" };
const support = { isSuper: false, permissions: ["support_tickets"], accessType: "write" };
const money = {
  isSuper: false,
  permissions: ["wallet", "withdrawals", "cash_collection", "billing"],
  accessType: "write",
};
const viewer = { isSuper: false, permissions: ["orders"], accessType: "read" };

const ok = (access, method, url) => decideAdminAccess(access, method, url).allowed;
const why = (access, method, url) => decideAdminAccess(access, method, url).reason;

describe("admin role-based access: path rules", () => {
  it("normalizes api paths (prefix, query, case, slashes)", () => {
    expect(normalizeApiPath("/api/Orders/x/?a=1")).toBe("/orders/x");
    expect(normalizeApiPath("/api//admin//wallet-data/")).toBe("/admin/wallet-data");
    expect(normalizeApiPath("//api/admin/stats")).toBe("/admin/stats");
  });

  it("drops unknown permission keys", () => {
    expect(sanitizePermissions(["wallet", "wallet", "nope", " orders ", 5, null])).toEqual(["wallet", "orders"]);
    expect(sanitizePermissions("wallet")).toEqual([]);
  });

  describe("main admin", () => {
    it("can call anything, even a route that has no rule", () => {
      expect(ok(mainAdmin, "GET", "/api/admin/wallet-data")).toBe(true);
      expect(ok(mainAdmin, "POST", "/api/admin/staff/members")).toBe(true);
      expect(ok(mainAdmin, "DELETE", "/api/admin/brand-new-route")).toBe(true);
    });
  });

  describe("support employee (only Help Tickets)", () => {
    it("can work the ticket pages", () => {
      expect(ok(support, "GET", "/api/tickets/admin/all?page=1")).toBe(true);
      expect(ok(support, "PATCH", "/api/tickets/admin/status/65f000000000000000000001")).toBe(true);
      expect(ok(support, "POST", "/api/tickets/reply/65f000000000000000000001")).toBe(true);
    });

    it("can use the always-allowed helpers (own profile, bell, push, nav counts, public data)", () => {
      expect(ok(support, "GET", "/api/admin/access")).toBe(true);
      expect(ok(support, "GET", "/api/admin/profile")).toBe(true);
      expect(ok(support, "PUT", "/api/admin/profile/password")).toBe(true);
      expect(ok(support, "GET", "/api/notifications")).toBe(true);
      expect(ok(support, "PUT", "/api/notifications/mark-all-read")).toBe(true);
      expect(ok(support, "POST", "/api/push/register")).toBe(true);
      expect(ok(support, "GET", "/api/orders/admin-nav-counts")).toBe(true);
      expect(ok(support, "GET", "/api/settings")).toBe(true);
      expect(ok(support, "GET", "/api/categories")).toBe(true);
    });

    it("cannot reach money, orders, customers, sellers, products or settings", () => {
      for (const [method, url] of [
        ["GET", "/api/admin/wallet-data"],
        ["GET", "/api/admin/finance/summary"],
        ["POST", "/api/admin/finance/payouts/process"],
        ["PUT", "/api/admin/withdrawals/1"],
        ["PUT", "/api/admin/customer-withdrawals/1/pay"],
        ["POST", "/api/admin/settle-cash"],
        ["GET", "/api/admin/users"],
        ["PATCH", "/api/admin/users/1/status"],
        ["GET", "/api/admin/sellers/active"],
        ["GET", "/api/orders/seller-orders"],
        ["PUT", "/api/orders/status/ORD1"],
        ["POST", "/api/orders/ORD1/payment/approve-upi"],
        ["PUT", "/api/orders/returns/ORD1/approve"],
        ["POST", "/api/products"],
        ["PUT", "/api/settings"],
        ["PUT", "/api/admin/settings/platform"],
        ["GET", "/api/employees"],
        ["GET", "/api/emi/admin/quotes"],
        ["GET", "/api/admin/coupons"],
      ]) {
        expect([method, url, ok(support, method, url)]).toEqual([method, url, false]);
      }
    });

    it("can read one order's detail (a ticket is about an order) but not list or change orders", () => {
      expect(ok(support, "GET", "/api/orders/details/ORD1")).toBe(true);
      expect(ok(support, "GET", "/api/orders/seller-orders")).toBe(false);
      expect(ok(support, "PUT", "/api/orders/status/ORD1")).toBe(false);
    });

    it("cannot manage staff and roles", () => {
      expect(ok(support, "GET", "/api/admin/staff/roles")).toBe(false);
      expect(why(support, "GET", "/api/admin/staff/roles")).toBe("super_only");
      expect(ok(support, "POST", "/api/admin/staff/members")).toBe(false);
      expect(ok(support, "DELETE", "/api/admin/staff/members/1")).toBe(false);
    });

    it("is denied on an admin route that has no rule (deny by default)", () => {
      expect(ok(support, "GET", "/api/admin/something-new")).toBe(false);
      expect(why(support, "GET", "/api/admin/something-new")).toBe("no_rule");
    });

    it("cannot dodge a rule with upper case letters, a trailing slash, a double slash or a query string", () => {
      expect(ok(support, "POST", "/api/notifications/BROADCAST")).toBe(false);
      expect(ok(support, "GET", "/api/Admin/Wallet-Data")).toBe(false);
      expect(ok(support, "GET", "/api/admin//wallet-data/?x=1")).toBe(false);
      expect(ok(support, "GET", "/api/ADMIN/STAFF/ROLES")).toBe(false);
      expect(ok(support, "GET", "/api/Tickets/Admin/All")).toBe(true); // its own page, still allowed
    });
  });

  describe("manager (money pages)", () => {
    it("can use wallet, money requests, cash collection and fees", () => {
      expect(ok(money, "GET", "/api/admin/wallet-data")).toBe(true);
      expect(ok(money, "GET", "/api/admin/finance/ledger")).toBe(true);
      expect(ok(money, "GET", "/api/admin/seller-withdrawals")).toBe(true);
      expect(ok(money, "PUT", "/api/admin/withdrawals/1")).toBe(true);
      expect(ok(money, "PUT", "/api/admin/customer-withdrawals/1/pay")).toBe(true);
      expect(ok(money, "GET", "/api/admin/delivery-cash")).toBe(true);
      expect(ok(money, "POST", "/api/admin/settle-cash")).toBe(true);
      expect(ok(money, "PUT", "/api/admin/settings/delivery")).toBe(true);
    });

    it("can open an order's detail (needed from the money pages) but not change orders", () => {
      expect(ok(money, "GET", "/api/orders/details/ORD1")).toBe(true);
      expect(ok(money, "PUT", "/api/orders/status/ORD1")).toBe(false);
      expect(ok(money, "GET", "/api/orders/seller-orders")).toBe(false);
    });

    it("cannot reach support, customers or catalog", () => {
      expect(ok(money, "GET", "/api/tickets/admin/all")).toBe(false);
      expect(ok(money, "GET", "/api/admin/users")).toBe(false);
      expect(ok(money, "POST", "/api/products")).toBe(false);
      expect(ok(money, "PUT", "/api/settings/payment-modes")).toBe(false);
    });
  });

  describe("view-only role", () => {
    it("can read its pages but every change is refused", () => {
      expect(ok(viewer, "GET", "/api/orders/seller-orders")).toBe(true);
      expect(ok(viewer, "GET", "/api/orders/details/ORD1")).toBe(true);
      expect(ok(viewer, "PUT", "/api/orders/status/ORD1")).toBe(false);
      expect(why(viewer, "PUT", "/api/orders/status/ORD1")).toBe("read_only");
      expect(ok(viewer, "POST", "/api/orders/ORD1/payment/approve-upi")).toBe(false);
      expect(why(viewer, "POST", "/api/orders/ORD1/payment/approve-upi")).toBe("read_only");
    });

    it("still lets the person change their own password", () => {
      expect(ok(viewer, "PUT", "/api/admin/profile/password")).toBe(true);
    });

    it("does not give access to pages outside its role", () => {
      expect(ok(viewer, "GET", "/api/admin/wallet-data")).toBe(false);
      expect(why(viewer, "GET", "/api/admin/wallet-data")).toBe("forbidden");
    });
  });

  describe("every admin page call used by the panel has a rule", () => {
    // [method, url, a module that must unlock it]
    const calls = [
      ["GET", "/api/admin/stats", "dashboard"],
      ["GET", "/api/admin/categories?tree=true", "categories"],
      ["POST", "/api/admin/categories", "categories"],
      ["DELETE", "/api/admin/categories/1", "categories"],
      ["GET", "/api/admin/categories?flat=true", "products"],
      ["GET", "/api/products/moderation", "products"],
      ["PATCH", "/api/products/moderation/1/approve", "products"],
      ["PUT", "/api/products/1", "products"],
      ["POST", "/api/products/bulk-delete", "products"],
      ["POST", "/api/attributes", "products"],
      ["GET", "/api/orders/seller-orders", "orders"],
      ["PUT", "/api/orders/status/ORD1", "orders"],
      ["POST", "/api/orders/ORD1/payment/reject-upi", "orders"],
      ["GET", "/api/orders/workflow/ORD1/route", "orders"],
      ["POST", "/api/shipping/shiprocket/process/ORD1", "orders"],
      ["POST", "/api/shipping/shiprocket/cod-received/ORD1", "orders"],
      ["GET", "/api/admin/delivery-partners", "orders"],
      ["GET", "/api/orders/seller-returns", "returns"],
      ["GET", "/api/orders/ORD1/returns", "returns"],
      ["PUT", "/api/orders/returns/ORD1/approve", "returns"],
      ["PUT", "/api/orders/returns/ORD1/qc", "returns"],
      ["PUT", "/api/orders/returns/ORD1/dispute/resolve", "returns"],
      ["PUT", "/api/orders/returns/ORD1/assign-delivery", "returns"],
      ["POST", "/api/shipping/shiprocket/reverse/pickup/ORD1", "returns"],
      ["POST", "/api/notifications/broadcast", "notifications"],
      ["GET", "/api/notifications/broadcast/audience-stats", "notifications"],
      ["GET", "/api/admin/coupons", "coupons"],
      ["PUT", "/api/admin-offers/reorder", "coupons"],
      ["GET", "/api/tickets/admin/all", "support_tickets"],
      ["PATCH", "/api/tickets/admin/status/1", "support_tickets"],
      ["POST", "/api/tickets/reply/1", "support_tickets"],
      ["GET", "/api/reviews/admin/pending", "reviews"],
      ["PATCH", "/api/reviews/admin/status/1", "reviews"],
      ["DELETE", "/api/reviews/admin/1", "reviews"],
      ["GET", "/api/admin/sellers", "sellers"],
      ["PATCH", "/api/admin/sellers/approve/1", "sellers"],
      ["DELETE", "/api/admin/sellers/reject/1", "sellers"],
      ["GET", "/api/admin/sellers/1/banners", "store_banners"],
      ["PUT", "/api/admin/sellers/1/banners", "store_banners"],
      ["GET", "/api/admin/delivery-partners", "delivery_partners"],
      ["PATCH", "/api/admin/delivery-partners/approve/1", "delivery_partners"],
      ["DELETE", "/api/admin/delivery-partners/reject/1", "delivery_partners"],
      ["GET", "/api/admin/sos-alerts", "sos_alerts"],
      ["PUT", "/api/admin/sos-alerts/1/resolve", "sos_alerts"],
      ["GET", "/api/shipping/pincodes", "delivery_pincodes"],
      ["PATCH", "/api/shipping/pincodes/1/toggle", "delivery_pincodes"],
      ["GET", "/api/emi/admin/config", "emi"],
      ["PATCH", "/api/emi/admin/quotes/1", "emi"],
      ["GET", "/api/admin/users", "customers"],
      ["GET", "/api/admin/users/1", "customers"],
      ["POST", "/api/admin/users/1/notify", "customers"],
      ["GET", "/api/employees", "employees"],
      ["POST", "/api/employees", "employees"],
      ["GET", "/api/employees/leaderboard", "employees"],
      ["GET", "/api/admin/wallet-data", "wallet"],
      ["GET", "/api/admin/finance/summary", "wallet"],
      ["GET", "/api/admin/finance/export-statement", "wallet"],
      ["GET", "/api/admin/seller-withdrawals", "withdrawals"],
      ["GET", "/api/admin/delivery-withdrawals", "withdrawals"],
      ["GET", "/api/admin/customer-withdrawals", "withdrawals"],
      ["PUT", "/api/admin/customer-withdrawals/1/reject", "withdrawals"],
      ["GET", "/api/admin/rider-cash-details/1", "cash_collection"],
      ["GET", "/api/admin/cash-history", "cash_collection"],
      ["GET", "/api/admin/settings/platform", "billing"],
      ["PUT", "/api/admin/settings/delivery", "billing"],
      ["PUT", "/api/settings/payment-modes", "payment_modes"],
      ["PUT", "/api/settings/return-windows", "return_modes"],
      ["PUT", "/api/settings", "settings"],
      ["PUT", "/api/admin/settings/platform", "settings"],
      ["POST", "/api/settings/upload?type=logo", "layout_branding"],
      ["PUT", "/api/settings", "layout_branding"],
      ["GET", "/api/admin/experience/hero", "hero_banners"],
      ["PUT", "/api/admin/experience/reorder", "hero_banners"],
      ["GET", "/api/admin/faqs", "faqs"],
      ["DELETE", "/api/admin/faqs/1", "faqs"],
      ["PUT", "/api/legal", "legal_pages"],
    ];

    it.each(calls)("%s %s is unlocked by %s", (method, url, moduleKey) => {
      const access = { isSuper: false, permissions: [moduleKey], accessType: "write" };
      expect(findAccessRule(method, url)).not.toBeNull();
      expect(decideAdminAccess(access, method, url)).toEqual({ allowed: true });
    });

    it("every module key is used by at least one rule", () => {
      const used = new Set(calls.map((c) => c[2]));
      const missing = MODULE_KEYS.filter((k) => !used.has(k));
      expect(missing).toEqual([]);
    });
  });
});
