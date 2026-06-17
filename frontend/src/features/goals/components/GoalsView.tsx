"use client";

import { useMemo } from "react";
import { Plus, Target, Loader2, AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Goal } from "@/types";
import { useGoals } from "../hooks/useGoals";
import { useGoalsStore } from "../store/goals.store";
import { GoalCard } from "./GoalCard";
import { GoalFilters } from "./GoalFilters";
import { GoalForm } from "./GoalForm";
import { ProjectForm } from "./ProjectForm";
import { DeleteGoalDialog } from "./DeleteGoalDialog";
import { GoalsEmptyState } from "./GoalsEmptyState";

// ─── Summary strip ─────────────────────────────────────────────────────────────

interface SummaryStripProps {
  goals: Goal[];
}

function SummaryStrip({ goals }: SummaryStripProps) {
  const active = goals.filter((g) => g.status === "active").length;
  const completed = goals.filter((g) => g.status === "completed").length;
  const paused = goals.filter((g) => g.status === "paused").length;
  const abandoned = goals.filter((g) => g.status === "abandoned").length;

  const stats = [
    { label: "Active", value: active, colorClass: "text-green-600 dark:text-green-400" },
    { label: "Completed", value: completed, colorClass: "text-blue-600 dark:text-blue-400" },
    { label: "Paused", value: paused, colorClass: "text-yellow-600 dark:text-yellow-400" },
    { label: "Abandoned", value: abandoned, colorClass: "text-muted-foreground" },
    { label: "Total", value: goals.length, colorClass: "text-foreground" },
  ];

  return (
    <div className="flex items-center gap-6 flex-wrap">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col items-center gap-0.5">
          <span className={`text-2xl font-bold tabular-nums ${s.colorClass}`}>
            {s.value}
          </span>
          <span className="text-xs text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function GoalsView() {
  const {
    statusFilter,
    searchQuery,
    createGoalOpen,
    openCreateGoal,
    closeCreateGoal,
    editGoalId,
    openEditGoal,
    closeEditGoal,
    deleteGoalId,
    openDeleteGoal,
    closeDeleteGoal,
    createProjectForGoalId,
    openCreateProject,
    closeCreateProject,
  } = useGoalsStore();

  // Always fetch all goals with the status filter; client-side search is fast
  const { data, isLoading, isError, error, refetch } = useGoals({
    status: statusFilter,
    limit: 100,
  });

  const allGoals: Goal[] = data?.data ?? [];

  // Client-side search filter
  const filteredGoals = useMemo(() => {
    if (!searchQuery.trim()) return allGoals;
    const q = searchQuery.toLowerCase();
    return allGoals.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.description?.toLowerCase().includes(q),
    );
  }, [allGoals, searchQuery]);

  // Find goal being edited
  const goalBeingEdited = editGoalId
    ? allGoals.find((g) => g.id === editGoalId)
    : undefined;

  // Find goal whose project is being deleted (for the delete dialog title)
  const goalBeingDeleted = deleteGoalId
    ? allGoals.find((g) => g.id === deleteGoalId)
    : undefined;

  // Find goal title for the project creation form
  const goalForNewProject = createProjectForGoalId
    ? allGoals.find((g) => g.id === createProjectForGoalId)
    : undefined;

  const hasFilters =
    statusFilter !== "all" || searchQuery.trim().length > 0;

  const goalIds = filteredGoals.map((g) => g.id);

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            High-level objectives broken down into projects and tasks.
          </p>
        </div>

        <Button onClick={openCreateGoal} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          New Goal
        </Button>
      </div>

      {/* Summary strip */}
      {!isLoading && allGoals.length > 0 && (
        <SummaryStrip goals={allGoals} />
      )}

      {/* Filters */}
      <GoalFilters goalIds={goalIds} />

      {/* Content */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading goals…</p>
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="text-center">
            <p className="font-semibold">Failed to load goals</p>
            <p className="text-sm text-muted-foreground mt-1">
              {(error as Error)?.message ?? "An unexpected error occurred."}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      )}

      {!isLoading && !isError && filteredGoals.length === 0 && (
        <GoalsEmptyState
          hasFilters={hasFilters}
          onCreateGoal={openCreateGoal}
        />
      )}

      {!isLoading && !isError && filteredGoals.length > 0 && (
        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="flex flex-col gap-3 pb-6">
            {filteredGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={(g) => openEditGoal(g.id)}
                onDelete={(id) => openDeleteGoal(id)}
                onAddProject={(goalId) => openCreateProject(goalId)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Modals */}
      <GoalForm
        open={createGoalOpen}
        onOpenChange={(open) => !open && closeCreateGoal()}
      />

      <GoalForm
        open={Boolean(editGoalId)}
        onOpenChange={(open) => !open && closeEditGoal()}
        goal={goalBeingEdited}
      />

      <DeleteGoalDialog
        open={Boolean(deleteGoalId)}
        onOpenChange={(open) => !open && closeDeleteGoal()}
        goalId={deleteGoalId}
        goalTitle={goalBeingDeleted?.title}
      />

      {createProjectForGoalId && (
        <ProjectForm
          open={Boolean(createProjectForGoalId)}
          onOpenChange={(open) => !open && closeCreateProject()}
          goalId={createProjectForGoalId}
          goalTitle={goalForNewProject?.title}
        />
      )}
    </div>
  );
}
