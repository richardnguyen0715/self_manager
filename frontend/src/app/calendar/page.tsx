import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { CalendarView } from "@/features/calendar";

export const metadata: Metadata = {
  title: "Calendar",
  description:
    "View and manage your tasks, events, and time blocks across day, week, and month views.",
};

export default function CalendarPage() {
  return (
    <AppShell title="Calendar">
      <CalendarView />
    </AppShell>
  );
}
