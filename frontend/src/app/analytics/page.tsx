import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { AnalyticsDashboard } from "@/features/analytics/AnalyticsDashboard";

export const metadata: Metadata = {
  title: "Analytics",
  description:
    "Track your productivity trends, completion rates, focus time, and habit streaks.",
};

export default function AnalyticsPage() {
  return (
    <AppShell title="Analytics">
      <AnalyticsDashboard />
    </AppShell>
  );
}
