import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { HabitLog } from "@/types";
import type { MarkHabitCompletePayload } from "../types";
import { DASHBOARD_SUMMARY_KEY } from "./useDashboardSummary";
import { useDashboardUIStore } from "../store";

// POST /api/habits/:id/logs — logs today's habit completion.
// Request body: { log_date: YYYY-MM-DD, value: number, note?: string }
// Response: 201 + flat HabitLogResponse
export function useLogHabit() {
  const queryClient = useQueryClient();
  const { addPendingHabit, removePendingHabit } = useDashboardUIStore();

  return useMutation({
    mutationFn: ({ habit_id, date, value }: MarkHabitCompletePayload) =>
      api.post<HabitLog>(`/api/habits/${habit_id}/logs`, {
        log_date: date,
        value: value ?? 1,
      }),

    onMutate: ({ habit_id }) => {
      addPendingHabit(habit_id);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_KEY });
    },

    onError: (_err, { habit_id }) => {
      removePendingHabit(habit_id);
    },

    onSettled: (_data, _err, { habit_id }) => {
      removePendingHabit(habit_id);
    },
  });
}
