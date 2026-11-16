import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  MAX_OPTIONS,
  applyAxesChange,
  cartesian,
  imageGroups,
  imageAxisOf,
  syncVariants,
} from "@/shared/utils/variantMatrix";

const MAX_COMBINATIONS = 150;
const MAX_VALUES = 30;
const MAX_PHOTOS = 5;

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10";
const labelCls = "ml-1 text-[9px] font-bold uppercase tracking-widest text-slate-400";

const clean = (v) => String(v == null ? "" : v).trim().replace(/\s+/g, " ");
const keyOf = (v) => clean(v).toLowerCase();
const isColorName = (n) => /^colou?rs?$/i.test(clean(n));

/** One-tap option names and ready-made values, so the seller types as little as possible. */
const OPTION_BUTTONS = ["Size", "Color", "Storage", "RAM"];
const PRESETS = {
  size: {
    sets: [
      { label: "S – XXL", values: ["S", "M", "L", "XL", "XXL"] },
      { label: "Shoes 6 – 10", values: ["6", "7", "8", "9", "10"] },
      { label: "Waist 28 – 36", values: ["28", "30", "32", "34", "36"] },
    ],
    singles: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Free Size"],
  },
  color: {
    singles: ["Black", "White", "Red", "Blue", "Green", "Yellow", "Pink", "Grey", "Brown", "Purple", "Orange", "Navy"],
  },
  storage: { singles: ["32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"] },
  ram: { singles: ["2 GB", "3 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB"] },
  material: { singles: ["Cotton", "Polyester", "Leather", "Plastic", "Steel", "Wood"] },
};
const presetFor = (name) => PRESETS[keyOf(name)] || null;

/** Axes that really make combinations (named and with at least one value). */
const activeOf = (axes) => (axes || []).filter((a) => clean(a.name) && (a.values || []).length);

const swatch = (value) => {
  const v = keyOf(value);
  if (!/^[a-z]+$/.test(v)) return null;
  return v === "grey" ? "gray" : v;
};

/**
 * Size / Color style variants for the seller and admin product forms - one simple screen:
 *  1. tap the options (Size, Color...) and add their values   -> combinations appear straight away
 *  2. set price / sale price / stock for all rows at once, then change only the odd ones
 *  3. photos once per colour
 *
 * Controlled: `axes` + `variants` come from the form, onChange({ variantOptions, variants }).
 * groupFiles / setGroupFiles hold the NEW photos per colour: { [colourValue]: File[] }.
 */
