"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { Task, TaskListItem } from "@/types";
import { useTasks, taskKeys } from "@/features/tasks/hooks/useTasks";
import { useProjectStore } from "@/stores";

// ─── Project-scoped task list ─────────────────────────────────────────────────
//
// Returns every task for the currently selected project (or across all
// projects when none is selected — matching the project switcher). The grids
// split these into scheduled (has due_date) and unscheduled (no due_date).

export function useProjectTasks() {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  const query = useTasks({
    project_id: currentProjectId ?? "all",
    // Pull a wide window; the calendar paints whatever falls in view.
    sort_by: "due_date",
    sort_dir: "asc",
  });

  const tasks = query.data ?? [];

  const { scheduled, unscheduled } = useMemo(() => {
    const scheduled: TaskListItem[] = [];
    const unscheduled: TaskListItem[] = [];
    for (const t of tasks) {
      // Don't surface completed tasks on the working timeline.
      if (t.status === "completed") continue;
      if (t.due_date) scheduled.push(t);
      else unscheduled.push(t);
    }
    return { scheduled, unscheduled };
  }, [tasks]);

  return {
    scheduled,
    unscheduled,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

// ─── Reschedule (set due_date) ────────────────────────────────────────────────
//
// Moves a task to a new due date/time. Used by drag-and-drop and is the core of
// "direct CRUD on the timeline".

export function useRescheduleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, due_date }: { id: string; due_date: string }) =>
      api.patch<Task>(API_ENDPOINTS.TASK_BY_ID(id), { due_date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
