"use client";

import { cn } from "@/lib/utils";
import { useNotificationsStore } from "../notifications.store";
import type { NotificationType } from "@/types";

// "deadline" is a UI-only grouping that matches deadline_1d | deadline_2h | deadline_30m.
// "system" is surfaced as "General" in the UI.
type FilterOption = "all" | "unread" | NotificationType | "deadline";

interface FilterTab {
  value: FilterOption;
  label: string;
}

const FILTER_TABS: FilterTab[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "deadline", label: "Deadlines" },
  { value: "habit_reminder", label: "Habits" },
  { value: "time_block_reminder", label: "Time blocks" },
  { value: "system", label: "General" },
];

export function NotificationFilters() {
  const { activeFilter, setActiveFilter } = useNotificationsStore();

  return (
    <div
      role="tablist"
      aria-label="Filter notifications"
      className="flex flex-wrap gap-1.5"
    >
      {FILTER_TABS.map(({ value, label }) => (
        <button
          key={value}
          role="tab"
          aria-selected={activeFilter === value}
          onClick={() => setActiveFilter(value)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            activeFilter === value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
