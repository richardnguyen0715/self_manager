import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardView } from "@/features/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Sprint progress, goal tracking, burndown, today's time blocks, overdue work items, and habits.",
};

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <DashboardView />
    </AppShell>
  );
}
