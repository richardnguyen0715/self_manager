"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Loader2,
  AlertCircle,
  ChevronRight,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Sprint, WorkItemStatus } from "@/types";
import { useSprintWorkItemsList } from "../hooks/useSprints";
import { WorkItemStatusBadge } from "@/features/agile/components/WorkItemStatusBadge";
import { WorkItemTypeBadge } from "@/features/agile/components/WorkItemTypeBadge";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SprintWorkItemsOverviewProps {
  sprintId: string;
  sprint: Sprint;
}

// ─── Status filter pill ───────────────────────────────────────────────────────

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-input hover:border-ring hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: WorkItemStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "In Review" },
  { value: "done", label: "Done" },
];

export function SprintWorkItemsOverview({
  sprintId,
  sprint,
}: SprintWorkItemsOverviewProps) {
  const [statusFilter, setStatusFilter] = useState<WorkItemStatus | "all">("all");

  const { data, isLoading, isError } = useSprintWorkItemsList(
    sprintId,
    statusFilter !== "all" ? { status: statusFilter } : undefined,
  );

  const items = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Status filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <FilterPill
            key={f.value}
            active={statusFilter === f.value}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </FilterPill>
        ))}
        {total > 0 && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {total} item{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
          <AlertCircle className="h-6 w-6" />
          <p className="text-sm">Failed to load work items.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
          <p>
            {statusFilter === "all"
              ? "No work items in this sprint."
              : `No items with status "${statusFilter}".`}
          </p>
          <p className="text-xs mt-1 opacity-60">
            Use the Planning tab to add items from the backlog.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="w-6 px-4 py-2.5" />
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Work item
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">
                  Status
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">
                  Due
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Pts
                </th>
                <th className="w-8 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-accent/40 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <WorkItemTypeBadge type={item.type} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/work-items/${item.id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {item.title}
                    </Link>
                    {(item.subtask_count ?? 0) > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                        {item.done_subtask_count}/{item.subtask_count}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    <WorkItemStatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">
                    {item.due_date ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(item.due_date), "MMM d")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center rounded border px-1.5 min-w-[1.5rem] text-xs tabular-nums font-medium",
                        item.story_points == null
                          ? "border-border text-muted-foreground"
                          : "border-primary/30 bg-primary/5 text-primary",
                      )}
                    >
                      {item.story_points ?? "?"}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <Link
                      href={`/work-items/${item.id}`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
