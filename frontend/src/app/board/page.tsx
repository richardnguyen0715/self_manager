import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { SprintBoardClient } from "./SprintBoardClient";

export const metadata: Metadata = {
  title: "Board",
  description:
    "Sprint board — track active-sprint work items across To Do, In Progress, In Review, and Done.",
};

export default function BoardPage() {
  return (
    <AppShell title="Board">
      <SprintBoardClient />
    </AppShell>
  );
}
