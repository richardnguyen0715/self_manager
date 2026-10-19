import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CalendarHub } from "@/features/calendar-hub";

export const metadata: Metadata = {
  title: "Calendar",
  description:
    "One calendar for events, time blocks and project tasks — switch between them across day, week, and month views.",
};

export default function CalendarPage() {
  return (
    <AppShell title="Calendar">
      <Suspense fallback={null}>
        <CalendarHub />
      </Suspense>
    </AppShell>
  );
}
