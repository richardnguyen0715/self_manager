"use client";

import {
  ChevronRight,
  Target,
  Plus,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, isOverdue } from "@/lib/utils";
import type { Goal, Initiative } from "@/types";
import { useInitiatives } from "../hooks/useHierarchy";
import { useHierarchyStore } from "../store/hierarchy.store";
import { GoalProgressBar } from "@/features/goals/components/GoalProgressBar";
import { GoalStatusBadge } from "@/features/goals/components/GoalStatusBadge";
import { InitiativeRow } from "./InitiativeRow";

// ─── Goal row ──────────────────────────────────────────────────────────────────

interface GoalHierarchyRowProps {
  goal: Goal;
}

export function GoalHierarchyRow({ goal }: GoalHierarchyRowProps) {
  const {
    expandedGoals,
    toggleGoalExpanded,
    openCreateInitiative,
  } = useHierarchyStore();

  const isExpanded = Boolean(expandedGoals[goal.id]);

  // Always fetch initiatives for the goal when expanded
  const { data: initiativesData, isLoading, isError } = useInitiatives(
    { goal_id: goal.id, limit: 100 },
  );

  const initiatives: Initiative[] = initiativesData?.data ?? [];

  // Compute rollup progress from initiatives' epics — approximation from initiative list
  // (exact progress requires fetching all epics; use 0 as base until expanded)
  const deadlineOverdue =
    goal.target_date && isOverdue(goal.target_date) && goal.status === "active";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card shadow-sm",
        goal.status === "abandoned" && "opacity-60",
        goal.status === "completed" && "border-green-500/30",
      )}
    >
      {/* Goal header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer group/goal rounded-lg"
        onClick={() => toggleGoalExpanded(goal.id)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleGoalExpanded(goal.id);
          }
        }}
      >
        {/* Chevron */}
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            isExpanded && "rotate-90",
          )}
        />

        {/* Goal icon */}
        <Target
          className="h-5 w-5 shrink-0 text-primary"
          style={{ color: goal.color ?? undefined }}
        />

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold leading-tight">
              {goal.title}
            </h3>
            <GoalStatusBadge status={goal.status} />
          </div>
          {goal.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {goal.description}
            </p>
          )}
        </div>

        {/* Target date */}
        {goal.target_date && (
          <span
            className={cn(
              "text-xs shrink-0",
              deadlineOverdue
                ? "text-destructive font-medium"
                : "text-muted-foreground",
            )}
          >
            {formatDate(goal.target_date)}
          </span>
        )}

        {/* Initiative count badge */}
        <span className="text-xs text-muted-foreground shrink-0">
          {initiativesData ? `${initiatives.length} initiatives` : ""}
        </span>

        {/* Actions */}
        <div
          className="flex items-center gap-1 opacity-0 group-hover/goal:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => openCreateInitiative(goal.id)}
            title="Add Initiative"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded initiatives */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-0">
          <div className="ml-8">
            {isLoading && (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading initiatives...
              </div>
            )}
            {isError && (
              <div className="flex items-center gap-2 py-2 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                Failed to load initiatives
              </div>
            )}
            {!isLoading && !isError && initiatives.length === 0 && (
              <div className="py-2 flex items-center gap-2">
                <p className="text-xs text-muted-foreground italic">
                  No initiatives yet.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-xs"
                  onClick={() => openCreateInitiative(goal.id)}
                >
                  <Plus className="h-3 w-3" />
                  Add initiative
                </Button>
              </div>
            )}
            {initiatives.length > 0 && (
              <>
                <ul className="flex flex-col gap-0.5">
                  {initiatives.map((initiative) => (
                    <InitiativeRow
                      key={initiative.id}
                      initiative={initiative}
                    />
                  ))}
                </ul>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => openCreateInitiative(goal.id)}
                >
                  <Plus className="h-3 w-3" />
                  Add initiative
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
