import Admin from "../models/admin.js";
import AdminRole from "../models/adminRole.js";
import { MODULE_KEYS, sanitizePermissions } from "../config/adminAccess.js";

/**
 * What the signed-in admin may do.
 *
 * Returns:
 *   { ok: true,  isSuper: true,  permissions: [...all], accessType: "write", roleName: "Main Admin" }
 *   { ok: true,  isSuper: false, permissions: [...],    accessType: "write"|"read", roleName, roleId }
 *   { ok: false, reason: "missing" | "inactive" | "role_inactive" }
 */

function mainAdminAccess() {
  return {
    ok: true,
    isSuper: true,
    permissions: [...MODULE_KEYS],
    accessType: "write",
    roleName: "Main Admin",
    roleId: null,
  };
}

/**
 * Reads the admin and its role from the database. Used for staff logins so that switching a
 * staff login off, or editing its role, takes effect on the very next request.
 */
export async function loadAdminAccess(adminId) {
  if (!adminId) return { ok: false, reason: "missing" };

  const admin = await Admin.findById(adminId).select("isActive adminRole").lean();
  if (!admin) return { ok: false, reason: "missing" };
  if (admin.isActive === false) return { ok: false, reason: "inactive" };

  if (!admin.adminRole) return mainAdminAccess();

  const role = await AdminRole.findById(admin.adminRole).lean();
  if (!role || role.isActive === false) return { ok: false, reason: "role_inactive" };

  return {
    ok: true,
    isSuper: false,
    permissions: sanitizePermissions(role.permissions),
    accessType: role.accessType === "read" ? "read" : "write",
    roleName: role.name,
    roleId: String(role._id),
  };
}

/**
 * Access for a verified token payload.
 * Tokens of staff logins carry `rid` (their role id): those are checked against the database on every
 * request. Tokens without `rid` belong to a main admin (every admin created before roles existed), and
 * keep working exactly as before with no extra database call.
 * Nobody can add `rid` or remove it: the token is signed with the server secret.
 */
export async function resolveAdminAccessFromToken(decoded) {
  if (!decoded?.rid) return mainAdminAccess();
  return loadAdminAccess(decoded.id);
}
