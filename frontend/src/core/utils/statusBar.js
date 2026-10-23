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
    // 1. Force Chromium / Android WebView to update theme-color by replacing existing meta elements
    const existingMetas = document.querySelectorAll('meta[name="theme-color"]');
    existingMetas.forEach((el) => {
      try {
        el.remove();
      } catch (_) {}
    });

    const newMeta = document.createElement('meta');
    newMeta.name = 'theme-color';
    newMeta.content = hexColor;
    document.head.appendChild(newMeta);

    // 2. iOS Safari Web App status bar style
    let metaApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!metaApple) {
      metaApple = document.createElement('meta');
      metaApple.name = 'apple-mobile-web-app-status-bar-style';
      document.head.appendChild(metaApple);
    }
    metaApple.setAttribute('content', darkIcons ? 'default' : 'black-translucent');

    // 3. CSS root variables
    document.documentElement.style.setProperty('--app-status-bar-color', hexColor);
    document.documentElement.style.setProperty('--app-status-bar-icon-theme', darkIcons ? 'dark' : 'light');

    // 4. Flutter Native Wrapper (window.Flutter) - Send both JSON and string command formats
    if (typeof window !== 'undefined' && window.Flutter && typeof window.Flutter.postMessage === 'function') {
      try {
        window.Flutter.postMessage(JSON.stringify({
          type: 'set_status_bar',
          action: 'set_status_bar',
          color: hexColor,
          darkIcons: darkIcons,
          statusBarColor: hexColor,
          isDark: darkIcons,
        }));
      } catch (_) {}

      try {
        window.Flutter.postMessage(`set_status_bar:${hexColor}`);
      } catch (_) {}

      try {
        window.Flutter.postMessage(`set_status_bar:${hexColor}:${darkIcons ? 'dark' : 'light'}`);
      } catch (_) {}
    }

    // 5. Flutter InAppWebView (window.flutter_inappwebview)
    if (typeof window !== 'undefined' && window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler === 'function') {
      try {
        window.flutter_inappwebview.callHandler('setStatusBarColor', hexColor, darkIcons);
        window.flutter_inappwebview.callHandler('set_status_bar', { color: hexColor, darkIcons });
      } catch (_) {}
    }

    // 6. Native Android Webview bridges (window.Android, window.AppZeto)
    if (typeof window !== 'undefined') {
      if (window.Android) {
        if (typeof window.Android.setStatusBarColor === 'function') {
          try { window.Android.setStatusBarColor(hexColor, darkIcons); } catch (_) {}
        }
        if (typeof window.Android.postMessage === 'function') {
          try { window.Android.postMessage(`set_status_bar:${hexColor}`); } catch (_) {}
        }
      }
      if (window.AppZeto && typeof window.AppZeto.setStatusBarColor === 'function') {
        try { window.AppZeto.setStatusBarColor(hexColor, darkIcons); } catch (_) {}
      }
    }

    // 7. Capacitor Plugins
    if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.StatusBar) {
      try {
        window.Capacitor.Plugins.StatusBar.setBackgroundColor({ color: hexColor });
      } catch (_) {}
      try {
        window.Capacitor.Plugins.StatusBar.setStyle({ style: darkIcons ? 'DARK' : 'LIGHT' });
      } catch (_) {}
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
