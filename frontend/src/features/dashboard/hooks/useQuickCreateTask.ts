import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Task } from "@/types";
import type { QuickCreateTaskPayload } from "../types";
import { DASHBOARD_SUMMARY_KEY } from "./useDashboardSummary";
import { useDashboardUIStore } from "../store";

// POST /api/tasks — creates a task with status "inbox" from the quick-create form
// Response: 201 + flat TaskResponse (Task shape)
export function useQuickCreateTask() {
  const queryClient = useQueryClient();
  const { closeQuickCreate } = useDashboardUIStore();

  return useMutation({
    mutationFn: (payload: QuickCreateTaskPayload) =>
      api.post<Task>("/api/tasks", {
        ...payload,
        status: "inbox",
        priority: payload.priority ?? "medium",
      }),

    onSuccess: () => {
      closeQuickCreate();
      queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_KEY });
    },
  });
}
