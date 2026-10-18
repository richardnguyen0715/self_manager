"use client";

import { cn } from "@/lib/utils";
import { useNotificationsStore, type InboxView } from "../notifications.store";
import type { NotificationType } from "@/types";

// Status tabs: All / Unread / Snoozed (server-side via ?unread_only / ?snoozed).
const INBOX_TABS: { value: InboxView; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "snoozed", label: "Snoozed" },
];

// "deadline" is a UI-only grouping that matches deadline_1d | deadline_2h | deadline_30m.
// "system" is surfaced as "General" in the UI. Applied client-side after fetch.
type TypeFilterOption = "all" | NotificationType | "deadline";

const TYPE_TABS: { value: TypeFilterOption; label: string }[] = [
  { value: "all", label: "Any type" },
  { value: "deadline", label: "Deadlines" },
  { value: "habit_reminder", label: "Habits" },
  { value: "time_block_reminder", label: "Time blocks" },
  { value: "system", label: "General" },
];

function tabClass(active: boolean) {
  return cn(
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-input bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
  );
}

export function NotificationFilters() {
  const { activeFilter, setActiveFilter, inboxView, setInboxView } =
    useNotificationsStore();

  return (
    <div className="flex flex-col gap-2">
      <div
        role="tablist"
        aria-label="Inbox status"
        className="flex flex-wrap gap-1.5"
      >
        {INBOX_TABS.map(({ value, label }) => (
          <button
            key={value}
            role="tab"
            aria-selected={inboxView === value}
            onClick={() => setInboxView(value)}
            className={tabClass(inboxView === value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tablist"
        aria-label="Filter notifications by type"
        className="flex flex-wrap gap-1.5"
      >
        {TYPE_TABS.map(({ value, label }) => (
          <button
            key={value}
            role="tab"
            aria-selected={activeFilter === value}
            onClick={() => setActiveFilter(value)}
            className={tabClass(activeFilter === value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
