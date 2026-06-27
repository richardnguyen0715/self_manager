"use client";

import {
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle,
  Archive,
  Target,
  CalendarDays,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, isOverdue } from "@/lib/utils";
import type { Goal } from "@/types";
import { useGoalsStore } from "../store/goals.store";
import { useCompleteGoal, useAbandonGoal } from "../hooks/useGoals";
import { GoalStatusBadge } from "./GoalStatusBadge";
import { GoalProgressBar } from "./GoalProgressBar";
import { GoalTreeView } from "./GoalTreeView";

// ─── Dropdown menu (custom, no extra Radix dep beyond what's installed) ────────

interface GoalActionsMenuProps {
  goal: Goal;
  onEdit: () => void;
  onDelete: () => void;
}

function GoalActionsMenu({ goal, onEdit, onDelete }: GoalActionsMenuProps) {
  const completeGoal = useCompleteGoal();
  const abandonGoal = useAbandonGoal();

  return (
    <div className="relative group/menu">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        aria-label="Goal actions"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {/* Hover-activated dropdown */}
      <div
        className={cn(
          "absolute right-0 top-full mt-1 z-20 w-44 rounded-md border bg-popover text-popover-foreground shadow-md",
          "opacity-0 pointer-events-none group-hover/menu:opacity-100 group-hover/menu:pointer-events-auto",
          "transition-opacity duration-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-1 flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>

          {goal.status !== "completed" && (
            <button
              type="button"
              onClick={() => completeGoal.mutate(goal.id)}
              disabled={completeGoal.isPending}
              className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
            >
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              Mark completed
            </button>
          )}

          {goal.status !== "abandoned" && (
            <button
              type="button"
              onClick={() => abandonGoal.mutate(goal.id)}
              disabled={abandonGoal.isPending}
              className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
            >
              <Archive className="h-3.5 w-3.5 text-muted-foreground" />
              Abandon
            </button>
          )}

          <div className="h-px bg-border my-0.5" />

          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-destructive/10 text-destructive transition-colors text-left"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
  onAddProject: (goalId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GoalCard({
  goal,
  onEdit,
  onDelete,
  onAddProject,
}: GoalCardProps) {
  const { expandedGoals, toggleGoalExpanded } = useGoalsStore();
  const isExpanded = Boolean(expandedGoals[goal.id]);

  // Projects are fetched lazily in GoalTreeView; GoalCard just shows target_date.
  const deadlineOverdue =
    goal.target_date &&
    isOverdue(goal.target_date) &&
    goal.status === "active";

  return (
    <Card
      className={cn(
        "transition-shadow hover:shadow-md",
        goal.status === "abandoned" && "opacity-60",
        goal.status === "completed" && "border-green-500/30",
      )}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start gap-3">
          {/* Expand toggle */}
          <button
            type="button"
            onClick={() => toggleGoalExpanded(goal.id)}
            className="mt-0.5 shrink-0 rounded hover:bg-accent p-0.5 transition-colors"
            aria-label={isExpanded ? "Collapse goal" : "Expand goal"}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isExpanded && "rotate-90",
              )}
            />
          </button>

          {/* Target icon */}
          <Target className="h-5 w-5 shrink-0 mt-0.5 text-primary" />

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold leading-tight truncate">
                {goal.title}
              </h3>
              <GoalStatusBadge status={goal.status} />
            </div>

            {goal.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {goal.description}
              </p>
            )}

            {/* Target date */}
            <div className="flex items-center gap-4 mt-2">
              {goal.target_date && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    deadlineOverdue
                      ? "text-destructive font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(goal.target_date)}
                </span>
              )}
            </div>

            {/* Progress rolled up from linked projects' tasks */}
            {goal.progress.total_projects > 0 ? (
              <div className="mt-2">
                <GoalProgressBar value={goal.progress.percent} size="sm" />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {goal.progress.completed_tasks}/{goal.progress.total_tasks} tasks
                  {" · "}
                  {goal.progress.total_projects} project
                  {goal.progress.total_projects === 1 ? "" : "s"}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">
                No projects linked yet — add one to track progress.
              </p>
            )}
          </div>

          {/* Actions */}
          <GoalActionsMenu
            goal={goal}
            onEdit={() => onEdit(goal)}
            onDelete={() => onDelete(goal.id)}
          />
        </div>
      </CardHeader>

      {/* Tree content */}
      {isExpanded && (
        <CardContent className="pt-0 pb-3 px-4 pl-10">
          <GoalTreeView goal={goal} onAddProject={onAddProject} />
        </CardContent>
      )}
    </Card>
  );
}
