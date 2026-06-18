import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { WorkItemList } from "@/features/workitems";

export const metadata: Metadata = {
  title: "Work Items",
  description:
    "Browse and filter all work items — stories, tasks, bugs, and milestones.",
};

export default function WorkItemsPage() {
  return (
    <AppShell title="Work Items">
      <WorkItemList />
    </AppShell>
  );
}
