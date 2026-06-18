import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { SprintDetail } from "@/features/sprints";

export const metadata: Metadata = {
  title: "Sprint Detail",
  description:
    "Sprint overview, planning, burndown chart, review, and retrospective.",
};

interface SprintDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SprintDetailPage({
  params,
}: SprintDetailPageProps) {
  const { id } = await params;
  return (
    <AppShell title="Sprint Detail">
      <SprintDetail sprintId={id} />
    </AppShell>
  );
}
