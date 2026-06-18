import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { SprintsList } from "@/features/sprints";

export const metadata: Metadata = {
  title: "Sprints",
  description:
    "View and manage all sprints — planned, active, and completed. Create new sprints and track velocity.",
};

export default function SprintsPage() {
  return (
    <AppShell title="Sprints">
      <SprintsList />
    </AppShell>
  );
}
