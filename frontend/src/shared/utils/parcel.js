/**
 * Parcel weight + box size helpers for the product forms.
 * Weight is saved as text like "500 g" or "1.5 kg" (what the courier booking reads).
 */

const WEIGHT_RE = /^(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|grams?)$/i;

/** "500g" / "1.5 kg" -> { value: "500", unit: "g" }. Anything unclear -> { value: "", unit: "g" }. */
export function parseWeightInput(text) {
  const m = String(text || "").trim().match(WEIGHT_RE);
  if (!m) return { value: "", unit: "g" };
  return { value: m[1], unit: m[2].toLowerCase().startsWith("k") ? "kg" : "g" };
}

export function composeWeight(value, unit) {
  const v = String(value ?? "").trim();
  return v === "" ? "" : `${v} ${unit === "kg" ? "kg" : "g"}`;
}

const positive = (n) => Number.isFinite(Number(n)) && Number(n) > 0 && String(n).trim() !== "";

/** Error text for the product form, or null when weight and box size are fine. */
export function validateParcel({ weight, length, breadth, height }) {
  const { value } = parseWeightInput(weight);
  if (!(Number(value) > 0)) return "Enter the parcel weight (in g or kg) with the packing.";
  if (!positive(length)) return "Enter the box length in cm.";
  if (!positive(breadth)) return "Enter the box width in cm.";
  if (!positive(height)) return "Enter the box height in cm.";
  return null;
}

export const PARCEL_HINT = "Packing ke saath ka weight aur box ka size bharo, courier wahi naapta hai.";

/** Text for the seller when a courier order has products without weight / box size. */
export function parcelWarningText(issues = []) {
  const lines = issues.map((i) => {
    const what = [i.weight && "weight", i.size && "box size"].filter(Boolean).join(" and ");
    return `- ${i.name}: ${what} not filled`;
  });
  return [
    "Parcel weight / box size is missing for this courier order.",
    "The courier will measure the parcel, and a wrong size can bring a weight penalty that is cut from your payout.",
    ...lines,
    "Fix it in Products (Parcel Weight & Box Dimensions).",
  ].join("\n");
}
