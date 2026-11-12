import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small building blocks for the category add / edit form, written for shop owners:
 * plain words, one idea per card, short hints under each field.
 */

export const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-gray-400";

/** A titled card that groups related fields. */
export function FormCard({ title, hint, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="text-[15px] font-extrabold text-gray-900">{title}</h3>
        {hint && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Label with an optional red star and a one-line explanation under it. */
export function FieldLabel({ children, required = false, hint }) {
  return (
    <div className="mb-1.5">
      <label className="block text-sm font-bold text-gray-800">
        {children}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

/** A big tappable choice (instead of a drop-down with long technical text). */
export function ChoiceCard({ selected, onClick, title, description, emoji }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "w-full text-left rounded-xl border-2 p-3.5 flex items-start gap-3 transition-colors cursor-pointer",
        selected ? "border-blue-500 bg-blue-50/60" : "border-gray-200 bg-white hover:border-gray-300",
      )}
    >
      <span
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center",
          selected ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300",
        )}
      >
        {selected && <Check size={12} strokeWidth={3.5} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-extrabold text-gray-900">
          {emoji && <span className="mr-1.5">{emoji}</span>}
          {title}
        </span>
        <span className="block text-xs text-gray-500 mt-1 leading-relaxed">{description}</span>
      </span>
    </button>
  );
}

/** An on / off switch with a title and a one-line explanation. */
export function SwitchRow({ checked, onChange, title, description }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-start gap-3.5 text-left cursor-pointer"
    >
      <span
        className={cn(
          "mt-0.5 relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-blue-600" : "bg-gray-300",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-extrabold text-gray-900">
          {title} <span className={checked ? "text-blue-600" : "text-gray-400"}>({checked ? "ON" : "OFF"})</span>
        </span>
        <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</span>
      </span>
    </button>
  );
}
