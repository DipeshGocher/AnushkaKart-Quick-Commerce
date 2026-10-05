/** Shift hex color channels by amount (negative = darker). */
export function shiftHex(hex, amount) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return hex;

  const normalized =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;

  const value = normalized.slice(1);
  if (value.length !== 6) return hex;

  const clamp = (num) => Math.max(0, Math.min(255, num + amount));
  const r = clamp(parseInt(value.slice(0, 2), 16));
  const g = clamp(parseInt(value.slice(2, 4), 16));
  const b = clamp(parseInt(value.slice(4, 6), 16));

  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

// Standard category tile colors (clean neutral light-grey matching reference design)
export const CATEGORY_CARD_BG = "#f4f4f4";
export const CATEGORY_CARD_BORDER = "#e5e7eb";
export const CATEGORY_CARD_HOVER_BG = "#eaeaea";
export const CATEGORY_CARD_SELECTED_BG = "#e5e7eb";

const DEFAULT_BASE = "#2875E8";


/** Blend hex toward white (t=0 base, t≈1 near-white). */
const NAMED_COLORS = {
  purple: '#800080',
  violet: '#8a2be2',
  indigo: '#4b0082',
  blue: '#2563eb',
  green: '#16a34a',
  red: '#dc2626',
  orange: '#ea580c',
  yellow: '#ca8a04',
  pink: '#db2777',
  teal: '#0d9488',
  cyan: '#0891b2',
  sand: '#D8B863',
  watermelon: '#FE7F9C',
  fossil: '#787276',
};

