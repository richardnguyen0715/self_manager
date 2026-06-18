import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { WorkItemDetail } from "@/features/workitems";

export const metadata: Metadata = {
  title: "Work Item",
  description:
    "Work item detail — description, subtasks, activity, and details panel.",
};

interface WorkItemDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkItemDetailPage({
  params,
}: WorkItemDetailPageProps) {
  const { id } = await params;
  return (
    <AppShell>
      <WorkItemDetail workItemId={id} />
    </AppShell>
  );
}
