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

const DEFAULT_BASE = "#2875E8";

/** Blend hex toward white (t=0 base, t≈1 near-white). */
export function mixHexWithWhite(hex, t) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) {
    return "#f8fafc";
  }
  const normalized =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const value = normalized.slice(1);
  if (value.length !== 6) return "#f8fafc";

  const mix = (c) => Math.round(c + (255 - c) * t);
  const r = mix(parseInt(value.slice(0, 2), 16));
  const g = mix(parseInt(value.slice(2, 4), 16));
  const b = mix(parseInt(value.slice(4, 6), 16));
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
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
    [/grocery|fresh|food|produce|fruit|vegetable/, '#21885d'],
    [/decor|home|kitchen|household/, '#cb7135'],
    [/agri|garden|plant/, '#718942'],
    [/health|wellness|pharma|medical/, '#258c88'],
    [/beauty|personal|cosmetic/, '#b53d91'],
    [/fashion|apparel|cloth/, '#9d3e65'],
    [/wedding/, '#c95f86'],
    [/electronic|mobile|tech|device/, '#7958bd'],
    [/kid|baby|toy/, '#8656bd'],
    [/pet|animal/, '#bd8b26'],
    [/sport|fitness/, '#367fa7'],
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

