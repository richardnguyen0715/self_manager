"use client";

import React, { useState } from "react";
import { Filter, ArrowUpDown, X, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DatabaseColumn, DatabaseViewConfig, ViewFilter, ViewSort } from "@/types";

interface FilterSortBarProps {
  columns: DatabaseColumn[];
  config: DatabaseViewConfig;
  onChange: (updated: DatabaseViewConfig) => void;
}

const FILTER_OPS: { value: ViewFilter["op"]; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

export function FilterSortBar({ columns, config, onChange }: FilterSortBarProps) {
  const [openPanel, setOpenPanel] = useState<"filter" | "sort" | null>(null);

  const filters = config.filters ?? [];
  const sorts = config.sorts ?? [];

  function updateFilters(filters: ViewFilter[]) {
    onChange({ ...config, filters });
  }

  function updateSorts(sorts: ViewSort[]) {
    onChange({ ...config, sorts });
  }

  function addFilter() {
    if (columns.length === 0) return;
    updateFilters([...filters, { column_id: columns[0].id, op: "eq", value: "" }]);
  }

  function updateFilter(index: number, patch: Partial<ViewFilter>) {
    updateFilters(filters.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeFilter(index: number) {
    updateFilters(filters.filter((_, i) => i !== index));
  }

  function addSort() {
    if (columns.length === 0) return;
    updateSorts([...sorts, { column_id: columns[0].id, direction: "asc" }]);
  }

  function updateSort(index: number, patch: Partial<ViewSort>) {
    updateSorts(sorts.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSort(index: number) {
    updateSorts(sorts.filter((_, i) => i !== index));
  }

  return (
    <div className="relative flex items-center gap-1">
      {/* Filter button */}
      <button
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors",
          filters.length > 0
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
        onClick={() => setOpenPanel(openPanel === "filter" ? null : "filter")}
      >
        <Filter className="w-3.5 h-3.5" />
        Filter
        {filters.length > 0 && (
          <span className="ml-0.5 bg-primary text-primary-foreground rounded-full px-1 py-0 text-[10px] leading-4">
            {filters.length}
          </span>
        )}
      </button>

      {/* Sort button */}
      <button
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors",
          sorts.length > 0
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
        onClick={() => setOpenPanel(openPanel === "sort" ? null : "sort")}
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
        Sort
        {sorts.length > 0 && (
          <span className="ml-0.5 bg-primary text-primary-foreground rounded-full px-1 py-0 text-[10px] leading-4">
            {sorts.length}
          </span>
        )}
      </button>

      {/* Filter panel */}
      {openPanel === "filter" && (
        <div className="absolute top-full left-0 mt-1 z-50 w-96 bg-popover border border-border rounded-lg shadow-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Filters</span>
            <button onClick={() => setOpenPanel(null)} className="p-0.5 hover:bg-accent rounded">
              <X className="w-4 h-4" />
            </button>
          </div>

          {filters.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 text-center">No filters added.</p>
          )}

          {filters.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              {/* Column selector */}
              <select
                className="flex-1 h-8 text-xs rounded border border-input bg-background px-2"
                value={f.column_id}
                onChange={(e) => updateFilter(i, { column_id: e.target.value })}
              >
                {(columns ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Op selector */}
              <select
                className="flex-1 h-8 text-xs rounded border border-input bg-background px-2"
                value={f.op}
                onChange={(e) => updateFilter(i, { op: e.target.value as ViewFilter["op"] })}
              >
                {FILTER_OPS.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>

              {/* Value (hidden for is_empty / is_not_empty) */}
              {f.op !== "is_empty" && f.op !== "is_not_empty" && (
                <input
                  className="w-24 h-8 text-xs rounded border border-input bg-background px-2"
                  placeholder="value"
                  value={f.value !== undefined && f.value !== null ? String(f.value) : ""}
                  onChange={(e) => updateFilter(i, { value: e.target.value })}
                />
              )}

              <button
                className="p-1 hover:text-destructive text-muted-foreground"
                onClick={() => removeFilter(i)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs mt-1"
            onClick={addFilter}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add filter
          </Button>
        </div>
      )}

      {/* Sort panel */}
      {openPanel === "sort" && (
        <div className="absolute top-full left-0 mt-1 z-50 w-80 bg-popover border border-border rounded-lg shadow-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Sort</span>
            <button onClick={() => setOpenPanel(null)} className="p-0.5 hover:bg-accent rounded">
              <X className="w-4 h-4" />
            </button>
          </div>

          {sorts.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 text-center">No sorts added.</p>
          )}

          {sorts.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                className="flex-1 h-8 text-xs rounded border border-input bg-background px-2"
                value={s.column_id}
                onChange={(e) => updateSort(i, { column_id: e.target.value })}
              >
                {(columns ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                className="w-24 h-8 text-xs rounded border border-input bg-background px-2"
                value={s.direction}
                onChange={(e) => updateSort(i, { direction: e.target.value as "asc" | "desc" })}
              >
                <option value="asc">A → Z</option>
                <option value="desc">Z → A</option>
              </select>

              <button
                className="p-1 hover:text-destructive text-muted-foreground"
                onClick={() => removeSort(i)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs mt-1"
            onClick={addSort}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add sort
          </Button>
        </div>
      )}
    </div>
  );
}