export default function VariantMatrixEditor({
  axes,
  variants,
  onChange,
  groupFiles,
  setGroupFiles,
  onSwitchToSimple,
}) {
  const committed = useMemo(() => axes || [], [axes]);
  const [valueText, setValueText] = useState({});
  const [nameText, setNameText] = useState({});
  const [fill, setFill] = useState({ price: "", salePrice: "", stock: "" });
  const [showSku, setShowSku] = useState(false);

  const active = useMemo(() => activeOf(committed), [committed]);
  const live = active.length > 0 && variants.length > 0 && variants.every((v) => v.options);
  const imageAxis = live ? imageAxisOf(active) : null;
  const groups = useMemo(() => (live ? imageGroups(active, variants) : []), [live, active, variants]);
  const missingCount = useMemo(() => {
    if (!live) return 0;
    const have = new Set(variants.map((v) => active.map((a) => keyOf(v.options?.[a.name])).join("|")));
    return cartesian(active).filter((o) => !have.has(active.map((a) => keyOf(o[a.name])).join("|"))).length;
  }, [live, active, variants]);

  // ---------------------------------------------------------------- options -> combinations (live)
  /** Store the new options and rebuild the combinations (kept rows keep their price / stock / photos). */
  const apply = (next) => {
    const oldA = activeOf(committed);
    const newA = activeOf(next);
    let rows = variants;
    if (!newA.length) {
      if (oldA.length) {
        const tpl = variants.find((r) => r.options) || variants[0] || {};
        rows = [{ name: "Default", price: tpl.price ?? "", salePrice: tpl.salePrice ?? "", stock: tpl.stock ?? 0, sku: "", images: [] }];
      }
    } else {
      rows = applyAxesChange(oldA, newA, variants);
    }
    onChange({ variantOptions: next, variants: rows });
  };

  const totalFor = (list) => activeOf(list).reduce((n, a) => n * a.values.length, 1);

  const addAxis = (name) => {
    if (committed.length >= MAX_OPTIONS) return toast.error(`At most ${MAX_OPTIONS} options are allowed.`);
    const photos = isColorName(name) && !committed.some((a) => a.hasImages);
    apply([...committed, { name, values: [], hasImages: photos }]);
  };

  const removeAxis = (i) => {
    let next = committed.filter((_, idx) => idx !== i);
    if (!next.some((a) => a.hasImages)) {
      const c = next.findIndex((a) => isColorName(a.name));
      if (c >= 0) next = next.map((a, idx) => ({ ...a, hasImages: idx === c }));
    }
    setValueText({});
    setNameText({});
    apply(next);
  };

  const addValues = (i, input) => {
    const parts = (Array.isArray(input) ? input : String(input || "").split(/[,\n]/)).map(clean).filter(Boolean);
    setValueText((t) => ({ ...t, [i]: "" }));
    if (!parts.length) return;
    const a = committed[i];
    const seen = new Set(a.values.map(keyOf));
    const values = [...a.values];
    for (const p of parts) if (!seen.has(keyOf(p))) { seen.add(keyOf(p)); values.push(p); }
    if (values.length === a.values.length) return;
    if (values.length > MAX_VALUES) return toast.error(`At most ${MAX_VALUES} values per option.`);
    const next = committed.map((x, idx) => (idx === i ? { ...x, values } : x));
    if (clean(a.name) && totalFor(next) > MAX_COMBINATIONS) {
      return toast.error(`That makes ${totalFor(next)} combinations. Keep it under ${MAX_COMBINATIONS}.`);
    }
    apply(next);
  };

  const removeValue = (i, value) =>
    apply(committed.map((a, idx) => (idx === i ? { ...a, values: a.values.filter((x) => x !== value) } : a)));

  const commitName = (i) => {
    const typed = nameText[i];
    if (typed === undefined) return;
    setNameText((t) => { const c = { ...t }; delete c[i]; return c; });
    const a = committed[i];
    const name = clean(typed);
    if (name === a.name) return;
    if (name && /[.$]/.test(name)) return toast.error(`Option name "${name}" cannot contain "." or "$".`);
    if (name && committed.some((x, idx) => idx !== i && keyOf(x.name) === keyOf(name))) return toast.error(`Option "${name}" is added twice.`);
    const next = committed.map((x, idx) => (idx === i ? { ...x, name } : x));
    if (clean(a.name) && name && a.values.length) {
      // plain rename: keep every row, only the option key changes
      const rows = variants.map((v) => {
        if (!v.options || !(a.name in v.options)) return v;
        const options = {};
        for (const [k, val] of Object.entries(v.options)) options[k === a.name ? name : k] = val;
        return { ...v, options };
      });
      onChange({ variantOptions: next, variants: rows });
    } else {
      apply(next);
    }
  };

  const setPhotoAxis = (name) =>
    onChange({ variantOptions: committed.map((a) => ({ ...a, hasImages: Boolean(name) && a.name === name })), variants });

  // ---------------------------------------------------------------- rows
  const patchRow = (i, patch) => onChange({ variantOptions: committed, variants: variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) });
  const removeRow = (i) => onChange({ variantOptions: committed, variants: variants.filter((_, idx) => idx !== i) });
  const addMissing = () => onChange({ variantOptions: committed, variants: syncVariants(active, variants, { addMissing: true }) });

  const applyToAll = () => {
    const patch = {};
    if (fill.price !== "") patch.price = fill.price;
    if (fill.salePrice !== "") patch.salePrice = fill.salePrice;
    if (fill.stock !== "") patch.stock = fill.stock;
    if (!Object.keys(patch).length) return toast.error("Type a price, sale price or stock first.");
    if (patch.price !== undefined && patch.salePrice !== undefined && Number(patch.salePrice) > Number(patch.price)) {
      return toast.error("Sale price cannot be more than the price.");
    }
    onChange({ variantOptions: committed, variants: variants.map((v) => ({ ...v, ...patch })) });
    toast.success(`Applied to all ${variants.length} rows. Change only the ones that are different.`);
  };

  // ---------------------------------------------------------------- photos (per colour)
  const groupUrls = (g) => (variants[g.indexes[0]]?.images || []).filter((u) => typeof u === "string");
  const removeSavedPhoto = (g, url) => {
    const idxs = new Set(g.indexes);
    onChange({
      variantOptions: committed,
      variants: variants.map((v, i) => (idxs.has(i) ? { ...v, images: (v.images || []).filter((u) => u !== url) } : v)),
    });
  };
  const addPhotos = (g, fileList) => {
    const current = groupFiles[g.value] || [];
    const room = MAX_PHOTOS - groupUrls(g).length - current.length;
    const picked = Array.from(fileList || []).slice(0, Math.max(0, room));
    if (!picked.length) return toast.error(`Maximum ${MAX_PHOTOS} photos per ${imageAxis?.name || "colour"}.`);
    setGroupFiles({ ...groupFiles, [g.value]: [...current, ...picked] });
  };
  const removeNewPhoto = (g, n) =>
    setGroupFiles({ ...groupFiles, [g.value]: (groupFiles[g.value] || []).filter((_, i) => i !== n) });

  const unusedButtons = OPTION_BUTTONS.filter((n) => !committed.some((a) => keyOf(a.name) === keyOf(n)));
  const namedAxes = committed.filter((a) => clean(a.name));

  // ================================================================ render
  return (
    <div className="space-y-6" data-testid="variant-matrix-editor">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Product Options</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Tap what changes (Size, Color...), add the values, then fill price and stock. Combinations appear by themselves.
          </p>
        </div>
        {onSwitchToSimple && (
          <button type="button" onClick={onSwitchToSimple} className="shrink-0 text-[11px] font-bold text-slate-500 underline">
            Use simple variants instead
          </button>
        )}
      </div>

      {/* ------------------------------------------------ 1. options and values */}
      <div className="space-y-3" data-testid="vm-setup">
        {committed.map((a, i) => {
          const preset = presetFor(a.name);
          const have = new Set(a.values.map(keyOf));
          const singles = (preset?.singles || []).filter((s) => !have.has(keyOf(s)));
          const sets = (preset?.sets || []).filter((s) => s.values.some((v) => !have.has(keyOf(v))));
          return (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2.5" data-testid={`vm-option-${i}`}>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label className={labelCls}>Option name</label>
                  <input
                    list="vm-option-names"
                    value={nameText[i] ?? a.name}
                    onChange={(e) => setNameText((t) => ({ ...t, [i]: e.target.value }))}
                    onBlur={() => commitName(i)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
                    placeholder="Size, Color, Storage..."
                    data-testid={`vm-option-name-${i}`}
                    className={inputCls}
                  />
                </div>
                <button type="button" onClick={() => removeAxis(i)} data-testid={`vm-option-remove-${i}`} className="rounded-xl px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50">
                  Remove
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
                {a.values.map((value) => (
                  <span key={value} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    {isColorName(a.name) && swatch(value) && <span className="h-2.5 w-2.5 rounded-full border border-slate-300" style={{ background: swatch(value) }} />}
                    {value}
                    <button type="button" onClick={() => removeValue(i, value)} className="text-slate-400 hover:text-rose-500" aria-label={`Remove ${value}`}>×</button>
                  </span>
                ))}
                <input
                  value={valueText[i] || ""}
                  onChange={(e) => setValueText((t) => ({ ...t, [i]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addValues(i, valueText[i]); }
                  }}
                  onBlur={() => addValues(i, valueText[i])}
                  placeholder={a.values.length ? "Add another" : clean(a.name) ? "Type a value and press Enter" : "Give the option a name first"}
                  data-testid={`vm-value-input-${i}`}
                  className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
                />
              </div>

              {(sets.length > 0 || singles.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5" data-testid={`vm-quick-${i}`}>
                  <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Quick add</span>
                  {sets.map((s) => (
                    <button key={s.label} type="button" onClick={() => addValues(i, s.values)} className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-700">
                      + {s.label}
                    </button>
                  ))}
                  {singles.map((s) => (
                    <button key={s} type="button" onClick={() => addValues(i, [s])} data-testid={`vm-quick-${i}-${s}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-slate-400">
                      {isColorName(a.name) && swatch(s) && <span className="h-2.5 w-2.5 rounded-full border border-slate-300" style={{ background: swatch(s) }} />}
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <datalist id="vm-option-names">
          {[...OPTION_BUTTONS, "Material"].map((n) => (<option key={n} value={n} />))}
        </datalist>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {committed.length < MAX_OPTIONS ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-bold text-slate-500">{committed.length ? "Add another option:" : "What changes in this product?"}</span>
              {unusedButtons.map((n) => (
                <button key={n} type="button" onClick={() => addAxis(n)} data-testid={`vm-add-${n}`} className="rounded-xl bg-rose-50 px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-rose-600 hover:bg-rose-100">
                  + {n}
                </button>
              ))}
              <button type="button" onClick={() => addAxis("")} data-testid="vm-add-other" className="rounded-xl bg-slate-100 px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-200">
                + Other
              </button>
            </div>
          ) : <span />}
          {namedAxes.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-500">Photos change with</label>
              <select
                value={namedAxes.find((a) => a.hasImages)?.name || ""}
                onChange={(e) => setPhotoAxis(e.target.value)}
                data-testid="vm-photo-axis"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="">Nothing (same photos)</option>
                {namedAxes.map((a) => (<option key={a.name} value={a.name}>{a.name}</option>))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ 2. price and stock */}
      {live && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-900">Price and stock ({variants.length} combination{variants.length > 1 ? "s" : ""})</h4>
            <div className="flex items-center gap-3">
              {missingCount > 0 && (
                <button type="button" onClick={addMissing} data-testid="vm-add-missing" className="text-[11px] font-bold text-primary underline">
                  Add {missingCount} missing combination{missingCount > 1 ? "s" : ""}
                </button>
              )}
              <button type="button" onClick={() => setShowSku((s) => !s)} data-testid="vm-toggle-sku" className="text-[11px] font-bold text-slate-400 underline">
                {showSku ? "Hide SKU" : "Show SKU"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3" data-testid="vm-fill">
            <p className="mb-2 text-[11px] font-bold text-slate-600">Same for all rows? Fill once, then change only the odd ones.</p>
            <div className="flex flex-wrap items-end gap-2">
              {[["price", "Price"], ["salePrice", "Sale price"], ["stock", "Stock"]].map(([k, label]) => (
                <div key={k} className="w-28 space-y-1">
                  <label className={labelCls}>{label}</label>
                  <input type="number" min="0" value={fill[k]} onChange={(e) => setFill((f) => ({ ...f, [k]: e.target.value }))} data-testid={`vm-fill-${k}`} className={inputCls} />
                </div>
              ))}
              <button type="button" onClick={applyToAll} data-testid="vm-fill-apply" className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-800">
                Apply to all
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Do not sell a combination (for example L / Red)? Remove its row with ×. Customers will not see it.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-3 py-2">Combination</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2 text-brand-500">Sale price</th>
                  <th className="px-3 py-2">Stock</th>
                  {showSku && <th className="px-3 py-2">SKU</th>}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {variants.map((v, i) => (
                  <tr key={v.id || i} data-testid={`vm-row-${v.name}`}>
                    <td className="px-3 py-2 font-bold text-slate-800 whitespace-nowrap">{v.name}</td>
                    <td className="px-2 py-1.5"><input type="number" min="0" value={v.price} onChange={(e) => patchRow(i, { price: e.target.value })} data-testid={`vm-price-${i}`} className={inputCls} /></td>
                    <td className="px-2 py-1.5"><input type="number" min="0" value={v.salePrice} onChange={(e) => patchRow(i, { salePrice: e.target.value })} data-testid={`vm-sale-${i}`} className={inputCls} /></td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        value={v.stock}
                        onChange={(e) => patchRow(i, { stock: e.target.value })}
                        data-testid={`vm-stock-${i}`}
                        className={inputCls}
                        style={Number(v.stock) === 0 && v.stock !== "" ? { backgroundColor: "#fffbeb", borderColor: "#fcd34d" } : undefined}
                      />
                    </td>
                    {showSku && <td className="px-2 py-1.5"><input value={v.sku || ""} onChange={(e) => patchRow(i, { sku: e.target.value })} placeholder="auto" data-testid={`vm-sku-${i}`} className={inputCls} /></td>}
                    <td className="px-2 py-1.5 text-right">
                      <button type="button" onClick={() => removeRow(i)} data-testid={`vm-remove-${i}`} className="rounded-xl px-3 py-2 text-lg font-bold leading-none text-rose-500 hover:bg-rose-50" aria-label={`Remove ${v.name}`} title="Remove this combination">
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {variants.some((v) => Number(v.stock) === 0) && (
            <p className="text-[11px] font-semibold text-amber-700">Rows with stock 0 are shown as sold out to customers.</p>
          )}
        </div>
      )}

      {/* ------------------------------------------------ 3. photos per colour */}
      {live && imageAxis && groups.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900">Photos for each {imageAxis.name}</h4>
          <p className="text-[11px] text-slate-500">Upload once. Every {active.filter((a) => a !== imageAxis).map((a) => a.name.toLowerCase()).join(" / ") || "row"} of that {imageAxis.name.toLowerCase()} shows these photos (up to {MAX_PHOTOS}).</p>
          {groups.map((g) => {
            const saved = groupUrls(g);
            const fresh = groupFiles[g.value] || [];
            return (
              <div key={g.value} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3" data-testid={`vm-photos-${g.value}`}>
                <p className="mb-2 text-xs font-black text-slate-800">{g.value}</p>
                <div className="flex flex-wrap gap-2">
                  {saved.map((u) => (
                    <div key={u} className="relative h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <img src={u} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => removeSavedPhoto(g, u)} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs text-white" aria-label="Remove photo">×</button>
                    </div>
                  ))}
                  {fresh.map((f, n) => (
                    <div key={n} className="relative h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => removeNewPhoto(g, n)} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs text-white" aria-label="Remove photo">×</button>
                    </div>
                  ))}
                  {saved.length + fresh.length < MAX_PHOTOS && (
                    <label className="relative flex h-16 w-16 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white text-xl text-slate-300 hover:border-primary/50">
                      +
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        data-testid={`vm-photo-input-${g.value}`}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        onChange={(e) => { addPhotos(g, e.target.files); e.target.value = ""; }}
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
