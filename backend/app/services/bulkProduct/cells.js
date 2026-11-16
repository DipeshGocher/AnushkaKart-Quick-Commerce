/**
 * Cell helpers for the bulk upload: whatever a seller types in Excel is turned into clean text /
 * numbers here, and nothing in here ever throws.
 */

/** Excel cell value (string, number, date, rich text, hyperlink, formula result...) -> plain text. */
export function toText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r?.text ?? "").join("");
    if (v.text != null) return toText(v.text); // hyperlink
    if (v.result != null) return toText(v.result); // formula
    if (v.hyperlink) return String(v.hyperlink);
  }
  return "";
}

/** Plain, trimmed single-line text with HTML tags removed (descriptions are shown as HTML later). */
export function cleanText(v, max = 200) {
  const t = toText(v)
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? t.slice(0, max).trim() : t;
}

/** Like cleanText but keeps line breaks (for descriptions). */
export function cleanParagraph(v, max = 5000) {
  const t = toText(v)
    .replace(/\r\n?/g, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t.length > max ? t.slice(0, max).trim() : t;
}

/** "₹1,299", " 999 ", 999, "Rs. 50" -> number; anything else -> null. */
export function parseNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = toText(v)
    .replace(/₹|rs\.?|inr/gi, "")
    .replace(/[,\s]/g, "");
  if (t === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** true / false for yes-no style cells, undefined when empty, null when not understood. */
export function parseYesNo(v) {
  const t = toText(v).trim().toLowerCase();
  if (t === "") return undefined;
  if (["yes", "y", "true", "1", "haan", "han", "ha"].includes(t)) return true;
  if (["no", "n", "false", "0", "nahi", "nahin", "na"].includes(t)) return false;
  return null;
}

/** "a, b\nc" -> ["a","b","c"] (trimmed, no blanks, no duplicates, case-insensitive). */
export function splitList(v, { max = 20, itemMax = 200 } = {}) {
  const seen = new Set();
  const out = [];
  for (const part of toText(v).split(/[,\n;]/)) {
    const t = part.trim().slice(0, itemMax);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** "g", "grams", "KG" -> "g" | "kg"; anything else -> null. */
export function normalizeUnit(v) {
  const t = toText(v).trim().toLowerCase();
  if (["g", "gm", "gms", "gram", "grams"].includes(t)) return "g";
  if (["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms"].includes(t)) return "kg";
  return null;
}

/** A usable http(s) link or null. Google Drive "share" links are turned into direct download links. */
export function normalizeImageUrl(v) {
  const raw = toText(v).trim();
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.hostname === "drive.google.com") {
    const m = url.pathname.match(/\/file\/d\/([^/]+)/) || null;
    const id = (m && m[1]) || url.searchParams.get("id");
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  return url.toString();
}

/** Text that starts like an Excel formula is prefixed so it stays text when exported again. */
export function safeForSheet(v) {
  const t = toText(v);
  return /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
}
