/**
 * Maps a caught error to the HTTP status it should produce.
 *
 * - Errors that set an explicit `statusCode` (the convention across services)
 *   keep it.
 * - Failures caused by client input are 4xx, not server faults:
 *   malformed ObjectIds / schema validation / Joi validation -> 400,
 *   unique-index conflicts -> 409.
 * - Everything else is a 500.
 */
export function getErrorStatus(error) {
  const explicit = Number(error?.statusCode);
  if (Number.isInteger(explicit) && explicit >= 400 && explicit <= 599) {
    return explicit;
  }
  if (
    error?.name === "CastError" ||
    error?.name === "ValidationError" ||
    error?.isJoi === true
  ) {
    return 400;
  }
  if (error?.code === 11000) {
    return 409;
  }
  return 500;
}
