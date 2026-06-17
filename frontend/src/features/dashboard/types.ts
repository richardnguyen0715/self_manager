import type {
  DashboardTask,
  DashboardHabit,
  DashboardEvent,
  DashboardTimeBlock,
  QuickStats,
  DashboardResponse,
  HabitLog,
} from "@/types";

// Re-export the canonical types used within this feature
export type {
  DashboardTask,
  DashboardHabit,
  DashboardEvent,
  DashboardTimeBlock,
  QuickStats,
  DashboardResponse,
  HabitLog,
};

// ─── Quick-action payloads ─────────────────────────────────────────────────────

export interface QuickCreateTaskPayload {
  title: string;
  priority?: "critical" | "high" | "medium" | "low";
  due_date?: string | null;
}

export interface MarkHabitCompletePayload {
  habit_id: string;
  date: string; // YYYY-MM-DD
  value?: number | null;
}

export interface CompleteTaskPayload {
  task_id: string;
}

// ─── Dashboard panel views ────────────────────────────────────────────────────

export type DashboardPanel = "tasks" | "habits" | "events" | "time-blocks";

// ─── Stat card config ─────────────────────────────────────────────────────────

export interface StatCard {
  id: string;
  label: string;
  value: number | string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  href?: string;
}
