import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { TimeBlockingView } from "@/features/timeblocking";

export const metadata: Metadata = {
  title: "Time Blocking | Manage My Life",
  description:
    "Plan your day with time blocks. Link tasks, run focus sessions, and track estimated vs actual time.",
};

export default function TimeBlockingPage() {
  return (
    <AppShell title="Time Blocking">
      <TimeBlockingView />
    </AppShell>
  );
}
