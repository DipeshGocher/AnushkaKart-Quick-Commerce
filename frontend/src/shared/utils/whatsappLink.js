/**
 * Opens a WhatsApp chat with a ready-made message, the right way for each device.
 *
 *  - Phone / tablet : https://wa.me/<number>?text=...   -> the phone hands it straight to the WhatsApp app (same tab).
 *  - Computer       : https://web.whatsapp.com/send?phone=..&text=..  -> WhatsApp Web, straight on that chat (new tab).
 *                     Almost every computer user has WhatsApp Web; it never asks to install anything.
 *                     Computers that have the WhatsApp Desktop app can use `links.app` (whatsapp://send...) instead.
 *                     (wa.me on a computer only shows an "Open app / Download" page, which is what we avoid.)
 *
 * The link is opened with an ordinary anchor click, never an empty pre-opened tab, so there is no blank page.
 * The screen also shows the other links as real buttons, because a click is never blocked.
 */

/** Pulls the number and message back out of a wa.me link made by the server. */
export function parseWhatsappUrl(url) {
  const u = new URL(String(url));
  // wa.me/<number> keeps the number in the path; api.whatsapp.com/send?phone=<number> keeps it in the query.
  const first = u.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p))[0] || "";
  const raw = first && first !== "send" ? first : u.searchParams.get("phone") || "";
  return { phone: raw.replace(/\D/g, ""), text: u.searchParams.get("text") || "" };
}

export function buildWhatsappLinks(url) {
  const { phone, text } = parseWhatsappUrl(url);
  const q = encodeURIComponent(text);
  return {
    phone,
    text,
    /** Universal link: opens the app on a phone, a web landing page on a computer. */
    web: `https://wa.me/${phone}?text=${q}`,
    /** App protocol: opens WhatsApp Desktop (or the phone app) on the chat. */
    app: `whatsapp://send?phone=${phone}&text=${q}`,
    /**
     * WhatsApp Web in the browser. This is the exact form WhatsApp itself redirects wa.me links to
     * (the trailing slash and the two extra flags), which WhatsApp Web reads most reliably, including
     * when WhatsApp Web is installed as a Chrome / Edge app.
     */
    webClient: `https://web.whatsapp.com/send/?phone=${phone}&text=${q}&type=phone_number&app_absent=0`,
  };
}

/** Phone or tablet? (iPads pretend to be Macs, so touch points are checked too.) */
export function isMobileDevice(nav) {
  const n = nav || (typeof navigator !== "undefined" ? navigator : {});
  const ua = String(n.userAgent || "");
  if (n.userAgentData && typeof n.userAgentData.mobile === "boolean" && n.userAgentData.mobile) return true;
  if (/Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && Number(n.maxTouchPoints) > 1;
}

function followLink(href, newTab = false) {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  if (newTab) a.target = "_blank";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Starts the chat. Call it inside the click handler (or soon after) so the browser allows it.
 * @returns {{ links: ReturnType<typeof buildWhatsappLinks>, mobile: boolean }}
 */
export function openWhatsappChat(url, nav) {
  const links = buildWhatsappLinks(url);
  const mobile = isMobileDevice(nav);
  if (mobile) followLink(links.web);
  else followLink(links.webClient, true);
  return { links, mobile };
}
