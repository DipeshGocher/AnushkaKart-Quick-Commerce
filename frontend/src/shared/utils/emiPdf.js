/**
 * EMI quotation -> PDF, drawn the way the shop's own EMI sheet looks (compact, Hindi labels).
 * The page is rendered as an image and placed on A4 pages, which keeps Hindi text correct
 * without embedding fonts. Long schedules continue on a second page.
 */

export const emiMoney = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");

export function emiDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

/** Pure: returns the HTML of the quotation page. Everything the customer typed is escaped. */
export function buildEmiPdfHtml({ quote, print }) {
  const r = quote.result;
  const shop = print?.shop || {};
  const terms = Array.isArray(print?.terms) ? print.terms : [];
  const product = `${quote.product.name}${quote.product.variantName ? ` (${quote.product.variantName})` : ""}`;
  const lateFee = Number(print?.lateFee) > 0 ? `विलंब शुल्क (देय तारीख के बाद): ${emiMoney(print.lateFee)}` : "";

  const row = (label, value) =>
    `<div class="cell"><b>${esc(label)}</b> ${esc(value)}</div>`;

  const scheduleRows = r.schedule
    .map(
      (s) =>
        `<tr><td>${s.no}</td><td>${esc(emiDate(s.dueDate))}</td><td>${esc(emiMoney(s.amount))}</td><td></td></tr>`,
    )
    .join("");

  return `
<style>
  .emi-paper{width:794px;box-sizing:border-box;padding:28px 30px;background:#fff;color:#30343b;font-family:Arial,"Noto Sans Devanagari","Nirmala UI",sans-serif;font-size:13px;line-height:1.35}
  .emi-paper .head{text-align:center;border-bottom:1px solid #d8dce2;padding-bottom:8px;margin-bottom:8px}
  .emi-paper .shop{font-size:24px;font-weight:800;color:#293342}
  .emi-paper .meta{font-size:12px;color:#555e6b;margin-top:3px}
  .emi-paper h2{background:#f7e8f0;color:#8a365e;font-size:14px;padding:6px 8px;margin:10px 0 4px}
  .emi-paper .grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #d5d8de;border-left:1px solid #d5d8de}
  .emi-paper .cell{border-right:1px solid #d5d8de;border-bottom:1px solid #d5d8de;padding:6px 8px;overflow-wrap:anywhere}
  .emi-paper .cell.full{grid-column:1/-1}
  .emi-paper .cell b{display:inline-block;min-width:130px;color:#3e3e48}
  .emi-paper table{border-collapse:collapse;width:100%;font-size:12.5px}
  .emi-paper th{background:#f7e8f0;color:#6d2949;font-weight:800}
  .emi-paper th,.emi-paper td{border:1px solid #d5d8de;padding:6px 8px;text-align:left}
  .emi-paper ol{margin:6px 0;padding-left:20px;font-size:11.5px;color:#363a42}
  .emi-paper li{margin:3px 0}
  .emi-paper .signs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:38px;font-size:12px}
  .emi-paper .sign{border-top:1px solid #777;padding-top:6px;text-align:center}
  .emi-paper .foot{font-size:11px;text-align:center;color:#555;margin-top:12px;padding-top:6px;border-top:1px solid #ddd}
</style>
<div class="emi-paper">
  <div class="head">
    <div class="shop">${esc(shop.name || "Anushka Mobile Gallery")}</div>
    <div class="meta">${esc(shop.address || "")}${shop.address && shop.phone ? "<br>" : ""}${shop.phone ? "मोबाइल: " + esc(shop.phone) : ""}</div>
  </div>
  <h2 style="text-align:center">EMI विवरण / EMI स्ट्रक्चर</h2>
  <div class="grid">
    ${row("कोटेशन नंबर", quote.quoteId)}
    ${row("दिनांक", emiDate(r.financeDate))}
    ${row("कस्टमर नाम", quote.customer.name)}
    ${row("कस्टमर मोबाइल", quote.customer.phone)}
    <div class="cell full"><b>मोबाइल / मॉडल</b> ${esc(product)}</div>
    ${row("IMEI 1", quote.imei1 || "—")}
    ${row("IMEI 2", quote.imei2 || "—")}
  </div>
  <h2>फाइनेंस का हिसाब</h2>
  <div class="grid">
    ${row("मोबाइल की कीमत", emiMoney(r.price))}
    ${row("डाउन पेमेंट", emiMoney(r.downPayment))}
    ${row("फाइनेंस रकम", emiMoney(r.financeAmount))}
    ${row("ब्याज का प्रकार", r.interestType === "reducing" ? "रिड्यूसिंग" : "फ्लैट")}
    ${row("फाइल चार्ज", emiMoney(r.fileCharge))}
    ${row("ब्याज (बाकी)", emiMoney(r.remainingInterest))}
    ${row("कुल देय रकम", emiMoney(r.totalPayable))}
    ${row("EMI अवधि", r.months + " महीने")}
    ${row(r.emiVaries ? "पहली EMI" : "मासिक EMI", emiMoney(r.monthlyEmi))}
    ${row("पहली EMI तारीख", emiDate(r.firstEmiDate))}
  </div>
  <h2>EMI विवरण — किस्तों का स्ट्रक्चर</h2>
  <table>
    <thead><tr><th>किस्त नं.</th><th>देय तारीख</th><th>राशि</th><th>EMI जमा दिनांक / हस्ताक्षर</th></tr></thead>
    <tbody>${scheduleRows}</tbody>
    <tfoot><tr><th colspan="2">कुल देय EMI राशि</th><th colspan="2">${esc(emiMoney(r.totalPayable))}</th></tr></tfoot>
  </table>
  <h2>नियम एवं शर्तें</h2>
  <ol>${terms.map((t) => `<li>${esc(t)}</li>`).join("")}${lateFee ? `<li>${esc(lateFee)}</li>` : ""}</ol>
  <div class="signs">
    <div class="sign">ग्राहक के हस्ताक्षर<br>Customer Signature</div>
    <div class="sign">गारंटर के हस्ताक्षर<br>Guarantor Signature</div>
    <div class="sign">दुकान के हस्ताक्षर<br>Shop Signature</div>
  </div>
  <div class="foot">कृपया सभी विवरण जाँचकर हस्ताक्षर करें। यह अनुमानित EMI कोटेशन है; अंतिम फाइनेंस दुकान की मंजूरी के बाद ही मान्य होगा।</div>
</div>`;
}

