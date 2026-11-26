import Joi from "joi";

// Custom messages: Joi's defaults for pattern errors echo the submitted value,
// which would leak the password into responses and logs.
const passwordSchema = Joi.string()
  .min(10)
  .max(128)
  .pattern(/[a-z]/, "lowercase")
  .pattern(/[A-Z]/, "uppercase")
  .pattern(/[0-9]/, "number")
  .required()
  .messages({
    "string.min": "{#label} must be at least {#limit} characters long",
    "string.max": "{#label} must be at most {#limit} characters long",
    "string.pattern.name": "{#label} must contain at least one {#name} character",
  });

export const bootstrapAdminSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: passwordSchema,
});

export const updateAdminPasswordSchema = Joi.object({
  currentPassword: Joi.string().max(128).required().label("Current password"),
  newPassword: passwordSchema
    .invalid(Joi.ref("currentPassword"))
    .label("New password")
    .messages({ "any.invalid": "New password must be different from the current password" }),
});

export const loginAdminSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

export function validateSchema(schema, payload) {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (!error) return value;
  const err = new Error(error.details.map((item) => item.message).join("; "));
  err.statusCode = 400;
  throw err;
}

/* ── Staff roles & staff logins (admin panel role-based access) ── */

const objectIdSchema = Joi.string().hex().length(24);

export const adminRoleCreateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(60).required().label("Role name"),
  description: Joi.string().trim().allow("").max(300).default(""),
  permissions: Joi.array()
    .items(Joi.string().trim().max(60))
    .min(1)
    .required()
    .messages({ "array.min": "Pick at least one page for this role" }),
  accessType: Joi.string().valid("write", "read").default("write"),
  isActive: Joi.boolean().default(true),
});

export const adminRoleUpdateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(60).label("Role name"),
  description: Joi.string().trim().allow("").max(300),
  permissions: Joi.array()
    .items(Joi.string().trim().max(60))
    .min(1)
    .messages({ "array.min": "Pick at least one page for this role" }),
  accessType: Joi.string().valid("write", "read"),
  isActive: Joi.boolean(),
}).min(1);

const phoneSchema = Joi.string()
  .trim()
  .allow("")
  .pattern(/^[0-9+\-\s]{7,15}$/)
  .messages({ "string.pattern.base": "Phone number is not valid" });

export const staffCreateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().trim().lowercase().email().required(),
  phone: phoneSchema,
  password: passwordSchema,
  roleId: objectIdSchema.required().label("Role"),
});

export const staffUpdateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80),
  phone: phoneSchema,
  roleId: objectIdSchema.label("Role"),
  isActive: Joi.boolean(),
  password: passwordSchema.optional(),
}).min(1);
