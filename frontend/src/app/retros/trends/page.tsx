import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { TrendsView } from "@/features/retros";

export const metadata: Metadata = {
  title: "Retro Trends",
  description: "Rating and completed items over time, and actions that keep getting carried.",
};

export default function RetroTrendsPage() {
  return (
    <AppShell title="Retro Trends">
      <TrendsView />
    </AppShell>
  );
}
