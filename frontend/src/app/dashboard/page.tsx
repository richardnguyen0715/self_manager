import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardView } from "@/features/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your daily overview — tasks, habits, events and focus time.",
};

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <DashboardView />
    </AppShell>
  );
}
