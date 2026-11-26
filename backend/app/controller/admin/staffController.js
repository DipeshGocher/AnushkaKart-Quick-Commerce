import mongoose from "mongoose";
import Admin from "../../models/admin.js";
import AdminRole from "../../models/adminRole.js";
import handleResponse from "../../utils/helper.js";
import { getErrorStatus } from "../../utils/httpError.js";
import { ADMIN_MODULES, sanitizePermissions } from "../../config/adminAccess.js";
import { resolveAdminAccessFromToken } from "../../services/adminAccessService.js";
import {
  adminRoleCreateSchema,
  adminRoleUpdateSchema,
  staffCreateSchema,
  staffUpdateSchema,
  validateSchema,
} from "../../validation/adminAuthValidation.js";

/**
 * Staff roles + staff logins for the admin panel.
 * Every handler here is main-admin only. verifyToken already refuses staff on /admin/staff,
 * and `requireMainAdmin` repeats the check so the rule cannot be lost if a route is moved.
 */

function requireMainAdmin(req, res) {
  if (req.adminAccess?.isSuper === true) return true;
  handleResponse(res, 403, "Only the main admin can manage staff and roles.");
  return false;
}

function badRequest(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function isObjectId(value) {
  return mongoose.isValidObjectId(value) && String(value).length === 24;
}

function roleDto(role, memberCount = 0) {
  return {
    id: String(role._id),
    name: role.name,
    description: role.description || "",
    permissions: sanitizePermissions(role.permissions),
    accessType: role.accessType === "read" ? "read" : "write",
    isActive: role.isActive !== false,
    memberCount,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

function staffDto(admin) {
  const role = admin.adminRole && typeof admin.adminRole === "object" ? admin.adminRole : null;
  return {
    id: String(admin._id),
    name: admin.name,
    email: admin.email,
    phone: admin.phone || "",
    isMainAdmin: !admin.adminRole,
    isActive: admin.isActive !== false,
    lastLogin: admin.lastLogin || null,
    createdAt: admin.createdAt,
    role: role
      ? {
          id: String(role._id),
          name: role.name,
          accessType: role.accessType === "read" ? "read" : "write",
          isActive: role.isActive !== false,
        }
      : null,
  };
}

/** GET /admin/access — what the signed-in admin may open (drives the menu). Any admin. */
export const getMyAccess = async (req, res) => {
  try {
    const access = req.adminAccess || (await resolveAdminAccessFromToken(req.user));
    if (!access?.ok) return handleResponse(res, 403, "Admin access not available");
    const admin = await Admin.findById(req.user.id).select("name email").lean();
    return handleResponse(res, 200, "Admin access fetched", {
      isMainAdmin: access.isSuper,
      roleName: access.roleName,
      accessType: access.accessType,
      permissions: access.permissions,
      name: admin?.name || "",
      email: admin?.email || "",
    });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

/** GET /admin/staff/modules — the pages a role can be given. */
export const listModules = async (req, res) => {
  if (!requireMainAdmin(req, res)) return;
  return handleResponse(res, 200, "Modules fetched", { modules: ADMIN_MODULES });
};

/* ───────────── Roles ───────────── */

export const listRoles = async (req, res) => {
  if (!requireMainAdmin(req, res)) return;
  try {
    const [roles, counts] = await Promise.all([
      AdminRole.find().sort({ createdAt: 1 }).lean(),
      Admin.aggregate([
        { $match: { adminRole: { $ne: null } } },
        { $group: { _id: "$adminRole", total: { $sum: 1 } } },
      ]),
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.total]));
    return handleResponse(res, 200, "Roles fetched", {
      items: roles.map((role) => roleDto(role, countMap.get(String(role._id)) || 0)),
    });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

function cleanPermissionsOrThrow(list) {
  const clean = sanitizePermissions(list);
  if (clean.length === 0) throw badRequest("Pick at least one valid page for this role");
  return clean;
}

export const createRole = async (req, res) => {
  if (!requireMainAdmin(req, res)) return;
  try {
    const payload = validateSchema(adminRoleCreateSchema, req.body || {});
    const role = await AdminRole.create({
      name: payload.name,
      nameKey: payload.name.toLowerCase(),
      description: payload.description || "",
      permissions: cleanPermissionsOrThrow(payload.permissions),
      accessType: payload.accessType,
      isActive: payload.isActive,
      createdBy: req.user.id,
    });
    return handleResponse(res, 201, "Role created", roleDto(role.toObject(), 0));
  } catch (error) {
    if (error?.code === 11000) {
      return handleResponse(res, 409, "A role with this name already exists");
    }
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const updateRole = async (req, res) => {
  if (!requireMainAdmin(req, res)) return;
  try {
    if (!isObjectId(req.params.id)) throw badRequest("Invalid role id");
    const payload = validateSchema(adminRoleUpdateSchema, req.body || {});

    const role = await AdminRole.findById(req.params.id);
    if (!role) return handleResponse(res, 404, "Role not found");

    if (payload.name !== undefined) {
      role.name = payload.name;
      role.nameKey = payload.name.toLowerCase();
    }
    if (payload.description !== undefined) role.description = payload.description;
    if (payload.permissions !== undefined) role.permissions = cleanPermissionsOrThrow(payload.permissions);
    if (payload.accessType !== undefined) role.accessType = payload.accessType;
    if (payload.isActive !== undefined) role.isActive = payload.isActive;
    await role.save();

    const memberCount = await Admin.countDocuments({ adminRole: role._id });
    return handleResponse(res, 200, "Role updated", roleDto(role.toObject(), memberCount));
  } catch (error) {
    if (error?.code === 11000) {
      return handleResponse(res, 409, "A role with this name already exists");
    }
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const deleteRole = async (req, res) => {
  if (!requireMainAdmin(req, res)) return;
  try {
    if (!isObjectId(req.params.id)) throw badRequest("Invalid role id");
    const role = await AdminRole.findById(req.params.id).lean();
    if (!role) return handleResponse(res, 404, "Role not found");

    const inUse = await Admin.countDocuments({ adminRole: role._id });
    if (inUse > 0) {
      return handleResponse(
        res,
        409,
        `${inUse} staff login(s) still use this role. Move or remove them first.`,
      );
    }
    await AdminRole.deleteOne({ _id: role._id });
    return handleResponse(res, 200, "Role deleted");
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

/* ───────────── Staff logins ───────────── */

export const listStaff = async (req, res) => {
  if (!requireMainAdmin(req, res)) return;
  try {
    // Only staff logins that have a role. The main admin accounts are not listed here (they are
    // not managed from this page), so the list shows just what the main admin creates.
    const admins = await Admin.find({ adminRole: { $ne: null } })
      .populate("adminRole", "name accessType isActive")
      .sort({ createdAt: 1 })
      .lean();
    return handleResponse(res, 200, "Staff fetched", { items: admins.map(staffDto) });
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

async function findActiveRoleOrThrow(roleId) {
  if (!isObjectId(roleId)) throw badRequest("Invalid role");
  const role = await AdminRole.findById(roleId).lean();
  if (!role) throw badRequest("Role not found");
  if (role.isActive === false) throw badRequest("This role is switched off. Turn it on first.");
  return role;
}

export const createStaff = async (req, res) => {
  if (!requireMainAdmin(req, res)) return;
  try {
    const payload = validateSchema(staffCreateSchema, req.body || {});
    const role = await findActiveRoleOrThrow(payload.roleId);

    const duplicate = await Admin.findOne({ email: payload.email }).select("_id").lean();
    if (duplicate) return handleResponse(res, 409, "An admin with this email already exists");

    const doc = {
      name: payload.name,
      email: payload.email,
      password: payload.password,
      role: "admin",
      isVerified: true,
      adminRole: role._id,
      isActive: true,
      createdBy: req.user.id,
    };
    // Only set the phone when given: the phone field is unique, and empty strings would clash.
    if (payload.phone) doc.phone = payload.phone;

    const admin = await Admin.create(doc);
    const created = await Admin.findById(admin._id)
      .populate("adminRole", "name accessType isActive")
      .lean();
    return handleResponse(res, 201, "Staff login created", staffDto(created));
  } catch (error) {
    if (error?.code === 11000) {
      return handleResponse(res, 409, "This email or phone is already used by another admin");
    }
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const updateStaff = async (req, res) => {
  if (!requireMainAdmin(req, res)) return;
  try {
    if (!isObjectId(req.params.id)) throw badRequest("Invalid staff id");
    const payload = validateSchema(staffUpdateSchema, req.body || {});

    const admin = await Admin.findById(req.params.id);
    if (!admin) return handleResponse(res, 404, "Staff login not found");
    if (!admin.adminRole) {
      return handleResponse(res, 403, "Main admin accounts cannot be changed from here.");
    }

    if (payload.name !== undefined) admin.name = payload.name;
    if (payload.phone !== undefined) admin.phone = payload.phone || undefined;
    if (payload.isActive !== undefined) admin.isActive = payload.isActive;
    if (payload.roleId !== undefined) {
      const role = await findActiveRoleOrThrow(payload.roleId);
      admin.adminRole = role._id;
    }
    if (payload.password !== undefined) admin.password = payload.password; // hashed by the model

    await admin.save();
    const updated = await Admin.findById(admin._id)
      .populate("adminRole", "name accessType isActive")
      .lean();
    return handleResponse(res, 200, "Staff login updated", staffDto(updated));
  } catch (error) {
    if (error?.code === 11000) {
      return handleResponse(res, 409, "This phone is already used by another admin");
    }
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const deleteStaff = async (req, res) => {
  if (!requireMainAdmin(req, res)) return;
  try {
    if (!isObjectId(req.params.id)) throw badRequest("Invalid staff id");
    const admin = await Admin.findById(req.params.id).select("adminRole").lean();
    if (!admin) return handleResponse(res, 404, "Staff login not found");
    if (!admin.adminRole) {
      return handleResponse(res, 403, "Main admin accounts cannot be deleted from here.");
    }
    await Admin.deleteOne({ _id: admin._id });
    return handleResponse(res, 200, "Staff login deleted");
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};
