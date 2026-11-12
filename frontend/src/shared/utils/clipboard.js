/**
 * Copy text to the clipboard. Resolves to true if it worked, false if the browser refused.
 * Uses the modern API first and falls back to a hidden textarea for older / stricter browsers.
 * Call it BEFORE opening another tab: a page that is not focused cannot write to the clipboard.
 */
export async function copyText(text) {
  const value = String(text ?? "");
  if (!value) return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to the textarea method */
  }

  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return Boolean(ok);
  } catch {
    return false;
  }
}
