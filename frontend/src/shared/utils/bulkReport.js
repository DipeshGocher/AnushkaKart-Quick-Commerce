/**
 * Bulk upload: small helpers for the screen and the downloadable report (CSV that opens in Excel).
 */

/** Text that starts like an Excel formula gets a leading ' so Excel keeps it as text. */
export const safeCell = (v) => {
  const t = v == null ? "" : String(v);
  return /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
};

const csvCell = (v) => `"${safeCell(v).replace(/"/g, '""')}"`;

/** One line of text for what happened to a product (after saving) or what was found (preview). */
export function productStatusText(p) {
  const r = p.result;
  if (r) {
    if (r.status === "created") return "Saved and live";
    if (r.status === "created_draft") return `Saved as draft (${(r.draftReasons || p.draftReasons || []).map(draftReasonLabel).join(", ")})`;
    if (r.status === "failed") return "Not saved";
    return "Skipped (needs fixing)";
  }
  if (p.status === "ready") return "Ready";
  if (p.status === "draft") return `Will be a draft (${(p.draftReasons || []).map(draftReasonLabel).join(", ")})`;
  return "Needs fixing";
}

export const draftReasonLabel = (r) => (r === "photo" ? "photo needed" : r === "parcel" ? "parcel size needed" : String(r));

/** Every message of a product: errors, then the save message, then warnings. */
export function productMessages(p) {
  const out = [];
  for (const e of p.errors || []) out.push({ type: "error", row: e.row, text: e.message });
  if (p.result?.status === "failed" && p.result.message) out.push({ type: "error", row: null, text: p.result.message });
  for (const w of p.warnings || []) out.push({ type: "warning", row: w.row, text: w.message });
  for (const w of p.result?.warnings || []) out.push({ type: "warning", row: w.row, text: w.message });
  return out;
}

/** CSV (with BOM for Excel) of everything that needs the seller's attention. */
export function buildReportCsv(products = [], { onlyAttention = true } = {}) {
  const lines = [["Product", "Excel rows", "Result", "Message"]];
  for (const p of products) {
    const msgs = productMessages(p);
    const needsAttention = p.status === "error" || p.result?.status === "failed" || p.result?.status === "created_draft" || msgs.length > 0 || p.status === "draft";
    if (onlyAttention && !needsAttention) continue;
    const rows = (p.rows || []).join(", ");
    const status = productStatusText(p);
    if (msgs.length === 0) lines.push([p.name, rows, status, ""]);
    msgs.forEach((m, i) => lines.push([i === 0 ? p.name : "", i === 0 ? rows : "", i === 0 ? status : "", `${m.type === "error" ? "FIX: " : "Note: "}${m.row ? `Row ${m.row}: ` : ""}${m.text}`]));
  }
  return `\uFEFF${lines.map((l) => l.map(csvCell).join(",")).join("\r\n")}`;
}
