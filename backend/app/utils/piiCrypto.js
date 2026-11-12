import crypto from "crypto";

/**
 * Encrypt / mask customer ID numbers (PAN, Aadhaar) so they are never stored or logged in plain text.
 * AES-256-GCM; key from FINANCE_PII_KEY (falls back to JWT_SECRET so it works out of the box).
 * Stored format:  v1:<iv>:<tag>:<ciphertext>  (all base64)
 */

function getKey() {
  const secret = process.env.FINANCE_PII_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error("FINANCE_PII_KEY (or JWT_SECRET) must be set to store ID numbers");
  return crypto.createHash("sha256").update(String(secret)).digest();
}

export function encryptPii(plain) {
  const text = String(plain || "");
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decryptPii(payload) {
  const value = String(payload || "");
  if (!value) return "";
  const [version, iv, tag, data] = value.split(":");
  if (version !== "v1" || !iv || !tag || !data) return "";
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

/** 123412341234 -> "XXXX XXXX 1234" */
export function maskAadhaar(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 12 ? `XXXX XXXX ${digits.slice(-4)}` : "";
}

/** ABCDE1234F -> "ABCDE****F" */
export function maskPan(value) {
  const pan = String(value || "").toUpperCase().trim();
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan) ? `${pan.slice(0, 5)}****${pan.slice(9)}` : "";
}