/**
 * Decides where each PDF page ends. `candidates` are the heights (px) just before a row or heading,
 * which are the only places a page may be cut. Every page except the last is filled as far as
 * possible; a page is only cut at an arbitrary height when no row boundary exists in the last 60%.
 * Returns [0, ..., totalPx].
 */
export function choosePageBreaks(candidates, totalPx, pagePx) {
  const sorted = [...new Set(candidates.map(Number).filter((y) => Number.isFinite(y)))]
    .filter((y) => y > 0 && y < totalPx)
    .sort((a, b) => a - b);
  const breaks = [0];
  let start = 0;
  while (totalPx - start > pagePx) {
    const limit = start + pagePx;
    let best = null;
    for (const c of sorted) {
      if (c > start + pagePx * 0.4 && c <= limit) best = c;
    }
    const next = best ?? limit;
    breaks.push(next);
    start = next;
  }
  breaks.push(totalPx);
  return breaks;
}

/** Browser only. Builds the page off-screen, rasterises it and saves an A4 PDF (multi-page if long). */
export async function downloadEmiPdf({ quote, print }) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  // The page is drawn inside its own blank iframe. html2canvas reads every colour of the document it
  // renders, and the app's own stylesheet uses modern colour functions (oklch) it cannot parse,
  // which made the PDF fail. A clean document has only the plain colours defined above.
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1200px;border:0;pointer-events:none";
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fff">${buildEmiPdfHtml({ quote, print })}</body></html>`;
  const loaded = new Promise((resolve, reject) => {
    frame.onload = resolve;
    frame.onerror = () => reject(new Error("Could not prepare the PDF page"));
  });
  document.body.appendChild(frame);

  try {
    await loaded;
    const doc = frame.contentDocument;
    if (doc.fonts?.ready) await doc.fonts.ready;
    const paper = doc.querySelector(".emi-paper");
    frame.style.height = paper.scrollHeight + "px";
    const canvas = await html2canvas(paper, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: 794 });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const pageW = 210;
    const pageH = 297;
    const margin = 6;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;
    const pxPerMm = canvas.width / usableW;
    const slicePx = Math.floor(usableH * pxPerMm);

    // Where a page may end without cutting a row / heading in half: just before each of these.
    const scale = canvas.height / paper.scrollHeight;
    const paperTop = paper.getBoundingClientRect().top;
    const candidates = [...paper.querySelectorAll("h2, tbody tr:not(:first-child), li, .signs, .foot")].map(
      (el) => (el.getBoundingClientRect().top - paperTop) * scale,
    );
    const breaks = choosePageBreaks(candidates, canvas.height, slicePx);

    for (let i = 0; i < breaks.length - 1; i += 1) {
      const y = Math.round(breaks[i]);
      const h = Math.round(breaks[i + 1]) - y;
      if (h <= 0) continue;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = h;
      slice.getContext("2d").drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (i > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 0.94), "JPEG", margin, margin, usableW, h / pxPerMm, undefined, "FAST");
    }

    const safe = String(quote.customer.name || "Customer").replace(/[^a-zA-Z0-9_-]/g, "_");
    pdf.save(`EMI_${quote.quoteId}_${safe}.pdf`);
  } finally {
    document.body.removeChild(frame);
  }
}
