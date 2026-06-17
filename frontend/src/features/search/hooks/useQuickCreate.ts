"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { Task, Habit } from "@/types";
import type { QuickCreateTaskPayload, QuickCreateHabitPayload } from "../types";

// ─── Quick create task ────────────────────────────────────────────────────────

export function useQuickCreateTask(options?: {
  onSuccess?: (task: Task) => void;
}) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: QuickCreateTaskPayload) =>
      // POST /api/tasks → 201 + flat TaskResponse (no {data:T} wrapper)
      api.post<Task>(API_ENDPOINTS.TASKS, {
        title: payload.title,
        priority: payload.priority ?? "medium",
        status: payload.status ?? "inbox",
      }),
    onSuccess: (task) => {
      // Bust the task list so new task appears wherever tasks are rendered
      qc.invalidateQueries({ queryKey: ["tasks"] });
      options?.onSuccess?.(task);
    },
  });
}

// ─── Quick create habit ───────────────────────────────────────────────────────

export function useQuickCreateHabit(options?: {
  onSuccess?: (habit: Habit) => void;
}) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: QuickCreateHabitPayload) =>
      // POST /api/habits → 201 + flat HabitResponse (no {data:T} wrapper)
      // Backend CreateHabitRequest fields: name, habit_type, frequency
      api.post<Habit>(API_ENDPOINTS.HABITS, {
        name: payload.name,
        habit_type: payload.habit_type ?? "check",
        frequency: payload.frequency ?? "daily",
      }),
    onSuccess: (habit) => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      options?.onSuccess?.(habit);
    },
  });
}
