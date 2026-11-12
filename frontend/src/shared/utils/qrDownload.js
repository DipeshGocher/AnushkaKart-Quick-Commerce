/**
 * Save an on-screen <svg> QR code as a PNG image, so a customer can pay with the
 * QR from their own phone (open the gallery image in their UPI app) without
 * needing a second device to scan it.
 */

/**
 * Turns the serialized markup of a rendered QR <svg> into a standalone, fixed-size
 * SVG string (adds the namespace and a pixel size so it renders when loaded as an image).
 * Pure string work so it can be unit tested.
 */
export function buildStandaloneSvg(svgMarkup, size = 1024) {
  let svg = String(svgMarkup || "").trim();
  if (!/^<svg[\s>]/i.test(svg)) throw new Error("Not an SVG element");

  const openTagEnd = svg.indexOf(">");
  let openTag = svg.slice(0, openTagEnd);
  const rest = svg.slice(openTagEnd);

  openTag = openTag.replace(/\s(width|height)=("[^"]*"|'[^']*')/gi, "");
  if (!/\sxmlns=/i.test(openTag)) {
    openTag += ' xmlns="http://www.w3.org/2000/svg"';
  }
  openTag += ` width="${size}" height="${size}"`;
  svg = openTag + rest;
  return svg;
}

function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function svgToPngBlob(svgEl, { size, padding }) {
  const markup = buildStandaloneSvg(new XMLSerializer().serializeToString(svgEl), size);
  const svgUrl = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const total = size + padding * 2;
        canvas.width = total;
        canvas.height = total;
        const ctx = canvas.getContext("2d");
        // Solid white background + quiet zone: UPI apps cannot read a transparent QR.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, total, total);
        ctx.drawImage(img, padding, padding, size, size);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Could not create image"))),
          "image/png",
        );
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error("Could not render QR"));
    };
    img.src = svgUrl;
  });
}

/**
 * @param {SVGElement} svgEl the rendered QR <svg>
 * @param {string} filename e.g. "pay-qr.png"
 * @returns {Promise<"downloaded"|"shared">}
 */
export async function downloadQrAsPng(svgEl, filename = "payment-qr.png", { size = 1024, padding = 64 } = {}) {
  if (!svgEl) throw new Error("QR is not ready yet");
  const blob = await svgToPngBlob(svgEl, { size, padding });

  // iPhones cannot save a file straight to Photos from a download link; the share sheet can.
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent || "");
  if (isIos && typeof File !== "undefined" && navigator.canShare && navigator.share) {
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return "shared";
    }
  }

  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "downloaded";
}
