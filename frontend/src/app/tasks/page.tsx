import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { TaskList } from "@/features/tasks";

export const metadata: Metadata = {
  title: "Tasks",
  description: "Manage your tasks — create, organise, and track progress.",
};

export default function TasksPage() {
  return (
    <AppShell title="Tasks">
      <TaskList />
    </AppShell>
  );
}
