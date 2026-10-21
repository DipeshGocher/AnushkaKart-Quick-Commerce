/**
 * Status Bar Theme Utility
 * Dynamically synchronizes the mobile device status bar (time, battery, WiFi bar)
 * with the active screen / modal header in both Android WebView (Flutter) and mobile browsers.
 */

import AppZetoBridge from '@/lib/appZetoBridge';

let currentAppliedColor = null;

/**
 * Parses any color string (hex, rgb, or linear-gradient) into a clean hex string.
 * @param {string} color
 * @returns {string} Hex color code (e.g. #FFFFFF, #0A24AC)
 */
export function normalizeHexColor(color) {
  if (!color || typeof color !== 'string') return '#0A24AC';
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    if (trimmed.length === 4) {
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
    }
    return trimmed.substring(0, 7);
  }
  if (trimmed.includes('gradient')) {
    const match = trimmed.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/);
    return match ? normalizeHexColor(match[0]) : '#0A24AC';
  }
  if (trimmed.startsWith('rgb')) {
    const parts = trimmed.match(/\d+/g);
    if (parts && parts.length >= 3) {
      const r = Math.min(255, parseInt(parts[0], 10)).toString(16).padStart(2, '0');
      const g = Math.min(255, parseInt(parts[1], 10)).toString(16).padStart(2, '0');
      const b = Math.min(255, parseInt(parts[2], 10)).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
  }
  return '#0A24AC';
}

/**
 * Checks if a color is bright / light, which requires dark (black) icons.
 * @param {string} color
 * @returns {boolean} True if background is bright (requires dark icons)
 */
export function isColorBright(color) {
  const hex = normalizeHexColor(color);
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

/**
 * Dynamically updates the Status Bar color and icon brightness.
 * Works across:
 * 1. Android WebViews & Chrome via <meta name="theme-color">
 * 2. Flutter Native Wrapper via AppZetoBridge / window.Flutter.postMessage
 * 3. iOS Safari via <meta name="apple-mobile-web-app-status-bar-style">
 * 4. CSS root styling via --app-status-bar-color
 *
 * @param {string} rawColor - Color string (hex, gradient, rgb)
 * @param {boolean|null} forceDarkIcons - Optional override for icon brightness (true for dark, false for white)
 */
export function setStatusBarColor(rawColor, forceDarkIcons = null) {
  if (typeof document === 'undefined') return;

  const hexColor = normalizeHexColor(rawColor);
  const darkIcons = forceDarkIcons !== null ? Boolean(forceDarkIcons) : isColorBright(hexColor);

  // Avoid redundant DOM updates if already set
  if (currentAppliedColor === `${hexColor}_${darkIcons}`) {
    return;
  }
  currentAppliedColor = `${hexColor}_${darkIcons}`;

  try {
    // 1. Update or create <meta name="theme-color">
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', hexColor);

    // 2. iOS Safari Web App status bar style
    let metaApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (metaApple) {
      metaApple.setAttribute('content', darkIcons ? 'default' : 'black-translucent');
    }

    // 3. CSS root variables
    document.documentElement.style.setProperty('--app-status-bar-color', hexColor);
    document.documentElement.style.setProperty('--app-status-bar-icon-theme', darkIcons ? 'dark' : 'light');

    // 4. Send to Flutter Native Wrapper (AppZetoBridge)
    if (typeof window !== 'undefined' && window.Flutter && typeof window.Flutter.postMessage === 'function') {
      try {
        window.Flutter.postMessage(JSON.stringify({
          type: 'set_status_bar',
          color: hexColor,
          darkIcons: darkIcons,
          statusBarColor: hexColor,
          isDark: darkIcons,
        }));
      } catch (_) {
        try {
          window.Flutter.postMessage(`set_status_bar:${hexColor}`);
        } catch (__) {}
      }
    }
  } catch (err) {
    console.warn('[statusBar] Failed to update status bar:', err);
  }
}

export default {
  setStatusBarColor,
  normalizeHexColor,
  isColorBright,
};