/** Blend hex toward white (t=0 base, t≈1 near-white). */
export function mixHexWithWhite(hex, t) {
  if (!hex || typeof hex !== "string") {
    return "#f8fafc";
  }
  let color = hex.trim().toLowerCase();
  if (NAMED_COLORS[color]) color = NAMED_COLORS[color];

  let r = 240, g = 240, b = 240;

  if (color.startsWith("#")) {
    const normalized =
      color.length === 4
        ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        : color;
    const value = normalized.slice(1);
    if (value.length === 6) {
      r = parseInt(value.slice(0, 2), 16) || 0;
      g = parseInt(value.slice(2, 4), 16) || 0;
      b = parseInt(value.slice(4, 6), 16) || 0;
    }
  } else if (color.startsWith("rgb")) {
    const parts = color.match(/\d+/g);
    if (parts && parts.length >= 3) {
      r = parseInt(parts[0], 10);
      g = parseInt(parts[1], 10);
      b = parseInt(parts[2], 10);
    }
  }

  const mix = (c) => Math.round(c + (255 - c) * t);
  return `#${[mix(r), mix(g), mix(b)]
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Search field surface: tinted header theme, a bit darker than near-white. */
export function buildSearchBarBackgroundColor(baseHeaderColor) {
  const base = baseHeaderColor || DEFAULT_BASE;
  return mixHexWithWhite(base, 0.7);
}

/**
 * Same gradient as the main location header (category-driven).
 */
export function buildHeaderGradient(baseHeaderColor) {
  const base = baseHeaderColor || DEFAULT_BASE;
  return `linear-gradient(to bottom, ${shiftHex(base, -18)} 0%, ${shiftHex(base, 20)} 54%, ${shiftHex(base, 165)} 100%)`;
}

/** Solid fill for floating cart pill: header mid tone, slightly darker. */
export function buildMiniCartColor(baseHeaderColor) {
  const base = baseHeaderColor || DEFAULT_BASE;
  const mid = shiftHex(base, 20);
  return shiftHex(mid, -26);
}

/** Gradient for floating mini cart pill (same palette as header, horizontal). */
export function buildMiniCartGradient(baseHeaderColor) {
  const base = baseHeaderColor || DEFAULT_BASE;
  const top = shiftHex(base, -12);
  const mid = shiftHex(base, 20);
  const deep = shiftHex(mid, -32);
  return `linear-gradient(135deg, ${top} 0%, ${mid} 48%, ${deep} 100%)`;
}

const HEADER_PALETTE = [
  '#3478d3', '#21885d', '#cb7135', '#9d3e65', '#b53d91', '#7958bd',
  '#bd8b26', '#c95f86', '#258c88', '#bf5c5a', '#967141', '#6f72ba',
  '#ca774f', '#367fa7', '#9d4c83', '#718942', '#b46898', '#4a8eaa',
];

const getThemeColor = (category) => {
  const label = `${category?.name || ''} ${category?.slug || ''}`.toLowerCase();
  const themes = [
    [/grocery|fresh|food|produce|fruit|vegetable/, '#166534'], // green a little dark
    [/electronic|tech/, '#003957'], // cobalt blue (#003957)
    [/mobile|phone|smartphone|device/, '#1A43BF'], // #1A43BF
    [/home|appliance|decor|kitchen|household/, '#787276'], // Fossil (#787276)
    [/fashion|apparel|cloth/, '#D8B863'], // Sand (#D8B863)
    [/beauty|personal|cosmetic|skin/, '#FE7F9C'], // Watermelon (#FE7F9C)
    [/agri|garden|plant/, '#166534'],
    [/health|wellness|pharma|medical/, '#258c88'],
    [/kid|baby|toy/, '#D8B863'],
    [/pet|animal/, '#8d5b4c'],
    [/sport|fitness/, '#1A43BF'],
  ];
  return themes.find(([pattern]) => pattern.test(label))?.[1];
};

const categoryKey = (category) => String(category?._id || category?.id || category?.slug || category?.name || 'all');
const isAllCategory = (category) => !category || String(category.name || category.slug || '').toLowerCase() === 'all';

/** Curated medium-tone colors keep every visible category distinct. */
export function getCustomerHeaderColor(category, categories = []) {
  if (isAllCategory(category)) return '#3478d3';

  const visibleCategories = categories.length ? categories : [category];
  const usedColors = new Set();
  for (let index = 0; index < visibleCategories.length; index += 1) {
    const item = visibleCategories[index];
    let color = isAllCategory(item)
      ? '#3478d3'
      : getThemeColor(item) || HEADER_PALETTE[index % HEADER_PALETTE.length];

    if (usedColors.has(color.toLowerCase())) {
      color = HEADER_PALETTE.find((candidate) => !usedColors.has(candidate)) ||
        `hsl(${Math.round((index * 137.508) % 360)} 58% 44%)`;
    }
    usedColors.add(color.toLowerCase());
    if (categoryKey(item) === categoryKey(category)) return color;
  }

  return getThemeColor(category) || HEADER_PALETTE[1];
}

/** Check if color has high luminance (bright), requiring dark/black text */
export function isBrightColor(color) {
  if (!color || typeof color !== "string") return false;
  let r = 0, g = 0, b = 0;
  if (color.startsWith('#')) {
    const clean = color.replace('#', '');
    if (clean.length === 3) {
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
    } else {
      r = parseInt(clean.substring(0, 2), 16) || 0;
      g = parseInt(clean.substring(2, 4), 16) || 0;
      b = parseInt(clean.substring(4, 6), 16) || 0;
    }
  } else if (color.startsWith('rgb')) {
    const parts = color.match(/\d+/g);
    if (parts && parts.length >= 3) {
      r = parseInt(parts[0], 10);
      g = parseInt(parts[1], 10);
      b = parseInt(parts[2], 10);
    }
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}

/**
 * Resolves the primary base theme color for a header category.
 * - Handles the "All" category default light blue (#dcecff)
 * - Checks preset patterns for primary categories (Groceries, Electronics, Mobiles, etc.)
 * - For new or custom categories (e.g. "Festival" with purple), falls back to category.headerColor / themeColor / color
 */
export function getCategoryHeaderColor(category) {
  if (
    !category ||
    category.id === "all" ||
    category._id === "all" ||
    String(category.slug || "").toLowerCase() === "all" ||
    String(category.name || "").toLowerCase() === "all"
  ) {
    return "#dcecff";
  }

  const text = `${category.name || ""} ${category.slug || ""}`.toLowerCase();
  if (/grocer/i.test(text)) return "#166534"; // green a little dark
  if (/electr/i.test(text)) return "#003957"; // cobalt blue (#003957)
  if (/mobil|phone/i.test(text)) return "#1A43BF"; // #1A43BF
  if (/home|appliance/i.test(text)) return "#787276"; // Fossil (#787276)
  if (/fashion|cloth/i.test(text)) return "#D8B863"; // Sand (#D8B863)
  if (/beaut|skin|cosmetic/i.test(text)) return "#FE7F9C"; // Watermelon (#FE7F9C)

  return (
    category.headerColor ||
    category.themeColor ||
    category.color ||
    category.backgroundColor ||
    "#003957"
  );
}

