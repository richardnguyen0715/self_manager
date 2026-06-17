"use client";

import { Search, ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GoalStatus } from "@/types";
import { useGoalsStore } from "../store/goals.store";

// ─── Types ─────────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: GoalStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
];

// ─── Props ─────────────────────────────────────────────────────────────────────

interface GoalFiltersProps {
  goalIds: string[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GoalFilters({ goalIds }: GoalFiltersProps) {
  const {
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    expandAll,
    collapseAll,
    expandedGoals,
  } = useGoalsStore();

  const anyExpanded = goalIds.some((id) => expandedGoals[id]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search goals…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-1 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              statusFilter === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Expand/collapse all */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          anyExpanded ? collapseAll() : expandAll(goalIds)
        }
        className="gap-1.5 text-muted-foreground"
        title={anyExpanded ? "Collapse all" : "Expand all"}
      >
        {anyExpanded ? (
          <ChevronsDownUp className="h-4 w-4" />
        ) : (
          <ChevronsUpDown className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">
          {anyExpanded ? "Collapse all" : "Expand all"}
        </span>
      </Button>
    </div>
  );
}
