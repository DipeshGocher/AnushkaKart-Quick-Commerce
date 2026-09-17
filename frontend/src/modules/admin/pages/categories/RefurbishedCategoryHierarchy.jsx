import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronRight,
  Search,
  FolderOpen,
  Layers,
  Sparkles,
} from "lucide-react";
import { adminApi } from "../../services/adminApi";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import { toast } from "sonner";
import { getIconSvg } from "@shared/constants/categoryIcons";

const RefurbishedCategoryHierarchy = () => {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Selection State for Miller Columns
  const [selectedHeader, setSelectedHeader] = useState(null);

  // Stats
  const stats = useMemo(() => {
    let headers = 0;
    let l2 = 0;

    const traverse = (items) => {
      items.forEach((item) => {
        if (item.type === "header") headers++;
        if (item.type === "category") l2++;
        if (item.children) traverse(item.children);
      });
    };
    traverse(categories);
    return { headers, l2, total: headers + l2 };
  }, [categories]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getCategoryTree({ catalogType: "refurbished" });
      if (res.data.success) {
        const tree = res.data.results || res.data.result || [];
        setCategories(tree.filter((c) => c.catalogType === "refurbished"));
      }
    } catch (error) {
      toast.error("Failed to fetch refurbished category hierarchy");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHeaders = useMemo(() => {
    if (!searchTerm) return categories.filter((c) => c.type === "header");
    return categories.filter(
      (c) =>
        c.type === "header" &&
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categories, searchTerm]);

  const activeLevel2 = useMemo(() => {
    if (!selectedHeader) return [];
    return selectedHeader.children || [];
  }, [selectedHeader]);

  const handleHeaderSelect = (header) => {
    setSelectedHeader(header);
  };

  const ColumnHeader = ({ title, count }) => (
    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{title}</span>
      <Badge variant="outline" className="text-xs font-mono">
        {count}
      </Badge>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-950 p-6 rounded-2xl text-white shadow-xl border border-indigo-700/40">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Refurbished Explorer
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Refurbished Category Hierarchy Explorer
          </h1>
          <p className="text-sm text-indigo-200/80 mt-1 max-w-xl">
            2-Level tree explorer for Second-Hand Device Types & Brands.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Device Types (Headers)</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">{stats.headers}</div>
          </div>
        </Card>

        <Card className="p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Brands (Main Categories)</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">{stats.l2}</div>
          </div>
        </Card>

        <Card className="p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Total Refurbished Nodes</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">{stats.total}</div>
          </div>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Filter device types..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* 2-Column Explorer */}
      <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[450px]">
        {isLoading ? (
          <div className="p-16 text-center text-slate-400">Loading refurbished hierarchy...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800 min-h-[450px]">
            {/* Column 1: Headers (Device Types) */}
            <div className="flex flex-col bg-white dark:bg-slate-900">
              <ColumnHeader title="1. Device Types (Headers)" count={filteredHeaders.length} />
              <div className="p-2 space-y-1 overflow-y-auto max-h-[500px]">
                {filteredHeaders.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No refurbished device types added yet.
                  </div>
                ) : (
                  filteredHeaders.map((header) => {
                    const isSelected = selectedHeader?._id === header._id;
                    const childCount = header.children?.length || 0;
                    return (
                      <button
                        key={header._id}
                        onClick={() => handleHeaderSelect(header)}
                        className={`w-full text-left p-3.5 rounded-xl transition flex items-center justify-between ${
                          isSelected
                            ? "bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-500/20"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600"
                            }`}
                          >
                            {header.image ? (
                              <img
                                src={header.image}
                                alt={header.name}
                                className="w-full h-full object-cover rounded-xl"
                              />
                            ) : header.iconId && getIconSvg(header.iconId) ? (
                              <div
                                className={`w-6 h-6 flex items-center justify-center ${
                                  isSelected ? "fill-white text-white" : "fill-indigo-600 text-indigo-600"
                                }`}
                                dangerouslySetInnerHTML={{ __html: getIconSvg(header.iconId) }}
                              />
                            ) : (
                              <Smartphone className={`w-5 h-5 ${isSelected ? "text-white" : "text-indigo-600"}`} />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0 text-left">
                            <span className="font-bold text-sm truncate">{header.name}</span>
                            <span
                              className={`text-[10px] uppercase font-semibold tracking-wider truncate ${
                                isSelected ? "text-indigo-100" : "text-slate-400"
                              }`}
                            >
                              {header.slug || header.name?.toLowerCase().replace(/\s+/g, "-")}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={
                              isSelected ? "border-white/30 text-white bg-white/10" : "text-xs font-mono"
                            }
                          >
                            {childCount} brands
                          </Badge>
                          <ChevronRight
                            className={`w-4 h-4 ${isSelected ? "text-white" : "text-slate-400"}`}
                          />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Column 2: Brands (Main Categories) */}
            <div className="flex flex-col bg-slate-50/30 dark:bg-slate-900/50">
              <ColumnHeader title="2. Brands (Main Categories)" count={activeLevel2.length} />
              <div className="p-2 space-y-1 overflow-y-auto max-h-[500px]">
                {!selectedHeader ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    Select a Device Type on the left column to view its Brands
                  </div>
                ) : activeLevel2.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    No brands found under "{selectedHeader.name}"
                  </div>
                ) : (
                  activeLevel2.map((l2) => (
                    <div
                      key={l2._id}
                      className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/60 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 font-bold text-xs flex items-center justify-center shrink-0">
                          {l2.image ? (
                            <img
                              src={l2.image}
                              alt={l2.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            l2.name?.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm block">
                            {l2.name}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{l2.slug}</span>
                        </div>
                      </div>
                      <Badge variant={l2.status === "active" ? "success" : "secondary"}>
                        {l2.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default RefurbishedCategoryHierarchy;
