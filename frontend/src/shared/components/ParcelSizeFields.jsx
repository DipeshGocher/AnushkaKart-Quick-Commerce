import React, { useState } from "react";
import { HiOutlineScale } from "react-icons/hi2";
import { PARCEL_HINT, composeWeight, parseWeightInput } from "@/shared/utils/parcel";

const inputCls =
  "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20";
const labelCls = "text-[10px] font-bold text-slate-600 uppercase tracking-wider";

/**
 * Parcel weight (number + g/kg) and box size (cm). All four are required: the courier charges by
 * the bigger of the real weight and the box volume (L x W x H / 5000).
 * formData.weight stays one text value ("500 g"), so saving works as before.
 */
export default function ParcelSizeFields({ formData, setFormData }) {
  const initial = parseWeightInput(formData.weight);
  const [unit, setUnit] = useState(initial.unit);
  const { value } = parseWeightInput(formData.weight);
  // a half typed number like "1." must not be thrown away
  const [typed, setTyped] = useState(value);
  const shown = parseWeightInput(formData.weight).value === "" && typed === "" ? "" : typed || value;

  const setWeight = (v, u) => {
    setTyped(v);
    setFormData((prev) => ({ ...prev, weight: composeWeight(v, u) }));
  };
  const setDim = (key, v) => setFormData((prev) => ({ ...prev, [key]: v === "" ? "" : Math.max(0, Number(v)) }));

  const dims = [
    ["length", "Length (लंबाई - cm)"],
    ["breadth", "Width / Breadth (चौड़ाई - cm)"],
    ["height", "Height (ऊंचाई - cm)"],
  ];

  return (
    <div className="bg-slate-50/90 p-5 rounded-2xl border border-slate-200/90 space-y-4" data-testid="parcel-fields">
      <div>
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <HiOutlineScale className="h-4 w-4 text-primary" />
          Parcel Weight & Box Dimensions (पार्सल का वजन और साइज़) <span className="text-rose-500">*</span>
        </h4>
        <p className="text-[11px] text-slate-500 font-medium mt-0.5">💡 {PARCEL_HINT}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <div className="space-y-1.5 flex flex-col">
          <label className={labelCls}>Weight with packing (वजन) *</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              value={shown}
              onChange={(e) => setWeight(e.target.value, unit)}
              data-testid="parcel-weight"
              className={inputCls}
              placeholder={unit === "kg" ? "e.g. 1.5" : "e.g. 500"}
            />
            <select
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                setWeight(typed || value, e.target.value);
              }}
              data-testid="parcel-unit"
              className="rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold outline-none"
            >
              <option value="g">g</option>
              <option value="kg">kg</option>
            </select>
          </div>
        </div>

        {dims.map(([key, label]) => (
          <div key={key} className="space-y-1.5 flex flex-col">
            <label className={labelCls}>{label} *</label>
            <input
              type="number"
              min="1"
              step="any"
              value={formData[key] ?? ""}
              onChange={(e) => setDim(key, e.target.value)}
              data-testid={`parcel-${key}`}
              className={inputCls}
              placeholder="e.g. 20"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
