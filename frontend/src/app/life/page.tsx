import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { LifeCalendarView } from "@/features/life-calendar";

export const metadata: Metadata = {
  title: "Life Calendar",
  description:
    "Your personal calendar for managing life — events and time blocks across day, week, and month views, independent of any project.",
};

export default function LifeCalendarPage() {
  return (
    <AppShell title="Life Calendar">
      <LifeCalendarView />
    </AppShell>
  );
}
