import React from "react";
import {
  RotateCcw,
  Banknote,
  ShieldCheck,
  Award,
  Zap,
  Truck,
  Ban,
  Clock,
  Plus,
  Trash2,
  Sparkles,
  Info,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const TRUST_BADGE_ICON_OPTIONS = [
  { value: "return", label: "Return / Replacement", icon: RotateCcw },
  { value: "cod", label: "Cash on Delivery", icon: Banknote },
  { value: "warranty", label: "Warranty / Protection", icon: ShieldCheck },
  { value: "quality", label: "Quality / Assured", icon: Award },
  { value: "delivery", label: "Express Delivery", icon: Zap },
  { value: "truck", label: "Doorstep Truck", icon: Truck },
  { value: "ban", label: "Non-Returnable", icon: Ban },
  { value: "clock", label: "Timely Support", icon: Clock },
];

export const TRUST_BADGE_PRESETS = [
  {
    name: "Grocery",
    badges: [
      { icon: "quality", title: "Quality Assured", subtitle: "CHECK AT DOORSTEP" },
      { icon: "cod", title: "Cash on Delivery", subtitle: "PAY AT DOORSTEP" },
      { icon: "return", title: "Doorstep Return", subtitle: "NO QUESTIONS ASKED" },
    ],
  },
  {
    name: "Electronics",
    badges: [
      { icon: "return", title: "7-Day Replacement", subtitle: "BRAND REPLACEMENT" },
      { icon: "cod", title: "Cash on Delivery", subtitle: "PAY AT DOORSTEP" },
      { icon: "warranty", title: "1 Year Warranty", subtitle: "BRAND WARRANTY" },
    ],
  },
  {
    name: "Medicine",
    badges: [
      { icon: "warranty", title: "100% Genuine", subtitle: "VERIFIED PHARMACY" },
      { icon: "cod", title: "Cash on Delivery", subtitle: "PAY AT DOORSTEP" },
      { icon: "delivery", title: "Express Delivery", subtitle: "TEMPERATURE SAFE" },
    ],
  },
  {
    name: "Fashion",
    badges: [
      { icon: "return", title: "7-Day Return & Exchange", subtitle: "DOORSTEP PICKUP" },
      { icon: "cod", title: "Cash on Delivery", subtitle: "PAY AT DOORSTEP" },
      { icon: "quality", title: "100% Original", subtitle: "QUALITY GUARANTEE" },
    ],
  },
];

export const getBadgeIconComponent = (iconValue) => {
  const found = TRUST_BADGE_ICON_OPTIONS.find((opt) => opt.value === iconValue);
  return found ? found.icon : ShieldCheck;
};

const TrustBadgesManager = ({
  value = [],
  onChange,
  maxBadges = 3,
}) => {
  const badges = Array.isArray(value) ? value : [];

  const handleAdd = () => {
    if (badges.length >= maxBadges) return;
    const defaultIcon = badges.length === 0 ? "return" : badges.length === 1 ? "cod" : "warranty";
    const newBadge = {
      icon: defaultIcon,
      title: "",
      subtitle: "",
    };
    onChange([...badges, newBadge]);
  };

  const handleUpdate = (index, field, val) => {
    const updated = badges.map((b, i) => (i === index ? { ...b, [field]: val } : b));
    onChange(updated);
  };

  const handleRemove = (index) => {
    const updated = badges.filter((_, i) => i !== index);
    onChange(updated);
  };

  const applyPreset = (presetBadges) => {
    onChange(presetBadges.slice(0, maxBadges));
  };

  return (
    <div className="space-y-3.5 p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
              Product Trust Badges & Policies
            </span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight",
                badges.length === maxBadges
                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                  : "bg-blue-100 text-blue-800 border border-blue-200"
              )}
            >
              {badges.length} / {maxBadges} configured
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Is category ke har product details page par ye badges automatically show honge (Max {maxBadges} allowed).
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-amber-500" /> Presets:
          </span>
          {TRUST_BADGE_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset.badges)}
              className="px-2.5 py-1 text-[10.5px] font-bold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Badges List */}
      <div className="space-y-2.5">
        {badges.length === 0 ? (
          <div className="p-4 rounded-xl bg-white border border-dashed border-slate-300 text-center">
            <Info className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-slate-600">
              Koi custom badge set nahi hai.
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Aap presets select kar sakte hain ya "+ Add Trust Badge" se custom badge bana sakte hain. (Khali rakhne par system defaults use karega).
            </p>
          </div>
        ) : (
          badges.map((badge, idx) => {
            const IconComp = getBadgeIconComponent(badge.icon);
            return (
              <div
                key={idx}
                className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5 relative group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                      <IconComp size={15} strokeWidth={2.3} />
                    </div>
                    <span className="text-xs font-bold text-slate-800">
                      Badge #{idx + 1}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove badge"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Icon Selector */}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 ml-0.5 mb-1 block">
                      Icon
                    </label>
                    <select
                      value={badge.icon || "return"}
                      onChange={(e) => handleUpdate(idx, "icon", e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {TRUST_BADGE_ICON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 ml-0.5 mb-1 block">
                      Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 7-Day Return, Cash on Delivery"
                      value={badge.title || ""}
                      onChange={(e) => handleUpdate(idx, "title", e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300"
                    />
                  </div>

                  {/* Subtitle */}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 ml-0.5 mb-1 block">
                      Subtitle (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. PAY AT DOORSTEP, Brand Warranty"
                      value={badge.subtitle || ""}
                      onChange={(e) => handleUpdate(idx, "subtitle", e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300"
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Button */}
      {badges.length < maxBadges && (
        <button
          type="button"
          onClick={handleAdd}
          className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 hover:border-primary/60 bg-white hover:bg-slate-50 text-slate-700 hover:text-primary text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <Plus size={14} />
          <span>Add Trust Badge ({badges.length}/{maxBadges})</span>
        </button>
      )}

      {/* Live Preview of the Cards as they appear on Product Details */}
      {badges.length > 0 && (
        <div className="pt-2 border-t border-slate-200/60">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
            Customer View Preview:
          </p>
          <div
            className={cn(
              "grid gap-2 p-2.5 rounded-xl bg-slate-100/70 border border-slate-200/80",
              badges.length === 1 ? "grid-cols-1 max-w-[200px] mx-auto" : badges.length === 2 ? "grid-cols-2" : "grid-cols-3"
            )}
          >
            {badges.map((b, idx) => {
              const IconComp = getBadgeIconComponent(b.icon);
              return (
                <div
                  key={idx}
                  className="flex flex-col items-center justify-center p-2.5 text-center bg-white rounded-xl border border-slate-200/80 shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-800 mb-1.5">
                    <IconComp size={15} strokeWidth={2.3} />
                  </div>
                  <div className="flex items-center justify-center gap-0.5 text-[10.5px] font-bold text-slate-900 leading-tight">
                    <span className="truncate">{b.title || "Badge Title"}</span>
                    {b.subtitle && b.subtitle.toLowerCase().includes("detail") && (
                      <ChevronRight size={10} className="text-slate-400 shrink-0" />
                    )}
                  </div>
                  {b.subtitle && !b.subtitle.toLowerCase().includes("detail") && (
                    <span className="text-[8.5px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5 truncate max-w-full">
                      {b.subtitle}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrustBadgesManager;
