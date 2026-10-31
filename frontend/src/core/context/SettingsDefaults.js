/** Default fallbacks when settings are not yet loaded or API fails */
export const DEFAULT_SETTINGS = {
  appName: "Anushka Connect",
  supportEmail: "",
  supportPhone: "",
  whatsappNumber: "8209224481",
  currencySymbol: "₹",
  currencyCode: "INR",
  timezone: "Asia/Kolkata",
  logoUrl: "/logo.png?v=connect",
  faviconUrl: "/logo.png?v=connect",
  primaryColor: "#FF5722",
  secondaryColor: "#0047AB",
  companyName: "",
  taxId: "",
  address: "",
  facebook: "",
  twitter: "",
  instagram: "",
  linkedin: "",
  youtube: "",
  playStoreLink: "",
  appStoreLink: "",
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
  keywords: [],
  returnDeliveryCommission: 0,
  deliveryPricingMode: "distance_based",
  pricingMode: "distance_based",
  customerBaseDeliveryFee: 30,
  riderBasePayout: 30,
  baseDeliveryCharge: 30,
  baseDistanceCapacityKm: 0.5,
  incrementalKmSurcharge: 10,
  deliveryPartnerRatePerKm: 5,
  fleetCommissionRatePerKm: 5,
  fixedDeliveryFee: 30,
  handlingFeeStrategy: "highest_category_fee",
  codEnabled: true,
  onlineEnabled: true,
  lowStockAlertsEnabled: true,
  productApproval: {
    sellerCreateRequiresApproval: false,
    sellerEditRequiresApproval: false,
  },
  footerMessage: "Sab kuchh ek basket mein",
  footerEmoji: "❤️",
  footerDescription: "Your daily dose of fresh, organic, and healthy products delivered straight to your door. Freshness guaranteed.",
  footerQuickLinksTitle: "Quick Links",
  footerQuickLinks: [
    { label: "About Us", href: "/about" },
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms of Use", href: "/terms" },
  ],
  footerCategoriesTitle: "Top Categories",
  footerCategoriesLinks: [
    { label: "Dairy & Bakery", href: "/category/dairy" },
    { label: "Fruits & Veggies", href: "/category/fruits" },
    { label: "Snacks", href: "/category/snacks" },
  ],
  footerContactTitle: "Get in Touch",
  footerCopyright: "",
  footerPrivacyUrl: "/privacy-policy",
  footerTermsUrl: "/terms",
  footerBgColor: "#051838",
  footerEnabled: true,
};

/**
 * Applies primary and secondary theme colors to document root via CSS variables.
 * Calculates luminance-based contrast color (white or black) for high readability.
 */
export function applyThemeColors(settings = {}) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (settings.primaryColor) {
    root.style.setProperty("--primary", settings.primaryColor);

    const hex = settings.primaryColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    const contrastColor = yiq >= 160 ? "#000000" : "#FFFFFF";
    root.style.setProperty("--primary-foreground", contrastColor);
  }

  // Update browser favicon dynamically
  if (settings.faviconUrl || settings.logoUrl) {
    applyFavicon(settings.faviconUrl || settings.logoUrl);
  }
}

export const applyThemeVariables = applyThemeColors;

/**
 * Updates dynamic browser favicon across all icon link tags.
 * Replaces tags and adds cache-buster so browsers immediately refresh tab icon.
 */
export function applyFavicon(faviconUrl) {
  if (typeof document === 'undefined') return;
  const url = (faviconUrl && String(faviconUrl).trim()) || '/logo.png?v=connect';
  if (!url) return;

  try {
    const existingLinks = document.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon']");
    existingLinks.forEach(el => el.remove());

    const cacheBuster = url.startsWith('data:')
      ? url
      : `${url}${url.includes('?') ? '&' : '?'}v=connect_${Date.now()}`;

    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = cacheBuster;
    document.head.appendChild(link);

    const shortcut = document.createElement('link');
    shortcut.rel = 'shortcut icon';
    shortcut.type = 'image/png';
    shortcut.href = cacheBuster;
    document.head.appendChild(shortcut);

    const apple = document.createElement('link');
    apple.rel = 'apple-touch-icon';
    apple.href = cacheBuster;
    document.head.appendChild(apple);
  } catch (e) {
    console.error("Failed to apply favicon:", e);
  }
}
