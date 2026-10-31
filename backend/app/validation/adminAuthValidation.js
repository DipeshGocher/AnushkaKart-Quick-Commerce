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
