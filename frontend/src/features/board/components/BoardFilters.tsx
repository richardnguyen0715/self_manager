"use client";

import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSprintsList } from "@/features/sprints/hooks/useSprints";
import { useBoardStore } from "../store";
import type { WorkItemType, Priority } from "@/types";
import { WORK_ITEM_TYPES } from "@/types";
import { WORK_ITEM_TYPE_META } from "@/features/workitems/work-item-type-config";

const TYPES: { value: WorkItemType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  ...WORK_ITEM_TYPES.map((t) => ({ value: t, label: WORK_ITEM_TYPE_META[t].label })),
];

const PRIORITIES: { value: Priority | "all"; label: string }[] = [
  { value: "all", label: "All priorities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const selectCls =
  "h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring max-w-[9rem] sm:max-w-none";

export function BoardFilters() {
  const { filters, setFilters, resetFilters } = useBoardStore();
  const { data: sprints } = useSprintsList();
  const sprintList = sprints?.data ?? [];

  const active =
    filters.type !== "all" ||
    filters.priority !== "all" ||
    filters.sprintId !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        className={selectCls}
        value={filters.type}
        onChange={(e) =>
          setFilters({ type: e.target.value as WorkItemType | "all" })
        }
      >
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <select
        className={selectCls}
        value={filters.priority}
        onChange={(e) =>
          setFilters({ priority: e.target.value as Priority | "all" })
        }
      >
        {PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <select
        className={selectCls}
        value={filters.sprintId}
        onChange={(e) => setFilters({ sprintId: e.target.value })}
      >
        <option value="all">All sprints</option>
        <option value="none">Backlog (no sprint)</option>
        {sprintList.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {active && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={resetFilters}
        >
          <X className="h-3 w-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

/** Predicate used by the board to decide if an item passes the active filters. */
export function matchesBoardFilters(
  item: { type: WorkItemType; priority: Priority; sprint_id: string | null },
  f: { type: WorkItemType | "all"; priority: Priority | "all"; sprintId: string },
): boolean {
  if (f.type !== "all" && item.type !== f.type) return false;
  if (f.priority !== "all" && item.priority !== f.priority) return false;
  if (f.sprintId === "none" && item.sprint_id != null) return false;
  if (f.sprintId !== "all" && f.sprintId !== "none" && item.sprint_id !== f.sprintId)
    return false;
  return true;
}
