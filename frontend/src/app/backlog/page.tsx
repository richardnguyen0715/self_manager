import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { BacklogScreen } from "@/features/backlog";

export const metadata: Metadata = {
  title: "Backlog",
  description:
    "Manage your product backlog — create, prioritise, and move work items into sprints.",
};

export default function BacklogPage() {
  return (
    <AppShell title="Backlog">
      <BacklogScreen />
    </AppShell>
  );
}
