import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { KanbanBoardClient } from "./KanbanBoardClient";

export const metadata: Metadata = {
  title: "Kanban",
  description: "Visualise and manage tasks across custom columns with drag-and-drop.",
};

export default function KanbanPage() {
  return (
    <AppShell title="Kanban">
      {/* Full-height board; overflow handled inside KanbanBoard */}
      <div className="h-full -m-6 p-6 overflow-hidden">
        <KanbanBoardClient />
      </div>
    </AppShell>
  );
}
