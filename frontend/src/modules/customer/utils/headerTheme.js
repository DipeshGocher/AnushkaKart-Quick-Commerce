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
  const base = getBaseHexColor(baseHeaderColor) || DEFAULT_BASE;
  const mid = shiftHex(base, 20);
  return shiftHex(mid, -26);
}

/** Gradient for floating mini cart pill (same palette as header, horizontal). */
export function buildMiniCartGradient(baseHeaderColor) {
  const base = getBaseHexColor(baseHeaderColor) || DEFAULT_BASE;
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
  if (category?.headerColor) return category.headerColor;
  if (category?.themeColor) return category.themeColor;
  if (category?.color) return category.color;
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
const isAllCategory = (category) =>
  !category ||
  category._id === 'all' ||
  category.id === 'all' ||
  String(category.slug || '').toLowerCase() === 'all' ||
  String(category.name || '').toLowerCase() === 'all';

/** Curated unified header color: Whatever background color is set on "All" category applies to all categories */
export function getCustomerHeaderColor(category, categories = []) {
  return getCategoryHeaderColor(category, categories);
}

export const FLIPKART_BLUE_PURPLE_GRADIENT = "linear-gradient(180deg, #0A24AC 0%, #3023C0 45%, #681FD6 100%)";
export const DEFAULT_HEADER_COLOR = FLIPKART_BLUE_PURPLE_GRADIENT;

export function getBaseHexColor(color) {
  if (!color || typeof color !== "string") return "#0A24AC";
  if (color.startsWith("#")) return color;
  const match = color.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/);
  return match ? match[0] : "#0A24AC";
}

/** Check if color has high luminance (bright), requiring dark/black text */
export function isBrightColor(color) {
  if (!color || typeof color !== "string") return false;
  let targetHex = color;
  if (color.includes("gradient")) {
    targetHex = getBaseHexColor(color);
  }
  let r = 0, g = 0, b = 0;
  if (targetHex.startsWith('#')) {
    const clean = targetHex.replace('#', '');
    if (clean.length === 3) {
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
    } else {
      r = parseInt(clean.substring(0, 2), 16) || 0;
      g = parseInt(clean.substring(2, 4), 16) || 0;
      b = parseInt(clean.substring(4, 6), 16) || 0;
    }
  } else if (targetHex.startsWith('rgb')) {
    const parts = targetHex.match(/\d+/g);
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
 * - Always uses the "All" category's headerColor for all categories (Grocery, Electronics, Mobile, etc.)
 * - Defaults to Flipkart Blue -> Purple Gradient if not set or set to old placeholder.
 */
export function getCategoryHeaderColor(category, categories = []) {
  // 1. Look for the "All" category's headerColor first
  const allCat = (Array.isArray(categories) && categories.find((c) => isAllCategory(c))) ||
    (isAllCategory(category) ? category : null);

  const rawColor = allCat?.headerColor || category?.headerColor;

  if (rawColor && typeof rawColor === "string" && rawColor.trim()) {
    const trimmed = rawColor.trim();
    // If it's an old placeholder default, upgrade to the Flipkart gradient
    if (trimmed === "#0b1a8e" || trimmed === "#1e293b" || trimmed === "#2875E8") {
      return DEFAULT_HEADER_COLOR;
    }
    return trimmed;
  }

  return DEFAULT_HEADER_COLOR;
}

/**
 * Icons and text in the header are always pure white as requested.
 */
export function getCategoryHeaderTextColor() {
  return "#ffffff";
}

