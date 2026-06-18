import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { HierarchyView } from "@/features/hierarchy";

export const metadata: Metadata = {
  title: "Hierarchy",
  description:
    "Portfolio view of Goals, Initiatives, Epics, and Work Items with progress rollups.",
};

export default function HierarchyPage() {
  return (
    <AppShell title="Hierarchy">
      <HierarchyView />
    </AppShell>
  );
}
