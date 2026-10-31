import Admin from "../../models/admin.js";
import handleResponse from "../../utils/helper.js";
import { getErrorStatus } from "../../utils/httpError.js";
import {
  updateAdminPasswordSchema,
  validateSchema,
} from "../../validation/adminAuthValidation.js";

export const getAdminProfile = async (req, res) => {
  try {
    console.log('[ProfileService] Fetching admin profile for ID:', req.user?.id);
    if (!req.user?.id) {
      console.error('[ProfileService] Missing ID in req.user');
      return handleResponse(res, 400, "Missing user ID in session");
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      console.warn('[ProfileService] Admin document not found in database for ID:', req.user.id);
      return handleResponse(res, 404, "Admin not found");
    }

    console.log('[ProfileService] Successfully fetched profile for:', admin.email);
    return handleResponse(
      res,
      200,
      "Admin profile fetched successfully",
      admin,
    );
  } catch (error) {
    console.error('[ProfileService] FATAL ERROR:', error);
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const updateAdminProfile = async (req, res) => {
  try {
    const { name, email } = req.body;

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return handleResponse(res, 404, "Admin not found");
    }

    if (name) {
      admin.name = name;
    }

    if (email) {
      admin.email = email;
    }

    const updatedAdmin = await admin.save();

    return handleResponse(
      res,
      200,
      "Admin profile updated successfully",
      updatedAdmin,
    );
  } catch (error) {
    if (error.code === 11000) {
      return handleResponse(res, 400, "Email already in use");
    }

    return handleResponse(res, getErrorStatus(error), error.message);
  }
};

export const updateAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = validateSchema(
      updateAdminPasswordSchema,
      req.body || {},
    );

    const admin = await Admin.findById(req.user.id).select("+password");
    if (!admin) {
      return handleResponse(res, 404, "Admin not found");
    }

    // 400, not 401: the session is valid, only the submitted field is wrong.
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return handleResponse(res, 400, "Current password is incorrect");
    }

    admin.password = newPassword;
    await admin.save();

    return handleResponse(res, 200, "Password updated successfully");
  } catch (error) {
    return handleResponse(res, getErrorStatus(error), error.message);
  }
};
