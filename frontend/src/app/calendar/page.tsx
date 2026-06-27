import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { TaskCalendarView } from "@/features/task-calendar";

export const metadata: Metadata = {
  title: "Calendar",
  description:
    "Your project task timeline — view, create, edit, and reschedule tasks across day, week, and month views.",
};

export default function CalendarPage() {
  return (
    <AppShell title="Calendar">
      <TaskCalendarView />
    </AppShell>
  );
}
