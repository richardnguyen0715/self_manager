import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { GoalsView } from "@/features/goals";

export const metadata: Metadata = {
  title: "Goals",
  description:
    "Set high-level objectives and track their progress through linked projects and tasks.",
};

export default function GoalsPage() {
  return (
    <AppShell title="Goals">
      <GoalsView />
    </AppShell>
  );
}
