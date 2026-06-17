import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Task } from "@/types";
import { DASHBOARD_SUMMARY_KEY } from "./useDashboardSummary";
import { useDashboardUIStore } from "../store";

interface CompleteTaskVars {
  task_id: string;
}

// PATCH /api/tasks/:id  — sets status = "completed"
// Response: flat TaskResponse (Task shape)
export function useCompleteTask() {
  const queryClient = useQueryClient();
  const { addPendingTask, removePendingTask } = useDashboardUIStore();

  return useMutation({
    mutationFn: ({ task_id }: CompleteTaskVars) =>
      api.patch<Task>(`/api/tasks/${task_id}`, {
        status: "completed",
      }),

    onMutate: ({ task_id }) => {
      addPendingTask(task_id);
    },

    onSuccess: () => {
      // Invalidate the dashboard summary so stats and task list refresh
      queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_KEY });
    },

    onError: (_err, { task_id }) => {
      removePendingTask(task_id);
    },

    onSettled: (_data, _err, { task_id }) => {
      removePendingTask(task_id);
    },
  });
}
