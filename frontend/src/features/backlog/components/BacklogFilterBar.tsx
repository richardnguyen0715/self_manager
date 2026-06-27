"use client";

import { Search, X, SlidersHorizontal } from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkItemType, Priority, Epic } from "@/types";
import { WORK_ITEM_TYPES } from "@/types";
import { WORK_ITEM_TYPE_META } from "@/features/workitems/work-item-type-config";
import { useBacklogStore } from "../store/useBacklogStore";

// ─── Reusable inline select (matches TaskFilters pattern) ─────────────────────

interface FilterSelectProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  placeholder: string;
  options: { value: T; label: string }[];
  className?: string;
}

function FilterSelect<T extends string>({
  value,
  onChange,
  placeholder,
  options,
  className,
}: FilterSelectProps<T>) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger
        className={cn(
          "flex h-8 items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "gap-2 whitespace-nowrap",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:translate-y-1",
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
                  "focus:bg-accent focus:text-accent-foreground",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                )}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-4 w-4" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

// ─── Filter options ───────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: WorkItemType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  ...WORK_ITEM_TYPES.map((t) => ({ value: t, label: WORK_ITEM_TYPE_META[t].label })),
];

const PRIORITY_OPTIONS: { value: Priority | "all"; label: string }[] = [
  { value: "all", label: "All priorities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface BacklogFilterBarProps {
  epics: Epic[];
}

export function BacklogFilterBar({ epics }: BacklogFilterBarProps) {
  const { filters, setFilter, resetFilters } = useBacklogStore();

  const epicOptions: { value: string; label: string }[] = [
    { value: "all", label: "All epics" },
    ...epics.map((e) => ({ value: e.id, label: e.title })),
  ];

  const hasActiveFilters =
    filters.search !== "" ||
    filters.type !== "all" ||
    filters.priority !== "all" ||
    filters.epic_id !== "all";

  const activeCount = [
    filters.type !== "all",
    filters.priority !== "all",
    filters.epic_id !== "all",
  ].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Search — full width on mobile, grows on larger screens */}
      <div className="relative w-full sm:flex-1 sm:min-w-48 sm:w-auto">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search backlog..."
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
          className="pl-8 h-8"
        />
        {filters.search && (
          <button
            type="button"
            onClick={() => setFilter("search", "")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter selects — wrap naturally on mobile */}
      {/* Type filter */}
      <FilterSelect<WorkItemType | "all">
        value={filters.type}
        onChange={(v) => setFilter("type", v)}
        placeholder="Type"
        options={TYPE_OPTIONS}
        className="w-32 sm:w-36"
      />

      {/* Priority filter */}
      <FilterSelect<Priority | "all">
        value={filters.priority}
        onChange={(v) => setFilter("priority", v)}
        placeholder="Priority"
        options={PRIORITY_OPTIONS}
        className="w-32 sm:w-36"
      />

      {/* Epic filter */}
      {epics.length > 0 && (
        <FilterSelect<string>
          value={filters.epic_id}
          onChange={(v) => setFilter("epic_id", v)}
          placeholder="Epic"
          options={epicOptions}
          className="w-36 sm:w-44"
        />
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="h-8 gap-1.5 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      )}

      <div className="ml-auto flex items-center text-muted-foreground">
        <SlidersHorizontal className="h-4 w-4" />
      </div>
    </div>
  );
}
