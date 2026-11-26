import mongoose from "mongoose";
import { ACCESS_TYPES } from "../config/adminAccess.js";

/**
 * A role the main admin defines for the admin panel (for example "Manager" or "Support Employee").
 * `permissions` are admin page keys (see config/adminAccess.js). `accessType` "read" makes the
 * role view-only: it can open its pages but cannot change anything.
 */
const adminRoleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // lower-case copy of the name, used to keep role names unique
    nameKey: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    permissions: { type: [String], default: [] },
    accessType: { type: String, enum: ACCESS_TYPES, default: "write" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true },
);

export default mongoose.models.AdminRole || mongoose.model("AdminRole", adminRoleSchema);
