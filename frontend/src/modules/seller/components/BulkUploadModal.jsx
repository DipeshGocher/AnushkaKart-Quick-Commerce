import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { sellerApi } from "../services/sellerApi";
import { buildReportCsv, productMessages, productStatusText } from "@shared/utils/bulkReport";

const STATUS_STYLE = {
  ready: "bg-emerald-100 text-emerald-700",
  draft: "bg-amber-100 text-amber-800",
  error: "bg-rose-100 text-rose-700",
};

async function errorText(error, fallback) {
  const data = error?.response?.data;
  try {
    if (data instanceof Blob) return JSON.parse(await data.text()).message || fallback;
  } catch {
    /* not json */
  }
  return data?.message || error?.message || fallback;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Bulk upload: 1) download the Excel template  2) choose the filled file and check it
 * 3) save. Rows with errors are skipped, everything else is saved.
 */
export default function BulkUploadModal({ isOpen, onClose, onSaved }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(""); // "template" | "check" | "save"
  const [plan, setPlan] = useState(null); // { summary, products }
  const [saved, setSaved] = useState(false);
  const [fileError, setFileError] = useState("");

  if (!isOpen) return null;

  const reset = () => {
    setFile(null);
    setPlan(null);
    setSaved(false);
    setFileError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => {
    if (busy === "save") return; // do not close while saving
    const didSave = saved;
    reset();
    onClose();
    if (didSave && onSaved) onSaved();
  };

  const getTemplate = async () => {
    setBusy("template");
    try {
      const res = await sellerApi.downloadProductTemplate();
      downloadBlob(res.data, "product-upload-template.xlsx");
    } catch (e) {
      toast.error(await errorText(e, "Could not download the template."));
    } finally {
      setBusy("");
    }
  };

  const check = async (picked) => {
    setFile(picked);
    setPlan(null);
    setSaved(false);
    setFileError("");
    if (!picked) return;
    setBusy("check");
    try {
      const res = await sellerApi.bulkPreviewProducts(picked);
      setPlan(res.data.result);
    } catch (e) {
      setFileError(await errorText(e, "Could not check the file."));
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    if (!file) return;
    setBusy("save");
    try {
      const res = await sellerApi.bulkCommitProducts(file);
      setPlan(res.data.result);
      setSaved(true);
      const s = res.data.result.summary;
      toast.success(`${s.created + s.drafts} product(s) saved${s.drafts ? `, ${s.drafts} as draft` : ""}.`);
    } catch (e) {
      toast.error(await errorText(e, "Could not save the file."));
    } finally {
      setBusy("");
    }
  };

  const downloadReport = () => {
    const csv = buildReportCsv(plan.products);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "bulk-upload-report.csv");
  };

  const s = plan?.summary;
  const savable = s ? s.ready + s.draft : 0;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-6" data-testid="bulk-upload-modal">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={close} />
      <div className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-black text-slate-900">Bulk Upload Products</h3>
            <p className="text-xs font-medium text-slate-500">Add many products at once from an Excel file.</p>
          </div>
          <button type="button" onClick={close} disabled={busy === "save"} className="rounded-full p-2 text-xl leading-none text-slate-500 hover:bg-slate-100 disabled:opacity-40" aria-label="Close">×</button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {/* step 1 + 2 */}
          {!saved && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Step 1</p>
                <h4 className="mt-1 text-sm font-bold text-slate-900">Download the Excel template</h4>
                <p className="mt-1 text-xs text-slate-500">It has instructions and example rows. Only Product Name, Category, Price and Stock are a must. Photos and parcel size can be added later.</p>
                <button type="button" onClick={getTemplate} disabled={busy === "template"} data-testid="bulk-download-template" className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-800 disabled:opacity-60">
                  {busy === "template" ? "Preparing..." : "Download template"}
                </button>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Step 2</p>
                <h4 className="mt-1 text-sm font-bold text-slate-900">Choose your filled file</h4>
                <p className="mt-1 text-xs text-slate-500">.xlsx file, up to 300 rows. We check it first. Nothing is saved yet.</p>
                <label className="mt-3 inline-flex cursor-pointer items-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-slate-500">
                  {file ? file.name : "Choose Excel file"}
                  <input ref={fileRef} type="file" accept=".xlsx" data-testid="bulk-file-input" className="hidden" onChange={(e) => check(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
          )}

          {busy === "check" && <p className="text-sm font-bold text-slate-600" data-testid="bulk-checking">Checking your file...</p>}
          {fileError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700" data-testid="bulk-file-error">{fileError}</div>
          )}

          {/* summary */}
          {s && (
            <div className="flex flex-wrap gap-2" data-testid="bulk-summary">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{s.products} products ({s.rows} rows)</span>
              {saved ? (
                <>
                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">{s.created} saved and live</span>
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">{s.drafts} saved as draft</span>
                  <span className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700">{s.failed} not saved</span>
                </>
              ) : (
                <>
                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">{s.ready} ready</span>
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">{s.draft} will be draft</span>
                  <span className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700">{s.failed} need fixing</span>
                </>
              )}
            </div>
          )}

          {/* products table */}
          {plan && (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[760px] text-left text-sm" data-testid="bulk-table">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Excel rows</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Stock</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {plan.products.map((p) => {
                    const state = p.result ? (p.result.status === "created" ? "ready" : p.result.status === "created_draft" ? "draft" : "error") : p.status;
                    const msgs = productMessages(p);
                    return (
                      <tr key={p.key} data-testid={`bulk-row-${p.name}`} data-status={state} className="align-top">
                        <td className="px-3 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{p.rows.length > 1 ? `${p.rows[0]}-${p.rows[p.rows.length - 1]}` : p.rows[0]}</td>
                        <td className="px-3 py-3">
                          <p className="font-bold text-slate-900">{p.name}</p>
                          {p.hasOptions && <p className="text-xs font-medium text-slate-500">{p.variantCount} combination{p.variantCount > 1 ? "s" : ""}</p>}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">{p.category || "-"}</td>
                        <td className="px-3 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{p.price != null ? `₹${p.price}${p.hasOptions ? " +" : ""}` : "-"}</td>
                        <td className="px-3 py-3 text-xs font-semibold text-slate-700">{p.stock}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[state]}`}>{productStatusText(p)}</span>
                          {msgs.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {msgs.map((m, i) => (
                                <li key={i} className={`text-[11px] font-medium ${m.type === "error" ? "text-rose-600" : "text-slate-500"}`}>
                                  {m.row ? `Row ${m.row}: ` : ""}{m.text}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {plan && !saved && s.draft > 0 && (
            <p className="rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              Draft products are hidden from customers. Open them in your product list, add the photo / parcel size and set them to Active.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
          {plan && (
            <button type="button" onClick={downloadReport} className="mr-auto text-xs font-bold text-slate-500 underline" data-testid="bulk-report">
              Download report (CSV)
            </button>
          )}
          {saved ? (
            <>
              <button type="button" onClick={reset} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100">Upload another file</button>
              <button type="button" onClick={close} data-testid="bulk-done" className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white">Done</button>
            </>
          ) : (
            <>
              <button type="button" onClick={close} disabled={busy === "save"} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button
                type="button"
                onClick={save}
                disabled={!plan || savable === 0 || busy === "save"}
                data-testid="bulk-save"
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "save" ? "Saving... (photos are being downloaded)" : savable ? `Save ${savable} product${savable > 1 ? "s" : ""}` : "Save"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
