import React, { createElement, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Search, X } from "lucide-react";
import { motion } from "framer-motion";
import { fontAwesomeFreeClassicIcons } from "../constants/fontAwesomeFreeClassicCatalog";
import { getFontAwesomeIconId } from "../constants/fontAwesomeCategoryIcons";

const PAGE_SIZE = 96;
const QUICK_COMMERCE_TERMS = /apple|basket|bowl|bread|broom|burger|bottle|cake|candy|carrot|cheese|chicken|coffee|cookie|cupcake|dairy|dish|drink|egg|fish|food|glass|grocery|house|ice.?cream|kitchen|leaf|lemon|milk|mug|pepper|pizza|salad|seed|shop|soap|store|utensil|vegetable|water|wheat|wine|bag|cart/i;
const E_COMMERCE_TERMS = /bag|basket|box|camera|car|cart|chair|computer|credit|desktop|dress|gift|headphone|jewel|laptop|mobile|package|phone|shoe|shirt|shopping|store|tablet|tag|toy|truck|tv|wallet|watch|book|ball|bike|bicycle|game|sofa|couch|keyboard|mouse|printer|plug|light|fan|speaker|sport|gem|ring|suitcase/i;

const IconSelector = ({ selectedIcon, onSelect, onClose, catalogType }) => {
  const [library, setLibrary] = useState(catalogType === "refurbished" ? "ecommerce" : "quick-commerce");
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const normalizedSelection = getFontAwesomeIconId(selectedIcon);

  const relevantIcons = useMemo(() => {
    const pattern = library === "quick-commerce"
      ? QUICK_COMMERCE_TERMS
      : library === "ecommerce"
        ? E_COMMERCE_TERMS
        : null;
    return pattern
      ? fontAwesomeFreeClassicIcons.filter((icon) => pattern.test(icon.name))
      : fontAwesomeFreeClassicIcons;
  }, [library]);

  const filteredIcons = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return relevantIcons;
    return relevantIcons.filter((icon) => icon.name.toLowerCase().includes(query));
  }, [relevantIcons, searchTerm]);

  const selectLibrary = (nextLibrary) => {
    setLibrary(nextLibrary);
    setVisibleCount(PAGE_SIZE);
  };

  const selectIcon = ({ componentName, Icon }) => {
    const svg = renderToStaticMarkup(createElement(Icon));
    onSelect("fa6svg:" + componentName + ":" + encodeURIComponent(svg));
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
          <div>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Select Header Category Icon</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Font Awesome Free Classic · {fontAwesomeFreeClassicIcons.length} icons · black
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close icon selector">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3 sm:px-7">
          {[
            ["quick-commerce", "Quick Commerce"],
            ["ecommerce", "E-commerce"],
            ["all", "All Free Icons"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => selectLibrary(id)}
              className={"rounded-full border px-4 py-2 text-sm font-semibold transition-colors " + (library === id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="border-b border-slate-100 px-5 py-3 sm:px-7">
          <label className="relative block">
            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder={"Search all " + fontAwesomeFreeClassicIcons.length + " free icons..."}
              className="h-12 w-full rounded-xl border border-slate-300 pl-11 pr-4 text-sm outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            {searchTerm ? filteredIcons.length + " matching icons" : filteredIcons.length + " icons · showing " + Math.min(visibleCount, filteredIcons.length)}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredIcons.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3 md:grid-cols-7 lg:grid-cols-8">
              {filteredIcons.slice(0, visibleCount).map(({ id, name, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectIcon({ componentName: id.slice(4), Icon })}
                  title={name}
                  aria-label={"Select " + name + " icon"}
                  className={"flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-colors " + (normalizedSelection === id || selectedIcon === id ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50")}
                >
                  <Icon aria-hidden="true" className="h-7 w-7 text-black" />
                  <span className="w-full truncate text-center text-[11px] font-medium text-slate-600">{name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-slate-500">No Font Awesome icons match “{searchTerm}”.</p>
          )}
          {visibleCount < filteredIcons.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              className="mx-auto mt-5 block rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Load more icons
            </button>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-7">
          {selectedIcon ? (
            <button type="button" onClick={() => onSelect("")} className="text-sm font-semibold text-slate-600 hover:text-black">
              Remove selected icon
            </button>
          ) : <span />}
          <button type="button" onClick={onClose} className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default IconSelector;
